(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  var snapshotStatus = App.snapshotStatus || (App.snapshotStatus = {});
  var snapshotsApi = App.snapshots || (App.snapshots = {});

  var statusState = {
    baselineHash: '',
    dirty: false,
    currentMeta: {
      label: 'none',
      createdAt: null,
      sourceType: 'none',
      snapshotId: null,
      appVersion: null,
      ownerId: null,
      note: null,
      legacy: false,
      isImported: false
    },
    pendingCheck: false,
    modalEl: null,
    modalEscHandler: null,
    apiWrapped: false,
    initialized: false
  };

  function queueMicrotaskCompat(fn) {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(fn);
      return;
    }
    if (typeof Promise !== 'undefined' && Promise && typeof Promise.resolve === 'function') {
      Promise.resolve().then(fn);
      return;
    }
    setTimeout(fn, 0);
  }

  function isObject(value) {
    return value && typeof value === 'object';
  }

  function pad2(v) {
    v = Number(v) || 0;
    return v < 10 ? '0' + v : String(v);
  }

  function formatSnapshotTimestamp(value) {
    if (!value) return 'none';
    var date = value instanceof Date ? value : new Date(value);
    if (!date || isNaN(date.getTime())) return 'none';
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) + ' ' + pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  }

  function deepSort(value) {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      var arr = [];
      for (var i = 0; i < value.length; i++) {
        arr.push(deepSort(value[i]));
      }
      return arr;
    }
    var out = {};
    var keys = Object.keys(value).sort();
    for (var j = 0; j < keys.length; j++) {
      out[keys[j]] = deepSort(value[keys[j]]);
    }
    return out;
  }

  function stableHash(value) {
    try {
      return JSON.stringify(deepSort(value || {}));
    } catch (e) {
      return '__snapshot_hash_error__';
    }
  }

  function buildComparableFromSnapshot(snapshot) {
    if (App.cloudState && typeof App.cloudState.buildComparablePayload === 'function') {
      return App.cloudState.buildComparablePayload(snapshot);
    }
    return {
      data: isObject(snapshot) && isObject(snapshot.data) ? snapshot.data : {},
      meta: isObject(snapshot) && isObject(snapshot.meta) ? snapshot.meta : {}
    };
  }

  function buildComparableFromCurrentState() {
    if (App.cloudState && typeof App.cloudState.buildComparablePayload === 'function') {
      return App.cloudState.buildComparablePayload();
    }
    return { data: {}, meta: {} };
  }

  function normalizeMeta(meta) {
    meta = isObject(meta) ? meta : {};
    return {
      label: (typeof meta.label === 'string' && meta.label) ? meta.label : '',
      createdAt: meta.createdAt || null,
      sourceType: (typeof meta.sourceType === 'string' && meta.sourceType) ? meta.sourceType : 'cloud',
      snapshotId: meta.snapshotId || null,
      appVersion: meta.appVersion || null,
      ownerId: meta.ownerId || null,
      note: meta.note || null,
      legacy: !!meta.legacy,
      isImported: !!meta.isImported
    };
  }

  function getLabelText(meta) {
    meta = normalizeMeta(meta);
    if (meta.label) return meta.label;
    if (meta.isImported) return 'Imported JSON';
    if (meta.createdAt) return formatSnapshotTimestamp(meta.createdAt);
    return 'none';
  }

  function getStatusHost() {
    return document.getElementById('snapshot-status-host');
  }

  function clearNode(node) {
    if (!node) return;
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function renderStatus() {
    var host = getStatusHost();
    if (!host) return;

    clearNode(host);

    var labelEl = document.createElement('span');
    labelEl.className = 'snapshot-status__label';
    labelEl.textContent = 'Snapshot · ' + getLabelText(statusState.currentMeta);
    host.appendChild(labelEl);

    if (statusState.dirty) {
      var dirtyEl = document.createElement('span');
      dirtyEl.className = 'snapshot-status__dirty';
      dirtyEl.textContent = 'Unsaved changes';
      host.appendChild(dirtyEl);
    }

    host.title = labelEl.textContent + (statusState.dirty ? ' | Unsaved changes' : '');
  }

  function syncCloudAccessState(accessInfo, viewerId) {
    accessInfo = accessInfo || {};
    if (!App.state) App.state = {};
    App.state.cloud = App.state.cloud || {};
    App.state.cloud.targetUserId = accessInfo.targetUserId || viewerId || null;
    App.state.cloud.viewerId = viewerId || null;
    App.state.cloud.ownerId = accessInfo.ownerId || viewerId || null;
    App.state.cloud.role = accessInfo.role || 'owner';
    App.state.cloud.isShared = !!accessInfo.isShared;
    App.state.cloud.isReadOnly = !!accessInfo.isReadOnly;
    try {
      var isViewer = !!(App.state.cloud.isShared && App.state.cloud.isReadOnly && App.state.cloud.viewerId && App.state.cloud.targetUserId && App.state.cloud.viewerId !== App.state.cloud.targetUserId);
      document.documentElement.classList.toggle('ls-viewer', isViewer);
    } catch (e) {}
  }

  async function getCloudShareInfo(supa, viewerId) {
    if (!supa || !viewerId) {
      return { targetUserId: null, ownerId: null, viewerId: viewerId || null, role: null, isShared: false, isReadOnly: false };
    }

    var info = { targetUserId: viewerId, ownerId: viewerId, viewerId: viewerId, role: 'owner', isShared: false, isReadOnly: false };

    try {
      var res = await supa
        .from('state_shares')
        .select('owner_id, role, created_at')
        .eq('viewer_id', viewerId)
        .order('created_at', { ascending: false })
        .limit(1);

      var err = res && res.error ? res.error : null;
      if (err) {
        return info;
      }

      var rows = (res && res.data) || [];
      if (!rows.length) {
        return info;
      }

      var row = rows[0] || null;
      var ownerId = row && row.owner_id ? row.owner_id : null;
      var role = row && row.role ? row.role : 'read';

      if (ownerId && ownerId !== viewerId) {
        info.targetUserId = ownerId;
        info.ownerId = ownerId;
        info.role = role;
        info.isShared = true;
        info.isReadOnly = (role === 'read');
      }

      return info;
    } catch (e) {
      return info;
    }
  }

  function getSupabase() {
    if (!App.supabase) {
      console.warn('[Snapshots] App.supabase is not initialized.');
      return null;
    }
    return App.supabase;
  }

  async function resolveCloudAccess(opts) {
    opts = opts || {};
    var supa = getSupabase();
    var viewerId = App.user && App.user.id ? App.user.id : null;
    if (!supa) {
      return { ok: false, reason: 'supabase_unavailable', supa: null, viewerId: viewerId, accessInfo: null };
    }
    if (!viewerId) {
      if (!opts.silentAuthError && typeof App.showToast === 'function') {
        App.showToast('Cloud 저장/불러오기는 로그인 후 사용 가능합니다.');
      }
      return { ok: false, reason: 'auth_required', supa: supa, viewerId: null, accessInfo: null };
    }

    var accessInfo = await getCloudShareInfo(supa, viewerId);
    syncCloudAccessState(accessInfo, viewerId);
    return { ok: true, supa: supa, viewerId: viewerId, accessInfo: accessInfo };
  }

  function isReadOnlyViewer(accessInfo, viewerId) {
    return !!(accessInfo && accessInfo.isShared && accessInfo.isReadOnly && accessInfo.targetUserId && viewerId && accessInfo.targetUserId !== viewerId);
  }

  function ensureCloudStateModuleLoaded() {
    if (App.cloudState && typeof App.cloudState.build === 'function' && typeof App.cloudState.apply === 'function') {
      return;
    }
    if (typeof document === 'undefined') return;

    var scriptId = 'app-cloudstate-script';
    var existing = document.getElementById(scriptId);
    if (existing) return;

    try {
      var script = document.createElement('script');
      script.id = scriptId;
      script.src = 'js/core/cloudState.js';
      script.async = true;
      var head = document.head || document.getElementsByTagName('head')[0];
      if (head) {
        head.appendChild(script);
      } else if (document.body) {
        document.body.appendChild(script);
      }
    } catch (e) {
      console.warn('[Snapshots] Failed to inject CloudState module script:', e);
    }
  }

  function markCleanFromSnapshot(meta, snapshot) {
    statusState.currentMeta = normalizeMeta(meta);
    statusState.baselineHash = stableHash(buildComparableFromSnapshot(snapshot));
    statusState.dirty = false;
    renderStatus();
  }

  function markCleanFromCurrent(meta) {
    statusState.currentMeta = normalizeMeta(meta);
    statusState.baselineHash = stableHash(buildComparableFromCurrentState());
    statusState.dirty = false;
    renderStatus();
  }

  function clearStatus() {
    statusState.currentMeta = normalizeMeta({ label: 'none', sourceType: 'none' });
    statusState.baselineHash = stableHash(buildComparableFromCurrentState());
    statusState.dirty = false;
    renderStatus();
  }

  function runDirtyCheck() {
    var currentHash = stableHash(buildComparableFromCurrentState());
    var nextDirty = currentHash !== statusState.baselineHash;
    if (statusState.dirty !== nextDirty) {
      statusState.dirty = nextDirty;
      renderStatus();
    }
  }

  function scheduleDirtyCheck() {
    if (statusState.pendingCheck) return;
    statusState.pendingCheck = true;
    queueMicrotaskCompat(function () {
      statusState.pendingCheck = false;
      runDirtyCheck();
    });
  }

  function wrapCommitApis() {
    if (statusState.apiWrapped) return;
    statusState.apiWrapped = true;

    function wrapMethod(obj, key) {
      if (!obj || typeof obj[key] !== 'function' || obj[key]._snapshotWrapped) return;
      var original = obj[key];
      var wrapped = function () {
        var result = original.apply(this, arguments);
        scheduleDirtyCheck();
        return result;
      };
      wrapped._snapshotWrapped = true;
      wrapped._snapshotOriginal = original;
      obj[key] = wrapped;
    }

    if (App.api) {
      wrapMethod(App.api, 'commit');
      wrapMethod(App.api, 'commitAll');
      if (App.api.domain) wrapMethod(App.api.domain, 'commit');
      if (App.api.view) wrapMethod(App.api.view, 'invalidate');
    }
  }

  function validateAndApplySnapshot(snapshot, opts) {
    opts = opts || {};
    ensureCloudStateModuleLoaded();

    if (!App.cloudState || typeof App.cloudState.apply !== 'function' || typeof App.cloudState.validateSnapshot !== 'function') {
      console.error('[Snapshots] CloudState module is not available.');
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return { ok: false, reason: 'cloudstate_unavailable' };
    }

    var validation = App.cloudState.validateSnapshot(snapshot, { rejectEmptyData: true });
    if (!validation.ok) {
      console.warn('[Snapshots] Snapshot rejected before apply:', validation.reason, validation.counts || {});
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('Snapshot Load 차단 — 비정상 또는 빈 스냅샷입니다.');
      }
      return { ok: false, reason: validation.reason };
    }

    var applied = App.cloudState.apply(snapshot, { rejectEmptyData: true });
    if (!applied) {
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('Snapshot Load 차단 — 비정상 스냅샷입니다.');
      }
      return { ok: false, reason: 'apply_failed' };
    }

    return { ok: true, snapshot: snapshot };
  }

  function applyEmptyStateBaseline(opts) {
    opts = opts || {};
    if (opts.resetData !== false && App.stateIO && typeof App.stateIO.resetDataKeepUI === 'function') {
      App.stateIO.resetDataKeepUI({ reason: 'load:cloudEmpty', sourceType: 'cloud' });
    }
    markCleanFromCurrent({ label: 'none', sourceType: 'none' });
  }

  function buildSnapshotMetaFromRow(row, sourceType) {
    sourceType = sourceType || 'cloud';
    return {
      label: row && row.label ? row.label : '',
      createdAt: row && (row.created_at || row.updated_at || row.createdAt) ? (row.created_at || row.updated_at || row.createdAt) : null,
      sourceType: sourceType,
      snapshotId: row && row.id ? row.id : null,
      appVersion: row && row.app_version ? row.app_version : null,
      ownerId: row && row.owner_id ? row.owner_id : null,
      note: row && row.note ? row.note : null,
      legacy: sourceType === 'legacy',
      isImported: sourceType === 'json'
    };
  }

  async function tryLoadLegacyLatest(supa, targetUserId, opts) {
    opts = opts || {};
    var legacyResult = await supa
      .from('app_states')
      .select('user_id, updated_at, state_json')
      .eq('user_id', targetUserId)
      .order('updated_at', { ascending: false })
      .limit(1);

    var legacyError = legacyResult && legacyResult.error ? legacyResult.error : null;
    if (legacyError) {
      console.warn('[Snapshots] Legacy app_states fallback failed:', legacyError);
      return { ok: false, reason: 'legacy_query_failed', error: legacyError };
    }

    var rows = (legacyResult && legacyResult.data) || [];
    if (!rows.length || !rows[0] || !rows[0].state_json) {
      return { ok: false, reason: 'empty' };
    }

    var applyResult = validateAndApplySnapshot(rows[0].state_json, { silentError: !!opts.silentError });
    if (!applyResult.ok) {
      return applyResult;
    }

    markCleanFromSnapshot(buildSnapshotMetaFromRow(rows[0], 'legacy'), rows[0].state_json);
    return { ok: true, source: 'legacy', row: rows[0] };
  }

  async function loadLatestSnapshotFromSupabase(opts) {
    opts = opts || {};
    var access = await resolveCloudAccess({ silentAuthError: !!opts.silentAuthError });
    if (!access.ok) return false;

    var supa = access.supa;
    var targetUserId = access.accessInfo && access.accessInfo.targetUserId ? access.accessInfo.targetUserId : access.viewerId;

    try {
      var result = await supa
        .from('app_snapshots')
        .select('id, owner_id, created_at, app_version, note, state_json')
        .eq('owner_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(1);

      var error = result && result.error ? result.error : null;
      if (error) {
        console.error('[Snapshots] Failed to load latest snapshot:', error);
        if (!opts.silentError && typeof App.showToast === 'function') {
          App.showToast('오류 발생 — 다시 시도해주세요.');
        }
        return false;
      }

      var rows = (result && result.data) || [];
      if (rows.length && rows[0] && rows[0].state_json) {
        var applyResult = validateAndApplySnapshot(rows[0].state_json, { silentError: !!opts.silentError });
        if (!applyResult.ok) return false;
        markCleanFromSnapshot(buildSnapshotMetaFromRow(rows[0], 'cloud'), rows[0].state_json);
        if (!opts.silentSuccess && typeof App.showToast === 'function') {
          App.showToast('Snapshot Load 완료 — 최신 저장본을 반영했습니다.');
        }
        return true;
      }

      var legacy = await tryLoadLegacyLatest(supa, targetUserId, { silentError: !!opts.silentError });
      if (legacy.ok) {
        if (!opts.silentSuccess && typeof App.showToast === 'function') {
          App.showToast('Legacy Snapshot Load 완료 — 기존 저장본을 반영했습니다.');
        }
        return true;
      }

      if (opts.resetOnEmpty !== false) {
        applyEmptyStateBaseline({ resetData: true });
      } else {
        markCleanFromCurrent({ label: 'none', sourceType: 'none' });
      }
      if (!opts.silentNoData && typeof App.showToast === 'function') {
        App.showToast('Load — 저장된 snapshot이 없습니다.');
      }
      return false;
    } catch (err) {
      console.error('[Snapshots] Unexpected latest snapshot load error:', err);
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return false;
    }
  }

  async function saveSnapshotToSupabase(opts) {
    opts = opts || {};
    var access = await resolveCloudAccess({ silentAuthError: false });
    if (!access.ok) return false;

    if (isReadOnlyViewer(access.accessInfo, access.viewerId)) {
      console.warn('[Snapshots] Save blocked for read-only viewer account.');
      if (typeof App.showToast === 'function') {
        App.showToast('읽기 전용 계정입니다 — Save 불가');
      }
      return false;
    }

    ensureCloudStateModuleLoaded();
    if (!App.cloudState || typeof App.cloudState.build !== 'function') {
      console.error('[Snapshots] CloudState module is not available.');
      if (typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return false;
    }

    if (App.util && typeof App.util.repairLoanClaimDisplayIds === 'function') {
      App.util.repairLoanClaimDisplayIds();
    }
    if (App.util && typeof App.util.ensureLoanClaimDisplayIds === 'function') {
      App.util.ensureLoanClaimDisplayIds();
    }

    var snapshot;
    try {
      snapshot = App.cloudState.build();
    } catch (e) {
      console.error('[Snapshots] Failed to build snapshot:', e);
      if (typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return false;
    }

    try {
      var insertResult = await access.supa
        .from('app_snapshots')
        .insert({
          owner_id: access.viewerId,
          app_version: snapshot && snapshot.appVersion ? snapshot.appVersion : null,
          note: null,
          state_json: snapshot
        })
        .select('id, owner_id, created_at, app_version, note')
        .single();

      var error = insertResult && insertResult.error ? insertResult.error : null;
      if (error) {
        console.error('[Snapshots] Save failed:', error);
        if (typeof App.showToast === 'function') {
          App.showToast('오류 발생 — 다시 시도해주세요.');
        }
        return false;
      }

      var row = insertResult && insertResult.data ? insertResult.data : null;
      markCleanFromSnapshot(buildSnapshotMetaFromRow(row, 'cloud'), snapshot);
      if (typeof App.showToast === 'function') {
        App.showToast('Save 완료 — 새 snapshot이 생성되었습니다.');
      }
      return true;
    } catch (err) {
      console.error('[Snapshots] Unexpected save error:', err);
      if (typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return false;
    }
  }

  function classifyRows(rows) {
    var now = Date.now();
    var cutoff = now - (30 * 24 * 60 * 60 * 1000);
    var recent = [];
    var older = [];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var tsValue = row && (row.created_at || row.updated_at);
      var ts = tsValue ? new Date(tsValue).getTime() : 0;
      if (ts && ts >= cutoff) {
        recent.push(row);
      } else {
        older.push(row);
      }
    }

    return { recent: recent, older: older };
  }

  async function listSnapshotsFromSupabase(opts) {
    opts = opts || {};
    var access = await resolveCloudAccess({ silentAuthError: !!opts.silentAuthError });
    if (!access.ok) return null;

    var supa = access.supa;
    var targetUserId = access.accessInfo && access.accessInfo.targetUserId ? access.accessInfo.targetUserId : access.viewerId;

    try {
      var result = await supa
        .from('app_snapshots')
        .select('id, owner_id, created_at, app_version, note')
        .eq('owner_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(300);

      var error = result && result.error ? result.error : null;
      if (error) {
        console.error('[Snapshots] Failed to list snapshots:', error);
        if (!opts.silentError && typeof App.showToast === 'function') {
          App.showToast('오류 발생 — 다시 시도해주세요.');
        }
        return null;
      }

      var rows = (result && result.data) || [];
      var classified = classifyRows(rows);

      if (!rows.length) {
        var legacyResult = await supa
          .from('app_states')
          .select('user_id, updated_at')
          .eq('user_id', targetUserId)
          .order('updated_at', { ascending: false })
          .limit(1);
        var legacyError = legacyResult && legacyResult.error ? legacyResult.error : null;
        if (!legacyError) {
          var legacyRows = (legacyResult && legacyResult.data) || [];
          if (legacyRows.length && legacyRows[0]) {
            classified.recent.push({
              id: 'legacy-latest',
              owner_id: targetUserId,
              created_at: legacyRows[0].updated_at,
              app_version: null,
              note: 'Legacy app_states latest',
              _legacy: true
            });
          }
        }
      }

      return {
        access: access,
        recent: classified.recent,
        older: classified.older
      };
    } catch (err) {
      console.error('[Snapshots] Unexpected list error:', err);
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return null;
    }
  }

  async function loadSnapshotByIdFromSupabase(snapshotId, opts) {
    opts = opts || {};
    var access = await resolveCloudAccess({ silentAuthError: !!opts.silentAuthError });
    if (!access.ok) return false;

    var supa = access.supa;
    var targetUserId = access.accessInfo && access.accessInfo.targetUserId ? access.accessInfo.targetUserId : access.viewerId;

    if (snapshotId === 'legacy-latest') {
      var legacy = await tryLoadLegacyLatest(supa, targetUserId, { silentError: !!opts.silentError });
      if (legacy.ok && !opts.silentSuccess && typeof App.showToast === 'function') {
        App.showToast('Legacy Snapshot Load 완료 — 기존 저장본을 반영했습니다.');
      }
      return !!legacy.ok;
    }

    try {
      var result = await supa
        .from('app_snapshots')
        .select('id, owner_id, created_at, app_version, note, state_json')
        .eq('owner_id', targetUserId)
        .eq('id', snapshotId)
        .limit(1)
        .single();

      var error = result && result.error ? result.error : null;
      if (error) {
        console.error('[Snapshots] Failed to load snapshot by id:', error);
        if (!opts.silentError && typeof App.showToast === 'function') {
          App.showToast('오류 발생 — 다시 시도해주세요.');
        }
        return false;
      }

      var row = result && result.data ? result.data : null;
      if (!row || !row.state_json) {
        if (!opts.silentError && typeof App.showToast === 'function') {
          App.showToast('Load — 선택한 snapshot을 찾지 못했습니다.');
        }
        return false;
      }

      var applyResult = validateAndApplySnapshot(row.state_json, { silentError: !!opts.silentError });
      if (!applyResult.ok) return false;
      markCleanFromSnapshot(buildSnapshotMetaFromRow(row, 'cloud'), row.state_json);
      if (!opts.silentSuccess && typeof App.showToast === 'function') {
        App.showToast('Snapshot Load 완료 — 선택한 저장본을 반영했습니다.');
      }
      return true;
    } catch (err) {
      console.error('[Snapshots] Unexpected snapshot load error:', err);
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return false;
    }
  }

  async function deleteSnapshotsFromSupabase(ids, opts) {
    opts = opts || {};
    ids = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (!ids.length) return false;

    var access = await resolveCloudAccess({ silentAuthError: !!opts.silentAuthError });
    if (!access.ok) return false;
    if (isReadOnlyViewer(access.accessInfo, access.viewerId)) {
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('읽기 전용 계정입니다 — 삭제 불가');
      }
      return false;
    }

    try {
      var result = await access.supa
        .from('app_snapshots')
        .delete()
        .eq('owner_id', access.viewerId)
        .in('id', ids);

      var error = result && result.error ? result.error : null;
      if (error) {
        console.error('[Snapshots] Failed to delete snapshots:', error);
        if (!opts.silentError && typeof App.showToast === 'function') {
          App.showToast('오류 발생 — 다시 시도해주세요.');
        }
        return false;
      }

      if (!opts.silentSuccess && typeof App.showToast === 'function') {
        App.showToast('삭제 완료 — snapshot을 정리했습니다.');
      }
      return true;
    } catch (err) {
      console.error('[Snapshots] Unexpected delete error:', err);
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return false;
    }
  }

  async function deleteOldSnapshotsFromSupabase(opts) {
    opts = opts || {};
    var listing = await listSnapshotsFromSupabase({ silentError: !!opts.silentError });
    if (!listing) return false;
    var ids = [];
    for (var i = 0; i < listing.older.length; i++) {
      if (listing.older[i] && listing.older[i].id && !listing.older[i]._legacy) {
        ids.push(listing.older[i].id);
      }
    }
    if (!ids.length) {
      if (!opts.silentSuccess && typeof App.showToast === 'function') {
        App.showToast('삭제할 오래된 snapshot이 없습니다.');
      }
      return false;
    }
    return deleteSnapshotsFromSupabase(ids, opts);
  }

  function buildMetaLine(row) {
    var parts = [];
    if (row && row.app_version) parts.push(String(row.app_version));
    if (row && row.note) parts.push(String(row.note));
    if (row && row._legacy) parts.push('legacy fallback');
    return parts.join(' · ');
  }

  function createButton(text, className, onClick) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = text;
    if (typeof onClick === 'function') {
      btn.addEventListener('click', onClick);
    }
    return btn;
  }

  function createRow(row, allowDelete, onLoad, onDelete) {
    var rowEl = document.createElement('div');
    rowEl.className = 'snapshot-list-row';

    var body = document.createElement('div');
    body.className = 'snapshot-list-row__body';

    var title = document.createElement('div');
    title.className = 'snapshot-list-row__title';
    title.textContent = formatSnapshotTimestamp(row && (row.created_at || row.updated_at));
    body.appendChild(title);

    var metaText = buildMetaLine(row);
    if (metaText) {
      var meta = document.createElement('div');
      meta.className = 'snapshot-list-row__meta';
      meta.textContent = metaText;
      body.appendChild(meta);
    }

    var actions = document.createElement('div');
    actions.className = 'snapshot-list-row__actions';
    actions.appendChild(createButton('Load', 'snapshot-list-row__btn snapshot-list-row__btn--load', function () {
      onLoad(row);
    }));
    if (allowDelete && !row._legacy) {
      actions.appendChild(createButton('Delete', 'snapshot-list-row__btn snapshot-list-row__btn--delete', function () {
        onDelete(row);
      }));
    }

    rowEl.appendChild(body);
    rowEl.appendChild(actions);
    return rowEl;
  }

  function createSection(titleText, rows, allowDelete, onLoad, onDelete) {
    var section = document.createElement('section');
    section.className = 'snapshot-list-group';

    var title = document.createElement('h4');
    title.className = 'snapshot-list-group__title';
    title.textContent = titleText;
    section.appendChild(title);

    if (!rows.length) {
      var empty = document.createElement('div');
      empty.className = 'snapshot-list-empty';
      empty.textContent = '표시할 snapshot이 없습니다.';
      section.appendChild(empty);
      return section;
    }

    for (var i = 0; i < rows.length; i++) {
      section.appendChild(createRow(rows[i], allowDelete, onLoad, onDelete));
    }
    return section;
  }

  function createOlderDisclosure(rows, allowDelete, onLoad, onDelete, onDeleteOlderAll) {
    var section = document.createElement('section');
    section.className = 'snapshot-list-group';

    var details = document.createElement('details');
    details.className = 'snapshot-list-older';

    var summary = document.createElement('summary');
    summary.className = 'snapshot-list-older__summary';
    summary.textContent = 'Older snapshots (' + rows.length + ')';
    details.appendChild(summary);

    if (allowDelete && rows.length) {
      var toolbar = document.createElement('div');
      toolbar.className = 'snapshot-list-older__toolbar';
      toolbar.appendChild(createButton('Delete older snapshots', 'snapshot-list-row__btn snapshot-list-row__btn--delete', onDeleteOlderAll));
      details.appendChild(toolbar);
    }

    var content = document.createElement('div');
    content.className = 'snapshot-list-older__content';
    if (!rows.length) {
      var empty = document.createElement('div');
      empty.className = 'snapshot-list-empty';
      empty.textContent = '오래된 snapshot이 없습니다.';
      content.appendChild(empty);
    } else {
      for (var i = 0; i < rows.length; i++) {
        content.appendChild(createRow(rows[i], allowDelete, onLoad, onDelete));
      }
    }
    details.appendChild(content);
    section.appendChild(details);
    return section;
  }

  function closeLoadModal() {
    if (statusState.modalEscHandler) {
      document.removeEventListener('keydown', statusState.modalEscHandler, true);
      statusState.modalEscHandler = null;
    }
    if (statusState.modalEl && statusState.modalEl.parentNode) {
      statusState.modalEl.parentNode.removeChild(statusState.modalEl);
    }
    statusState.modalEl = null;
  }

  function renderLoadModalBody(dialog, listing) {
    var body = dialog.querySelector('.snapshot-modal__body');
    if (!body) return;
    clearNode(body);

    var accessInfo = listing && listing.access ? listing.access.accessInfo : null;
    var viewerId = listing && listing.access ? listing.access.viewerId : null;
    var allowDelete = !isReadOnlyViewer(accessInfo, viewerId) && !!viewerId;

    var recent = listing ? listing.recent : [];
    var older = listing ? listing.older : [];

    function handleLoad(row) {
      loadSnapshotByIdFromSupabase(row.id).then(function (ok) {
        if (ok) closeLoadModal();
      });
    }

    function handleDelete(row) {
      var ok = window.confirm('이 snapshot을 삭제할까요?');
      if (!ok) return;
      deleteSnapshotsFromSupabase([row.id]).then(function (deleted) {
        if (deleted) {
          listSnapshotsFromSupabase({ silentError: false }).then(function (nextListing) {
            if (nextListing) renderLoadModalBody(dialog, nextListing);
          });
        }
      });
    }

    function handleDeleteOlder() {
      var ok = window.confirm('30일보다 오래된 snapshot을 일괄 삭제할까요?');
      if (!ok) return;
      deleteOldSnapshotsFromSupabase({ silentError: false }).then(function (deleted) {
        if (deleted) {
          listSnapshotsFromSupabase({ silentError: false }).then(function (nextListing) {
            if (nextListing) renderLoadModalBody(dialog, nextListing);
          });
        }
      });
    }

    body.appendChild(createSection('Recent snapshots (last 30 days)', recent, allowDelete, handleLoad, handleDelete));
    body.appendChild(createOlderDisclosure(older, allowDelete, handleLoad, handleDelete, handleDeleteOlder));
  }

  async function openLoadModal() {
    closeLoadModal();

    var listing = await listSnapshotsFromSupabase({ silentError: false });
    if (!listing) return;

    var overlay = document.createElement('div');
    overlay.className = 'snapshot-modal';

    var backdrop = document.createElement('div');
    backdrop.className = 'snapshot-modal__backdrop';
    backdrop.addEventListener('click', closeLoadModal);

    var dialog = document.createElement('div');
    dialog.className = 'snapshot-modal__dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Load snapshot');

    var header = document.createElement('div');
    header.className = 'snapshot-modal__header';

    var title = document.createElement('h3');
    title.className = 'snapshot-modal__title';
    title.textContent = 'Load snapshot';
    header.appendChild(title);

    header.appendChild(createButton('Close', 'snapshot-modal__close', closeLoadModal));
    dialog.appendChild(header);

    var body = document.createElement('div');
    body.className = 'snapshot-modal__body';
    dialog.appendChild(body);

    overlay.appendChild(backdrop);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    statusState.modalEl = overlay;

    statusState.modalEscHandler = function (event) {
      if (event && event.key === 'Escape') {
        closeLoadModal();
      }
    };
    document.addEventListener('keydown', statusState.modalEscHandler, true);

    renderLoadModalBody(dialog, listing);
  }

  function init() {
    if (statusState.initialized) return;
    statusState.initialized = true;
    wrapCommitApis();
    if (!statusState.baselineHash) {
      clearStatus();
    } else {
      renderStatus();
    }
  }

  snapshotStatus.init = init;
  snapshotStatus.clear = clearStatus;
  snapshotStatus.markCleanFromSnapshot = markCleanFromSnapshot;
  snapshotStatus.markCleanFromCurrent = markCleanFromCurrent;
  snapshotStatus.scheduleDirtyCheck = scheduleDirtyCheck;
  snapshotStatus.runDirtyCheck = runDirtyCheck;
  snapshotStatus.formatSnapshotTimestamp = formatSnapshotTimestamp;
  snapshotStatus.getCurrentMeta = function () { return normalizeMeta(statusState.currentMeta); };

  snapshotsApi.openLoadModal = openLoadModal;
  snapshotsApi.closeLoadModal = closeLoadModal;

  App.data = App.data || {};
  App.data.loadLatestSnapshotFromSupabase = loadLatestSnapshotFromSupabase;
  App.data.saveSnapshotToSupabase = saveSnapshotToSupabase;
  App.data.listSnapshotsFromSupabase = listSnapshotsFromSupabase;
  App.data.loadSnapshotByIdFromSupabase = loadSnapshotByIdFromSupabase;
  App.data.deleteSnapshotsFromSupabase = deleteSnapshotsFromSupabase;
  App.data.deleteOldSnapshotsFromSupabase = deleteOldSnapshotsFromSupabase;

  App.data.loadAllFromSupabase = function (opts) {
    return loadLatestSnapshotFromSupabase(opts || {});
  };
  App.data.saveToSupabase = function (opts) {
    return saveSnapshotToSupabase(opts || {});
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
