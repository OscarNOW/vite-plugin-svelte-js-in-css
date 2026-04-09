export declare function transform(src: string, fileName: string, { fileNameHashSalt, namePrefix, cssJsFunctionName, }?: {
    fileNameHashSalt?: string;
    namePrefix?: string;
    cssJsFunctionName?: string;
}): undefined | {
    src: string;
    map: string;
};
