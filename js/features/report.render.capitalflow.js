(function (window, document) {
  'use strict';
  var App = window.App || (window.App = {});
  App.reportRender = App.reportRender || {};

  var trendChartInstance = null;
function formatCurrencySafe(util, value) {
  var n = Number(value) || 0;
  if (!util || !util.formatCurrency) return String(n);
  return util.formatCurrency(n);
}

function formatNumberSafe(util, value) {
  var n = Number(value) || 0;
  if (!util || !util.formatNumber) return String(n);
  return util.formatNumber(n);
}



function updateTrendSummary(root, velocitySeries) {
  var section = root.querySelector('.report-section-capitalflow');
  if (!section) return;
  var util = App.util || {};
  var summary = (App.reportCompute && App.reportCompute.computeTrendSummary)
    ? App.reportCompute.computeTrendSummary(velocitySeries || [])
    : { peak: 0, min: 0, avg3: 0 };

  function fmt(v) {
    if (!v || isNaN(v)) return '0%';
    var rounded = Math.round(v * 10) / 10;
    return rounded.toFixed(1) + '%';
  }

  var peakEl = section.querySelector('.capitalflow-summary-value[data-summary="peak"]');
  var minEl = section.querySelector('.capitalflow-summary-value[data-summary="min"]');
  var avgEl = section.querySelector('.capitalflow-summary-value[data-summary="avg3"]');
  if (peakEl) peakEl.textContent = fmt(summary.peak);
  if (minEl) minEl.textContent = fmt(summary.min);
  if (avgEl) avgEl.textContent = fmt(summary.avg3);
}

function updateCapitalFlowSection(root, agg) {
  var section = root.querySelector('.report-section-capitalflow');
  if (!section) return;
  App.reportTrendState = App.reportTrendState || { period: 'monthly' };
  var period = App.reportTrendState.period || 'monthly';

  var series = (App.reportCompute && App.reportCompute.computeTrendSeries)
    ? App.reportCompute.computeTrendSeries(period)
    : { labels: [], inflow: [], outflow: [], net: [], velocity: [] };
  var labels = series.labels || [];
  var legendRoot = section.querySelector('[data-capitalflow-legend]');
  var active = { velocity: true, inflow: true, outflow: true, net: true };
  if (legendRoot) {
    var legendItems = legendRoot.querySelectorAll('.capitalflow-legend-item');
    legendItems.forEach(function (item) {
      var key = item.getAttribute('data-series');
      if (!key) return;
      if (!item.classList.contains('is-active')) {
        active[key] = false;
      }
    });
  }

  var canvas = section.querySelector('#capitalflow-main-chart');
  canvas.style.height = '400px';
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var datasets = [];

  datasets.push({
    label: '회전률',
    data: series.velocity || [],
    yAxisID: 'y1',
    borderWidth: 2,
    tension: 0.25,
    pointRadius: 2,
    pointHoverRadius: 3,
    borderColor: '#111827',
    backgroundColor: 'rgba(17, 24, 39, 0.12)',
    spanGaps: true,
    hidden: !active.velocity
  });

  datasets.push({
    label: '자본 유입',
    data: series.inflow || [],
    yAxisID: 'y',
    borderWidth: 1.5,
    tension: 0.25,
    pointRadius: 1.5,
    pointHoverRadius: 2.5,
    borderColor: '#16a34a',
    backgroundColor: 'rgba(22, 163, 74, 0.18)',
    spanGaps: true,
    hidden: !active.inflow
  });

  datasets.push({
    label: '자본 유출',
    data: series.outflow || [],
    yAxisID: 'y',
    borderWidth: 1.5,
    tension: 0.25,
    pointRadius: 1.5,
    pointHoverRadius: 2.5,
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    spanGaps: true,
    hidden: !active.outflow
  });

  datasets.push({
    label: '순자본 흐름',
    data: series.net || [],
    yAxisID: 'y',
    borderWidth: 1.5,
    tension: 0.25,
    pointRadius: 1.5,
    pointHoverRadius: 2.5,
    borderColor: '#0ea5e9',
    backgroundColor: 'rgba(14, 165, 233, 0.18)',
    spanGaps: true,
    hidden: !active.net
  });

  if (typeof Chart === 'undefined') {
    // Chart.js가 아직 로드되지 않은 경우, 요약만 업데이트
    updateTrendSummary(root, series.velocity || []);
    return;
  }

  if (!trendChartInstance) {
    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var label = ctx.dataset.label || '';
                var v = ctx.parsed.y;
                if (label.indexOf('회전률') !== -1) {
                  if (!v || isNaN(v)) return label + ': 0%';
                  var rounded = Math.round(v * 10) / 10;
                  return label + ': ' + rounded.toFixed(1) + '%';
                } else {
                  return label + ': ' + App.util.formatCurrency(v || 0);
                }
              }
            }
          }
        },
        scales: {
          y: {
            position: 'left',
            ticks: {
                          },
            grid: {
              color: 'rgba(209, 213, 219, 0.6)'
            }
          },
          y1: {
            position: 'right',
            grid: {
              drawOnChartArea: false
            },
            ticks: {
                          }
          },
          x: {
            grid: {
              color: 'rgba(229, 231, 235, 0.7)'
            }
          }
        }
      }
    });
  } else {
    trendChartInstance.data.labels = labels;
    trendChartInstance.data.datasets = datasets;
    trendChartInstance.update();
  }

  updateTrendSummary(root, series.velocity || []);
}

