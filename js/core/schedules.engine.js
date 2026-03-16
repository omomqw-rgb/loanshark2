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

  function sortSchedulesForMatching(list) {
    return (list || []).slice().sort(function (a, b) {
      var ai = Number(a && a.installmentNo != null ? a.installmentNo : 0) || 0;
      var bi = Number(b && b.installmentNo != null ? b.installmentNo : 0) || 0;
      if (ai !== bi) return ai - bi;
      var ad = (a && (a.dueDate || a.due_date || '')) || '';
      var bd = (b && (b.dueDate || b.due_date || '')) || '';
      if (ad === bd) return 0;
      return ad < bd ? -1 : 1;
    });
  }

  function toNonNegativeNumber(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return n;
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

      // v3.2.17: hard-lock schedules SSOT to App.schedulesEngine.list.
      // Remove all legacy alias arrays so no caller can read/write schedules
      // through App.state.schedules or App.data.schedules.
      if (Object.prototype.hasOwnProperty.call(state, 'schedules')) {
        try { delete state.schedules; } catch (e) { state.schedules = undefined; }
      }
      if (Object.prototype.hasOwnProperty.call(data, 'schedules')) {
        try { delete data.schedules; } catch (e2) { data.schedules = undefined; }
      }
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

    _mergeRuntimeScheduleState: function (kind, owner, previousSchedules, nextSchedules) {
      var out = [];
      var prevList = sortSchedulesForMatching(previousSchedules);
      var nextList = sortSchedulesForMatching(nextSchedules);
      var matchedPrevIndexes = Object.create(null);
      var prevByInstallment = Object.create(null);
      var prevByDueDate = Object.create(null);
      var todayStr = null;

      if (App.util && typeof App.util.todayISODate === 'function') {
        todayStr = App.util.todayISODate();
      } else {
        todayStr = new Date().toISOString().slice(0, 10);
      }

      for (var i = 0; i < prevList.length; i++) {
        var prev = prevList[i];
        if (!prev) continue;

        var instKey = (prev.installmentNo != null) ? String(prev.installmentNo) : '';
        if (instKey && typeof prevByInstallment[instKey] === 'undefined') {
          prevByInstallment[instKey] = i;
        }

        var dueKey = prev.dueDate || prev.due_date || '';
        if (dueKey) {
          if (!prevByDueDate[dueKey]) prevByDueDate[dueKey] = [];
          prevByDueDate[dueKey].push(i);
        }
      }

      function findUnmatchedIndexByDueDate(dueKey) {
        var indexes = prevByDueDate[dueKey] || [];
        for (var di = 0; di < indexes.length; di++) {
          var idx = indexes[di];
          if (!matchedPrevIndexes[idx]) return idx;
        }
        return -1;
      }

      for (var j = 0; j < nextList.length; j++) {
        var next = shallowClone(nextList[j]);
        if (!next) continue;

        var matchedIndex = -1;
        var nextInstKey = (next.installmentNo != null) ? String(next.installmentNo) : '';
        if (nextInstKey && typeof prevByInstallment[nextInstKey] !== 'undefined') {
          var instIndex = prevByInstallment[nextInstKey];
          if (!matchedPrevIndexes[instIndex]) matchedIndex = instIndex;
        }

        if (matchedIndex < 0) {
          var nextDueKey = next.dueDate || next.due_date || '';
          if (nextDueKey) matchedIndex = findUnmatchedIndexByDueDate(nextDueKey);
        }

        if (matchedIndex >= 0) {
          matchedPrevIndexes[matchedIndex] = true;
          var prevMatched = prevList[matchedIndex];
          if (prevMatched) {
            var prevStatus = String(prevMatched.status || '').toUpperCase();
            var nextAmount = toNonNegativeNumber(next.amount);
            var prevPaid = toNonNegativeNumber(prevMatched.paidAmount != null ? prevMatched.paidAmount : prevMatched.partialPaidAmount);
            var prevPartial = toNonNegativeNumber(prevMatched.partialPaidAmount);

            if (prevMatched.id != null) {
              next.id = toStr(prevMatched.id);
            }

            if (prevMatched.memo != null && typeof next.memo === 'undefined') {
              next.memo = prevMatched.memo;
            }

            if (kind === 'claim' && !nextAmount) {
              nextAmount = toNonNegativeNumber(prevMatched.amount);
              next.amount = nextAmount;
            }

            if (prevStatus === 'PAID') {
              next.status = 'PAID';
              next.paidAmount = nextAmount;
              next.partialPaidAmount = 0;
            } else if (prevStatus === 'PARTIAL') {
              var clampedPaid = prevPaid;
              if (nextAmount > 0 && clampedPaid > nextAmount) clampedPaid = nextAmount;
              next.status = 'PARTIAL';
              next.partialPaidAmount = clampedPaid || prevPartial;
              next.paidAmount = clampedPaid;
            } else {
              next.paidAmount = 0;
              next.partialPaidAmount = 0;
              next.status = (prevStatus === 'OVERDUE') ? 'OVERDUE' : 'PLANNED';
              if (kind === 'loan') {
                this._normalizeScheduleStatus(next, todayStr);
              }
            }
          }
        }

        if (kind === 'loan') {
          this._normalizeScheduleStatus(next, todayStr);
        } else {
          var claimAmount = toNonNegativeNumber(next.amount);
          next.amount = claimAmount;
          if ((String(next.status || '').toUpperCase() === 'PARTIAL') && claimAmount <= 0) {
            next.status = 'PLANNED';
            next.paidAmount = 0;
            next.partialPaidAmount = 0;
          }
        }

        out.push(next);
      }

      return out;
    },

    _mergeLoanRuntimeScheduleState: function (loan, previousSchedules, nextSchedules) {
      return this._mergeRuntimeScheduleState('loan', loan, previousSchedules, nextSchedules);
    },

    _mergeClaimRuntimeScheduleState: function (claim, previousSchedules, nextSchedules) {
      return this._mergeRuntimeScheduleState('claim', claim, previousSchedules, nextSchedules);
    },


    _normalizeScheduleEntityRefs: function (sc, kind, ownerId, debtorId) {
      if (!sc || !kind) return sc;
      if (sc.id != null) sc.id = toStr(sc.id);
      sc.kind = kind;

      if (kind === 'loan') {
        sc.loanId = ownerId;
        sc.claimId = null;
      } else if (kind === 'claim') {
        sc.claimId = ownerId;
        sc.loanId = null;
      }

      if (debtorId != null) sc.debtorId = debtorId;
      else if (sc.debtorId != null) sc.debtorId = toStr(sc.debtorId);

      return sc;
    },

    replaceOwnerSchedules: function (kind, owner, nextSchedules, mergeRuntimeStateFn) {
      if (!owner || owner.id == null) return [];

      this._ensureInitialized();

      var ownerId = toStr(owner.id);
      var debtorId = owner.debtorId != null ? toStr(owner.debtorId) : null;
      var list = this.list || [];
      var preserved = [];
      var nextList = [];

      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) {
          nextList.push(sc);
          continue;
        }

        var isOwnerSchedule = false;
        if (kind === 'loan') {
          isOwnerSchedule = (String(sc.kind || '').toLowerCase() === 'loan') && toStr(sc.loanId) === ownerId;
        } else if (kind === 'claim') {
          isOwnerSchedule = (String(sc.kind || '').toLowerCase() === 'claim') && toStr(sc.claimId) === ownerId;
        }

        if (isOwnerSchedule) {
          preserved.push(shallowClone(sc));
          continue;
        }

        nextList.push(sc);
      }

      var baseNextSchedules = Array.isArray(nextSchedules) ? nextSchedules : [];
      var mergedSchedules = (typeof mergeRuntimeStateFn === 'function')
        ? mergeRuntimeStateFn.call(this, owner, preserved, baseNextSchedules)
        : baseNextSchedules.slice();

      for (var j = 0; j < mergedSchedules.length; j++) {
        var ns = shallowClone(mergedSchedules[j]);
        if (!ns) continue;
        this._normalizeScheduleEntityRefs(ns, kind, ownerId, debtorId);
        nextList.push(ns);
      }

      this.list = nextList;
      this._syncAlias();
      return mergedSchedules;
    },

    removeByOwner: function (kind, ownerId) {
      if (ownerId == null || !kind) return;
      this._ensureInitialized();

      var target = toStr(ownerId);
      var list = this.list || [];
      var next = [];

      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) {
          next.push(sc);
          continue;
        }

        var shouldRemove = false;
        if (kind === 'loan') {
          shouldRemove = (String(sc.kind || '').toLowerCase() === 'loan') && toStr(sc.loanId) === target;
        } else if (kind === 'claim') {
          shouldRemove = (String(sc.kind || '').toLowerCase() === 'claim') && toStr(sc.claimId) === target;
        }

        if (shouldRemove) continue;
        next.push(sc);
      }

      this.list = next;
      this._syncAlias();
    },

    rebuildForLoan: function (loan) {
      if (!loan || loan.id == null) return;

      var normalizedLoanId = toStr(loan.id);
      var newSchedules = [];
      if (App.db && typeof App.db.buildLoanSchedule === 'function') {
        newSchedules = App.db.buildLoanSchedule(loan) || [];
      }

      this.replaceOwnerSchedules('loan', loan, newSchedules, this._mergeLoanRuntimeScheduleState);

      if (App.db && typeof App.db.deriveLoanFields === 'function') {
        App.db.deriveLoanFields(loan, this.getByLoanId(normalizedLoanId));
      }
    },

    rebuildForClaim: function (claim) {
      if (!claim || claim.id == null) return;

      var newSchedules = [];
      if (App.db && typeof App.db.buildClaimSchedule === 'function') {
        newSchedules = App.db.buildClaimSchedule(claim) || [];
      }

      this.replaceOwnerSchedules('claim', claim, newSchedules, this._mergeClaimRuntimeScheduleState);
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
      this.removeByOwner('loan', loanId);
    },

    removeByClaimId: function (claimId) {
      this.removeByOwner('claim', claimId);
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

    findById: function (scheduleId) {
      this._ensureInitialized();

      var target = scheduleId != null ? String(scheduleId) : null;
      if (target == null) return null;

      var list = this.list || [];
      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) continue;
        if (String(sc.id) === target) return sc;
      }
      return null;
    },

    getByLoanId: function (loanId) {
      this._ensureInitialized();

      var target = loanId != null ? String(loanId) : null;
      var list = this.list || [];
      var result = [];

      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) continue;
        if (String(sc.kind || '').toLowerCase() !== 'loan') continue;
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
        if (String(sc.kind || '').toLowerCase() !== 'claim') continue;
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
