/**
 * Build config for the expert-agents plugin.
 *
 * Three artifacts, two runtimes:
 *
 *   `lib/index.js`    the Host half, plain ESM for Node 22.
 *   `lib/remote.js`   the Host Remote service, plain ESM for Node 22.
 *   `lib/client.js`   the browser half, emitted as a CJS closure-factory so it
 *                     can be served to the shell's module loader, which resolves
 *                     `require()` calls against its own module table. `react`
 *                     stays an import: the shell owns the single React instance
 *                     and a second copy would break hooks across the boundary.
 *
 * The two faces externalize different sets, which is the point. The Host half
 * imports every `@deepseek-ai/*` name because the Node runtime resolves those
 * for real. The browser half must not: the module table holds exactly nine seed
 * words (see `packages/client/web/src/platform.ts`) plus one row per dynamic
 * bundle, and nothing seeds `schemastery`. A `require()` the table cannot answer
 * throws inside the factory, so the entry never gets a fiber and boot dies with
 * "did not activate". Anything the client reaches that is not a seed word is
 * therefore inlined here, even though the Host half imports the same name.
 */

import { defineConfig } from 'tsdown'

/** Runtime-provided by the DSH Node host, so the Host halves keep them as imports. */
const PROVIDED = /^(@deepseek-ai\/|react$|react-dom$|node:)/

/**
 * Seed words of the shell's frozen browser module table. Everything else the
 * client face reaches is bundled.
 */
const BROWSER_SEED = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

export default defineConfig([
  {
    name: 'dsh-expert-agents',
    entry: { index: 'src/index.ts', remote: 'src/remote.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    deps: {
      // Everything the host provides stays an import; anything else (there is
      // nothing else today) would inline. tsdown reads the tsconfig `paths`,
      // so the host packages resolve to the workspace without being installed.
      neverBundle: (specifier) => PROVIDED.test(specifier),
      alwaysBundle: (specifier) => !PROVIDED.test(specifier),
    },
  },
  {
    name: 'dsh-expert-agents/client',
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    sourcemap: true,
    deps: {
      // The browser table, not the host, decides what stays external here: a
      // `schemastery` (or any non-seed) import is inlined instead of becoming a
      // require the loader cannot answer. Inlining needs the *source*, and the
      // strict root tsconfig rejects that source's own type quirks — hence
      // `tsconfig: 'tsconfig.client.json'` below, which resolves this name to
      // `vendor/schemastery/src` while leaving every other alias alone.
      neverBundle: (specifier) => BROWSER_SEED.has(specifier),
      alwaysBundle: (specifier) => !BROWSER_SEED.has(specifier),
    },
    tsconfig: 'tsconfig.client.json',
    outputOptions: {
      entryFileNames: 'client.js',
      // The module loader fetches the artifact and calls the factory with its
      // own `require`, so the wrapper is the plugin ABI, not a bundler detail.
      banner: 'window.__ModuleLoader__.load({ id: "dsh-expert-agents", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
