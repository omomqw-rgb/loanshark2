(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  App.features = App.features || {};

  App.features.statisticsEngine = (function () {

    function getMetrics(agg) {
      if (agg && agg.metrics) return agg.metrics;
      if (App.portfolioMetrics && typeof App.portfolioMetrics.build === 'function') {
        return App.portfolioMetrics.build();
      }
      return null;
    }

    function clonePlain(value) {
      if (!value || typeof value !== 'object') return value;
      return JSON.parse(JSON.stringify(value));
    }

    function getDefaultWeekSemantics() {
      return {
        weekStartsOn: 1,
        weekAnchor: 'monday',
        label: '월요일 시작 주간 기준',
        shortLabel: '월요일 시작',
        description: 'Report 전체 주간 해석은 월요일 시작(Monday anchor) 기준입니다.'
      };
    }

    function resolveWeekSemantics(value) {
      if (!value || typeof value !== 'object') return getDefaultWeekSemantics();
      return {
        weekStartsOn: Number(value.weekStartsOn) || 1,
        weekAnchor: value.weekAnchor || 'monday',
        label: value.label || '월요일 시작 주간 기준',
        shortLabel: value.shortLabel || '월요일 시작',
        description: value.description || 'Report 전체 주간 해석은 월요일 시작(Monday anchor) 기준입니다.'
      };
    }

    function buildWeekSemanticsNote(weekSemantics) {
      var resolved = resolveWeekSemantics(weekSemantics);
      return '주간 기준 안내는 Report 전체와 동일하게 ' + (resolved.label || '월요일 시작 주간 기준') + '을 따릅니다.';
    }

    function buildSectionCopy(weekSemantics) {
      return {
        header: {
          title: 'Statistics',
          description: '전체 포트폴리오 구조 및 누적 통계를 한눈에 정리합니다.',
          note: buildWeekSemanticsNote(weekSemantics)
        },
        snapshot: {
          title: '오늘 기준 스냅샷',
          description: '현재 시점 기준 누적 포트폴리오 스냅샷입니다.'
        },
        portfolio: {
          title: 'Loan / Claim 구조',
          description: '대출/채권 포트폴리오를 중립 기준으로 압축한 summary입니다.'
        },
        schedule: {
          title: '스케줄 상태',
          description: '전체 스케줄 기준 회차/잔액 집계입니다. 부분납 금액은 잔여금 기준으로 표시되며, 대출/채권 total과 직접 1:1 대응하지 않을 수 있습니다.'
        },
        debtors: {
          title: '채무자 통계',
          description: '현재 등록된 전체 채무자 수와 활성 채무자 수 기준입니다.'
        }
      };
    }

    function buildContext(agg, options) {
      var metrics = getMetrics(agg) || {
        finance: {
          loan: { total: 0, paid: 0, planned: 0, overdue: 0, remaining: 0 },
          claim: { total: 0, paid: 0, outstanding: 0, duePassedOutstanding: 0 },
          debt: { total: 0, paid: 0, planned: 0, overdue: 0 }
        },
        scheduleStatus: { counts: {}, amounts: {} },
        counts: { totalDebtors: 0, activeDebtors: 0, totalLoans: 0, activeLoans: 0, totalClaims: 0, activeClaims: 0 }
      };

      var finance = metrics.finance || {};
      var loan = finance.loan || {};
      var claim = finance.claim || {};
      var debt = finance.debt || {};
      var counts = metrics.counts || {};
      var scheduleStatus = metrics.scheduleStatus || {};
      var weekSemantics = resolveWeekSemantics(options && options.weekSemantics);
      var copy = buildSectionCopy(weekSemantics);

      return {
        summary: {
          debttotal: Number(debt.total) || 0,
          debtpaid: Number(debt.paid) || 0,
          debtplanned: Number(debt.planned) || 0,
          debtoverdue: Number(debt.overdue) || 0
        },
        portfolio: [
          {
            type: 'Loan',
            count: counts.totalLoans || 0,
            total: Number(loan.total) || 0,
            paid: Number(loan.paid) || 0,
            planned: Number(loan.planned) || 0,
            overdue: Number(loan.overdue) || 0
          },
          {
            type: 'Claim',
            count: counts.totalClaims || 0,
            total: Number(claim.total) || 0,
            paid: Number(claim.paid) || 0,
            planned: Number(claim.outstanding) || 0,
            overdue: 0
          }
        ],
        loanStructure: {
          '대출원리금합계': Number(loan.total) || 0,
          '대출상환금합계': Number(loan.paid) || 0,
          '대출상환예정금합계': Number(loan.planned) || 0,
          '대출미납금합계': Number(loan.overdue) || 0,
          '대출건수': counts.totalLoans || 0,
          '활성대출건수': counts.activeLoans || 0
        },
        claimStructure: {
          '채권금합계': Number(claim.total) || 0,
          '회수금합계': Number(claim.paid) || 0,
          '회수예정금합계': Number(claim.outstanding) || 0,
          '채권건수': counts.totalClaims || 0,
          '진행중채권건수': counts.activeClaims || 0
        },
        scheduleCounts: scheduleStatus.counts || {},
        scheduleAmounts: scheduleStatus.amounts || {},
        weekSemantics: clonePlain(weekSemantics),
        periodDescription: copy.header.note,
        header: clonePlain(copy.header),
        snapshot: clonePlain(copy.snapshot),
        portfolioMeta: clonePlain(copy.portfolio),
        scheduleMeta: clonePlain(copy.schedule),
        debtorsMeta: clonePlain(copy.debtors),
        debtors: {
          '전체 채무자 수': counts.totalDebtors || 0,
          '활성 채무자 수': counts.activeDebtors || 0
        }
      };
    }

    function clearElement(el) {
      if (!el) return;
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    }

    function getFormatters(input) {
      var format = input && input.format ? input.format : {};
      return {
        number: typeof format.number === 'function'
          ? format.number
          : function (value) {
              var util = App.util || {};
              if (typeof util.formatNumber === 'function') return util.formatNumber(value);
              return String(Number(value) || 0);
            },
        currency: typeof format.currency === 'function'
          ? format.currency
          : function (value) {
              var util = App.util || {};
              if (typeof util.formatCurrency === 'function') return util.formatCurrency(Number(value) || 0);
              return String(Number(value) || 0);
            }
      };
    }

    function getStatusLabel(code) {
      var map = {
        PLANNED: '예정',
        PAID: '완납',
        PARTIAL: '부분납',
        OVERDUE: '미납'
      };
      return map[code] || code;
    }

    function getValueCellRole(label) {
      if (label == null) return 'value';
      return label.indexOf('건수') !== -1 || label.indexOf('회차수') !== -1 || label.indexOf('채무자 수') !== -1 ? 'count' : 'value';
    }

    function ensureTextNode(root, selector, className, tagName) {
      var node = root ? root.querySelector(selector) : null;
      if (node) return node;
      if (!root) return null;
      node = document.createElement(tagName || 'p');
      if (className) node.className = className;
      return node;
    }

    function setTextContent(root, selector, text, options) {
      if (!root) return;
      var node = root.querySelector(selector);
      if (!node && options && options.parentSelector) {
        var parent = root.querySelector(options.parentSelector);
        if (parent) {
          node = document.createElement(options.tagName || 'p');
          if (options.className) node.className = options.className;
          if (options.attributes) {
            Object.keys(options.attributes).forEach(function (key) {
              node.setAttribute(key, options.attributes[key]);
            });
          }
          parent.appendChild(node);
        }
      }
      if (!node) return;
      node.textContent = text || '';
      if (!text) {
        node.setAttribute('hidden', 'hidden');
      } else {
        node.removeAttribute('hidden');
      }
    }

    function appendEmptyRow(tbody, colSpan, text) {
      var tr = document.createElement('tr');
      tr.className = 'statistics-empty-row';
      var td = document.createElement('td');
      td.colSpan = colSpan;
      td.textContent = text || '표시할 데이터 없음';
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    function appendTextCell(tr, text, role) {
      var td = document.createElement('td');
      td.textContent = text;
      td.setAttribute('data-cell-role', role || 'label');
      tr.appendChild(td);
      return td;
    }

    function syncSectionCopy(root, ctx) {
      if (!root) return;
      var header = ctx.header || {};
      var snapshot = ctx.snapshot || {};
      var portfolioMeta = ctx.portfolioMeta || {};
      var scheduleMeta = ctx.scheduleMeta || {};
      var debtorsMeta = ctx.debtorsMeta || {};

      setTextContent(root, '[data-role="statistics-section-description"]', header.description || '전체 포트폴리오 구조 및 누적 통계', {
        parentSelector: '.statistics-section-shell-header .report-section-header-main',
        className: 'report-section-desc',
        attributes: { 'data-role': 'statistics-section-description' }
      });
      setTextContent(root, '[data-role="statistics-section-meta-note"]', header.note || '', {
        parentSelector: '.statistics-section-shell-header .report-section-header-main',
        className: 'report-section-desc report-section-meta-note',
        attributes: { 'data-role': 'statistics-section-meta-note' }
      });
      setTextContent(root, '[data-role="statistics-snapshot-description"]', snapshot.description || '', {
        parentSelector: '.statistics-section-snapshot .statistics-header',
        className: 'statistics-copy',
        attributes: { 'data-role': 'statistics-snapshot-description' }
      });
      setTextContent(root, '[data-role="statistics-portfolio-description"]', portfolioMeta.description || '', {
        parentSelector: '.statistics-section-portfolio .statistics-header',
        className: 'statistics-copy',
        attributes: { 'data-role': 'statistics-portfolio-description' }
      });
      setTextContent(root, '[data-role="statistics-schedule-description"]', scheduleMeta.description || '', {
        parentSelector: '.statistics-section-schedule .statistics-header',
        className: 'statistics-copy',
        attributes: { 'data-role': 'statistics-schedule-description' }
      });
      setTextContent(root, '[data-role="statistics-debtors-description"]', debtorsMeta.description || '', {
        parentSelector: '.statistics-section-debtors .statistics-header',
        className: 'statistics-copy',
        attributes: { 'data-role': 'statistics-debtors-description' }
      });
    }

    function renderSummary(root, summary, formatters) {
      var cards = root.querySelectorAll('.statistics-kpi-card[data-kpi]');
      if (!cards || !cards.length) return;
      var labelMap = {
        debttotal: '채무금합계',
        debtpaid: '채무상환금합계',
        debtplanned: '채무상환예정금합계',
        debtoverdue: '미납금합계'
      };
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var key = card.getAttribute('data-kpi');
        var label = labelMap[key] || key || '';
        var rawValue = summary && Object.prototype.hasOwnProperty.call(summary, key) ? summary[key] : 0;
        clearElement(card);
        var labelEl = document.createElement('div');
        labelEl.className = 'statistics-kpi-label';
        labelEl.textContent = label;
        var valueEl = document.createElement('div');
        valueEl.className = 'statistics-kpi-value';
        valueEl.textContent = formatters.currency(rawValue);
        card.appendChild(labelEl);
        card.appendChild(valueEl);
      }
    }

    function renderPortfolioTable(root, portfolio, formatters) {
      var table = root.querySelector('.statistics-section-portfolio table.statistics-table[data-table="portfolio"]');
      if (!table) return;
      var tbody = table.querySelector('tbody');
      if (!tbody) {
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
      }
      clearElement(tbody);
      if (!portfolio || !portfolio.length) {
        appendEmptyRow(tbody, 6, '표시할 데이터 없음');
        return;
      }
      function mapTypeLabel(type) {
        if (type === 'Loan') return '대출';
        if (type === 'Claim') return '채권';
        return type || '';
      }
      for (var i = 0; i < portfolio.length; i++) {
        var row = portfolio[i] || {};
        var tr = document.createElement('tr');
        appendTextCell(tr, mapTypeLabel(row.type), 'label');
        appendTextCell(tr, formatters.number(row.count || 0), 'count');
        appendTextCell(tr, formatters.currency(row.total || 0), 'value');
        appendTextCell(tr, formatters.currency(row.paid || 0), 'value');
        appendTextCell(tr, formatters.currency(row.planned || 0), 'value');
        appendTextCell(tr, formatters.currency(row.overdue || 0), 'value');
        tbody.appendChild(tr);
      }
    }

    function renderKeyValueTable(root, tableAttr, data, valueFormatter) {
      var selector = 'table.statistics-table[data-table="' + tableAttr + '"]';
      var table = root.querySelector(selector);
      if (!table) return;
      var tbody = table.querySelector('tbody');
      if (!tbody) {
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
      }
      clearElement(tbody);
      var keys = Object.keys(data || {});
      if (!keys.length) {
        appendEmptyRow(tbody, 2, '표시할 데이터 없음');
        return;
      }
      for (var i = 0; i < keys.length; i++) {
        var label = keys[i];
        var value = data[label];
        var tr = document.createElement('tr');
        appendTextCell(tr, label, 'label');
        appendTextCell(tr, typeof valueFormatter === 'function' ? valueFormatter(label, value) : String(value), getValueCellRole(label));
        tbody.appendChild(tr);
      }
    }

    function renderScheduleTables(root, scheduleCounts, scheduleAmounts, formatters) {
      scheduleCounts = scheduleCounts || {};
      scheduleAmounts = scheduleAmounts || {};
      var order = ['PLANNED', 'PARTIAL', 'PAID', 'OVERDUE'];
      var codes = [];
      var seen = Object.create(null);
      for (var i = 0; i < order.length; i++) {
        var code = order[i];
        if (scheduleCounts[code] != null || scheduleAmounts[code] != null) {
          codes.push(code);
          seen[code] = true;
        }
      }
      for (var key in scheduleCounts) {
        if (!Object.prototype.hasOwnProperty.call(scheduleCounts, key) || seen[key]) continue;
        codes.push(key);
        seen[key] = true;
      }
      for (var amountKey in scheduleAmounts) {
        if (!Object.prototype.hasOwnProperty.call(scheduleAmounts, amountKey) || seen[amountKey]) continue;
        codes.push(amountKey);
        seen[amountKey] = true;
      }

      [['schedule-counts', scheduleCounts, formatters.number, 'count'], ['schedule-amounts', scheduleAmounts, formatters.currency, 'value']].forEach(function (config) {
        var table = root.querySelector('table.statistics-table[data-table="' + config[0] + '"]');
        if (!table) return;
        var tbody = table.querySelector('tbody') || document.createElement('tbody');
        if (!table.querySelector('tbody')) table.appendChild(tbody);
        clearElement(tbody);
        if (!codes.length) {
          appendEmptyRow(tbody, 2, '표시할 데이터 없음');
          return;
        }
        for (var j = 0; j < codes.length; j++) {
          var statusCode = codes[j];
          var tr = document.createElement('tr');
          appendTextCell(tr, getStatusLabel(statusCode), 'label');
          appendTextCell(tr, config[2](config[1][statusCode] || 0), config[3]);
          tbody.appendChild(tr);
        }
      });
    }

    function render(root, input) {
      var ctx = input && input.statistics ? input.statistics : {};
      if (!root || !ctx) return;
      syncSectionCopy(root, ctx);
      var formatters = getFormatters(input || {});
      renderSummary(root, ctx.summary || {}, formatters);
      renderPortfolioTable(root, ctx.portfolio || [], formatters);
      renderKeyValueTable(root, 'loan-structure', ctx.loanStructure || {}, function (label, value) {
        return label.indexOf('건수') !== -1 ? formatters.number(value || 0) : formatters.currency(value || 0);
      });
      renderKeyValueTable(root, 'claim-structure', ctx.claimStructure || {}, function (label, value) {
        return label.indexOf('건수') !== -1 ? formatters.number(value || 0) : formatters.currency(value || 0);
      });
      renderScheduleTables(root, ctx.scheduleCounts || {}, ctx.scheduleAmounts || {}, formatters);
      renderKeyValueTable(root, 'debtors', ctx.debtors || {}, function (label, value) {
        return formatters.number(value || 0);
      });
    }

    return {
      buildContext: buildContext,
      render: render
    };
  })();

})(window, document);
