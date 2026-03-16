(function (window) {
  'use strict';
  if (!window.App) window.App = {};
  var App = window.App;

  App.derived = App.derived || {};
  if (!Array.isArray(App.derived.debtors)) {
    App.derived.debtors = [];
  }
  if (!App.derived.debtorsById || typeof App.derived.debtorsById !== 'object') {
    App.derived.debtorsById = {};
  }

  if (typeof App.rebuildDerived !== 'function') {
    App.rebuildDerived = function () {
      // Namespace bootstrap only.
      // Real rebuild implementation is provided by js/infra/api.js.
      return;
    };
  }
})(window);
