import globals from "globals";
import js from "@eslint/js";
import { defineConfig } from "eslint/config";

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
    },
    rules: {
      "no-unused-vars": "warn",
      "comma-dangle": ["error", "always-multiline"],
    },
  },
]);
