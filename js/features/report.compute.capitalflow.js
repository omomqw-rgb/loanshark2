(function (window) {
  'use strict';
  var App = window.App || (window.App = {});
  App.reportCompute = App.reportCompute || {};

function computeReportAggregates() {
  var state = App.state || {};
  var loans = state.loans || [];
  var claims = state.claims || [];
  var schedules = [];

  if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
    try {
      schedules = App.schedulesEngine.getAll() || [];
    } catch (e) {
      schedules = [];
    }
  }

  var debtors = state.debtors || [];
  var util = App.util || {};

  function toDate(d) {
    if (!d) return null;
    var x = new Date(d);
    if (isNaN(x.getTime())) return null;
    x.setHours(0, 0, 0, 0);
    return x;
  }

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Week: Sunday 00:00 ~ Saturday 23:59
  var weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);
  var weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  var totals = {
    loanPrincipal: 0,
    loanTotalRepay: 0,
    claimAmount: 0,
    debtTotal: 0,
    claimCollectedTotal: 0,
    allCollectedTotal: 0,
    allOutstandingTotal: 0,
    loanOutstanding: 0,
    claimOutstanding: 0
  };

  loans.forEach(function (loan) {
    var p = Number(loan.principal) || 0;
    var t = Number(loan.totalRepayAmount) || 0;
    totals.loanPrincipal += p;
    totals.loanTotalRepay += t;
  });

  claims.forEach(function (claim) {
    var a = Number(claim.amount) || 0;
    totals.claimAmount += a;
  });

  totals.debtTotal = totals.loanTotalRepay + totals.claimAmount;

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

  var activeLoanIds = {};
  var activeClaimIds = {};

  schedules.forEach(function (sch) {
    var amt = Number(sch.amount) || 0;
    var status = sch.status || 'PLANNED';
    var partialPaid = Number(sch.partialPaidAmount) || 0;
    var due = toDate(sch.dueDate);

    var paidAmt = 0;
    if (status === 'PAID') paidAmt = amt;
    else if (status === 'PARTIAL') paidAmt = partialPaid;

    var remaining = amt - paidAmt;
    if (remaining < 0) remaining = 0;

    if (statusBuckets[status]) {
      statusBuckets[status].count += 1;
      statusBuckets[status].amount += amt;
      if (status === 'PARTIAL') {
        statusBuckets[status].partialAmount += paidAmt;
      }
    }

    // 상태별 평균 경과일 계산용 (dueDate 기준, 오늘보다 지난 경우만)
    if (due && statusDays[status]) {
      var diffMs = today.getTime() - due.getTime();
      var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        statusDays[status].totalDays += diffDays;
        statusDays[status].count += 1;

        // 연체 구간 통계 (전체 기준)
        var bucket = null;
        if (diffDays <= 30) bucket = ageBuckets.bucket0_30;
        else if (diffDays <= 60) bucket = ageBuckets.bucket31_60;
        else if (diffDays <= 90) bucket = ageBuckets.bucket61_90;
        else bucket = ageBuckets.bucket90p;
        if (bucket) {
          bucket.count += 1;
          bucket.amount += amt;
        }
      }
    }

    totals.allCollectedTotal += paidAmt;
    totals.allOutstandingTotal += remaining;

    if (sch.kind === 'claim') {
      totals.claimCollectedTotal += paidAmt;
    }

    if (sch.kind === 'loan') {
      if (remaining > 0) {
        activeLoanIds[sch.loanId] = true;
        totals.loanOutstanding += remaining;
      }
    } else if (sch.kind === 'claim') {
      if (remaining > 0) {
        activeClaimIds[sch.claimId] = true;
        totals.claimOutstanding += remaining;
      }
    }

    if (due) {
      var inWeek = (due >= weekStart && due <= weekEnd);
      var inMonth = (due >= monthStart && due <= today);

      if (inWeek) {
        period.weekExpected += amt;
        period.weekCollected += paidAmt;
        if (sch.kind === 'claim') {
          period.weekClaimCollected += paidAmt;
        }
      }
      if (inMonth) {
        period.monthExpected += amt;
        period.monthCollected += paidAmt;
        if (sch.kind === 'claim') {
          period.monthClaimCollected += paidAmt;
        }
      }
    }
  });

  var counts = {
    totalLoans: loans.length,
    totalClaims: claims.length,
    activeLoans: Object.keys(activeLoanIds).length,
    activeClaims: Object.keys(activeClaimIds).length,
    totalDebtors: debtors.length
  };

  return {
    today: today,
    monthStart: monthStart,
    weekStart: weekStart,
    weekEnd: weekEnd,
    totals: totals,
    statusBuckets: statusBuckets,
    statusDays: statusDays,
    ageBuckets: ageBuckets,
    period: period,
    counts: counts
  };
}function formatCurrencySafe(util, value) {
  var n = Number(value) || 0;
  if (!util || !util.formatCurrency) return String(n);
  return util.formatCurrency(n);
}

