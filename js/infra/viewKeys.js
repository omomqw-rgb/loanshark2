(function (window) {
  'use strict';
  if (!window.App) window.App = {};
  var App = window.App;

  // Core view keys used by the RenderCoordinator.  In Stage 1 these are scaffolding only.
  if (!App.ViewKey) {
    App.ViewKey = Object.freeze({
      DERIVED: 'derived',
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
        App.ViewKey.DEBTOR_LIST,
        App.ViewKey.DEBTOR_DETAIL,
        App.ViewKey.CALENDAR,
        App.ViewKey.MONITORING,
        App.ViewKey.REPORT
      ]),
      ALL_WITH_DERIVED: Object.freeze([
        App.ViewKey.DERIVED,
        App.ViewKey.DEBTOR_LIST,
        App.ViewKey.DEBTOR_DETAIL,
        App.ViewKey.CALENDAR,
        App.ViewKey.MONITORING,
        App.ViewKey.REPORT
      ])
    });
  }
})(window);
