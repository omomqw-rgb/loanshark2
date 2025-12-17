(function (window) {
  'use strict';
  if (!window.App) window.App = {};
  var App = window.App;

  // Stage 1: stub only. Real derived-data rebuild will be introduced in later stages.
  if (typeof App.rebuildDerived !== 'function') {
    App.rebuildDerived = function (reason) {
      // Intentionally no-op in stage 1.
      // No DOM access. No render calls.
      return;
    };
  }
})(window);
