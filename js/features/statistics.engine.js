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
      return '주간 해석은 ' + (resolved.label || '월요일 시작 주간 기준') + '을 따릅니다.';
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
        periodDescription: buildWeekSemanticsNote(weekSemantics),
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
      if (!portfolio || !portfolio.length) return;
      function mapTypeLabel(type) {
        if (type === 'Loan') return '대출';
        if (type === 'Claim') return '채권';
        return type || '';
      }
      for (var i = 0; i < portfolio.length; i++) {
        var row = portfolio[i] || {};
        var tr = document.createElement('tr');
        [
          mapTypeLabel(row.type),
          formatters.number(row.count || 0),
          formatters.currency(row.total || 0),
          formatters.currency(row.paid || 0),
          formatters.currency(row.planned || 0),
          formatters.currency(row.overdue || 0)
        ].forEach(function (text) {
          var td = document.createElement('td');
          td.textContent = text;
          tr.appendChild(td);
        });
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
      for (var i = 0; i < keys.length; i++) {
        var label = keys[i];
        var value = data[label];
        var tr = document.createElement('tr');
        var tdLabel = document.createElement('td');
        tdLabel.textContent = label;
        var tdValue = document.createElement('td');
        tdValue.textContent = typeof valueFormatter === 'function' ? valueFormatter(label, value) : String(value);
        tr.appendChild(tdLabel);
        tr.appendChild(tdValue);
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

      [['schedule-counts', scheduleCounts, formatters.number], ['schedule-amounts', scheduleAmounts, formatters.currency]].forEach(function (config) {
        var table = root.querySelector('table.statistics-table[data-table="' + config[0] + '"]');
        if (!table) return;
        var tbody = table.querySelector('tbody') || document.createElement('tbody');
        if (!table.querySelector('tbody')) table.appendChild(tbody);
        clearElement(tbody);
        for (var j = 0; j < codes.length; j++) {
          var statusCode = codes[j];
          var tr = document.createElement('tr');
          var tdStatus = document.createElement('td');
          tdStatus.textContent = getStatusLabel(statusCode);
          var tdValue = document.createElement('td');
          tdValue.textContent = config[2](config[1][statusCode] || 0);
          tr.appendChild(tdStatus);
          tr.appendChild(tdValue);
          tbody.appendChild(tr);
        }
      });
    }

    function syncWeekSemanticsHeader(root, input) {
      if (!root) return;
      var ctx = input && input.statistics ? input.statistics : {};
      var weekSemantics = (ctx && ctx.weekSemantics) || (input && input.meta ? input.meta.weekSemantics : null);
      var note = buildWeekSemanticsNote(weekSemantics);
      var header = root.querySelector('.statistics-section-snapshot .statistics-header');
      if (!header) return;
      var desc = header.querySelector('.report-section-desc[data-role="statistics-week-note"]');
      if (!desc) {
        desc = document.createElement('p');
        desc.className = 'report-section-desc';
        desc.setAttribute('data-role', 'statistics-week-note');
        header.appendChild(desc);
      }
      desc.textContent = note;
    }

    function render(root, input) {
      var ctx = input && input.statistics ? input.statistics : {};
      if (!root || !ctx) return;
      syncWeekSemanticsHeader(root, input || {});
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
