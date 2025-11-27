 
(function(global){
  const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
  let currentLevel = LEVELS.info;
  let debugEnabled = false;

  function setLevel(level){
    if (typeof level === 'string' && LEVELS[level] != null) {
      currentLevel = LEVELS[level];
    } else if (typeof level === 'number') {
      currentLevel = level;
    }
  }

  function toggleDebugLogs(enable){
    debugEnabled = !!enable;
    if (enable) {currentLevel = LEVELS.debug;}
  }

  function fmt(component, level, message, context){
    const ts = new Date().toISOString();
    const payload = { ts, level, component, message };
    if (context && typeof context === 'object') {Object.assign(payload, { context });}
    return payload;
  }

  function logAt(levelName, component, message, context){
    const level = LEVELS[levelName] || LEVELS.info;
    if (!debugEnabled && level < currentLevel) {return;}
    const payload = fmt(component, levelName, message, context);
    switch (levelName){
      case 'debug': console.debug(payload); break;
      case 'info': console.info(payload); break;
      case 'warn': console.warn(payload); break;
      case 'error': console.error(payload); break;
      default: console.log(payload);
    }
  }

  const logger = {
    setLevel,
    toggleDebugLogs,
    debug: (component, message, context) => logAt('debug', component, message, context),
    info: (component, message, context) => logAt('info', component, message, context),
    warn: (component, message, context) => logAt('warn', component, message, context),
    error: (component, message, context) => logAt('error', component, message, context),
  };

  global.AppLogger = logger;
})(window); 