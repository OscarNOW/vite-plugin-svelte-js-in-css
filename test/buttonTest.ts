import fs from 'fs';
import { transform } from '../src/transform';

// for watch reload
import './Button.svelte';

const src = fs.readFileSync('test/button.svelte', 'utf-8');

const transformation = transform(src, 'test/button.svelte');

fs.writeFileSync('zzzoriginal.svelte', src);

if (!transformation) {
    console.log('no transformation');
} else {
    fs.writeFileSync('zzzgenerated.svelte', transformation.src);
    fs.writeFileSync('zzzsourcemap.json', transformation.map);

    console.log('success')
}
