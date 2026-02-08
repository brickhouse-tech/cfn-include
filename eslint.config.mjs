import globals from "globals";
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import mochaPlugin from "eslint-plugin-mocha";

export default defineConfig([
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'lib/**',
      'src/**',
      'tmp/**',
    ]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: {
        ...globals.commonjs,
        ...globals.node,
      },
    },
    plugins: {
      js,
      mocha: mochaPlugin,
    },
    rules: {
      ...mochaPlugin.configs.recommended.rules,
      "mocha/no-setup-in-describe": "off",
      "no-unused-vars": "warn",
      "comma-dangle": ["error", "always-multiline"],
    },
  },
]);