function formatNumberSafe(util, value) {
  var n = Number(value) || 0;
  if (!util || !util.formatNumber) return String(n);
  return util.formatNumber(n);
}

function updateOverviewKPI(root, agg) {
  var util = App.util || {};
  var totals = agg.totals;
  var period = agg.period;

  // ① 대출규모 – 전체 누적 기준
  var loanCard = root.querySelector('.report-kpi-card[data-kpi="loan"]');
  if (loanCard) {
    var mainValue = loanCard.querySelector('.report-kpi-main .report-kpi-value');
    if (mainValue) {
      // 대출원리금합계 = 전체 대출 totalRepayAmount 합
      mainValue.textContent = formatCurrencySafe(util, totals.loanTotalRepay);
    }
    var subs = loanCard.querySelectorAll('.report-kpi-submetrics .submetric');
    subs.forEach(function (s) {
      var labelEl = s.querySelector('.submetric-label');
      var valueEl = s.querySelector('.submetric-value');
      if (!labelEl || !valueEl) return;
      var label = labelEl.textContent.trim();
      if (label.indexOf('대출원금합계') !== -1) {
        valueEl.textContent = formatCurrencySafe(util, totals.loanPrincipal);
      }
    });
  }

  // ② 채권규모 – 전체 누적 기준
  var claimCard = root.querySelector('.report-kpi-card[data-kpi="claim"]');
  if (claimCard) {
    var mainValue2 = claimCard.querySelector('.report-kpi-main .report-kpi-value');
    if (mainValue2) {
      // 채권금액합계 = 전체 채권 amount 합
      mainValue2.textContent = formatCurrencySafe(util, totals.claimAmount);
    }
    var subs2 = claimCard.querySelectorAll('.report-kpi-submetrics .submetric');
    subs2.forEach(function (s) {
      var labelEl = s.querySelector('.submetric-label');
      var valueEl = s.querySelector('.submetric-value');
      if (!labelEl || !valueEl) return;
      var label = labelEl.textContent.trim();
      if (label.indexOf('채권회수금액합계') !== -1) {
        // 전체 채권 회수금액 합계
        valueEl.textContent = formatCurrencySafe(util, totals.claimCollectedTotal);
      }
    });
  }

  // ③ 운영현황 – 이번달 기준 신규대출/신규채권 (금액/건수)
  var opsCard = root.querySelector('.report-kpi-card[data-kpi="ops"]');
  if (opsCard) {
    var subsOps = opsCard.querySelectorAll('.report-kpi-submetrics .submetric');
    subsOps.forEach(function (s) {
      var labelEl = s.querySelector('.submetric-label');
      var valueEl = s.querySelector('.submetric-value');
      if (!labelEl || !valueEl) return;
      var label = labelEl.textContent.trim();

      if (label.indexOf('신규대출금액') !== -1) {
        var amountLoan = 0;
        var countLoan = 0;
        var loans = (App.state && App.state.loans) || [];
        loans.forEach(function (loan) {
          var created = (function (d) {
            if (!d) return null;
            var x = new Date(d);
            if (isNaN(x.getTime())) return null;
            x.setHours(0, 0, 0, 0);
            return x;
          })(loan.createdAt || loan.startDate);
          if (created && created >= agg.monthStart && created <= agg.today) {
            amountLoan += Number(loan.principal) || 0;
            countLoan += 1;
          }
        });
        valueEl.textContent = formatCurrencySafe(util, amountLoan) + ' / ' + formatNumberSafe(util, countLoan) + '건';
      } else if (label.indexOf('신규채권금액') !== -1) {
        var amountClaim = 0;
        var countClaim = 0;
        var claims = (App.state && App.state.claims) || [];
        claims.forEach(function (claim) {
          var created = (function (d) {
            if (!d) return null;
            var x = new Date(d);
            if (isNaN(x.getTime())) return null;
            x.setHours(0, 0, 0, 0);
            return x;
          })(claim.createdAt || claim.startDate);
          if (created && created >= agg.monthStart && created <= agg.today) {
            amountClaim += Number(claim.amount) || 0;
            countClaim += 1;
          }
        });
        valueEl.textContent = formatCurrencySafe(util, amountClaim) + ' / ' + formatNumberSafe(util, countClaim) + '건';
      }
    });
  }

  // ④ 가용자산(data-kpi="avail")은 아직 공식 확정 전이라, v151에서는 건드리지 않는다.
}

  function updateRecoveryTiles(root, agg) {
  var util = App.util || {};
  var tiles = root.querySelectorAll('.recovery-kpi-card');
  tiles.forEach(function (tile) {
    var labelEl = tile.querySelector('.kpi-label');
    var valueEl = tile.querySelector('.kpi-value');
    if (!labelEl || !valueEl) return;
    var label = labelEl.textContent.trim();
    if (label.indexOf('이번주 회수 예정금액') !== -1) {
      valueEl.textContent = formatCurrencySafe(util, agg.period.weekExpected);
    } else if (label.indexOf('이번달 회수 예정금액') !== -1) {
      valueEl.textContent = formatCurrencySafe(util, agg.period.monthExpected);
    } else if (label.indexOf('이번주 회수액') !== -1) {
      valueEl.textContent = formatCurrencySafe(util, agg.period.weekCollected);
    } else if (label.indexOf('이번달 회수액') !== -1) {
      valueEl.textContent = formatCurrencySafe(util, agg.period.monthCollected);
    }
  });
}


