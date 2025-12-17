(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  App.features = App.features || {};

  App.features.statisticsEngine = (function () {

    function buildContext(agg) {
      agg = agg || {};
      var totals = agg.totals || {};
      var counts = agg.counts || {};
      var statusBuckets = agg.statusBuckets || {};

      var schedules = [];

      if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
        try {
          schedules = App.schedulesEngine.getAll() || [];
        } catch (e) {
          schedules = [];
        }
      }

      var overdue = computeOverdueMetrics(schedules);

      // 1) Summary snapshot
      var summary = {
        debttotal: Number(totals.debtTotal) || 0,
        debtpaid: Number(totals.allCollectedTotal) || 0,
        debtplanned: Number(totals.allOutstandingTotal) || 0,
        debtoverdue: overdue.overdueOutstandingTotal || 0
      };

      // 2) Portfolio (Loan / Claim)
      var loanTotalRepay = Number(totals.loanTotalRepay) || 0;
      var loanOutstanding = Number(totals.loanOutstanding) || 0;
      var loanPaid = loanTotalRepay - loanOutstanding;
      if (!isFinite(loanPaid)) loanPaid = 0;

      var claimAmount = Number(totals.claimAmount) || 0;
      var claimCollectedTotal = Number(totals.claimCollectedTotal) || 0;
      var claimOutstanding = Number(totals.claimOutstanding) || 0;

      // Fallback: if claimOutstanding is not provided, derive from amount - collected
      if (!claimOutstanding && claimAmount && claimCollectedTotal != null) {
        claimOutstanding = Math.max(0, claimAmount - claimCollectedTotal);
      }

      var loanPlanned = loanOutstanding;
      var claimPlanned = claimOutstanding;
      var debtPlanned = loanPlanned + claimPlanned;
      summary.debtplanned = debtPlanned;

      var portfolio = [
        {
          type: 'Loan',
          count: counts.totalLoans || 0,
          total: loanTotalRepay,
          paid: loanPaid,
          planned: loanPlanned,
          overdue: overdue.overdueLoanAmount || 0
        },
        {
          type: 'Claim',
          count: counts.totalClaims || 0,
          total: claimAmount,
          paid: claimCollectedTotal,
          planned: claimPlanned,
          overdue: overdue.overdueClaimAmount || 0
        }
      ];

      // 3) Loan Structure
      var loanStructure = {
        '대출원리금합계': loanTotalRepay,
        '대출상환금합계': loanPaid,
        '대출상환예정금합계': loanPlanned,
        '대출미납금합계': overdue.overdueLoanAmount || 0,
        '대출건수': counts.totalLoans || 0,
        '미납대출건수': overdue.overdueLoanCount || 0
      };

      // 4) Claim Structure
      var claimStructure = {
        '채권금합계': claimAmount,
        '회수금합계': claimCollectedTotal,
        '회수예정금합계': claimPlanned,
        '채권건수': counts.totalClaims || 0,
        '진행중채권건수': counts.activeClaims || 0
      };

      // 5) Schedule state summary
      var scheduleCounts = {};
      var scheduleAmounts = {};

      if (statusBuckets) {
        for (var key in statusBuckets) {
          if (!Object.prototype.hasOwnProperty.call(statusBuckets, key)) continue;
          var bucket = statusBuckets[key] || {};
          scheduleCounts[key] = Number(bucket.count) || 0;
          scheduleAmounts[key] = Number(bucket.amount) || 0;
        }
      }

      var debtors = {
        total: counts.totalDebtors || 0,
        active: counts.activeDebtors || 0
      };

      return {
        summary: summary,
        portfolio: portfolio,
        loanStructure: loanStructure,
        claimStructure: claimStructure,
        scheduleCounts: scheduleCounts,
        scheduleAmounts: scheduleAmounts,
        debtors: debtors
      };
    }

    function computeOverdueMetrics(schedules) {
      var metrics = {
        overdueOutstandingTotal: 0,
        overdueLoanAmount: 0,
        overdueClaimAmount: 0,
        overdueLoanCount: 0,
        overdueClaimCount: 0
      };

      if (!schedules || !schedules.length) {
        return metrics;
      }

      var seenLoanIds = Object.create(null);
      var seenClaimIds = Object.create(null);

      for (var i = 0; i < schedules.length; i++) {
        var sc = schedules[i];
        if (!sc) continue;

        var amount = Number(sc.amount) || 0;
        var status = (sc.status || '').toUpperCase();
        var partialPaid = Number(sc.partialPaidAmount) || 0;

        var paidAmt = 0;
        if (status === 'PAID') {
          paidAmt = amount;
        } else if (status === 'PARTIAL') {
          paidAmt = partialPaid;
        }

        var remaining = amount - paidAmt;
        if (!isFinite(remaining) || remaining < 0) {
          remaining = 0;
        }

        if (status !== 'OVERDUE' || !remaining) continue;

        metrics.overdueOutstandingTotal += remaining;

        var kind = sc.kind || '';
        if (kind === 'loan') {
          metrics.overdueLoanAmount += remaining;
          var loanId = sc.loanId;
          if (loanId != null) {
            var loanKey = String(loanId);
            if (!seenLoanIds[loanKey]) {
              seenLoanIds[loanKey] = true;
              metrics.overdueLoanCount += 1;
            }
          }
        } else if (kind === 'claim') {
          metrics.overdueClaimAmount += remaining;
          var claimId = sc.claimId;
          if (claimId != null) {
            var claimKey = String(claimId);
            if (!seenClaimIds[claimKey]) {
              seenClaimIds[claimKey] = true;
              metrics.overdueClaimCount += 1;
            }
          }
        }
      }

      return metrics;
    }

    function clearElement(el) {
      if (!el) return;
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    }

    function formatNumber(value) {
      var util = App.util || {};
      if (util.formatNumber) {
        return util.formatNumber(value);
      }
      var n = Number(value) || 0;
      return String(n);
    }

    function formatCurrency(value) {
      var util = App.util || {};
      var n = Number(value) || 0;
      if (!util.formatCurrency) {
        return String(n);
      }
      return util.formatCurrency(n);
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

    function renderSummary(root, summary) {
      var cards = root.querySelectorAll('.statistics-kpi-card[data-kpi]');
      if (!cards || !cards.length) return;

      var LABEL_MAP = {
        debttotal: '채무금합계',
        debtpaid: '채무상환금합계',
        debtplanned: '채무상환예정금합계',
        debtoverdue: '미납금합계'
      };

      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var key = card.getAttribute('data-kpi');
        if (!key) continue;

        clearElement(card);

        var label = LABEL_MAP[key] || key;
        var rawValue = summary && Object.prototype.hasOwnProperty.call(summary, key)
          ? summary[key]
          : 0;

        var labelEl = document.createElement('div');
        labelEl.className = 'statistics-kpi-label';
        labelEl.textContent = label;

        var valueEl = document.createElement('div');
        valueEl.className = 'statistics-kpi-value';
        valueEl.textContent = formatCurrency(rawValue);

        card.appendChild(labelEl);
        card.appendChild(valueEl);
      }
    }

    function renderPortfolioTable(root, portfolio) {
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
        var row = portfolio[i];
        var tr = document.createElement('tr');

        var tdType = document.createElement('td');
        tdType.textContent = mapTypeLabel(row.type);
        tr.appendChild(tdType);

        var tdCount = document.createElement('td');
        tdCount.textContent = formatNumber(row.count || 0);
        tr.appendChild(tdCount);

        var tdTotal = document.createElement('td');
        tdTotal.textContent = formatCurrency(row.total || 0);
        tr.appendChild(tdTotal);

        var tdPaid = document.createElement('td');
        tdPaid.textContent = formatCurrency(row.paid || 0);
        tr.appendChild(tdPaid);

        var tdPlanned = document.createElement('td');
        tdPlanned.textContent = formatCurrency(row.planned || 0);
        tr.appendChild(tdPlanned);

        var tdOverdue = document.createElement('td');
        tdOverdue.textContent = formatCurrency(row.overdue || 0);
        tr.appendChild(tdOverdue);

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

      data = data || {};
      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) {
        var label = keys[i];
        var value = data[label];

        var tr = document.createElement('tr');

        var tdLabel = document.createElement('td');
        tdLabel.textContent = label;
        tr.appendChild(tdLabel);

        var tdValue = document.createElement('td');
        if (typeof valueFormatter === 'function') {
          tdValue.textContent = valueFormatter(label, value);
        } else {
          tdValue.textContent = String(value);
        }
        tr.appendChild(tdValue);

        tbody.appendChild(tr);
      }
    }

    function structureValueFormatter(label, value) {
      if (label.indexOf('건수') !== -1) {
        return formatNumber(value || 0);
      }
      return formatCurrency(value || 0);
    }

    function debtorValueFormatter(label, value) {
      if (label === '채무자 수' || label.indexOf('수') !== -1) {
        return formatNumber(value || 0);
      }
      return formatCurrency(value || 0);
    }

    function renderScheduleTables(root, scheduleCounts, scheduleAmounts) {
      scheduleCounts = scheduleCounts || {};
      scheduleAmounts = scheduleAmounts || {};

      var codes = [];
      var seen = Object.create(null);
      var order = ['PLANNED', 'PARTIAL', 'PAID', 'OVERDUE'];

      for (var i = 0; i < order.length; i++) {
        var code = order[i];
        if (scheduleCounts[code] != null || scheduleAmounts[code] != null) {
          codes.push(code);
          seen[code] = true;
        }
      }

      for (var key in scheduleCounts) {
        if (!Object.prototype.hasOwnProperty.call(scheduleCounts, key)) continue;
        if (!seen[key]) {
          codes.push(key);
          seen[key] = true;
        }
      }
      for (var key2 in scheduleAmounts) {
        if (!Object.prototype.hasOwnProperty.call(scheduleAmounts, key2)) continue;
        if (!seen[key2]) {
          codes.push(key2);
          seen[key2] = true;
        }
      }

      var countsTable = root.querySelector('table.statistics-table[data-table="schedule-counts"]');
      if (countsTable) {
        var countsBody = countsTable.querySelector('tbody') || document.createElement('tbody');
        if (!countsTable.querySelector('tbody')) {
          countsTable.appendChild(countsBody);
        }
        clearElement(countsBody);

        for (var j = 0; j < codes.length; j++) {
          var statusCode = codes[j];
          var countVal = scheduleCounts[statusCode] || 0;
          var trCount = document.createElement('tr');

          var tdStatusLabel = document.createElement('td');
          tdStatusLabel.textContent = getStatusLabel(statusCode);
          trCount.appendChild(tdStatusLabel);

          var tdCountVal = document.createElement('td');
          tdCountVal.textContent = formatNumber(countVal);
          trCount.appendChild(tdCountVal);

          countsBody.appendChild(trCount);
        }
      }

      var amountsTable = root.querySelector('table.statistics-table[data-table="schedule-amounts"]');
      if (amountsTable) {
        var amountsBody = amountsTable.querySelector('tbody') || document.createElement('tbody');
        if (!amountsTable.querySelector('tbody')) {
          amountsTable.appendChild(amountsBody);
        }
        clearElement(amountsBody);

        for (var k = 0; k < codes.length; k++) {
          var statusCode2 = codes[k];
          var amountVal = scheduleAmounts[statusCode2] || 0;
          var trAmt = document.createElement('tr');

          var tdStatusLabel2 = document.createElement('td');
          tdStatusLabel2.textContent = getStatusLabel(statusCode2);
          trAmt.appendChild(tdStatusLabel2);

          var tdAmountVal = document.createElement('td');
          tdAmountVal.textContent = formatCurrency(amountVal);
          trAmt.appendChild(tdAmountVal);

          amountsBody.appendChild(trAmt);
        }
      }
    }

    function render(root, ctx) {
      if (!root || !ctx) return;

      renderSummary(root, ctx.summary || {});
      renderPortfolioTable(root, ctx.portfolio || []);
      renderKeyValueTable(root, 'loan-structure', ctx.loanStructure || {}, structureValueFormatter);
      renderKeyValueTable(root, 'claim-structure', ctx.claimStructure || {}, structureValueFormatter);
      renderScheduleTables(root, ctx.scheduleCounts || {}, ctx.scheduleAmounts || {});
      renderKeyValueTable(root, 'debtors', ctx.debtors || {}, debtorValueFormatter);
    }

    return {
      buildContext: buildContext,
      render: render
    };
  })();

})(window, document);
