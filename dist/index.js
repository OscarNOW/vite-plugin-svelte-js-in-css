// © 2026 Oscar Knap - Alle rechten voorbehouden
import { transform } from './transform.js';
const fileRegex = /\.(svelte)$/;
export default function svelteJsInCss({ fileNameHashSalt = '', namePrefix = '', cssJsFunctionName = 'js', } = {}) {
    return {
        name: 'svelte-js-in-css',
        enforce: 'pre', // before svelte
        transform: {
            filter: {
                id: fileRegex,
            },
            handler(src, fileName) {
                const transformation = transform(src, fileName, {
                    fileNameHashSalt,
                    namePrefix,
                    cssJsFunctionName,
                });
                if (!transformation)
                    return;
                return {
                    code: transformation.src,
                    map: transformation.map,
                };
            },
        },
    };
}
