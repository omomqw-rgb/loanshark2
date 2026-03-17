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

    // calendar
    if (isObject(src.calendar)) {
      dst.calendar = dst.calendar || {};
      if (typeof src.calendar.view === 'string') dst.calendar.view = src.calendar.view;
      if (typeof src.calendar.sortMode === 'string') dst.calendar.sortMode = src.calendar.sortMode;
      if (typeof src.calendar.currentDate === 'string') dst.calendar.currentDate = src.calendar.currentDate;
    }

    // active tab
    if (typeof src.activeTab === 'string') {
      dst.activeTab = src.activeTab;
    }

    applyManagedUIInPlace(dst, src);
  }

  function applyManagedUIInPlace(dst, src) {
    if (!isObject(dst) || !isObject(src)) return;

    // debtor panel
    if (isObject(src.debtorPanel)) {
      dst.debtorPanel = dst.debtorPanel || {};
      if (typeof src.debtorPanel.mode === 'string') dst.debtorPanel.mode = src.debtorPanel.mode;
      if (typeof src.debtorPanel.page === 'number') dst.debtorPanel.page = src.debtorPanel.page;
      if (typeof src.debtorPanel.searchQuery === 'string') dst.debtorPanel.searchQuery = src.debtorPanel.searchQuery;
      if (typeof src.debtorPanel.selectedDebtorId !== 'undefined') {
        dst.debtorPanel.selectedDebtorId = src.debtorPanel.selectedDebtorId;
      }
      if (typeof src.debtorPanel.viewMode === 'string') dst.debtorPanel.viewMode = src.debtorPanel.viewMode;
      if (typeof src.debtorPanel.activeOnly === 'boolean') dst.debtorPanel.activeOnly = src.debtorPanel.activeOnly;
      if (typeof src.debtorPanel.perPage === 'number') dst.debtorPanel.perPage = src.debtorPanel.perPage;
    }

    // monitoring
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

    // report
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
    panel.selectedDebtorId = (panel.selectedDebtorId == null || panel.selectedDebtorId === '')
      ? null
      : String(panel.selectedDebtorId);
    panel.searchQuery = (typeof panel.searchQuery === 'string') ? panel.searchQuery : defaults.searchQuery;
    panel.page = normalizePositiveInt(panel.page, defaults.page);
    panel.viewMode = (panel.viewMode === 'loan' || panel.viewMode === 'claim' || panel.viewMode === 'risk' || panel.viewMode === 'all')
      ? panel.viewMode
      : defaults.viewMode;
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

    report.activeSection = (report.activeSection === 'statistics' || report.activeSection === 'capitalflow' || report.activeSection === 'risk' || report.activeSection === 'overview')
      ? report.activeSection
      : defaults.activeSection;
    report.portfolioMode = (report.portfolioMode === 'claim' || report.portfolioMode === 'loan')
      ? report.portfolioMode
      : defaults.portfolioMode;

    report.trend = isObject(report.trend) ? report.trend : {};
    report.trend.period = (typeof report.trend.period === 'string' && report.trend.period)
      ? report.trend.period
      : defaults.trend.period;
    report.trend.dateFrom = normalizeNullableDateString(report.trend.dateFrom);
    report.trend.dateTo = normalizeNullableDateString(report.trend.dateTo);

    report.risk = isObject(report.risk) ? report.risk : {};
    report.risk.dateFrom = normalizeNullableDateString(report.risk.dateFrom);
    report.risk.dateTo = normalizeNullableDateString(report.risk.dateTo);

    var defaultLegend = (isObject(defaults.legendVisibility) && isObject(defaults.legendVisibility.capitalflow))
      ? defaults.legendVisibility.capitalflow
      : { velocity: true, inflow: true, outflow: true, net: true };
    report.legendVisibility = isObject(report.legendVisibility) ? report.legendVisibility : {};
    report.legendVisibility.capitalflow = isObject(report.legendVisibility.capitalflow) ? report.legendVisibility.capitalflow : {};
    report.legendVisibility.capitalflow.velocity = (typeof report.legendVisibility.capitalflow.velocity === 'boolean') ? report.legendVisibility.capitalflow.velocity : defaultLegend.velocity;
    report.legendVisibility.capitalflow.inflow = (typeof report.legendVisibility.capitalflow.inflow === 'boolean') ? report.legendVisibility.capitalflow.inflow : defaultLegend.inflow;
    report.legendVisibility.capitalflow.outflow = (typeof report.legendVisibility.capitalflow.outflow === 'boolean') ? report.legendVisibility.capitalflow.outflow : defaultLegend.outflow;
    report.legendVisibility.capitalflow.net = (typeof report.legendVisibility.capitalflow.net === 'boolean') ? report.legendVisibility.capitalflow.net : defaultLegend.net;

    return report;
  }

  // Cloud/Local snapshot interoperability:
  // - Local snapshot: { debtors, loans, claims, cashLogs, schedules, ui, ... }
  // - Cloud snapshot: { version, ui, data: { debtors, loans, claims, cashLogs, schedules, riskSettings } }
  function getDataRoot(snapshot) {
    if (snapshot && isObject(snapshot.data)) return snapshot.data;
    return snapshot;
  }

  function normalizeDebtorIdsInPlace(debtors) {
    debtors = debtors || [];
    for (var i = 0; i < debtors.length; i++) {
      var d = debtors[i];
      if (!isObject(d)) continue;

      if (typeof d.id === 'undefined' && typeof d.debtor_id !== 'undefined') {
        d.id = d.debtor_id;
      }
      if (d.id != null) d.id = toStr(d.id);
      if (typeof d.debtor_id !== 'undefined') d.debtor_id = d.id;
    }
  }

  function normalizeLoanIdsInPlace(loans) {
    loans = loans || [];
    for (var i = 0; i < loans.length; i++) {
      var l = loans[i];
      if (!isObject(l)) continue;

      if (typeof l.debtorId === 'undefined' && typeof l.debtor_id !== 'undefined') {
        l.debtorId = l.debtor_id;
      }
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

      if (typeof c.debtorId === 'undefined' && typeof c.debtor_id !== 'undefined') {
        c.debtorId = c.debtor_id;
      }
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

      // v024.1: cashLogs ref 연결 구조 보완
      // - Prefer refType; keep refKind for backward compatibility.
      if (typeof row.refType === 'undefined' && typeof row.refKind !== 'undefined') {
        row.refType = row.refKind;
      }
      if (typeof row.refKind === 'undefined' && typeof row.refType !== 'undefined') {
        row.refKind = row.refType;
      }

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

      if (typeof s.loanId === 'undefined' && typeof s.loan_id !== 'undefined') {
        s.loanId = s.loan_id;
      }
      if (typeof s.claimId === 'undefined' && typeof s.claim_id !== 'undefined') {
        s.claimId = s.claim_id;
      }
      if (typeof s.debtorId === 'undefined' && typeof s.debtor_id !== 'undefined') {
        s.debtorId = s.debtor_id;
      }

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

  // Stage 6.1: Monotonic ID counters (meta) for production safety.
  // - Eliminates length+1 ID collisions after deletions.
  // - Preserves counters across save/load when snapshot.meta exists.
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

    // Prefer snapshot.meta; also support dataRoot.meta for forward compatibility.
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

    // Ensure counters are always >= max(existing)+1 even if snapshot meta is missing/corrupt.
    ensureMetaFromCurrentState();
  }


  function applySchedulesSnapshot(schedulesSnapshot) {
    if (!App.schedulesEngine) return;

    if (typeof App.schedulesEngine.fromSnapshot === 'function') {
      App.schedulesEngine.fromSnapshot(Array.isArray(schedulesSnapshot) ? schedulesSnapshot : []);
      return;
    }

    // Fallbacks (should not happen in v001)
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
    // Minimal fallback: do nothing (Stage 4+ always provides commitAll).
  }

  function sanitizeUIStateAfterApply() {
    ensureState();
    var ui = App.state.ui || (App.state.ui = {});
    var validTabs = { debtors: true, calendar: true, monitoring: true, report: true };
    if (!validTabs[ui.activeTab]) {
      ui.activeTab = 'calendar';
    }

    ui.calendar = ui.calendar || {};
    if (ui.calendar.view !== 'month' && ui.calendar.view !== 'week') {
      ui.calendar.view = (App.getDefaultCalendarView ? App.getDefaultCalendarView() : 'week');
    }
    if (ui.calendar.sortMode !== 'type' && ui.calendar.sortMode !== 'status') {
      ui.calendar.sortMode = 'type';
    }
    if (typeof ui.calendar.currentDate !== 'string' || !ui.calendar.currentDate) {
      ui.calendar.currentDate = (App.util && typeof App.util.todayISODate === 'function') ? App.util.todayISODate() : new Date().toISOString().slice(0, 10);
    }

    ui.debtorPanel = sanitizeDebtorPanelStateInPlace(ui.debtorPanel);
    ui.monitoring = sanitizeMonitoringStateInPlace(ui.monitoring);
    ui.report = sanitizeReportStateInPlace(ui.report);
  }

  App.stateIO = App.stateIO || {};

  // Apply snapshot into the current App.state without replacing App.state reference.
  App.stateIO.applySnapshot = function (snapshot, opts) {
    opts = opts || {};
    var uiPolicy = resolveUiPolicy(opts);
    var commitReason = opts.reason || 'stateIO:applySnapshot';

    ensureState();

    var uiSrc = (snapshot && isObject(snapshot.ui)) ? snapshot.ui : null;
    var dataRoot = getDataRoot(snapshot) || {};

    // Normalize IDs early to avoid strict-equality mapping issues.
    normalizeSnapshotDataInPlace(dataRoot);

    // Managed UI state uses explicit policy semantics.
    // - preserve: keep current debtorPanel / monitoring / report state
    // - snapshot: restore those managed UI subtrees from snapshot.ui (with defaults for missing fields)
    // - reset: reset the managed UI subtree set to defaults
    var uiBuild = buildNextUiState(App.state.ui, uiSrc, uiPolicy);
    applyUIInPlace(App.state.ui, uiBuild.ui);

    // Domain arrays (in-place)
    // v3.2.8: Debtors in App.state must contain human-info only.
    // Remove legacy ledger copies (loans/claims arrays) and any derived caches
    // during snapshot apply so legacy snapshots can never re-pollute state.
    var debtorsSrc = Array.isArray(dataRoot.debtors) ? dataRoot.debtors : [];
    var debtorsClean = debtorsSrc;
    if (App.util && typeof App.util.sanitizeDebtorArray === 'function') {
      debtorsClean = App.util.sanitizeDebtorArray(debtorsSrc);
    }
    replaceArrayInPlace(ensureArray('debtors'), debtorsClean);
    replaceArrayInPlace(ensureArray('loans'), Array.isArray(dataRoot.loans) ? dataRoot.loans : []);
    replaceArrayInPlace(ensureArray('claims'), Array.isArray(dataRoot.claims) ? dataRoot.claims : []);
    replaceArrayInPlace(ensureArray('cashLogs'), Array.isArray(dataRoot.cashLogs) ? dataRoot.cashLogs : []);

    // Schedules must go through schedulesEngine.fromSnapshot()
    if (typeof dataRoot.schedules !== 'undefined') {
      applySchedulesSnapshot(dataRoot.schedules);
    }

    // Optional: keep risk settings in sync when present (cloud snapshots).
    if (Object.prototype.hasOwnProperty.call(dataRoot, 'riskSettings')) {
      App.riskSettings = dataRoot.riskSettings;
    }

    


// displayId repair (Loan/Claim): fix invalid ids already present in loaded snapshots.
// - Does NOT generate ids when missing (no bulk generation on load).
if (App.util && typeof App.util.repairLoanClaimDisplayIds === 'function') {
  App.util.repairLoanClaimDisplayIds();
}


    // Stage 6.1: Apply meta counters (monotonic IDs) from snapshot when present.
    applyMetaFromSnapshot(snapshot, dataRoot);

    sanitizeUIStateAfterApply();

    App.stateIO.lastApplySnapshot = {
      reason: commitReason,
      uiPolicy: uiPolicy,
      hasSnapshotUI: !!uiSrc,
      managedUiKeys: getManagedUiKeys(),
      managedUiSource: uiBuild.source
    };

    // Stage 6.1: keepUI=true can leave a stale selectedDebtorId after Load.
    // If the selected debtor no longer exists, return to list mode to prevent blank/stuck detail panel.
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

  function applyResetUiPolicy(uiPolicy) {
    var uiBuild = buildNextUiState(App.state.ui, null, uiPolicy);
    applyUIInPlace(App.state.ui, uiBuild.ui);

    if (uiPolicy === 'preserve' && App.state.ui && App.state.ui.debtorPanel) {
      App.state.ui.debtorPanel.selectedDebtorId = null;
      App.state.ui.debtorPanel.mode = 'list';
      App.state.ui.debtorPanel.page = 1;
    }

    sanitizeUIStateAfterApply();

    App.stateIO.lastApplySnapshot = {
      reason: uiPolicy === 'reset' ? 'reset:hard' : 'reset:dataPreserveUI',
      uiPolicy: uiPolicy,
      hasSnapshotUI: false,
      managedUiKeys: getManagedUiKeys(),
      managedUiSource: uiBuild.source
    };
  }

  // Reset data arrays + schedules while preserving UI state
  App.stateIO.resetDataKeepUI = function (opts) {
    opts = opts || {};
    var commitReason = opts.reason || 'stateIO:resetDataKeepUI';
    applyDefaultDomainState();
    applyResetUiPolicy('preserve');
    commitAllOnce(commitReason);
  };

  // Full reset: reset domain data and UI semantics to defaults.
  App.stateIO.resetAll = function (opts) {
    opts = opts || {};
    var commitReason = opts.reason || 'reset:hard';
    var uiPolicy = resolveUiPolicy({ uiPolicy: opts.uiPolicy || 'reset' });
    applyDefaultDomainState();
    applyResetUiPolicy(uiPolicy);
    commitAllOnce(commitReason);
  };

  App.stateIO.getManagedUiKeys = getManagedUiKeys;

  // Stage 6.1: Public helper for Local Save (ensures meta counters exist in snapshot)
  App.stateIO.ensureMeta = ensureMetaFromCurrentState;
})(window);
