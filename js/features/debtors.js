(function (window, document) {
  'use strict';

  var App = window.App || (window.App = window.App || {});

  if (!App.state) App.state = {};
  if (!App.state.ui) App.state.ui = {};
  if (!App.state.ui.debtorPanel) {
    App.state.ui.debtorPanel = {
      mode: 'list',
      selectedDebtorId: null,
      page: 1,
      pageSize: 20,
      searchQuery: '',
      sortKey: 'createdAt',
      sortDir: 'desc'
    };
  }

  var util = App.util || (App.util = {
    escapeHTML: function (str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },
    formatDate: function (dateStr) {
      if (!dateStr) return '';
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().slice(0, 10);
    },
    formatCurrency: function (num) {
      var n = Number(num || 0);
      if (!isFinite(n)) n = 0;
      return n.toLocaleString('ko-KR');
    }
  });

  var isComposing = false;

  function init() {
    if (App.modalManager && typeof App.modalManager.init === 'function') {
      App.modalManager.init();
    }
    attachPanelEvents();
    render();
  }

  /* ===== Event wiring: Panel / List / Detail ===== */

  
  function attachPanelEvents() {
    var root = document.getElementById('debtor-sidepanel');
    if (!root) {
      root = document.querySelector('.debtor-list-panel');
    }
    if (!root) return;

    root.addEventListener('click', function (event) {
      var t = event.target;

      if (t.closest('[data-action="debtor-select"]')) {
        var el = t.closest('[data-action="debtor-select"]');
        var id = el.getAttribute('data-debtor-id');
        if (!id) return;
        App.state.ui.debtorPanel.selectedDebtorId = id;
        App.state.ui.debtorPanel.mode = 'detail';
        render();
        refreshOtherViews();
        if (window.App && App.debtorDetail && typeof App.debtorDetail.render === 'function') {
          App.debtorDetail.render(String(id));
        }
        return;
      }

      if (t.closest('[data-action="debtor-open-list"]')) {
        App.state.ui.debtorPanel.mode = 'list';
        App.state.ui.debtorPanel.selectedDebtorId = null;
        render();
        refreshOtherViews();
        return;
      }

      if (t.closest('[data-action="debtor-open-create"]')) {
        App.modalManager.openDebtorModal('create', null);
        return;
      }

      if (t.closest('[data-action="debtor-open-edit"]')) {
        var d = getSelectedDebtor();
        if (d) App.modalManager.openDebtorModal('edit', d);
        return;
      }

      if (t.closest('[data-action="debtor-delete"]')) {
        var apiDelete = App.features && App.features.debtorsHandlers;
        if (apiDelete && typeof apiDelete.handleDebtorDelete === 'function') {
          apiDelete.handleDebtorDelete();
        }
        return;
      }

      if (t.closest('[data-action="loan-open-create"]')) {
        var debtor = getSelectedDebtor();
        if (!debtor) return;
        App.modalManager.openLoanModal('create', { debtorId: debtor.id });
        return;
      }

      if (t.closest('[data-action="loan-open-edit"]')) {
        var loanId = t.closest('[data-loan-id]') && t.closest('[data-loan-id]').getAttribute('data-loan-id');
        if (!loanId) return;
        var loan = findLoan(loanId);
        if (loan) {
          App.modalManager.openLoanModal('edit', { loan: loan });
        }
        return;
      }

      if (t.closest('[data-action="loan-delete"]')) {
        var loanId2 = t.closest('[data-loan-id]') && t.closest('[data-loan-id]').getAttribute('data-loan-id');
        if (!loanId2) return;
        var apiLoan = App.features && App.features.debtorsHandlers;
        if (apiLoan && typeof apiLoan.handleLoanDelete === 'function') {
          apiLoan.handleLoanDelete(loanId2);
        }
        return;
      }

      if (t.closest('[data-action="claim-open-create"]')) {
        var debtor2 = getSelectedDebtor();
        if (!debtor2) return;
        App.modalManager.openClaimModal('create', { debtorId: debtor2.id });
        return;
      }

      if (t.closest('[data-action="claim-open-edit"]')) {
        var claimId = t.closest('[data-claim-id]') && t.closest('[data-claim-id]').getAttribute('data-claim-id');
        if (!claimId) return;
        var claim = findClaim(claimId);
        if (claim) {
          App.modalManager.openClaimModal('edit', { claim: claim });
        }
        return;
      }

      if (t.closest('[data-action="claim-delete"]')) {
        var claimId2 = t.closest('[data-claim-id]') && t.closest('[data-claim-id]').getAttribute('data-claim-id');
        if (!claimId2) return;
        var apiClaim = App.features && App.features.debtorsHandlers;
        if (apiClaim && typeof apiClaim.handleClaimDelete === 'function') {
          apiClaim.handleClaimDelete(claimId2);
        }
        return;
      }

      // Loan / Claim schedule modals (detail panel buttons)
      if (t.closest('[data-action="loan-open-schedule"]')) {
        var loanId3 = t.closest('[data-loan-id]') && t.closest('[data-loan-id]').getAttribute('data-loan-id');
        if (!loanId3) return;
        App.modalManager.openLoanScheduleModal(loanId3);
        return;
      }

      if (t.closest('[data-action="claim-open-schedule"]')) {
        var claimId3 = t.closest('[data-claim-id]') && t.closest('[data-claim-id]').getAttribute('data-claim-id');
        if (!claimId3) return;
        App.modalManager.openClaimScheduleModal(claimId3);
        return;
      }

      // Section fold/unfold for loan / claim cards
      if (t.closest('[data-action="toggle-section"]')) {
        var toggleBtn = t.closest('[data-action="toggle-section"]');
        var target = toggleBtn.getAttribute('data-target') || '';
        var section = toggleBtn.closest('.form-section');
        if (!section) return;
        var body = section.querySelector('.form-section-body');

        var isCollapsed = section.classList.contains('collapsed');
        if (isCollapsed) {
          section.classList.remove('collapsed');
          if (body) body.classList.remove('collapsed');
        } else {
          section.classList.add('collapsed');
          if (body) body.classList.add('collapsed');
        }

        if (!App.state) App.state = {};
        if (target === 'loans') {
          App.state.loansCollapsed = !isCollapsed;
        } else if (target === 'claims') {
          App.state.claimsCollapsed = !isCollapsed;
        }
        return;
      }

      if (t.closest('[data-action="debtor-page-prev"]')) {
        var ui = App.state.ui.debtorPanel;
        if (ui.page > 1) {
          ui.page -= 1;
          render();
        }
        return;
      }

      if (t.closest('[data-action="debtor-page-next"]')) {
        var ui2 = App.state.ui.debtorPanel;
        ui2.page += 1;
        render();
        return;
      }

      if (t.closest('[data-action="debtor-sort"]')) {
        var sortKey = t.getAttribute('data-sort-key') || 'createdAt';
        var ui3 = App.state.ui.debtorPanel;
        if (ui3.sortKey === sortKey) {
          ui3.sortDir = (ui3.sortDir === 'asc') ? 'desc' : 'asc';
        } else {
          ui3.sortKey = sortKey;
          ui3.sortDir = 'desc';
        }
        ui3.page = 1;
        render();
        return;
      }
    });

    root.addEventListener('compositionstart', function () {
      isComposing = true;
    });
    root.addEventListener('compositionend', function () {
      isComposing = false;
    });

    // Search input
    root.addEventListener('input', function (event) {
      var t = event.target;
      if (t.matches('[data-role="debtor-search"]')) {
        if (isComposing) return;
        var value = t.value || '';
        App.state.ui.debtorPanel.searchQuery = value;
        App.state.ui.debtorPanel.page = 1;
      }
    });

    // Card status change (진행/완료/꺾기)
    root.addEventListener('change', function (event) {
      var t = event.target;
      if (!t || !t.matches('select[data-action="card-status-change"]')) return;

      var kind = t.getAttribute('data-kind') || '';
      var id = t.getAttribute('data-id');
      var newStatus = t.value;
      if (!id || !newStatus) return;

      if (!App.state) App.state = {};
      var updated = false;

      if (kind === 'loan') {
        var loans = App.state.loans || [];
        for (var i = 0; i < loans.length; i++) {
          if (String(loans[i].id) === String(id)) {
            loans[i].cardStatus = newStatus;
            updated = true;
            break;
          }
        }
      } else if (kind === 'claim') {
        var claims = App.state.claims || [];
        for (var j = 0; j < claims.length; j++) {
          if (String(claims[j].id) === String(id)) {
            claims[j].cardStatus = newStatus;
            updated = true;
            break;
          }
        }
      }

      // Reflect status on card DOM (CSS class)
      var cardEl = t.closest('.loan-card, .claim-card');
      if (cardEl) {
        cardEl.classList.remove('card-status-진행', 'card-status-완료', 'card-status-꺾기');
        cardEl.classList.add('card-status-' + newStatus);
      }

      if (updated) {
        // Refresh dependent views (calendar, report, summary, detail)
        var debtor = getSelectedDebtor();
        var debtorId = debtor && debtor.id != null ? String(debtor.id) : null;

        if (App.features && App.features.debtors && typeof App.features.debtors.refreshOtherViews === 'function') {
          App.features.debtors.refreshOtherViews();
        }

        if (window.App && App.debtorDetail && typeof App.debtorDetail.render === 'function' && debtorId) {
          App.debtorDetail.render(debtorId);
        }
      }
    });
  }


  /* ===== Debtor handlers ===== */

  



  



  



  /* ===== Loan handlers ===== */

  



  



  



  /* ===== Claim handlers ===== */

  



  



  /* ===== Schedule save handlers ===== */

  



  



  /* ===== Loan / Claim input helpers ===== */

  



  



  





function render() {
  // Legacy router-based render removed; kept as a no-op for backward compatibility.
}






  /* ===== Helpers ===== */

  function getSelectedDebtor() {
    var id = App.state.ui.debtorPanel.selectedDebtorId;
    return findDebtor(id);
  }

  function findDebtor(id) {
    var arr = App.state.debtors || [];
    for (var i = 0; i < arr.length; i++) {
      if (String(arr[i].id) === String(id)) return arr[i];
    }
    return null;
  }

  function findLoan(id) {
    var arr = App.state.loans || [];
    for (var i = 0; i < arr.length; i++) {
      if (String(arr[i].id) === String(id)) return arr[i];
    }
    return null;
  }

  function findClaim(id) {
    var arr = App.state.claims || [];
    for (var i = 0; i < arr.length; i++) {
      if (String(arr[i].id) === String(id)) return arr[i];
    }
    return null;
  }

  



  
  var __refreshOtherViewsWarned = false;
  function refreshOtherViews() {
    // Stage 6: legacy hook. Keep behavior (other views refreshed) but route through invalidate.
    if (!__refreshOtherViewsWarned) {
      __refreshOtherViewsWarned = true;
      try {
        console.warn('[DEPRECATED] refreshOtherViews() called. Prefer commit/invalidate.');
      } catch (e) {}
    }

    // Summary is not part of ViewKey set; keep legacy call if it exists.
    if (window.App && App.features && App.features.summary && typeof App.features.summary.render === 'function') {
      App.features.summary.render();
    }

    if (App.api && typeof App.api.commit === 'function' && App.ViewKey) {
      App.api.commit({
        reason: 'refreshOtherViews',
        invalidate: [App.ViewKey.CALENDAR, App.ViewKey.REPORT]
      });
      return;
    }

    // Fallback (no direct DOM render): best-effort invalidation only.
    if (App.api && App.api.view && typeof App.api.view.invalidate === 'function' && App.ViewKey) {
      App.api.view.invalidate([App.ViewKey.CALENDAR, App.ViewKey.REPORT]);
      return;
    }

    // Last resort: call legacy render entrypoints (may warn).
    if (window.App && App.features && App.features.report && typeof App.features.report.render === 'function') {
      App.features.report.render();
    }
    if (window.App && App.features && App.features.calendar && typeof App.features.calendar.render === 'function') {
      App.features.calendar.render();
    }
  }


  /* ===== Public API (Router + Modal wrapper + internal hooks) ===== */

  App.features = App.features || {};
  App.features.debtors = {
    init: init,
    // Stage 6: expose original (legacy/no-op) render impl but force external render() to invalidate.
    renderImpl: render,
    render: (function () {
      var warned = false;
      function warnOnce() {
        if (warned) return;
        warned = true;
        try {
          console.warn('[DEPRECATED] App.features.debtors.render() called. Use commit/invalidate.');
        } catch (e) {}
      }
      return function () {
        warnOnce();
        if (App.api && App.api.view && typeof App.api.view.invalidate === 'function' && App.ViewKey) {
          App.api.view.invalidate(App.ViewKey.DEBTOR_LIST);
          return;
        }
        if (App.renderCoordinator && typeof App.renderCoordinator.invalidate === 'function' && App.ViewKey) {
          App.renderCoordinator.invalidate(App.ViewKey.DEBTOR_LIST);
        }
      };
    })(),
    openLoanScheduleModal: function () {
      return App.modalManager.openLoanScheduleModal.apply(App.modalManager, arguments);
    },
    openClaimScheduleModal: function () {
      return App.modalManager.openClaimScheduleModal.apply(App.modalManager, arguments);
    },
    openLoanModal: function () {
      return App.modalManager.openLoanModal.apply(App.modalManager, arguments);
    },
    openClaimModal: function () {
      return App.modalManager.openClaimModal.apply(App.modalManager, arguments);
    },
    openDebtorModal: function () {
      return App.modalManager.openDebtorModal.apply(App.modalManager, arguments);
    },

    // 핸들러에서 사용할 공개 헬퍼
    getSelectedDebtor: getSelectedDebtor,
    refreshOtherViews: refreshOtherViews
  };

})(window, document);
