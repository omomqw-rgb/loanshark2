(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});

  // ============================================================
  // Mobile Mode
  // - Desktop DOM/UI must remain untouched in Desktop mode
  // - Desktop Shell and Mobile Shell MUST NOT coexist (no CSS hiding)
  // - Mobile Shell is built via DOM APIs (no large innerHTML assembly)
  // - Mode switch closes all open modals and resets Mobile tab
  // ============================================================

  var DESKTOP = 'desktop';
  var MOBILE = 'mobile';

  var phase1Cfg = (App.runtime && App.runtime.mobilePhase1) ? App.runtime.mobilePhase1 : {
    enterMaxWidth: 768,
    exitMinWidth: 1024,
    resizeDebounceMs: 250,
    switchCooldownMs: 800
  };

  function ensureMobileUIState() {
    App.runtime = App.runtime || {};
    if (!App.runtime.mobileUIState) {
      App.runtime.mobileUIState = {};
    }
    return App.runtime.mobileUIState;
  }

  // Stable mobile-mode predicate (single source of truth for guard/facade)
  try {
    App.ui = App.ui || {};
    if (typeof App.ui.isMobileMode !== 'function') {
      App.ui.isMobileMode = function () {
        return !!(App.runtime && App.runtime.mode === MOBILE);
      };
    }
  } catch (e) {}

  var currentMode = (App.runtime && App.runtime.mode) ? App.runtime.mode : DESKTOP;
  var lastSwitchAt = 0;
  var pendingTimer = null;

  // Desktop DOM references (detached/reattached as-is)
  // NOTE: modal-root is kept as a shared overlay layer in Mobile mode.
  var desktopDOM = {
    appEl: null,
    appParent: null,
    appNextSibling: null,
    toastEl: null,
    toastParent: null,
    toastNextSibling: null,
    modalEl: null,
    modalParent: null,
    modalNextSibling: null
  };

  var desktopStarted = false;
  var mobileEl = null;

  function nowMs() {
    return Date.now ? Date.now() : new Date().getTime();
  }

  function getViewportWidth() {
    try {
      return typeof window.innerWidth === 'number' ? window.innerWidth : 9999;
    } catch (e) {
      return 9999;
    }
  }

  function setRuntimeMode(mode) {
    App.runtime = App.runtime || {};
    App.runtime.mode = mode;
  }

  function ensureDesktopDOMCaptured() {
    if (!desktopDOM.appEl) {
      desktopDOM.appEl = document.querySelector('.app');
    }
    if (!desktopDOM.toastEl) {
      desktopDOM.toastEl = document.getElementById('toast');
    }
    if (!desktopDOM.modalEl) {
      desktopDOM.modalEl = document.getElementById('modal-root');
    }
  }

  function detachNode(node, slotKey) {
    if (!node || !node.parentNode) return;
    desktopDOM[slotKey + 'Parent'] = node.parentNode;
    desktopDOM[slotKey + 'NextSibling'] = node.nextSibling;
    node.parentNode.removeChild(node);
  }

  function attachNode(node, slotKey) {
    var parent = desktopDOM[slotKey + 'Parent'];
    var next = desktopDOM[slotKey + 'NextSibling'];
    if (!node || !parent) return;
    if (next && next.parentNode === parent) {
      parent.insertBefore(node, next);
    } else {
      parent.appendChild(node);
    }
  }

  function unmountDesktopDOM() {
    ensureDesktopDOMCaptured();

    // IMPORTANT (Phase 2): keep modal-root as a shared overlay layer.
    // Detach it from Desktop .app before detaching the .app itself.
    // Then re-attach modal-root to document.body so Mobile can reuse it.
    if (desktopDOM.modalEl) {
      detachNode(desktopDOM.modalEl, 'modal');
      try {
        document.body.appendChild(desktopDOM.modalEl);
      } catch (e) {}
    }

    // Detach toast too so Desktop UI artifacts are not present in Mobile mode.
    // Keep the existing toast element available for Mobile guard notifications (hidden unless used).
    detachNode(desktopDOM.toastEl, 'toast');
    if (desktopDOM.toastEl) {
      try {
        desktopDOM.toastEl.classList.remove('show');
        document.body.appendChild(desktopDOM.toastEl);
      } catch (e) {}
    }
    detachNode(desktopDOM.appEl, 'app');
  }

  function mountDesktopDOM() {
    ensureDesktopDOMCaptured();
    attachNode(desktopDOM.appEl, 'app');
    // Restore modal-root to its original Desktop position (DOM structure intact in Desktop mode)
    attachNode(desktopDOM.modalEl, 'modal');
    attachNode(desktopDOM.toastEl, 'toast');
  }

  function ensureMobileCss(on) {
    var id = 'mobile-phase1-css';
    var existing = document.getElementById(id);
    if (on) {
      if (existing) return;
      var link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'css/mobileShell.css';
      document.head.appendChild(link);
      return;
    }
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  function closeAllModals() {
    // Close auth modal if open (safe even if not initialized)
    try {
      if (App.auth && typeof App.auth.closeModal === 'function') {
        App.auth.closeModal();
      }
    } catch (e) {}

    // Close debtors/loan/claim/schedule modals
    try {
      if (App.modalManager && typeof App.modalManager.close === 'function') {
        App.modalManager.close();
      }
    } catch (e2) {}

    // Close operation / available capital modals
    try {
      if (App.ui && App.ui.operationModal && typeof App.ui.operationModal.close === 'function') {
        App.ui.operationModal.close();
      }
    } catch (e3) {}

    try {
      if (App.ui && App.ui.availableCapitalModal && typeof App.ui.availableCapitalModal.close === 'function') {
        App.ui.availableCapitalModal.close();
      }
    } catch (e4) {}
  }

  // ===== Mobile Calendar Phase 2 helpers (UI State only; no Domain/Store changes) =====

  function pad2(v) {
    v = Number(v) || 0;
    return v < 10 ? '0' + v : String(v);
  }

  function todayISO() {
    try {
      if (App.util && typeof App.util.todayISODate === 'function') {
        return App.util.todayISODate();
      }
    } catch (e) {}
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function parseISODateLocal(iso) {
    if (!iso || typeof iso !== 'string') return new Date();
    var parts = iso.split('-');
    if (parts.length < 3) return new Date();
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var d = Number(parts[2]);
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return new Date();
    return new Date(y, m - 1, d);
  }

  function toISODateLocal(date) {
    if (!(date instanceof Date)) date = new Date(date);
    if (isNaN(date.getTime())) return '';
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function addDaysISO(iso, deltaDays) {
    var d = parseISODateLocal(iso);
    d.setDate(d.getDate() + (Number(deltaDays) || 0));
    return toISODateLocal(d);
  }

  function weekdayKo(iso) {
    var dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    var d = parseISODateLocal(iso);
    var idx = d.getDay();
    return dayNames[idx] || '';
  }

  function formatCurrency(v) {
    try {
      if (App.util && typeof App.util.formatCurrency === 'function') {
        return App.util.formatCurrency(v);
      }
    } catch (e) {}
    var n = Number(v || 0);
    if (!isFinite(n)) n = 0;
    return n.toLocaleString('ko-KR');
  }

  function buildIndex(list, key) {
    var map = Object.create(null);
    if (!list) return map;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (it && it[key] != null) {
        map[String(it[key])] = it;
      }
    }
    return map;
  }

  function normalizeISOHead(v) {
    if (!v) return '';
    var s = String(v);
    if (s.length >= 10) return s.slice(0, 10);
    return s;
  }

  function selectMobileSchedulesForDate(isoDate) {
    var state = App.state || {};

    var debtorsById = buildIndex(state.debtors || [], 'id');
    var loansById = buildIndex(state.loans || [], 'id');
    var claimsById = buildIndex(state.claims || [], 'id');

    var schedules = [];
    if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      try {
        schedules = App.schedulesEngine.getAll() || [];
      } catch (e) {
        schedules = [];
      }
    } else {
      schedules = state.schedules || [];
    }

    var today = todayISO();
    var items = [];

    for (var i = 0; i < schedules.length; i++) {
      var s = schedules[i];
      if (!s) continue;

      var due = normalizeISOHead(s.dueDate || s.due_date || s.date);
      if (!due || due !== isoDate) continue;

      var kind = s.kind || (s.claimId ? 'claim' : 'loan');

      // Exclude rolled cards ("꺾기") to match Desktop behavior
      if (kind === 'loan') {
        var parentLoan = loansById[String(s.loanId)];
        if (parentLoan && parentLoan.cardStatus === '꺾기') continue;
      } else if (kind === 'claim') {
        var parentClaim = claimsById[String(s.claimId)];
        if (parentClaim && parentClaim.cardStatus === '꺾기') continue;
      }

      var debtor = debtorsById[String(s.debtorId)];
      var debtorName = debtor && debtor.name ? debtor.name : '';

      var status = String(s.status || 'PLANNED').toUpperCase();
      var isPaid = status === 'PAID';
      var isPartial = status === 'PARTIAL';
      var isOverStatus = status === 'OVERDUE';
      var isOverdue = !isPaid && (isOverStatus || (isoDate < today));

      var typeLabel = (kind === 'claim') ? '채권' : '대출';

      var amount = Number(s.amount || 0);
      var partialPaid = Number(s.partialPaidAmount || 0);
      if (!isFinite(amount)) amount = 0;
      if (!isFinite(partialPaid)) partialPaid = 0;

      // Desktop calendar subtracts partialPaid from amount for PARTIAL
      if (isPartial && partialPaid > 0 && partialPaid < amount) {
        amount = amount - partialPaid;
      }

      var amountText = formatCurrency(amount);

      var statusLabel = '예정';
      if (isPaid) statusLabel = '완료';
      else if (isPartial) statusLabel = '부분';
      else if (isOverdue) statusLabel = '연체';

      items.push({
        id: String(s.id),
        kind: kind,
        loanId: s.loanId != null ? String(s.loanId) : null,
        claimId: s.claimId != null ? String(s.claimId) : null,
        debtorName: debtorName,
        typeLabel: typeLabel,
        amountText: amountText,
        status: status,
        statusLabel: statusLabel,
        isPaid: isPaid,
        isPartial: isPartial,
        isOverdue: isOverdue,
        installmentNo: s.installmentNo || 0
      });
    }

    // Sort: kind -> debtorName -> installmentNo
    items.sort(function (a, b) {
      if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
      var an = (a.debtorName || '').toString();
      var bn = (b.debtorName || '').toString();
      if (an !== bn) return an.localeCompare(bn, 'ko-KR');
      return (a.installmentNo || 0) - (b.installmentNo || 0);
    });

    return items;
  }

  
  // ===== Mobile Debtors Phase 3 helpers (Read Model only; no Domain/Store writes) =====
  // - Mobile Debtor tab uses a minimal ViewModel/Selector to avoid leaking large domain structures.
  // - It MUST NOT return schedule arrays or mutable UI state from Desktop.

  function safeNumber(v) {
    var n = Number(v || 0);
    return isFinite(n) ? n : 0;
  }

  function getAllSchedulesSafe(state) {
    var schedules = [];
    if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      try {
        schedules = App.schedulesEngine.getAll() || [];
      } catch (e) {
        schedules = [];
      }
    } else {
      schedules = (state && state.schedules) ? state.schedules : [];
    }
    return schedules || [];
  }

  function computeOutstandingAmount(sc) {
    if (!sc) return 0;
    var amount = safeNumber(sc.amount);
    if (amount <= 0) return 0;

    // status is not always normalized, so we compute outstanding via (amount - paid) as the source of truth.
    var paid = 0;
    if (sc.paidAmount != null) paid = safeNumber(sc.paidAmount);
    else if (sc.partialPaidAmount != null) paid = safeNumber(sc.partialPaidAmount);

    if (paid < 0) paid = 0;
    if (paid >= amount) return 0;

    var st = String(sc.status || '').toUpperCase();
    if (st === 'PAID') return 0;

    return amount - paid;
  }

  function resolveScheduleKind(sc) {
    if (!sc) return 'loan';
    if (sc.kind) return sc.kind;
    if (sc.claimId != null && sc.claimId !== '') return 'claim';
    return 'loan';
  }

  function isRolledCard(kind, loanId, claimId, loansById, claimsById) {
    if (kind === 'loan') {
      var parentLoan = loansById && loanId != null ? loansById[String(loanId)] : null;
      return !!(parentLoan && parentLoan.cardStatus === '꺾기');
    }
    if (kind === 'claim') {
      var parentClaim = claimsById && claimId != null ? claimsById[String(claimId)] : null;
      return !!(parentClaim && parentClaim.cardStatus === '꺾기');
    }
    return false;
  }

  function resolveDebtorIdFromSchedule(sc, loansById, claimsById) {
    if (!sc) return null;
    if (sc.debtorId != null && sc.debtorId !== '') return String(sc.debtorId);

    var kind = resolveScheduleKind(sc);
    if (kind === 'loan' && sc.loanId != null && loansById && loansById[String(sc.loanId)]) {
      var ln = loansById[String(sc.loanId)];
      return ln && ln.debtorId != null ? String(ln.debtorId) : null;
    }
    if (kind === 'claim' && sc.claimId != null && claimsById && claimsById[String(sc.claimId)]) {
      var cl = claimsById[String(sc.claimId)];
      return cl && cl.debtorId != null ? String(cl.debtorId) : null;
    }
    return null;
  }

  // Phase 3: Mobile Debtor Read Model (minimal projection)
  function selectMobileDebtorCardsLite() {
    var state = App.state || {};
    var debtors = Array.isArray(state.debtors) ? state.debtors : [];
    var loans = Array.isArray(state.loans) ? state.loans : [];
    var claims = Array.isArray(state.claims) ? state.claims : [];

    var loansById = buildIndex(loans, 'id');
    var claimsById = buildIndex(claims, 'id');
    var schedules = getAllSchedulesSafe(state);

    var today = todayISO();

    var agg = Object.create(null);

    function ensureAgg(debtorId) {
      var id = String(debtorId);
      if (!agg[id]) {
        agg[id] = {
          hasLoan: false,
          hasClaim: false,
          totalDebtAmount: 0,
          overdueAmount: 0,
          todayAmount: 0,
          aliveStatus: false
        };
      }
      return agg[id];
    }

    // hasLoan / hasClaim (ignore rolled cards)
    for (var i = 0; i < loans.length; i++) {
      var ln = loans[i];
      if (!ln || ln.debtorId == null) continue;
      if (ln.cardStatus === '꺾기') continue;
      ensureAgg(ln.debtorId).hasLoan = true;
    }
    for (var j = 0; j < claims.length; j++) {
      var cl = claims[j];
      if (!cl || cl.debtorId == null) continue;
      if (cl.cardStatus === '꺾기') continue;
      ensureAgg(cl.debtorId).hasClaim = true;
    }

    // Aggregate schedule amounts (read-only)
    for (var s = 0; s < schedules.length; s++) {
      var sc = schedules[s];
      if (!sc) continue;

      var kind = resolveScheduleKind(sc);
      var loanId = sc.loanId != null ? String(sc.loanId) : null;
      var claimId = sc.claimId != null ? String(sc.claimId) : null;

      if (isRolledCard(kind, loanId, claimId, loansById, claimsById)) continue;

      var debtorId = resolveDebtorIdFromSchedule(sc, loansById, claimsById);
      if (!debtorId) continue;

      var due = normalizeISOHead(sc.dueDate || sc.due_date || sc.date);
      if (!due) continue;

      var outstanding = computeOutstandingAmount(sc);
      if (outstanding <= 0) continue;

      var a = ensureAgg(debtorId);
      a.totalDebtAmount += outstanding;
      a.aliveStatus = true;

      if (due < today) {
        a.overdueAmount += outstanding;
      } else if (due === today) {
        a.todayAmount += outstanding;
      }
    }

    // Build ViewModel list (do NOT include schedule arrays)
    var out = [];
    for (var d = 0; d < debtors.length; d++) {
      var debtor = debtors[d];
      if (!debtor || debtor.id == null) continue;

      var id2 = String(debtor.id);
      var a2 = agg[id2] || {
        hasLoan: false,
        hasClaim: false,
        totalDebtAmount: 0,
        overdueAmount: 0,
        todayAmount: 0,
        aliveStatus: false
      };

      out.push({
        debtorId: id2,
        debtorName: debtor.name || '',
        hasLoan: !!a2.hasLoan,
        hasClaim: !!a2.hasClaim,
        totalDebtAmount: safeNumber(a2.totalDebtAmount),
        overdueAmount: safeNumber(a2.overdueAmount),
        todayAmount: safeNumber(a2.todayAmount),
        aliveStatus: !!a2.aliveStatus,
        riskFlag: safeNumber(a2.overdueAmount) > 0
      });
    }

    // Sort (Phase 3 fixed)
    // 1) 연체 있음
    // 2) 오늘 납부 있음
    // 3) 나머지
    out.sort(function (a, b) {
      var aOver = a.overdueAmount > 0 ? 1 : 0;
      var bOver = b.overdueAmount > 0 ? 1 : 0;
      if (aOver !== bOver) return bOver - aOver;

      var aToday = a.todayAmount > 0 ? 1 : 0;
      var bToday = b.todayAmount > 0 ? 1 : 0;
      if (aToday !== bToday) return bToday - aToday;

      // within group: overdue desc -> today desc -> name
      if (a.overdueAmount !== b.overdueAmount) return b.overdueAmount - a.overdueAmount;
      if (a.todayAmount !== b.todayAmount) return b.todayAmount - a.todayAmount;

      var an = (a.debtorName || '').toString();
      var bn = (b.debtorName || '').toString();
      return an.localeCompare(bn, 'ko-KR');
    });

    return out;
  }

  // Pick one schedule to open the existing Schedule Modal (read-only)
  function findBestScheduleRefForDebtor(debtorId, mode) {
    var state = App.state || {};
    var loansById = buildIndex(state.loans || [], 'id');
    var claimsById = buildIndex(state.claims || [], 'id');
    var schedules = getAllSchedulesSafe(state);

    var today = todayISO();
    var targetId = debtorId != null ? String(debtorId) : null;
    if (!targetId) return null;

    var candidates = [];

    for (var i = 0; i < schedules.length; i++) {
      var sc = schedules[i];
      if (!sc) continue;

      var kind = resolveScheduleKind(sc);
      var loanId = sc.loanId != null ? String(sc.loanId) : null;
      var claimId = sc.claimId != null ? String(sc.claimId) : null;

      if (isRolledCard(kind, loanId, claimId, loansById, claimsById)) continue;

      var did = resolveDebtorIdFromSchedule(sc, loansById, claimsById);
      if (!did || did !== targetId) continue;

      var due = normalizeISOHead(sc.dueDate || sc.due_date || sc.date);
      if (!due) continue;

      var outstanding = computeOutstandingAmount(sc);
      if (outstanding <= 0) continue;

      if (mode === 'today') {
        if (due !== today) continue;
      } else if (mode === 'overdue') {
        if (!(due < today)) continue;
      } else {
        continue;
      }

      candidates.push({
        kind: kind,
        loanId: loanId,
        claimId: claimId,
        scheduleId: sc.id != null ? String(sc.id) : null,
        due: due,
        installmentNo: sc.installmentNo || 0
      });
    }

    if (!candidates.length) return null;

    candidates.sort(function (a, b) {
      if (a.due !== b.due) return a.due < b.due ? -1 : 1;
      if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
      return (a.installmentNo || 0) - (b.installmentNo || 0);
    });

    return candidates[0];
  }


  // ===== Mobile Monitoring & Report Phase 4 helpers (Read Model only) =====
  // - Monitoring Lite and Report KPI are numeric-only dashboards.
  // - Reuse existing Monitoring/Report calculation logic (no KPI logic duplication).
  // - Read Model MUST NOT expose raw logs/arrays or Desktop UI state.

  function selectMobileMonitoringLiteSummary() {
    var out = {
      ddayAmountTotal: 0,
      ddayDebtorCount: 0,
      overdueDebtorCount: 0,
      overdueAmountTotal: 0
    };

    try {
      var monitoring = App.features && App.features.monitoring;
      var internal = monitoring && monitoring._internal;
      if (!internal) return out;

      if (typeof internal.recomputeDateAnchors === 'function') {
        internal.recomputeDateAnchors();
      }

      var schedules = [];
      if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
        try {
          schedules = App.schedulesEngine.getAll() || [];
        } catch (e) {
          schedules = [];
        }
      }
      if (!Array.isArray(schedules)) schedules = [];

      var ddayList = schedules.filter(function (sc) {
        return internal.filterDDay ? internal.filterDDay(sc) : false;
      });
      var overdueList = schedules.filter(function (sc) {
        return internal.filterOverdue ? internal.filterOverdue(sc) : false;
      });

      var ddayGroups = internal.groupByDebtor ? internal.groupByDebtor(ddayList) : [];
      var overdueGroups = internal.groupByDebtor ? internal.groupByDebtor(overdueList) : [];

      function sumGroupAmount(groups) {
        var sum = 0;
        if (!groups) return 0;
        for (var i = 0; i < groups.length; i++) {
          var g = groups[i];
          if (!g) continue;
          var amt = Number(g.totalAmount || 0);
          if (isFinite(amt)) sum += amt;
        }
        return sum;
      }

      out.ddayDebtorCount = ddayGroups && ddayGroups.length ? ddayGroups.length : 0;
      out.ddayAmountTotal = sumGroupAmount(ddayGroups);

      out.overdueDebtorCount = overdueGroups && overdueGroups.length ? overdueGroups.length : 0;
      out.overdueAmountTotal = sumGroupAmount(overdueGroups);
    } catch (e) {}

    return out;
  }

  function selectMobileReportOverviewKpiLite() {
    var out = {
      debtTotal: 0,
      debtPaid: 0,
      debtOverdue: 0,
      repayRatePct: 0
    };

    try {
      var agg = (App.reportCompute && typeof App.reportCompute.computeAggregates === 'function')
        ? App.reportCompute.computeAggregates()
        : null;

      var summary = null;

      // Prefer the same summary snapshot used by Desktop Report → Statistics.
      if (agg && App.features && App.features.statisticsEngine && typeof App.features.statisticsEngine.buildContext === 'function') {
        var ctx = App.features.statisticsEngine.buildContext(agg);
        if (ctx && ctx.summary) summary = ctx.summary;
      }

      if (summary) {
        out.debtTotal = Number(summary.debttotal) || 0;
        out.debtPaid = Number(summary.debtpaid) || 0;
        out.debtOverdue = Number(summary.debtoverdue) || 0;
      } else if (agg && agg.totals) {
        // Best-effort fallback (still from existing aggregates)
        out.debtTotal = Number(agg.totals.debtTotal) || 0;
        out.debtPaid = Number(agg.totals.allCollectedTotal) || 0;
        out.debtOverdue = 0;
      }

      if (out.debtTotal > 0) {
        out.repayRatePct = (out.debtPaid / out.debtTotal) * 100;
      } else {
        out.repayRatePct = 0;
      }

      if (!isFinite(out.repayRatePct) || out.repayRatePct < 0) out.repayRatePct = 0;
    } catch (e) {}

    return out;
  }

