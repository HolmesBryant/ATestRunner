import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

/**
 * Rollup plugin to intercept .css imports
 * and inline them as Constructable Stylesheets.
 */
function importableStylesheet() {
  return {
    name: 'importable-stylesheet',
    transform(code, id) {
      if (id.endsWith('.css')) {
        const minifiedCss = code.replace(/\r?\n|\r/g, '').replace(/\s{2,}/g, ' ');
        const jsCode = `
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(${JSON.stringify(minifiedCss)});
          export default sheet;
        `;

        return {
          code: jsCode,
          map: null
        };
      }
    }
  };
}

export default {
  input: 'src/ATestRunner.js',
  output: [
    // Standard ES Module (unminified)
    {
      file: 'dist/ATestRunner.js',
      format: 'es',
      sourcemap: false,
      inlineDynamicImports: true
    },
    // Minified ES Module
    {
      file: 'dist/ATestRunner.min.js',
      format: 'es',
      plugins: [terser({
        output: { comments: false },
        compress: {
          keep_infinity: true,
          reduce_funcs: true,
          join_vars: true
        },
        mangle: { keep_classnames: true }
      })],
      sourcemap: true,
      inlineDynamicImports: true
    }
  ],
  plugins: [
    importableStylesheet(),
    resolve(),
  ]
};
