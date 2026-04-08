// © 2026 Oscar Knap - Alle rechten voorbehouden

import type { Plugin } from 'vite';

import { transform } from './transform';

const fileRegex = /\.(svelte)$/;

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
                const transformation = transform(src, fileName, {
                    fileNameHasSalt,
                    namePrefix,
                    cssJsFunctionName,
                });

                if (!transformation) return;

                return {
                    code: transformation.src,
                    map: transformation.map,
                }
            },
        },
    }
}