function applyMobileReadonlyToScheduleModal() {
    // UI-level block: Mobile is read-only for schedules in Phase 2.
    try {
      if (!App.runtime || App.runtime.mode !== MOBILE) return;
      var root = document.getElementById('modal-root');
      if (!root) return;
      var form = root.querySelector('[data-modal-kind="schedule-loan"], [data-modal-kind="schedule-claim"]');
      if (!form) return;

      var selects = form.querySelectorAll('select[name="schedule-status"]');
      for (var i = 0; i < selects.length; i++) {
        selects[i].disabled = true;
      }

      var partialInputs = form.querySelectorAll('input[data-partial-id]');
      for (var j = 0; j < partialInputs.length; j++) {
        partialInputs[j].disabled = true;
      }

      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.display = 'none';
      }
    } catch (e) {}
  }


  // ===== Mobile Capability Guard (Phase 3) =====
  // Execution-level block so that Mobile Mode remains read-only even if a form submits accidentally.
  // NOTE: Restored immediately on Mobile → Desktop to keep Desktop behavior unchanged.
  var _mobileCapabilityGuard = {
    enabled: false,
    originals: null
  };

    function enableMobileCapabilityGuard() {
    if (_mobileCapabilityGuard.enabled) return;
    _mobileCapabilityGuard.enabled = true;
    _mobileCapabilityGuard.originals = _mobileCapabilityGuard.originals || {};
    _mobileCapabilityGuard.notified = _mobileCapabilityGuard.notified || {};

    function toastOnce(key, msg) {
      if (_mobileCapabilityGuard.notified[key]) return;
      _mobileCapabilityGuard.notified[key] = 1;
      try {
        if (typeof App.showToast === 'function') {
          App.showToast(msg);
        }
      } catch (e) {}
    }

    function blockWrite(actionKey) {
      // Single toast per session: 안정성 우선(반복 노출 방지)
      toastOnce('mobile-write-blocked', '모바일 모드에서는 생성/수정/저장 기능이 차단됩니다.');
      try { if (actionKey) {} } catch (e) {}
    }

    function makeBlockedFn(actionKey, returnValue) {
      return function () {
        blockWrite(actionKey);
        return returnValue;
      };
    }

    // Domain mutation APIs (hard gate)
    try {
      if (App.api && App.api.domain) {
        // Debtor CRUD
        if (App.api.domain.debtor) {
          var debtor = App.api.domain.debtor;

          if (typeof debtor.createFromForm === 'function') {
            if (!_mobileCapabilityGuard.originals.debtorCreateFromForm) _mobileCapabilityGuard.originals.debtorCreateFromForm = debtor.createFromForm;
            debtor.createFromForm = makeBlockedFn('debtor-create');
          }
          if (typeof debtor.editFromForm === 'function') {
            if (!_mobileCapabilityGuard.originals.debtorEditFromForm) _mobileCapabilityGuard.originals.debtorEditFromForm = debtor.editFromForm;
            debtor.editFromForm = makeBlockedFn('debtor-edit');
          }
          if (typeof debtor.deleteById === 'function') {
            if (!_mobileCapabilityGuard.originals.debtorDeleteById) _mobileCapabilityGuard.originals.debtorDeleteById = debtor.deleteById;
            debtor.deleteById = makeBlockedFn('debtor-delete');
          }
        }

        // Loan CRUD
        if (App.api.domain.loan) {
          var loan = App.api.domain.loan;

          if (typeof loan.createFromForm === 'function') {
            if (!_mobileCapabilityGuard.originals.loanCreateFromForm) _mobileCapabilityGuard.originals.loanCreateFromForm = loan.createFromForm;
            loan.createFromForm = makeBlockedFn('loan-create');
          }
          if (typeof loan.editFromForm === 'function') {
            if (!_mobileCapabilityGuard.originals.loanEditFromForm) _mobileCapabilityGuard.originals.loanEditFromForm = loan.editFromForm;
            loan.editFromForm = makeBlockedFn('loan-edit');
          }
          if (typeof loan.deleteById === 'function') {
            if (!_mobileCapabilityGuard.originals.loanDeleteById) _mobileCapabilityGuard.originals.loanDeleteById = loan.deleteById;
            loan.deleteById = makeBlockedFn('loan-delete');
          }
        }

        // Claim CRUD
        if (App.api.domain.claim) {
          var claim = App.api.domain.claim;

          if (typeof claim.createFromForm === 'function') {
            if (!_mobileCapabilityGuard.originals.claimCreateFromForm) _mobileCapabilityGuard.originals.claimCreateFromForm = claim.createFromForm;
            claim.createFromForm = makeBlockedFn('claim-create');
          }
          if (typeof claim.editFromForm === 'function') {
            if (!_mobileCapabilityGuard.originals.claimEditFromForm) _mobileCapabilityGuard.originals.claimEditFromForm = claim.editFromForm;
            claim.editFromForm = makeBlockedFn('claim-edit');
          }
          if (typeof claim.deleteById === 'function') {
            if (!_mobileCapabilityGuard.originals.claimDeleteById) _mobileCapabilityGuard.originals.claimDeleteById = claim.deleteById;
            claim.deleteById = makeBlockedFn('claim-delete');
          }
        }

        // Schedule saves (status/partialPaid/memo changes)
        if (App.api.domain.schedule) {
          var sched = App.api.domain.schedule;

          if (typeof sched.saveLoanFromForm === 'function') {
            if (!_mobileCapabilityGuard.originals.saveLoanFromForm) _mobileCapabilityGuard.originals.saveLoanFromForm = sched.saveLoanFromForm;
            sched.saveLoanFromForm = makeBlockedFn('schedule-save-loan');
          }
          if (typeof sched.saveClaimFromForm === 'function') {
            if (!_mobileCapabilityGuard.originals.saveClaimFromForm) _mobileCapabilityGuard.originals.saveClaimFromForm = sched.saveClaimFromForm;
            sched.saveClaimFromForm = makeBlockedFn('schedule-save-claim');
          }
        }
      }
    } catch (e) {}

    // Defensive: legacy handlers + direct engine write paths
    try {
      if (App.features && App.features.debtorsHandlers) {
        var h = App.features.debtorsHandlers;

        if (typeof h.handleDebtorCreate === 'function') {
          if (!_mobileCapabilityGuard.originals.handleDebtorCreate) _mobileCapabilityGuard.originals.handleDebtorCreate = h.handleDebtorCreate;
          h.handleDebtorCreate = makeBlockedFn('debtor-create');
        }
        if (typeof h.handleDebtorEdit === 'function') {
          if (!_mobileCapabilityGuard.originals.handleDebtorEdit) _mobileCapabilityGuard.originals.handleDebtorEdit = h.handleDebtorEdit;
          h.handleDebtorEdit = makeBlockedFn('debtor-edit');
        }
        if (typeof h.handleDebtorDelete === 'function') {
          if (!_mobileCapabilityGuard.originals.handleDebtorDelete) _mobileCapabilityGuard.originals.handleDebtorDelete = h.handleDebtorDelete;
          h.handleDebtorDelete = makeBlockedFn('debtor-delete');
        }

        if (typeof h.handleLoanCreate === 'function') {
          if (!_mobileCapabilityGuard.originals.handleLoanCreate) _mobileCapabilityGuard.originals.handleLoanCreate = h.handleLoanCreate;
          h.handleLoanCreate = makeBlockedFn('loan-create');
        }
        if (typeof h.handleLoanEdit === 'function') {
          if (!_mobileCapabilityGuard.originals.handleLoanEdit) _mobileCapabilityGuard.originals.handleLoanEdit = h.handleLoanEdit;
          h.handleLoanEdit = makeBlockedFn('loan-edit');
        }
        if (typeof h.handleLoanDelete === 'function') {
          if (!_mobileCapabilityGuard.originals.handleLoanDelete) _mobileCapabilityGuard.originals.handleLoanDelete = h.handleLoanDelete;
          h.handleLoanDelete = makeBlockedFn('loan-delete');
        }

        if (typeof h.handleClaimCreate === 'function') {
          if (!_mobileCapabilityGuard.originals.handleClaimCreate) _mobileCapabilityGuard.originals.handleClaimCreate = h.handleClaimCreate;
          h.handleClaimCreate = makeBlockedFn('claim-create');
        }
        if (typeof h.handleClaimEdit === 'function') {
          if (!_mobileCapabilityGuard.originals.handleClaimEdit) _mobileCapabilityGuard.originals.handleClaimEdit = h.handleClaimEdit;
          h.handleClaimEdit = makeBlockedFn('claim-edit');
        }
        if (typeof h.handleClaimDelete === 'function') {
          if (!_mobileCapabilityGuard.originals.handleClaimDelete) _mobileCapabilityGuard.originals.handleClaimDelete = h.handleClaimDelete;
          h.handleClaimDelete = makeBlockedFn('claim-delete');
        }

        if (typeof h.handleLoanScheduleSave === 'function') {
          if (!_mobileCapabilityGuard.originals.handleLoanScheduleSave) _mobileCapabilityGuard.originals.handleLoanScheduleSave = h.handleLoanScheduleSave;
          h.handleLoanScheduleSave = makeBlockedFn('schedule-save-loan');
        }
        if (typeof h.handleClaimScheduleSave === 'function') {
          if (!_mobileCapabilityGuard.originals.handleClaimScheduleSave) _mobileCapabilityGuard.originals.handleClaimScheduleSave = h.handleClaimScheduleSave;
          h.handleClaimScheduleSave = makeBlockedFn('schedule-save-claim');
        }
      }
    } catch (e2) {}

    try {
      if (App.schedulesEngine) {
        if (typeof App.schedulesEngine.bulkUpdateFromLoanForm === 'function') {
          if (!_mobileCapabilityGuard.originals.bulkUpdateFromLoanForm) _mobileCapabilityGuard.originals.bulkUpdateFromLoanForm = App.schedulesEngine.bulkUpdateFromLoanForm;
          App.schedulesEngine.bulkUpdateFromLoanForm = makeBlockedFn('schedule-save-loan');
        }
        if (typeof App.schedulesEngine.bulkUpdateFromClaimForm === 'function') {
          if (!_mobileCapabilityGuard.originals.bulkUpdateFromClaimForm) _mobileCapabilityGuard.originals.bulkUpdateFromClaimForm = App.schedulesEngine.bulkUpdateFromClaimForm;
          App.schedulesEngine.bulkUpdateFromClaimForm = makeBlockedFn('schedule-save-claim');
        }
      }
    } catch (eEngine) {}

    // Cloud Save/Load (explicitly forbidden in Mobile)
    try {
      if (App.data) {
        if (typeof App.data.saveToSupabase === 'function') {
          if (!_mobileCapabilityGuard.originals.saveToSupabase) _mobileCapabilityGuard.originals.saveToSupabase = App.data.saveToSupabase;
          App.data.saveToSupabase = function () {
            blockWrite('cloud-save');
            return (typeof Promise !== 'undefined' && Promise && typeof Promise.resolve === 'function') ? Promise.resolve(null) : null;
          };
        }

        if (typeof App.data.loadAllFromSupabase === 'function') {
          if (!_mobileCapabilityGuard.originals.loadAllFromSupabase) _mobileCapabilityGuard.originals.loadAllFromSupabase = App.data.loadAllFromSupabase;
          App.data.loadAllFromSupabase = function () {
            blockWrite('cloud-load');
            return (typeof Promise !== 'undefined' && Promise && typeof Promise.resolve === 'function') ? Promise.resolve(null) : null;
          };
        }
      }
    } catch (e3) {}
  }

  function disableMobileCapabilityGuard() {
    if (!_mobileCapabilityGuard.enabled) return;
    _mobileCapabilityGuard.enabled = false;

    var orig = _mobileCapabilityGuard.originals || {};

    try {
      if (App.api && App.api.domain) {
        if (App.api.domain.schedule) {
          var sched = App.api.domain.schedule;
          if (orig.saveLoanFromForm) sched.saveLoanFromForm = orig.saveLoanFromForm;
          if (orig.saveClaimFromForm) sched.saveClaimFromForm = orig.saveClaimFromForm;
        }
        if (App.api.domain.debtor) {
          var debtor = App.api.domain.debtor;
          if (orig.debtorCreateFromForm) debtor.createFromForm = orig.debtorCreateFromForm;
          if (orig.debtorEditFromForm) debtor.editFromForm = orig.debtorEditFromForm;
          if (orig.debtorDeleteById) debtor.deleteById = orig.debtorDeleteById;
        }
        if (App.api.domain.loan) {
          var loan = App.api.domain.loan;
          if (orig.loanCreateFromForm) loan.createFromForm = orig.loanCreateFromForm;
          if (orig.loanEditFromForm) loan.editFromForm = orig.loanEditFromForm;
          if (orig.loanDeleteById) loan.deleteById = orig.loanDeleteById;
        }
        if (App.api.domain.claim) {
          var claim = App.api.domain.claim;
          if (orig.claimCreateFromForm) claim.createFromForm = orig.claimCreateFromForm;
          if (orig.claimEditFromForm) claim.editFromForm = orig.claimEditFromForm;
          if (orig.claimDeleteById) claim.deleteById = orig.claimDeleteById;
        }
      }
    } catch (e) {}

    try {
      if (App.features && App.features.debtorsHandlers) {
        var h = App.features.debtorsHandlers;
        if (orig.handleDebtorCreate) h.handleDebtorCreate = orig.handleDebtorCreate;
        if (orig.handleDebtorEdit) h.handleDebtorEdit = orig.handleDebtorEdit;
        if (orig.handleDebtorDelete) h.handleDebtorDelete = orig.handleDebtorDelete;
        if (orig.handleLoanCreate) h.handleLoanCreate = orig.handleLoanCreate;
        if (orig.handleLoanEdit) h.handleLoanEdit = orig.handleLoanEdit;
        if (orig.handleLoanDelete) h.handleLoanDelete = orig.handleLoanDelete;
        if (orig.handleClaimCreate) h.handleClaimCreate = orig.handleClaimCreate;
        if (orig.handleClaimEdit) h.handleClaimEdit = orig.handleClaimEdit;
        if (orig.handleClaimDelete) h.handleClaimDelete = orig.handleClaimDelete;
        if (orig.handleLoanScheduleSave) h.handleLoanScheduleSave = orig.handleLoanScheduleSave;
        if (orig.handleClaimScheduleSave) h.handleClaimScheduleSave = orig.handleClaimScheduleSave;
      }
    } catch (e2) {}

    try {
      if (App.schedulesEngine) {
        if (orig.bulkUpdateFromLoanForm) App.schedulesEngine.bulkUpdateFromLoanForm = orig.bulkUpdateFromLoanForm;
        if (orig.bulkUpdateFromClaimForm) App.schedulesEngine.bulkUpdateFromClaimForm = orig.bulkUpdateFromClaimForm;
      }
    } catch (eEngine) {}

    try {
      if (App.data) {
        if (orig.saveToSupabase) App.data.saveToSupabase = orig.saveToSupabase;
        if (orig.loadAllFromSupabase) App.data.loadAllFromSupabase = orig.loadAllFromSupabase;
      }
    } catch (e3) {}
  }

