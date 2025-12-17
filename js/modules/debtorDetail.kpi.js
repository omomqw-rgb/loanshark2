const DDKpi = {
  create(ctx) {
    const root = document.createElement('div');
    root.className = 'dd-summary-section';
    root.setAttribute('data-dd-section', 'kpi');

    const summary = (ctx && ctx.summary) || {};
    const app = window.App || {};
    const util = app.util || {};
    const fmt = typeof util.formatCurrency === 'function'
      ? util.formatCurrency
      : function (v) {
          var n = Number(v);
          if (!isFinite(n)) n = 0;
          return String(n);
        };

    const debtTotal = summary.debtTotal != null ? summary.debtTotal : 0;
    const debtPaid = summary.debtPaid != null ? summary.debtPaid : 0;
    const debtPlanned = summary.debtPlanned != null ? summary.debtPlanned : 0;
    const debtOverdue = summary.debtOverdue != null ? summary.debtOverdue : 0;

    const rows = [
      ['채무금', fmt(debtTotal)],
      ['상환금', fmt(debtPaid)],
      ['상환예정금', fmt(debtPlanned)],
      ['미납금', fmt(debtOverdue)]
    ];

    rows.forEach(function (entry) {
      const row = document.createElement('div');
      row.className = 'dd-summary-row';

      const lab = document.createElement('div');
      lab.className = 'dd-summary-label';
      lab.textContent = entry[0];

      const val = document.createElement('div');
      val.className = 'dd-summary-value';
      val.textContent = entry[1];

      row.appendChild(lab);
      row.appendChild(val);
      root.appendChild(row);
    });

    return root;
  }
};

window.DDKpi = DDKpi;
