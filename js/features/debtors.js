(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  var panelEventsAttached = false;

  function cloneDefaultPanelState() {
    if (App && typeof App.getDefaultDebtorPanelState === 'function') {
      return App.getDefaultDebtorPanelState();
    }
    return {
      mode: 'list',
      selectedDebtorId: null,
      searchQuery: '',
      page: 1,
      viewMode: 'all',
      activeOnly: true,
      perPage: 15
    };
  }

  function ensurePanelState() {
    App.state = App.state || {};
    App.state.ui = App.state.ui || {};
    if (!App.state.ui.debtorPanel || typeof App.state.ui.debtorPanel !== 'object') {
      App.state.ui.debtorPanel = cloneDefaultPanelState();
    }
    return App.state.ui.debtorPanel;
  }

  function commitViewInvalidate(reason, keys) {
    if (App.api && typeof App.api.commit === 'function' && App.ViewKey) {
      App.api.commit({ reason: reason, invalidate: keys });
      return;
    }
    if (App.api && App.api.view && typeof App.api.view.invalidate === 'function' && App.ViewKey) {
      App.api.view.invalidate(keys);
    }
  }

  function init() {
    if (App.modalManager && typeof App.modalManager.init === 'function') {
      App.modalManager.init();
    }
    attachPanelEvents();
  }

  function attachPanelEvents() {
    if (panelEventsAttached) return;

    var root = document.getElementById('debtor-sidepanel');
    if (!root) {
      root = document.querySelector('.debtor-list-panel');
    }
    if (!root) return;

    panelEventsAttached = true;

    root.addEventListener('click', function (event) {
      var t = event.target;

      if (t.closest('[data-action="debtor-select"]')) {
        var el = t.closest('[data-action="debtor-select"]');
        var id = el.getAttribute('data-debtor-id');
        if (!id) return;
        if (App.api && App.api.view && typeof App.api.view.openDebtorDetail === 'function') {
          App.api.view.openDebtorDetail(id);
        } else {
          var panel = ensurePanelState();
          panel.selectedDebtorId = String(id);
          panel.mode = 'detail';
          commitViewInvalidate('debtors:select', [App.ViewKey.DEBTOR_DETAIL, App.ViewKey.DEBTOR_LIST]);
        }
        return;
      }

      if (t.closest('[data-action="debtor-open-list"]')) {
        if (App.api && App.api.view && typeof App.api.view.openDebtorList === 'function') {
          App.api.view.openDebtorList();
        } else {
          var panel2 = ensurePanelState();
          panel2.mode = 'list';
          panel2.selectedDebtorId = null;
          commitViewInvalidate('debtors:open-list', [App.ViewKey.DEBTOR_LIST, App.ViewKey.DEBTOR_DETAIL]);
        }
        return;
      }

      if (t.closest('[data-action="debtor-open-create"]')) {
        if (App.modalManager && typeof App.modalManager.openDebtorModal === 'function') {
          App.modalManager.openDebtorModal('create', null);
        }
        return;
      }

      if (t.closest('[data-action="debtor-open-edit"]')) {
        var debtor = getSelectedDebtor();
        if (debtor && App.modalManager && typeof App.modalManager.openDebtorModal === 'function') {
          App.modalManager.openDebtorModal('edit', debtor);
        }
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
        var debtor2 = getSelectedDebtor();
        if (!debtor2) return;
        if (App.modalManager && typeof App.modalManager.openLoanModal === 'function') {
          App.modalManager.openLoanModal('create', { debtorId: debtor2.id });
        }
        return;
      }

      if (t.closest('[data-action="loan-open-edit"]')) {
        var loanId = t.closest('[data-loan-id]') && t.closest('[data-loan-id]').getAttribute('data-loan-id');
        if (!loanId) return;
        var loan = findLoan(loanId);
        if (loan && App.modalManager && typeof App.modalManager.openLoanModal === 'function') {
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
        var debtor3 = getSelectedDebtor();
        if (!debtor3) return;
        if (App.modalManager && typeof App.modalManager.openClaimModal === 'function') {
          App.modalManager.openClaimModal('create', { debtorId: debtor3.id });
        }
        return;
      }

      if (t.closest('[data-action="claim-open-edit"]')) {
        var claimId = t.closest('[data-claim-id]') && t.closest('[data-claim-id]').getAttribute('data-claim-id');
        if (!claimId) return;
        var claim = findClaim(claimId);
        if (claim && App.modalManager && typeof App.modalManager.openClaimModal === 'function') {
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

      if (t.closest('[data-action="loan-open-schedule"]')) {
        var loanId3 = t.closest('[data-loan-id]') && t.closest('[data-loan-id]').getAttribute('data-loan-id');
        if (!loanId3) return;
        if (App.modalManager && typeof App.modalManager.openLoanScheduleModal === 'function') {
          App.modalManager.openLoanScheduleModal(loanId3);
        }
        return;
      }

      if (t.closest('[data-action="claim-open-schedule"]')) {
        var claimId3 = t.closest('[data-claim-id]') && t.closest('[data-claim-id]').getAttribute('data-claim-id');
        if (!claimId3) return;
        if (App.modalManager && typeof App.modalManager.openClaimScheduleModal === 'function') {
          App.modalManager.openClaimScheduleModal(claimId3);
        }
        return;
      }

      if (t.closest('[data-action="toggle-section"]')) {
        var toggleBtn = t.closest('[data-action="toggle-section"]');
        var target = toggleBtn.getAttribute('data-target') || '';
        var section = toggleBtn.closest('.form-section');
        var body = section ? section.querySelector('.form-section-body') : null;

        if (!section) return;

        var isCollapsed = section.classList.contains('collapsed');
        if (isCollapsed) {
          section.classList.remove('collapsed');
          if (body) body.classList.remove('collapsed');
        } else {
          section.classList.add('collapsed');
          if (body) body.classList.add('collapsed');
        }

        App.state = App.state || {};
        if (target === 'loans') {
          App.state.loansCollapsed = !isCollapsed;
        } else if (target === 'claims') {
          App.state.claimsCollapsed = !isCollapsed;
        }
        return;
      }
    });

    root.addEventListener('change', function (event) {
      var t = event.target;
      if (!t || !t.matches('select[data-action="card-status-change"]')) return;

      var kind = t.getAttribute('data-kind') || '';
      var id = t.getAttribute('data-id');
      var newStatus = t.value;
      if (!id || !newStatus) return;

      App.state = App.state || {};
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

      if (updated) {
        commitViewInvalidate('debtors.cardStatusChange', [
          App.ViewKey.DEBTOR_DETAIL,
          App.ViewKey.DEBTOR_LIST,
          App.ViewKey.CALENDAR,
          App.ViewKey.MONITORING,
          App.ViewKey.REPORT
        ]);
      }
    });
  }

  function render() {
    // Legacy router-based render removed; kept as a no-op for backward compatibility.
  }

  function getSelectedDebtor() {
    var panel = ensurePanelState();
    return findDebtor(panel.selectedDebtorId);
  }

  function findDebtor(id) {
    var arr = (App.state && App.state.debtors) || [];
    for (var i = 0; i < arr.length; i++) {
      if (String(arr[i].id) === String(id)) return arr[i];
    }
    return null;
  }

  function findLoan(id) {
    var arr = (App.state && App.state.loans) || [];
    for (var i = 0; i < arr.length; i++) {
      if (String(arr[i].id) === String(id)) return arr[i];
    }
    return null;
  }

  function findClaim(id) {
    var arr = (App.state && App.state.claims) || [];
    for (var i = 0; i < arr.length; i++) {
      if (String(arr[i].id) === String(id)) return arr[i];
    }
    return null;
  }

  function refreshOtherViews() {
    commitViewInvalidate('refreshOtherViews', [App.ViewKey.CALENDAR, App.ViewKey.MONITORING, App.ViewKey.REPORT]);
  }

  App.features = App.features || {};
  App.features.debtors = {
    init: init,
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
        commitViewInvalidate('debtors:deprecated-render', [App.ViewKey.DEBTOR_LIST]);
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
    getSelectedDebtor: getSelectedDebtor,
    refreshOtherViews: refreshOtherViews
  };
})(window, document);
