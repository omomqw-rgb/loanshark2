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

    // debtor panel
    if (isObject(src.debtorPanel)) {
      dst.debtorPanel = dst.debtorPanel || {};
      if (typeof src.debtorPanel.mode === 'string') dst.debtorPanel.mode = src.debtorPanel.mode;
      if (typeof src.debtorPanel.page === 'number') dst.debtorPanel.page = src.debtorPanel.page;
      if (typeof src.debtorPanel.searchQuery === 'string') dst.debtorPanel.searchQuery = src.debtorPanel.searchQuery;
      if (typeof src.debtorPanel.selectedDebtorId !== 'undefined') {
        dst.debtorPanel.selectedDebtorId = src.debtorPanel.selectedDebtorId;
      }
    }
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

  function commitAllOnce() {
    if (App.api && typeof App.api.commitAll === 'function') {
      App.api.commitAll();
      return;
    }
    // Minimal fallback: do nothing (Stage 4+ always provides commitAll).
  }

  App.stateIO = App.stateIO || {};

  // Apply snapshot into the current App.state without replacing App.state reference.
  App.stateIO.applySnapshot = function (snapshot, opts) {
    opts = opts || {};
    var keepUI = (typeof opts.keepUI === 'undefined') ? true : !!opts.keepUI;

    ensureState();

    var uiSrc = (snapshot && isObject(snapshot.ui)) ? snapshot.ui : null;
    var dataRoot = getDataRoot(snapshot) || {};

    // Normalize IDs early to avoid strict-equality mapping issues.
    normalizeSnapshotDataInPlace(dataRoot);

    // UI state: keep by default.
    if (!keepUI && uiSrc) {
      applyUIInPlace(App.state.ui, uiSrc);
    }

    // Domain arrays (in-place)
    replaceArrayInPlace(ensureArray('debtors'), Array.isArray(dataRoot.debtors) ? dataRoot.debtors : []);
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

    

    // Stage 6.1: Apply meta counters (monotonic IDs) from snapshot when present.
    applyMetaFromSnapshot(snapshot, dataRoot);

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
        if (App.debtorPanel && typeof App.debtorPanel.showList === 'function') {
          App.debtorPanel.showList();
        }
      }
    }

commitAllOnce();
  };

  // Reset data arrays + schedules while preserving UI state
  App.stateIO.resetDataKeepUI = function () {
    ensureState();

    ensureArray('debtors').length = 0;
    ensureArray('loans').length = 0;
    ensureArray('claims').length = 0;
    ensureArray('cashLogs').length = 0;

    if (App.schedulesEngine) {
      if (typeof App.schedulesEngine.reset === 'function') {
        App.schedulesEngine.reset();
      } else if (typeof App.schedulesEngine.initEmpty === 'function') {
        App.schedulesEngine.initEmpty();
      } else if (typeof App.schedulesEngine.fromSnapshot === 'function') {
        App.schedulesEngine.fromSnapshot([]);
      }
    }

    

    // Stage 6.1: Reset monotonic ID counters to match legacy "fresh start" behavior.
    if (!isObject(App.state.meta)) App.state.meta = {};
    App.state.meta.nextDebtorId = 1;
    App.state.meta.nextLoanId = 1;
    App.state.meta.nextClaimId = 1;

    // Stage 6.1: Avoid blank/stuck detail panel after reset (data cleared but UI selection kept).
    if (App.state.ui && App.state.ui.debtorPanel) {
      App.state.ui.debtorPanel.selectedDebtorId = null;
      App.state.ui.debtorPanel.mode = 'list';
      if (App.debtorPanel && typeof App.debtorPanel.showList === 'function') {
        App.debtorPanel.showList();
      }
    }

commitAllOnce();
  };


  // Stage 6.1: Public helper for Local Save (ensures meta counters exist in snapshot)
  App.stateIO.ensureMeta = ensureMetaFromCurrentState;
})(window);
