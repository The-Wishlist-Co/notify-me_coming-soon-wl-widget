import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'build/notify-me-wl.js',
      format: 'iife',
    },
    {
      file: 'build/notify-me-wl.min.js',
      format: 'iife',
      plugins: [terser()],
    },
  ],
  plugins: [resolve(), typescript()],
};
