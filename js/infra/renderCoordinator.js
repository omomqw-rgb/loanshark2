(function (window) {
  'use strict';
  if (!window.App) window.App = {};
  var App = window.App;

  if (App.renderCoordinator) return;

  var renderMap = Object.create(null);
  var dirtySet = Object.create(null);
  var flushScheduled = false;
  var isFlushing = false;
  var pendingFlush = false;
  // Registration-only mode by default (passive). Execution can be enabled by the commit pipeline.
  var state = { enabled: false };

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

  function isArray(x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  }

  function isKnownKey(key) {
    if (!App.ViewKey) return true;
    for (var prop in App.ViewKey) {
      if (Object.prototype.hasOwnProperty.call(App.ViewKey, prop)) {
        if (App.ViewKey[prop] === key) return true;
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

  function register(key, renderFn) {
    if (!key) return;
    if (typeof renderFn !== 'function') return;

    var prev = renderMap[key];
    if (prev === renderFn) return;
    if (typeof prev === 'function') {
      try {
        console.warn('[RenderCoordinator] Duplicate register for key:', key);
      } catch (e) {}
    }

    renderMap[key] = renderFn;
  }

  function isDerivedKey(key) {
    try {
      if (App.ViewKey && typeof App.ViewKey.DERIVED === 'string' && key === App.ViewKey.DERIVED) return true;
    } catch (e) {}
    return (String(key || '').toLowerCase() === 'derived');
  }

  function invalidate(keys) {
    if (!keys) return;
    var list = isArray(keys) ? keys : [keys];
    var markedAny = false;
    var devMode = isDevEnv();
    var tracedKeys = null;

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
          if (devMode) {
            console.error('[RenderCoordinator] Invalidate called for unregistered key:', key);
          } else {
            console.warn('[RenderCoordinator] Invalidate called for unregistered key (noop):', key);
          }
        } catch (e) {}
        continue;
      }

      dirtySet[key] = true;
      markedAny = true;
      if (traceInvalidateEnabled()) {
        if (!tracedKeys) tracedKeys = [];
        tracedKeys.push(key);
      }
    }

    if (!markedAny) return;

    if (tracedKeys && tracedKeys.length) {
      try {
        console.log('[invalidate]', tracedKeys.join(', '));
      } catch (e) {}
    }

    flushSoon();
  }

  function flushSoon() {
    if (isFlushing) {
      pendingFlush = true;
      return;
    }
    if (flushScheduled) return;
    flushScheduled = true;
    scheduleMicrotask(flush);
  }

  function flush() {
    if (isFlushing) {
      pendingFlush = true;
      return;
    }

    flushScheduled = false;
    var keys = Object.keys(dirtySet);
    if (!keys.length) return;
    dirtySet = Object.create(null);

    if (!state.enabled) {
      return;
    }

    isFlushing = true;
    try {
      // v3.2.18: flush is render-only.
      // Derived rebuild / selection normalization / commit orchestration now happen
      // explicitly in App.api.finalizeMutation().
      var order = App.ViewKeyOrder && isArray(App.ViewKeyOrder) ? App.ViewKeyOrder : keys;
      for (var j = 0; j < order.length; j++) {
        var k = order[j];
        if (!k) continue;

        var wasDirty = false;
        for (var t = 0; t < keys.length; t++) {
          if (keys[t] === k) { wasDirty = true; break; }
        }
        if (!wasDirty) continue;

        var fn = renderMap[k];
        if (typeof fn !== 'function') continue;
        try {
          fn();
        } catch (e) {
          try { console.warn('[RenderCoordinator] renderer failed for key:', k, e); } catch (e2) {}
        }
      }
    } finally {
      isFlushing = false;
      if (pendingFlush || Object.keys(dirtySet).length) {
        pendingFlush = false;
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

    enable: function () { state.enabled = true; },
    disable: function () { state.enabled = false; }
  };
})(window);
