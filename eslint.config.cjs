import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        browser: true,
        node: true,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
      "no-console": "off",
      eqeqeq: "warn",
      curly: "warn",
      semi: ["error", "always"],
      quotes: ["error", "double"],
    },
    ignores: [
      "node_modules/",
      "dist/",
      "Karaoke/**",
      "Rehearsal/**",
      "img/**",
      "js/vendor/**",
      "css/**"
    ],
  },
];