function buildMobileShell() {
    var root = document.createElement('div');
    root.id = 'mobile-shell';
    root.className = 'mobile-shell';

    var tabs = document.createElement('div');
    tabs.id = 'mobile-tabs';
    tabs.className = 'mobile-tabs';
    root.appendChild(tabs);

    var content = document.createElement('div');
    content.className = 'mobile-content';
    root.appendChild(content);

    var tabDefs = [
      { key: 'debtors', label: '채무자관리', panelId: 'm-tab-debtors', title: '채무자관리 (Mobile)' },
      { key: 'monitoring', label: 'Monitoring', panelId: 'm-tab-monitoring', title: 'Monitoring Lite' },
      { key: 'calendar', label: '캘린더', panelId: 'm-tab-calendar', title: '캘린더 (Right Panel only)' },
      { key: 'report', label: 'Report', panelId: 'm-tab-report', title: 'Report (Overview KPI)' }
    ];

    // Mobile Calendar UI State (focusDate)
    // - Mobile Mode entry: today
    // - Calendar tab re-entry: keep last focusDate
    var mobileUI = ensureMobileUIState();

    // focusDate is Mobile Calendar tab UI State only (no Domain/Store/Snapshot write)
    // - First Mobile entry: today
    // - Next Mobile entries (after Desktop ↔ Mobile transition): keep last focusDate
    var focusDate = '';
    try {
      if (mobileUI && typeof mobileUI.focusDate === 'string') {
        focusDate = normalizeISOHead(mobileUI.focusDate);
      }
    } catch (e) {}
    if (!focusDate) {
      focusDate = todayISO();
      try { mobileUI.focusDate = focusDate; } catch (e2) {}
    }

    // Mobile Debtors UI State (expanded/collapsed)
    // - Runtime only (no App.state writes)
    // - Default: expanded (for quick operations reading)
    var debtorListEl = null;
    var debtorExpandedById = Object.create(null);
    var debtorInited = false;

    function renderMobileDebtors() {
      if (!debtorListEl) return;

      while (debtorListEl.firstChild) {
        debtorListEl.removeChild(debtorListEl.firstChild);
      }

      var items = selectMobileDebtorCardsLite();
      if (!items || !items.length) {
        var empty = document.createElement('div');
        empty.className = 'mdebtor-empty';
        empty.textContent = '표시할 채무자가 없습니다.';
        debtorListEl.appendChild(empty);
        return;
      }

      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it) continue;

        var card = document.createElement('div');
        card.className = 'mdebtor-card';
        card.setAttribute('data-mdebtor-id', String(it.debtorId || ''));

        var expandedNow = debtorExpandedById[String(it.debtorId || '')] !== false;
        if (expandedNow) card.classList.add('is-expanded');

        // Header
        var header = document.createElement('div');
        header.className = 'mdebtor-header';

        var left = document.createElement('div');
        left.className = 'mdebtor-header-left';

        var icon = document.createElement('span');
        icon.className = 'mdebtor-status-icon';
        if (it.overdueAmount > 0) icon.classList.add('is-risk');
        else if (it.todayAmount > 0) icon.classList.add('is-today');
        else if (it.aliveStatus) icon.classList.add('is-alive');
        else icon.classList.add('is-empty');
        left.appendChild(icon);

        var name = document.createElement('span');
        name.className = 'mdebtor-name';
        name.textContent = it.debtorName || '(이름 없음)';
        left.appendChild(name);

        header.appendChild(left);

        var chevron = document.createElement('span');
        chevron.className = 'mdebtor-chevron';
        chevron.textContent = '▾';
        header.appendChild(chevron);

        card.appendChild(header);

        // Body
        var body = document.createElement('div');
        body.className = 'mdebtor-body';

        function addMetricRow(label, valueText, isButton, openMode, disabled) {
          var row;
          if (isButton) {
            row = document.createElement('button');
            row.type = 'button';
            row.className = 'mdebtor-metric-btn';
            row.setAttribute('data-mdebtor-open', openMode);
            if (disabled) row.disabled = true;
          } else {
            row = document.createElement('div');
            row.className = 'mdebtor-metric';
          }

          var l = document.createElement('span');
          l.className = 'mdebtor-metric-label';
          l.textContent = label;

          var v = document.createElement('span');
          v.className = 'mdebtor-metric-value';
          v.textContent = valueText;

          row.appendChild(l);
          row.appendChild(v);
          body.appendChild(row);
        }

        addMetricRow('총 채무금', formatCurrency(it.totalDebtAmount), false, '', false);
        addMetricRow('오늘 납부', formatCurrency(it.todayAmount), true, 'today', !(it.todayAmount > 0));
        addMetricRow('미납/연체', formatCurrency(it.overdueAmount), true, 'overdue', !(it.overdueAmount > 0));

        var badges = document.createElement('div');
        badges.className = 'mdebtor-badges';

        var b1 = document.createElement('span');
        b1.className = 'mdebtor-badge' + (it.hasLoan ? ' is-on' : ' is-off');
        b1.textContent = '대출 있음';
        badges.appendChild(b1);

        var b2 = document.createElement('span');
        b2.className = 'mdebtor-badge' + (it.hasClaim ? ' is-on' : ' is-off');
        b2.textContent = '채권 있음';
        badges.appendChild(b2);

        body.appendChild(badges);

        card.appendChild(body);
        debtorListEl.appendChild(card);
      }
    }

    // Calendar DOM refs
    var calDateLabelEl = null;
    var calListEl = null;
    var calInited = false;

    // Monitoring Lite DOM refs (Phase 4)
    var monDDayAmountEl = null;
    var monDDayCountEl = null;
    var monOverdueCountEl = null;
    var monOverdueAmountEl = null;
    var monInited = false;

    // Report Overview KPI DOM refs (Phase 4)
    var repDebtTotalEl = null;
    var repDebtPaidEl = null;
    var repDebtOverdueEl = null;
    var repRepayRateEl = null;
    var reportInited = false;


    function renderMobileCalendar() {
      if (!calDateLabelEl || !calListEl) return;

      calDateLabelEl.textContent = focusDate + ' (' + weekdayKo(focusDate) + ')';

      while (calListEl.firstChild) {
        calListEl.removeChild(calListEl.firstChild);
      }

      var items = selectMobileSchedulesForDate(focusDate);
      if (!items.length) {
        var empty = document.createElement('div');
        empty.className = 'mcal-empty';
        empty.textContent = '등록된 일정이 없습니다.';
        calListEl.appendChild(empty);
        return;
      }

      for (var i = 0; i < items.length; i++) {
        var it = items[i];

        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'mcal-item';
        row.setAttribute('data-mschedule-id', it.id);
        row.setAttribute('data-kind', it.kind);
        if (it.loanId) row.setAttribute('data-loan-id', it.loanId);
        if (it.claimId) row.setAttribute('data-claim-id', it.claimId);

        if (it.isPaid) row.classList.add('is-paid');
        else if (it.isPartial) row.classList.add('is-partial');
        else if (it.isOverdue) row.classList.add('is-overdue');
        else row.classList.add('is-planned');

        var left = document.createElement('div');
        left.className = 'mcal-item-left';

        var titleRow = document.createElement('div');
        titleRow.className = 'mcal-item-title';

        var kindBadge = document.createElement('span');
        kindBadge.className = 'mcal-kind-badge';
        if (it.kind === 'claim') {
          kindBadge.classList.add('is-claim');
          kindBadge.textContent = '채권';
        } else {
          kindBadge.classList.add('is-loan');
          kindBadge.textContent = '대출';
        }

        var name = document.createElement('span');
        name.className = 'mcal-debtor-name';
        name.textContent = it.debtorName || '';

        titleRow.appendChild(kindBadge);
        titleRow.appendChild(name);
        left.appendChild(titleRow);

        var right = document.createElement('div');
        right.className = 'mcal-item-right';

        var amt = document.createElement('div');
        amt.className = 'mcal-amount';
        amt.textContent = it.amountText || '';

        var st = document.createElement('div');
        st.className = 'mcal-status';
        st.textContent = it.statusLabel || '';

        right.appendChild(amt);
        right.appendChild(st);

        row.appendChild(left);
        row.appendChild(right);

        calListEl.appendChild(row);
      }
    }

    function renderMobileMonitoring() {
      if (!monDDayAmountEl || !monDDayCountEl || !monOverdueCountEl || !monOverdueAmountEl) return;
      var vm = selectMobileMonitoringLiteSummary();
      monDDayAmountEl.textContent = formatCurrency(vm.ddayAmountTotal);
      monDDayCountEl.textContent = String(vm.ddayDebtorCount || 0) + '명';
      monOverdueCountEl.textContent = String(vm.overdueDebtorCount || 0) + '명';
      monOverdueAmountEl.textContent = formatCurrency(vm.overdueAmountTotal);
    }

    function formatPercent1(value) {
      var n = Number(value);
      if (!isFinite(n)) n = 0;
      if (n < 0) n = 0;
      var rounded = Math.round(n * 10) / 10;
      return rounded.toFixed(1) + '%';
    }

    function renderMobileReport() {
      if (!repDebtTotalEl || !repDebtPaidEl || !repDebtOverdueEl || !repRepayRateEl) return;
      var vm = selectMobileReportOverviewKpiLite();
      repDebtTotalEl.textContent = formatCurrency(vm.debtTotal);
      repDebtPaidEl.textContent = formatCurrency(vm.debtPaid);
      repDebtOverdueEl.textContent = formatCurrency(vm.debtOverdue);
      repRepayRateEl.textContent = formatPercent1(vm.repayRatePct);
    }

    function setActiveTab(tabKey) {
      for (var i = 0; i < tabDefs.length; i++) {
        var def = tabDefs[i];
        var btn = tabs.querySelector('[data-mtab="' + def.key + '"]');
        var panel = document.getElementById(def.panelId);
        var isActive = def.key === tabKey;
        if (btn) {
          if (isActive) btn.classList.add('is-active');
          else btn.classList.remove('is-active');
          btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        }
        if (panel) {
          if (isActive) panel.classList.add('is-active');
          else panel.classList.remove('is-active');
        }
      }

      // Debtors tab: render card list (Phase 3)
      if (tabKey === 'debtors') {
        if (!debtorInited) {
          debtorInited = true;
        }
        renderMobileDebtors();
      }

      // Calendar tab re-entry: keep focusDate and re-render list
      if (tabKey === 'calendar') {
        if (!calInited) {
          calInited = true;
        }
        renderMobileCalendar();
      }

      // Monitoring tab: 숫자 요약판 (Phase 4)
      if (tabKey === 'monitoring') {
        if (!monInited) {
          monInited = true;
        }
        renderMobileMonitoring();
      }

      // Report tab: Overview KPI only (Phase 4)
      if (tabKey === 'report') {
        if (!reportInited) {
          reportInited = true;
        }
        renderMobileReport();
      }
    }

    // Tab buttons
    for (var t = 0; t < tabDefs.length; t++) {
      var d = tabDefs[t];
      var btnEl = document.createElement('button');
      btnEl.type = 'button';
      btnEl.className = 'mobile-tab-btn';
      btnEl.textContent = d.label;
      btnEl.setAttribute('data-mtab', d.key);
      btnEl.setAttribute('aria-selected', 'false');
      tabs.appendChild(btnEl);
    }

    // Panels
    for (var p = 0; p < tabDefs.length; p++) {
      var d2 = tabDefs[p];
      var panelEl = document.createElement('section');
      panelEl.id = d2.panelId;
      panelEl.className = 'mobile-panel';

      // Debtors tab: Read-only card list (Phase 3)
      if (d2.key === 'debtors') {
        var debtorCard = document.createElement('div');
        debtorCard.className = 'mobile-panel-card mobile-debtors-card';

        var debtorTitle = document.createElement('div');
        debtorTitle.className = 'mobile-panel-title';
        debtorTitle.textContent = d2.title || '채무자관리';
        debtorCard.appendChild(debtorTitle);

        var debtorList = document.createElement('div');
        debtorList.className = 'mdebtor-list';
        debtorCard.appendChild(debtorList);

        // Event delegation:
        // - Tap card: expand/collapse (allowed action)
        // - Tap today/overdue metric row: open existing Schedule Modal (read-only)
        debtorCard.addEventListener('click', function (event) {
          var rootEl = event && event.currentTarget ? event.currentTarget : null;
          var target = event && event.target ? event.target : null;
          if (!rootEl || !target) return;

          var openBtn = target.closest ? target.closest('[data-mdebtor-open]') : null;
          if (openBtn && rootEl.contains(openBtn)) {
            var mode = openBtn.getAttribute('data-mdebtor-open');
            var cardEl = openBtn.closest ? openBtn.closest('[data-mdebtor-id]') : null;
            var did = cardEl ? cardEl.getAttribute('data-mdebtor-id') : null;

            if (did) {
              var ref = findBestScheduleRefForDebtor(did, mode);
              if (ref) {
                try {
                  if (ref.kind === 'loan' && ref.loanId && App.features && App.features.debtors && typeof App.features.debtors.openLoanScheduleModal === 'function') {
                    App.features.debtors.openLoanScheduleModal(ref.loanId, ref.scheduleId, ref.due);
                    applyMobileReadonlyToScheduleModal();
                  } else if (ref.kind === 'claim' && ref.claimId && App.features && App.features.debtors && typeof App.features.debtors.openClaimScheduleModal === 'function') {
                    App.features.debtors.openClaimScheduleModal(ref.claimId, ref.scheduleId, ref.due);
                    applyMobileReadonlyToScheduleModal();
                  }
                } catch (e) {}
              }
            }
            return;
          }

          var cardEl2 = target.closest ? target.closest('[data-mdebtor-id]') : null;
          if (cardEl2 && rootEl.contains(cardEl2)) {
            var did2 = cardEl2.getAttribute('data-mdebtor-id');
            if (!did2) return;

            var expandedNow = debtorExpandedById[String(did2)] !== false;
            debtorExpandedById[String(did2)] = !expandedNow;

            if (!expandedNow) cardEl2.classList.add('is-expanded');
            else cardEl2.classList.remove('is-expanded');
          }
        });

        panelEl.appendChild(debtorCard);
        content.appendChild(panelEl);

        debtorListEl = debtorList;
        continue;
      }

      // Calendar tab: Right Panel only + focusDate UI state
      if (d2.key === 'calendar') {
        var calCard = document.createElement('div');
        calCard.className = 'mobile-panel-card mobile-calendar-card';

        var header = document.createElement('div');
        header.className = 'mcal-header';

        var navRow = document.createElement('div');
        navRow.className = 'mcal-nav-row';

        var prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'mcal-nav-btn';
        prevBtn.setAttribute('data-mcal-nav', 'prev');
        prevBtn.textContent = '◀';

        var dateLabel = document.createElement('div');
        dateLabel.className = 'mcal-date-label';
        dateLabel.textContent = focusDate + ' (' + weekdayKo(focusDate) + ')';

        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'mcal-nav-btn';
        nextBtn.setAttribute('data-mcal-nav', 'next');
        nextBtn.textContent = '▶';

        navRow.appendChild(prevBtn);
        navRow.appendChild(dateLabel);
        navRow.appendChild(nextBtn);

        var todayBtn = document.createElement('button');
        todayBtn.type = 'button';
        todayBtn.className = 'mcal-today-btn';
        todayBtn.setAttribute('data-mcal-nav', 'today');
        todayBtn.textContent = '오늘';

        header.appendChild(navRow);
        header.appendChild(todayBtn);

        var rightPanel = document.createElement('div');
        rightPanel.className = 'mcal-right-panel';

        var list = document.createElement('div');
        list.className = 'mcal-list';
        rightPanel.appendChild(list);

        calCard.appendChild(header);
        calCard.appendChild(rightPanel);

        panelEl.appendChild(calCard);
        content.appendChild(panelEl);

        // Store refs for render
        calDateLabelEl = dateLabel;
        calListEl = list;

        // Calendar interactions (buttons only; swipe is forbidden in Phase 2)
        calCard.addEventListener('click', function (e) {
          var target = e && e.target ? e.target : null;
          if (!target) return;

          var nav = target.closest ? target.closest('[data-mcal-nav]') : null;
          if (nav && calCard.contains(nav)) {
            var action = nav.getAttribute('data-mcal-nav');
            if (action === 'prev') {
              focusDate = addDaysISO(focusDate, -1);
            } else if (action === 'next') {
              focusDate = addDaysISO(focusDate, 1);
            } else if (action === 'today') {
              focusDate = todayISO();
            }
            try { mobileUI.focusDate = focusDate; } catch (e2) {}
            renderMobileCalendar();
            return;
          }

          var row = target.closest ? target.closest('[data-mschedule-id]') : null;
          if (row && calCard.contains(row)) {
            var sid = row.getAttribute('data-mschedule-id');
            var kind = row.getAttribute('data-kind');
            var loanId = row.getAttribute('data-loan-id');
            var claimId = row.getAttribute('data-claim-id');

            // Schedule Modal reuse (allowed). Read-only in Mobile Phase 2.
            try {
              if (kind === 'loan' && loanId && App.features && App.features.debtors && typeof App.features.debtors.openLoanScheduleModal === 'function') {
                App.features.debtors.openLoanScheduleModal(loanId, sid, focusDate);
                applyMobileReadonlyToScheduleModal();
              } else if (kind === 'claim' && claimId && App.features && App.features.debtors && typeof App.features.debtors.openClaimScheduleModal === 'function') {
                App.features.debtors.openClaimScheduleModal(claimId, sid, focusDate);
                applyMobileReadonlyToScheduleModal();
              }
            } catch (err) {}
            return;
          }
        });

        continue;
      }

      // Monitoring Lite tab: numeric-only dashboard (Phase 4)
      if (d2.key === 'monitoring') {
        var monCard = document.createElement('div');
        monCard.className = 'mobile-panel-card mobile-monitoring-card';

        var monTitle = document.createElement('div');
        monTitle.className = 'mobile-panel-title';
        monTitle.textContent = d2.title || 'Monitoring Lite';
        monCard.appendChild(monTitle);

        var monGrid = document.createElement('div');
        monGrid.className = 'mmon-grid';

        function buildMonKpiCard(titleText) {
          var c = document.createElement('div');
          c.className = 'mmon-kpi-card';

          var h = document.createElement('div');
          h.className = 'mmon-kpi-title';
          h.textContent = titleText;
          c.appendChild(h);

          var body = document.createElement('div');
          body.className = 'mmon-kpi-body';
          c.appendChild(body);

          function addRow(labelText) {
            var row = document.createElement('div');
            row.className = 'mmon-row';

            var l = document.createElement('div');
            l.className = 'mmon-label';
            l.textContent = labelText;

            var v = document.createElement('div');
            v.className = 'mmon-value';
            v.textContent = '--';

            row.appendChild(l);
            row.appendChild(v);
            body.appendChild(row);

            return v;
          }

          return { root: c, addRow: addRow };
        }

        var kpi1 = buildMonKpiCard('D-Day (오늘)');
        monDDayAmountEl = kpi1.addRow('오늘 납부 예정 금액');
        monDDayCountEl = kpi1.addRow('오늘 납부 채무자 수');
        monGrid.appendChild(kpi1.root);

        var kpi2 = buildMonKpiCard('미납');
        monOverdueCountEl = kpi2.addRow('미납 채무자 수');
        monOverdueAmountEl = kpi2.addRow('미납 금액 합계');
        monGrid.appendChild(kpi2.root);

        monCard.appendChild(monGrid);
        panelEl.appendChild(monCard);
        content.appendChild(panelEl);

        continue;
      }

      // Report tab: Overview KPI only (Phase 4)
      if (d2.key === 'report') {
        var repCard = document.createElement('div');
        repCard.className = 'mobile-panel-card mobile-report-card';

        var repTitle = document.createElement('div');
        repTitle.className = 'mobile-panel-title';
        repTitle.textContent = d2.title || 'Report (Overview KPI)';
        repCard.appendChild(repTitle);

        var repGrid = document.createElement('div');
        repGrid.className = 'mrep-grid';

        function addRepRow(labelText) {
          var row = document.createElement('div');
          row.className = 'mrep-kpi';

          var l = document.createElement('div');
          l.className = 'mrep-label';
          l.textContent = labelText;

          var v = document.createElement('div');
          v.className = 'mrep-value';
          v.textContent = '--';

          row.appendChild(l);
          row.appendChild(v);
          repGrid.appendChild(row);
          return v;
        }

        repDebtTotalEl = addRepRow('총 채무금액');
        repDebtPaidEl = addRepRow('채무상환금');
        repDebtOverdueEl = addRepRow('채무미납금');
        repRepayRateEl = addRepRow('상환율');

        repCard.appendChild(repGrid);
        panelEl.appendChild(repCard);
        content.appendChild(panelEl);

        continue;
      }

      // Default panels: placeholders only (Phase 1/2 scope)
      var card = document.createElement('div');
      card.className = 'mobile-panel-card';

      var title = document.createElement('div');
      title.className = 'mobile-panel-title';
      title.textContent = d2.title;
      card.appendChild(title);

      var ph = document.createElement('div');
      ph.className = 'mobile-placeholder';
      ph.textContent = '준비중';
      card.appendChild(ph);

      panelEl.appendChild(card);
      content.appendChild(panelEl);
    }

    tabs.addEventListener('click', function (e) {
      var target = e && e.target ? e.target : null;
      if (!target) return;
      var btn = target.closest ? target.closest('[data-mtab]') : null;
      if (!btn) return;
      var key = btn.getAttribute('data-mtab');
      if (!key) return;
      setActiveTab(key);
    });

    // Default tab: 채무자관리
    setActiveTab('debtors');

    return root;
  }

  function mountMobileShell() {
    ensureMobileCss(true);

    if (mobileEl && mobileEl.parentNode) {
      mobileEl.parentNode.removeChild(mobileEl);
    }
    mobileEl = buildMobileShell();

    // Insert Mobile Shell where Desktop .app used to be, if known.
    ensureDesktopDOMCaptured();
    if (desktopDOM.appParent) {
      if (desktopDOM.appNextSibling && desktopDOM.appNextSibling.parentNode === desktopDOM.appParent) {
        desktopDOM.appParent.insertBefore(mobileEl, desktopDOM.appNextSibling);
      } else {
        desktopDOM.appParent.appendChild(mobileEl);
      }
    } else {
      document.body.appendChild(mobileEl);
    }

    // Policy (Phase 5): On mode transition, reset Mobile scroll positions to top.
    try {
      var sc = mobileEl && mobileEl.querySelector ? mobileEl.querySelector('.mobile-content') : null;
      if (sc) sc.scrollTop = 0;
    } catch (e) {}
  }

  function unmountMobileShell() {
    ensureMobileCss(false);
    var el = mobileEl || document.getElementById('mobile-shell');
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
    mobileEl = null;
  }

  // Desktop init (original behavior preserved)
  function startDesktopOnce() {
    if (desktopStarted) {
      // Re-enable Desktop global listeners if they were paused.
      try {
        if (App.auth && typeof App.auth.resume === 'function') {
          App.auth.resume();
        }
      } catch (e) {}
      try {
        if (App.ui && App.ui.debtorBack && typeof App.ui.debtorBack.init === 'function') {
          App.ui.debtorBack.init();
        }
      } catch (e2) {}
      return;
    }
    desktopStarted = true;

    if (App.ui && App.ui.layout && App.ui.layout.init) {
      App.ui.layout.init();
    }
    if (App.ui && App.ui.events && App.ui.events.init) {
      App.ui.events.init();
    }
    if (App.features && App.features.debtors && App.features.debtors.init) {
      App.features.debtors.init();
    }
    if (App.features && App.features.calendar && App.features.calendar.init) {
      App.features.calendar.init();
    }
    if (App.features && App.features.monitoring && App.features.monitoring.init) {
      App.features.monitoring.init();
    }
    if (App.features && App.features.report && App.features.report.init) {
      App.features.report.init();
    }

    // Desktop-only DOM helpers that were historically auto-wired.
    try {
      if (App.debtorPanel && typeof App.debtorPanel.init === 'function') {
        App.debtorPanel.init();
      }
    } catch (e3) {}
    try {
      if (App.debtors && typeof App.debtors.initDom === 'function') {
        App.debtors.initDom();
      }
    } catch (e4) {}
    try {
      if (App.ui && App.ui.debtorBack && typeof App.ui.debtorBack.init === 'function') {
        App.ui.debtorBack.init();
      }
    } catch (e5) {}

    if (App.auth && typeof App.auth.activate === 'function') {
      App.auth.activate();
    } else if (App.auth && App.auth.init) {
      App.auth.init();
    }

    // Save / Load button bindings
    var localSaveBtn = document.getElementById('local-save-btn');
    if (localSaveBtn && App.local && typeof App.local.save === 'function') {
      localSaveBtn.addEventListener('click', function () {
        App.local.save();
      });
    }

    var localLoadTrigger = document.getElementById('local-load-trigger');
    var localLoadInput = document.getElementById('local-load-file');
    if (localLoadTrigger && localLoadInput && App.local && typeof App.local.load === 'function') {
      localLoadTrigger.addEventListener('click', function () {
        localLoadInput.click();
      });
      localLoadInput.addEventListener('change', function (e) {
        var files = e.target && e.target.files ? e.target.files : null;
        if (files && files.length) {
          App.local.load(files[0]);
        }
      });
    }

    var cloudSaveBtn = document.getElementById('cloud-save-btn');
    if (cloudSaveBtn && App.data && typeof App.data.saveToSupabase === 'function') {
      cloudSaveBtn.addEventListener('click', function () {
        App.data.saveToSupabase();
      });
    }

    var cloudLoadBtn = document.getElementById('cloud-load-btn');
    if (cloudLoadBtn && App.data && typeof App.data.loadAllFromSupabase === 'function') {
      cloudLoadBtn.addEventListener('click', function () {
        App.data.loadAllFromSupabase();
      });
    }
  }

  function stopDesktopGlobalListeners() {
    // Close modals first to detach modal key handlers.
    closeAllModals();

    // Disable Desktop-level document listeners that would otherwise run in Mobile mode.
    try {
      if (App.auth && typeof App.auth.deactivate === 'function') {
        App.auth.deactivate();
      }
    } catch (e) {}

    try {
      if (App.ui && App.ui.debtorBack && typeof App.ui.debtorBack.destroy === 'function') {
        App.ui.debtorBack.destroy();
      }
    } catch (e2) {}
  }

  function decideNextMode(width) {
    if (currentMode === DESKTOP) {
      return width <= phase1Cfg.enterMaxWidth ? MOBILE : DESKTOP;
    }
    // current is mobile
    return width >= phase1Cfg.exitMinWidth ? DESKTOP : MOBILE;
  }

  function applyMode(nextMode, reason) {
    if (nextMode === currentMode) return;

    var t = nowMs();
    if (t - lastSwitchAt < phase1Cfg.switchCooldownMs) {
      return;
    }
    lastSwitchAt = t;

    // Policy: on any mode transition, close all open modals.
    closeAllModals();

    // UX policy (Phase 5): clear focus to avoid stuck inputs / soft keyboard artifacts.
    try {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    } catch (eFocus) {}

    // Hide toast on transitions to prevent stale messages.
    try {
      var toastEl = document.getElementById('toast');
      if (toastEl) toastEl.classList.remove('show');
    } catch (eToast) {}

    if (nextMode === MOBILE) {
      // Desktop → Mobile
      enableMobileCapabilityGuard();
      stopDesktopGlobalListeners();
      unmountDesktopDOM();
      mountMobileShell();
    } else {
      // Mobile → Desktop
      disableMobileCapabilityGuard();
      unmountMobileShell();
      mountDesktopDOM();
      startDesktopOnce();
    }

    currentMode = nextMode;
    setRuntimeMode(nextMode);

    try {
      if (reason) {
        // no-op; reserved for verification/debug
      }
    } catch (e) {}
  }

  function scheduleEvaluate(reason) {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    pendingTimer = setTimeout(function () {
      pendingTimer = null;
      var w = getViewportWidth();
      var next = decideNextMode(w);
      applyMode(next, reason || 'resize');
    }, phase1Cfg.resizeDebounceMs);
  }

  function initModeSwitcher() {
    // Initial mount based on initial runtime mode/width.
    var w = getViewportWidth();
    currentMode = (App.runtime && App.runtime.mode) ? App.runtime.mode : (w <= phase1Cfg.enterMaxWidth ? MOBILE : DESKTOP);
    setRuntimeMode(currentMode);

    if (currentMode === MOBILE) {
      // Ensure Desktop does not initialize.
      enableMobileCapabilityGuard();
      stopDesktopGlobalListeners();
      unmountDesktopDOM();
      mountMobileShell();
    } else {
      disableMobileCapabilityGuard();
      startDesktopOnce();
    }

    // Listen for viewport changes
    window.addEventListener('resize', function () {
      scheduleEvaluate('resize');
    });

    window.addEventListener('orientationchange', function () {
      scheduleEvaluate('orientationchange');
    });
  }

  function bootstrap() {
    initModeSwitcher();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})(window, document);
