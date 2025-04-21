import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import eslintPluginImport from 'eslint-plugin-import';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends(
    "next/core-web-vitals",
    "eslint-config-prettier"
  ),
  {
    plugins: {
      import: eslintPluginImport,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.json', './tsconfig.worker.json'],
        },
        node: true
      },
    },
    rules: {
    }
  }
];

export default eslintConfig;
