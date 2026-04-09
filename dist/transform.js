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
                ast = parse(newSrc);
            }
        }
    }
    if (uses.length === 0) {
        return;
    }
    const htmlVarName = `${namePrefix}${shortPrefix}`;
    {
        const newSvelteHeadCode = `{@html ${htmlVarName}}`;
        let svelteHeadNode = null;
        for (const node of ast.html.children) {
            if (node.type === 'Head') {
                svelteHeadNode = node;
                break;
            }
        }
        if (svelteHeadNode) {
            [newSrc, mappings] = overwrite(newSrc, mappings, svelteHeadNode.start, svelteHeadNode.end, newSvelteHeadCode);
        }
        else {
            [newSrc, mappings] = insert(newSrc, mappings, 0,
                // extra spaces for svelte parser
                ` <svelte:head>${newSvelteHeadCode}</svelte:head> `);
        }
        ast = parse(newSrc);
    }
    let newJsCode = '';
    if (uses.length === 1) {
        const use = uses[0];
        let before = `let ${htmlVarName}=$derived(\`<style>:root{--${use.cssVarNameWithoutDash}:\${`;
        let after = `}}</style>\`);`;
        use.newJsIndex = newJsCode.length + before.length;
        newJsCode += `${before}${use.js}${after}`;
    }
    else {
        for (const use of uses) {
            let before = `let ${use.jsVarName}=$derived(`;
            let after = `);`;
            use.newJsIndex = newJsCode.length + before.length;
            newJsCode += `${before}${use.js}${after}`;
        }
        newJsCode += `let ${htmlVarName}=$derived(\`<style>:root{${uses.map((use) => `--${use.cssVarNameWithoutDash}:\${${use.jsVarName}}`).join(';')}}</style>\`);`;
    }
    // check if there is a non module script
    let newJsIndexOffset = 0;
    if (ast.instance) {
        [newSrc, mappings] = insert(newSrc, mappings, ast.instance.end - '</script>'.length, `;${newJsCode}`);
        // + 1 for semicolon
        newJsIndexOffset = ast.instance.end - '</script>'.length + 1;
    }
    else {
        [newSrc, mappings] = insert(newSrc, mappings, 0,
            // extra spaces for svelte parser
            ` <script>${newJsCode}</script> `);
        newJsIndexOffset = '<script>'.length;
    }
    // re parsing not needed, because ast is not needed after
    // ast = parse(newSrc);
    for (const use of uses) {
        if (use.newJsIndex === undefined) {
            throw new Error("Couldn't find new js index");
        }
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
