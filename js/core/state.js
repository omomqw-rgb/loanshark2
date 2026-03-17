(function (window) {
  'use strict';
  if (!window.App) window.App = {};
  var App = window.App;

  App.meta = App.meta || {};
  App.meta.version = 'v3.2.32_cloud_snapshot_history_status_bar';

  // Single source of truth: Calendar default view.
  // - Used by init/mount, load (legacy), and invalidate/rerender paths.
  // - Keep the default in ONE place to prevent regressions.
  App.getDefaultCalendarView = function () {
    return 'week';
  };

  // Single source of truth: Debtor panel UI state.
  // - Used by init/mount, load/reset normalization, and list/detail render paths.
  // - Always return a fresh object so callers can safely mutate their local copy.
  App.getDefaultDebtorPanelState = function () {
    return {
      mode: 'list',           // 'list' | 'detail'
      selectedDebtorId: null,
      searchQuery: '',
      page: 1,
      viewMode: 'all',        // 'all' | 'loan' | 'claim' | 'risk'
      activeOnly: true,
      perPage: 15
    };
  };

  App.getDefaultMonitoringState = function () {
    return {
      sectionSort: {
        dday: 'name',
        d1: 'name',
        overdue: 'name',
        risk: 'name'
      }
    };
  };

  App.getDefaultReportState = function () {
    return {
      activeSection: 'overview',
      portfolioMode: 'loan',
      trend: {
        period: 'monthly',
        dateFrom: null,
        dateTo: null
      },
      risk: {
        dateFrom: null,
        dateTo: null
      },
      legendVisibility: {
        capitalflow: {
          velocity: true,
          inflow: true,
          outflow: true,
          net: true
        }
      }
    };
  };

  App.getDefaultUiState = function () {
    return {
      activeTab: 'calendar',
      calendar: {
        view: App.getDefaultCalendarView(),
        sortMode: 'type',
        currentDate: getTodayISODateLocal()
      },
      debtorPanel: App.getDefaultDebtorPanelState(),
      monitoring: App.getDefaultMonitoringState(),
      report: App.getDefaultReportState()
    };
  };

  App.getDefaultDataState = function () {
    return {
      debtors: [],
      loans: [],
      claims: [],
      schedules: [],
      cashLogs: [],
      loansCollapsed: false,
      claimsCollapsed: false,
      meta: {
        nextDebtorId: 1,
        nextLoanId: 1,
        nextClaimId: 1
      }
    };
  };

  function pad2(v) {
    v = Number(v) || 0;
    return v < 10 ? '0' + v : String(v);
  }

  function getTodayISODateLocal() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  var defaultDataState = App.getDefaultDataState();
  App.state = {
    debtors: defaultDataState.debtors,
    loans: defaultDataState.loans,
    claims: defaultDataState.claims,
    // Legacy surface only. Schedule SSOT is App.schedulesEngine;
    // App.state.schedules is kept only for compatibility with older snapshot shapes.
    schedules: defaultDataState.schedules,
    cashLogs: defaultDataState.cashLogs,
    /*
     * UI related state.  In addition to the existing debtorPanel configuration we
     * also track whether the loan and claim card sections on the debtor detail
     * view are collapsed.  These flags are toggled via the section header
     * buttons and persist while the app is running.  See features/debtors.js
     * for the event handlers and render logic.
     */
    ui: App.getDefaultUiState(),

    /**
     * Flags for collapsed states of the loan and claim sections.  When true
     * the corresponding section is collapsed and its card list is hidden.
     */
    loansCollapsed: !!defaultDataState.loansCollapsed,
    claimsCollapsed: !!defaultDataState.claimsCollapsed,
    meta: defaultDataState.meta
  };
  App.config = {
    locale: 'ko-KR',
    currency: 'KRW'
  };
})(window);
