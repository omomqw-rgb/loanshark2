(function (window, document) {
  'use strict';
  var App = window.App || (window.App = {});
  App.reportRender = App.reportRender || {};

  function createTableCell(text, className) {
    var cell = document.createElement('td');
    if (className) cell.className = className;
    cell.textContent = text;
    return cell;
  }

  function createEmptyTableRow(colspan, text) {
    var row = document.createElement('tr');
    var cell = createTableCell(text);
    cell.colSpan = colspan;
    row.appendChild(cell);
    return row;
  }

  function getContext(input) {
    if (input && input.risk && input.format) {
      return input;
    }
    return {
      format: {
        currency: function (value) { return String(Number(value) || 0); },
        number: function (value) { return String(Number(value) || 0); },
        percent: function (value, digits) { return (Number(value) || 0).toFixed(typeof digits === 'number' ? digits : 1) + '%'; }
      },
      risk: {
        summary: { overdueAmount: 0, overdueRate: 0, maxOverdueDays: 0, highRiskCount: 0 },
        aging: { '0_7': { count: 0, amount: 0 }, '8_30': { count: 0, amount: 0 }, '31_90': { count: 0, amount: 0 }, '90p': { count: 0, amount: 0 } },
        concentration: { amount: 0, sharePct: 0 },
        topDebtors: [],
        empty: true
      }
    };
  }

  function renderTopDebtorTable(tbody, format, debtors) {
    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild);
    }

    if (!debtors.length) {
      tbody.appendChild(createEmptyTableRow(4, '고위험 채무자가 없습니다.'));
      return;
    }

    var currency = format && typeof format.currency === 'function'
      ? format.currency
      : function (value) { return String(Number(value) || 0); };
    var number = format && typeof format.number === 'function'
      ? format.number
      : function (value) { return String(Number(value) || 0); };

    debtors.forEach(function (debtor) {
      var tr = document.createElement('tr');

      var tdName = document.createElement('td');
      var nameEl = document.createElement('div');
      nameEl.textContent = debtor.name || debtor.debtorId || '--';
      tdName.appendChild(nameEl);

      var reasons = Array.isArray(debtor.reasons) ? debtor.reasons.slice() : [];
      var primaryReasons = reasons.slice(0, 2);
      var extraCount = Math.max(reasons.length - primaryReasons.length, 0);
      if (primaryReasons.length) {
        var reasonEl = document.createElement('div');
        reasonEl.className = 'risk-topdebtor-reasons';
        reasonEl.title = reasons.join(' · ');

        var reasonTextEl = document.createElement('span');
        reasonTextEl.textContent = primaryReasons.join(' · ');
        reasonEl.appendChild(reasonTextEl);

        if (extraCount > 0) {
          var moreEl = document.createElement('span');
          moreEl.className = 'risk-more-badge';
          moreEl.textContent = '+' + extraCount;
          reasonEl.appendChild(moreEl);
        }

        tdName.appendChild(reasonEl);
      }
      tdName.title = reasons.join(' · ') || '';

      var tdAmount = createTableCell(currency(debtor.operationalExposure || 0));
      var tdDays = createTableCell((debtor.maxOverdueDays || 0) > 0 ? ((debtor.maxOverdueDays || 0) + '일') : '--일');
      var tdCount = createTableCell(number(debtor.overdueCount || 0) + '건');

      tr.appendChild(tdName);
      tr.appendChild(tdAmount);
      tr.appendChild(tdDays);
      tr.appendChild(tdCount);
      tbody.appendChild(tr);
    });
  }

  function updateRiskSection(root, input) {
    var section = root ? root.querySelector('.report-section-risk') : null;
    if (!section) return;

    var context = getContext(input);
    var risk = context.risk || {};
    var summary = risk.summary || { overdueAmount: 0, overdueRate: 0, maxOverdueDays: 0, highRiskCount: 0 };
    var aging = risk.aging || {};
    var concentration = risk.concentration || { amount: 0, sharePct: 0 };
    var debtors = Array.isArray(risk.topDebtors) ? risk.topDebtors : [];
    var format = context.format || {};
    var currency = typeof format.currency === 'function' ? format.currency : function (value) { return String(Number(value) || 0); };
    var number = typeof format.number === 'function' ? format.number : function (value) { return String(Number(value) || 0); };
    var percent = typeof format.percent === 'function' ? format.percent : function (value, digits) { return (Number(value) || 0).toFixed(typeof digits === 'number' ? digits : 1) + '%'; };

    var kpiOverdue = section.querySelector('.risk-kpi-card[data-risk-kpi="overdue-amount"] .risk-kpi-value');
    var kpiRate = section.querySelector('.risk-kpi-card[data-risk-kpi="overdue-rate"] .risk-kpi-value');
    var kpiMaxDays = section.querySelector('.risk-kpi-card[data-risk-kpi="max-overdue-days"] .risk-kpi-value');
    var kpiHighCount = section.querySelector('.risk-kpi-card[data-risk-kpi="highrisk-count"] .risk-kpi-value');

    if (kpiOverdue) kpiOverdue.textContent = currency(summary.overdueAmount || 0);
    if (kpiRate) kpiRate.textContent = percent(summary.overdueRate || 0, 1);
    if (kpiMaxDays) kpiMaxDays.textContent = (summary.maxOverdueDays || 0) > 0 ? ((summary.maxOverdueDays || 0) + '일') : '--일';
    if (kpiHighCount) kpiHighCount.textContent = String(summary.highRiskCount || 0) + '명';

    var agingTable = section.querySelector('.risk-table-aging tbody');
    if (agingTable) {
      var rows = agingTable.querySelectorAll('tr[data-bucket]');
      rows.forEach(function (row) {
        var key = row.getAttribute('data-bucket');
        var bucket = aging && aging[key] ? aging[key] : { count: 0, amount: 0 };
        var cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          cells[1].textContent = number(bucket.count || 0) + '건';
          cells[2].textContent = currency(bucket.amount || 0);
        }
      });
    }

    var concBody = section.querySelector('.risk-table-concentration tbody');
    if (concBody && concBody.firstElementChild) {
      var tr = concBody.firstElementChild;
      var cells = tr.querySelectorAll('td');
      if (cells.length >= 3) {
        cells[1].textContent = currency(concentration.amount || 0);
        cells[2].textContent = percent(concentration.sharePct || 0, 1);
      }
    }

    var topTableBody = section.querySelector('.risk-table-topdebtors tbody');
    if (topTableBody) {
      renderTopDebtorTable(topTableBody, format, debtors);
    }
  }

  App.reportRender.risk = {
    render: updateRiskSection,
    updateRiskSection: updateRiskSection
  };
})(window, document);
