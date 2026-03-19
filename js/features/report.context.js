(function (window) {
  'use strict';

  var App = window.App || (window.App = {});
  App.reportContext = App.reportContext || {};

  function clonePlain(value) {
    if (!value || typeof value !== 'object') return value;
    return JSON.parse(JSON.stringify(value));
  }

  function ensureReportState() {
    if (App.reportState && typeof App.reportState.ensure === 'function') {
      return App.reportState.ensure();
    }
    App.state = App.state || {};
    App.state.ui = App.state.ui || {};
    App.state.ui.report = App.state.ui.report || {
      activeSection: 'overview',
      portfolioMode: 'loan',
      trend: { period: 'monthly', dateFrom: null, dateTo: null },
      risk: { dateFrom: null, dateTo: null },
      legendVisibility: {
        capitalflow: {
          velocity: true,
          inflow: true,
          outflow: true,
          net: true
        }
      }
    };
    return App.state.ui.report;
  }

  function getLegendState(reportState) {
    var fallback = {
      velocity: true,
      inflow: true,
      outflow: true,
      net: true
    };
    if (App.reportState && typeof App.reportState.getLegendGroup === 'function') {
      var group = App.reportState.getLegendGroup('capitalflow');
      if (group && typeof group === 'object') {
        return {
          velocity: group.velocity !== false,
          inflow: group.inflow !== false,
          outflow: group.outflow !== false,
          net: group.net !== false
        };
      }
    }
    var source = reportState && reportState.legendVisibility && reportState.legendVisibility.capitalflow;
    if (!source || typeof source !== 'object') return fallback;
    return {
      velocity: source.velocity !== false,
      inflow: source.inflow !== false,
      outflow: source.outflow !== false,
      net: source.net !== false
    };
  }

  function createFormatters() {
    function currency(value) {
      var n = Number(value) || 0;
      if (App.util && typeof App.util.formatCurrency === 'function') {
        return App.util.formatCurrency(n);
      }
      return String(n);
    }

    function number(value) {
      var n = Number(value) || 0;
      if (App.util && typeof App.util.formatNumber === 'function') {
        return App.util.formatNumber(n);
      }
      return String(n);
    }

    function percent(value, digits) {
      var n = Number(value) || 0;
      var fixed = (typeof digits === 'number') ? digits : 1;
      return n.toFixed(fixed) + '%';
    }

    function date(value) {
      if (!value) return '';
      if (value instanceof Date && !isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
      }
      return String(value);
    }

    return {
      currency: currency,
      number: number,
      percent: percent,
      date: date
    };
  }

  function computeAggregates() {
    if (App.reportCompute && typeof App.reportCompute.computeAggregates === 'function') {
      return App.reportCompute.computeAggregates();
    }
    return null;
  }

  function getMetrics(aggregates, riskRange) {
    if (aggregates && aggregates.metrics) return aggregates.metrics;
    if (App.portfolioMetrics && typeof App.portfolioMetrics.build === 'function') {
      return App.portfolioMetrics.build({ riskRange: riskRange });
    }
    return null;
  }

  function getPeriodLabel(period) {
    if (period === 'daily') return '일';
    if (period === 'weekly') return '주';
    if (period === 'yearly') return '연';
    return '월';
  }

  function getWeekSemantics() {
    if (App.reportCompute && typeof App.reportCompute.getWeekSemantics === 'function') {
      return clonePlain(App.reportCompute.getWeekSemantics());
    }
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

  function computeNewOriginSummary(items, monthStart, today, amountResolver) {
    var totalAmount = 0;
    var totalCount = 0;
    if (!Array.isArray(items)) {
      return { amount: 0, count: 0 };
    }
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item) continue;
      var created = toDate(item.createdAt || item.startDate);
      if (!created || !monthStart || !today || created < monthStart || created > today) continue;
      totalAmount += Number(amountResolver(item)) || 0;
      totalCount += 1;
    }
    return {
      amount: totalAmount,
      count: totalCount
    };
  }

  function getCurrentBalance() {
    if (App.cashLedger && typeof App.cashLedger.getCurrentBalance === 'function') {
      return Number(App.cashLedger.getCurrentBalance()) || 0;
    }
    var logs = (App.state && Array.isArray(App.state.cashLogs)) ? App.state.cashLogs : [];
    var total = 0;
    for (var i = 0; i < logs.length; i++) {
      if (!logs[i]) continue;
      total += Number(logs[i].amount) || 0;
    }
    return total;
  }

  function buildRecoverySemantics() {
    var weekSemantics = getWeekSemantics();
    return {
      basis: 'scheduled-recovery-trend',
      label: '회수 흐름',
      description: '스케줄 기준 예정액과 실제 회수액의 회수 흐름/추세입니다. 실제 현금성 자본 이동을 보여주는 Capital Flow와는 다른 의미 계약입니다.',
      basisText: '스케줄 기준 예정액·실회수 추세',
      flowType: 'recovery-trend',
      weekSemantics: weekSemantics
    };
  }

  function buildCapitalFlowSemantics(series) {
    var weekSemantics = getWeekSemantics();
    var extras = ['cashLedger effective logs 우선'];
    if (series && series.hasExplicitRange) extras.push('선택 기간');
    if (series && series.period === 'weekly') extras.push(weekSemantics.label);

    var basisText = getPeriodLabel(series && series.period) + ' 기준 실제 자금 유입·유출';
    if (extras.length) basisText += ' · ' + extras.join(' · ');

    return {
      basis: 'cash-ledger-effective-logs',
      sourceBasis: series && series.basis ? series.basis : 'cashlogs',
      label: '실제 자금 유입·유출 흐름',
      description: 'cashLedger effective logs를 우선 기준으로 보며, LOAN_EXECUTION은 자본 유출, AUTO_IN(loan/claim)은 자본 유입으로 집계합니다. cashLedger를 사용할 수 없으면 cashLogs를 fallback으로 사용합니다.',
      basisText: basisText,
      flowType: 'cash-movement',
      weekSemantics: weekSemantics
    };
  }

  function getCapitalFlowEmptyMessage(series) {
    if (series && Number(series.sourceLogCount || 0) <= 0) {
      return '표시할 자본 흐름 로그가 없습니다';
    }
    if (series && series.hasExplicitRange) {
      return '선택 기간에 자본 흐름 로그가 없습니다';
    }
    return '해당 기간의 자본 흐름 로그가 없습니다';
  }

  function getSourceCounts(aggregates, metrics) {
    var counts = (aggregates && aggregates.counts) || (metrics && metrics.counts) || {};
    return {
      debtors: Number(counts.totalDebtors) || 0,
      loans: Number(counts.totalLoans) || 0,
      claims: Number(counts.totalClaims) || 0,
      activeDebtors: Number(counts.activeDebtors) || 0,
      activeLoans: Number(counts.activeLoans) || 0,
      activeClaims: Number(counts.activeClaims) || 0
    };
  }

  function buildOverviewContext(aggregates, metrics, ui) {
    var finance = metrics && metrics.finance ? metrics.finance : {
      loan: { total: 0, paid: 0, planned: 0, overdue: 0, remaining: 0 },
      claim: { total: 0, paid: 0, outstanding: 0, duePassedOutstanding: 0 },
      debt: { total: 0, paid: 0, planned: 0, overdue: 0 }
    };
    var recoverySemantics = buildRecoverySemantics();
    var loans = (App.state && Array.isArray(App.state.loans)) ? App.state.loans : [];
    var claims = (App.state && Array.isArray(App.state.claims)) ? App.state.claims : [];
    var newLoan = computeNewOriginSummary(loans, aggregates && aggregates.monthStart, aggregates && aggregates.today, function (loan) {
      return loan.totalRepayAmount || loan.principal || 0;
    });
    var newClaim = computeNewOriginSummary(claims, aggregates && aggregates.monthStart, aggregates && aggregates.today, function (claim) {
      return claim.amount || 0;
    });

    return {
      metrics: finance,
      mode: ui.portfolioMode,
      monthStart: aggregates ? aggregates.monthStart : null,
      today: aggregates ? aggregates.today : null,
      weekSemantics: clonePlain(recoverySemantics.weekSemantics),
      recoveryBasis: recoverySemantics.basis,
      recoveryLabel: recoverySemantics.label,
      recoveryDescription: recoverySemantics.description,
      recoveryBasisText: recoverySemantics.basisText,
      recoveryFlowType: recoverySemantics.flowType,
      loanMetrics: {
        total: Number(finance.loan && finance.loan.total) || 0,
        paid: Number(finance.loan && finance.loan.paid) || 0,
        planned: Number(finance.loan && finance.loan.planned) || 0,
        overdue: Number(finance.loan && finance.loan.overdue) || 0
      },
      claimMetrics: {
        total: Number(finance.claim && finance.claim.total) || 0,
        paid: Number(finance.claim && finance.claim.paid) || 0,
        planned: Number(finance.claim && finance.claim.outstanding) || 0,
        outstanding: Number(finance.claim && finance.claim.outstanding) || 0
      },
      tiles: {
        weekExpected: aggregates && aggregates.period ? Number(aggregates.period.weekExpected) || 0 : 0,
        monthExpected: aggregates && aggregates.period ? Number(aggregates.period.monthExpected) || 0 : 0,
        weekCollected: aggregates && aggregates.period ? Number(aggregates.period.weekCollected) || 0 : 0,
        monthCollected: aggregates && aggregates.period ? Number(aggregates.period.monthCollected) || 0 : 0,
        weekClaimCollected: aggregates && aggregates.period ? Number(aggregates.period.weekClaimCollected) || 0 : 0,
        monthClaimCollected: aggregates && aggregates.period ? Number(aggregates.period.monthClaimCollected) || 0 : 0
      },
      ops: {
        newLoanAmount: newLoan.amount,
        newLoanCount: newLoan.count,
        newClaimAmount: newClaim.amount,
        newClaimCount: newClaim.count
      },
      availableCapital: getCurrentBalance()
    };
  }

  function buildCapitalFlowContext(ui) {
    var period = ui && ui.trend ? ui.trend.period : 'monthly';
    var series = (App.reportCompute && typeof App.reportCompute.computeTrendSeries === 'function')
      ? App.reportCompute.computeTrendSeries(period)
      : { period: period, basis: 'cashlogs', labels: [], inflow: [], outflow: [], net: [], velocity: [] };
    var summary = (App.reportCompute && typeof App.reportCompute.computeTrendSummary === 'function')
      ? App.reportCompute.computeTrendSummary(series && series.velocity)
      : { peak: 0, min: 0, avg3: 0 };
    var legend = getLegendState(ensureReportState());
    var labels = Array.isArray(series && series.labels) ? series.labels.slice() : [];
    var hasData = Number(series && series.matchedLogCount || 0) > 0;
    var semantics = buildCapitalFlowSemantics(series);

    return {
      period: period,
      range: {
        dateFrom: ui && ui.trend ? ui.trend.dateFrom : null,
        dateTo: ui && ui.trend ? ui.trend.dateTo : null,
        hasExplicitRange: !!(series && series.hasExplicitRange)
      },
      basis: semantics.basis,
      sourceBasis: semantics.sourceBasis,
      label: semantics.label,
      description: semantics.description,
      flowType: semantics.flowType,
      weekSemantics: clonePlain(semantics.weekSemantics),
      basisText: semantics.basisText,
      summary: {
        peak: Number(summary.peak) || 0,
        min: Number(summary.min) || 0,
        avg3: Number(summary.avg3) || 0,
        basisText: semantics.basisText
      },
      labels: labels,
      series: {
        period: series && series.period ? series.period : period,
        labels: labels,
        inflow: Array.isArray(series && series.inflow) ? series.inflow.slice() : [],
        outflow: Array.isArray(series && series.outflow) ? series.outflow.slice() : [],
        net: Array.isArray(series && series.net) ? series.net.slice() : [],
        velocity: Array.isArray(series && series.velocity) ? series.velocity.slice() : [],
        matchedLogCount: Number(series && series.matchedLogCount) || 0,
        sourceLogCount: Number(series && series.sourceLogCount) || 0,
        hasExplicitRange: !!(series && series.hasExplicitRange),
        basis: series && series.basis ? series.basis : 'cashlogs',
        weekSemantics: clonePlain(semantics.weekSemantics)
      },
      chart: {
        labels: labels,
        title: semantics.label,
        description: semantics.description
      },
      table: [],
      empty: {
        isEmpty: !hasData,
        message: getCapitalFlowEmptyMessage(series)
      },
      legend: legend
    };
  }

  function buildRiskContext(ui, metrics) {
    var risk = metrics && metrics.risk ? metrics.risk : {
      totalOperationalExposure: 0,
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
    var debtors = Array.isArray(risk.debtors) ? risk.debtors.slice() : [];
    debtors.sort(function (a, b) {
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

    var topDebtors = debtors.slice(0, 5);
    var concentrationAmount = topDebtors.reduce(function (acc, debtor) {
      return acc + (Number(debtor && debtor.operationalExposure) || 0);
    }, 0);
    var totalExposure = Number(risk.totalOperationalExposure || 0);
    var concentrationShare = totalExposure > 0 ? (concentrationAmount / totalExposure) * 100 : 0;

    return {
      range: clonePlain(ui && ui.risk ? ui.risk : { dateFrom: null, dateTo: null }),
      summary: {
        overdueAmount: totalExposure,
        overdueRate: Number(risk.overdueRate) || 0,
        maxOverdueDays: Number(risk.maxOverdueDays) || 0,
        highRiskCount: Number(risk.highRiskCount) || 0
      },
      aging: clonePlain(risk.aging || {
        '0_7': { count: 0, amount: 0 },
        '8_30': { count: 0, amount: 0 },
        '31_90': { count: 0, amount: 0 },
        '90p': { count: 0, amount: 0 }
      }),
      concentration: {
        amount: concentrationAmount,
        sharePct: concentrationShare,
        debtors: topDebtors.length
      },
      topDebtors: topDebtors,
      empty: topDebtors.length === 0
    };
  }

  function build(options) {
    options = options || {};
    var reportState = ensureReportState();
    var ui = {
      activeSection: reportState.activeSection || 'overview',
      portfolioMode: reportState.portfolioMode === 'claim' ? 'claim' : 'loan',
      trend: clonePlain(reportState.trend || { period: 'monthly', dateFrom: null, dateTo: null }),
      risk: clonePlain(reportState.risk || { dateFrom: null, dateTo: null }),
      legendVisibility: {
        capitalflow: getLegendState(reportState)
      }
    };

    var aggregates = options.aggregates || computeAggregates() || {};
    var metrics = getMetrics(aggregates, ui.risk) || aggregates.metrics || null;
    var weekSemantics = getWeekSemantics();
    var statistics = (App.features && App.features.statisticsEngine && typeof App.features.statisticsEngine.buildContext === 'function')
      ? App.features.statisticsEngine.buildContext(aggregates, { weekSemantics: weekSemantics })
      : {};
    var counts = getSourceCounts(aggregates, metrics);
    var context = {
      meta: {
        generatedAt: new Date().toISOString(),
        appVersion: App.meta && App.meta.version ? App.meta.version : '',
        activeSection: ui.activeSection,
        portfolioMode: ui.portfolioMode,
        isMobile: !!options.isMobile,
        weekStartsOn: Number(weekSemantics.weekStartsOn) || 1,
        weekAnchor: weekSemantics.weekAnchor || 'monday',
        weekLabel: weekSemantics.label || '월요일 시작 주간 기준',
        weekSemantics: clonePlain(weekSemantics)
      },
      ui: ui,
      format: createFormatters(),
      portfolio: {
        metrics: metrics,
        aggregates: aggregates,
        counts: counts,
        source: counts
      },
      overview: buildOverviewContext(aggregates, metrics, ui),
      statistics: statistics,
      capitalflow: buildCapitalFlowContext(ui),
      risk: buildRiskContext(ui, metrics)
    };

    return context;
  }

  App.reportContext.build = build;
})(window);
