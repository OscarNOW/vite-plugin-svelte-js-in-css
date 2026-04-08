// © 2026 Oscar Knap - Alle rechten voorbehouden

import type { Plugin } from 'vite';

import shortHash from 'short-hash';
import { parse } from "svelte/compiler";
import { SourceMapGenerator } from "source-map";

const fileRegex = /\.(svelte)$/;
const shortPrefix = '_8';

type mappings = {
    original: [number, number];
    generated: [number, number];
}[];

function offsetToPos(str: string, offset: number): [number, number] {
    let line = 1, col = 0;
    for (let i = 0; i < offset; i++) {
        if (str[i] === '\n') {
            line++;
            col = 0;
        } else {
            col++;
        }
    }
    return [line, col];
}

// function posToOffset(str: string, pos: [number, number]): number {
//     let [targetLine, targetCol] = pos;
//     let line = 1, col = 0;

//     for (let i = 0; i < str.length; i++) {
//         if (line === targetLine && col === targetCol) return i;

//         if (str[i] === '\n') {
//             line++;
//             col = 0;
//         } else {
//             col++;
//         }
//     }
//     return str.length;
// }

function shiftPos(
    pos: [number, number],
    indexPos: [number, number],
    deltaStr: string
): [number, number] {
    let [line, col] = pos;
    let [iLine, iCol] = indexPos;

    if (line < iLine || (line === iLine && col < iCol)) {
        return pos;
    }

    const lines = deltaStr.split('\n');

    if (lines.length === 1) {
        return [line, col + lines[0].length];
    }

    const newLine = line + lines.length - 1;

    if (line === iLine) {
        return [
            newLine,
            lines[lines.length - 1].length + (col - iCol)
        ];
    }

    return [newLine, col];
}

function shiftPosDelete(
    pos: [number, number],
    startPos: [number, number],
    endPos: [number, number]
): [number, number] {
    let [line, col] = pos;

    // before
    if (line < startPos[0] || (line === startPos[0] && col < startPos[1])) {
        return pos;
    }

    // inside deleted → snap to start
    if (
        (line > startPos[0] || (line === startPos[0] && col >= startPos[1])) &&
        (line < endPos[0] || (line === endPos[0] && col <= endPos[1]))
    ) {
        return startPos;
    }

    // after → shift backwards
    const lineDelta = endPos[0] - startPos[0];
    if (lineDelta === 0) {
        return [line, col - (endPos[1] - startPos[1])];
    }

    if (line === endPos[0]) {
        return [
            line - lineDelta,
            startPos[1] + (col - endPos[1])
        ];
    }

    return [line - lineDelta, col];
}

/** Generates mappings for the same source */
function generateSameMappings(src: string): mappings {
    const result: mappings = [];

    let line = 1;
    let col = 0;

    result.push({
        original: [1, 0],
        generated: [1, 0]
    });

    for (let i = 0; i < src.length; i++) {
        if (src[i] === '\n') {
            line++;
            col = 0;

            result.push({
                original: [line, 0],
                generated: [line, 0]
            });
        } else {
            col++;
        }
    }

    return result;
}

/** Overwrites a part of the source. The overwritten text will not have a source mapping */
function overwrite(src: string, maps: mappings, start: number, end: number, value: string): [string, mappings] {
    const before = src.slice(0, start);
    const after = src.slice(end);

    const newSrc = before + value + after;

    const startPos = offsetToPos(src, start);
    const endPos = offsetToPos(src, end);

    let newMaps: mappings = [];

    for (const m of maps) {
        let gen = shiftPosDelete(m.generated, startPos, endPos);

        // skip mappings inside deleted range
        const inside =
            (m.generated[0] > startPos[0] ||
                (m.generated[0] === startPos[0] && m.generated[1] >= startPos[1])) &&
            (m.generated[0] < endPos[0] ||
                (m.generated[0] === endPos[0] && m.generated[1] <= endPos[1]));

        if (inside) continue;

        gen = shiftPos(gen, startPos, value);

        newMaps.push({
            original: m.original,
            generated: gen
        });
    }

    return [newSrc, newMaps];
}

/** Inserts a part of the source. The inserted text will not have a source mapping */
function insert(src: string, maps: mappings, index: number, value: string): [string, mappings] {
    const newSrc = src.slice(0, index) + value + src.slice(index);

    const indexPos = offsetToPos(src, index);

    const newMaps = maps.map(m => ({
        original: m.original,
        generated: shiftPos(m.generated, indexPos, value)
    }));

    return [newSrc, newMaps];
}

/** Links two parts of the source in the source map. All other mappings for the generated section will be removed */
function link(maps: mappings, originalStart: [number, number], originalEnd: [number, number], generatedStart: [number, number], generatedEnd: [number, number]): mappings {

    function comparePos(a: [number, number], b: [number, number]) {
        if (a[0] !== b[0]) return a[0] - b[0];
        return a[1] - b[1];
    }

    function inRange(
        pos: [number, number],
        start: [number, number],
        end: [number, number]
    ) {
        return comparePos(pos, start) >= 0 && comparePos(pos, end) <= 0;
    }

    // 1. Remove mappings inside generated range
    const filtered = maps.filter(m => !inRange(m.generated, generatedStart, generatedEnd));

    // 2. Add start mapping
    filtered.push({
        original: originalStart,
        generated: generatedStart
    });

    // 3. Add end mapping (boundary)
    filtered.push({
        original: originalEnd,
        generated: generatedEnd
    });

    // 4. Sort mappings by generated position
    filtered.sort((a, b) => comparePos(a.generated, b.generated));

    return filtered;
}

function mappingsToString(mappings: mappings, originalFileName: string, originalContent: string): string {
    mappings = mappings.toSorted((a, b) => {
        if (a.generated[0] !== b.generated[0]) return a.generated[0] - b.generated[0];
        return a.generated[1] - b.generated[1];
    });

    const map = new SourceMapGenerator({
        file: originalFileName // output fileName is same as input fileName
    });

    map.setSourceContent(originalFileName, originalContent);

    for (const m of mappings) {
        map.addMapping({
            source: originalFileName,
            original: { line: m.original[0], column: m.original[1] },
            generated: { line: m.generated[0], column: m.generated[1] },
        });
    }

    return map.toString();
}

export default function svelteJsInCss({
    fileNameHasSalt = '',
    namePrefix = '',
    cssJsFunctionName = 'js',
}: {
    fileNameHasSalt?: string;
    namePrefix?: string;
    cssJsFunctionName?: string;
} = {}): Plugin {
    return {
        name: 'svelte-js-in-css',

        enforce: 'pre', // before svelte

        transform: {
            filter: {
                id: fileRegex,
            },
            handler(src, fileName) {
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
                    const use = uses[0];
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

                import('fs').then(fs => {
                    fs.writeFileSync('zzoriginal.svelte', src);
                    fs.writeFileSync('zzgenerated.svelte', newSrc);
                    fs.writeFileSync('zzsourcemap.json', stringifiedMappings);

                    console.log('successful write');
                    process.exit();
                });

                return;
                // return {
                //     code: newSrc,
                //     map: null, // provide source map if available
                // }
            },
        },
    }
}