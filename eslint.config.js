const js = require('@eslint/js');
const globals = require('globals');

const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = [
  js.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    rules: {
      'no-var': ['error'],
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ]
    },
    languageOptions: {
      // 拡張のスクリプトは ES modules ではなく通常のスクリプトとして読み込まれる
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.serviceworker
      }
    }
  },
  {
    // Ignores must be in a separate block to apply globally:
    // https://eslint.org/docs/latest/use/configure/configuration-files#globally-ignoring-files-with-ignores
    ignores: ['eslint.config.js', '**/dist/**/*']
  }
];
