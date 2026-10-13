import base from '../eslint.config.mjs';

// Node scripts (.mjs) use Node globals (process, fetch, URL...); TypeScript already checks names.
export default [
  ...base,
  { ignores: ['playwright-report/**', 'test-results/**'] },
  { rules: { 'no-undef': 'off' } },
];
