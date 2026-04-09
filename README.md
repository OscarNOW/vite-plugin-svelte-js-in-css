# vite-plugin-svelte-js-in-css

Use Javascript expressions directly in your Svelte styles

**⚠️ Do not use user input in the javascript expressions. This could lead to XSS ⚠️**

Github: https://github.com/OscarNOW/vite-plugin-svelte-js-in-css

## Use

This plugin allows you to run javascript expressions in your CSS declaration values like this:

```html
<script>
    let a = $state(20);
</script>

<div></div>

<style>
    div {
        width: js(/* a * 2 + "px" */);
    }
</style>
```

This uses the result of the expression `a * 2 + "px"` as the value for width.

The javascript expression can return any CSS value (including other CSS functions) (with a CSS unit) as a string, like:
- `20px`
- `calc(2rem + 3px)`
- `2`

Limitations:
- This plugin only works inside `.svelte` files
- This plugin only supports the Svelte 5 *Runes mode*, not the *Legacy mode*
- The javascript expression must be put inside a CSS comment (so that the file is still a valid Svelte file)
- You can't use `*/` in your javascript expression (because that would end the CSS comment)
- The `js` function can't be nested:

This is not supported: `opacity: calc(js(/* 0.4 + 0.3 */) / 2);`

Instead, include the `calc` in the javascript like this: `opacity: js(/* 'calc(' + 0.4 + 0.3 + ' / 2)' */);`

## Installation

Install:
`npm install --save-dev vite-plugin-svelte-js-in-css`

Add the plugin to your `vite.config.js`:

```js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import svelteCssInJs from 'vite-plugin-svelte-js-in-css';

export default defineConfig({
    plugins: [
        svelteCssInJs(), // <-- MUST BE BEFORE SVELTE(KIT)
        sveltekit(),
    ]
});
```

### Options

```js
import svelteCssInJs from 'vite-plugin-svelte-js-in-css';

svelteCssInJs({
    fileNameHashSalt: '',
    namePrefix: '',
    cssJsFunctionName: 'js'
});
```

#### `fileNameHashSalt`
A random secret string used so that people can't reverse engineer your file names. If you do not care if your file names are public, don't specify. See security.

#### `namePrefix`
A prefix used for all generated javascript and (global) css variable names. You can add a custom prefix if you're having name collisions, or want to see which variables come from this plugin. This value must be a valid javascript and CSS variable name.

#### `cssJsFunctionName`
The css function name used to evaluate javascript. By default it's `js`.

## Security

- The return value of the javascript expression is directly used in HTML. This means that the javascript expression could escape the CSS, add any HTML and perform an XSS attack. **Only use simple Javascript expressions that don't use any user input**
- The hash of the original file name is used in the compiled code. This means that attackers could reverse engineer the original file name. If you want to prevent this pass a `fileNameHashSalt`. This should be a non guessable secret string. As long as the attackers don't know that string, they can't get the file names.

## Details

- The javascript context is the same as in the component `<script>`. This means that you can use variables or functions defined inside the `<script>`.
- Internally, the javascript expressions get put inside a Svelte `$derived(...)`. This means that the expression automatically gets re-run when one of the dependencies changes. [See Svelte `$derived`](https://svelte.dev/docs/svelte/$derived). If you do not want this, use the Svelte [`untrack`](https://svelte.dev/docs/svelte/svelte#untrack) function.
- Internally, the javascript expression gets put inside the existing `<script>` tag. (If there isn't one, one will be created). If you want to use Typescript, make sure you have a `<script lang="ts">` in the component. (It could also be empty like this: `<script lang="ts"></script>`)
