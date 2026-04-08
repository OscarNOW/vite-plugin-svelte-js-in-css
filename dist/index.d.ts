import type { Plugin } from 'vite';
export default function svelteJsInCss({ fileNameHasSalt, namePrefix, cssJsFunctionName, }?: {
    fileNameHasSalt?: string;
    namePrefix?: string;
    cssJsFunctionName?: string;
}): Plugin;
