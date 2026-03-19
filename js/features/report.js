(function (window, document) {
  'use strict';
  var App = window.App || (window.App = {});
  App.features = App.features || {};

  var initialized = false;

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

  function normalizeRangeValues(fromValue, toValue) {
    var from = fromValue || null;
    var to = toValue || null;
    if (from && to && from > to) {
      var swapped = from;
      from = to;
      to = swapped;
    }
    return { from: from, to: to };
  }

  function syncReportUIFromState(root, reportState, isMobile) {
    if (!root) return;
    reportState = reportState || ensureReportState();
    var activeSection = reportState.activeSection || 'overview';
    var portfolioMode = reportState.portfolioMode === 'claim' ? 'claim' : 'loan';
    var trend = reportState.trend || { period: 'monthly', dateFrom: null, dateTo: null };
    var risk = reportState.risk || { dateFrom: null, dateTo: null };

    var subtabButtons = root.querySelectorAll('.report-subtab-btn[data-report-section]');
    subtabButtons.forEach(function (btn) {
      var sectionKey = btn.getAttribute('data-report-section') || 'overview';
      var isActive = sectionKey === activeSection;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    var sections = root.querySelectorAll('.report-section[data-report-section]');
    sections.forEach(function (section) {
      var sectionKey = section.getAttribute('data-report-section') || 'overview';
      section.classList.toggle('is-active', sectionKey === activeSection);
    });

    var portfolioButtons = root.querySelectorAll('.portfolio-type-chip[data-portfolio-mode]');
    portfolioButtons.forEach(function (btn) {
      var mode = btn.getAttribute('data-portfolio-mode') || 'loan';
      var isActive = mode === portfolioMode;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    var capitalflowSection = root.querySelector('.report-section-capitalflow');
    var trendButtons = capitalflowSection
      ? capitalflowSection.querySelectorAll('.capitalflow-filter-btn[data-filter-value]')
      : [];
    trendButtons.forEach(function (btn) {
      var value = btn.getAttribute('data-filter-value') || 'monthly';
      var isActive = value === (trend.period || 'monthly');
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    var capitalflowControls = root.querySelector('.report-period-controls[data-period-target="capitalflow"]');
    if (capitalflowControls) {
      var fromInput = capitalflowControls.querySelector('.period-from');
      var toInput = capitalflowControls.querySelector('.period-to');
      if (fromInput) fromInput.value = trend.dateFrom || '';
      if (toInput) toInput.value = trend.dateTo || '';
    }

    var riskControls = root.querySelector('.report-period-controls[data-period-target="risk"]');
    if (riskControls) {
      var fromInputRisk = riskControls.querySelector('.period-from');
      var toInputRisk = riskControls.querySelector('.period-to');
      if (fromInputRisk) fromInputRisk.value = risk.dateFrom || '';
      if (toInputRisk) toInputRisk.value = risk.dateTo || '';
    }

    if (isMobile) {
      var overviewMetrics = root.querySelector('#overview-metrics');
      if (overviewMetrics) overviewMetrics.style.display = 'none';
    }
  }

  function ensureFormatShortCurrency() {
    if (!App.util || typeof App.util.formatShortCurrency !== 'function') {
      if (App.util && typeof App.util.formatCurrency === 'function') {
        App.util.formatShortCurrency = function (v) {
          return App.util.formatCurrency(v || 0);
        };
      } else {
        App.util = App.util || {};
        App.util.formatShortCurrency = function (v) {
          var n = Number(v) || 0;
          return String(n);
        };
      }
    }
  }

  function commitReportInvalidate(reason) {
    if (App.api && typeof App.api.commit === 'function' && App.ViewKey && App.ViewKey.REPORT) {
      App.api.commit({ reason: reason || 'report:ui', invalidate: [App.ViewKey.REPORT] });
      return;
    }
    if (App.api && App.api.view && typeof App.api.view.invalidate === 'function' && App.ViewKey && App.ViewKey.REPORT) {
      App.api.view.invalidate(App.ViewKey.REPORT);
      return;
    }
    if (App.renderCoordinator && typeof App.renderCoordinator.invalidate === 'function' && App.ViewKey && App.ViewKey.REPORT) {
      App.renderCoordinator.invalidate(App.ViewKey.REPORT);
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    ensureReportState();
    bindEvents();
  }

  function buildContext(root, isMobile) {
    if (!App.reportContext || typeof App.reportContext.build !== 'function') {
      throw new Error('App.reportContext.build is required for report rendering');
    }
    return App.reportContext.build({ root: root, isMobile: !!isMobile });
  }

  function render() {
    var root = document.getElementById('report-root');
    if (!root) return;

    var isMobile = false;
    try {
      isMobile = !!(App.ui && App.ui.mobile && typeof App.ui.mobile.isMobile === 'function' && App.ui.mobile.isMobile());
    } catch (e) {
      isMobile = false;
    }

    var reportState = ensureReportState();
    syncReportUIFromState(root, reportState, isMobile);
    ensureFormatShortCurrency();

    try {
      var context = buildContext(root, isMobile);
      updateReportView(root, context);
    } catch (e) {
      console.error('[Report] render error', e);
    }
  }

  function bindEvents() {
    var root = document.getElementById('report-root');
    if (!root || root._reportUiStateBound) return;
    root._reportUiStateBound = true;

    root.addEventListener('click', function (event) {
      var target = event.target;
      if (!target) return;

      var opsCard = target.closest('.report-kpi-card[data-kpi="ops"]');
      if (opsCard && root.contains(opsCard)) {
        if (App.ui && App.ui.operationModal && typeof App.ui.operationModal.open === 'function') {
          App.ui.operationModal.open();
        }
        return;
      }

      var availCard = target.closest('.report-kpi-card[data-kpi="avail"]');
      if (availCard && root.contains(availCard)) {
        if (App.ui && App.ui.availableCapitalModal && typeof App.ui.availableCapitalModal.open === 'function') {
          App.ui.availableCapitalModal.open();
        }
        return;
      }

      var portfolioBtn = target.closest('.portfolio-type-chip[data-portfolio-mode]');
      if (portfolioBtn && root.contains(portfolioBtn)) {
        var portfolioMode = portfolioBtn.getAttribute('data-portfolio-mode') || 'loan';
        if (App.reportState && typeof App.reportState.setPortfolioMode === 'function') {
          App.reportState.setPortfolioMode(portfolioMode);
        } else {
          ensureReportState().portfolioMode = (portfolioMode === 'claim') ? 'claim' : 'loan';
        }
        commitReportInvalidate('report:portfolioMode:' + portfolioMode);
        return;
      }

      var subtabBtn = target.closest('.report-subtab-btn[data-report-section]');
      if (subtabBtn && root.contains(subtabBtn)) {
        var activeSection = subtabBtn.getAttribute('data-report-section') || 'overview';
        if (App.reportState && typeof App.reportState.setActiveSection === 'function') {
          App.reportState.setActiveSection(activeSection);
        } else {
          ensureReportState().activeSection = activeSection;
        }
        commitReportInvalidate('report:section:' + activeSection);
        return;
      }

      var trendBtn = target.closest('.capitalflow-filter-btn[data-filter-value]');
      if (trendBtn && root.contains(trendBtn)) {
        var periodValue = trendBtn.getAttribute('data-filter-value') || 'monthly';
        if (App.reportState && typeof App.reportState.setTrendPeriod === 'function') {
          App.reportState.setTrendPeriod(periodValue);
        } else {
          ensureReportState().trend.period = periodValue;
        }
        commitReportInvalidate('report:trendPeriod:' + periodValue);
        return;
      }

      var legendItem = target.closest('.capitalflow-legend-item[data-series]');
      if (legendItem && root.contains(legendItem)) {
        var legendSeriesKey = legendItem.getAttribute('data-series') || 'unknown';
        if (App.reportState && typeof App.reportState.toggleLegendVisibility === 'function') {
          App.reportState.toggleLegendVisibility('capitalflow', legendSeriesKey);
        } else {
          var reportStateLegend = ensureReportState();
          reportStateLegend.legendVisibility = reportStateLegend.legendVisibility || {};
          reportStateLegend.legendVisibility.capitalflow = reportStateLegend.legendVisibility.capitalflow || {};
          reportStateLegend.legendVisibility.capitalflow[legendSeriesKey] = !(reportStateLegend.legendVisibility.capitalflow[legendSeriesKey] !== false);
        }
        commitReportInvalidate('report:legend:' + legendSeriesKey);
        return;
      }

      var applyCapitalflow = target.closest('[data-action="apply-capitalflow-period"]');
      if (applyCapitalflow && root.contains(applyCapitalflow)) {
        var capitalflowPeriodControls = root.querySelector('.report-period-controls[data-period-target="capitalflow"]');
        if (capitalflowPeriodControls) {
          var fromInputT = capitalflowPeriodControls.querySelector('.period-from');
          var toInputT = capitalflowPeriodControls.querySelector('.period-to');
          var rawFromValueT = (fromInputT && fromInputT.value) ? fromInputT.value : null;
          var rawToValueT = (toInputT && toInputT.value) ? toInputT.value : null;
          if (App.reportState && typeof App.reportState.setTrendRange === 'function') {
            App.reportState.setTrendRange(rawFromValueT, rawToValueT);
          } else {
            var reportState1 = ensureReportState();
            var normalizedTrendRange = normalizeRangeValues(rawFromValueT, rawToValueT);
            reportState1.trend.dateFrom = normalizedTrendRange.from;
            reportState1.trend.dateTo = normalizedTrendRange.to;
          }
          var appliedTrendState = (App.reportState && typeof App.reportState.getTrend === 'function')
            ? App.reportState.getTrend()
            : ensureReportState().trend;
          if (fromInputT) fromInputT.value = (appliedTrendState && appliedTrendState.dateFrom) ? appliedTrendState.dateFrom : '';
          if (toInputT) toInputT.value = (appliedTrendState && appliedTrendState.dateTo) ? appliedTrendState.dateTo : '';
          commitReportInvalidate('report:trendRange');
        }
        return;
      }

      var applyRisk = target.closest('[data-action="apply-risk-period"]');
      if (applyRisk && root.contains(applyRisk)) {
        var riskPeriodControls = root.querySelector('.report-period-controls[data-period-target="risk"]');
        if (riskPeriodControls) {
          var fromInputR = riskPeriodControls.querySelector('.period-from');
          var toInputR = riskPeriodControls.querySelector('.period-to');
          var rawFromValueR = (fromInputR && fromInputR.value) ? fromInputR.value : null;
          var rawToValueR = (toInputR && toInputR.value) ? toInputR.value : null;
          if (App.reportState && typeof App.reportState.setRiskRange === 'function') {
            App.reportState.setRiskRange(rawFromValueR, rawToValueR);
          } else {
            var reportState2 = ensureReportState();
            var normalizedRiskRange = normalizeRangeValues(rawFromValueR, rawToValueR);
            reportState2.risk.dateFrom = normalizedRiskRange.from;
            reportState2.risk.dateTo = normalizedRiskRange.to;
          }
          var appliedRiskState = (App.reportState && typeof App.reportState.getRisk === 'function')
            ? App.reportState.getRisk()
            : ensureReportState().risk;
          if (fromInputR) fromInputR.value = (appliedRiskState && appliedRiskState.dateFrom) ? appliedRiskState.dateFrom : '';
          if (toInputR) toInputR.value = (appliedRiskState && appliedRiskState.dateTo) ? appliedRiskState.dateTo : '';
          commitReportInvalidate('report:riskRange');
        }
      }
    });
  }

  function updateRecoveryTiles(root, context) {
    if (!root || !context || !context.overview) return;
    var tilesData = context.overview.tiles || {};
    var currency = context.format && typeof context.format.currency === 'function'
      ? context.format.currency
      : function (value) { return String(Number(value) || 0); };
    var tiles = root.querySelectorAll('.recovery-kpi-card');
    tiles.forEach(function (tile) {
      var labelEl = tile.querySelector('.kpi-label');
      var valueEl = tile.querySelector('.kpi-value');
      if (!labelEl || !valueEl) return;
      var label = labelEl.textContent.trim();
      if (label.indexOf('이번주 회수 예정금액') !== -1) {
        valueEl.textContent = currency(tilesData.weekExpected);
      } else if (label.indexOf('이번달 회수 예정금액') !== -1) {
        valueEl.textContent = currency(tilesData.monthExpected);
      } else if (label.indexOf('이번주 회수액') !== -1) {
        valueEl.textContent = currency(tilesData.weekCollected);
      } else if (label.indexOf('이번달 회수액') !== -1) {
        valueEl.textContent = currency(tilesData.monthCollected);
      }
    });
  }

  function renderOverviewSection(root, context) {
    if (!root) return;
    if (App.reportRender && App.reportRender.overview && typeof App.reportRender.overview.render === 'function') {
      App.reportRender.overview.render(root, context, { isMobile: !!(context && context.meta && context.meta.isMobile) });
    }
  }

  function renderRecoverySection(root, context) {
    if (!root || !context) return;
    updateRecoveryTiles(root, context);
    if (context.meta && context.meta.isMobile) return;
    if (App.reportRender && App.reportRender.recovery && typeof App.reportRender.recovery.render === 'function') {
      App.reportRender.recovery.render(root, context);
    }
  }

  function renderStatisticsSection(root, context) {
    if (!root || !App.features || !App.features.statisticsEngine) return;
    var statRoot = root.querySelector('.report-section-statistics');
    if (!statRoot) return;
    App.features.statisticsEngine.render(statRoot, context);
  }

  function renderCapitalFlowSection(root, context) {
    if (!root || !App.reportRender || !App.reportRender.capitalflow) return;
    if (typeof App.reportRender.capitalflow.render === 'function') {
      App.reportRender.capitalflow.render(root, context);
    }
  }

  function renderRiskSection(root, context) {
    if (!root || !App.reportRender || !App.reportRender.risk) return;
    if (typeof App.reportRender.risk.render === 'function') {
      App.reportRender.risk.render(root, context);
    }
  }

  function syncReportSemantics(root, context) {
    if (!root || !context) return;
    var meta = context.meta || {};
    var week = meta.weekSemantics || {};
    var weekAnchor = week.weekAnchor || meta.weekAnchor || 'monday';
    var weekStartsOn = String(week.weekStartsOn != null ? week.weekStartsOn : (meta.weekStartsOn != null ? meta.weekStartsOn : 1));

    root.setAttribute('data-report-week-anchor', weekAnchor);
    root.setAttribute('data-report-week-starts-on', weekStartsOn);
    root.removeAttribute('data-recovery-flow-type');
    root.removeAttribute('data-recovery-basis');

    var sectionNodes = root.querySelectorAll('.report-section[data-report-section]');
    sectionNodes.forEach(function (section) {
      section.setAttribute('data-report-week-anchor', weekAnchor);
      section.setAttribute('data-report-week-starts-on', weekStartsOn);
    });

    var recovery = context.recovery || {};
    var overviewSection = root.querySelector('.report-section-overview');
    if (overviewSection) {
      overviewSection.removeAttribute('data-recovery-flow-type');
      overviewSection.removeAttribute('data-recovery-basis');
    }

    var recoverySection = root.querySelector('.overview-panel-recovery-new');
    if (recoverySection) {
      recoverySection.setAttribute('data-recovery-flow-type', recovery.flowType || 'recovery-trend');
      recoverySection.setAttribute('data-recovery-basis', recovery.basis || 'scheduled-recovery-trend');
      recoverySection.setAttribute('data-week-anchor', weekAnchor);
      recoverySection.setAttribute('data-report-week-starts-on', weekStartsOn);
    }

    var capitalflowSection = root.querySelector('.report-section-capitalflow');
    if (capitalflowSection && context.capitalflow) {
      capitalflowSection.setAttribute('data-capitalflow-flow-type', context.capitalflow.flowType || 'cash-movement');
      capitalflowSection.setAttribute('data-capitalflow-basis', context.capitalflow.basis || 'cash-ledger-effective-logs');
    }
  }

  function updateReportView(root, context) {
    if (!root || !context) return;
    syncReportSemantics(root, context);
    renderOverviewSection(root, context);
    renderRecoverySection(root, context);
    renderStatisticsSection(root, context);
    renderCapitalFlowSection(root, context);
    renderRiskSection(root, context);
  }

  App.features.report = {
    init: init,
    renderImpl: render,
    render: (function () {
      var warned = false;
      function warnOnce() {
        if (warned) return;
        warned = true;
        try {
          console.warn('[DEPRECATED] direct report.render() called. Use commit/invalidate instead.');
        } catch (e) {}
      }
      var wrapper = function () {
        warnOnce();
        if (App.api && App.api.view && typeof App.api.view.invalidate === 'function' && App.ViewKey) {
          App.api.view.invalidate(App.ViewKey.REPORT);
          return;
        }
        if (App.renderCoordinator && typeof App.renderCoordinator.invalidate === 'function' && App.ViewKey) {
          App.renderCoordinator.invalidate(App.ViewKey.REPORT);
        }
      };
      wrapper._deprecatedInvalidateWrapper = true;
      return wrapper;
    })()
  };
})(window, document);
