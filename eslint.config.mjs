import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        // браузерные глобалы, отмечаем как readonly (ESLint не будет жаловаться no-undef)
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        OfflineAudioContext: "readonly"
      }
    },
    rules: {
      // базовые правила — ты потом можешь их настроить
      "no-unused-vars": ["warn", { "args": "none", "varsIgnorePattern": "^_" }],
      "no-console": "off",
      "eqeqeq": "warn",
      "curly": "warn",
      "semi": ["error", "always"],
      "quotes": ["error", "double"]
    },
    ignores: [
      "node_modules/",
      "js/vendor/**",
      "Karaoke/**",
      "Rehearsal/**",
      "img/**",
      "css/**"
    ]
  }
];
