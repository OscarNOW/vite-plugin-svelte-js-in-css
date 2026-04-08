export type mappings = {
    original: [number, number];
    generated: [number, number];
}[];
export declare function offsetToPos(str: string, offset: number): [number, number];
/** Generates mappings for the same source */
export declare function generateSameMappings(src: string): mappings;
/** Overwrites a part of the source. The overwritten text will not have a source mapping */
export declare function overwrite(src: string, maps: mappings, start: number, end: number, value: string): [string, mappings];
/** Inserts a part of the source. The inserted text will not have a source mapping */
export declare function insert(src: string, maps: mappings, index: number, value: string): [string, mappings];
/** Links two parts of the source in the source map. All other mappings for the generated section will be removed */
export declare function link(maps: mappings, originalStart: [number, number], originalEnd: [number, number], generatedStart: [number, number], generatedEnd: [number, number]): mappings;
export declare function mappingsToString(mappings: mappings, originalFileName: string, originalContent: string): string;
