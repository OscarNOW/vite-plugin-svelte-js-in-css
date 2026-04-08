export declare function transform(src: string, fileName: string, { fileNameHasSalt, namePrefix, cssJsFunctionName, }?: {
    fileNameHasSalt?: string;
    namePrefix?: string;
    cssJsFunctionName?: string;
}): undefined | {
    src: string;
    map: string;
};
