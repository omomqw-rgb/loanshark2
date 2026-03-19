(function (window) {
  'use strict';
  var App = window.App || (window.App = {});
  App.reportCompute = App.reportCompute || {};

  function clonePlain(value) {
    if (!value || typeof value !== 'object') return value;
    return JSON.parse(JSON.stringify(value));
  }

  function getWeekSemantics() {
    return {
      weekStartsOn: 1,
      weekAnchor: 'monday',
      label: '월요일 시작 주간 기준',
      shortLabel: '월요일 시작',
      description: 'Report 전체 주간 해석은 월요일 시작(Monday anchor) 기준입니다.'
    };
  }

  function toDate(value) {
    if (!value) return null;
    var date = new Date(value);
    if (isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function computeReportAggregates() {
    var state = App.state || {};
    var loans = Array.isArray(state.loans) ? state.loans : [];
    var claims = Array.isArray(state.claims) ? state.claims : [];
    var debtors = Array.isArray(state.debtors) ? state.debtors : [];
    var schedules = [];

    if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      try {
        schedules = App.schedulesEngine.getAll() || [];
      } catch (e) {
        schedules = [];
      }
    }

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    var weekStart = getWeekStart(today);
    var weekEnd = getWeekEnd(weekStart);

    var riskRange = null;
    if (App.reportState && typeof App.reportState.getRisk === 'function') {
      riskRange = App.reportState.getRisk();
    } else if (App.reportRiskState) {
      riskRange = App.reportRiskState;
    }

    var metrics = (App.portfolioMetrics && typeof App.portfolioMetrics.build === 'function')
      ? App.portfolioMetrics.build({ riskRange: riskRange })
      : null;

    var finance = metrics && metrics.finance ? metrics.finance : {
      loan: { total: 0, paid: 0, planned: 0, overdue: 0, remaining: 0 },
      claim: { total: 0, paid: 0, outstanding: 0, duePassedOutstanding: 0 },
      debt: { total: 0, paid: 0, planned: 0, overdue: 0 }
    };
    var countsMetrics = metrics && metrics.counts ? metrics.counts : {};
    var scheduleMetrics = metrics && metrics.scheduleStatus ? metrics.scheduleStatus : { counts: {}, amounts: {} };

    var totals = {
      loanPrincipal: 0,
      loanTotalRepay: Number(finance.loan.total) || 0,
      claimAmount: Number(finance.claim.total) || 0,
      debtTotal: Number(finance.debt.total) || 0,
      claimCollectedTotal: Number(finance.claim.paid) || 0,
      allCollectedTotal: Number(finance.debt.paid) || 0,
      allOutstandingTotal: (Number(finance.loan.remaining) || 0) + (Number(finance.claim.outstanding) || 0),
      loanOutstanding: Number(finance.loan.remaining) || 0,
      claimOutstanding: Number(finance.claim.outstanding) || 0
    };

    for (var li = 0; li < loans.length; li++) {
      totals.loanPrincipal += Number(loans[li] && loans[li].principal) || 0;
    }

    var statusBuckets = {
      PLANNED: { count: 0, amount: 0 },
      PAID: { count: 0, amount: 0 },
      PARTIAL: { count: 0, amount: 0, partialAmount: 0 },
      OVERDUE: { count: 0, amount: 0 }
    };
    var statusDays = {
      PLANNED: { totalDays: 0, count: 0 },
      PAID: { totalDays: 0, count: 0 },
      PARTIAL: { totalDays: 0, count: 0 },
      OVERDUE: { totalDays: 0, count: 0 }
    };
    var ageBuckets = {
      bucket0_30: { count: 0, amount: 0 },
      bucket31_60: { count: 0, amount: 0 },
      bucket61_90: { count: 0, amount: 0 },
      bucket90p: { count: 0, amount: 0 }
    };
    var period = {
      weekPlanned: 0,
      weekExpected: 0,
      weekCollected: 0,
      monthPlanned: 0,
      monthExpected: 0,
      monthCollected: 0,
      weekClaimCollected: 0,
      monthClaimCollected: 0
    };

    var helpers = App.portfolioMetrics && App.portfolioMetrics.helpers ? App.portfolioMetrics.helpers : null;
    var getDueDate = helpers && helpers.getScheduleDueDate ? helpers.getScheduleDueDate : function (schedule) { return toDate(schedule && schedule.dueDate); };
    var getPaidAmount = helpers && helpers.getSchedulePaidAmount ? helpers.getSchedulePaidAmount : function () { return 0; };
    var getRemaining = helpers && helpers.getScheduleRemaining ? helpers.getScheduleRemaining : function () { return 0; };
    var getStatus = helpers && helpers.getScheduleStatus ? helpers.getScheduleStatus : function (schedule) { return String(schedule && schedule.status || 'PLANNED').toUpperCase(); };

    for (var si = 0; si < schedules.length; si++) {
      var schedule = schedules[si];
      if (!schedule) continue;
      var status = getStatus(schedule);
      var amount = Number(schedule.amount) || 0;
      var paidAmount = getPaidAmount(schedule);
      var remaining = getRemaining(schedule);
      var due = getDueDate(schedule);

      if (!Object.prototype.hasOwnProperty.call(statusBuckets, status)) {
        statusBuckets[status] = { count: 0, amount: 0 };
      }
      statusBuckets[status].count = (scheduleMetrics.counts && scheduleMetrics.counts[status]) || statusBuckets[status].count;
      statusBuckets[status].amount = (scheduleMetrics.amounts && scheduleMetrics.amounts[status]) || statusBuckets[status].amount;
      if (status === 'PARTIAL') {
        statusBuckets[status].partialAmount = (statusBuckets[status].partialAmount || 0) + paidAmount;
      }

      if (due && statusDays[status]) {
        var diff = Math.floor((today.getTime() - due.getTime()) / 86400000);
        if (diff > 0) {
          statusDays[status].totalDays += diff;
          statusDays[status].count += 1;
          var bucket = diff <= 30 ? ageBuckets.bucket0_30 : diff <= 60 ? ageBuckets.bucket31_60 : diff <= 90 ? ageBuckets.bucket61_90 : ageBuckets.bucket90p;
          bucket.count += 1;
          bucket.amount += remaining > 0 ? remaining : amount;
        }
      }

      if (due) {
        var inWeek = due >= weekStart && due <= weekEnd;
        var inMonth = due >= monthStart && due <= today;
        if (inWeek) {
          period.weekExpected += amount;
          period.weekCollected += paidAmount;
          if ((schedule.kind || '').toLowerCase() === 'claim') {
            period.weekClaimCollected += paidAmount;
          }
        }
        if (inMonth) {
          period.monthExpected += amount;
          period.monthCollected += paidAmount;
          if ((schedule.kind || '').toLowerCase() === 'claim') {
            period.monthClaimCollected += paidAmount;
          }
        }
      }
    }

    for (var statusKey in (scheduleMetrics.counts || {})) {
      if (!Object.prototype.hasOwnProperty.call(scheduleMetrics.counts, statusKey)) continue;
      if (!Object.prototype.hasOwnProperty.call(statusBuckets, statusKey)) {
        statusBuckets[statusKey] = { count: 0, amount: 0 };
      }
      statusBuckets[statusKey].count = scheduleMetrics.counts[statusKey] || 0;
      statusBuckets[statusKey].amount = (scheduleMetrics.amounts && scheduleMetrics.amounts[statusKey]) || 0;
    }

    var counts = {
      totalLoans: countsMetrics.totalLoans != null ? countsMetrics.totalLoans : loans.length,
      totalClaims: countsMetrics.totalClaims != null ? countsMetrics.totalClaims : claims.length,
      activeLoans: countsMetrics.activeLoans || 0,
      activeClaims: countsMetrics.activeClaims || 0,
      totalDebtors: countsMetrics.totalDebtors != null ? countsMetrics.totalDebtors : debtors.length,
      activeDebtors: countsMetrics.activeDebtors || 0
    };

    return {
      today: today,
      monthStart: monthStart,
      weekStart: weekStart,
      weekEnd: weekEnd,
      weekSemantics: clonePlain(getWeekSemantics()),
      totals: totals,
      statusBuckets: statusBuckets,
      statusDays: statusDays,
      ageBuckets: ageBuckets,
      period: period,
      counts: counts,
      metrics: metrics
    };
  }

  function pad2(value) {
    return value < 10 ? '0' + value : '' + value;
  }

  function formatDateKey(date) {
    if (!date) return '';
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function getWeekStart(date) {
    var base = toDate(date);
    if (!base) return null;
    var weekday = (base.getDay() + 6) % 7;
    base.setDate(base.getDate() - weekday);
    base.setHours(0, 0, 0, 0);
    return base;
  }

  function getWeekEnd(date) {
    var start = getWeekStart(date);
    if (!start) return null;
    var end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  function getMonthStart(date) {
    var base = toDate(date);
    if (!base) return null;
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    return base;
  }

  function getTrendBucketStart(date, period) {
    if (!date) return null;
    if (period === 'daily') return toDate(date);
    if (period === 'weekly') return getWeekStart(date);
    return getMonthStart(date);
  }

  function getTrendBucketKey(date, period) {
    var start = getTrendBucketStart(date, period);
    if (!start) return '';
    if (period === 'daily') {
      return formatDateKey(start);
    }
    if (period === 'weekly') {
      return formatDateKey(start);
    }
    return start.getFullYear() + '-' + pad2(start.getMonth() + 1);
  }

  function incrementTrendBucket(cursor, period) {
    var base = getTrendBucketStart(cursor, period) || toDate(cursor);
    if (!base) return null;
    var next = new Date(base);
    if (period === 'daily') {
      next.setDate(next.getDate() + 1);
    } else if (period === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else {
      next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    }
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function normalizeBucketLabel(bucketKey, period) {
    if (!bucketKey) return '';
    if (period === 'daily') {
      return bucketKey.length >= 10 ? bucketKey.slice(5) : bucketKey;
    }
    if (period === 'weekly') {
      return bucketKey.length >= 10 ? (bucketKey.slice(5) + ' 주간') : (bucketKey + ' 주간');
    }
    return bucketKey;
  }

  function getTrendLogDate(value) {
    return toDate(value);
  }

  function getCapitalFlowSourceLogs() {
    if (App.cashLedger && typeof App.cashLedger.getEffectiveLogs === 'function') {
      try {
        var effective = App.cashLedger.getEffectiveLogs();
        if (Array.isArray(effective)) return effective;
      } catch (e) {}
    }
    var state = App.state || {};
    return Array.isArray(state.cashLogs) ? state.cashLogs : [];
  }

  function getTrendRangeState() {
    if (App.reportState && typeof App.reportState.getTrend === 'function') {
      return App.reportState.getTrend() || {};
    }
    return App.reportTrendState || {};
  }

  function isLoanOrClaimRef(log) {
    var ref = '';
    if (log && log.refKind != null) ref = String(log.refKind).toLowerCase();
    else if (log && log.refType != null) ref = String(log.refType).toLowerCase();
    return ref === 'loan' || ref === 'claim';
  }

  function computeTrendSeries(period) {
    var resolvedPeriod = (period === 'daily' || period === 'weekly' || period === 'monthly') ? period : 'monthly';
    var trendState = getTrendRangeState();
    var fromDate = trendState && trendState.dateFrom ? getTrendLogDate(trendState.dateFrom) : null;
    var toDateLimit = trendState && trendState.dateTo ? getTrendLogDate(trendState.dateTo) : null;
    if (fromDate && toDateLimit && fromDate > toDateLimit) {
      var swapped = fromDate;
      fromDate = toDateLimit;
      toDateLimit = swapped;
    }
    var logs = getCapitalFlowSourceLogs();
    var buckets = {};
    var sourceLogCount = Array.isArray(logs) ? logs.length : 0;
    var matchedLogCount = 0;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var hasExplicitRange = !!(fromDate && toDateLimit);

    function ensureBucket(key) {
      if (!key) return null;
      if (!buckets[key]) {
        buckets[key] = { inflow: 0, outflow: 0, net: 0 };
      }
      return buckets[key];
    }

    for (var i = 0; i < logs.length; i++) {
      var row = logs[i];
      if (!row) continue;
      var type = String(row.type || '').toUpperCase();
      var date = getTrendLogDate(row.date || row.createdAt || null);
      if (!date) continue;
      if (date > today) continue;
      if (fromDate && date < fromDate) continue;
      if (toDateLimit && date > toDateLimit) continue;

      var includeInflow = false;
      var includeOutflow = false;
      if (type === 'LOAN_EXECUTION') {
        includeOutflow = true;
      } else if (type === 'AUTO_IN' && isLoanOrClaimRef(row)) {
        includeInflow = true;
      } else {
        continue;
      }

      var amount = Number(row.amount) || 0;
      if (!amount) continue;
      amount = Math.abs(amount);
      matchedLogCount += 1;

      var key = getTrendBucketKey(date, resolvedPeriod);
      var bucket = ensureBucket(key);
      if (!bucket) continue;
      if (includeOutflow) bucket.outflow += amount;
      if (includeInflow) bucket.inflow += amount;
    }

    var isZeroFilled = false;
    if (hasExplicitRange) {
      var startCursor = getTrendBucketStart(fromDate, resolvedPeriod);
      var endCursor = getTrendBucketStart(toDateLimit, resolvedPeriod);
      var guard = 0;
      while (startCursor && endCursor && startCursor <= endCursor && guard < 2000) {
        ensureBucket(getTrendBucketKey(startCursor, resolvedPeriod));
        startCursor = incrementTrendBucket(startCursor, resolvedPeriod);
        guard += 1;
      }
      isZeroFilled = true;
    }

    var keys = Object.keys(buckets).sort();
    var labels = [];
    var inflow = [];
    var outflow = [];
    var net = [];
    var velocity = [];

    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var bucket = buckets[key] || { inflow: 0, outflow: 0, net: 0 };
      bucket.net = (bucket.inflow || 0) - (bucket.outflow || 0);
      var v = bucket.outflow > 0 ? (bucket.inflow / bucket.outflow) * 100 : 0;
      labels.push(normalizeBucketLabel(key, resolvedPeriod));
      inflow.push(bucket.inflow || 0);
      outflow.push(bucket.outflow || 0);
      net.push(bucket.net || 0);
      velocity.push(v);
    }

    return {
      period: resolvedPeriod,
      basis: 'cashlogs',
      dateFrom: fromDate ? formatDateKey(fromDate) : null,
      dateTo: toDateLimit ? formatDateKey(toDateLimit) : null,
      bucketKeys: keys,
      labels: labels,
      inflow: inflow,
      outflow: outflow,
      net: net,
      velocity: velocity,
      bucketCount: keys.length,
      hasExplicitRange: hasExplicitRange,
      isZeroFilled: isZeroFilled,
      sourceLogCount: sourceLogCount,
      matchedLogCount: matchedLogCount,
      weekSemantics: clonePlain(getWeekSemantics())
    };
  }

  function computeTrendSummary(velocitySeries) {
    var arr = (velocitySeries || []).filter(function (value) {
      return typeof value === 'number' && !isNaN(value);
    });
    if (!arr.length) {
      return { peak: 0, min: 0, avg3: 0 };
    }
    var peak = Math.max.apply(null, arr);
    var min = Math.min.apply(null, arr);
    var recent = arr.slice(-3);
    var sum = recent.reduce(function (acc, value) { return acc + value; }, 0);
    return {
      peak: peak,
      min: min,
      avg3: sum / recent.length
    };
  }

  App.reportCompute.computeAggregates = computeReportAggregates;
  App.reportCompute.getWeekSemantics = getWeekSemantics;
  App.reportCompute.getWeekStart = getWeekStart;
  App.reportCompute.getTrendBucketKey = getTrendBucketKey;
  App.reportCompute.computeTrendSeries = computeTrendSeries;
  App.reportCompute.computeTrendSummary = computeTrendSummary;
  App.reportCompute.incrementTrendBucket = incrementTrendBucket;
  App.reportCompute.normalizeTrendBucketLabel = normalizeBucketLabel;
})(window);
