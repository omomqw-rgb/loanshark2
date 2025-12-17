(function (window) {
  'use strict';
  if (!window.App) window.App = {};
  var App = window.App;

  App.state = {
    debtors: [],
    loans: [],
    claims: [],
    schedules: [],
    cashLogs: [],
    /*
     * UI related state.  In addition to the existing debtorPanel configuration we
     * also track whether the loan and claim card sections on the debtor detail
     * view are collapsed.  These flags are toggled via the section header
     * buttons and persist while the app is running.  See features/debtors.js
     * for the event handlers and render logic.
     */
    ui: {
      activeTab: 'calendar',
      debtorPanel: {
        mode: 'list',           // 'list' | 'detail'
        selectedDebtorId: null,
        searchQuery: '',
        page: 1
      }
    },

    /**
     * Flags for collapsed states of the loan and claim sections.  When true
     * the corresponding section is collapsed and its card list is hidden.
     */
    loansCollapsed: false,
    claimsCollapsed: false
  };
App.config = {
    locale: 'ko-KR',
    currency: 'KRW'
  };
})(window);
