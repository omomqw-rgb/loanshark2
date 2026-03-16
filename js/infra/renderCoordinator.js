(function (window) {
  'use strict';
  if (!window.App) window.App = {};
  var App = window.App;

  // Stage 1: scaffolding only. This coordinator is not wired into existing render flows yet.
  if (App.renderCoordinator) return;

  var renderMap = Object.create(null);
  var dirtySet = Object.create(null);
  var flushScheduled = false;
  // Stage 2: registration-only mode by default (passive). Execution can be enabled in later stages.
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
    if (!App.ViewKey) return true; // cannot validate yet
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
    // Derived is a special invalidation key that runs rebuildDerived().
    try {
      if (App.ViewKey && typeof App.ViewKey.DERIVED === 'string' && key === App.ViewKey.DERIVED) return true;
    } catch (e) {}
    // Fallback for early bootstrap
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
        // Unknown key is not actionable.
        continue;
      }

      // If a renderer is not registered, treat it as a bug and noop.
      // (DERIVED is a special-case and does not require a renderer.)
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
    if (flushScheduled) return;
    flushScheduled = true;
    scheduleMicrotask(flush);
  }

  function flush() {
    // Snapshot dirty keys and clear immediately to avoid re-entrancy issues.
    flushScheduled = false;
    var keys = Object.keys(dirtySet);
    if (!keys.length) return;
    dirtySet = Object.create(null);

    // Stage 2: passive mode. We intentionally do not execute renderers yet.
    if (!state.enabled) {
      return;
    }

    // If DERIVED is requested, run rebuildDerived first (stub in stage 1).
    if (App.ViewKey && dirtySet && false) {
      // unreachable; kept intentionally blank for stage 1 compatibility
    }

    try {
      var shouldRebuild = false;
      if (App.ViewKey && typeof App.ViewKey.DERIVED === 'string') {
        // Rebuild when requested
        for (var i = 0; i < keys.length; i++) {
          if (keys[i] === App.ViewKey.DERIVED) { shouldRebuild = true; break; }
        }
      }
      if (shouldRebuild && typeof App.rebuildDerived === 'function') {
        App.rebuildDerived('coordinator.flush');
      }
    } catch (e) {
      try { console.warn('[RenderCoordinator] rebuildDerived failed:', e); } catch (e2) {}
    }

    // Execute registered renderers in a stable order when available.
    var order = App.ViewKeyOrder && isArray(App.ViewKeyOrder) ? App.ViewKeyOrder : keys;
    for (var j = 0; j < order.length; j++) {
      var k = order[j];
      if (!k) continue;
      // Only render keys that were invalidated in this flush.
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
  }

  App.renderCoordinator = {
    register: register,
    invalidate: invalidate,
    flushSoon: flushSoon,
    flushNow: flush,

    // Introspection helpers for verification/debugging.
    _registry: renderMap,
    _state: state,

    // Control helpers for later stages.
    enable: function () { state.enabled = true; },
    disable: function () { state.enabled = false; }
  };
})(window);