var trendChartInstance = null;

function getTrendBucketKey(date, period) {
  if (!date) return '';
  var y = date.getFullYear();
  var m = date.getMonth() + 1;
  var d = date.getDate();
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  if (period === 'daily') {
    return y + '-' + pad(m) + '-' + pad(d);
  } else if (period === 'weekly') {
    var oneJan = new Date(y, 0, 1);
    oneJan.setHours(0, 0, 0, 0);
    var diff = (date - oneJan) / 86400000;
    var week = Math.floor(diff / 7) + 1;
    return y + '-W' + pad(week);
  }
  // default monthly
  return y + '-' + pad(m);
}

function computeTrendSeries(period) {
  var state = App.state || {};
  var loans = state.loans || [];
  var schedules = [];

  if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
    try {
      schedules = App.schedulesEngine.getAll() || [];
    } catch (e) {
      schedules = [];
    }
  }


  function toDate(d) {
    if (!d) return null;
    var x = new Date(d);
    if (isNaN(x.getTime())) return null;
    x.setHours(0, 0, 0, 0);
    return x;
  }

  // 월간 고정
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var trendState = App.reportTrendState || {};
  var fromDate = trendState.dateFrom ? toDate(trendState.dateFrom) : null;
  var toDateLimit = trendState.dateTo ? toDate(trendState.dateTo) : null;

  var buckets = {};
  // v016: ensure bucket exists for each loan startDate
  loans.forEach(function(loan){
    var d = toDate(loan.startDate || loan.start_date || loan.createdAt || loan.created_at);
    if(d){ var key=getBucketKey(d); if(key && !buckets[key]) buckets[key]={inflow:0,outflow:0,net:0};}
  });

  function getBucketKey(date) {
    if (!date) return null;
    var y = date.getFullYear();
    var m = date.getMonth() + 1;
    var mm = m < 10 ? '0' + m : '' + m;
    return y + '-' + mm; // YYYY-MM
  }

  // 1) 대출 신규 발생 = 자본 유출 (Outflow)
  loans.forEach(function (loan) {
    if (!loan) return;
    var amt = Number(loan.principal || loan.amount || loan.totalRepayAmount) || 0;
    if (!amt) return;

    var start = loan.startDate || loan.start_date || loan.createdAt || loan.created_at || null;
    var date = toDate(start);
    if (!date) return;
    if (date > today) return;
    if (fromDate && date < fromDate) return;
    if (toDateLimit && date > toDateLimit) return;

    var key = getBucketKey(date);
    if (!key) return;

    var bucket = buckets[key];
    if (!bucket) {
      bucket = buckets[key] = { inflow: 0, outflow: 0, net: 0 };
    }

    bucket.outflow += amt;
  });

  // 2) 스케줄 기반 자본 유입 (대출 상환 + 채권 회수)
  schedules.forEach(function (sch) {
    if (!sch) return;
    var amt = Number(sch.amount) || 0;
    if (!amt) return;

    var kind = sch.kind || sch.type || 'loan';
    var status = (sch.status || 'PLANNED').toUpperCase();

    var due = toDate(sch.dueDate || sch.due_date || sch.due || null);
    if (!due) return;
    if (due > today) return;
    if (fromDate && due < fromDate) return;
    if (toDateLimit && due > toDateLimit) return;

    var key = getBucketKey(due);
    if (!key) return;

    var bucket = buckets[key];
    if (!bucket) {
      bucket = buckets[key] = { inflow: 0, outflow: 0, net: 0 };
    }

    // 대출 상환 inflow
    if (kind === 'loan') {
      var partialPaid = Number(sch.partialPaidAmount) || 0;
      var paidRaw = Number(sch.paidAmount) || 0;
      var paidAmt = 0;

      if (status === 'PAID') {
        paidAmt = amt;
      } else if (status === 'PARTIAL') {
        paidAmt = partialPaid > 0 ? partialPaid : paidRaw;
      } else {
        paidAmt = paidRaw;
      }

      if (paidAmt > 0) {
        bucket.inflow += paidAmt;
      }
    }

    // 채권 회수 inflow (채권은 PARTIAL 없음, PAID만)
    if (kind === 'claim') {
      if (status === 'PAID') {
        bucket.inflow += amt;
      }
    }
  });

  var keys = Object.keys(buckets).sort();
  var labels = [];
  var inflow = [];
  var outflow = [];
  var net = [];
  var velocity = [];

  keys.forEach(function (k) {
    var b = buckets[k] || { inflow: 0, outflow: 0, net: 0 };
    b.net = (b.inflow || 0) - (b.outflow || 0);

    var v = 0;
    if (b.outflow > 0) {
      v = (b.inflow / b.outflow) * 100;
    }

    labels.push(k);
    inflow.push(b.inflow || 0);
    outflow.push(b.outflow || 0);
    net.push(b.net || 0);
    velocity.push(v);
  });

  return {
    labels: labels,
    inflow: inflow,
    outflow: outflow,
    net: net,
    velocity: velocity
  };
}
function computeTrendSummary(velocitySeries) {
  var arr = (velocitySeries || []).filter(function (v) {
    return typeof v === 'number' && !isNaN(v);
  });
  if (!arr.length) {
    return { peak: 0, min: 0, avg3: 0 };
  }
  var peak = Math.max.apply(null, arr);
  var min = Math.min.apply(null, arr);
  var recent = arr.slice(-3);
  var sum = recent.reduce(function (acc, v) { return acc + v; }, 0);
  var avg3 = sum / recent.length;
  return { peak: peak, min: min, avg3: avg3 };
}

  App.reportCompute.computeAggregates = computeReportAggregates;
  App.reportCompute.getTrendBucketKey = getTrendBucketKey;
  App.reportCompute.computeTrendSeries = computeTrendSeries;
  App.reportCompute.computeTrendSummary = computeTrendSummary;
})(window);
