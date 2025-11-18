(function(global){
  const Constants = {
    // Таймауты/задержки
    INITIAL_CENTERING_DELAY_MS: 150,
    AUTO_RETURN_DELAY_MS: 2000,

    // Ограничения конкурентности
    MAX_PARALLEL_AUDIO_DECODE: 2,

    // Поведение загрузки
    AUDIO_FETCH_RETRY: 2,
    AUDIO_FETCH_BACKOFF_MS: 300,

    // Пороговые значения
    MIN_EMPTY_LINES_FOR_BLOCKS: 1,
  };

  global.AppConstants = Constants;
})(window); 