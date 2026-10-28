import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([...nextVitals, ...nextTs, globalIgnores(['.next/**', 'test-results/**', 'playwright-report/**', 'drizzle/**', 'next-env.d.ts']), { rules: { '@next/next/no-img-element': 'off' } }]);
