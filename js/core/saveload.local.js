(function (window) {
  'use strict';
  var App = window.App || (window.App = {});
  App.local = App.local || {};

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

  function mapRestoreFailureMessage(reason) {
    switch (reason) {
      case 'unsupported_version':
        return 'Local Restore 차단 — 지원되지 않는 백업 버전입니다.';
      case 'data_shape_invalid':
        return 'Local Restore 차단 — 데이터 구조가 올바르지 않습니다.';
      case 'empty_data':
        return 'Local Restore 차단 — 형식은 맞지만 복원 가능한 데이터가 비어 있습니다.';
      case 'schedule_not_object':
      case 'schedule_kind_invalid':
      case 'schedule_loan_missing':
      case 'schedule_claim_missing':
      case 'schedule_debtor_missing':
      case 'schedule_ref_invalid':
        return 'Local Restore 차단 — 스케줄 참조 무결성이 깨진 백업입니다.';
      case 'legacy_required_collections_missing':
      case 'legacy_shape_invalid':
        return 'Local Restore 차단 — legacy 백업 형식이지만 필수 데이터 컬렉션이 누락되었거나 형식이 올바르지 않아 복원할 수 없습니다.';
      case 'snapshot_required_collections_missing':
      case 'snapshot_shape_invalid':
        return 'Local Restore 차단 — snapshot 백업 형식이지만 필수 데이터 컬렉션이 누락되었거나 형식이 올바르지 않아 복원할 수 없습니다.';
      case 'snapshot_missing':
      case 'data_missing':
        return 'Local Restore 차단 — 백업 데이터가 비어 있거나 인식되지 않습니다.';
      default:
        return '오류 발생 — 다시 시도해주세요.';
    }
  }

  App.local.save = function () {
    try {
      if (App.state && App.state.cloud && App.state.cloud.isShared && App.state.cloud.isReadOnly && App.state.cloud.viewerId && App.state.cloud.targetUserId && App.state.cloud.viewerId !== App.state.cloud.targetUserId) {
        console.warn('[Local Save] Read-only viewer account. Save is blocked.');
        App.showToast('읽기 전용 계정입니다 — Local 저장 불가');
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

      var snapshot = App.stateIO.buildSnapshotEnvelope({ source: 'localSave' });
      var data = JSON.stringify(snapshot, null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = buildSnapshotFileName(snapshot);
      a.click();
      try {
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1000);
      } catch (e) {}
      console.log('[Local Save] Success (reason=save:local, format=snapshot-v1)');
      App.showToast('Local Save 완료 — versioned snapshot JSON이 저장되었습니다.');
    } catch (err) {
      console.error('[Local Save] Failed:', err);
      App.showToast('오류 발생 — 다시 시도해주세요.');
    }
  };

  App.local.load = async function (file) {
    try {
      if (App.state && App.state.cloud && App.state.cloud.isShared && App.state.cloud.isReadOnly && App.state.cloud.viewerId && App.state.cloud.targetUserId && App.state.cloud.viewerId !== App.state.cloud.targetUserId) {
        console.warn('[Local Load] Read-only viewer account. Load is blocked.');
        App.showToast('읽기 전용 계정입니다 — Local 불러오기 불가');
        return;
      }

      if (!file) {
        App.showToast('오류 발생 — 다시 시도해주세요.');
        return;
      }

      if (!App.stateIO || typeof App.stateIO.normalizeSnapshotInput !== 'function' || typeof App.stateIO.validateSnapshot !== 'function' || typeof App.stateIO.applySnapshot !== 'function') {
        console.warn('[Local Load] StateIO snapshot pipeline is not available.');
        App.showToast('오류 발생 — 다시 시도해주세요.');
        return;
      }

      var text = await file.text();
      var obj;
      try {
        obj = JSON.parse(text);
      } catch (parseErr) {
        console.error('[Local Load] JSON parse failed:', parseErr);
        App.showToast('Local Restore 차단 — JSON 파싱에 실패했습니다.');
        return;
      }

      var normalized = App.stateIO.normalizeSnapshotInput(obj, { sourceType: 'local' });
      if (!normalized.ok) {
        console.warn('[Local Load] Normalize failed:', normalized.reason);
        App.showToast(mapRestoreFailureMessage(normalized.reason));
        return;
      }

      var validation = App.stateIO.validateSnapshot(normalized.snapshot, {
        rejectEmptyData: true,
        originalInputFormat: normalized.originalInputFormat || normalized.inputFormat || 'snapshot-v1'
      });
      if (!validation.ok) {
        console.warn('[Local Load] Snapshot rejected:', validation.reason, validation.counts || {}, validation.integrity || {});
        App.showToast(mapRestoreFailureMessage(validation.reason));
        return;
      }

      var appliedInputFormat = validation.inputFormat || normalized.inputFormat || 'snapshot-v1';
      var appliedOriginalInputFormat = validation.originalInputFormat || normalized.originalInputFormat || appliedInputFormat;
      console.info('[Local Restore] Applying snapshot with uiPolicy=snapshot reason=restore:localBackup inputFormat=' + appliedInputFormat + ' originalInputFormat=' + appliedOriginalInputFormat);
      var applied = App.stateIO.applySnapshot(validation.snapshot, {
        uiPolicy: 'snapshot',
        reason: 'restore:localBackup',
        sourceType: 'local',
        inputFormat: appliedInputFormat,
        originalInputFormat: appliedOriginalInputFormat
      });

      if (!applied) {
        App.showToast('오류 발생 — 다시 시도해주세요.');
        return;
      }

      console.log('[Local Restore] Success');
      App.showToast('Local Restore 완료 — 데이터와 관리 대상 UI 상태를 복원했습니다.');
    } catch (err) {
      console.error('[Local Load] Failed:', err);
      App.showToast('오류 발생 — 다시 시도해주세요.');
    }
  };
})(window);
