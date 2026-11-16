import { FlatCompat } from '@eslint/eslintrc';
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [
  { ignores: ['.next/**', '.next-v2/**', 'node_modules/**', '.private-data/**', 'test-results/**'] },
  ...compat.extends('next/core-web-vitals'),
  { rules: { '@next/next/no-img-element': 'off' } },
  // App Router root layout applies its font links to every route, unlike pages/_document.
  { files: ['src/app/layout.tsx'], rules: { '@next/next/no-page-custom-font': 'off' } },
];
