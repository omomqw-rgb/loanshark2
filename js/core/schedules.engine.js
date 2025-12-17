(function (window) {
  'use strict';

  var App = window.App || (window.App = {});

  function toStr(value) {
    if (value === undefined || value === null) return null;
    return String(value);
  }

  function shallowClone(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    var copy = {};
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        copy[key] = obj[key];
      }
    }
    return copy;
  }

  var engine = {
    list: [],
    _initialized: false,

    _ensureInitialized: function () {
      if (this._initialized && Array.isArray(this.list)) return;

      if (!Array.isArray(this.list)) {
        this.list = [];
      }

      this._initialized = true;
      this._syncAlias();
    },

    _syncAlias: function () {
      var state = App.state || (App.state = {});
      var data = App.data || (App.data = {});
      state.schedules = this.list || [];
      data.schedules = this.list || [];
    },

    initEmpty: function () {
      this.list = [];
      this._initialized = true;
      this._syncAlias();
    },

    fromSnapshot: function (snapshot) {
      var list = [];
      if (Array.isArray(snapshot)) {
        for (var i = 0; i < snapshot.length; i++) {
          var sc = snapshot[i];
          if (!sc) continue;
          list.push(shallowClone(sc));
        }
      }
      this.list = list;
      this._initialized = true;
      this._syncAlias();
    },

    toSnapshot: function () {
      this._ensureInitialized();
      var result = [];
      var list = this.list || [];
      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) continue;
        result.push(shallowClone(sc));
      }
      return result;
    },

    _normalizeScheduleStatus: function (sc, todayStr) {
      if (!sc) return;

      // PARTIAL 상태는 사용자가 설정한 값을 그대로 유지한다.
      var currentStatus = (sc.status || '').toUpperCase();
      if (currentStatus === 'PARTIAL') {
        return;
      }

      var due = sc.dueDate || sc.due_date || sc.date || null;
      var amount = Number(sc.amount) || 0;
      var paidAmt = Number(sc.paidAmount != null ? sc.paidAmount : sc.partialPaidAmount || 0);

      if (!amount || !due || !todayStr) {
        return;
      }

      // 1) 완납
      if (paidAmt >= amount) {
        sc.status = 'PAID';
        return;
      }

      // 2) 부분납 (금액 기준으로 PARTIAL 도출)
      if (paidAmt > 0 && paidAmt < amount) {
        sc.status = 'PARTIAL';
        return;
      }

      // 3) 미납 (날짜 지났고 아직 한 푼도 안 냄)
      if (due < todayStr && paidAmt <= 0) {
        sc.status = 'OVERDUE';
        return;
      }

      // 4) 예정 (날짜 안 지났고 미납)
      sc.status = 'PLANNED';
    },

    rebuildForLoan: function (loan) {
      if (!loan || loan.id == null) return;

      this._ensureInitialized();

      var normalizedLoanId = toStr(loan.id);
      var newList = [];
      var current = this.list || [];

      // 1) 기존 loan 스케줄 제거
      for (var i = 0; i < current.length; i++) {
        var s = current[i];
        if (!s) {
          newList.push(s);
          continue;
        }
        if (s.kind === 'loan' && toStr(s.loanId) === normalizedLoanId) {
          continue;
        }
        newList.push(s);
      }

      // 2) 새 스케줄 생성
      var newSchedules = [];
      if (App.db && typeof App.db.buildLoanSchedule === 'function') {
        newSchedules = App.db.buildLoanSchedule(loan) || [];
      }

      for (var j = 0; j < newSchedules.length; j++) {
        var ns = shallowClone(newSchedules[j]);
        if (!ns) continue;

        if (ns.id != null) ns.id = toStr(ns.id);
        if (ns.loanId != null) ns.loanId = toStr(ns.loanId);
        else ns.loanId = normalizedLoanId;

        if (ns.debtorId != null) ns.debtorId = toStr(ns.debtorId);
        else if (loan.debtorId != null) ns.debtorId = toStr(loan.debtorId);

        if (ns.claimId != null) ns.claimId = toStr(ns.claimId);

        if (!ns.kind) ns.kind = 'loan';

        newList.push(ns);
      }

      // 3) ID 정규화
      for (var k = 0; k < newList.length; k++) {
        var sc = newList[k];
        if (!sc) continue;
        if (sc.loanId != null) sc.loanId = toStr(sc.loanId);
        if (sc.debtorId != null) sc.debtorId = toStr(sc.debtorId);
        if (sc.claimId != null) sc.claimId = toStr(sc.claimId);
        if (sc.id != null) sc.id = toStr(sc.id);
      }

      this.list = newList;
      this._syncAlias();

      // 4) Loan 파생 필드 업데이트
      if (App.db && typeof App.db.deriveLoanFields === 'function') {
        var loanSchedules = [];
        for (var m = 0; m < newList.length; m++) {
          var sc2 = newList[m];
          if (!sc2) continue;
          if (sc2.kind === 'loan' && toStr(sc2.loanId) === normalizedLoanId) {
            loanSchedules.push(sc2);
          }
        }
        App.db.deriveLoanFields(loan, loanSchedules);
      }
    },

    rebuildForClaim: function (claim) {
      if (!claim || claim.id == null) return;

      this._ensureInitialized();

      var normalizedClaimId = toStr(claim.id);
      var newList = [];
      var current = this.list || [];

      // 1) 기존 claim 스케줄 제거
      for (var i = 0; i < current.length; i++) {
        var s = current[i];
        if (!s) {
          newList.push(s);
          continue;
        }
        if (s.kind === 'claim' && toStr(s.claimId) === normalizedClaimId) {
          continue;
        }
        newList.push(s);
      }

      // 2) 새 스케줄 생성
      var newSchedules = [];
      if (App.db && typeof App.db.buildClaimSchedule === 'function') {
        newSchedules = App.db.buildClaimSchedule(claim) || [];
      }

      for (var j = 0; j < newSchedules.length; j++) {
        var ns = shallowClone(newSchedules[j]);
        if (!ns) continue;

        if (ns.id != null) ns.id = toStr(ns.id);
        if (ns.claimId != null) ns.claimId = toStr(ns.claimId);
        else ns.claimId = normalizedClaimId;

        if (ns.debtorId != null) ns.debtorId = toStr(ns.debtorId);
        else if (claim.debtorId != null) ns.debtorId = toStr(claim.debtorId);

        if (ns.loanId != null) ns.loanId = toStr(ns.loanId);

        if (!ns.kind) ns.kind = 'claim';

        newList.push(ns);
      }

      // 3) ID 정규화
      for (var k = 0; k < newList.length; k++) {
        var sc = newList[k];
        if (!sc) continue;
        if (sc.claimId != null) sc.claimId = toStr(sc.claimId);
        if (sc.debtorId != null) sc.debtorId = toStr(sc.debtorId);
        if (sc.loanId != null) sc.loanId = toStr(sc.loanId);
        if (sc.id != null) sc.id = toStr(sc.id);
      }

      this.list = newList;
      this._syncAlias();
    },

    updateSchedule: function (id, patch) {
      if (!id || !patch) return;
      this._ensureInitialized();

      var targetId = toStr(id);
      var list = this.list || [];

      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) continue;
        if (toStr(sc.id) === targetId) {
          for (var key in patch) {
            if (Object.prototype.hasOwnProperty.call(patch, key)) {
              sc[key] = patch[key];
            }
          }
          break;
        }
      }

      this._syncAlias();
    },

    bulkUpdateFromLoanForm: function (form) {
      if (!form) return;

      this._ensureInitialized();

      var api = App.features && App.features.debtors;
      var loanId = form.getAttribute('data-loan-id');
      var normalizedLoanId = loanId != null ? String(loanId) : loanId;
      var list = this.list || [];

      // 1단계: 상태(select)를 기준으로 status 및 금액 기본값 설정
      var selects = form.querySelectorAll('select[data-schedule-id]');
      for (var i = 0; i < selects.length; i++) {
        var sel = selects[i];
        var sid = sel.getAttribute('data-schedule-id');
        var val = sel.value || 'PLANNED';

        for (var j = 0; j < list.length; j++) {
          var sc = list[j];
          if (!sc) continue;
          if (String(sc.id) === String(sid)) {
            var amount = Number(sc.amount) || 0;

            sc.status = val;

            if (val === 'PAID') {
              sc.paidAmount = amount;
              sc.partialPaidAmount = 0;
            } else if (val === 'PLANNED' || val === 'OVERDUE') {
              sc.paidAmount = 0;
              sc.partialPaidAmount = 0;
            } else if (val === 'PARTIAL') {
              // PARTIAL 은 이 단계에서는 status 만 설정하고 금액은 건드리지 않는다.
            }
            break;
          }
        }
      }

      // 2단계: 부분 납입 금액(partialPaidAmount) 입력값 반영
      var partialInputs = form.querySelectorAll('input[data-partial-id]');
      for (var k = 0; k < partialInputs.length; k++) {
        var input = partialInputs[k];
        var sid2 = input.getAttribute('data-partial-id');
        var raw = input.value != null ? String(input.value).trim() : '';
        var num = raw === '' ? 0 : Number(raw);
        if (!isFinite(num) || num < 0) num = 0;

        for (var m = 0; m < list.length; m++) {
          var sc2 = list[m];
          if (!sc2) continue;
          if (String(sc2.id) === String(sid2)) {
            sc2.partialPaidAmount = num;
            if ((sc2.status || '').toUpperCase() === 'PARTIAL') {
              sc2.paidAmount = num;
            }
            break;
          }
        }
      }

      // Loan 파생 필드 업데이트
      if (App.db && App.db.deriveLoanFields && normalizedLoanId != null) {
        var loan = null;
        var state = App.state || {};
        var loans = state.loans || [];
        for (var n = 0; n < loans.length; n++) {
          var candidate = loans[n];
          if (!candidate) continue;
          if (String(candidate.id) === String(normalizedLoanId)) {
            loan = candidate;
            break;
          }
        }
        if (loan) {
          var loanSchedules = [];
          for (var p = 0; p < list.length; p++) {
            var sc3 = list[p];
            if (!sc3) continue;
            if (sc3.kind === 'loan' && String(sc3.loanId) === String(normalizedLoanId)) {
              loanSchedules.push(sc3);
            }
          }
          App.db.deriveLoanFields(loan, loanSchedules);
        }
      }

      this._syncAlias();

      // Stage 4A: UI 업데이트(모달 close / render / refresh)는 App.api.domain.commit 파이프라인에서 처리한다.
    },

    bulkUpdateFromClaimForm: function (form) {
      if (!form) return;

      this._ensureInitialized();

      var api = App.features && App.features.debtors;
      var claimId = form.getAttribute('data-claim-id');
      var normalizedClaimId = claimId != null ? String(claimId) : claimId;
      var list = this.list || [];

      // 1단계: 금액 입력값 반영
      var amountInputs = form.querySelectorAll('input[data-schedule-id]');
      for (var i = 0; i < amountInputs.length; i++) {
        var input = amountInputs[i];
        var sid = input.getAttribute('data-schedule-id');
        var val = input.value != null ? String(input.value).trim() : '';
        var num = val === '' ? 0 : Number(val);
        if (!isFinite(num) || num < 0) num = 0;

        for (var j = 0; j < list.length; j++) {
          var sc = list[j];
          if (!sc) continue;
          if (String(sc.id) === String(sid)) {
            sc.amount = num;
            break;
          }
        }
      }

      // 2단계: 상태(select)를 기준으로 PLANNED / PAID / OVERDUE 만 처리
      var selects = form.querySelectorAll('select[data-schedule-id]');
      for (var k = 0; k < selects.length; k++) {
        var sel = selects[k];
        var sid2 = sel.getAttribute('data-schedule-id');
        var rawStatus = sel.value || 'PLANNED';
        var status = String(rawStatus).toUpperCase();

        for (var m = 0; m < list.length; m++) {
          var sc2 = list[m];
          if (!sc2) continue;
          if (String(sc2.id) === String(sid2)) {
            var amount2 = Number(sc2.amount) || 0;

            if (status === 'PAID') {
              sc2.status = 'PAID';
              sc2.paidAmount = amount2;
              sc2.partialPaidAmount = 0;
            } else if (status === 'OVERDUE') {
              sc2.status = 'OVERDUE';
              sc2.paidAmount = 0;
              sc2.partialPaidAmount = 0;
            } else {
              // PARTIAL 등 그 외 값은 모두 PLANNED 로 정규화
              sc2.status = 'PLANNED';
              sc2.paidAmount = 0;
              sc2.partialPaidAmount = 0;
            }

            break;
          }
        }
      }

      this._syncAlias();

      // Stage 4A: UI 업데이트(모달 close / render / refresh)는 App.api.domain.commit 파이프라인에서 처리한다.
    },

    removeByDebtorId: function (debtorId) {
      if (debtorId == null) return;
      this._ensureInitialized();

      var target = String(debtorId);
      var list = this.list || [];
      var next = [];

      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) {
          next.push(sc);
          continue;
        }
        if (String(sc.debtorId) === target) {
          continue;
        }
        next.push(sc);
      }

      this.list = next;
      this._syncAlias();
    },

    removeByLoanId: function (loanId) {
      if (loanId == null) return;
      this._ensureInitialized();

      var target = String(loanId);
      var list = this.list || [];
      var next = [];

      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) {
          next.push(sc);
          continue;
        }
        if (sc.kind === 'loan' && String(sc.loanId) === target) {
          continue;
        }
        next.push(sc);
      }

      this.list = next;
      this._syncAlias();
    },

    removeByClaimId: function (claimId) {
      if (claimId == null) return;
      this._ensureInitialized();

      var target = String(claimId);
      var list = this.list || [];
      var next = [];

      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) {
          next.push(sc);
          continue;
        }
        if (sc.kind === 'claim' && String(sc.claimId) === target) {
          continue;
        }
        next.push(sc);
      }

      this.list = next;
      this._syncAlias();
    },

    normalizeAll: function (todayStr) {
      this._ensureInitialized();

      var list = this.list || [];
      for (var i = 0; i < list.length; i++) {
        this._normalizeScheduleStatus(list[i], todayStr);
      }

      this._syncAlias();
    },

    getAll: function () {
      this._ensureInitialized();
      return this.list || [];
    },

    getByLoanId: function (loanId) {
      this._ensureInitialized();

      var target = loanId != null ? String(loanId) : null;
      var list = this.list || [];
      var result = [];

      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) continue;
        if (target != null && String(sc.loanId) !== target) continue;
        result.push(sc);
      }

      return result;
    },

    getByClaimId: function (claimId) {
      this._ensureInitialized();

      var target = claimId != null ? String(claimId) : null;
      var list = this.list || [];
      var result = [];

      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) continue;
        if (target != null && String(sc.claimId) !== target) continue;
        result.push(sc);
      }

      return result;
    },

    getByDebtorId: function (debtorId) {
      this._ensureInitialized();

      var target = debtorId != null ? String(debtorId) : null;
      var list = this.list || [];
      var result = [];

      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) continue;
        if (target != null && String(sc.debtorId) !== target) continue;
        result.push(sc);
      }

      return result;
    }
  };

  App.schedulesEngine = engine;

})(window);
