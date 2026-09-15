// eslint.config.js — flat config for ESLint v10+.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    { ignores: ["dist", "node_modules", "public"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx,js,mjs}"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                window: "readonly",
                document: "readonly",
                performance: "readonly",
                console: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                requestAnimationFrame: "readonly",
                cancelAnimationFrame: "readonly",
                AudioContext: "readonly",
                ResizeObserver: "readonly",
                fetch: "readonly",
                Math: "readonly",
                Number: "readonly",
                ArrayBuffer: "readonly",
                Float32Array: "readonly",
                Uint8Array: "readonly",
                Uint16Array: "readonly",
                Uint32Array: "readonly",
                HTMLCanvasElement: "readonly",
                HTMLElement: "readonly",
                KeyboardEvent: "readonly",
                MouseEvent: "readonly",
                WheelEvent: "readonly",
                Image: "readonly",
                Buffer: "readonly",
                process: "readonly",
                globalThis: "readonly",
            },
        },
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            "@typescript-eslint/no-explicit-any": "off",
        },
    },
];