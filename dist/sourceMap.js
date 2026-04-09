// © 2026 Oscar Knap - Alle rechten voorbehouden
import { SourceMapGenerator } from "source-map";
export function offsetToPos(str, offset) {
    let line = 1, col = 0;
    for (let i = 0; i < offset; i++) {
        if (str[i] === '\n') {
            line++;
            col = 0;
        }
        else {
            col++;
        }
    }
    return [line, col];
}
function shiftPos(pos, indexPos, deltaStr) {
    let [line, col] = pos;
    let [iLine, iCol] = indexPos;
    if (line < iLine || (line === iLine && col < iCol)) {
        return pos;
    }
    const lines = deltaStr.split('\n');
    if (lines.length === 1) {
        if (line === iLine && col >= iCol) {
            return [line, col + deltaStr.length];
        }
        return pos;
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
function shiftPosDelete(pos, startPos, endPos) {
    let [line, col] = pos;
    if (line < startPos[0]) {
        return pos;
    }
    if (line > endPos[0]) {
        return [line - (endPos[0] - startPos[0]), col];
    }
    if (line === startPos[0] && col < startPos[1]) {
        return pos;
    }
    if (line < endPos[0] || col < endPos[1]) {
        return startPos;
    }
    return [line, col - (endPos[1] - startPos[1])];
}
/** Generates mappings for the same source */
export function generateSameMappings(src) {
    const result = [];
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
        }
        else {
            col++;
        }
    }
    return result;
}
/** Overwrites a part of the source. The overwritten text will not have a source mapping */
export function overwrite(src, maps, start, end, value) {
    const before = src.slice(0, start);
    const after = src.slice(end);
    const newSrc = before + value + after;
    const startPos = offsetToPos(src, start);
    const endPos = offsetToPos(src, end);
    let newMaps = [];
    for (const m of maps) {
        let gen = shiftPosDelete(m.generated, startPos, endPos);
        // skip mappings inside deleted range
        const inside = (m.generated[0] > startPos[0] ||
            (m.generated[0] === startPos[0] && m.generated[1] >= startPos[1])) &&
            (m.generated[0] < endPos[0] ||
                (m.generated[0] === endPos[0] && m.generated[1] <= endPos[1]));
        if (inside)
            continue;
        gen = shiftPos(gen, startPos, value);
        newMaps.push({
            original: m.original,
            generated: gen
        });
    }
    return [newSrc, newMaps];
}
/** Inserts a part of the source. The inserted text will not have a source mapping */
export function insert(src, maps, index, value) {
    const newSrc = src.slice(0, index) + value + src.slice(index);
    const indexPos = offsetToPos(src, index);
    const newMaps = maps.map(m => ({
        original: m.original,
        generated: shiftPos(m.generated, indexPos, value)
    }));
    return [newSrc, newMaps];
}
/** Links two parts of the source in the source map. All other mappings for the generated section will be removed */
export function link(maps, originalStart, originalEnd, generatedStart, generatedEnd) {
    function comparePos(a, b) {
        if (a[0] !== b[0])
            return a[0] - b[0];
        return a[1] - b[1];
    }
    function inRange(pos, start, end) {
        return comparePos(pos, start) >= 0 && comparePos(pos, end) <= 0;
    }
    // 1. Remove mappings inside generated range
    const filtered = maps.filter(m => !inRange(m.generated, generatedStart, generatedEnd));
    for (let generatedLine = generatedStart[0]; generatedLine <= generatedEnd[0]; generatedLine++) {
        let generatedLineStart = generatedLine === generatedStart[0] ? generatedStart[1] : 0;
        let generatedLineLength = generatedLine === generatedEnd[0] ? (generatedEnd[1] - generatedLineStart) : 1;
        let originalLine = originalStart[0] + (generatedLine - generatedStart[0]);
        let originalLineStart = originalLine === originalStart[0] ? originalStart[1] : 0;
        // 2. Add start mapping
        for (let columnOffset = 0; columnOffset < (generatedLineLength); columnOffset++) {
            filtered.push({
                original: [originalLine, originalLineStart + columnOffset],
                generated: [generatedLine, generatedLineStart + columnOffset]
            });
        }
        // 3. Add end mapping (boundary)
        filtered.push({
            original: originalEnd,
            generated: generatedEnd
        });
    }
    // 4. Sort mappings by generated position
    filtered.sort((a, b) => comparePos(a.generated, b.generated));
    return filtered;
}
export function mappingsToString(mappings, originalFileName, originalContent) {
    mappings = mappings.toSorted((a, b) => {
        if (a.generated[0] !== b.generated[0])
            return a.generated[0] - b.generated[0];
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
