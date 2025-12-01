import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    ignores: [
      "Karaoke/**",
      "Rehearsal/**",
      "img/**",
      "js/vendor/**",
      "css/**",
      "resources/masks/png/**",
      "node_modules/**",
      "dist/**"
    ],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        location: "readonly",
        performance: "readonly",
        fetch: "readonly",
        OfflineAudioContext: "readonly",
        AudioContext: "readonly",
        AudioBuffer: "readonly",
        AudioWorkletNode: "readonly",
        Blob: "readonly",
        URL: "readonly",
        TextDecoder: "readonly",
        TextEncoder: "readonly",
        Image: "readonly",
        HTMLImageElement: "readonly",
        HTMLElement: "readonly",
        NodeList: "readonly",
        File: "readonly",
        FileReader: "readonly",
        FormData: "readonly",
        WebSocket: "readonly",
        MediaSource: "readonly",
        MediaStream: "readonly",
        MediaStreamTrack: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        CustomEvent: "readonly",
        EventSource: "readonly",
        ModalBlockEditor: "readonly",
        _: "readonly",
        globalThis: "readonly",
        atob: "readonly",
        btoa: "readonly",
        confirm: "readonly",
        alert: "readonly",
        prompt: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "args": "none", "varsIgnorePattern": "^_" }],
      "no-console": "off",
      "eqeqeq": "warn",
      "curly": "warn",
      "no-empty": "warn",
      "no-async-promise-executor": "warn",
      "no-case-declarations": "warn"
    }
  }
];
