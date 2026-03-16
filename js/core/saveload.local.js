(function (window) {
  'use strict';
  var App = window.App || (window.App = {});
  App.local = App.local || {};

  App.local.save = function () {
    try {
      // Viewer(read-only shared) accounts must not export/import local snapshots.
      if (App.state && App.state.cloud && App.state.cloud.isShared && App.state.cloud.isReadOnly && App.state.cloud.viewerId && App.state.cloud.targetUserId && App.state.cloud.viewerId !== App.state.cloud.targetUserId) {
        console.warn('[Local Save] Read-only viewer account. Save is blocked.');
        App.showToast("읽기 전용 계정입니다 — Local 저장 불가");
        return;
      }

      // Stage 6.1: Ensure meta counters exist in saved snapshot (ID collision prevention).
      if (App.stateIO && typeof App.stateIO.ensureMeta === 'function') {
        App.stateIO.ensureMeta();
      }

      
// displayId repair (Loan/Claim): fix invalid ids before persisting/exporting.
// - Only repairs when displayId exists (no bulk generation).
if (App.util && typeof App.util.repairLoanClaimDisplayIds === 'function') {
  App.util.repairLoanClaimDisplayIds();
}

// displayId (Loan/Claim): generate only at save-time when missing.
      // NOTE: This MUST NOT run on app load.
      if (App.util && typeof App.util.ensureLoanClaimDisplayIds === 'function') {
        App.util.ensureLoanClaimDisplayIds();
      }

      // v3.2.8: Export a normalized snapshot (SSoT).
      // - debtors: human-info fields only (no loans/claims copies, no derived caches)
      // - loans/claims/schedules/cashLogs: ledger data as-is
      var state = App.state || {};
      var payload = state;
      if (App.util && typeof App.util.sanitizeDebtorArray === 'function') {
        payload = {};
        for (var k in state) {
          if (Object.prototype.hasOwnProperty.call(state, k)) {
            payload[k] = state[k];
          }
        }
        payload.debtors = App.util.sanitizeDebtorArray(Array.isArray(state.debtors) ? state.debtors : []);
      }

      const data = JSON.stringify(payload, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'app_state_backup.json';
      a.click();
      console.log('[Local Save] Success');
      App.showToast("Local Save 완료 — JSON 파일이 다운로드됩니다.");
    } catch (err) {
      console.error('[Local Save] Failed:', err);
      App.showToast("오류 발생 — 다시 시도해주세요.");
    }
  };

  App.local.load = async function (file) {
    try {
      // Viewer(read-only shared) accounts must not export/import local snapshots.
      if (App.state && App.state.cloud && App.state.cloud.isShared && App.state.cloud.isReadOnly && App.state.cloud.viewerId && App.state.cloud.targetUserId && App.state.cloud.viewerId !== App.state.cloud.targetUserId) {
        console.warn('[Local Load] Read-only viewer account. Load is blocked.');
        App.showToast("읽기 전용 계정입니다 — Local 불러오기 불가");
        return;
      }

      const text = await file.text();
      const obj = JSON.parse(text);
      if (App.stateIO && typeof App.stateIO.applySnapshot === 'function') {
        App.stateIO.applySnapshot(obj, { keepUI: true });
      } else {
        console.warn('[Local Load] App.stateIO.applySnapshot is not available.');
      }
      console.log('[Local Load] Success');
      App.showToast("Local Load 완료 — 로컬 데이터를 적용했습니다.");
    } catch (err) {
      console.error('[Local Load] Failed:', err);
      App.showToast("오류 발생 — 다시 시도해주세요.");
    }
  };
})(window);