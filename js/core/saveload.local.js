(function (window) {
  'use strict';
  var App = window.App || (window.App = {});
  App.local = App.local || {};

  var BACKUP_TYPE = 'LoanSharkBackup';
  var BACKUP_FORMAT_VERSION = 1;
  var PRE_RESTORE_STORAGE_KEY = 'loanshark_pre_restore_backup';
  var PRE_RESTORE_META_KEY = 'loanshark_pre_restore_backup_meta';

  function isObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function cloneJsonSafe(v) {
    try {
      return JSON.parse(JSON.stringify(v));
    } catch (e) {
      return v;
    }
  }

  function showToast(msg) {
    if (App && typeof App.showToast === 'function') {
      App.showToast(msg);
    }
  }

  function isReadOnlyViewer() {
    return !!(
      App.state &&
      App.state.cloud &&
      App.state.cloud.isShared &&
      App.state.cloud.isReadOnly &&
      App.state.cloud.viewerId &&
      App.state.cloud.targetUserId &&
      App.state.cloud.viewerId !== App.state.cloud.targetUserId
    );
  }

  function pad2(v) {
    v = Number(v) || 0;
    return v < 10 ? '0' + v : String(v);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatIsoForFilename(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (!(d instanceof Date) || isNaN(d.getTime())) d = new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '_' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
  }

  function formatIsoForDisplay(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (!(d instanceof Date) || isNaN(d.getTime())) return String(iso);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function getAppVersionHint() {
    if (App.meta && typeof App.meta.version === 'string' && App.meta.version.trim()) {
      return String(App.meta.version);
    }
    return 'unknown';
  }

  function getSnapshotDataRoot(snapshot) {
    if (snapshot && isObject(snapshot.data)) return snapshot.data;
    return null;
  }

  function countArray(list) {
    return Array.isArray(list) ? list.length : 0;
  }

  function computeSnapshotCounts(snapshot) {
    var dataRoot = getSnapshotDataRoot(snapshot) || {};
    return {
      debtors: countArray(dataRoot.debtors),
      loans: countArray(dataRoot.loans),
      claims: countArray(dataRoot.claims),
      schedules: countArray(dataRoot.schedules),
      cashLogs: countArray(dataRoot.cashLogs)
    };
  }

  function getSnapshotUiMeta(snapshot) {
    var ui = snapshot && isObject(snapshot.ui) ? snapshot.ui : {};
    var cal = isObject(ui.calendar) ? ui.calendar : {};
    var debtorPanel = isObject(ui.debtorPanel) ? ui.debtorPanel : {};
    return {
      activeTab: typeof ui.activeTab === 'string' ? ui.activeTab : null,
      calendarView: typeof cal.view === 'string' ? cal.view : null,
      calendarCurrentDate: typeof cal.currentDate === 'string' ? cal.currentDate : null,
      selectedDebtorId: (typeof debtorPanel.selectedDebtorId === 'undefined') ? null : debtorPanel.selectedDebtorId
    };
  }

  function buildCloudSnapshotFallback() {
    var state = App.state || {};
    var ui = isObject(state.ui) ? state.ui : {};
    var calendar = isObject(ui.calendar) ? ui.calendar : {};
    var debtorPanel = isObject(ui.debtorPanel) ? ui.debtorPanel : {};
    var schedulesSnapshot = [];

    if (App.schedulesEngine && typeof App.schedulesEngine.toSnapshot === 'function') {
      schedulesSnapshot = App.schedulesEngine.toSnapshot() || [];
    } else if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      schedulesSnapshot = App.schedulesEngine.getAll() || [];
    }

    var debtors = Array.isArray(state.debtors) ? state.debtors : [];
    if (App.util && typeof App.util.sanitizeDebtorArray === 'function') {
      debtors = App.util.sanitizeDebtorArray(debtors);
    }

    return {
      version: 1,
      savedAt: nowIso(),
      appVersion: getAppVersionHint(),
      ui: {
        activeTab: typeof ui.activeTab === 'string' ? ui.activeTab : 'calendar',
        calendar: {
          view: typeof calendar.view === 'string' ? calendar.view : (App.getDefaultCalendarView ? App.getDefaultCalendarView() : 'week'),
          sortMode: typeof calendar.sortMode === 'string' ? calendar.sortMode : 'type',
          currentDate: typeof calendar.currentDate === 'string' ? calendar.currentDate : nowIso().slice(0, 10)
        },
        debtorPanel: {
          mode: typeof debtorPanel.mode === 'string' ? debtorPanel.mode : 'list',
          page: typeof debtorPanel.page === 'number' ? debtorPanel.page : 1,
          searchQuery: typeof debtorPanel.searchQuery === 'string' ? debtorPanel.searchQuery : '',
          selectedDebtorId: (typeof debtorPanel.selectedDebtorId === 'undefined') ? null : debtorPanel.selectedDebtorId
        }
      },
      data: {
        debtors: cloneJsonSafe(debtors),
        loans: cloneJsonSafe(Array.isArray(state.loans) ? state.loans : []),
        claims: cloneJsonSafe(Array.isArray(state.claims) ? state.claims : []),
        schedules: cloneJsonSafe(schedulesSnapshot),
        cashLogs: cloneJsonSafe(Array.isArray(state.cashLogs) ? state.cashLogs : []),
        riskSettings: (typeof App.riskSettings !== 'undefined') ? cloneJsonSafe(App.riskSettings) : null
      },
      meta: cloneJsonSafe(isObject(state.meta) ? state.meta : {})
    };
  }

  function prepareSaveState() {
    if (App.stateIO && typeof App.stateIO.ensureMeta === 'function') {
      App.stateIO.ensureMeta();
    }

    if (App.util && typeof App.util.repairLoanClaimDisplayIds === 'function') {
      App.util.repairLoanClaimDisplayIds();
    }

    if (App.util && typeof App.util.ensureLoanClaimDisplayIds === 'function') {
      App.util.ensureLoanClaimDisplayIds();
    }
  }

  function buildSnapshot() {
    prepareSaveState();

    if (App.cloudState && typeof App.cloudState.build === 'function') {
      try {
        return App.cloudState.build();
      } catch (e) {
        console.warn('[Local Backup] App.cloudState.build failed. Falling back to local snapshot builder.', e);
      }
    }

    return buildCloudSnapshotFallback();
  }

  function buildBackupEnvelope(snapshot, source) {
    var counts = computeSnapshotCounts(snapshot);
    var uiMeta = getSnapshotUiMeta(snapshot);
    return {
      backupType: BACKUP_TYPE,
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      savedAt: snapshot && snapshot.savedAt ? snapshot.savedAt : nowIso(),
      appVersion: snapshot && snapshot.appVersion ? snapshot.appVersion : getAppVersionHint(),
      source: source || 'local-save',
      meta: {
        counts: counts,
        ui: uiMeta
      },
      snapshot: cloneJsonSafe(snapshot)
    };
  }

  function looksLikeSnapshot(obj) {
    return !!(obj && (obj.version === 1 || obj.version === '1') && isObject(obj.data));
  }

  function looksLikeLegacyLocalPayload(obj) {
    return !!(isObject(obj) && (Array.isArray(obj.debtors) || Array.isArray(obj.loans) || Array.isArray(obj.claims) || Array.isArray(obj.schedules) || Array.isArray(obj.cashLogs)));
  }

  function coerceLegacyLocalPayloadToSnapshot(obj) {
    obj = isObject(obj) ? obj : {};
    var snapshot = {
      version: 1,
      savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : nowIso(),
      appVersion: typeof obj.appVersion === 'string' ? obj.appVersion : getAppVersionHint(),
      ui: isObject(obj.ui) ? cloneJsonSafe(obj.ui) : {},
      data: {
        debtors: cloneJsonSafe(Array.isArray(obj.debtors) ? obj.debtors : []),
        loans: cloneJsonSafe(Array.isArray(obj.loans) ? obj.loans : []),
        claims: cloneJsonSafe(Array.isArray(obj.claims) ? obj.claims : []),
        schedules: cloneJsonSafe(Array.isArray(obj.schedules) ? obj.schedules : []),
        cashLogs: cloneJsonSafe(Array.isArray(obj.cashLogs) ? obj.cashLogs : []),
        riskSettings: Object.prototype.hasOwnProperty.call(obj, 'riskSettings') ? cloneJsonSafe(obj.riskSettings) : null
      }
    };

    if (isObject(obj.meta)) {
      snapshot.meta = cloneJsonSafe(obj.meta);
    }

    return snapshot;
  }

  function validateSnapshot(snapshot, opts) {
    opts = opts || {};

    if (App.cloudState && typeof App.cloudState.validateSnapshot === 'function') {
      return App.cloudState.validateSnapshot(snapshot, opts);
    }

    var counts = computeSnapshotCounts(snapshot);
    var total = (counts.debtors || 0) + (counts.loans || 0) + (counts.claims || 0) + (counts.schedules || 0) + (counts.cashLogs || 0);
    if (opts.rejectEmptyData && total <= 0) {
      return {
        ok: false,
        reason: 'empty_data',
        counts: counts,
        dataRoot: getSnapshotDataRoot(snapshot)
      };
    }

    return {
      ok: true,
      reason: '',
      counts: counts,
      dataRoot: getSnapshotDataRoot(snapshot)
    };
  }

  function getRestoreRejectMessage(normalized) {
    var reason = normalized && normalized.reason ? normalized.reason : '';
    var validation = normalized && normalized.validation ? normalized.validation : null;
    var validationReason = validation && validation.reason ? validation.reason : '';
    var effectiveReason = validationReason || reason;

    if (effectiveReason === 'empty_data') {
      return 'Backup Restore 차단 — 형식은 맞지만 복원 가능한 데이터가 비어 있습니다.';
    }

    return 'Backup Restore 차단 — 비정상 백업 파일입니다.';
  }

  function normalizeBackupObject(obj) {
    var envelope = null;
    var snapshot = null;
    var source = 'import';

    if (isObject(obj) && obj.backupType === BACKUP_TYPE && obj.snapshot && isObject(obj.snapshot)) {
      envelope = cloneJsonSafe(obj);
      snapshot = envelope.snapshot;
      source = envelope.source || 'envelope';
    } else if (looksLikeSnapshot(obj)) {
      snapshot = cloneJsonSafe(obj);
      source = 'snapshot';
    } else if (looksLikeLegacyLocalPayload(obj)) {
      snapshot = coerceLegacyLocalPayloadToSnapshot(obj);
      source = 'legacy-local-payload';
    }

    if (!snapshot) {
      return { ok: false, reason: 'backup_shape_invalid' };
    }

    var validation = validateSnapshot(snapshot, { rejectEmptyData: true });
    if (!validation || !validation.ok) {
      return {
        ok: false,
        reason: validation && validation.reason ? validation.reason : 'backup_validation_failed',
        validation: validation || null
      };
    }

    if (!envelope) {
      envelope = buildBackupEnvelope(snapshot, source);
    } else {
      envelope.savedAt = envelope.savedAt || snapshot.savedAt || nowIso();
      envelope.appVersion = envelope.appVersion || snapshot.appVersion || getAppVersionHint();
      envelope.source = envelope.source || source;
      envelope.meta = isObject(envelope.meta) ? envelope.meta : {};
      envelope.meta.counts = validation.counts || computeSnapshotCounts(snapshot);
      envelope.meta.ui = envelope.meta.ui || getSnapshotUiMeta(snapshot);
    }

    return {
      ok: true,
      reason: '',
      envelope: envelope,
      snapshot: snapshot,
      validation: validation,
      counts: validation.counts || computeSnapshotCounts(snapshot)
    };
  }

  function buildRestoreMessage(envelope) {
    envelope = envelope || {};
    var meta = isObject(envelope.meta) ? envelope.meta : {};
    var counts = isObject(meta.counts) ? meta.counts : {};
    var ui = isObject(meta.ui) ? meta.ui : {};

    var lines = [];
    lines.push('백업 복원');
    lines.push('저장시각: ' + formatIsoForDisplay(envelope.savedAt));
    lines.push('앱버전: ' + (envelope.appVersion || '-'));
    lines.push('채무자: ' + (counts.debtors || 0));
    lines.push('대출: ' + (counts.loans || 0));
    lines.push('채권: ' + (counts.claims || 0));
    lines.push('스케줄: ' + (counts.schedules || 0));
    lines.push('자금로그: ' + (counts.cashLogs || 0));
    lines.push('탭: ' + (ui.activeTab || '-'));
    lines.push('캘린더: ' + ((ui.calendarView || '-') + ' / ' + (ui.calendarCurrentDate || '-')));
    lines.push('선택 채무자: ' + ((ui.selectedDebtorId == null || ui.selectedDebtorId === '') ? '-' : String(ui.selectedDebtorId)));
    lines.push('');
    lines.push('현재 상태는 임시백업 후, 백업 파일의 UI 상태까지 함께 복원합니다.');
    lines.push('이 백업으로 현재 데이터를 덮어쓸까요?');
    return lines.join('\n');
  }

  function persistPreRestoreBackup() {
    try {
      if (!window.localStorage) return;
      var snapshot = buildSnapshot();
      var envelope = buildBackupEnvelope(snapshot, 'pre-restore-auto');
      window.localStorage.setItem(PRE_RESTORE_STORAGE_KEY, JSON.stringify(envelope));
      window.localStorage.setItem(PRE_RESTORE_META_KEY, JSON.stringify({
        savedAt: envelope.savedAt,
        appVersion: envelope.appVersion,
        counts: envelope.meta && envelope.meta.counts ? envelope.meta.counts : computeSnapshotCounts(snapshot)
      }));
    } catch (e) {
      console.warn('[Local Restore] Failed to persist pre-restore backup:', e);
    }
  }

  function applyNormalizedBackup(normalized, opts) {
    opts = opts || {};
    if (!normalized || !normalized.ok || !normalized.snapshot) {
      return false;
    }

    var skipConfirm = !!opts.skipConfirm;
    if (!skipConfirm && typeof window.confirm === 'function') {
      if (!window.confirm(buildRestoreMessage(normalized.envelope))) {
        return false;
      }
    }

    persistPreRestoreBackup();

    if (App.stateIO && typeof App.stateIO.applySnapshot === 'function') {
      App.stateIO.applySnapshot(normalized.snapshot, { keepUI: false });
    } else {
      console.warn('[Local Restore] App.stateIO.applySnapshot is not available.');
      return false;
    }

    return true;
  }

  App.local.buildBackupEnvelope = function () {
    return buildBackupEnvelope(buildSnapshot(), 'manual-export');
  };

  App.local.validateBackupObject = function (obj) {
    return normalizeBackupObject(obj);
  };

  App.local.restoreObject = function (obj, opts) {
    var normalized = normalizeBackupObject(obj);
    if (!normalized.ok) {
      return normalized;
    }
    normalized.applied = applyNormalizedBackup(normalized, opts || {});
    return normalized;
  };

  App.local.getLastPreRestoreBackupInfo = function () {
    try {
      if (!window.localStorage) return null;
      var raw = window.localStorage.getItem(PRE_RESTORE_META_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  App.local.restoreLastPreRestoreBackup = function (opts) {
    try {
      if (!window.localStorage) return false;
      var raw = window.localStorage.getItem(PRE_RESTORE_STORAGE_KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      var result = App.local.restoreObject(parsed, opts || {});
      return !!(result && result.ok && result.applied);
    } catch (e) {
      console.warn('[Local Restore] Failed to restore pre-restore backup:', e);
      return false;
    }
  };

  App.local.save = function () {
    try {
      if (isReadOnlyViewer()) {
        console.warn('[Local Backup] Read-only viewer account. Save is blocked.');
        showToast('읽기 전용 계정입니다 — Local 저장 불가');
        return;
      }

      var snapshot = buildSnapshot();
      var envelope = buildBackupEnvelope(snapshot, 'local-save');
      var counts = envelope.meta && envelope.meta.counts ? envelope.meta.counts : computeSnapshotCounts(snapshot);
      var data = JSON.stringify(envelope, null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'LoanShark_backup_' + formatIsoForFilename(envelope.savedAt) + '.json';
      a.click();
      setTimeout(function () {
        try { URL.revokeObjectURL(url); } catch (e) {}
      }, 0);
      console.log('[Local Backup] Success');
      showToast('Backup Save 완료 — 채무자 ' + (counts.debtors || 0) + ' / 대출 ' + (counts.loans || 0) + ' / 채권 ' + (counts.claims || 0));
    } catch (err) {
      console.error('[Local Backup] Failed:', err);
      showToast('오류 발생 — 다시 시도해주세요.');
    }
  };

  App.local.load = async function (file) {
    try {
      if (isReadOnlyViewer()) {
        console.warn('[Local Restore] Read-only viewer account. Load is blocked.');
        showToast('읽기 전용 계정입니다 — Local 불러오기 불가');
        return false;
      }

      var text = await file.text();
      var parsed = JSON.parse(text);
      var normalized = normalizeBackupObject(parsed);

      if (!normalized.ok) {
        console.warn('[Local Restore] Backup rejected:', normalized.reason, normalized.validation || null);
        showToast(getRestoreRejectMessage(normalized));
        return false;
      }

      var applied = applyNormalizedBackup(normalized, { skipConfirm: false });
      if (!applied) {
        return false;
      }

      console.log('[Local Restore] Success');
      showToast('Backup Restore 완료 — 저장된 상태와 UI를 복원했습니다.');
      return true;
    } catch (err) {
      console.error('[Local Restore] Failed:', err);
      showToast('오류 발생 — 다시 시도해주세요.');
      return false;
    }
  };
})(window);
