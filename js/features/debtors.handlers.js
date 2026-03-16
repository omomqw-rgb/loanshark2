(function (window, document) {
  'use strict';

  var App = window.App || (window.App = window.App || {});
  App.features = App.features || {};

  // 핸들러: js/features/debtors.js 에서 분리
  function findDebtor(id) {
    var state = App.state || {};
    var list = state.debtors || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }

  function findLoan(id) {
    var state = App.state || {};
    var list = state.loans || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }

  function findClaim(id) {
    var state = App.state || {};
    var list = state.claims || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }


  function handleDebtorCreate(form) {
      if (App.api && App.api.domain && App.api.domain.debtor && typeof App.api.domain.debtor.createFromForm === 'function') {
        App.api.domain.debtor.createFromForm(form);
      }
    }

function handleDebtorEdit(form) {
      if (App.api && App.api.domain && App.api.domain.debtor && typeof App.api.domain.debtor.editFromForm === 'function') {
        App.api.domain.debtor.editFromForm(form);
      }
    }

function handleDebtorDelete() {
      var api = App.features && App.features.debtors;
      var debtor = api && typeof api.getSelectedDebtor === 'function' ? api.getSelectedDebtor() : null;
      if (!debtor || debtor.id == null) return;

      if (App.api && App.api.domain && App.api.domain.debtor && typeof App.api.domain.debtor.deleteById === 'function') {
        App.api.domain.debtor.deleteById(debtor.id);
      }
    }


  function handleLoanCreate(form) {
      if (App.api && App.api.domain && App.api.domain.loan && typeof App.api.domain.loan.createFromForm === 'function') {
        App.api.domain.loan.createFromForm(form);
      }
    }

  function handleLoanEdit(form) {
      if (App.api && App.api.domain && App.api.domain.loan && typeof App.api.domain.loan.editFromForm === 'function') {
        App.api.domain.loan.editFromForm(form);
      }
    }

  
  function handleLoanDelete(loanId) {
      if (App.api && App.api.domain && App.api.domain.loan && typeof App.api.domain.loan.deleteById === 'function') {
        App.api.domain.loan.deleteById(loanId);
      }
    }



    function handleClaimCreate(form) {
      if (App.api && App.api.domain && App.api.domain.claim && typeof App.api.domain.claim.createFromForm === 'function') {
        App.api.domain.claim.createFromForm(form);
      }
    }


    function handleClaimEdit(form) {
      if (App.api && App.api.domain && App.api.domain.claim && typeof App.api.domain.claim.editFromForm === 'function') {
        App.api.domain.claim.editFromForm(form);
      }
    }


  
    function handleClaimDelete(claimId) {
      if (App.api && App.api.domain && App.api.domain.claim && typeof App.api.domain.claim.deleteById === 'function') {
        App.api.domain.claim.deleteById(claimId);
      }
    }




    function handleLoanScheduleSave(form) {
      if (App.schedulesEngine && typeof App.schedulesEngine.bulkUpdateFromLoanForm === 'function') {
        App.schedulesEngine.bulkUpdateFromLoanForm(form);
      }
    }



  function handleClaimScheduleSave(form) {
      if (App.schedulesEngine && typeof App.schedulesEngine.bulkUpdateFromClaimForm === 'function') {
        App.schedulesEngine.bulkUpdateFromClaimForm(form);
      }
    }

function handleLoanInputs(el, form) {
      var name = el.name;
      var principalInput = form.querySelector('[name="loan-principal"]');
      var rateInput = form.querySelector('[name="loan-rate"]');
      var totalInput = form.querySelector('[name="loan-total"]');
      if (!principalInput || !rateInput || !totalInput) return;
  
      var principal = Number(principalInput.value || 0);
      var rate = Number(rateInput.value || 0);
      var total = Number(totalInput.value || 0);
  
      var last = form.getAttribute('data-last-edited') || '';
  
      if (name === 'loan-rate') {
        form.setAttribute('data-last-edited', 'rate');
        if (principal) {
          var ratio = 1 + rate / 100;
          var t = principal * ratio;
          if (isFinite(t)) {
            totalInput.value = Math.round(t);
          }
        }
      } else if (name === 'loan-total') {
        form.setAttribute('data-last-edited', 'total');
        if (principal) {
          var ratio2 = total / principal;
          var r = (ratio2 - 1) * 100;
          if (isFinite(r)) {
            rateInput.value = Math.round(r * 10) / 10;
          }
        }
      } else if (name === 'loan-principal') {
        form.setAttribute('data-last-edited', 'principal');
        if (rate && !total) {
          var t2 = principal * (1 + rate / 100);
          if (isFinite(t2)) {
            totalInput.value = Math.round(t2);
          }
        } else if (last === 'total' && principal && total) {
          var ratio3 = total / principal;
          var r2 = (ratio3 - 1) * 100;
          if (isFinite(r2)) {
            rateInput.value = Math.round(r2 * 10) / 10;
          }
        }
      }
    }

  function updateLoanCycleVisibility(form) {
      var type = form.querySelector('[name="loan-cycle-type"]').value || 'day';
      var dayGroup = form.querySelector('[data-role="loan-day-group"]');
      var weekGroup = form.querySelector('[data-role="loan-week-group"]');
  
      if (dayGroup) dayGroup.style.display = (type === 'day') ? 'flex' : 'none';
      if (weekGroup) weekGroup.style.display = (type === 'week') ? 'flex' : 'none';
    }

  function updateClaimCycleVisibility(form) {
      var type = form.querySelector('[name="claim-cycle-type"]').value || 'day';
      var dayGroup = form.querySelector('[data-role="claim-day-group"]');
      var weekGroup = form.querySelector('[data-role="claim-week-group"]');
  
      if (dayGroup) dayGroup.style.display = (type === 'day') ? 'flex' : 'none';
      if (weekGroup) weekGroup.style.display = (type === 'week') ? 'flex' : 'none';
    }

  App.features.debtorsHandlers = {
    handleDebtorCreate: handleDebtorCreate,
    handleDebtorEdit: handleDebtorEdit,
    handleDebtorDelete: handleDebtorDelete,
    handleLoanCreate: handleLoanCreate,
    handleLoanEdit: handleLoanEdit,
    handleLoanDelete: handleLoanDelete,
    handleClaimCreate: handleClaimCreate,
    handleClaimEdit: handleClaimEdit,
    handleClaimDelete: handleClaimDelete,
    handleLoanScheduleSave: handleLoanScheduleSave,
    handleClaimScheduleSave: handleClaimScheduleSave,
    handleLoanInputs: handleLoanInputs,
    updateLoanCycleVisibility: updateLoanCycleVisibility,
    updateClaimCycleVisibility: updateClaimCycleVisibility
  };

})(window, document);