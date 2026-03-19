(function (window, document) {
  'use strict';
  var App = window.App || (window.App = {});
  App.reportRender = App.reportRender || {};

  var trendChartInstance = null;

  function getFallbackSemantics(series) {
    var period = series && series.period;
    var periodLabel = period === 'daily' ? '일' : (period === 'weekly' ? '주' : '월');
    var extras = ['cashLedger effective logs 우선'];
    if (series && series.hasExplicitRange) extras.push('선택 기간');
    if (series && series.period === 'weekly') extras.push('월요일 시작 주간 기준');

    var basisText = periodLabel + ' 기준 실제 자금 유입·유출';
    if (extras.length) basisText += ' · ' + extras.join(' · ');

    return {
      label: '실제 자금 유입·유출 흐름',
      description: 'cashLedger effective logs를 우선 기준으로 보며, LOAN_EXECUTION은 자본 유출, AUTO_IN(loan/claim)은 자본 유입으로 집계합니다. cashLedger를 사용할 수 없으면 cashLogs를 fallback으로 사용합니다.',
      basisText: basisText,
      flowType: 'cash-movement'
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

  function getContext(input) {
    if (input && input.capitalflow && input.format) {
      return input;
    }
    var fallbackSeries = { period: 'monthly', labels: [], inflow: [], outflow: [], net: [], velocity: [], matchedLogCount: 0, sourceLogCount: 0, hasExplicitRange: false, basis: 'cashlogs' };
    var fallbackSemantics = getFallbackSemantics(fallbackSeries);
    return {
      format: {
        currency: function (value) { return String(Number(value) || 0); },
        percent: function (value, digits) { return (Number(value) || 0).toFixed(typeof digits === 'number' ? digits : 1) + '%'; }
      },
      ui: { legendVisibility: { capitalflow: { velocity: true, inflow: true, outflow: true, net: true } } },
      capitalflow: {
        label: fallbackSemantics.label,
        description: fallbackSemantics.description,
        flowType: fallbackSemantics.flowType,
        basisText: fallbackSemantics.basisText,
        summary: { peak: 0, min: 0, avg3: 0, basisText: fallbackSemantics.basisText },
        series: fallbackSeries,
        empty: { isEmpty: true, message: getCapitalFlowEmptyMessage({ sourceLogCount: 0 }) },
        legend: { velocity: true, inflow: true, outflow: true, net: true }
      }
    };
  }

  function getCapitalFlowSemantics(context) {
    var capitalflow = context && context.capitalflow ? context.capitalflow : {};
    var series = capitalflow.series || {};
    var fallback = getFallbackSemantics(series);
    return {
      label: capitalflow.label || fallback.label,
      description: capitalflow.description || fallback.description,
      basisText: capitalflow.basisText || fallback.basisText,
      flowType: capitalflow.flowType || fallback.flowType
    };
  }

  function syncCapitalFlowHeader(section, context) {
    if (!section) return;
    var semantics = getCapitalFlowSemantics(context);

    var title = section.querySelector('.report-section-title');
    var desc = section.querySelector('.report-section-desc');
    var chartTitle = section.querySelector('.capitalflow-chart-title');

    if (title) title.textContent = semantics.label || '실제 자금 유입·유출 흐름';
    if (desc) desc.textContent = semantics.description || '';
    if (chartTitle) chartTitle.textContent = semantics.label || '실제 자금 유입·유출 흐름';

    section.setAttribute('data-capitalflow-flow-type', semantics.flowType || 'cash-movement');
  }

  function toggleCapitalFlowEmptyState(section, isEmpty, message) {
    if (!section) return;
    var emptyEl = section.querySelector('[data-capitalflow-empty]');
    var canvas = section.querySelector('#capitalflow-main-chart');
    if (emptyEl) {
      emptyEl.textContent = message || '해당 기간의 자본 흐름 로그가 없습니다';
      emptyEl.hidden = !isEmpty;
    }
    if (canvas) {
      canvas.style.display = isEmpty ? 'none' : '';
    }
  }

  function updateTrendSummary(root, input) {
    var section = root ? root.querySelector('.report-section-capitalflow') : null;
    if (!section) return;

    var context = getContext(input);
    var summary = context.capitalflow && context.capitalflow.summary ? context.capitalflow.summary : { peak: 0, min: 0, avg3: 0, basisText: '' };
    var semantics = getCapitalFlowSemantics(context);
    var format = context.format || {};
    var percent = typeof format.percent === 'function'
      ? format.percent
      : function (value) { return (Number(value) || 0).toFixed(1) + '%'; };

    var peakEl = section.querySelector('.capitalflow-summary-value[data-summary="peak"]');
    var minEl = section.querySelector('.capitalflow-summary-value[data-summary="min"]');
    var avgEl = section.querySelector('.capitalflow-summary-value[data-summary="avg3"]');
    var basisEl = section.querySelector('.capitalflow-summary-value[data-summary="basis"]');
    if (peakEl) peakEl.textContent = percent(summary.peak, 1);
    if (minEl) minEl.textContent = percent(summary.min, 1);
    if (avgEl) avgEl.textContent = percent(summary.avg3, 1);
    if (basisEl) basisEl.textContent = summary.basisText || semantics.basisText;
  }

  function syncLegendButtons(section, active) {
    if (!section) return;
    var legendRoot = section.querySelector('[data-capitalflow-legend]');
    if (!legendRoot) return;

    var legendItems = legendRoot.querySelectorAll('.capitalflow-legend-item[data-series]');
    legendItems.forEach(function (item) {
      var key = item.getAttribute('data-series');
      if (!key || !Object.prototype.hasOwnProperty.call(active, key)) return;
      var isActive = active[key] !== false;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function buildDatasets(series, active) {
    return [
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
      }
    ];
  }

  function updateCapitalFlowSection(root, input) {
    var section = root ? root.querySelector('.report-section-capitalflow') : null;
    if (!section) return;

    var context = getContext(input);
    var capitalflow = context.capitalflow || {};
    var series = capitalflow.series || { period: 'monthly', labels: [], inflow: [], outflow: [], net: [], velocity: [] };
    var labels = Array.isArray(capitalflow.labels) ? capitalflow.labels : (Array.isArray(series.labels) ? series.labels : []);
    var empty = capitalflow.empty || { isEmpty: !(Number(series.matchedLogCount || 0) > 0), message: getCapitalFlowEmptyMessage(series) };
    var uiLegend = context.ui && context.ui.legendVisibility && context.ui.legendVisibility.capitalflow;
    var active = capitalflow.legend || uiLegend || { velocity: true, inflow: true, outflow: true, net: true };
    var currency = context.format && typeof context.format.currency === 'function'
      ? context.format.currency
      : function (value) { return String(Number(value) || 0); };

    syncCapitalFlowHeader(section, context);
    syncLegendButtons(section, active);
    toggleCapitalFlowEmptyState(section, !!empty.isEmpty, empty.message || getCapitalFlowEmptyMessage(series));

    var canvas = section.querySelector('#capitalflow-main-chart');
    if (!canvas || !canvas.getContext || typeof Chart === 'undefined') {
      updateTrendSummary(root, context);
      return;
    }

    canvas.style.height = '400px';
    var ctx = canvas.getContext('2d');
    var datasets = buildDatasets(series, active);

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
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (tooltipContext) {
                  var label = tooltipContext.dataset.label || '';
                  var value = tooltipContext.parsed.y;
                  if (label.indexOf('회전률') !== -1) {
                    return label + ': ' + ((Number(value) || 0).toFixed(1)) + '%';
                  }
                  return label + ': ' + currency(value || 0);
                }
              }
            }
          },
          scales: {
            y: {
              position: 'left',
              grid: { color: 'rgba(209, 213, 219, 0.6)' }
            },
            y1: {
              position: 'right',
              grid: { drawOnChartArea: false }
            },
            x: {
              grid: { color: 'rgba(229, 231, 235, 0.7)' }
            }
          }
        }
      });
    } else {
      trendChartInstance.data.labels = labels;
      trendChartInstance.data.datasets = datasets;
      trendChartInstance.update();
    }

    updateTrendSummary(root, context);
  }

  App.reportRender.capitalflow = {
    updateTrendSummary: updateTrendSummary,
    updateCapitalFlowSection: updateCapitalFlowSection,
    render: updateCapitalFlowSection
  };
})(window, document);
