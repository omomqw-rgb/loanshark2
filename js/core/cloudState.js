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
    } else {
      schedules = (App.state && App.state.schedules) || [];
    }

    var engineListRef = (App.schedulesEngine && App.schedulesEngine.list) || null;
    var stateSchedulesRef = (App.state && App.state.schedules) || null;
    var dataSchedulesRef = (App.data && App.data.schedules) || null;

    var aliasConsistency = {
      engineHasList: !!engineListRef,
      stateAlias: !!(engineListRef && stateSchedulesRef === engineListRef),
      dataAlias: !!(engineListRef && dataSchedulesRef === engineListRef)
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
      aliasConsistency: aliasConsistency,
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
    var snapshotData = {
      debtors: cloneArray(Array.isArray(stateData.debtors) ? stateData.debtors : []),
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
          view: calendar.view || 'month',
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

  // Supabase에서 가져온 스냅샷을 앱에 반영하는 함수
  App.cloudState.apply = function (snapshot) {
    var version = snapshot && snapshot.version;
    var isV1 = (version === 1 || version === '1');

    if (!snapshot || !isV1) {
      console.warn('[CloudState] Unsupported or missing snapshot. Resetting to empty state.');

      if (App.stateIO && typeof App.stateIO.applySnapshot === 'function') {
        App.stateIO.applySnapshot({
          debtors: [],
          loans: [],
          claims: [],
          cashLogs: [],
          schedules: [],
          riskSettings: null
        }, { keepUI: true });
      }

      return;
    }

    // Stage 5: Single pipeline (stateIO → commitAll). No direct state swapping or render calls.
    if (App.stateIO && typeof App.stateIO.applySnapshot === 'function') {
      App.stateIO.applySnapshot(snapshot, { keepUI: true });
    } else {
      console.error('[CloudState] App.stateIO.applySnapshot is not available.');
      return;
    }

    // ShadowQA: Cloud Load 이후 Loan ↔ Schedule 매핑 무결성 체크 (콘솔 경고/리포트 저장)
    runShadowQA('cloudState.apply');
  };;

  // Manual QA hook (optional)
  App.cloudState.runShadowQA = function () {
    return runShadowQA('manual');
  };
})(window);
