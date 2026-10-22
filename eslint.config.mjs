import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The product client under components/sodam is a faithful extraction of
    // the original codebase, whose data loading intentionally uses the
    // effect → async reload → setState pattern throughout. The new
    // React-Compiler-era rule `react-hooks/set-state-in-effect` flags that
    // established pattern at every fetch site; rewriting all of them during
    // extraction would risk behavior drift, so the rule is relaxed for the
    // extracted client only. All standalone code (app/, lib/) is fully linted.
    files: ['components/sodam/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  globalIgnores(['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/**']),
]);

export default eslintConfig;
