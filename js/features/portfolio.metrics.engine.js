(function (window) {
  'use strict';

  var App = window.App || (window.App = {});
  App.features = App.features || {};

  // Shared portfolio/risk rules.
  // These names are the canonical rule keys for the unified metrics engine.
  // - CONSECUTIVE_MISS_THRESHOLD: recent due-passed streak of unpaid schedules
  // - PAYMENT_STOP_DAYS_THRESHOLD: days since most recent payment trace
  // - PARTIAL_PATTERN_THRESHOLD: due-passed partial schedules with remaining balance
  // - HIGH_OVERDUE_AMOUNT_THRESHOLD: overdue loan balance threshold
  // - HIGH_OVERDUE_DAYS_THRESHOLD: longest overdue days threshold
  var RULES = {
    CONSECUTIVE_MISS_THRESHOLD: 2,
    PAYMENT_STOP_DAYS_THRESHOLD: 30,
    PARTIAL_PATTERN_THRESHOLD: 3,
    HIGH_OVERDUE_AMOUNT_THRESHOLD: 1000000,
    HIGH_OVERDUE_DAYS_THRESHOLD: 30
  };

  function toNumber(value) {
    var n = Number(value);
    return isFinite(n) ? n : 0;
  }

  function clampNonNegative(value) {
    var n = toNumber(value);
    return n > 0 ? n : 0;
  }

  function toDateOnly(value) {
    if (!value) return null;
    var date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function getTodayDate(input) {
    var date = toDateOnly(input);
    if (date) return date;
    if (App.date && typeof App.date.getToday === 'function') {
      date = toDateOnly(App.date.getToday());
      if (date) return date;
    }
    return toDateOnly(new Date());
  }

  function diffDays(later, earlier) {
    var laterDate = toDateOnly(later);
    var earlierDate = toDateOnly(earlier);
    if (!laterDate || !earlierDate) return 0;
    var diff = laterDate.getTime() - earlierDate.getTime();
    if (!isFinite(diff)) return 0;
    return Math.floor(diff / 86400000);
  }

  function normalizeRange(range) {
    range = range && typeof range === 'object' ? range : {};
    return {
      dateFrom: toDateOnly(range.dateFrom || range.from || null),
      dateTo: toDateOnly(range.dateTo || range.to || null)
    };
  }

  function isWithinRange(date, range) {
    if (!date) return false;
    if (!range) return true;
    if (range.dateFrom && date < range.dateFrom) return false;
    if (range.dateTo && date > range.dateTo) return false;
    return true;
  }

  function ensureStatusKey(map, key) {
    if (!Object.prototype.hasOwnProperty.call(map, key)) {
      map[key] = 0;
    }
    return key;
  }

  function getSchedules() {
    if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      try {
        var list = App.schedulesEngine.getAll() || [];
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  function getStateList(key) {
    var state = App.state || {};
    var list = state[key];
    return Array.isArray(list) ? list : [];
  }

  function getScheduleDueDate(schedule) {
    return toDateOnly(schedule && (schedule.dueDate || schedule.due_date || schedule.due || schedule.date || null));
  }

  function getScheduleAmount(schedule) {
    return clampNonNegative(schedule && schedule.amount);
  }

  function getScheduleStatus(schedule) {
    var raw = schedule && schedule.status ? String(schedule.status) : 'PLANNED';
    var status = raw.toUpperCase();
    if (getScheduleKind(schedule) === 'claim') {
      return status === 'PAID' ? 'PAID' : 'PLANNED';
    }
    return status;
  }

  function getScheduleKind(schedule) {
    if (!schedule) return 'loan';
    if (schedule.kind || schedule.type) {
      return String(schedule.kind || schedule.type).toLowerCase();
    }
    if (schedule.claimId != null || schedule.claim_id != null) return 'claim';
    if (schedule.loanId != null || schedule.loan_id != null) return 'loan';
    return 'loan';
  }

  function getSchedulePaidAmount(schedule) {
    if (!schedule) return 0;
    var amount = getScheduleAmount(schedule);
    var status = getScheduleStatus(schedule);
    var partialPaid = clampNonNegative(schedule.partialPaidAmount);
    var paidRaw = clampNonNegative(schedule.paidAmount);

    if (getScheduleKind(schedule) === 'claim') {
      return status === 'PAID' ? amount : 0;
    }
    if (status === 'PAID') return amount;
    if (status === 'PARTIAL') {
      var partial = partialPaid > 0 ? partialPaid : paidRaw;
      return partial > amount ? amount : partial;
    }
    return paidRaw > amount ? amount : paidRaw;
  }

  function getScheduleRemaining(schedule) {
    if (!schedule) return 0;
    if (schedule.remaining != null) {
      return clampNonNegative(schedule.remaining);
    }
    var remaining = getScheduleAmount(schedule) - getSchedulePaidAmount(schedule);
    return remaining > 0 ? remaining : 0;
  }

  function toKey(value) {
    return value == null || value === '' ? '' : String(value);
  }

  function dedupeSchedules(list) {
    var out = [];
    var seen = Object.create(null);
    list = Array.isArray(list) ? list : [];
    for (var i = 0; i < list.length; i++) {
      var schedule = list[i];
      if (!schedule) continue;
      var key = schedule.id != null ? String(schedule.id) : ('idx:' + i + ':' + (schedule.dueDate || schedule.due || ''));
      if (seen[key]) continue;
      seen[key] = true;
      out.push(schedule);
    }
    return out;
  }

  function compareSchedulesByDueAsc(a, b) {
    var da = getScheduleDueDate(a);
    var db = getScheduleDueDate(b);
    var ta = da ? da.getTime() : 0;
    var tb = db ? db.getTime() : 0;
    if (ta != tb) return ta - tb;
    return String(getScheduleKind(a) || '').localeCompare(String(getScheduleKind(b) || ''), 'ko');
  }

  function formatReasonCurrency(value) {
    var amount = Number(value) || 0;
    if (App.util && typeof App.util.formatCurrency === 'function') {
      return App.util.formatCurrency(amount);
    }
    return '₩' + Math.round(amount).toLocaleString('ko-KR');
  }

  function getSchedulePaidTraceDate(schedule, today) {
    if (!schedule) return null;
    var candidates = [
      schedule.paidDate,
      schedule.paidAt,
      schedule.paymentDate,
      schedule.paymentAt,
      schedule.collectedDate,
      schedule.collectedAt,
      schedule.completedAt,
      schedule.settledAt,
      schedule.lastPaidDate,
      schedule.lastPaidAt
    ];
    var latest = null;
    for (var i = 0; i < candidates.length; i++) {
      var date = toDateOnly(candidates[i]);
      if (!date) continue;
      if (today && date > today) continue;
      if (!latest || date > latest) latest = date;
    }
    if (latest) return latest;
    var paidAmount = getSchedulePaidAmount(schedule);
    if (paidAmount > 0) {
      var dueDate = getScheduleDueDate(schedule);
      if (dueDate && (!today || dueDate <= today)) return dueDate;
    }
    return null;
  }

  function getDebtorLastPaymentTraceDate(schedules, today) {
    schedules = Array.isArray(schedules) ? schedules : [];
    var latest = null;
    for (var i = 0; i < schedules.length; i++) {
      var traceDate = getSchedulePaidTraceDate(schedules[i], today);
      if (!traceDate) continue;
      if (!latest || traceDate > latest) latest = traceDate;
    }
    return latest;
  }

  function getDebtorAux(map, debtorId, debtorName) {
    var key = toKey(debtorId);
    if (!key) return null;
    if (!map[key]) {
      map[key] = {
        debtorId: key,
        name: debtorName || '',
        overdueCount: 0,
        partialPatternCount: 0,
        maxOverdueDays: 0,
        lastPaidDate: null,
        hasPaidTrace: false,
        operationalExposure: 0,
        overdueSchedules: [],
        relevantSchedules: []
      };
    } else if (!map[key].name && debtorName) {
      map[key].name = debtorName;
    }
    return map[key];
  }

  function computeConsecutiveMissCount(schedules, today) {
    schedules = Array.isArray(schedules) ? schedules.slice() : [];
    schedules.sort(compareSchedulesByDueAsc);

    var count = 0;
    for (var i = schedules.length - 1; i >= 0; i--) {
      var schedule = schedules[i];
      if (!schedule) continue;
      var dueDate = getScheduleDueDate(schedule);
      if (!dueDate) continue;
      if (dueDate >= today) continue;
      if (getScheduleKind(schedule) === 'claim') continue;

      var remaining = getScheduleRemaining(schedule);
      if (remaining > 0) {
        count += 1;
        continue;
      }
      break;
    }
    return count;
  }

  function buildMetrics(options) {
    options = options && typeof options === 'object' ? options : {};

    var loans = getStateList('loans');
    var claims = getStateList('claims');
    var debtors = getStateList('debtors');
    var schedules = getSchedules();
    var today = getTodayDate(options.today);
    var riskRange = normalizeRange(options.riskRange);

    var debtorById = Object.create(null);
    for (var di = 0; di < debtors.length; di++) {
      var debtor = debtors[di];
      if (!debtor || debtor.id == null) continue;
      debtorById[String(debtor.id)] = debtor;
    }

    var finance = {
      loan: { total: 0, paid: 0, planned: 0, overdue: 0, remaining: 0 },
      claim: { total: 0, paid: 0, outstanding: 0, duePassedOutstanding: 0 },
      debt: { total: 0, paid: 0, planned: 0, overdue: 0 }
    };

    var scheduleStatus = {
      counts: Object.create(null),
      amounts: Object.create(null)
    };

    var risk = {
      totalOperationalExposure: 0,
      loanOverdueAmount: 0,
      claimDuePassedAmount: 0,
      plannedDueBase: 0,
      overdueRate: 0,
      maxOverdueDays: 0,
      highRiskCount: 0,
      aging: {
        '0_7': { count: 0, amount: 0 },
        '8_30': { count: 0, amount: 0 },
        '31_90': { count: 0, amount: 0 },
        '90p': { count: 0, amount: 0 }
      },
      debtors: []
    };

    var counts = {
      totalDebtors: debtors.length,
      activeDebtors: 0,
      totalLoans: loans.length,
      activeLoans: 0,
      totalClaims: claims.length,
      activeClaims: 0
    };

    var paidByLoanId = Object.create(null);
    var paidByClaimId = Object.create(null);
    var activeDebtorIds = Object.create(null);
    var debtorAuxMap = Object.create(null);
    var riskDebtorMap = Object.create(null);

    for (var li = 0; li < loans.length; li++) {
      finance.loan.total += clampNonNegative(loans[li] && loans[li].totalRepayAmount);
    }
    for (var ci = 0; ci < claims.length; ci++) {
      finance.claim.total += clampNonNegative(claims[ci] && claims[ci].amount);
    }

    for (var si = 0; si < schedules.length; si++) {
      var schedule = schedules[si];
      if (!schedule) continue;

      var status = getScheduleStatus(schedule);
      var kind = getScheduleKind(schedule);
      var amount = getScheduleAmount(schedule);
      var paidAmount = getSchedulePaidAmount(schedule);
      var remaining = getScheduleRemaining(schedule);
      var dueDate = getScheduleDueDate(schedule);
      var duePassed = !!(dueDate && dueDate < today);
      if (kind === 'claim') {
        duePassed = false;
      }
      var debtorId = toKey(
        schedule.debtorId != null ? schedule.debtorId :
        schedule.loanDebtorId != null ? schedule.loanDebtorId :
        schedule.claimDebtorId != null ? schedule.claimDebtorId :
        ''
      );
      var debtor = debtorId ? debtorById[debtorId] : null;
      var debtorName = debtor && debtor.name ? String(debtor.name) : '';

      ensureStatusKey(scheduleStatus.counts, status);
      ensureStatusKey(scheduleStatus.amounts, status);
      scheduleStatus.counts[status] += 1;
      scheduleStatus.amounts[status] += (status === 'PAID') ? paidAmount : remaining;

      var aux = getDebtorAux(debtorAuxMap, debtorId, debtorName);
      if (aux) {
        aux.relevantSchedules.push(schedule);
        if (duePassed && status === 'PARTIAL' && remaining > 0) {
          aux.partialPatternCount += 1;
        }
        var paidTraceDate = getSchedulePaidTraceDate(schedule, today);
        if (paidTraceDate) {
          aux.hasPaidTrace = true;
          if (!aux.lastPaidDate || paidTraceDate > aux.lastPaidDate) {
            aux.lastPaidDate = paidTraceDate;
          }
        }
      }

      if (kind === 'loan') {
        finance.loan.paid += paidAmount;
        var loanId = toKey(schedule.loanId != null ? schedule.loanId : schedule.loan_id);
        if (loanId) {
          paidByLoanId[loanId] = (paidByLoanId[loanId] || 0) + paidAmount;
        }
        if (remaining > 0) {
          if (duePassed) finance.loan.overdue += remaining;
          else finance.loan.planned += remaining;
        }
        if (dueDate && dueDate <= today && isWithinRange(dueDate, riskRange)) {
          risk.plannedDueBase += amount;
        }
      } else if (kind === 'claim') {
        finance.claim.paid += paidAmount;
        var claimId = toKey(schedule.claimId != null ? schedule.claimId : schedule.claim_id);
        if (claimId) {
          paidByClaimId[claimId] = (paidByClaimId[claimId] || 0) + paidAmount;
        }
        if (remaining > 0 && duePassed) {
          finance.claim.duePassedOutstanding += remaining;
        }
      }

      if (!(remaining > 0 && duePassed && isWithinRange(dueDate, riskRange))) {
        continue;
      }

      var overdueDays = diffDays(today, dueDate);
      if (overdueDays <= 0) continue;

      risk.totalOperationalExposure += remaining;
      if (kind === 'loan') {
        risk.loanOverdueAmount += remaining;
      } else if (kind === 'claim') {
        risk.claimDuePassedAmount += remaining;
      }
      if (overdueDays > risk.maxOverdueDays) {
        risk.maxOverdueDays = overdueDays;
      }

      var agingBucket = overdueDays <= 7 ? risk.aging['0_7']
        : overdueDays <= 30 ? risk.aging['8_30']
        : overdueDays <= 90 ? risk.aging['31_90']
        : risk.aging['90p'];
      agingBucket.count += 1;
      agingBucket.amount += remaining;

      if (aux) {
        aux.overdueCount += 1;
        aux.operationalExposure += remaining;
        aux.overdueSchedules.push(schedule);
        if (overdueDays > aux.maxOverdueDays) {
          aux.maxOverdueDays = overdueDays;
        }
      }

      if (!debtorId) continue;
      var riskDebtor = riskDebtorMap[debtorId];
      if (!riskDebtor) {
        riskDebtor = riskDebtorMap[debtorId] = {
          debtorId: debtorId,
          name: debtorName || ('채무자 #' + debtorId),
          loanOverdueAmount: 0,
          claimDuePassedAmount: 0,
          operationalExposure: 0,
          overdueCount: 0,
          maxOverdueDays: 0,
          consecutiveMissCount: 0,
          paymentStopDays: 0,
          partialPatternCount: 0,
          riskScore: 0,
          tier: 'low',
          reasons: [],
          primaryReasons: [],
          schedules: []
        };
      }

      if (kind === 'loan') {
        riskDebtor.loanOverdueAmount += remaining;
      } else if (kind === 'claim') {
        riskDebtor.claimDuePassedAmount += remaining;
      }
      riskDebtor.operationalExposure += remaining;
      riskDebtor.overdueCount += 1;
      if (overdueDays > riskDebtor.maxOverdueDays) {
        riskDebtor.maxOverdueDays = overdueDays;
      }
      riskDebtor.schedules.push(schedule);
    }

    finance.loan.remaining = finance.loan.planned + finance.loan.overdue;
    finance.claim.outstanding = Math.max(finance.claim.total - finance.claim.paid, 0);
    finance.debt.total = finance.loan.total + finance.claim.total;
    finance.debt.paid = finance.loan.paid + finance.claim.paid;
    finance.debt.planned = finance.loan.planned + finance.claim.outstanding;
    finance.debt.overdue = finance.loan.overdue;

    for (var loanIndex = 0; loanIndex < loans.length; loanIndex++) {
      var loan = loans[loanIndex];
      if (!loan || loan.id == null) continue;
      var loanKey = String(loan.id);
      var loanTotal = clampNonNegative(loan.totalRepayAmount);
      var paidByLoan = paidByLoanId[loanKey] || 0;
      var loanRemaining = Math.max(loanTotal - paidByLoan, 0);
      if (loanRemaining > 0) {
        counts.activeLoans += 1;
        var activeLoanDebtorId = toKey(loan.debtorId);
        if (activeLoanDebtorId) activeDebtorIds[activeLoanDebtorId] = true;
      }
    }

    for (var claimIndex = 0; claimIndex < claims.length; claimIndex++) {
      var claim = claims[claimIndex];
      if (!claim || claim.id == null) continue;
      var claimKey = String(claim.id);
      var claimTotal = clampNonNegative(claim.amount);
      var paidByClaim = paidByClaimId[claimKey] || 0;
      var claimRemaining = Math.max(claimTotal - paidByClaim, 0);
      if (claimRemaining > 0) {
        counts.activeClaims += 1;
        var activeClaimDebtorId = toKey(claim.debtorId);
        if (activeClaimDebtorId) activeDebtorIds[activeClaimDebtorId] = true;
      }
    }

    counts.activeDebtors = Object.keys(activeDebtorIds).length;

    var riskDebtorList = [];
    for (var debtorKey in riskDebtorMap) {
      if (!Object.prototype.hasOwnProperty.call(riskDebtorMap, debtorKey)) continue;
      var item = riskDebtorMap[debtorKey];
      var debtorAux = debtorAuxMap[debtorKey] || null;
      var reasons = [];
      var score = 0;

      item.schedules = dedupeSchedules(item.schedules);
      item.partialPatternCount = debtorAux ? Number(debtorAux.partialPatternCount) || 0 : 0;
      item.consecutiveMissCount = debtorAux ? computeConsecutiveMissCount(debtorAux.relevantSchedules, today) : 0;

      var lastPaymentTraceDate = debtorAux ? getDebtorLastPaymentTraceDate(debtorAux.relevantSchedules, today) : null;
      var hasPaidTrace = !!lastPaymentTraceDate;
      var paymentStopDays = hasPaidTrace ? Math.max(diffDays(today, lastPaymentTraceDate), 0) : null;
      item.lastPaymentTraceDate = lastPaymentTraceDate;
      item.paymentStopDays = paymentStopDays;

      if (item.consecutiveMissCount >= RULES.CONSECUTIVE_MISS_THRESHOLD) {
        reasons.push('연속 미납 ' + item.consecutiveMissCount + '회');
        score += 2;
      }

      if (item.operationalExposure > 0) {
        if (hasPaidTrace && item.paymentStopDays >= RULES.PAYMENT_STOP_DAYS_THRESHOLD) {
          reasons.push('최근 상환 흔적 ' + item.paymentStopDays + '일 없음');
          score += 2;
        } else if (!hasPaidTrace) {
          reasons.push('최근 상환 흔적 없음');
          score += 2;
        }
      }

      if (item.partialPatternCount >= RULES.PARTIAL_PATTERN_THRESHOLD) {
        reasons.push('부분납 후 잔액 지속 ' + item.partialPatternCount + '회');
        score += 1;
      }

      if (item.loanOverdueAmount >= RULES.HIGH_OVERDUE_AMOUNT_THRESHOLD) {
        reasons.push('대출 기한경과 잔액 ' + formatReasonCurrency(item.loanOverdueAmount));
        score += 2;
      }

      if (item.claimDuePassedAmount > 0) {
        reasons.push('채권 기한경과 잔액 존재');
        score += 1;
      }

      if (item.maxOverdueDays >= RULES.HIGH_OVERDUE_DAYS_THRESHOLD) {
        reasons.push('최장 연체 ' + item.maxOverdueDays + '일');
        score += 2;
      }

      item.reasons = reasons;
      item.primaryReasons = reasons.slice(0, 2);
      item.riskScore = score;
      if (score >= 4) item.tier = 'high';
      else if (score >= 2) item.tier = 'medium';
      else item.tier = 'low';

      if (item.tier === 'high') {
        risk.highRiskCount += 1;
      }
      riskDebtorList.push(item);
    }

    riskDebtorList.sort(function (a, b) {
      if ((b.riskScore || 0) !== (a.riskScore || 0)) {
        return (b.riskScore || 0) - (a.riskScore || 0);
      }
      if ((b.operationalExposure || 0) !== (a.operationalExposure || 0)) {
        return (b.operationalExposure || 0) - (a.operationalExposure || 0);
      }
      if ((b.maxOverdueDays || 0) !== (a.maxOverdueDays || 0)) {
        return (b.maxOverdueDays || 0) - (a.maxOverdueDays || 0);
      }
      return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
    });

    risk.debtors = riskDebtorList;
    risk.overdueRate = risk.plannedDueBase > 0
      ? (risk.loanOverdueAmount / risk.plannedDueBase) * 100
      : 0;

    return {
      today: today,
      finance: finance,
      scheduleStatus: {
        counts: scheduleStatus.counts,
        amounts: scheduleStatus.amounts
      },
      risk: risk,
      counts: counts,
      rules: {
        CONSECUTIVE_MISS_THRESHOLD: RULES.CONSECUTIVE_MISS_THRESHOLD,
        PAYMENT_STOP_DAYS_THRESHOLD: RULES.PAYMENT_STOP_DAYS_THRESHOLD,
        PARTIAL_PATTERN_THRESHOLD: RULES.PARTIAL_PATTERN_THRESHOLD,
        HIGH_OVERDUE_AMOUNT_THRESHOLD: RULES.HIGH_OVERDUE_AMOUNT_THRESHOLD,
        HIGH_OVERDUE_DAYS_THRESHOLD: RULES.HIGH_OVERDUE_DAYS_THRESHOLD,
        consecutiveMissCount: RULES.CONSECUTIVE_MISS_THRESHOLD,
        paymentStopDays: RULES.PAYMENT_STOP_DAYS_THRESHOLD,
        partialPatternCount: RULES.PARTIAL_PATTERN_THRESHOLD,
        highAmount: RULES.HIGH_OVERDUE_AMOUNT_THRESHOLD,
        highDays: RULES.HIGH_OVERDUE_DAYS_THRESHOLD
      }
    };
  }

  App.features.portfolioMetrics = {
    build: buildMetrics,
    getRules: function () {
      return {
        CONSECUTIVE_MISS_THRESHOLD: RULES.CONSECUTIVE_MISS_THRESHOLD,
        PAYMENT_STOP_DAYS_THRESHOLD: RULES.PAYMENT_STOP_DAYS_THRESHOLD,
        PARTIAL_PATTERN_THRESHOLD: RULES.PARTIAL_PATTERN_THRESHOLD,
        HIGH_OVERDUE_AMOUNT_THRESHOLD: RULES.HIGH_OVERDUE_AMOUNT_THRESHOLD,
        HIGH_OVERDUE_DAYS_THRESHOLD: RULES.HIGH_OVERDUE_DAYS_THRESHOLD,
        consecutiveMissCount: RULES.CONSECUTIVE_MISS_THRESHOLD,
        paymentStopDays: RULES.PAYMENT_STOP_DAYS_THRESHOLD,
        partialPatternCount: RULES.PARTIAL_PATTERN_THRESHOLD,
        highAmount: RULES.HIGH_OVERDUE_AMOUNT_THRESHOLD,
        highDays: RULES.HIGH_OVERDUE_DAYS_THRESHOLD
      };
    },
    helpers: {
      getSchedulePaidAmount: getSchedulePaidAmount,
      getScheduleRemaining: getScheduleRemaining,
      getScheduleDueDate: getScheduleDueDate,
      getTodayDate: getTodayDate,
      getSchedulePaidTraceDate: getSchedulePaidTraceDate,
      getDebtorLastPaymentTraceDate: getDebtorLastPaymentTraceDate,
      computeConsecutiveMissCount: computeConsecutiveMissCount,
      getScheduleStatus: getScheduleStatus
    }
  };

  App.portfolioMetrics = App.features.portfolioMetrics;
})(window);
