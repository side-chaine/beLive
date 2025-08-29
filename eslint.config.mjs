import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        // Браузерные / Web API
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        CustomEvent: "readonly",
        Blob: "readonly",
        URL: "readonly",
        TextDecoder: "readonly",
        OfflineAudioContext: "readonly",
        AudioContext: "readonly",
        // DOM / canvas / workers etc.
        Image: "readonly",
        Worker: "readonly",
        // проектные/локальные глобальные объекты (если есть) — добавь сюда,
        // например: ModalBlockEditor (если используется в коде)
        ModalBlockEditor: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "args": "none", "varsIgnorePattern": "^_" }],
      "no-console": "off",
      "eqeqeq": "warn",
      "curly": "warn",
      "semi": ["error", "always"],
      "quotes": ["error", "double"],
      // временные смягчения — можно ослабить, если много шума:
      // "no-undef": "error" (оставляем включённым, т.к. полезно)
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
