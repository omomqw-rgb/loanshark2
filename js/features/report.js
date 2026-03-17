(function (window, document) {
  'use strict';
  var App = window.App || (window.App = {});
  App.features = App.features || {};

  var initialized = false;

  function renderOverviewDonut(host, summary) {
    if (!host || !summary || !App.util) return;

    var planned = Number(summary.plannedAmount) || 0;
    var paid = Number(summary.paidAmount) || 0;
    var partial = Number(summary.partialAmount) || 0;
    var overdue = Number(summary.overdueAmount) || 0;
    var total = planned + paid + partial + overdue;

    host.innerHTML = '';

    if (!total) {
      var empty = document.createElement('div');
      empty.className = 'overview-placeholder';
      empty.textContent = '포트폴리오 데이터가 없습니다';
      host.appendChild(empty);
      return;
    }

    var size = 176;
    var strokeWidth = 18;
    // v248: 대출/채권 도넛 크기 통일 (claim 도넛과 동일한 radius/strokeWidth)
    var radius = 68;
    var cx = size / 2;
    var cy = size / 2;
    var circumference = 2 * Math.PI * radius;

    function segment(value) {
      return (value / total) * circumference;
    }

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.classList.add('overview-portfolio-donut-svg');

    var bg = document.createElementNS(svgNS, 'circle');
    bg.setAttribute('cx', cx);
    bg.setAttribute('cy', cy);
    bg.setAttribute('r', radius);
    bg.setAttribute('fill', 'none');
    bg.setAttribute('stroke-width', strokeWidth);
    bg.setAttribute('stroke', 'rgba(148, 163, 184, 0.15)');
    svg.appendChild(bg);

    var values = [
      { key: 'planned', value: planned, className: 'donut-planned' },
      { key: 'paid', value: paid, className: 'donut-paid' },
      { key: 'partial', value: partial, className: 'donut-partial' },
      { key: 'overdue', value: overdue, className: 'donut-overdue' }
    ];

    var labelInfos = [];

    var offset = 0;
    var gap = 1.25;

    for (var i = 0; i < values.length; i++) {
      var seg = values[i];
      if (!seg.value) continue;
      var length = segment(seg.value);

      // arc 중앙 위치(원둘레 기준)와 각도 계산
      var arcCenter = offset + length / 2;
      var angle = (arcCenter / circumference) * 2 * Math.PI;

      // 퍼센트 계산
      var pct = Math.round((seg.value / total) * 100);

      // 너무 작으면 생략 (3% 미만) — angle/pct만 버퍼에 저장
      if (pct >= 3) {
        labelInfos.push({
          angle: angle,
          pct: pct,
          key: seg.key
        });
      }

      // Segment gap을 적용한 실제 표시 길이
      var visibleLength = Math.max(length - gap, 0);

      var circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', radius);
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke-width', strokeWidth);
      circle.setAttribute('stroke-dasharray', visibleLength + ' ' + (circumference - visibleLength));
      circle.setAttribute('stroke-dashoffset', -(offset + gap / 2));
      circle.classList.add('overview-portfolio-donut-segment', seg.className);
      svg.appendChild(circle);

      offset += length;
    }

    // 두 번째 패스: arc 위에 퍼센트 라벨 표시 (중앙/가장자리 클리핑 방지)
    for (var j = 0; j < labelInfos.length; j++) {
      var info = labelInfos[j];
      var angle = info.angle;
      var pct = info.pct;

      // v248: 라벨 반지름을 링 두께의 중간 지점으로 이동
      // conceptual innerRadius = radius - strokeWidth, outerRadius = radius
      var innerRadius = radius - strokeWidth;
      var outerRadius = radius;
      var labelRadius = (innerRadius + outerRadius) / 2;

      var tx = cx + Math.cos(angle) * labelRadius;
      var ty = cy + Math.sin(angle) * labelRadius;

      var text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', tx);
      text.setAttribute('y', ty + 4);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '16px');
      text.setAttribute('fill', '#000000');
      text.setAttribute('font-weight', '600');
      text.textContent = pct + '%';
      svg.appendChild(text);
    }

    host.appendChild(svg);
  }


  
  function renderOverviewClaimDonut(host, summary) {
    if (!host || !summary || !App.util) return;

    var paid = Number(summary.paidAmount) || 0;
    var partial = Number(summary.partialAmount) || 0;
    var total = Number(summary.totalAmount) || 0;
    var collected = paid + partial;
    var outstanding = Math.max(total - collected, 0);
    var chartTotal = collected + outstanding;

    host.innerHTML = '';

    if (!chartTotal) {
      var empty = document.createElement('div');
      empty.className = 'overview-placeholder';
      empty.textContent = '포트폴리오 데이터가 없습니다';
      host.appendChild(empty);
      return;
    }

    var svgNS = 'http://www.w3.org/2000/svg';
    var size = 176;
    var radius = 68;
    var strokeWidth = 18;
    var cx = size / 2;
    var cy = size / 2;
    var circumference = 2 * Math.PI * radius;

    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'overview-portfolio-donut-svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);

    function segment(value) {
      return (value / chartTotal) * circumference;
    }

    var values = [
      { key: 'collected', value: collected, className: 'donut-claim-collected' },
      { key: 'outstanding', value: outstanding, className: 'donut-claim-outstanding' }
    ];

    var labelInfos = [];
    var offset = 0;
    var gap = 1.25;

    for (var i = 0; i < values.length; i++) {
      var seg = values[i];
      if (!seg.value) continue;
      var length = segment(seg.value);

      var arcCenter = offset + length / 2;
      var angle = (arcCenter / circumference) * 2 * Math.PI;

      var pct = Math.round((seg.value / chartTotal) * 100);
      if (pct >= 3) {
        labelInfos.push({
          angle: angle,
          pct: pct,
          key: seg.key
        });
      }

      var visibleLength = Math.max(length - gap, 0);

      var circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', radius);
      circle.setAttribute('fill', 'transparent');
      circle.setAttribute('stroke-width', strokeWidth);
      circle.setAttribute('stroke-dasharray', visibleLength + ' ' + (circumference - visibleLength));
      circle.setAttribute('stroke-dashoffset', -offset);
      circle.setAttribute('class', 'overview-portfolio-donut-segment ' + seg.className);
      svg.appendChild(circle);

      offset += length;
    }

    
    // v248: arc 위에 퍼센트 라벨만 표시 (중앙 텍스트 제거)
    for (var j = 0; j < labelInfos.length; j++) {
      var info = labelInfos[j];
      var angle = info.angle;
      var pct = info.pct;

      // loan 도넛과 동일한 라벨 반지름 계산
      var innerRadius = radius - strokeWidth;
      var outerRadius = radius;
      var labelRadius = (innerRadius + outerRadius) / 2;

      var tx = cx + Math.cos(angle) * labelRadius;
      var ty = cy + Math.sin(angle) * labelRadius;

      var text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', tx);
      text.setAttribute('y', ty + 4);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '16px');
      text.setAttribute('fill', '#000000');
      text.setAttribute('font-weight', '600');
      text.textContent = pct + '%';
      svg.appendChild(text);
    }

    host.appendChild(svg);
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

  function clearNode(node) {
    if (!node) return;
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function createEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (typeof text !== 'undefined' && text !== null) el.textContent = text;
    return el;
  }

  function createLegendItem(boxClass, labelText) {
    var item = createEl('div', 'legend-item');
    var box = createEl('span', 'legend-box ' + boxClass);
    item.appendChild(box);
    item.appendChild(document.createTextNode(' ' + labelText));
    return item;
  }

  function createPortfolioRow(label, value) {
    var row = createEl('div', 'portfolio-card-row');
    row.appendChild(createEl('span', 'portfolio-card-row-label', label));
    row.appendChild(createEl('span', 'portfolio-card-row-value', value));
    return row;
  }

  function createPortfolioCard(title, rows) {
    var card = createEl('div', 'portfolio-card');
    card.appendChild(createEl('div', 'portfolio-card-header', title));
    rows = Array.isArray(rows) ? rows : [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      card.appendChild(createPortfolioRow(row.label, row.value));
    }
    return card;
  }

  function renderPortfolioLegend(host, mode) {
    if (!host) return;
    clearNode(host);
    if (mode === 'claim') {
      host.appendChild(createLegendItem('claim-collected', '회수금'));
      host.appendChild(createLegendItem('claim-outstanding', '미회수금'));
      return;
    }
    host.appendChild(createLegendItem('planned', '상환예정금'));
    host.appendChild(createLegendItem('paid', '상환금'));
    host.appendChild(createLegendItem('overdue', '미납금'));
  }

  function renderPortfolioCards(host, loanSummary, claimSummary) {
    if (!host || !App.util) return;
    clearNode(host);

    function safeAmount(v) {
      return Number(v) || 0;
    }

    function fmt(v) {
      return App.util.formatCurrency(safeAmount(v));
    }

    var loanTotal = safeAmount(loanSummary.totalAmount);
    var loanPlanned = safeAmount(loanSummary.plannedAmount);
    var loanPaid = safeAmount(loanSummary.paidAmount);
    var loanPartial = safeAmount(loanSummary.partialAmount);
    var loanOverdue = safeAmount(loanSummary.overdueAmount);

    var claimTotal = safeAmount(claimSummary.totalAmount);
    var claimPaid = safeAmount(claimSummary.paidAmount);
    var claimPartial = safeAmount(claimSummary.partialAmount);
    var claimCollected = claimPaid + claimPartial;
    var claimOutstanding = Math.max(claimTotal - claimCollected, 0);

    host.appendChild(createPortfolioCard('대출금', [
      { label: '대출원리금합계', value: fmt(loanTotal) },
      { label: '상환금합계', value: fmt(loanPaid + loanPartial) },
      { label: '상환예정금합계', value: fmt(loanPlanned) },
      { label: '미납금합계', value: fmt(loanOverdue) }
    ]));

    host.appendChild(createPortfolioCard('채권금', [
      { label: '채권금합계', value: fmt(claimTotal) },
      { label: '회수금합계', value: fmt(claimCollected) },
      { label: '회수예정금합계', value: fmt(claimOutstanding) }
    ]));
  }

  function commitReportInvalidate(reason) {
    if (App.api && typeof App.api.commit === 'function' && App.ViewKey && App.ViewKey.REPORT) {
      App.api.commit({ reason: reason || 'report:ui', invalidate: [App.ViewKey.REPORT] });
      return;
    }
    if (App.renderCoordinator && typeof App.renderCoordinator.invalidate === 'function' && App.ViewKey && App.ViewKey.REPORT) {
      App.renderCoordinator.invalidate(App.ViewKey.REPORT);
    }
  }

  function syncReportSectionUI(root, activeSection, isMobile) {
    var effectiveSection = isMobile ? 'overview' : activeSection;
    var subtabButtons = root.querySelectorAll('.report-subtab-btn');
    var sections = root.querySelectorAll('.report-section');

    if (subtabButtons && subtabButtons.forEach) {
      subtabButtons.forEach(function (btn) {
        var name = btn.getAttribute('data-report-section') || '';
        btn.classList.toggle('is-active', name === effectiveSection);
      });
    }

    if (sections && sections.forEach) {
      sections.forEach(function (sec) {
        var name = sec.getAttribute('data-report-section') || '';
        sec.classList.toggle('is-active', name === effectiveSection);
      });
    }
  }

  function syncReportUIFromState(root, reportState, isMobile) {
    if (!root || !reportState) return;

    syncReportSectionUI(root, reportState.activeSection, isMobile);

    var portfolioMode = (reportState.portfolioMode === 'claim') ? 'claim' : 'loan';
    var typeButtons = root.querySelectorAll('.portfolio-type-chip[data-portfolio-mode]');
    if (typeButtons && typeButtons.forEach) {
      typeButtons.forEach(function (btn) {
        var mode = btn.getAttribute('data-portfolio-mode') || 'loan';
        btn.classList.toggle('is-active', mode === portfolioMode);
      });
    }

    var capitalflowSection = root.querySelector('.report-section-capitalflow');
    if (capitalflowSection) {
      var periodGroup = capitalflowSection.querySelector('.capitalflow-period-group');
      if (periodGroup) {
        var pButtons = periodGroup.querySelectorAll('.capitalflow-filter-btn[data-filter-value]');
        if (pButtons && pButtons.forEach) {
          pButtons.forEach(function (btn) {
            var value = btn.getAttribute('data-filter-value') || 'monthly';
            btn.classList.toggle('is-active', value === reportState.trend.period);
          });
        }
      }

      var capitalflowPeriodControls = root.querySelector('.report-period-controls[data-period-target="capitalflow"]');
      if (capitalflowPeriodControls) {
        var fromInputT = capitalflowPeriodControls.querySelector('.period-from');
        var toInputT = capitalflowPeriodControls.querySelector('.period-to');
        if (fromInputT) fromInputT.value = reportState.trend.dateFrom || '';
        if (toInputT) toInputT.value = reportState.trend.dateTo || '';
      }

      var capitalflowLegendItems = capitalflowSection.querySelectorAll('.capitalflow-legend-item[data-series]');
      if (capitalflowLegendItems && capitalflowLegendItems.forEach) {
        capitalflowLegendItems.forEach(function (item) {
          var seriesKey = item.getAttribute('data-series') || '';
          var isActive = true;
          if (App.reportState && typeof App.reportState.getLegendVisibility === 'function') {
            isActive = App.reportState.getLegendVisibility('capitalflow', seriesKey);
          } else if (reportState.legendVisibility && reportState.legendVisibility.capitalflow && Object.prototype.hasOwnProperty.call(reportState.legendVisibility.capitalflow, seriesKey)) {
            isActive = reportState.legendVisibility.capitalflow[seriesKey] !== false;
          }
          item.classList.toggle('is-active', isActive);
          item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
      }
    }

    var riskPeriodControls = root.querySelector('.report-period-controls[data-period-target="risk"]');
    if (riskPeriodControls) {
      var fromInputR = riskPeriodControls.querySelector('.period-from');
      var toInputR = riskPeriodControls.querySelector('.period-to');
      if (fromInputR) fromInputR.value = reportState.risk.dateFrom || '';
      if (toInputR) toInputR.value = reportState.risk.dateTo || '';
    }
  }

  function renderOverviewMetrics(root) {
    if (!root || !App.state || !App.data || !App.util) return;

    var dateRange = { from: null, to: null };

    var loanSummary = App.data.computePortfolioSummary('loan', dateRange) || {};
    var claimSummary = App.data.computePortfolioSummary('claim', dateRange) || {};

    function safeAmount(v) {
      return Number(v) || 0;
    }

    var reportState = ensureReportState();
    var mode = (reportState.portfolioMode === 'claim') ? 'claim' : 'loan';

    // 도넛 렌더링 (대출 / 채권 모드)
    var donutHost = root.querySelector('.overview-portfolio-donut');
    if (donutHost) {
      if (mode === 'claim') {
        renderOverviewClaimDonut(donutHost, claimSummary);
      } else {
        renderOverviewDonut(donutHost, loanSummary);
      }
    }

    // 범례/라벨 영역 업데이트
    var legendHost = root.querySelector('.portfolio-legend');
    if (legendHost) {
      renderPortfolioLegend(legendHost, mode);
    }

    // Info 카드 렌더링 – 대출/채권 요약
    var cardsHost = root.querySelector('.overview-portfolio-cards');
    if (cardsHost) {
      renderPortfolioCards(cardsHost, loanSummary, claimSummary);
    }

    // (기존) 회수 흐름 2x2 요약 채우기 – 추후 필요 시 유지
  }

function init() {
    if (initialized) return;
    initialized = true;
    ensureReportState();
    bindEvents();
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

    // V189 – Overview 포트폴리오 / 회수 흐름 요약 렌더링 (모바일 v3.2.1에서는 숨김)
    if (!isMobile && App.data && typeof App.data.computePortfolioSummary === 'function' && root.querySelector('#overview-metrics')) {
      try {
        renderOverviewMetrics(root);
      } catch (e) {
        console.warn('[Report] Failed to render overview metrics:', e);
      }
    }

    // 보호 코드: formatShortCurrency 미정의 시 안전한 기본 구현 등록
    if (!App.util || typeof App.util.formatShortCurrency !== 'function') {
      if (App.util && typeof App.util.formatCurrency === 'function') {
        // Fallback: use formatCurrency when formatShortCurrency is not defined
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

    try {
      updateReportView(root);
      if (!isMobile && App.reportRender && App.reportRender.recovery && typeof App.reportRender.recovery.init === 'function') {
        App.reportRender.recovery.init(root);
      }
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
          var fromValue = (fromInputT && fromInputT.value) ? fromInputT.value : null;
          var toValue = (toInputT && toInputT.value) ? toInputT.value : null;
          if (App.reportState && typeof App.reportState.setTrendRange === 'function') {
            App.reportState.setTrendRange(fromValue, toValue);
          } else {
            var reportState1 = ensureReportState();
            reportState1.trend.dateFrom = fromValue;
            reportState1.trend.dateTo = toValue;
          }
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
          var fromValueR = (fromInputR && fromInputR.value) ? fromInputR.value : null;
          var toValueR = (toInputR && toInputR.value) ? toInputR.value : null;
          if (App.reportState && typeof App.reportState.setRiskRange === 'function') {
            App.reportState.setRiskRange(fromValueR, toValueR);
          } else {
            var reportState2 = ensureReportState();
            reportState2.risk.dateFrom = fromValueR;
            reportState2.risk.dateTo = toValueR;
          }
          commitReportInvalidate('report:riskRange');
        }
      }
    });
  }








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

function updateOverviewKPI(root, agg) {
  var util = App.util || {};
  agg = agg || {};
  var totals = agg.totals || {};
  var period = agg.period || {};

  // 포트폴리오 KPI 요약은 data.js의 computePortfolioSummary를 사용한다.
  var loanSummary = null;
  var claimSummary = null;

  if (App.data && typeof App.data.computePortfolioSummary === 'function') {
    try {
      var dateRange = { from: null, to: null };
      loanSummary = App.data.computePortfolioSummary('loan', dateRange) || null;
      claimSummary = App.data.computePortfolioSummary('claim', dateRange) || null;
    } catch (e) {
      console.warn('[Report] updateOverviewKPI: computePortfolioSummary failed', e);
    }
  }

  function safeAmount(value) {
    var n = Number(value);
    if (!isFinite(n)) n = 0;
    return n;
  }

  function getLoan(field, fallback) {
    if (loanSummary && loanSummary[field] != null) {
      return safeAmount(loanSummary[field]);
    }
    return safeAmount(fallback);
  }

  function getClaim(field, fallback) {
    if (claimSummary && claimSummary[field] != null) {
      return safeAmount(claimSummary[field]);
    }
    return safeAmount(fallback);
  }

  // ① 대출규모 – LoanTotal / LoanPaid / LoanPlanned / LoanOverdue
  var loanTotal   = getLoan('totalAmount',   totals.loanTotalRepay || 0);
  var loanPaid    = getLoan('paidAmount',    0);
  var loanPlanned = getLoan('plannedAmount', 0);
  var loanOverdue = getLoan('overdueAmount', 0);

  var loanCard = root.querySelector('.report-kpi-card[data-kpi="loan"]');
  if (loanCard) {
    var mainLabelEl = loanCard.querySelector('.report-kpi-main .report-kpi-label');
    var mainValueEl = loanCard.querySelector('.report-kpi-main .report-kpi-value');
    if (mainLabelEl && mainValueEl) {
      var mainLabel = (mainLabelEl.textContent || '').trim();
      // v247: 라벨이 정확히 '대출원리금합계'인 경우에만 LoanTotal을 매핑
      if (mainLabel === '대출원리금합계') {
        mainValueEl.textContent = formatCurrencySafe(util, loanTotal);
      }
    }

    var subs = loanCard.querySelectorAll('.report-kpi-submetrics .submetric');
    subs.forEach(function (s) {
      var labelEl = s.querySelector('.submetric-label');
      var valueEl = s.querySelector('.submetric-value');
      if (!labelEl || !valueEl) return;
      var label = (labelEl.textContent || '').trim();

      // v247: label === 형태만 사용, 구버전 alias 라벨 조건은 모두 제거
      if (label === '상환금합계') {
        // 상환금합계 → LoanPaid
        valueEl.textContent = formatCurrencySafe(util, loanPaid);
      } else if (label === '상환예정금합계') {
        // 상환예정금합계 → LoanPlanned
        valueEl.textContent = formatCurrencySafe(util, loanPlanned);
      } else if (label === '미납금합계') {
        // 미납금합계 → LoanOverdue
        valueEl.textContent = formatCurrencySafe(util, loanOverdue);
      }
    });
  }

  // ② 채권규모 – ClaimTotal / ClaimPaid / ClaimPlanned
  // ClaimTotal = ClaimPaid + ClaimPlanned (outstanding)
  var claimTotal       = getClaim('totalAmount',   totals.claimAmount || 0);
  var claimPaid        = getClaim('paidAmount',    0);
  // computePortfolioSummary('claim')에서는 overdueAmount를 미회수(잔액)로 사용한다.
  var claimOutstanding = getClaim('overdueAmount', totals.claimOutstanding || 0);
  var claimPlanned     = claimOutstanding;

  var claimCard = root.querySelector('.report-kpi-card[data-kpi="claim"]');
  if (claimCard) {
    var mainLabelEl2 = claimCard.querySelector('.report-kpi-main .report-kpi-label');
    var mainValueEl2 = claimCard.querySelector('.report-kpi-main .report-kpi-value');
    if (mainLabelEl2 && mainValueEl2) {
      var mainLabel2 = (mainLabelEl2.textContent || '').trim();
      // v247: 라벨이 정확히 '채권금합계'인 경우에만 ClaimTotal을 매핑
      if (mainLabel2 === '채권금합계') {
        mainValueEl2.textContent = formatCurrencySafe(util, claimTotal);
      }
    }

    var subs2 = claimCard.querySelectorAll('.report-kpi-submetrics .submetric');
    subs2.forEach(function (s) {
      var labelEl = s.querySelector('.submetric-label');
      var valueEl = s.querySelector('.submetric-value');
      if (!labelEl || !valueEl) return;
      var label = (labelEl.textContent || '').trim();

      // v247: label === 형태만 사용, 구버전 alias 라벨 조건 제거
      if (label === '회수금합계') {
        // 회수금합계 → ClaimPaid
        valueEl.textContent = formatCurrencySafe(util, claimPaid);
      } else if (label === '회수예정금합계') {
        // 회수예정금합계 → ClaimPlanned (= outstanding)
        valueEl.textContent = formatCurrencySafe(util, claimPlanned);
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
            amountLoan += Number(loan.totalRepayAmount || loan.principal || 0);
            countLoan += 1;
          }
        });
        valueEl.textContent =
          formatCurrencySafe(util, amountLoan) + ' / ' +
          formatNumberSafe(util, countLoan) + '건';
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
        valueEl.textContent =
          formatCurrencySafe(util, amountClaim) + ' / ' +
          formatNumberSafe(util, countClaim) + '건';
      }
    });
  }

  // ④ 가용자산(data-kpi="avail") — Cash Ledger(sum of cashLogs.amount)
  var availCard = root.querySelector('.report-kpi-card[data-kpi="avail"]');
  if (availCard) {
    var availValueEl = availCard.querySelector('.report-kpi-main .report-kpi-value');
    if (availValueEl) {
      var totalAvail = 0;
      if (App.cashLedger && typeof App.cashLedger.getCurrentBalance === 'function') {
        totalAvail = Number(App.cashLedger.getCurrentBalance()) || 0;
      } else {
        var logs = (App.state && Array.isArray(App.state.cashLogs)) ? App.state.cashLogs : [];
        for (var i = 0; i < logs.length; i++) {
          var it = logs[i];
          if (!it) continue;
          totalAvail += Number(it.amount) || 0;
        }
      }
      availValueEl.textContent = formatCurrencySafe(util, totalAvail);
    }
  }
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


