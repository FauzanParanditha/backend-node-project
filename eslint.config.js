import pluginJs from "@eslint/js";
import globals from "globals";

/** @type {import('eslint').Linter.FlatConfig} */
export default [
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                jest: true, // Define jest global variables for testing
            },
        },
    },
    {
        ...pluginJs.configs.recommended,
        rules: {
            "no-unused-vars": ["warn", { vars: "all", args: "none" }],
        },
    },
];
