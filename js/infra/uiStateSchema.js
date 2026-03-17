(function (window) {
  'use strict';

  if (!window.App) window.App = {};
  var App = window.App;

  function isObject(v) {
    return v && typeof v === 'object';
  }

  function cloneCalendarState(calendar) {
    calendar = isObject(calendar) ? calendar : {};
    return {
      view: (typeof calendar.view === 'string') ? calendar.view : null,
      sortMode: (typeof calendar.sortMode === 'string') ? calendar.sortMode : null,
      currentDate: (typeof calendar.currentDate === 'string') ? calendar.currentDate : null
    };
  }

  function normalizePositiveInt(value, fallbackValue) {
    var n = Number(value);
    if (!isFinite(n)) return fallbackValue;
    n = Math.floor(n);
    if (n < 1) return fallbackValue;
    return n;
  }

  function normalizeNullableDateString(value) {
    return (typeof value === 'string' && value) ? value : null;
  }

  // Managed UI SSOT surface. stateIO may orchestrate apply flow, but only this module owns
  // the managed UI subtree shape/default/sanitize/clone/apply rules.
  var MANAGED_UI_KEYS = ['debtorPanel', 'monitoring', 'report'];

  function getManagedUiKeys() {
    return MANAGED_UI_KEYS.slice();
  }

  function cloneDefaultDebtorPanelState() {
    if (App && typeof App.getDefaultDebtorPanelState === 'function') {
      return App.getDefaultDebtorPanelState();
    }
    return {
      mode: 'list',
      selectedDebtorId: null,
      searchQuery: '',
      page: 1,
      viewMode: 'all',
      activeOnly: true,
      perPage: 15
    };
  }

  function cloneDefaultMonitoringState() {
    if (App && typeof App.getDefaultMonitoringState === 'function') {
      return App.getDefaultMonitoringState();
    }
    return {
      sectionSort: {
        dday: 'name',
        d1: 'name',
        overdue: 'name',
        risk: 'name'
      }
    };
  }

  function cloneDefaultReportState() {
    if (App && typeof App.getDefaultReportState === 'function') {
      return App.getDefaultReportState();
    }
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
  }

  function cloneDefaultUiState() {
    if (App && typeof App.getDefaultUiState === 'function') {
      return App.getDefaultUiState();
    }
    return {
      activeTab: 'calendar',
      calendar: {
        view: (App.getDefaultCalendarView ? App.getDefaultCalendarView() : 'week'),
        sortMode: 'type',
        currentDate: (App.util && typeof App.util.todayISODate === 'function') ? App.util.todayISODate() : new Date().toISOString().slice(0, 10)
      },
      debtorPanel: cloneDefaultDebtorPanelState(),
      monitoring: cloneDefaultMonitoringState(),
      report: cloneDefaultReportState()
    };
  }

  function applyManagedUIInPlace(dst, src) {
    if (!isObject(dst) || !isObject(src)) return;

    if (isObject(src.debtorPanel)) {
      dst.debtorPanel = dst.debtorPanel || {};
      if (typeof src.debtorPanel.mode === 'string') dst.debtorPanel.mode = src.debtorPanel.mode;
      if (typeof src.debtorPanel.page === 'number') dst.debtorPanel.page = src.debtorPanel.page;
      if (typeof src.debtorPanel.searchQuery === 'string') dst.debtorPanel.searchQuery = src.debtorPanel.searchQuery;
      if (typeof src.debtorPanel.selectedDebtorId !== 'undefined') dst.debtorPanel.selectedDebtorId = src.debtorPanel.selectedDebtorId;
      if (typeof src.debtorPanel.viewMode === 'string') dst.debtorPanel.viewMode = src.debtorPanel.viewMode;
      if (typeof src.debtorPanel.activeOnly === 'boolean') dst.debtorPanel.activeOnly = src.debtorPanel.activeOnly;
      if (typeof src.debtorPanel.perPage === 'number') dst.debtorPanel.perPage = src.debtorPanel.perPage;
    }

    if (isObject(src.monitoring)) {
      dst.monitoring = dst.monitoring || {};
      if (isObject(src.monitoring.sectionSort)) {
        dst.monitoring.sectionSort = dst.monitoring.sectionSort || {};
        if (typeof src.monitoring.sectionSort.dday === 'string') dst.monitoring.sectionSort.dday = src.monitoring.sectionSort.dday;
        if (typeof src.monitoring.sectionSort.d1 === 'string') dst.monitoring.sectionSort.d1 = src.monitoring.sectionSort.d1;
        if (typeof src.monitoring.sectionSort.overdue === 'string') dst.monitoring.sectionSort.overdue = src.monitoring.sectionSort.overdue;
        if (typeof src.monitoring.sectionSort.risk === 'string') dst.monitoring.sectionSort.risk = src.monitoring.sectionSort.risk;
      }
    }

    if (isObject(src.report)) {
      dst.report = dst.report || {};
      if (typeof src.report.activeSection === 'string') dst.report.activeSection = src.report.activeSection;
      if (typeof src.report.portfolioMode === 'string') dst.report.portfolioMode = src.report.portfolioMode;
      if (isObject(src.report.trend)) {
        dst.report.trend = dst.report.trend || {};
        if (typeof src.report.trend.period === 'string') dst.report.trend.period = src.report.trend.period;
        if (Object.prototype.hasOwnProperty.call(src.report.trend, 'dateFrom')) dst.report.trend.dateFrom = src.report.trend.dateFrom;
        if (Object.prototype.hasOwnProperty.call(src.report.trend, 'dateTo')) dst.report.trend.dateTo = src.report.trend.dateTo;
      }
      if (isObject(src.report.risk)) {
        dst.report.risk = dst.report.risk || {};
        if (Object.prototype.hasOwnProperty.call(src.report.risk, 'dateFrom')) dst.report.risk.dateFrom = src.report.risk.dateFrom;
        if (Object.prototype.hasOwnProperty.call(src.report.risk, 'dateTo')) dst.report.risk.dateTo = src.report.risk.dateTo;
      }
      if (isObject(src.report.legendVisibility)) {
        dst.report.legendVisibility = dst.report.legendVisibility || {};
        if (isObject(src.report.legendVisibility.capitalflow)) {
          dst.report.legendVisibility.capitalflow = dst.report.legendVisibility.capitalflow || {};
          if (typeof src.report.legendVisibility.capitalflow.velocity === 'boolean') dst.report.legendVisibility.capitalflow.velocity = src.report.legendVisibility.capitalflow.velocity;
          if (typeof src.report.legendVisibility.capitalflow.inflow === 'boolean') dst.report.legendVisibility.capitalflow.inflow = src.report.legendVisibility.capitalflow.inflow;
          if (typeof src.report.legendVisibility.capitalflow.outflow === 'boolean') dst.report.legendVisibility.capitalflow.outflow = src.report.legendVisibility.capitalflow.outflow;
          if (typeof src.report.legendVisibility.capitalflow.net === 'boolean') dst.report.legendVisibility.capitalflow.net = src.report.legendVisibility.capitalflow.net;
        }
      }
    }
  }

  function applyUIInPlace(dst, src) {
    if (!isObject(dst) || !isObject(src)) return;

    if (isObject(src.calendar)) {
      dst.calendar = dst.calendar || {};
      if (typeof src.calendar.view === 'string') dst.calendar.view = src.calendar.view;
      if (typeof src.calendar.sortMode === 'string') dst.calendar.sortMode = src.calendar.sortMode;
      if (typeof src.calendar.currentDate === 'string') dst.calendar.currentDate = src.calendar.currentDate;
    }

    if (typeof src.activeTab === 'string') {
      dst.activeTab = src.activeTab;
    }

    applyManagedUIInPlace(dst, src);
  }

  function sanitizeDebtorPanelStateInPlace(panel) {
    var defaults = cloneDefaultDebtorPanelState();
    panel = isObject(panel) ? panel : {};

    panel.mode = (panel.mode === 'detail') ? 'detail' : 'list';
    panel.selectedDebtorId = (panel.selectedDebtorId == null || panel.selectedDebtorId === '') ? null : String(panel.selectedDebtorId);
    panel.searchQuery = (typeof panel.searchQuery === 'string') ? panel.searchQuery : defaults.searchQuery;
    panel.page = normalizePositiveInt(panel.page, defaults.page);
    panel.viewMode = (panel.viewMode === 'loan' || panel.viewMode === 'claim' || panel.viewMode === 'risk' || panel.viewMode === 'all') ? panel.viewMode : defaults.viewMode;
    panel.activeOnly = (typeof panel.activeOnly === 'boolean') ? panel.activeOnly : defaults.activeOnly;
    panel.perPage = normalizePositiveInt(panel.perPage, defaults.perPage);

    return panel;
  }

  function sanitizeMonitoringStateInPlace(monitoring) {
    var defaults = cloneDefaultMonitoringState();
    monitoring = isObject(monitoring) ? monitoring : {};
    monitoring.sectionSort = isObject(monitoring.sectionSort) ? monitoring.sectionSort : {};

    monitoring.sectionSort.dday = (monitoring.sectionSort.dday === 'amount') ? 'amount' : defaults.sectionSort.dday;
    monitoring.sectionSort.d1 = (monitoring.sectionSort.d1 === 'amount') ? 'amount' : defaults.sectionSort.d1;
    monitoring.sectionSort.overdue = (monitoring.sectionSort.overdue === 'amount') ? 'amount' : defaults.sectionSort.overdue;
    monitoring.sectionSort.risk = (monitoring.sectionSort.risk === 'amount') ? 'amount' : defaults.sectionSort.risk;

    return monitoring;
  }

  function sanitizeReportStateInPlace(report) {
    var defaults = cloneDefaultReportState();
    report = isObject(report) ? report : {};

    report.activeSection = (report.activeSection === 'statistics' || report.activeSection === 'capitalflow' || report.activeSection === 'risk' || report.activeSection === 'overview') ? report.activeSection : defaults.activeSection;
    report.portfolioMode = (report.portfolioMode === 'claim' || report.portfolioMode === 'loan') ? report.portfolioMode : defaults.portfolioMode;

    report.trend = isObject(report.trend) ? report.trend : {};
    report.trend.period = (typeof report.trend.period === 'string' && report.trend.period) ? report.trend.period : defaults.trend.period;
    report.trend.dateFrom = normalizeNullableDateString(report.trend.dateFrom);
    report.trend.dateTo = normalizeNullableDateString(report.trend.dateTo);

    report.risk = isObject(report.risk) ? report.risk : {};
    report.risk.dateFrom = normalizeNullableDateString(report.risk.dateFrom);
    report.risk.dateTo = normalizeNullableDateString(report.risk.dateTo);

    var defaultLegend = (isObject(defaults.legendVisibility) && isObject(defaults.legendVisibility.capitalflow)) ? defaults.legendVisibility.capitalflow : { velocity: true, inflow: true, outflow: true, net: true };
    report.legendVisibility = isObject(report.legendVisibility) ? report.legendVisibility : {};
    report.legendVisibility.capitalflow = isObject(report.legendVisibility.capitalflow) ? report.legendVisibility.capitalflow : {};
    report.legendVisibility.capitalflow.velocity = (typeof report.legendVisibility.capitalflow.velocity === 'boolean') ? report.legendVisibility.capitalflow.velocity : defaultLegend.velocity;
    report.legendVisibility.capitalflow.inflow = (typeof report.legendVisibility.capitalflow.inflow === 'boolean') ? report.legendVisibility.capitalflow.inflow : defaultLegend.inflow;
    report.legendVisibility.capitalflow.outflow = (typeof report.legendVisibility.capitalflow.outflow === 'boolean') ? report.legendVisibility.capitalflow.outflow : defaultLegend.outflow;
    report.legendVisibility.capitalflow.net = (typeof report.legendVisibility.capitalflow.net === 'boolean') ? report.legendVisibility.capitalflow.net : defaultLegend.net;

    return report;
  }

  function cloneDebtorPanelState(panel) {
    var out = cloneDefaultDebtorPanelState();
    if (isObject(panel)) {
      applyManagedUIInPlace({ debtorPanel: out }, { debtorPanel: panel });
    }
    return out;
  }

  function cloneMonitoringState(monitoring) {
    var out = cloneDefaultMonitoringState();
    if (isObject(monitoring)) {
      applyManagedUIInPlace({ monitoring: out }, { monitoring: monitoring });
    }
    return out;
  }

  function cloneReportState(report) {
    var out = cloneDefaultReportState();
    if (isObject(report)) {
      applyManagedUIInPlace({ report: out }, { report: report });
    }
    return out;
  }

  function cloneUiState(ui) {
    ui = isObject(ui) ? ui : {};
    var out = {};
    for (var k in ui) {
      if (!Object.prototype.hasOwnProperty.call(ui, k)) continue;
      out[k] = ui[k];
    }
    if (typeof ui.activeTab === 'string') out.activeTab = ui.activeTab;
    out.calendar = cloneCalendarState(ui.calendar);
    out.debtorPanel = cloneDebtorPanelState(ui.debtorPanel);
    out.monitoring = cloneMonitoringState(ui.monitoring);
    out.report = cloneReportState(ui.report);
    return out;
  }

  function seedManagedUIDefaults(ui) {
    ui = isObject(ui) ? ui : {};
    ui.debtorPanel = cloneDefaultDebtorPanelState();
    ui.monitoring = cloneDefaultMonitoringState();
    ui.report = cloneDefaultReportState();
    return ui;
  }

  function buildNextUiState(currentUi, snapshotUi, uiPolicy) {
    var nextUi = cloneDefaultUiState();
    var source = 'current';

    if (uiPolicy === 'reset') {
      return { ui: nextUi, source: 'default' };
    }

    if (isObject(currentUi)) {
      applyUIInPlace(nextUi, currentUi);
    }

    if (uiPolicy === 'snapshot') {
      seedManagedUIDefaults(nextUi);
      if (isObject(snapshotUi)) {
        applyManagedUIInPlace(nextUi, snapshotUi);
        source = 'snapshot';
      } else {
        source = 'default';
      }
    }

    return { ui: nextUi, source: source };
  }

  // Public surface consumed by stateIO. Keep this explicit so the ownership boundary is visible
  // in one place and does not drift back into duplicate helpers elsewhere.
  var publicApi = {
    getManagedUiKeys: getManagedUiKeys,
    cloneDefaultUiState: cloneDefaultUiState,
    cloneDefaultDebtorPanelState: cloneDefaultDebtorPanelState,
    cloneDefaultMonitoringState: cloneDefaultMonitoringState,
    cloneDefaultReportState: cloneDefaultReportState,
    applyUIInPlace: applyUIInPlace,
    applyManagedUIInPlace: applyManagedUIInPlace,
    sanitizeDebtorPanelStateInPlace: sanitizeDebtorPanelStateInPlace,
    sanitizeMonitoringStateInPlace: sanitizeMonitoringStateInPlace,
    sanitizeReportStateInPlace: sanitizeReportStateInPlace,
    cloneUiState: cloneUiState,
    seedManagedUIDefaults: seedManagedUIDefaults,
    buildNextUiState: buildNextUiState
  };

  App.uiStateSchema = App.uiStateSchema || {};
  Object.keys(publicApi).forEach(function (key) {
    App.uiStateSchema[key] = publicApi[key];
  });
})(window);
