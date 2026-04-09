import type { Plugin } from 'vite';
export default function svelteJsInCss({ fileNameHashSalt, namePrefix, cssJsFunctionName, }?: {
    fileNameHashSalt?: string;
    namePrefix?: string;
    cssJsFunctionName?: string;
}): Plugin;
