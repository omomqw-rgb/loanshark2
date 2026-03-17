(function (window) {
  'use strict';

  var App = window.App || (window.App = {});

  function isObject(v) {
    return v && typeof v === 'object';
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

  function cloneDeep(value) {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      var arr = [];
      for (var i = 0; i < value.length; i++) {
        arr.push(cloneDeep(value[i]));
      }
      return arr;
    }
    var out = {};
    var keys = Object.keys(value);
    for (var j = 0; j < keys.length; j++) {
      out[keys[j]] = cloneDeep(value[keys[j]]);
    }
    return out;
  }

  function runShadowQA(source) {
    source = source || 'unknown';

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

  App.cloudState.build = function () {
    if (!App.stateIO || typeof App.stateIO.buildSnapshotEnvelope !== 'function') {
      throw new Error('StateIO snapshot builder is not available.');
    }
    return App.stateIO.buildSnapshotEnvelope({ source: 'cloud' });
  };

  App.cloudState.buildComparablePayload = function (snapshot) {
    var base = snapshot;
    if (!base) {
      base = App.cloudState.build();
    }
    if (!base || !isObject(base)) {
      return { data: {}, meta: {} };
    }
    return {
      data: cloneDeep(isObject(base.data) ? base.data : {}),
      meta: cloneDeep(isObject(base.meta) ? base.meta : {})
    };
  };

  App.cloudState.validateSnapshot = function (snapshot, opts) {
    if (App.stateIO && typeof App.stateIO.validateSnapshot === 'function') {
      return App.stateIO.validateSnapshot(snapshot, opts);
    }
    return { ok: false, reason: 'stateio_unavailable' };
  };

  function shouldPersistPreCloudLoadBackup() {
    return !!(App.config && App.config.enablePreCloudLoadBackup === true);
  }

  function savePreCloudLoadBackup() {
    if (!shouldPersistPreCloudLoadBackup()) return;
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

  App.cloudState.apply = function (snapshot, opts) {
    opts = opts || {};

    if (!App.stateIO || typeof App.stateIO.validateSnapshot !== 'function' || typeof App.stateIO.applySnapshot !== 'function') {
      console.error('[CloudState] StateIO snapshot pipeline is not available.');
      return false;
    }

    var validation = App.stateIO.validateSnapshot(snapshot, opts);
    if (!validation.ok) {
      console.warn('[CloudState] Snapshot rejected:', validation.reason, validation.counts || {}, validation.integrity || {});
      return false;
    }

    savePreCloudLoadBackup();

    var appliedInputFormat = validation.inputFormat || 'snapshot-v1';
    var appliedOriginalInputFormat = validation.originalInputFormat || appliedInputFormat;
    console.info('[CloudState] Applying snapshot with uiPolicy=preserve reason=load:cloud inputFormat=' + appliedInputFormat + ' originalInputFormat=' + appliedOriginalInputFormat);
    var applied = App.stateIO.applySnapshot(validation.snapshot, {
      uiPolicy: 'preserve',
      reason: 'load:cloud',
      sourceType: 'cloud',
      inputFormat: appliedInputFormat,
      originalInputFormat: appliedOriginalInputFormat
    });

    if (!applied) {
      console.error('[CloudState] Snapshot apply failed.');
      return false;
    }

    runShadowQA('cloudState.apply');
    return true;
  };

  App.cloudState.runShadowQA = function () {
    return runShadowQA('manual');
  };
})(window);
