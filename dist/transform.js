// © 2026 Oscar Knap - Alle rechten voorbehouden
import shortHash from 'short-hash';
import { parse } from "svelte/compiler";
import { generateSameMappings, insert, link, mappingsToString, offsetToPos, overwrite } from './sourceMap.js';
const shortPrefix = '_8';
export function transform(src, fileName, { fileNameHashSalt = '', namePrefix = '', cssJsFunctionName = 'js', } = {}) {
    if (!fileName.endsWith('.svelte'))
        return;
    if (!src.includes('<style'))
        return;
    if (!src.includes('js('))
        return;
    const fileNameHash = shortHash(fileName + (fileNameHashSalt || ''));
    let mappings = generateSameMappings(src);
    let newSrc = src;
    // todo: error handling and return?
    let ast = parse(newSrc);
    let uses = [];
    let useIndex = 0;
    for (const ruleNodeStringI in ast.css.children) {
        const ruleNodeI = parseInt(ruleNodeStringI);
        let ruleNode = ast.css.children[ruleNodeI];
        if (ruleNode.type !== 'Rule')
            continue;
        for (const declarationNodeStringI in ruleNode.block.children) {
            ruleNode = ast.css.children[ruleNodeI];
            const declarationNodeI = parseInt(declarationNodeStringI);
            const declarationNode = ruleNode.block.children[declarationNodeI];
            if (declarationNode.type !== 'Declaration')
                continue;
            if (declarationNode.value.startsWith(cssJsFunctionName + '(') && declarationNode.value.endsWith(')')) {
                if ((!declarationNode.value.startsWith(cssJsFunctionName + '(' + '/*')) ||
                    (!declarationNode.value.endsWith('*/' + ')'))) {
                    throw new Error(`The js in css function syntax is js(/* jsexpression */)`);
                }
                const js = declarationNode.value.slice(cssJsFunctionName.length + '(/*'.length, -1 * '*/)'.length).trim();
                const jsStartIndex = newSrc.indexOf(js, declarationNode.start);
                if (jsStartIndex === -1) {
                    throw new Error('could not find js in css');
                }
                const jsEndIndex = jsStartIndex + js.length;
                // doesn't matter that newSrc changes, because line index is same
                const jsStart = offsetToPos(newSrc, jsStartIndex);
                const jsEnd = offsetToPos(newSrc, jsEndIndex);
                const id = `${shortPrefix}${fileNameHash}${useIndex}`;
                const jsVarName = `${namePrefix}${shortPrefix}${useIndex}`;
                useIndex++;
                const cssVarNameWithoutDash = `${namePrefix}${id}`;
                const newCssValue = `var(--${cssVarNameWithoutDash})`;
                const newDeclaration = `${declarationNode.property}:${newCssValue}`;
                [newSrc, mappings] = overwrite(newSrc, mappings, declarationNode.start, declarationNode.end, newDeclaration);
                uses.push({
                    id,
                    cssVarNameWithoutDash,
                    jsVarName,
                    js,
                    originalJsStart: jsStart,
                    originalJsEnd: jsEnd
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
    // todo: why create separate totalNewJs variable and later do stuff with it. Why not directly after eachother?
    let totalNewJs = '';
    if (uses.length === 1) {
        const use = uses[0];
        let before = `let ${htmlVarName}=$derived(\`<style>:root{--${use.cssVarNameWithoutDash}:\${\n`;
        // space and newlines for source map
        let after = ` \n}}</style>\`);`;
        use.newJsIndex = totalNewJs.length + before.length;
        totalNewJs += `${before}${use.js}${after}`;
    }
    else {
        for (const use of uses) {
            let before = `let ${use.jsVarName}=$derived(\n`;
            // space and newlines for source map
            let after = ` \n);`;
            use.newJsIndex = totalNewJs.length + before.length;
            totalNewJs += `${before}${use.js}${after}`;
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
            [newSrc, mappings] = overwrite(newSrc, mappings, svelteHeadNode.start, svelteHeadNode.end, totalNewSvelteHead);
        }
        else {
            [newSrc, mappings] = insert(newSrc, mappings, 0, `<svelte:head>${totalNewSvelteHead}</svelte:head>`);
        }
        // todo: how to do this without fully re parsing?
        ast = parse(newSrc);
    }
    // check if there is a non module script
    let newJsIndexOffset = 0;
    if (ast.instance) {
        [newSrc, mappings] = insert(newSrc, mappings, ast.instance.end - '</script>'.length, `;${totalNewJs}`);
        // + 1 for semicolon
        newJsIndexOffset = ast.instance.end - '</script>'.length + 1;
    }
    else {
        [newSrc, mappings] = insert(newSrc, mappings, 0, `<script>${totalNewJs}</script>`);
        newJsIndexOffset = '<script>'.length;
    }
    // re parsing not needed, because ast is not needed after
    // ast = parse(newSrc);
    for (const use of uses) {
        if (use.newJsIndex === undefined) {
            throw new Error("Couldn't find new js index");
        }
        // console.log(use.originalJsStart)
        const generatedJsStart = offsetToPos(newSrc, use.newJsIndex + newJsIndexOffset);
        const generatedJsEnd = offsetToPos(newSrc, use.newJsIndex + use.js.length + newJsIndexOffset);
        mappings = link(mappings, use.originalJsStart, use.originalJsEnd, generatedJsStart, generatedJsEnd);
    }
    const stringifiedMappings = mappingsToString(mappings, fileName, src);
    return {
        src: newSrc,
        map: stringifiedMappings,
    };
}
