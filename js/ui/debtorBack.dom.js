(function (window, document) {
  'use strict';

  window.App = window.App || {};
  var App = window.App;
  App.ui = App.ui || {};

  var bound = false;

  function onClick(e) {
    // v205: debtor-back-to-list + v126 debtor-list-mode 둘 다 지원
    var b = e && e.target && e.target.closest
      ? e.target.closest("[data-action='debtor-back-to-list'], [data-action='debtor-list-mode']")
      : null;
    if (!b) return;

    // Stage 3: Navigation boundary via App.api.view
    if (App.api && App.api.view && typeof App.api.view.openDebtorList === 'function') {
      App.api.view.openDebtorList();
    }
  }

  function init() {
    if (bound) return;
    document.addEventListener('click', onClick);
    bound = true;
  }

  function destroy() {
    if (!bound) return;
    document.removeEventListener('click', onClick);
    bound = false;
  }

  App.ui.debtorBack = {
    init: init,
    destroy: destroy
  };

  // Backward-compatible behavior: bind in Desktop mode by default.
  // (Mode Switcher can later destroy/re-init this binding on transitions.)
  try {
    if (App.runtime && App.runtime.mode !== 'mobile') {
      init();
    }
  } catch (e) {}

})(window, document);
