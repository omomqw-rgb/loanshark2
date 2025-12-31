(function (window) {
  'use strict';
  if (!window.App) window.App = {};
  var App = window.App;

  // Single source of truth: Calendar default view.
  // - Used by init/mount, load (legacy), and invalidate/rerender paths.
  // - Keep the default in ONE place to prevent regressions.
  App.getDefaultCalendarView = function () {
    return 'week';
  };

  function pad2(v) {
    v = Number(v) || 0;
    return v < 10 ? '0' + v : String(v);
  }

  function getTodayISODateLocal() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

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
      calendar: {
        view: App.getDefaultCalendarView(),
        sortMode: 'type',
        currentDate: getTodayISODateLocal()
      },
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

  // ===== Mobile Mode Phase 1 (runtime flags only; does NOT touch App.state) =====
  // NOTE: This is a runtime-only namespace used for viewport-based mode switching.
  // It intentionally does not modify Domain/Store/Snapshot formats.
  App.runtime = App.runtime || {};
  App.runtime.mobilePhase1 = {
    enterMaxWidth: 768,
    exitMinWidth: 1024,
    resizeDebounceMs: 250,
    switchCooldownMs: 800
  };

  // Initial mode: Mobile when width <= 768, otherwise Desktop.
  // (Hysteresis for subsequent switches is handled by the Mode Switcher.)
  App.runtime.mode = (function () {
    try {
      var w = window && typeof window.innerWidth === 'number' ? window.innerWidth : 9999;
      return w <= App.runtime.mobilePhase1.enterMaxWidth ? 'mobile' : 'desktop';
    } catch (e) {
      return 'desktop';
    }
  })();
})(window);
