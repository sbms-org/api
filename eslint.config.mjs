import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([globalIgnores(["dist", "node_modules"]), {
    extends: compat.extends("standard"),

    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.mocha,
        },

        parser: tsParser,
        ecmaVersion: 6,
        sourceType: "module",
    },

    rules: {
        "generator-star-spacing": [2, {
            before: true,
            after: true,
        }],

        "no-shadow": 0,
        "import/no-unresolved": 0,
        "import/extensions": 0,
        "require-yield": 0,
        "no-param-reassign": 0,
        "comma-dangle": 0,
        "no-underscore-dangle": 0,
        "no-control-regex": 0,

        "import/no-extraneous-dependencies": [2, {
            devDependencies: true,
        }],

        "func-names": 0,
        "no-unused-expressions": 0,
        "prefer-arrow-callback": 1,

        "no-use-before-define": [2, {
            functions: false,
        }],

        "space-before-function-paren": [2, "always"],
        "max-len": [2, 180, 2],
        semi: [2, "never"],
        strict: [2, "global"],
        "arrow-parens": [2, "always"],
        "import/prefer-default-export": 0,
        "no-plusplus": 0,
        "no-console": 0,
        "no-undef": 0,
        "new-cap": 0,
        "no-unused-vars": 0,
        "quote-props": 0,
        "dot-notation": 0,
    },
}]);