(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  App.modules = App.modules || {};
  var util = App.util || {};

  function extractNum(str) {
    var out = '';
    if (!str) return 0;
    for (var i = 0; i < str.length; i++) {
      var c = str[i];
      if (c >= '0' && c <= '9') out += c;
    }
    return Number(out) || 0;
  }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function appendChildren(parent, children) {
    for (var i = 0; i < children.length; i++) {
      if (children[i]) parent.appendChild(children[i]);
    }
    return parent;
  }

  function formatCurrency(value) {
    if (util && typeof util.formatCurrency === 'function') {
      return util.formatCurrency(value);
    }
    var num = Number(value) || 0;
    return String(num);
  }

  function formatISODate(dateStr) {
    if (!dateStr) return '-';
    try {
      return String(dateStr).slice(0, 10);
    } catch (e) {
      return '-';
    }
  }

    function getSchedulesForLoan(loan) {
    if (!loan) return [];

    if (App.schedulesEngine && typeof App.schedulesEngine.getByLoanId === 'function') {
      var list = [];
      try {
        list = App.schedulesEngine.getByLoanId(loan.id) || [];
      } catch (e) {
        list = [];
      }
      list = list.slice();
      list.sort(function (a, b) {
        var ai = a.installmentNo || a.installment_no || 0;
        var bi = b.installmentNo || b.installment_no || 0;
        return ai - bi;
      });
      return list;
    }

    return [];
  }

    function getSchedulesForClaim(claim) {
    if (!claim) return [];

    if (App.schedulesEngine && typeof App.schedulesEngine.getByClaimId === 'function') {
      var list = [];
      try {
        list = App.schedulesEngine.getByClaimId(claim.id) || [];
      } catch (e) {
        list = [];
      }
      list = list.slice();
      list.sort(function (a, b) {
        var ai = a.installmentNo || a.installment_no || 0;
        var bi = b.installmentNo || b.installment_no || 0;
        return ai - bi;
      });
      return list;
    }

    return [];
  }

    function computeClaimSummary(claim) {
    var schedules = [];

    if (App.schedulesEngine && typeof App.schedulesEngine.getByClaimId === 'function') {
      try {
        schedules = App.schedulesEngine.getByClaimId(claim.id) || [];
      } catch (e) {
        schedules = [];
      }
    }

    var paid = 0;
    for (var i = 0; i < schedules.length; i++) {
      var s = schedules[i];
      if (s.status === 'PAID' || s.status === 'PARTIAL') {
        paid += Number(s.amount) || 0;
      }
    }
    var total = Number(claim.amount) || 0;
    var remaining = total - paid;
    if (!isFinite(remaining) || remaining < 0) remaining = 0;
    return {
      paid: paid,
      remaining: remaining
    };
  }


  function computeDebtorSummary(debtorLoans, debtorClaims) {
    debtorLoans = debtorLoans || [];
    debtorClaims = debtorClaims || [];

    var todayStr = null;
    try {
      if (App.util && typeof App.util.formatDate === 'function') {
        todayStr = App.util.formatDate(new Date());
      } else if (typeof Date === 'function') {
        todayStr = new Date().toISOString().slice(0, 10);
      }
    } catch (e) {
      todayStr = null;
    }

    var loanPaid = 0;
    var loanPlanned = 0;
    var loanOverdue = 0;

    for (var i = 0; i < debtorLoans.length; i++) {
      var loan = debtorLoans[i];
      if (!loan) continue;

      var schedules = getSchedulesForLoan(loan) || [];
      for (var j = 0; j < schedules.length; j++) {
        var sc = schedules[j];
        if (!sc) continue;

        var amount = Number(sc.amount) || 0;
        if (!amount) continue;

        var paidAmt = 0;
        if (sc.paidAmount != null) {
          paidAmt = Number(sc.paidAmount) || 0;
        } else if (sc.partialPaidAmount != null) {
          paidAmt = Number(sc.partialPaidAmount) || 0;
        }
        if (paidAmt < 0) paidAmt = 0;
        if (paidAmt > amount) paidAmt = amount;

        var status = (sc.status || '').toUpperCase();

        // LoanPaid: status 가 PAID 또는 PARTIAL 인 회차의 이미 납부된 금액 합계
        if (status === 'PAID' || status === 'PARTIAL') {
          if (!paidAmt) {
            paidAmt = amount;
          }
          loanPaid += paidAmt;
        }

        // 남은 금액 기준으로 예정/연체 구분
        var remaining = amount - paidAmt;
        if (!remaining || remaining <= 0) continue;

        var due = sc.dueDate || sc.due_date || sc.date || null;
        var dueStr = due ? String(due).slice(0, 10) : null;

        if (todayStr && dueStr) {
          if (dueStr < todayStr) {
            loanOverdue += remaining;
          } else {
            loanPlanned += remaining;
          }
        } else {
          // 날짜 비교 기준이 없으면 일단 예정금으로 처리
          loanPlanned += remaining;
        }
      }
    }

    var claimTotal = 0;
    var claimPaid = 0;

    for (var k = 0; k < debtorClaims.length; k++) {
      var claim = debtorClaims[k];
      if (!claim) continue;

      claimTotal += Number(claim.amount) || 0;

      var claimSchedules = getSchedulesForClaim(claim) || [];
      for (var m = 0; m < claimSchedules.length; m++) {
        var sc2 = claimSchedules[m];
        if (!sc2) continue;

        var status2 = (sc2.status || '').toUpperCase();
        if (status2 !== 'PAID') continue;

        var amt = Number(sc2.amount) || 0;
        if (!amt) continue;

        claimPaid += amt;
      }
    }

    var claimPlanned = claimTotal - claimPaid;
    if (!isFinite(claimPlanned) || claimPlanned < 0) {
      claimPlanned = 0;
    }

    var loanTotal = loanPaid + loanPlanned + loanOverdue;
    var debtTotal = loanTotal + claimTotal;
    var debtPaid = loanPaid + claimPaid;
    var debtPlanned = loanPlanned + claimPlanned;
    var debtOverdue = loanOverdue;

    return {
      debtTotal: debtTotal || 0,
      debtPaid: debtPaid || 0,
      debtPlanned: debtPlanned || 0,
      debtOverdue: debtOverdue || 0
    };
  }

  function buildContext(debtorId) {
    var st = App.state || {};
    var debtors = st.debtors || [];
    var loans = st.loans || [];
    var claims = st.claims || [];

    var debtor = null;
    for (var i = 0; i < debtors.length; i++) {
      if (String(debtors[i].id) === String(debtorId)) {
        debtor = debtors[i];
        break;
      }
    }
    if (!debtor) return null;

    var debtorLoans = [];
    var debtorClaims = [];
    for (var j = 0; j < loans.length; j++) {
      if (loans[j].debtorId === debtor.id) debtorLoans.push(loans[j]);
    }
    for (var k = 0; k < claims.length; k++) {
      if (claims[k].debtorId === debtor.id) debtorClaims.push(claims[k]);
    }

    debtorLoans.sort(function (a, b) {
      return extractNum(b.id) - extractNum(a.id);
    });
    debtorClaims.sort(function (a, b) {
      return extractNum(b.id) - extractNum(a.id);
    });


    var summary = computeDebtorSummary(debtorLoans, debtorClaims);

    return {
      debtor: debtor,
      loans: debtorLoans,
      claims: debtorClaims,
      summary: summary
    };
  }

  
  function createTopbar(ctx) {
    var container = el('div', 'debtor-topbar');

    var row1 = el('div', 'topbar-row1');
    var back = el('button', 'btn-text', '← 목록');
    back.type = 'button';
    back.setAttribute('data-action', 'debtor-list-mode');
    row1.appendChild(back);

    container.appendChild(row1);
    return container;
  }


  function createMainRow(ctx) {
    var debtor = ctx.debtor;
    var root = el('div', 'ddh-header');
    var left = el('div', 'ddh-left');
    var center = el('div', 'ddh-center');
    var right = el('div', 'ddh-right');

    var backBtn = el('button', 'btn-text', '← Back');
    backBtn.type = 'button';
    backBtn.style.color = '#000';
    backBtn.setAttribute('data-action', 'debtor-list-mode');
    left.appendChild(backBtn);

    var nameSpan = el('span', 'ddh-name', debtor && debtor.name ? debtor.name : '-');
    center.appendChild(nameSpan);

    var editBtn = el('button', 'ddh-btn ddh-edit', '수정');
    editBtn.type = 'button';
    editBtn.setAttribute('data-action', 'debtor-open-edit');

    var delBtn = el('button', 'ddh-btn ddh-delete', '삭제');
    delBtn.type = 'button';
    delBtn.setAttribute('data-action', 'debtor-delete');

    right.appendChild(editBtn);
    right.appendChild(delBtn);

    root.appendChild(left);
    root.appendChild(center);
    root.appendChild(right);
    return root;
  }



  function createStatusSelect(kind, id, cardStatus) {
    var select = el('select', 'card-status-select-inline');
    select.setAttribute('data-action', 'card-status-change');
    select.setAttribute('data-kind', kind);
    select.setAttribute('data-id', id);
    if (kind === 'loan') {
      select.setAttribute('data-loan-id', id);
    } else {
      select.setAttribute('data-claim-id', id);
    }

    var statuses = ['진행', '완료', '꺾기'];
    for (var i = 0; i < statuses.length; i++) {
      var opt = document.createElement('option');
      opt.value = statuses[i];
      opt.textContent = statuses[i];
      if (statuses[i] === cardStatus) opt.selected = true;
      select.appendChild(opt);
    }
    return select;
  }

  function createAmountRow(label, value) {
    var row = el('div', 'amount-row');
    var lbl = el('span', 'amount-label', label);
    var val = el('span', 'amount-value', value);
    row.appendChild(lbl);
    row.appendChild(val);
    return row;
  }

  
  function createLoanCard(loan, debtor) {
    var principal = formatCurrency(loan.principal);
    var total = formatCurrency(loan.totalRepayAmount);
    var paid = formatCurrency(loan.paidAmount || 0);
    var remain = formatCurrency(loan.remainingAmount || 0);

    var cardStatus = loan.cardStatus || '진행';
    var cardClass = 'loan-card card-status-' + cardStatus;

    var schedules = getSchedulesForLoan(loan);
    var first = schedules.length > 0 ? schedules[0] : null;
    var last = schedules.length > 0 ? schedules[schedules.length - 1] : null;
    var totalCount = schedules.length;
    var startSource = first ? (first.dueDate || first.due_date || first.date) : null;
    var endSource = last ? (last.dueDate || last.due_date || last.date) : null;
    var startDate = startSource ? formatISODate(startSource) : '-';
    var endDate = endSource ? formatISODate(endSource) : '-';

    var installmentInfo;
    if (totalCount > 0) {
      installmentInfo = totalCount + '회차';
    } else {
      installmentInfo = '-';
    }

    var riskTier = (debtor && debtor.riskTier) ? debtor.riskTier : 'B';

    var article = el('article', cardClass);

    // 4x4 grid: 대출원금/대출원리금/상환금/상환예정금 + RiskTier/회차정보/StartDate/EndDate
    var grid = el('div', 'card-grid-4x4');
    grid.appendChild(el('div', 'card-grid-label', '대출원금'));
    grid.appendChild(el('div', 'card-grid-value', principal));
    grid.appendChild(el('div', 'card-grid-label', 'RiskTier'));
    grid.appendChild(el('div', 'card-grid-value', riskTier));

    grid.appendChild(el('div', 'card-grid-label', '대출원리금'));
    grid.appendChild(el('div', 'card-grid-value', total));
    grid.appendChild(el('div', 'card-grid-label', '회차정보'));
    grid.appendChild(el('div', 'card-grid-value', installmentInfo));

    grid.appendChild(el('div', 'card-grid-label', '상환금'));
    grid.appendChild(el('div', 'card-grid-value', paid));
    grid.appendChild(el('div', 'card-grid-label', 'StartDate'));
    grid.appendChild(el('div', 'card-grid-value', startDate));

    grid.appendChild(el('div', 'card-grid-label', '상환예정금'));
    grid.appendChild(el('div', 'card-grid-value', remain));
    grid.appendChild(el('div', 'card-grid-label', 'EndDate'));
    grid.appendChild(el('div', 'card-grid-value', endDate));

    article.appendChild(grid);

    var actions = el('div', 'card-actions');
    var left = el('div', 'card-actions-left');

    var editBtn = el('button', 'btn-plain', '수정');
    editBtn.type = 'button';
    editBtn.setAttribute('data-loan-id', String(loan.id));
    editBtn.setAttribute('data-action', 'loan-open-edit');
    left.appendChild(editBtn);

    var delBtn = el('button', 'btn-plain', '삭제');
    delBtn.type = 'button';
    delBtn.setAttribute('data-loan-id', String(loan.id));
    delBtn.setAttribute('data-action', 'loan-delete');
    left.appendChild(delBtn);

    var statusSelect = createStatusSelect('loan', String(loan.id), cardStatus);
    

    var right = el('div', 'card-actions-right');
    var schedBtn = el('button', 'schedule-btn', '스케쥴');
    schedBtn.type = 'button';
    schedBtn.setAttribute('data-loan-id', String(loan.id));
    schedBtn.setAttribute('data-action', 'loan-open-schedule');
    right.appendChild(statusSelect);
    right.appendChild(schedBtn);

    actions.appendChild(left);
    actions.appendChild(right);
    article.appendChild(actions);

    return article;
  }


  
  function createClaimCard(claim, debtor) {
    var total = Number(claim.amount) || 0;
    var summary = computeClaimSummary(claim);
    var totalLabel = formatCurrency(total);
    var paidLabel = formatCurrency(summary.paid);
    var remainLabel = formatCurrency(summary.remaining);

    var cardStatus = claim.cardStatus || '진행';
    var cardClass = 'claim-card card-status-' + cardStatus;

    var schedules = getSchedulesForClaim(claim);
    var first = schedules.length > 0 ? schedules[0] : null;
    var last = schedules.length > 0 ? schedules[schedules.length - 1] : null;
    var totalCount = schedules.length;
    var startSource = first ? (first.dueDate || first.due_date || first.date) : null;
    var endSource = last ? (last.dueDate || last.due_date || last.date) : null;
    var startDate = startSource ? formatISODate(startSource) : '-';
    var endDate = endSource ? formatISODate(endSource) : '-';

    var installmentInfo;
    if (totalCount > 0) {
      installmentInfo = totalCount + '회차';
    } else {
      installmentInfo = '-';
    }

    var riskTier = (debtor && debtor.riskTier) ? debtor.riskTier : 'B';

    var article = el('article', cardClass);

    // 4x4 grid: 채권금/회수금/회수예정금 + RiskTier/회차정보/StartDate/EndDate
    var grid = el('div', 'card-grid-4x4');

    // 1행: 채권금 / RiskTier
    grid.appendChild(el('div', 'card-grid-label', '채권금'));
    grid.appendChild(el('div', 'card-grid-value', totalLabel));
    grid.appendChild(el('div', 'card-grid-label', 'RiskTier'));
    grid.appendChild(el('div', 'card-grid-value', riskTier));

    // 2행: (비워둠) / 회차정보
    grid.appendChild(el('div', 'card-grid-label', ''));
    grid.appendChild(el('div', 'card-grid-value', ''));
    grid.appendChild(el('div', 'card-grid-label', '회차정보'));
    grid.appendChild(el('div', 'card-grid-value', installmentInfo));

    // 3행: 회수금 / StartDate
    grid.appendChild(el('div', 'card-grid-label', '회수금'));
    grid.appendChild(el('div', 'card-grid-value', paidLabel));
    grid.appendChild(el('div', 'card-grid-label', 'StartDate'));
    grid.appendChild(el('div', 'card-grid-value', startDate));

    // 4행: 회수예정금 / EndDate
    grid.appendChild(el('div', 'card-grid-label', '회수예정금'));
    grid.appendChild(el('div', 'card-grid-value', remainLabel));
    grid.appendChild(el('div', 'card-grid-label', 'EndDate'));
    grid.appendChild(el('div', 'card-grid-value', endDate));

    article.appendChild(grid);

    var actions = el('div', 'card-actions');
    var left = el('div', 'card-actions-left');

    var editBtn = el('button', 'btn-plain', '수정');
    editBtn.type = 'button';
    editBtn.setAttribute('data-claim-id', String(claim.id));
    editBtn.setAttribute('data-action', 'claim-open-edit');
    left.appendChild(editBtn);

    var delBtn = el('button', 'btn-plain', '삭제');
    delBtn.type = 'button';
    delBtn.setAttribute('data-claim-id', String(claim.id));
    delBtn.setAttribute('data-action', 'claim-delete');
    left.appendChild(delBtn);

    var statusSelect = createStatusSelect('claim', String(claim.id), cardStatus);
    

    var right = el('div', 'card-actions-right');
    var schedBtn = el('button', 'schedule-btn', '스케쥴');
    schedBtn.type = 'button';
    schedBtn.setAttribute('data-claim-id', String(claim.id));
    schedBtn.setAttribute('data-action', 'claim-open-schedule');
    right.appendChild(statusSelect);
    right.appendChild(schedBtn);

    actions.appendChild(left);
    actions.appendChild(right);
    article.appendChild(actions);

    return article;
  }


  function createLoanSection(ctx) {
    var loans = ctx.loans || [];
    var loansCollapsed = !!App.state.loansCollapsed;

    var section = el('div', 'form-section loan-section' + (loansCollapsed ? ' collapsed' : ''));
    var header = el('div', 'form-section-header');

    var title = el('div', 'form-section-title', '대출 카드');

    var actions = el('div', 'form-section-actions');
    var addLoan = el('button', 'btn-inline', '+대출카드');
    addLoan.type = 'button';
    addLoan.addEventListener('click', function (e) {
      if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
      }
      var debtor = ctx && ctx.debtor ? ctx.debtor : null;
      var debtorId = debtor && debtor.id ? debtor.id : null;
      if (!debtorId) return;
      if (window.App && App.features && App.features.debtors &&
          typeof App.features.debtors.openLoanModal === 'function') {
        App.features.debtors.openLoanModal('create', { debtorId: debtorId });
      }
    });
    actions.appendChild(addLoan);

    var toggleBtn = el('button', 'section-toggle-btn', '▲');
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('data-action', 'toggle-section');
    toggleBtn.setAttribute('data-target', 'loans');

    actions.appendChild(toggleBtn);

    header.appendChild(title);
    header.appendChild(actions);

    var body = el('div', 'form-section-body' + (loansCollapsed ? ' collapsed' : ''));
    var list = el('div', 'loan-list');

    if (!loans.length) {
      var empty = el('p', 'empty-text', '등록된 대출 카드가 없습니다.');
      list.appendChild(empty);
    } else {
      for (var i = 0; i < loans.length; i++) {
        list.appendChild(createLoanCard(loans[i], ctx.debtor));
      }
    }

    body.appendChild(list);
    section.appendChild(header);
    section.appendChild(body);
    return section;
  }

  function createClaimSection(ctx) {
    var claims = ctx.claims || [];
    var claimsCollapsed = !!App.state.claimsCollapsed;

    var section = el('div', 'form-section claim-section' + (claimsCollapsed ? ' collapsed' : ''));
    var header = el('div', 'form-section-header');

    var title = el('div', 'form-section-title', '채권 카드');

    var actions = el('div', 'form-section-actions');
    var addClaim = el('button', 'btn-inline', '+채권카드');
    addClaim.type = 'button';
    addClaim.addEventListener('click', function (e) {
      if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
      }
      var debtor = ctx && ctx.debtor ? ctx.debtor : null;
      var debtorId = debtor && debtor.id ? debtor.id : null;
      if (!debtorId) return;
      if (window.App && App.features && App.features.debtors &&
          typeof App.features.debtors.openClaimModal === 'function') {
        App.features.debtors.openClaimModal('create', { debtorId: debtorId });
      }
    });
    actions.appendChild(addClaim);

    var toggleBtn = el('button', 'section-toggle-btn', '▲');
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('data-action', 'toggle-section');
    toggleBtn.setAttribute('data-target', 'claims');

    actions.appendChild(toggleBtn);

    header.appendChild(title);
    header.appendChild(actions);

    var body = el('div', 'form-section-body' + (claimsCollapsed ? ' collapsed' : ''));
    var list = el('div', 'claim-list');

    if (!claims.length) {
      var empty = el('p', 'empty-text', '등록된 채권 카드가 없습니다.');
      list.appendChild(empty);
    } else {
      for (var i = 0; i < claims.length; i++) {
        list.appendChild(createClaimCard(claims[i], ctx.debtor));
      }
    }

    body.appendChild(list);
    section.appendChild(header);
    section.appendChild(body);
    return section;
  }

  
  
  
  function render(debtorId) {
    var root = document.getElementById('debtor-detail-root');
    if (!root) return;

    while (root.firstChild) {
      root.removeChild(root.firstChild);
    }

    var ctx = buildContext(debtorId);
    if (!ctx) return;

    // 1) Topbar
    if (typeof createTopbar === 'function') {
    }

    // 2) Header (우리가 만든 ddh-header)
    if (typeof createMainRow === 'function') {
      root.appendChild(createMainRow(ctx));
    }

    // 3) Info (기존 스타일)
    if (typeof DDInfo !== 'undefined' && DDInfo && typeof DDInfo.create === 'function') {
      root.appendChild(DDInfo.create(ctx));
    }

    // 4) Summary 2.0 (KPI)
    if (window.DDKpi && typeof window.DDKpi.create === 'function') {
      root.appendChild(window.DDKpi.create(ctx));
    }

    // 5) Loan section (기존 스타일)
    if (typeof createLoanSection === 'function') {
      root.appendChild(createLoanSection(ctx));
    }

    // 6) Claim section (기존 스타일)
    if (typeof createClaimSection === 'function') {
      root.appendChild(createClaimSection(ctx));
    }
  }


App.modules.DebtorDetail = {
    render: render
  };
})(window, document);