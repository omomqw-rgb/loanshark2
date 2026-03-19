(function (window, document) {
  'use strict';
  var App = window.App || (window.App = {});
  App.reportRender = App.reportRender || {};

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

  function getContext(input) {
    if (input && input.overview && input.format && input.ui) {
      return input;
    }
    return {
      format: {
        currency: function (value) { return String(Number(value) || 0); },
        number: function (value) { return String(Number(value) || 0); }
      },
      ui: { portfolioMode: 'loan' },
      overview: {
        metrics: {
          loan: { total: 0, paid: 0, planned: 0, overdue: 0 },
          claim: { total: 0, paid: 0, outstanding: 0 },
          debt: { total: 0, paid: 0, planned: 0, overdue: 0 }
        },
        mode: 'loan',
        loanMetrics: { total: 0, paid: 0, planned: 0, overdue: 0 },
        claimMetrics: { total: 0, paid: 0, planned: 0, outstanding: 0 },
        ops: { newLoanAmount: 0, newLoanCount: 0, newClaimAmount: 0, newClaimCount: 0 },
        availableCapital: 0
      }
    };
  }

  function getRecoverySemantics(context) {
    var overview = context && context.overview ? context.overview : {};
    return {
      label: overview.recoveryLabel || '회수 흐름',
      description: overview.recoveryDescription || '스케줄 기준 예정액과 실제 회수액의 회수 흐름/추세입니다. 실제 현금성 자본 이동을 보여주는 Capital Flow와는 다른 의미 계약입니다.',
      basisText: overview.recoveryBasisText || '스케줄 기준 예정액·실회수 추세',
      flowType: overview.recoveryFlowType || 'recovery-trend'
    };
  }

  function syncRecoveryPanelHeader(root, context) {
    if (!root) return;
    var panel = root.querySelector('.overview-panel-recovery-new');
    if (!panel) return;

    var semantics = getRecoverySemantics(context);
    var header = panel.querySelector('.overview-panel-header');
    var title = panel.querySelector('.overview-panel-title');
    if (title) {
      title.textContent = semantics.label || '회수 흐름';
    }
    if (header) {
      var desc = header.querySelector('.report-section-desc[data-role="overview-recovery-desc"]');
      if (!desc) {
        desc = createEl('p', 'report-section-desc');
        desc.setAttribute('data-role', 'overview-recovery-desc');
        header.appendChild(desc);
      }
      desc.textContent = semantics.description || semantics.basisText || '';
    }
    panel.setAttribute('data-recovery-flow-type', semantics.flowType || 'recovery-trend');
  }


  function renderOverviewDonut(host, metrics) {
    if (!host || !metrics) return;

    var planned = Number(metrics.planned) || 0;
    var paid = Number(metrics.paid) || 0;
    var overdue = Number(metrics.overdue) || 0;
    var total = planned + paid + overdue;

    clearNode(host);

    if (!total) {
      host.appendChild(createEl('div', 'overview-placeholder', '포트폴리오 데이터가 없습니다'));
      return;
    }

    var size = 176;
    var strokeWidth = 18;
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
      { key: 'overdue', value: overdue, className: 'donut-overdue' }
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
      var pct = Math.round((seg.value / total) * 100);

      if (pct >= 3) {
        labelInfos.push({ angle: angle, pct: pct, key: seg.key });
      }

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

    for (var j = 0; j < labelInfos.length; j++) {
      var info = labelInfos[j];
      var innerRadius = radius - strokeWidth;
      var outerRadius = radius;
      var labelRadius = (innerRadius + outerRadius) / 2;
      var tx = cx + Math.cos(info.angle) * labelRadius;
      var ty = cy + Math.sin(info.angle) * labelRadius;

      var text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', tx);
      text.setAttribute('y', ty + 4);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '16px');
      text.setAttribute('fill', '#000000');
      text.setAttribute('font-weight', '600');
      text.textContent = info.pct + '%';
      svg.appendChild(text);
    }

    host.appendChild(svg);
  }

  function renderOverviewClaimDonut(host, metrics) {
    if (!host || !metrics) return;

    var paid = Number(metrics.paid) || 0;
    var outstanding = Number(metrics.outstanding != null ? metrics.outstanding : metrics.planned) || 0;
    var chartTotal = paid + outstanding;

    clearNode(host);

    if (!chartTotal) {
      host.appendChild(createEl('div', 'overview-placeholder', '포트폴리오 데이터가 없습니다'));
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
      { key: 'paid', value: paid, className: 'donut-claim-collected' },
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
        labelInfos.push({ angle: angle, pct: pct, key: seg.key });
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

    for (var j = 0; j < labelInfos.length; j++) {
      var info = labelInfos[j];
      var innerRadius = radius - strokeWidth;
      var outerRadius = radius;
      var labelRadius = (innerRadius + outerRadius) / 2;
      var tx = cx + Math.cos(info.angle) * labelRadius;
      var ty = cy + Math.sin(info.angle) * labelRadius;

      var text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', tx);
      text.setAttribute('y', ty + 4);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '16px');
      text.setAttribute('fill', '#000000');
      text.setAttribute('font-weight', '600');
      text.textContent = info.pct + '%';
      svg.appendChild(text);
    }

    host.appendChild(svg);
  }

  function renderPortfolioLegend(host, mode) {
    if (!host) return;
    clearNode(host);
    if (mode === 'claim') {
      host.appendChild(createLegendItem('claim-collected', '회수금'));
      host.appendChild(createLegendItem('claim-outstanding', '회수예정금'));
      return;
    }
    host.appendChild(createLegendItem('planned', '상환예정금'));
    host.appendChild(createLegendItem('paid', '상환금'));
    host.appendChild(createLegendItem('overdue', '미납금'));
  }

  function renderPortfolioCards(host, loanMetrics, claimMetrics, format) {
    if (!host) return;
    clearNode(host);

    var currency = format && typeof format.currency === 'function'
      ? format.currency
      : function (value) { return String(Number(value) || 0); };

    host.appendChild(createPortfolioCard('대출금', [
      { label: '대출원리금합계', value: currency(loanMetrics && loanMetrics.total || 0) },
      { label: '상환금합계', value: currency(loanMetrics && loanMetrics.paid || 0) },
      { label: '상환예정금합계', value: currency(loanMetrics && loanMetrics.planned || 0) },
      { label: '미납금합계', value: currency(loanMetrics && loanMetrics.overdue || 0) }
    ]));

    host.appendChild(createPortfolioCard('채권금', [
      { label: '채권금합계', value: currency(claimMetrics && claimMetrics.total || 0) },
      { label: '회수금합계', value: currency(claimMetrics && claimMetrics.paid || 0) },
      { label: '회수예정금합계', value: currency((claimMetrics && (claimMetrics.outstanding != null ? claimMetrics.outstanding : claimMetrics.planned)) || 0) }
    ]));
  }

  function renderOverviewMetrics(root, context) {
    if (!root) return;

    var overview = context.overview || {};
    var loanMetrics = overview.loanMetrics || { total: 0, paid: 0, planned: 0, overdue: 0 };
    var claimMetrics = overview.claimMetrics || { total: 0, paid: 0, planned: 0, outstanding: 0 };
    var mode = context.ui && context.ui.portfolioMode === 'claim' ? 'claim' : (overview.mode === 'claim' ? 'claim' : 'loan');

    var donutHost = root.querySelector('.overview-portfolio-donut');
    if (donutHost) {
      if (mode === 'claim') {
        renderOverviewClaimDonut(donutHost, claimMetrics);
      } else {
        renderOverviewDonut(donutHost, loanMetrics);
      }
    }

    var legendHost = root.querySelector('.portfolio-legend');
    if (legendHost) {
      renderPortfolioLegend(legendHost, mode);
    }

    var cardsHost = root.querySelector('.overview-portfolio-cards');
    if (cardsHost) {
      renderPortfolioCards(cardsHost, loanMetrics, claimMetrics, context.format || {});
    }
  }

  function updateOverviewKPI(root, context) {
    if (!root) return;
    var overview = context.overview || {};
    var finance = overview.metrics || {
      loan: { total: 0, paid: 0, planned: 0, overdue: 0 },
      claim: { total: 0, paid: 0, outstanding: 0 },
      debt: { total: 0, paid: 0, planned: 0, overdue: 0 }
    };
    var format = context.format || {};
    var currency = typeof format.currency === 'function'
      ? format.currency
      : function (value) { return String(Number(value) || 0); };
    var number = typeof format.number === 'function'
      ? format.number
      : function (value) { return String(Number(value) || 0); };

    var loanCard = root.querySelector('.report-kpi-card[data-kpi="loan"]');
    if (loanCard) {
      var mainLabelEl = loanCard.querySelector('.report-kpi-main .report-kpi-label');
      var mainValueEl = loanCard.querySelector('.report-kpi-main .report-kpi-value');
      if (mainLabelEl && mainValueEl && (mainLabelEl.textContent || '').trim() === '대출원리금합계') {
        mainValueEl.textContent = currency(finance.loan.total || 0);
      }
      var subs = loanCard.querySelectorAll('.report-kpi-submetrics .submetric');
      subs.forEach(function (metric) {
        var labelEl = metric.querySelector('.submetric-label');
        var valueEl = metric.querySelector('.submetric-value');
        if (!labelEl || !valueEl) return;
        var label = (labelEl.textContent || '').trim();
        if (label === '상환금합계') valueEl.textContent = currency(finance.loan.paid || 0);
        else if (label === '상환예정금합계') valueEl.textContent = currency(finance.loan.planned || 0);
        else if (label === '미납금합계') valueEl.textContent = currency(finance.loan.overdue || 0);
      });
    }

    var claimCard = root.querySelector('.report-kpi-card[data-kpi="claim"]');
    if (claimCard) {
      var mainLabelEl2 = claimCard.querySelector('.report-kpi-main .report-kpi-label');
      var mainValueEl2 = claimCard.querySelector('.report-kpi-main .report-kpi-value');
      if (mainLabelEl2 && mainValueEl2 && (mainLabelEl2.textContent || '').trim() === '채권금합계') {
        mainValueEl2.textContent = currency(finance.claim.total || 0);
      }
      var subs2 = claimCard.querySelectorAll('.report-kpi-submetrics .submetric');
      subs2.forEach(function (metric) {
        var labelEl = metric.querySelector('.submetric-label');
        var valueEl = metric.querySelector('.submetric-value');
        if (!labelEl || !valueEl) return;
        var label = (labelEl.textContent || '').trim();
        if (label === '회수금합계') valueEl.textContent = currency(finance.claim.paid || 0);
        else if (label === '회수예정금합계') valueEl.textContent = currency(finance.claim.outstanding || 0);
      });
    }

    var opsCard = root.querySelector('.report-kpi-card[data-kpi="ops"]');
    if (opsCard) {
      var subsOps = opsCard.querySelectorAll('.report-kpi-submetrics .submetric');
      subsOps.forEach(function (metric) {
        var labelEl = metric.querySelector('.submetric-label');
        var valueEl = metric.querySelector('.submetric-value');
        if (!labelEl || !valueEl) return;
        var label = labelEl.textContent.trim();
        if (label.indexOf('신규대출금액') !== -1) {
          valueEl.textContent = currency(overview.ops && overview.ops.newLoanAmount || 0) + ' / ' + number(overview.ops && overview.ops.newLoanCount || 0) + '건';
        } else if (label.indexOf('신규채권금액') !== -1) {
          valueEl.textContent = currency(overview.ops && overview.ops.newClaimAmount || 0) + ' / ' + number(overview.ops && overview.ops.newClaimCount || 0) + '건';
        }
      });
    }

    var availCard = root.querySelector('.report-kpi-card[data-kpi="avail"]');
    if (availCard) {
      var availValueEl = availCard.querySelector('.report-kpi-main .report-kpi-value');
      if (availValueEl) {
        availValueEl.textContent = currency(overview.availableCapital || 0);
      }
    }
  }

  function render(root, context, options) {
    options = options || {};
    var activeContext = getContext(context);
    syncRecoveryPanelHeader(root, activeContext);
    updateOverviewKPI(root, activeContext);
    if (options.isMobile) return;
    renderOverviewMetrics(root, activeContext);
  }

  App.reportRender.overview = {
    render: render,
    renderMetrics: renderOverviewMetrics,
    updateKPI: updateOverviewKPI
  };
})(window, document);
