(function (window) {
  'use strict';
  if (!window.App) window.App = {};
  var App = window.App;

  if (App.renderCoordinator) return;

  var renderMap = Object.create(null);
  var dirtySet = Object.create(null);
  var flushScheduled = false;
  var flushing = false;
  var state = { enabled: true };

  function isDevEnv() {
    try {
      var loc = window.location || {};
      var host = loc.hostname || '';
      var protocol = loc.protocol || '';
      if (protocol === 'file:') return true;
      if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function traceInvalidateEnabled() {
    try {
      return !!(App.debug && App.debug.traceInvalidate);
    } catch (e) {
      return false;
    }
  }

  function traceFlushEnabled() {
    try {
      return !!(App.debug && App.debug.traceFlush);
    } catch (e) {
      return false;
    }
  }

  function isArray(x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  }

  function isKnownKey(key) {
    if (!App.ViewKey) return true;
    for (var prop in App.ViewKey) {
      if (Object.prototype.hasOwnProperty.call(App.ViewKey, prop) && App.ViewKey[prop] === key) {
        return true;
      }
    }
    return false;
  }

  function scheduleMicrotask(fn) {
    if (typeof queueMicrotask === 'function') return queueMicrotask(fn);
    if (typeof Promise !== 'undefined' && Promise && typeof Promise.resolve === 'function') {
      return Promise.resolve().then(fn);
    }
    return setTimeout(fn, 0);
  }

  function logTrace(prefix, keys) {
    if (!keys || !keys.length) return;
    try {
      console.log(prefix + ': ' + keys.join(', '));
    } catch (e) {}
  }

  function register(key, renderFn) {
    if (!key) return;
    if (typeof renderFn !== 'function') return;

    var prev = renderMap[key];
    if (prev === renderFn) return;

    if (typeof prev === 'function') {
      try {
        if (isDevEnv()) {
          console.info('[RenderCoordinator] register override for key:', key);
        }
      } catch (e) {}
    }

    renderMap[key] = renderFn;
  }

  function isDerivedKey(key) {
    try {
      if (App.ViewKey && typeof App.ViewKey.DERIVED === 'string' && key === App.ViewKey.DERIVED) return true;
    } catch (e) {}
    return String(key || '').toLowerCase() === 'derived';
  }

  function invalidate(keys) {
    if (!keys) return;
    var list = isArray(keys) ? keys : [keys];
    var markedAny = false;
    var tracedKeys = [];
    var devMode = isDevEnv();

    for (var i = 0; i < list.length; i++) {
      var key = list[i];
      if (!key) continue;

      if (!isKnownKey(key)) {
        try {
          console.warn('[RenderCoordinator] Unknown view key invalidated:', key);
        } catch (e) {}
        continue;
      }

      if (!isDerivedKey(key) && typeof renderMap[key] !== 'function') {
        try {
          if (devMode) console.error('[RenderCoordinator] Invalidate called for unregistered key:', key);
          else console.warn('[RenderCoordinator] Invalidate called for unregistered key (noop):', key);
        } catch (e) {}
        continue;
      }

      if (!dirtySet[key]) {
        dirtySet[key] = true;
        markedAny = true;
        tracedKeys.push(key);
      }
    }

    if (!markedAny) return;

    if (traceInvalidateEnabled()) {
      logTrace('[invalidate]', tracedKeys);
    }

    flushSoon();
  }

  function flushSoon() {
    if (!state.enabled) return;
    if (flushScheduled) return;
    flushScheduled = true;
    scheduleMicrotask(flush);
  }

  function collectDirtyKeys() {
    var keys = Object.keys(dirtySet);
    dirtySet = Object.create(null);
    return keys;
  }

  function executeFlushCycle(keys) {
    if (!keys.length) return;

    var shouldRebuild = false;
    for (var i = 0; i < keys.length; i++) {
      if (isDerivedKey(keys[i])) {
        shouldRebuild = true;
        break;
      }
    }

    if (shouldRebuild && typeof App.rebuildDerived === 'function') {
      try {
        App.rebuildDerived('coordinator.flush');
      } catch (e) {
        try { console.warn('[RenderCoordinator] rebuildDerived failed:', e); } catch (e2) {}
      }
    }

    var order = App.ViewKeyOrder && isArray(App.ViewKeyOrder) ? App.ViewKeyOrder : keys;
    for (var j = 0; j < order.length; j++) {
      var key = order[j];
      if (!key || isDerivedKey(key)) continue;

      var wasDirty = false;
      for (var t = 0; t < keys.length; t++) {
        if (keys[t] === key) {
          wasDirty = true;
          break;
        }
      }
      if (!wasDirty) continue;

      var fn = renderMap[key];
      if (typeof fn !== 'function') continue;
      try {
        fn();
      } catch (e) {
        try { console.warn('[RenderCoordinator] renderer failed for key:', key, e); } catch (e2) {}
      }
    }
  }

  function flush() {
    flushScheduled = false;
    if (!state.enabled) return;
    if (flushing) {
      flushSoon();
      return;
    }

    flushing = true;
    try {
      while (state.enabled) {
        var keys = collectDirtyKeys();
        if (!keys.length) break;
        if (traceFlushEnabled()) {
          logTrace('[flush]', keys);
        }
        executeFlushCycle(keys);
      }
    } finally {
      flushing = false;
      if (state.enabled && Object.keys(dirtySet).length) {
        flushSoon();
      }
    }
  }

  App.renderCoordinator = {
    register: register,
    invalidate: invalidate,
    flushSoon: flushSoon,
    flushNow: flush,
    _registry: renderMap,
    _state: state,
    enable: function () { state.enabled = true; if (Object.keys(dirtySet).length) flushSoon(); },
    disable: function () { state.enabled = false; }
  };
})(window);
