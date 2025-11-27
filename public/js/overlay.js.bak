(function(global){
  function ensureDarkOverlay(containerSelector){
    try {
      var root = document.querySelector(containerSelector) || document.querySelector('#live-video-container') || document.querySelector('#app-root') || document.body;
      if(!root) { console.warn('[OVERLAY] no container found for overlay'); return null; }
      var cs = getComputedStyle(root);
      if(cs.position === 'static' || !cs.position){
        root.style.position = root.style.position || 'relative';
      }
      var existing = root.querySelector('.dark-overlay');
      if(existing){
        console.info('[OVERLAY] exists', existing);
        return existing;
      }
      var el = document.createElement('div');
      el.className = 'dark-overlay';
      root.appendChild(el);
      console.info('[OVERLAY] created by ensureDarkOverlay', {container: containerSelector || '#live-video-container', el: el});
      return el;
    } catch (e){
      console.error('[OVERLAY] ensure error', e);
      return null;
    }
  }

  function showOverlay(opts){
    opts = opts || {};
    var sel = opts.containerSelector || '#live-video-container';
    var el = ensureDarkOverlay(sel);
    if(!el) return;
    el.classList.remove('is-hidden');
    console.info('[OVERLAY] shown', el);
  }
  function hideOverlay(opts){
    opts = opts || {};
    var sel = opts.containerSelector || '#live-video-container';
    var root = document.querySelector(sel) || document.querySelector('#app-root') || document.body;
    if(!root) return;
    var el = root.querySelector('.dark-overlay');
    if(el) {
      el.classList.add('is-hidden');
      console.info('[OVERLAY] hidden', el);
    }
  }

  global.beLiveOverlay = {
    ensure: ensureDarkOverlay,
    show: showOverlay,
    hide: hideOverlay
  };
})(window);
