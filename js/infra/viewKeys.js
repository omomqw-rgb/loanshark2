(function (window) {
  'use strict';
  if (!window.App) window.App = {};
  var App = window.App;

  // Core view keys used by the RenderCoordinator.
  // v3.2.18:
  // - Add UI_SHELL so top-tab/button/panel activation is rendered through
  //   the same coordinator/finalize pipeline as the feature views.
  if (!App.ViewKey) {
    App.ViewKey = Object.freeze({
      DERIVED: 'derived',
      UI_SHELL: 'uiShell',
      DEBTOR_LIST: 'debtorList',
      DEBTOR_DETAIL: 'debtorDetail',
      CALENDAR: 'calendar',
      MONITORING: 'monitoring',
      REPORT: 'report'
    });
  }

  if (!App.ViewKeyOrder) {
    App.ViewKeyOrder = Object.freeze([
      App.ViewKey.DERIVED,
      App.ViewKey.UI_SHELL,
      App.ViewKey.DEBTOR_LIST,
      App.ViewKey.DEBTOR_DETAIL,
      App.ViewKey.CALENDAR,
      App.ViewKey.MONITORING,
      App.ViewKey.REPORT
    ]);
  }

  // Optional helpers for convenience in later stages.
  if (!App.ViewKeySet) {
    App.ViewKeySet = Object.freeze({
      ALL: Object.freeze([
        App.ViewKey.UI_SHELL,
        App.ViewKey.DEBTOR_LIST,
        App.ViewKey.DEBTOR_DETAIL,
        App.ViewKey.CALENDAR,
        App.ViewKey.MONITORING,
        App.ViewKey.REPORT
      ]),
      ALL_WITH_DERIVED: Object.freeze([
        App.ViewKey.DERIVED,
        App.ViewKey.UI_SHELL,
        App.ViewKey.DEBTOR_LIST,
        App.ViewKey.DEBTOR_DETAIL,
        App.ViewKey.CALENDAR,
        App.ViewKey.MONITORING,
        App.ViewKey.REPORT
      ])
    });
  }
})(window);
