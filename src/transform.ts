// © 2026 Oscar Knap - Alle rechten voorbehouden

import type { Plugin } from 'vite';

import shortHash from 'short-hash';
import { parse } from "svelte/compiler";
import { generateSameMappings, insert, mappingsToString, overwrite } from './sourceMap';

const shortPrefix = '_8';

export function transform(src: string, fileName: string, {
    fileNameHasSalt = '',
    namePrefix = '',
    cssJsFunctionName = 'js',
}: {
    fileNameHasSalt?: string;
    namePrefix?: string;
    cssJsFunctionName?: string;
} = {}): undefined | { src: string; map: string; } {
    if (!fileName.endsWith('.svelte')) return;
    if (!src.includes('<style')) return;
    if (!src.includes('js(')) return;

    const fileNameHash = shortHash(fileName + (fileNameHasSalt || ''));

    let mappings = generateSameMappings(src);

    let newSrc = src;

    // todo: error handling and return?
    let ast = parse(newSrc);

    let uses: {
        id: string;
        cssVarNameWithoutDash: string;
        jsVarName: string;
        js: string;
    }[] = [];

    let useIndex = 0;

    for (const ruleNodeStringI in ast.css.children) {
        const ruleNodeI = parseInt(ruleNodeStringI);
        let ruleNode = ast.css.children[ruleNodeI];

        if (ruleNode.type !== 'Rule') continue;

        for (const declarationNodeStringI in ruleNode.block.children) {
            ruleNode = ast.css.children[ruleNodeI];
            const declarationNodeI = parseInt(declarationNodeStringI);
            const declarationNode = ruleNode.block.children[declarationNodeI];

            if (declarationNode.type !== 'Declaration') continue;

            if (declarationNode.value.startsWith(cssJsFunctionName + '(') && declarationNode.value.endsWith(')')) {

                const js = declarationNode.value.slice(cssJsFunctionName.length + 1, -1).trim();

                const id = `${shortPrefix}${fileNameHash}${useIndex}`;
                const jsVarName = `${namePrefix}${shortPrefix}${useIndex}`;
                useIndex++;

                const cssVarNameWithoutDash = `${namePrefix}${id}`;

                const newCssValue = `var(--${cssVarNameWithoutDash})`;
                const newDeclaration = `${declarationNode.property}:${newCssValue}`;

                [newSrc, mappings] = overwrite(
                    newSrc,
                    mappings,
                    declarationNode.start,
                    declarationNode.end,
                    newDeclaration
                );

                uses.push({
                    id,
                    cssVarNameWithoutDash,
                    jsVarName,
                    js,
                });

                // todo: how to do this without fully re parsing?
                ast = parse(newSrc);
            }
        }
    }

    if (uses.length === 0) {
        return;
    }

    const htmlVarName = `${namePrefix}${shortPrefix}`;

    let totalNewSvelteHead = `{@html ${htmlVarName}}`;

    let totalNewJs = '';
    if (uses.length === 1) {
        const use = uses[0]!;
        totalNewJs += `let ${htmlVarName}=$derived(\`<style>:root{--${use.cssVarNameWithoutDash}:\${${use.js}}}</style>\`);`;
    } else {
        for (const use of uses) {
            totalNewJs += `let ${use.jsVarName}=$derived(${use.js});`;
        }
        totalNewJs += `let ${htmlVarName}=$derived(\`<style>:root{${uses.map((use) => `--${use.cssVarNameWithoutDash}:\${${use.jsVarName}}`).join(';')}}</style>\`);`;
    }

    {
        let svelteHeadNode = null;

        for (const node of ast.html.children) {
            if (node.type === 'Head') {
                svelteHeadNode = node;
                break;
            }
        }

        if (svelteHeadNode) {
            [newSrc, mappings] = overwrite(
                newSrc,
                mappings,
                svelteHeadNode.start,
                svelteHeadNode.end,
                totalNewSvelteHead
            );
        } else {
            [newSrc, mappings] = insert(
                newSrc,
                mappings,
                0,
                `<svelte:head>${totalNewSvelteHead}</svelte:head>`
            );
        }

        // todo: how to do this without fully re parsing?
        ast = parse(newSrc);
    }

    // check if there is a non module script
    if (ast.instance) {
        [newSrc, mappings] = insert(
            newSrc,
            mappings,
            ast.instance.end - '</script>'.length,
            `;${totalNewJs}`
        );
    } else {
        [newSrc, mappings] = insert(
            newSrc,
            mappings,
            0,
            `<script>${totalNewJs}</script>`
        );
    }

    ast = parse(newSrc);

    // todo: link js from css js function to actual js in source map

    const stringifiedMappings = mappingsToString(mappings, fileName, src);

    return {
        src: newSrc,
        map: stringifiedMappings,
    }
}