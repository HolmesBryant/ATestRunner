import terser from '@rollup/plugin-terser';

export default {
  input: 'src/ATestRunner.js',
  output: {
    file: 'dist/ATestRunner.min.js',
    format: 'es',
    sourcemap: false,
  },
  plugins: [
    terser({
      output: {
        comments: false
      },
      compress: {
        keep_infinity: true,
        reduce_funcs: true,
        join_vars: true,
        keep_fnames: false
      },
      mangle: {
        keep_classnames: true
      }
    }),
  ],
};
