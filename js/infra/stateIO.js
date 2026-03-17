(function (window) {
  'use strict';

  if (!window.App) window.App = {};
  var App = window.App;

  function isObject(v) {
    return v && typeof v === 'object';
  }

  function toStr(v) {
    if (v === null || typeof v === 'undefined') return v;
    return String(v);
  }

  function shallowClone(obj) {
    if (!isObject(obj)) return obj;
    var out = {};
    for (var k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        out[k] = obj[k];
      }
    }
    return out;
  }

  function cloneArray(arr) {
    var out = [];
    if (!Array.isArray(arr)) return out;
    for (var i = 0; i < arr.length; i++) {
      var item = arr[i];
      out.push(isObject(item) ? shallowClone(item) : item);
    }
    return out;
  }

  function ensureState() {
    if (!App.state) App.state = {};
    if (!App.state.ui) App.state.ui = {};
  }

  function ensureArray(prop) {
    ensureState();
    if (!Array.isArray(App.state[prop])) {
      App.state[prop] = [];
    }
    return App.state[prop];
  }

  var MANAGED_UI_KEYS = ['debtorPanel', 'monitoring', 'report'];

  function getManagedUiKeys() {
    return MANAGED_UI_KEYS.slice();
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

  function cloneDefaultDataState() {
    if (App && typeof App.getDefaultDataState === 'function') {
      return App.getDefaultDataState();
    }
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
  }

  function replaceArrayInPlace(target, src) {
    if (!Array.isArray(target)) return;
    if (target === src) return;
    target.length = 0;
    if (!Array.isArray(src)) return;
    for (var i = 0; i < src.length; i++) {
      target.push(src[i]);
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

  function cloneCalendarState(calendar) {
    calendar = isObject(calendar) ? calendar : {};
    return {
      view: (typeof calendar.view === 'string') ? calendar.view : null,
      sortMode: (typeof calendar.sortMode === 'string') ? calendar.sortMode : null,
      currentDate: (typeof calendar.currentDate === 'string') ? calendar.currentDate : null
    };
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

  function normalizePositiveInt(value, fallbackValue) {
    var n = Number(value);
    if (!isFinite(n)) return fallbackValue;
    n = Math.floor(n);
    if (n < 1) return fallbackValue;
    return n;
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

  function cloneDebtorPanelState(panel) {
    var out = cloneDefaultDebtorPanelState();
    if (isObject(panel)) {
      applyManagedUIInPlace({ debtorPanel: out }, { debtorPanel: panel });
    }
    return out;
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

  function cloneMonitoringState(monitoring) {
    var out = cloneDefaultMonitoringState();
    if (isObject(monitoring)) {
      applyManagedUIInPlace({ monitoring: out }, { monitoring: monitoring });
    }
    return out;
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

  function cloneMetaState(meta) {
    meta = isObject(meta) ? meta : {};
    return {
      nextDebtorId: normalizePositiveInt(meta.nextDebtorId, 1),
      nextLoanId: normalizePositiveInt(meta.nextLoanId, 1),
      nextClaimId: normalizePositiveInt(meta.nextClaimId, 1)
    };
  }

  function seedManagedUIDefaults(ui) {
    ui = isObject(ui) ? ui : {};
    ui.debtorPanel = cloneDefaultDebtorPanelState();
    ui.monitoring = cloneDefaultMonitoringState();
    ui.report = cloneDefaultReportState();
    return ui;
  }

  function resolveUiPolicy(opts) {
    opts = opts || {};
    if (opts.uiPolicy === 'preserve' || opts.uiPolicy === 'snapshot' || opts.uiPolicy === 'reset') {
      return opts.uiPolicy;
    }
    if (typeof opts.keepUI !== 'undefined') {
      return opts.keepUI ? 'preserve' : 'snapshot';
    }
    return 'preserve';
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

  function normalizeNullableDateString(value) {
    return (typeof value === 'string' && value) ? value : null;
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

  function getDataRoot(snapshot) {
    if (snapshot && isObject(snapshot.data)) return snapshot.data;
    return snapshot;
  }

  function normalizeDebtorIdsInPlace(debtors) {
    debtors = debtors || [];
    for (var i = 0; i < debtors.length; i++) {
      var d = debtors[i];
      if (!isObject(d)) continue;
      if (typeof d.id === 'undefined' && typeof d.debtor_id !== 'undefined') d.id = d.debtor_id;
      if (d.id != null) d.id = toStr(d.id);
      if (typeof d.debtor_id !== 'undefined') d.debtor_id = d.id;
    }
  }

  function normalizeLoanIdsInPlace(loans) {
    loans = loans || [];
    for (var i = 0; i < loans.length; i++) {
      var l = loans[i];
      if (!isObject(l)) continue;
      if (typeof l.debtorId === 'undefined' && typeof l.debtor_id !== 'undefined') l.debtorId = l.debtor_id;
      if (l.id != null) l.id = toStr(l.id);
      if (l.debtorId != null) l.debtorId = toStr(l.debtorId);
      if (typeof l.debtor_id !== 'undefined') l.debtor_id = l.debtorId;
    }
  }

  function normalizeClaimIdsInPlace(claims) {
    claims = claims || [];
    for (var i = 0; i < claims.length; i++) {
      var c = claims[i];
      if (!isObject(c)) continue;
      if (typeof c.debtorId === 'undefined' && typeof c.debtor_id !== 'undefined') c.debtorId = c.debtor_id;
      if (c.id != null) c.id = toStr(c.id);
      if (c.debtorId != null) c.debtorId = toStr(c.debtorId);
      if (typeof c.debtor_id !== 'undefined') c.debtor_id = c.debtorId;
    }
  }

  function normalizeCashLogIdsInPlace(cashLogs) {
    cashLogs = cashLogs || [];
    for (var i = 0; i < cashLogs.length; i++) {
      var row = cashLogs[i];
      if (!isObject(row)) continue;
      if (row.id != null) row.id = toStr(row.id);
      if (typeof row.refType === 'undefined' && typeof row.refKind !== 'undefined') row.refType = row.refKind;
      if (typeof row.refKind === 'undefined' && typeof row.refType !== 'undefined') row.refKind = row.refType;
      if (row.refType != null) row.refType = toStr(row.refType);
      if (row.refKind != null) row.refKind = toStr(row.refKind);
      if (row.refId != null) row.refId = toStr(row.refId);
    }
  }

  function normalizeScheduleIdsInPlace(schedules) {
    schedules = schedules || [];
    for (var i = 0; i < schedules.length; i++) {
      var s = schedules[i];
      if (!isObject(s)) continue;
      if (typeof s.loanId === 'undefined' && typeof s.loan_id !== 'undefined') s.loanId = s.loan_id;
      if (typeof s.claimId === 'undefined' && typeof s.claim_id !== 'undefined') s.claimId = s.claim_id;
      if (typeof s.debtorId === 'undefined' && typeof s.debtor_id !== 'undefined') s.debtorId = s.debtor_id;
      if (s.id != null) s.id = toStr(s.id);
      if (s.loanId != null) s.loanId = toStr(s.loanId);
      if (s.claimId != null) s.claimId = toStr(s.claimId);
      if (s.debtorId != null) s.debtorId = toStr(s.debtorId);
      if (typeof s.loan_id !== 'undefined') s.loan_id = s.loanId;
      if (typeof s.claim_id !== 'undefined') s.claim_id = s.claimId;
      if (typeof s.debtor_id !== 'undefined') s.debtor_id = s.debtorId;
    }
  }

  function normalizeSnapshotDataInPlace(dataRoot) {
    if (!dataRoot) return;
    normalizeDebtorIdsInPlace(dataRoot.debtors);
    normalizeLoanIdsInPlace(dataRoot.loans);
    normalizeClaimIdsInPlace(dataRoot.claims);
    normalizeCashLogIdsInPlace(dataRoot.cashLogs);
    normalizeScheduleIdsInPlace(dataRoot.schedules);
  }

  function toPositiveInt(v) {
    var n = Number(v);
    if (!isFinite(n)) return null;
    n = Math.floor(n);
    if (n < 1) return null;
    return n;
  }

  function parseIdNumber(id) {
    if (id == null) return 0;
    var m = String(id).match(/(\d+)/);
    if (!m) return 0;
    var n = parseInt(m[1], 10);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  function computeMaxId(list) {
    var max = 0;
    if (!Array.isArray(list)) return 0;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!isObject(it)) continue;
      var num = parseIdNumber(it.id);
      if (num > max) max = num;
    }
    return max;
  }

  function ensureMetaFromCurrentState() {
    ensureState();
    if (!isObject(App.state.meta)) App.state.meta = {};
    var meta = App.state.meta;

    var d = toPositiveInt(meta.nextDebtorId);
    var l = toPositiveInt(meta.nextLoanId);
    var c = toPositiveInt(meta.nextClaimId);

    var computedD = computeMaxId(App.state.debtors) + 1;
    var computedL = computeMaxId(App.state.loans) + 1;
    var computedC = computeMaxId(App.state.claims) + 1;

    meta.nextDebtorId = Math.max(d || 0, computedD || 1) || 1;
    meta.nextLoanId = Math.max(l || 0, computedL || 1) || 1;
    meta.nextClaimId = Math.max(c || 0, computedC || 1) || 1;

    return meta;
  }

  function applyMetaFromSnapshot(snapshot, dataRoot) {
    ensureMetaFromCurrentState();

    var metaSrc = null;
    if (snapshot && isObject(snapshot.meta)) metaSrc = snapshot.meta;
    else if (dataRoot && isObject(dataRoot.meta)) metaSrc = dataRoot.meta;

    if (metaSrc) {
      var meta = App.state.meta;
      var d = toPositiveInt(metaSrc.nextDebtorId);
      var l = toPositiveInt(metaSrc.nextLoanId);
      var c = toPositiveInt(metaSrc.nextClaimId);
      if (d != null) meta.nextDebtorId = d;
      if (l != null) meta.nextLoanId = l;
      if (c != null) meta.nextClaimId = c;
    }

    ensureMetaFromCurrentState();
  }

  function getCurrentAppVersion() {
    if (App.meta && typeof App.meta.version === 'string' && App.meta.version) return App.meta.version;
    if (typeof window.__APP_VERSION__ === 'string' && window.__APP_VERSION__) return window.__APP_VERSION__;
    return 'unknown-version';
  }

  function getSchedulesSnapshot() {
    var schedulesSnapshot = [];
    if (App.schedulesEngine && typeof App.schedulesEngine.toSnapshot === 'function') {
      try {
        schedulesSnapshot = App.schedulesEngine.toSnapshot() || [];
      } catch (e) {
        schedulesSnapshot = [];
      }
    } else if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      try {
        schedulesSnapshot = App.schedulesEngine.getAll() || [];
      } catch (e2) {
        schedulesSnapshot = [];
      }
    }
    return cloneArray(schedulesSnapshot);
  }

  function createSnapshotUiState(ui) {
    var base = cloneDefaultUiState();
    if (isObject(ui)) applyUIInPlace(base, ui);
    base.debtorPanel = sanitizeDebtorPanelStateInPlace(base.debtorPanel);
    base.monitoring = sanitizeMonitoringStateInPlace(base.monitoring);
    base.report = sanitizeReportStateInPlace(base.report);
    if (base.calendar.view !== 'month' && base.calendar.view !== 'week') base.calendar.view = (App.getDefaultCalendarView ? App.getDefaultCalendarView() : 'week');
    if (base.calendar.sortMode !== 'type' && base.calendar.sortMode !== 'status') base.calendar.sortMode = 'type';
    if (typeof base.calendar.currentDate !== 'string' || !base.calendar.currentDate) base.calendar.currentDate = (App.util && typeof App.util.todayISODate === 'function') ? App.util.todayISODate() : new Date().toISOString().slice(0, 10);
    if (typeof base.activeTab !== 'string' || !base.activeTab) base.activeTab = 'calendar';
    return base;
  }

  function createSnapshotDataState(dataRoot) {
    dataRoot = isObject(dataRoot) ? dataRoot : {};
    var debtors = Array.isArray(dataRoot.debtors) ? dataRoot.debtors : [];
    if (App.util && typeof App.util.sanitizeDebtorArray === 'function') {
      debtors = App.util.sanitizeDebtorArray(debtors);
    } else {
      debtors = cloneArray(debtors);
    }

    var snapshotData = {
      debtors: debtors,
      loans: cloneArray(Array.isArray(dataRoot.loans) ? dataRoot.loans : []),
      claims: cloneArray(Array.isArray(dataRoot.claims) ? dataRoot.claims : []),
      schedules: cloneArray(Array.isArray(dataRoot.schedules) ? dataRoot.schedules : []),
      cashLogs: cloneArray(Array.isArray(dataRoot.cashLogs) ? dataRoot.cashLogs : []),
      riskSettings: Object.prototype.hasOwnProperty.call(dataRoot, 'riskSettings') ? dataRoot.riskSettings : ((typeof App.riskSettings !== 'undefined') ? App.riskSettings : null)
    };

    if (typeof snapshotData.riskSettings === 'undefined') snapshotData.riskSettings = null;
    normalizeSnapshotDataInPlace(snapshotData);
    return snapshotData;
  }

  var LEGACY_REQUIRED_COLLECTION_KEYS = ['debtors', 'loans', 'claims', 'schedules', 'cashLogs'];
  var SNAPSHOT_REQUIRED_COLLECTION_KEYS = LEGACY_REQUIRED_COLLECTION_KEYS.slice();

  function hasRequiredCollectionShape(raw, requiredKeys) {
    if (!isObject(raw)) return false;
    for (var i = 0; i < requiredKeys.length; i++) {
      var key = requiredKeys[i];
      if (!Object.prototype.hasOwnProperty.call(raw, key) || !Array.isArray(raw[key])) {
        return false;
      }
    }
    return true;
  }

  function hasRequiredCollectionIndicators(raw, requiredKeys) {
    if (!isObject(raw)) return false;
    for (var i = 0; i < requiredKeys.length; i++) {
      if (Object.prototype.hasOwnProperty.call(raw, requiredKeys[i])) return true;
    }
    return false;
  }

  function getRequiredCollectionInvalidReason(raw, requiredKeys, missingReason, shapeReason) {
    if (!isObject(raw)) return shapeReason;

    for (var i = 0; i < requiredKeys.length; i++) {
      var key = requiredKeys[i];
      if (!Object.prototype.hasOwnProperty.call(raw, key)) {
        return missingReason;
      }
    }

    for (var j = 0; j < requiredKeys.length; j++) {
      var arrKey = requiredKeys[j];
      if (!Array.isArray(raw[arrKey])) {
        return shapeReason;
      }
    }

    return shapeReason;
  }

  function hasLegacyStateShape(raw) {
    return hasRequiredCollectionShape(raw, LEGACY_REQUIRED_COLLECTION_KEYS);
  }

  function hasLegacyStateIndicators(raw) {
    return hasRequiredCollectionIndicators(raw, LEGACY_REQUIRED_COLLECTION_KEYS);
  }

  function getLegacyStateInvalidReason(raw) {
    return getRequiredCollectionInvalidReason(raw, LEGACY_REQUIRED_COLLECTION_KEYS, 'legacy_required_collections_missing', 'legacy_shape_invalid');
  }

  function hasSnapshotDataShape(rawData) {
    return hasRequiredCollectionShape(rawData, SNAPSHOT_REQUIRED_COLLECTION_KEYS);
  }

  function hasSnapshotDataIndicators(rawData) {
    return hasRequiredCollectionIndicators(rawData, SNAPSHOT_REQUIRED_COLLECTION_KEYS);
  }

  function getSnapshotDataInvalidReason(rawData) {
    return getRequiredCollectionInvalidReason(rawData, SNAPSHOT_REQUIRED_COLLECTION_KEYS, 'snapshot_required_collections_missing', 'snapshot_shape_invalid');
  }

  function normalizeSnapshotInput(raw, opts) {
    opts = opts || {};
    var result = {
      ok: false,
      reason: '',
      inputFormat: '',
      originalInputFormat: '',
      snapshot: null
    };

    if (!raw || !isObject(raw)) {
      result.reason = 'snapshot_missing';
      return result;
    }

    var normalized = null;
    var version = raw.version;

    if (version === 1 || version === '1') {
      result.inputFormat = 'snapshot-v1';
      result.originalInputFormat = 'snapshot-v1';

      if (!isObject(raw.data)) {
        result.reason = 'data_missing';
        return result;
      }

      if (!hasSnapshotDataShape(raw.data)) {
        result.reason = hasSnapshotDataIndicators(raw.data) ? getSnapshotDataInvalidReason(raw.data) : 'snapshot_required_collections_missing';
        return result;
      }

      normalized = {
        version: 1,
        savedAt: (typeof raw.savedAt === 'string' && raw.savedAt) ? raw.savedAt : new Date().toISOString(),
        appVersion: (typeof raw.appVersion === 'string' && raw.appVersion) ? raw.appVersion : getCurrentAppVersion(),
        ui: isObject(raw.ui) ? createSnapshotUiState(raw.ui) : null,
        data: createSnapshotDataState(raw.data),
        meta: cloneMetaState(isObject(raw.meta) ? raw.meta : (isObject(raw.data.meta) ? raw.data.meta : null))
      };
    } else if (hasLegacyStateShape(raw)) {
      normalized = {
        version: 1,
        savedAt: (typeof raw.savedAt === 'string' && raw.savedAt) ? raw.savedAt : new Date().toISOString(),
        appVersion: (typeof raw.appVersion === 'string' && raw.appVersion) ? raw.appVersion : getCurrentAppVersion(),
        ui: isObject(raw.ui) ? createSnapshotUiState(raw.ui) : null,
        data: createSnapshotDataState({
          debtors: raw.debtors,
          loans: raw.loans,
          claims: raw.claims,
          schedules: raw.schedules,
          cashLogs: raw.cashLogs,
          riskSettings: Object.prototype.hasOwnProperty.call(raw, 'riskSettings') ? raw.riskSettings : null
        }),
        meta: cloneMetaState(isObject(raw.meta) ? raw.meta : null)
      };
      result.inputFormat = 'snapshot-v1';
      result.originalInputFormat = 'legacy-state';
    } else if (hasLegacyStateIndicators(raw)) {
      result.reason = getLegacyStateInvalidReason(raw);
      result.inputFormat = 'snapshot-v1';
      result.originalInputFormat = 'legacy-state';
      return result;
    } else if (typeof version !== 'undefined') {
      result.reason = 'unsupported_version';
      result.inputFormat = 'snapshot-v1';
      result.originalInputFormat = 'snapshot-v1';
      return result;
    } else {
      result.reason = 'data_missing';
      return result;
    }

    result.ok = true;
    result.snapshot = normalized;
    return result;
  }

  function isValidArrayField(dataRoot, key) {
    return Object.prototype.hasOwnProperty.call(dataRoot, key) && Array.isArray(dataRoot[key]);
  }

  function buildIdIndex(list) {
    var map = Object.create(null);
    list = Array.isArray(list) ? list : [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!isObject(item) || item.id == null) continue;
      map[String(item.id)] = item;
    }
    return map;
  }

  function validateScheduleReferences(dataRoot) {
    var result = { ok: true, reason: '', invalidCount: 0 };
    var debtorById = buildIdIndex(dataRoot.debtors);
    var loanById = buildIdIndex(dataRoot.loans);
    var claimById = buildIdIndex(dataRoot.claims);
    var schedules = Array.isArray(dataRoot.schedules) ? dataRoot.schedules : [];

    for (var i = 0; i < schedules.length; i++) {
      var sc = schedules[i];
      if (!isObject(sc)) {
        result.ok = false;
        result.reason = 'schedule_not_object';
        result.invalidCount += 1;
        break;
      }
      var kind = String(sc.kind || '').toLowerCase();
      if (kind !== 'loan' && kind !== 'claim') {
        result.ok = false;
        result.reason = 'schedule_kind_invalid';
        result.invalidCount += 1;
        break;
      }
      if (kind === 'loan') {
        var loanId = sc.loanId != null ? String(sc.loanId) : '';
        if (!loanId || !loanById[loanId]) {
          result.ok = false;
          result.reason = 'schedule_loan_missing';
          result.invalidCount += 1;
          break;
        }
      } else {
        var claimId = sc.claimId != null ? String(sc.claimId) : '';
        if (!claimId || !claimById[claimId]) {
          result.ok = false;
          result.reason = 'schedule_claim_missing';
          result.invalidCount += 1;
          break;
        }
      }
      if (sc.debtorId != null && !debtorById[String(sc.debtorId)]) {
        result.ok = false;
        result.reason = 'schedule_debtor_missing';
        result.invalidCount += 1;
        break;
      }
    }

    return result;
  }

  function validateSnapshot(raw, opts) {
    opts = opts || {};

    var result = {
      ok: false,
      reason: '',
      inputFormat: '',
      originalInputFormat: '',
      counts: {
        debtors: 0,
        loans: 0,
        claims: 0,
        schedules: 0,
        cashLogs: 0
      }
    };

    var normalized = normalizeSnapshotInput(raw, opts);
    if (!normalized.ok) {
      result.reason = normalized.reason;
      result.inputFormat = normalized.inputFormat || '';
      result.originalInputFormat = opts.originalInputFormat || normalized.originalInputFormat || normalized.inputFormat || '';
      return result;
    }

    var snapshot = normalized.snapshot;
    var dataRoot = snapshot && snapshot.data;
    if (!dataRoot || !isObject(dataRoot)) {
      result.reason = 'data_missing';
      result.inputFormat = normalized.inputFormat || 'snapshot-v1';
      result.originalInputFormat = opts.originalInputFormat || normalized.originalInputFormat || normalized.inputFormat || 'snapshot-v1';
      return result;
    }

    if (!isValidArrayField(dataRoot, 'debtors') || !isValidArrayField(dataRoot, 'loans') || !isValidArrayField(dataRoot, 'claims') || !isValidArrayField(dataRoot, 'schedules') || !isValidArrayField(dataRoot, 'cashLogs')) {
      result.reason = 'data_shape_invalid';
      result.inputFormat = normalized.inputFormat || 'snapshot-v1';
      result.originalInputFormat = opts.originalInputFormat || normalized.originalInputFormat || normalized.inputFormat || 'snapshot-v1';
      return result;
    }

    normalizeSnapshotDataInPlace(dataRoot);

    result.inputFormat = normalized.inputFormat || 'snapshot-v1';
    result.originalInputFormat = opts.originalInputFormat || normalized.originalInputFormat || result.inputFormat;
    result.counts.debtors = dataRoot.debtors.length;
    result.counts.loans = dataRoot.loans.length;
    result.counts.claims = dataRoot.claims.length;
    result.counts.schedules = dataRoot.schedules.length;
    result.counts.cashLogs = dataRoot.cashLogs.length;

    var refCheck = validateScheduleReferences(dataRoot);
    result.integrity = refCheck;
    if (!refCheck.ok) {
      result.reason = refCheck.reason || 'schedule_ref_invalid';
      return result;
    }

    if (opts.rejectEmptyData) {
      var total = result.counts.debtors + result.counts.loans + result.counts.claims + result.counts.schedules + result.counts.cashLogs;
      if (total <= 0) {
        result.reason = 'empty_data';
        return result;
      }
    }

    result.ok = true;
    result.snapshot = snapshot;
    result.dataRoot = dataRoot;
    return result;
  }

  function buildSnapshotEnvelope(opts) {
    opts = opts || {};
    ensureState();
    ensureMetaFromCurrentState();

    var schedulesSnapshot = getSchedulesSnapshot();
    var snapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      appVersion: getCurrentAppVersion(),
      ui: createSnapshotUiState(App.state.ui || {}),
      data: createSnapshotDataState({
        debtors: Array.isArray(App.state.debtors) ? App.state.debtors : [],
        loans: Array.isArray(App.state.loans) ? App.state.loans : [],
        claims: Array.isArray(App.state.claims) ? App.state.claims : [],
        schedules: schedulesSnapshot,
        cashLogs: Array.isArray(App.state.cashLogs) ? App.state.cashLogs : [],
        riskSettings: (typeof App.riskSettings !== 'undefined') ? App.riskSettings : null
      }),
      meta: cloneMetaState(App.state.meta)
    };

    if (opts && opts.includeSource && typeof opts.source === 'string' && opts.source) {
      snapshot.source = opts.source;
    }

    return snapshot;
  }

  function resolveSourceType(opts, reason) {
    if (opts && typeof opts.sourceType === 'string' && opts.sourceType) return opts.sourceType;
    var r = String(reason || '');
    if (r.indexOf('load:cloud') === 0 || r.indexOf('save:cloud') === 0) return 'cloud';
    if (r.indexOf('restore:local') === 0 || r.indexOf('save:local') === 0) return 'local';
    if (r.indexOf('auth:') === 0) return 'auth';
    return 'manual';
  }

  function buildTraceState(trace) {
    trace = trace || {};
    return {
      phase: trace.phase || 'apply',
      reason: trace.reason || '',
      uiPolicy: trace.uiPolicy || 'preserve',
      sourceType: trace.sourceType || 'manual',
      inputFormat: trace.inputFormat || null,
      originalInputFormat: trace.originalInputFormat || trace.inputFormat || null,
      managedUiSource: trace.managedUiSource || 'current',
      managedUiKeys: getManagedUiKeys(),
      hasSnapshotUI: !!trace.hasSnapshotUI
    };
  }

  function applySchedulesSnapshot(schedulesSnapshot) {
    if (!App.schedulesEngine) return;
    if (typeof App.schedulesEngine.fromSnapshot === 'function') {
      App.schedulesEngine.fromSnapshot(Array.isArray(schedulesSnapshot) ? schedulesSnapshot : []);
      return;
    }
    if (typeof App.schedulesEngine.initEmpty === 'function') {
      App.schedulesEngine.initEmpty();
      return;
    }
    if (typeof App.schedulesEngine.getAll === 'function' && Array.isArray(App.schedulesEngine.list)) {
      App.schedulesEngine.list.length = 0;
    }
  }

  function commitAllOnce(reason) {
    if (App.api && typeof App.api.commitAll === 'function') {
      App.api.commitAll(reason || 'stateIO:commitAllOnce');
      return;
    }
  }

  function sanitizeUIStateAfterApply() {
    ensureState();
    var ui = App.state.ui || (App.state.ui = {});
    var validTabs = { debtors: true, calendar: true, monitoring: true, report: true };
    if (!validTabs[ui.activeTab]) {
      ui.activeTab = 'calendar';
    }

    ui.calendar = ui.calendar || {};
    if (ui.calendar.view !== 'month' && ui.calendar.view !== 'week') ui.calendar.view = (App.getDefaultCalendarView ? App.getDefaultCalendarView() : 'week');
    if (ui.calendar.sortMode !== 'type' && ui.calendar.sortMode !== 'status') ui.calendar.sortMode = 'type';
    if (typeof ui.calendar.currentDate !== 'string' || !ui.calendar.currentDate) ui.calendar.currentDate = (App.util && typeof App.util.todayISODate === 'function') ? App.util.todayISODate() : new Date().toISOString().slice(0, 10);

    ui.debtorPanel = sanitizeDebtorPanelStateInPlace(ui.debtorPanel);
    ui.monitoring = sanitizeMonitoringStateInPlace(ui.monitoring);
    ui.report = sanitizeReportStateInPlace(ui.report);
  }

  App.stateIO = App.stateIO || {};

  App.stateIO.applySnapshot = function (snapshot, opts) {
    opts = opts || {};
    var uiPolicy = resolveUiPolicy(opts);
    var commitReason = opts.reason || 'stateIO:applySnapshot';
    var sourceType = resolveSourceType(opts, commitReason);

    var normalized = normalizeSnapshotInput(snapshot, opts);
    if (!normalized.ok) {
      console.warn('[StateIO] applySnapshot rejected:', normalized.reason);
      return false;
    }

    ensureState();

    var normalizedSnapshot = normalized.snapshot;
    var uiSrc = (normalizedSnapshot && isObject(normalizedSnapshot.ui)) ? normalizedSnapshot.ui : null;
    var dataRoot = getDataRoot(normalizedSnapshot) || {};

    normalizeSnapshotDataInPlace(dataRoot);

    var uiBuild = buildNextUiState(App.state.ui, uiSrc, uiPolicy);
    applyUIInPlace(App.state.ui, uiBuild.ui);

    var debtorsSrc = Array.isArray(dataRoot.debtors) ? dataRoot.debtors : [];
    var debtorsClean = debtorsSrc;
    if (App.util && typeof App.util.sanitizeDebtorArray === 'function') debtorsClean = App.util.sanitizeDebtorArray(debtorsSrc);
    replaceArrayInPlace(ensureArray('debtors'), debtorsClean);
    replaceArrayInPlace(ensureArray('loans'), Array.isArray(dataRoot.loans) ? dataRoot.loans : []);
    replaceArrayInPlace(ensureArray('claims'), Array.isArray(dataRoot.claims) ? dataRoot.claims : []);
    replaceArrayInPlace(ensureArray('cashLogs'), Array.isArray(dataRoot.cashLogs) ? dataRoot.cashLogs : []);

    if (typeof dataRoot.schedules !== 'undefined') {
      applySchedulesSnapshot(dataRoot.schedules);
    }

    if (Object.prototype.hasOwnProperty.call(dataRoot, 'riskSettings')) {
      App.riskSettings = dataRoot.riskSettings;
    }

    if (App.util && typeof App.util.repairLoanClaimDisplayIds === 'function') {
      App.util.repairLoanClaimDisplayIds();
    }

    applyMetaFromSnapshot(normalizedSnapshot, dataRoot);
    sanitizeUIStateAfterApply();

    var appliedInputFormat = opts.inputFormat || normalized.inputFormat || 'snapshot-v1';
    var appliedOriginalInputFormat = opts.originalInputFormat || normalized.originalInputFormat || appliedInputFormat;

    App.stateIO.lastApplySnapshot = buildTraceState({
      phase: 'apply',
      reason: commitReason,
      uiPolicy: uiPolicy,
      sourceType: sourceType,
      inputFormat: appliedInputFormat,
      originalInputFormat: appliedOriginalInputFormat,
      managedUiSource: uiBuild.source,
      hasSnapshotUI: !!uiSrc
    });

    var panel = App.state && App.state.ui && App.state.ui.debtorPanel;
    if (panel && panel.selectedDebtorId && Array.isArray(App.state.debtors)) {
      var exists = false;
      for (var di = 0; di < App.state.debtors.length; di++) {
        var d = App.state.debtors[di];
        if (d && d.id != null && String(d.id) === String(panel.selectedDebtorId)) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        panel.selectedDebtorId = null;
        panel.mode = 'list';
      }
    }

    commitAllOnce(commitReason);
    return true;
  };

  function applyDefaultDomainState() {
    var defaults = cloneDefaultDataState();

    replaceArrayInPlace(ensureArray('debtors'), defaults.debtors);
    replaceArrayInPlace(ensureArray('loans'), defaults.loans);
    replaceArrayInPlace(ensureArray('claims'), defaults.claims);
    replaceArrayInPlace(ensureArray('cashLogs'), defaults.cashLogs);

    if (App.schedulesEngine) {
      if (typeof App.schedulesEngine.reset === 'function') {
        App.schedulesEngine.reset();
      } else if (typeof App.schedulesEngine.initEmpty === 'function') {
        App.schedulesEngine.initEmpty();
      } else if (typeof App.schedulesEngine.fromSnapshot === 'function') {
        App.schedulesEngine.fromSnapshot(Array.isArray(defaults.schedules) ? defaults.schedules : []);
      }
    }

    if (!isObject(App.state.meta)) App.state.meta = {};
    var metaDefaults = isObject(defaults.meta) ? defaults.meta : {};
    App.state.meta.nextDebtorId = normalizePositiveInt(metaDefaults.nextDebtorId, 1);
    App.state.meta.nextLoanId = normalizePositiveInt(metaDefaults.nextLoanId, 1);
    App.state.meta.nextClaimId = normalizePositiveInt(metaDefaults.nextClaimId, 1);

    App.state.loansCollapsed = !!defaults.loansCollapsed;
    App.state.claimsCollapsed = !!defaults.claimsCollapsed;
    if (typeof App.riskSettings !== 'undefined') {
      App.riskSettings = null;
    }
  }

  function applyResetUiPolicy(uiPolicy, traceOpts) {
    traceOpts = traceOpts || {};
    var uiBuild = buildNextUiState(App.state.ui, null, uiPolicy);
    applyUIInPlace(App.state.ui, uiBuild.ui);

    if (uiPolicy === 'preserve' && App.state.ui && App.state.ui.debtorPanel) {
      App.state.ui.debtorPanel.selectedDebtorId = null;
      App.state.ui.debtorPanel.mode = 'list';
      App.state.ui.debtorPanel.page = 1;
    }

    sanitizeUIStateAfterApply();

    var resetInputFormat = traceOpts.inputFormat || 'default-reset';
    var resetOriginalInputFormat = traceOpts.originalInputFormat || resetInputFormat;

    App.stateIO.lastApplySnapshot = buildTraceState({
      phase: traceOpts.phase || 'reset',
      reason: traceOpts.reason || (uiPolicy === 'reset' ? 'reset:hard' : 'reset:dataPreserveUI'),
      uiPolicy: uiPolicy,
      sourceType: traceOpts.sourceType || 'manual',
      inputFormat: resetInputFormat,
      originalInputFormat: resetOriginalInputFormat,
      managedUiSource: uiBuild.source,
      hasSnapshotUI: false
    });
  }

  App.stateIO.resetDataKeepUI = function (opts) {
    opts = opts || {};
    var commitReason = opts.reason || 'stateIO:resetDataKeepUI';
    applyDefaultDomainState();
    applyResetUiPolicy('preserve', {
      phase: 'reset',
      reason: commitReason,
      sourceType: resolveSourceType(opts, commitReason),
      inputFormat: 'default-reset'
    });
    commitAllOnce(commitReason);
  };

  App.stateIO.resetAll = function (opts) {
    opts = opts || {};
    var commitReason = opts.reason || 'reset:hard';
    var uiPolicy = resolveUiPolicy({ uiPolicy: opts.uiPolicy || 'reset' });
    applyDefaultDomainState();
    applyResetUiPolicy(uiPolicy, {
      phase: 'reset',
      reason: commitReason,
      sourceType: resolveSourceType(opts, commitReason),
      inputFormat: 'default-reset'
    });
    commitAllOnce(commitReason);
  };

  App.stateIO.getManagedUiKeys = getManagedUiKeys;
  App.stateIO.ensureMeta = ensureMetaFromCurrentState;
  App.stateIO.getCurrentAppVersion = getCurrentAppVersion;
  App.stateIO.buildSnapshotEnvelope = function (opts) { return buildSnapshotEnvelope(opts); };
  App.stateIO.normalizeSnapshotInput = function (snapshot, opts) { return normalizeSnapshotInput(snapshot, opts); };
  App.stateIO.validateSnapshot = function (snapshot, opts) { return validateSnapshot(snapshot, opts); };
})(window);
