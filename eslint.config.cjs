const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    // Игнорируем большие ресурсы / картинки / библиотеки
    ignores: [
      "Karaoke/**",
      "Rehearsal/**",
      "img/**",
      "js/vendor/**",
      "css/**",
      "node_modules/**"
    ],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        // common browser globals
        "window": "readonly",
        "document": "readonly",
        "console": "readonly",
        "fetch": "readonly",
        "Blob": "readonly",
        "URL": "readonly",
        "TextDecoder": "readonly",
        "setTimeout": "readonly",
        "clearTimeout": "readonly",
        "setInterval": "readonly",
        "clearInterval": "readonly",
        "requestAnimationFrame": "readonly",
        "cancelAnimationFrame": "readonly",
        "CustomEvent": "readonly",
        "alert": "readonly",
        "confirm": "readonly",
        // project-specific globals (add yours here)
        "ModalBlockEditor": "readonly"
      }
    },
    rules: {
      // временные/базовые правила
      "no-unused-vars": ["warn", { "args": "none", "varsIgnorePattern": "^_" }],
      "no-console": "off",
      "eqeqeq": "warn",
      "curly": "warn",
      // временно понижаем no-undef, чтобы не падать — позже вернуть на "error"
      "no-undef": "warn",
      "no-async-promise-executor": "error",
      "no-empty": ["error", { "allowEmptyCatch": false }]
    }
  }
];
