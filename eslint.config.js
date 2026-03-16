import pluginJs from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    // Ignore dist and node_modules
    {
        ignores: ["dist/", "node_modules/", "**/*.js"],
    },

    // Base JS recommended rules
    pluginJs.configs.recommended,

    // TypeScript recommended rules
    ...tseslint.configs.recommended,

    // Global settings
    {
        languageOptions: {
            globals: {
                ...globals.node,
                jest: true,
            },
        },
    },

    // Custom rules for TypeScript
    {
        files: ["src/**/*.ts"],
        rules: {
            // ── Type Safety ──
            "@typescript-eslint/no-explicit-any": "warn", // Gradual: warn first, then error later
            "@typescript-eslint/no-non-null-assertion": "warn",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],

            // ── Best Practices ──
            "@typescript-eslint/no-require-imports": "error",
            "@typescript-eslint/consistent-type-imports": "warn",

            // ── Disable base rules that conflict with TS ──
            "no-unused-vars": "off", // Handled by @typescript-eslint/no-unused-vars
            "no-undef": "off", // TypeScript handles this
        },
    },
);