function updateRiskSection(root, agg) {
  var section = root.querySelector('.report-section-risk');
  if (!section || !App.state) return;

  var state = App.state;
  var schedules = state.schedules || [];
  var debtors = state.debtors || [];
  var util = App.util || {};

  var debtorMap = {};
  debtors.forEach(function (d) {
    if (!d || !d.id) return;
    debtorMap[d.id] = d;
  });

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var riskState = App.reportRiskState || {};
  var fromDate = riskState.dateFrom ? new Date(riskState.dateFrom) : null;
  var toDateLimit = riskState.dateTo ? new Date(riskState.dateTo) : null;
  if (fromDate && !isNaN(fromDate.getTime())) fromDate.setHours(0, 0, 0, 0);
  else fromDate = null;
  if (toDateLimit && !isNaN(toDateLimit.getTime())) toDateLimit.setHours(0, 0, 0, 0);
  else toDateLimit = null;

  var totalOverdue = 0;
  var maxOverdueDays = 0;
  // 오늘까지 도래한 스케줄 약정금액 합계 (연체율 분모)
  var plannedDue = 0;

  var aging = {
    '0_7': { count: 0, amount: 0 },
    '8_30': { count: 0, amount: 0 },
    '31_90': { count: 0, amount: 0 },
    '90p': { count: 0, amount: 0 }
  };

  var debtorStats = {};

  schedules.forEach(function (sch) {
    if (!sch) return;
    var amt = Number(sch.amount) || 0;
    var status = sch.status || 'PLANNED';
    var partialPaid = Number(sch.partialPaidAmount) || 0;
    var paidRaw = Number(sch.paidAmount) || 0;
    var due = sch.dueDate ? new Date(sch.dueDate) : null;
    if (!due || isNaN(due.getTime())) return;
    due.setHours(0, 0, 0, 0);
    if (fromDate && due < fromDate) return;
    if (toDateLimit && due > toDateLimit) return;

    // 오늘까지 도래한 스케줄 약정금액(연체율 분모) 집계
    if (due <= today) {
      plannedDue += amt;
    }

    var paidAmt = 0;
    if (status === 'PAID') {
      // 완납 회차는 약정금 전체를 상환으로 처리
      paidAmt = amt;
    } else if (status === 'PARTIAL') {
      // 부분상환 회차는 partialPaidAmount 우선, 없으면 paidAmount 사용
      paidAmt = partialPaid > 0 ? partialPaid : paidRaw;
    } else {
      // 그 외 상태는 paidAmount만 사용
      paidAmt = paidRaw;
    }

    var remaining = amt - paidAmt;
    if (remaining <= 0) return;

    // 아직 기한이 지나지 않은 경우 제외
    if (due > today) return;

    var diffMs = today.getTime() - due.getTime();
    var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return;

    // 연체/미납으로 간주: 기한이 지났고 남은 금액이 있는 건
    totalOverdue += remaining;
    if (diffDays > maxOverdueDays) maxOverdueDays = diffDays;

    // Aging bucket
    var bucketKey;
    if (diffDays <= 7) bucketKey = '0_7';
    else if (diffDays <= 30) bucketKey = '8_30';
    else if (diffDays <= 90) bucketKey = '31_90';
    else bucketKey = '90p';

    var bucket = aging[bucketKey];
    if (bucket) {
      bucket.count += 1;
      bucket.amount += remaining;
    }

    // Debtor aggregation
    var debtorId = sch.debtorId || sch.loanDebtorId || '';
    if (debtorId) {
      var dstat = debtorStats[debtorId];
      if (!dstat) {
        var debtor = debtorMap[debtorId] || {};
        dstat = debtorStats[debtorId] = {
          debtorId: debtorId,
          name: debtor.name || debtorId,
          overdueAmount: 0,
          maxOverdueDays: 0,
          count: 0
        };
      }
      dstat.overdueAmount += remaining;
      if (diffDays > dstat.maxOverdueDays) dstat.maxOverdueDays = diffDays;
      dstat.count += 1;
    }
  });

  // 고위험 기준: 미납 100만↑ 또는 연체 30일↑
  var HIGH_AMOUNT = 1000000;
  var HIGH_DAYS = 30;

  var debtorList = Object.keys(debtorStats).map(function (id) {
    return debtorStats[id];
  });
  debtorList.sort(function (a, b) {
    return (b.overdueAmount || 0) - (a.overdueAmount || 0);
  });

  var highRiskList = debtorList.filter(function (d) {
    return (d.overdueAmount >= HIGH_AMOUNT) || (d.maxOverdueDays >= HIGH_DAYS);
  });

  var topForConcentration = debtorList.slice(0, 5);
  var sumTop = topForConcentration.reduce(function (acc, d) {
    return acc + (d.overdueAmount || 0);
  }, 0);

  var overdueBase = totalOverdue || 0;
  var topShare = 0;
  if (overdueBase > 0) {
    topShare = (sumTop / overdueBase) * 100;
  }

    // 연체율: 오늘까지 도래한 스케줄 기준 (연체잔액 / 도래 약정금액)
  var overdueRate = 0;
  if (plannedDue > 0 && totalOverdue > 0) {
    overdueRate = (totalOverdue / plannedDue) * 100;
  }

  // KPI 업데이트
  var kpiOverdue = section.querySelector('.risk-kpi-card[data-risk-kpi="overdue-amount"] .risk-kpi-value');
  var kpiRate = section.querySelector('.risk-kpi-card[data-risk-kpi="overdue-rate"] .risk-kpi-value');
  var kpiMaxDays = section.querySelector('.risk-kpi-card[data-risk-kpi="max-overdue-days"] .risk-kpi-value');
  var kpiHighCount = section.querySelector('.risk-kpi-card[data-risk-kpi="highrisk-count"] .risk-kpi-value');

  if (kpiOverdue) {
    kpiOverdue.textContent = formatCurrencySafe(util, totalOverdue);
  }
  if (kpiRate) {
    var r = overdueRate > 0 ? overdueRate : 0;
    kpiRate.textContent = r.toFixed(1) + '%';
  }
  if (kpiMaxDays) {
    kpiMaxDays.textContent = maxOverdueDays > 0 ? (maxOverdueDays + '일') : '--일';
  }
  if (kpiHighCount) {
    kpiHighCount.textContent = String(highRiskList.length || 0) + '명';
  }

  // Aging 테이블 업데이트
  var agingTable = section.querySelector('.risk-table-aging tbody');
  if (agingTable) {
    var rows = agingTable.querySelectorAll('tr[data-bucket]');
    rows.forEach(function (row) {
      var key = row.getAttribute('data-bucket');
      var bucket = aging[key];
      if (!bucket) return;
      var cells = row.querySelectorAll('td');
      if (cells.length >= 3) {
        cells[1].textContent = formatNumberSafe(util, bucket.count || 0) + '건';
        cells[2].textContent = formatCurrencySafe(util, bucket.amount || 0);
      }
    });
  }

  // 집중도 테이블 업데이트
  var concBody = section.querySelector('.risk-table-concentration tbody');
  if (concBody && concBody.firstElementChild) {
    var tr = concBody.firstElementChild;
    var cells = tr.querySelectorAll('td');
    if (cells.length >= 3) {
      cells[1].textContent = formatCurrencySafe(util, sumTop);
      var shareValue = 0;
      if (overdueBase > 0 && sumTop > 0) {
        shareValue = (sumTop / overdueBase) * 100;
      }
      cells[2].textContent = shareValue.toFixed(1) + '%';
    }
  }

  // 고위험 채무자 TOP 5 업데이트
  var topTableBody = section.querySelector('.risk-table-topdebtors tbody');
  if (topTableBody) {
    while (topTableBody.firstChild) {
      topTableBody.removeChild(topTableBody.firstChild);
    }
    var topList = highRiskList.slice(0, 5);
    if (!topList.length) {
      var emptyRow = document.createElement('tr');
      emptyRow.innerHTML = '<td colspan="4">고위험 채무자가 없습니다.</td>';
      topTableBody.appendChild(emptyRow);
    } else {
      topList.forEach(function (d) {
        var row = document.createElement('tr');
        var name = d.name || d.debtorId || '--';
        var amt = d.overdueAmount || 0;
        var days = d.maxOverdueDays || 0;
        var cnt = d.count || 0;
        row.innerHTML =
          '<td>' + name + '</td>' +
          '<td>' + formatCurrencySafe(util, amt) + '</td>' +
          '<td>' + (days > 0 ? (days + '일') : '--일') + '</td>' +
          '<td>' + formatNumberSafe(util, cnt) + '건</td>';
        topTableBody.appendChild(row);
      });
    }
  }
}

  App.reportRender.capitalflow = {
    updateTrendSummary: updateTrendSummary,
    updateCapitalFlowSection: updateCapitalFlowSection
  };
  App.reportRender.risk = {
    updateRiskSection: updateRiskSection
  };
})(window, document);
