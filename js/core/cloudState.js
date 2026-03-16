(function (window) {
  'use strict';

  var App = window.App || (window.App = {});
  var util = App.util || {};

  function getTodayISODate() {
    if (util && typeof util.todayISODate === 'function') {
      return util.todayISODate();
    }
    var d = new Date();
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var mm = m < 10 ? '0' + m : String(m);
    var dd = day < 10 ? '0' + day : String(day);
    return y + '-' + mm + '-' + dd;
  }

  function pickArray(primary, fallback) {
    if (primary && primary.length) return primary;
    if (fallback && fallback.length) return fallback;
    return [];
  }

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
    if (!arr || !arr.length) return out;
    for (var i = 0; i < arr.length; i++) {
      var item = arr[i];
      out.push(isObject(item) ? shallowClone(item) : item);
    }
    return out;
  }

  function normalizeLoanIdsInPlace(loans) {
    loans = loans || [];
    for (var i = 0; i < loans.length; i++) {
      var l = loans[i];
      if (!isObject(l)) continue;

      // snake_case compatibility
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

      // snake_case compatibility
      if (typeof c.debtorId === 'undefined' && typeof c.debtor_id !== 'undefined') {
        c.debtorId = c.debtor_id;
      }

      if (c.id != null) c.id = toStr(c.id);
      if (c.debtorId != null) c.debtorId = toStr(c.debtorId);

      if (typeof c.debtor_id !== 'undefined') c.debtor_id = c.debtorId;
    }
  }

  function normalizeDebtorIdsInPlace(debtors) {
    debtors = debtors || [];
    for (var i = 0; i < debtors.length; i++) {
      var d = debtors[i];
      if (!isObject(d)) continue;

      // snake_case compatibility
      if (typeof d.id === 'undefined' && typeof d.debtor_id !== 'undefined') {
        d.id = d.debtor_id;
      }

      if (d.id != null) d.id = toStr(d.id);
      if (typeof d.debtor_id !== 'undefined') d.debtor_id = d.id;
    }
  }

  function normalizeScheduleIdsInPlace(schedules) {
    schedules = schedules || [];
    for (var i = 0; i < schedules.length; i++) {
      var s = schedules[i];
      if (!isObject(s)) continue;

      // snake_case compatibility (legacy rows, etc.)
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

  function normalizeAppDataIds(data) {
    if (!data) return;
    normalizeDebtorIdsInPlace(data.debtors);
    normalizeLoanIdsInPlace(data.loans);
    normalizeClaimIdsInPlace(data.claims);
    normalizeScheduleIdsInPlace(data.schedules);
  }

  function getSnapshotDataRoot(snapshot) {
    if (snapshot && isObject(snapshot.data)) return snapshot.data;
    return null;
  }

  function getArrayCount(value) {
    return Array.isArray(value) ? value.length : 0;
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

  function validateSnapshot(snapshot, opts) {
    opts = opts || {};

    var result = {
      ok: false,
      reason: '',
      counts: {
        debtors: 0,
        loans: 0,
        claims: 0,
        schedules: 0,
        cashLogs: 0
      }
    };

    if (!snapshot || !isObject(snapshot)) {
      result.reason = 'snapshot_missing';
      return result;
    }

    var version = snapshot.version;
    if (!(version === 1 || version === '1')) {
      result.reason = 'unsupported_version';
      return result;
    }

    var dataRoot = getSnapshotDataRoot(snapshot);
    if (!dataRoot || !isObject(dataRoot)) {
      result.reason = 'data_missing';
      return result;
    }

    if (!isValidArrayField(dataRoot, 'debtors') || !isValidArrayField(dataRoot, 'loans') || !isValidArrayField(dataRoot, 'claims') || !isValidArrayField(dataRoot, 'schedules') || !isValidArrayField(dataRoot, 'cashLogs')) {
      result.reason = 'data_shape_invalid';
      return result;
    }

    normalizeAppDataIds(dataRoot);

    result.counts.debtors = getArrayCount(dataRoot.debtors);
    result.counts.loans = getArrayCount(dataRoot.loans);
    result.counts.claims = getArrayCount(dataRoot.claims);
    result.counts.schedules = getArrayCount(dataRoot.schedules);
    result.counts.cashLogs = getArrayCount(dataRoot.cashLogs);

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
    result.dataRoot = dataRoot;
    return result;
  }

  function collectTypeStats(list, field) {
    var stats = Object.create(null);
    if (!list || !list.length) return stats;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!isObject(item)) continue;
      var v = item[field];
      var t = (v === null) ? 'null' : typeof v;
      stats[t] = (stats[t] || 0) + 1;
    }
    return stats;
  }

  function runShadowQA(source) {
    source = source || 'unknown';

    // Prefer the single source of truth (App.state). App.data is a derived bridge.
    var loans = (App.state && App.state.loans) || [];
    var claims = (App.state && App.state.claims) || [];

    var schedules = [];
    if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      try {
        schedules = App.schedulesEngine.getAll() || [];
      } catch (e) {
        schedules = [];
      }
    }

    var engineListRef = (App.schedulesEngine && App.schedulesEngine.list) || null;

    var engineConsistency = {
      engineHasList: !!engineListRef,
      engineLength: Array.isArray(engineListRef) ? engineListRef.length : 0
    };

    var loanById = Object.create(null);
    var claimById = Object.create(null);
    var scheduleCountByLoan = Object.create(null);

    for (var i = 0; i < loans.length; i++) {
      var loan = loans[i];
      if (!loan || loan.id == null) continue;
      loanById[String(loan.id)] = loan;
    }

    for (var j = 0; j < claims.length; j++) {
      var claim = claims[j];
      if (!claim || claim.id == null) continue;
      claimById[String(claim.id)] = claim;
    }

    var orphanLoanSchedules = 0;
    var orphanClaimSchedules = 0;

    for (var k = 0; k < schedules.length; k++) {
      var sc = schedules[k];
      if (!sc || !sc.kind) continue;

      if (sc.kind === 'loan') {
        var lid = (typeof sc.loanId !== 'undefined') ? sc.loanId : sc.loan_id;
        if (lid == null) continue;
        var lidKey = String(lid);
        scheduleCountByLoan[lidKey] = (scheduleCountByLoan[lidKey] || 0) + 1;
        if (!loanById[lidKey]) orphanLoanSchedules++;
      } else if (sc.kind === 'claim') {
        var cid = (typeof sc.claimId !== 'undefined') ? sc.claimId : sc.claim_id;
        if (cid == null) continue;
        var cidKey = String(cid);
        if (!claimById[cidKey]) orphanClaimSchedules++;
      }
    }

    var missingLoanScheduleIds = [];
    for (var loanId in loanById) {
      if (!Object.prototype.hasOwnProperty.call(loanById, loanId)) continue;
      if (!scheduleCountByLoan[loanId]) missingLoanScheduleIds.push(loanId);
    }

    var report = {
      source: source,
      loansTotal: Object.keys(loanById).length,
      schedulesTotal: schedules.length,
      loansMissingSchedules: missingLoanScheduleIds,
      orphanLoanSchedules: orphanLoanSchedules,
      orphanClaimSchedules: orphanClaimSchedules,
      engineConsistency: engineConsistency,
      typeStats: {
        loanId: collectTypeStats(loans, 'id'),
        scheduleLoanId: collectTypeStats(schedules, 'loanId'),
        scheduleLoan_id: collectTypeStats(schedules, 'loan_id')
      }
    };

    App.cloudState = App.cloudState || {};
    App.cloudState.lastShadowQA = report;

    if (missingLoanScheduleIds.length || orphanLoanSchedules || orphanClaimSchedules) {
      console.warn('[ShadowQA] schedule link check found issues:', report);
    } else {
      console.log('[ShadowQA] schedule link check OK:', report);
    }

    return report;
  }

  App.cloudState = App.cloudState || {};

  // Cloud에 저장할 전체 스냅샷을 만드는 함수
  App.cloudState.build = function () {
    var state = App.state || {};
    var uiState = state.ui || {};
    var calendar = uiState.calendar || {};
    var debtorPanel = uiState.debtorPanel || {};

    var stateData = state || {};

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

    // IMPORTANT:
    // - Supabase JSONB save/load 과정에서 id 필드(loan.id / schedule.loanId 등)가 number/string 혼재될 수 있고,
    //   이후 strict 비교(===)로 매핑이 실패하면 특정 Loan의 스케쥴이 "없음"으로 보이는 문제가 발생한다.
    // - v326/v335C에서는 build/apply 양쪽에서 id 필드를 string 기반으로 정규화해 저장/복원한다.
    //   (스케쥴은 schedulesEngine.toSnapshot()을 통해 스냅샷으로 관리한다.)

    // IMPORTANT (Stage 5): Cloud snapshot must be built from App.state only.
    // App.data is a derived bridge and MUST NOT be used as a source of truth.
    var rawDebtors = Array.isArray(stateData.debtors) ? stateData.debtors : [];
    var cleanDebtors = rawDebtors;
    // v3.2.8: Persist ONLY human-info fields for debtors.
    // (No legacy ledger copies, no derived caches.)
    if (util && typeof util.sanitizeDebtorArray === 'function') {
      cleanDebtors = util.sanitizeDebtorArray(rawDebtors);
    } else {
      cleanDebtors = cloneArray(rawDebtors);
    }

    var snapshotData = {
      debtors: cleanDebtors,
      loans: cloneArray(Array.isArray(stateData.loans) ? stateData.loans : []),
      claims: cloneArray(Array.isArray(stateData.claims) ? stateData.claims : []),
      schedules: cloneArray(schedulesSnapshot),
      cashLogs: cloneArray(Array.isArray(stateData.cashLogs) ? stateData.cashLogs : []),
      riskSettings: (typeof App.riskSettings !== 'undefined') ? App.riskSettings : null
    };

    normalizeAppDataIds(snapshotData);

    var snapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      appVersion: (App.meta && App.meta.version) || 'v326_schedule_cloudload_bugfix',

      ui: {
        calendar: {
          view: calendar.view || (App.getDefaultCalendarView ? App.getDefaultCalendarView() : 'week'),
          sortMode: calendar.sortMode || 'type',
          currentDate: calendar.currentDate || getTodayISODate()
        },
        activeTab: uiState.activeTab || 'calendar',
        debtorPanel: {
          mode: debtorPanel.mode || 'list',
          page: typeof debtorPanel.page === 'number' ? debtorPanel.page : 1,
          searchQuery: debtorPanel.searchQuery || '',
          selectedDebtorId: (typeof debtorPanel.selectedDebtorId === 'undefined')
            ? null
            : debtorPanel.selectedDebtorId
        }
      },

      data: snapshotData
    };

    snapshot.data.cashLogs = snapshot.data.cashLogs || [];
    if (typeof snapshot.data.riskSettings === 'undefined') {
      snapshot.data.riskSettings = null;
    }

    return snapshot;
  };

  App.cloudState.validateSnapshot = function (snapshot, opts) {
    return validateSnapshot(snapshot, opts);
  };

  function savePreCloudLoadBackup() {
    try {
      if (!window.localStorage) return;
      if (!App.cloudState || typeof App.cloudState.build !== 'function') return;
      var snapshot = App.cloudState.build();
      if (!snapshot) return;
      window.localStorage.setItem('loanshark_pre_cloud_load_backup', JSON.stringify(snapshot));
      window.localStorage.setItem('loanshark_pre_cloud_load_backup_savedAt', new Date().toISOString());
    } catch (e) {
      console.warn('[CloudState] Failed to persist pre-load backup:', e);
    }
  }

  // Supabase에서 가져온 스냅샷을 앱에 반영하는 함수
  App.cloudState.apply = function (snapshot, opts) {
    var validation = validateSnapshot(snapshot, opts);

    if (!validation.ok) {
      console.warn('[CloudState] Snapshot rejected:', validation.reason, validation.counts || {}, validation.integrity || {});
      return false;
    }

    savePreCloudLoadBackup();

    // Stage 5: Single pipeline (stateIO → commitAll). No direct state swapping or render calls.
    if (App.stateIO && typeof App.stateIO.applySnapshot === 'function') {
      App.stateIO.applySnapshot(snapshot, { keepUI: true });
    } else {
      console.error('[CloudState] App.stateIO.applySnapshot is not available.');
      return false;
    }

    // ShadowQA: Cloud Load 이후 Loan ↔ Schedule 매핑 무결성 체크 (콘솔 경고/리포트 저장)
    runShadowQA('cloudState.apply');
    return true;
  };;

  // Manual QA hook (optional)
  App.cloudState.runShadowQA = function () {
    return runShadowQA('manual');
  };
})(window);
