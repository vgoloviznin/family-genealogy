import eslint from '@eslint/js';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'out/**', 'release/**', 'dist/**', '**/*.js', '**/*.d.ts', 'eslint.config.mjs']
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    plugins: {
      prettier: prettierPlugin
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...globals.node
      }
    },
    rules: {
      curly: ['error', 'all'],
      'prettier/prettier': [
        'error',
        {
          semi: true,
          singleQuote: true,
          trailingComma: 'none',
          printWidth: 150
        }
      ]
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  }
);
