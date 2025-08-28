module.exports = {
  ignores: [
    "Karaoke/**",
    "Rehearsal/**",
    "img/**",
    "js/vendor/**",
    "css/**"
  ],
  languageOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  extends: ["eslint:recommended"],
  rules: {
    "no-unused-vars": ["warn", { "args": "none", "varsIgnorePattern": "^_" }],
    "no-console": "off",
    "eqeqeq": "warn",
    "curly": "warn"
  }
};