function updateReportView(root) {
  if (!root || !App.state) return;
  var agg = (App.reportCompute && App.reportCompute.computeAggregates)
    ? App.reportCompute.computeAggregates()
    : null;
  if (!agg) return;
  updateOverviewKPI(root, agg);
  updateRecoveryTiles(root, agg);

  if (App.features && App.features.statisticsEngine) {
    var statRoot = root.querySelector('.report-section-statistics');
    if (statRoot) {
      var ctx = App.features.statisticsEngine.buildContext(agg);
      App.features.statisticsEngine.render(statRoot, ctx);
    }
  }

  if (App.reportRender && App.reportRender.capitalflow && App.reportRender.capitalflow.updateCapitalFlowSection) {
    App.reportRender.capitalflow.updateCapitalFlowSection(root, agg);
  }
  if (App.reportRender && App.reportRender.risk && App.reportRender.risk.updateRiskSection) {
    App.reportRender.risk.updateRiskSection(root, agg);
  }
}

  App.features.report = {
    init: init,
    // Stage 6: keep the real report renderer for internal use,
    // but deprecate direct external render() entrypoints.
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
      // Legacy bridge only: this wrapper remains for older callers, but it is not a direct-DOM
      // standard entry anymore. Route back into commit/invalidate so renderer ownership stays centralized.
      var wrapper = function () {
        warnOnce();
        if (App.api && App.api.view && typeof App.api.view.invalidate === 'function' && App.ViewKey) {
          App.api.view.invalidate(App.ViewKey.REPORT);
          return;
        }
        // Fallback (no direct DOM render): best-effort invalidate only.
        if (App.renderCoordinator && typeof App.renderCoordinator.invalidate === 'function' && App.ViewKey) {
          App.renderCoordinator.invalidate(App.ViewKey.REPORT);
        }
      };
      wrapper._deprecatedInvalidateWrapper = true;
      return wrapper;
    })()
  };
})(window, document);