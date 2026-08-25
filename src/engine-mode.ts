// ЕДИНСТВЕННОЕ место резолва аудио-движка (вариант «г» VERDICT-FINAL-ROADMAP).
// FLIP M3-GO: поменять 'v2'→'v3' в строке ниже — это и есть весь флип одним коммитом.
// Критерий чистоты: строка `import.meta.env.VITE_ENGINE` встречается в src/ ровно в этом файле.
export const ENGINE_MODE: 'v2' | 'v3' =
  (import.meta.env?.VITE_ENGINE as 'v2' | 'v3' | undefined) ?? 'v2';
