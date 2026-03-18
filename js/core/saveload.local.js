(function (window) {
  'use strict';
  var App = window.App || (window.App = {});
  App.local = App.local || {};
  App.jsonIO = App.jsonIO || {};

  function pad2(v) {
    v = Number(v) || 0;
    return v < 10 ? '0' + v : String(v);
  }

  function buildSnapshotFileName(snapshot) {
    var when = new Date();
    var stamp = when.getFullYear() + '-' + pad2(when.getMonth() + 1) + '-' + pad2(when.getDate()) + '_' + pad2(when.getHours()) + pad2(when.getMinutes()) + pad2(when.getSeconds());
    var version = (snapshot && typeof snapshot.appVersion === 'string' && snapshot.appVersion) ? snapshot.appVersion : ((App.stateIO && typeof App.stateIO.getCurrentAppVersion === 'function') ? App.stateIO.getCurrentAppVersion() : 'unknown-version');
    version = String(version).replace(/[^a-zA-Z0-9._-]+/g, '_');
    return 'loanshark_snapshot_' + version + '_' + stamp + '.json';
  }

  function mapImportFailureMessage(reason) {
    switch (reason) {
      case 'unsupported_version':
        return 'Import JSON 차단 — 지원되지 않는 백업 버전입니다.';
      case 'data_shape_invalid':
        return 'Import JSON 차단 — 데이터 구조가 올바르지 않습니다.';
      case 'empty_data':
        return 'Import JSON 차단 — 형식은 맞지만 복원 가능한 데이터가 비어 있습니다.';
      case 'schedule_not_object':
      case 'schedule_kind_invalid':
      case 'schedule_loan_missing':
      case 'schedule_claim_missing':
      case 'schedule_debtor_missing':
      case 'schedule_ref_invalid':
        return 'Import JSON 차단 — 스케줄 참조 무결성이 깨진 백업입니다.';
      case 'legacy_required_collections_missing':
      case 'legacy_shape_invalid':
        return 'Import JSON 차단 — legacy 백업 형식이지만 필수 데이터 컬렉션이 누락되었거나 형식이 올바르지 않아 복원할 수 없습니다.';
      case 'snapshot_required_collections_missing':
      case 'snapshot_shape_invalid':
        return 'Import JSON 차단 — snapshot 백업 형식이지만 필수 데이터 컬렉션이 누락되었거나 형식이 올바르지 않아 복원할 수 없습니다.';
      case 'snapshot_missing':
      case 'data_missing':
        return 'Import JSON 차단 — 백업 데이터가 비어 있거나 인식되지 않습니다.';
      default:
        return '오류 발생 — 다시 시도해주세요.';
    }
  }

  function isReadOnlyViewer() {
    return !!(App.state && App.state.cloud && App.state.cloud.isShared && App.state.cloud.isReadOnly && App.state.cloud.viewerId && App.state.cloud.targetUserId && App.state.cloud.viewerId !== App.state.cloud.targetUserId);
  }

  function exportSnapshot() {
    try {
      if (isReadOnlyViewer()) {
        console.warn('[Export JSON] Read-only viewer account. Export is blocked.');
        App.showToast('읽기 전용 계정입니다 — JSON 내보내기 불가');
        return;
      }

      if (App.stateIO && typeof App.stateIO.ensureMeta === 'function') {
        App.stateIO.ensureMeta();
      }

      if (App.util && typeof App.util.repairLoanClaimDisplayIds === 'function') {
        App.util.repairLoanClaimDisplayIds();
      }

      if (App.util && typeof App.util.ensureLoanClaimDisplayIds === 'function') {
        App.util.ensureLoanClaimDisplayIds();
      }

      if (!App.stateIO || typeof App.stateIO.buildSnapshotEnvelope !== 'function') {
        throw new Error('StateIO snapshot builder is not available.');
      }

      var snapshot = App.stateIO.buildSnapshotEnvelope({ source: 'jsonExport' });
      var data = JSON.stringify(snapshot, null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = buildSnapshotFileName(snapshot);
      a.click();
      try {
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      } catch (e) {}
      console.log('[Export JSON] Success (reason=save:json, format=snapshot-v1)');
      App.showToast('Export JSON 완료 — snapshot JSON이 저장되었습니다.');
    } catch (err) {
      console.error('[Export JSON] Failed:', err);
      App.showToast('오류 발생 — 다시 시도해주세요.');
    }
  }

  async function importSnapshot(file) {
    try {
      if (isReadOnlyViewer()) {
        console.warn('[Import JSON] Read-only viewer account. Import is blocked.');
        App.showToast('읽기 전용 계정입니다 — JSON 불러오기 불가');
        return;
      }

      if (!file) {
        App.showToast('오류 발생 — 다시 시도해주세요.');
        return;
      }

      if (!App.stateIO || typeof App.stateIO.normalizeSnapshotInput !== 'function' || typeof App.stateIO.validateSnapshot !== 'function' || typeof App.stateIO.applySnapshot !== 'function') {
        console.warn('[Import JSON] StateIO snapshot pipeline is not available.');
        App.showToast('오류 발생 — 다시 시도해주세요.');
        return;
      }

      var text = await file.text();
      var obj;
      try {
        obj = JSON.parse(text);
      } catch (parseErr) {
        console.error('[Import JSON] JSON parse failed:', parseErr);
        App.showToast('Import JSON 차단 — JSON 파싱에 실패했습니다.');
        return;
      }

      var normalized = App.stateIO.normalizeSnapshotInput(obj, { sourceType: 'local' });
      if (!normalized.ok) {
        console.warn('[Import JSON] Normalize failed:', normalized.reason, {
          inputFormat: normalized.inputFormat || '',
          originalInputFormat: normalized.originalInputFormat || normalized.inputFormat || ''
        });
        App.showToast(mapImportFailureMessage(normalized.reason));
        return;
      }

      var validation = App.stateIO.validateSnapshot(normalized.snapshot, {
        rejectEmptyData: true,
        originalInputFormat: normalized.originalInputFormat || normalized.inputFormat || 'snapshot-v1'
      });
      if (!validation.ok) {
        console.warn('[Import JSON] Snapshot rejected:', validation.reason, validation.counts || {}, validation.integrity || {}, {
          inputFormat: validation.inputFormat || normalized.inputFormat || '',
          originalInputFormat: validation.originalInputFormat || normalized.originalInputFormat || validation.inputFormat || normalized.inputFormat || ''
        });
        App.showToast(mapImportFailureMessage(validation.reason));
        return;
      }

      var appliedInputFormat = validation.inputFormat || normalized.inputFormat || 'snapshot-v1';
      var appliedOriginalInputFormat = validation.originalInputFormat || normalized.originalInputFormat || appliedInputFormat;
      console.info('[Import JSON] Applying snapshot with uiPolicy=preserve reason=restore:jsonImport inputFormat=' + appliedInputFormat + ' originalInputFormat=' + appliedOriginalInputFormat);
      var applied = App.stateIO.applySnapshot(validation.snapshot, {
        uiPolicy: 'preserve',
        reason: 'restore:jsonImport',
        sourceType: 'local',
        inputFormat: appliedInputFormat,
        originalInputFormat: appliedOriginalInputFormat
      });

      if (!applied) {
        App.showToast('오류 발생 — 다시 시도해주세요.');
        return;
      }

      if (App.snapshotStatus && typeof App.snapshotStatus.markCleanFromCurrent === 'function') {
        App.snapshotStatus.markCleanFromCurrent({
          label: 'Imported JSON',
          sourceType: 'json',
          createdAt: validation.snapshot && validation.snapshot.savedAt ? validation.snapshot.savedAt : null,
          snapshotId: null,
          isImported: true
        });
      }

      console.log('[Import JSON] Success');
      App.showToast('Import JSON 완료 — 데이터를 반영했습니다.');
    } catch (err) {
      console.error('[Import JSON] Failed:', err);
      App.showToast('오류 발생 — 다시 시도해주세요.');
    }
  }

  App.local.save = exportSnapshot;
  App.local.load = importSnapshot;
  App.jsonIO.exportSnapshot = exportSnapshot;
  App.jsonIO.importSnapshot = importSnapshot;
})(window);
