(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  App.ui = App.ui || {};

  function clearChildren(el) {
    if (!el) return;
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function buildDebtorNameIndex() {
    var map = Object.create(null);
    var state = App.state || {};
    var debtors = Array.isArray(state.debtors) ? state.debtors : [];
    for (var i = 0; i < debtors.length; i++) {
      var d = debtors[i];
      if (!d) continue;
      var id = (d.id != null) ? String(d.id) : '';
      if (!id) continue;
      map[id] = d.name || d.title || '';
    }
    return map;
  }

  function safeText(v) {
    if (v == null) return '';
    return String(v);
  }

  function parseDateMs(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.getTime();
  }

  function parseDateStartMs(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function parseDateEndMs(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  function formatDateSafe(v) {
    if (!v) return '';
    if (App.util && typeof App.util.formatDate === 'function') {
      return App.util.formatDate(v);
    }
    // Fallback: keep raw string
    return safeText(v);
  }

  function formatCurrencySafe(v) {
    if (App.util && typeof App.util.formatCurrency === 'function') {
      return App.util.formatCurrency(v);
    }
    var n = Number(v) || 0;
    return safeText(n);
  }

  function collectOperationLogs() {
    var state = App.state || {};
    var debtorsById = buildDebtorNameIndex();

    var logs = [];
    var loans = Array.isArray(state.loans) ? state.loans : [];
    var claims = Array.isArray(state.claims) ? state.claims : [];

    for (var i = 0; i < loans.length; i++) {
      var loan = loans[i];
      if (!loan) continue;

      var debtorId = (loan.debtorId != null) ? String(loan.debtorId) : '';
      var debtorName = loan.debtorName || (debtorId && debtorsById[debtorId]) || '';

      var eventDate = loan.startDate || loan.createdAt || '';
      var logDate = loan.createdAt || loan.startDate || '';

      var amount = Number(loan.totalRepayAmount || loan.principal || 0) || 0;

      logs.push({
        kind: 'loan',
        typeLabel: '대출',
        debtorId: debtorId,
        debtorName: debtorName,
        amount: amount,
        eventDate: eventDate,
        logDate: logDate,
        logDateMs: parseDateMs(logDate)
      });
    }

    for (var j = 0; j < claims.length; j++) {
      var claim = claims[j];
      if (!claim) continue;

      var debtorId2 = (claim.debtorId != null) ? String(claim.debtorId) : '';
      var debtorName2 = claim.debtorName || (debtorId2 && debtorsById[debtorId2]) || '';

      var eventDate2 = claim.startDate || claim.createdAt || '';
      var logDate2 = claim.createdAt || claim.startDate || '';

      var amount2 = Number(claim.amount || 0) || 0;

      logs.push({
        kind: 'claim',
        typeLabel: '채권',
        debtorId: debtorId2,
        debtorName: debtorName2,
        amount: amount2,
        eventDate: eventDate2,
        logDate: logDate2,
        logDateMs: parseDateMs(logDate2)
      });
    }

    return logs;
  }

  function collectMonitorTargets() {
    var data = App.data || {};
    var derivedDebtors = Array.isArray(data.debtors) ? data.debtors : [];
    var debtorsById = buildDebtorNameIndex();

    // Build alive-kind index from schedules (read-only).
    // This is used ONLY to decide whether a debtor has alive loan/claim schedules,
    // while alive/overdue classification itself must reuse existing derived flags
    // (hasAliveSchedule / hasOverdueSchedule).
    var schedules = [];
    if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      try {
        schedules = App.schedulesEngine.getAll() || [];
      } catch (e) {
        schedules = [];
      }
    } else if (App.state && Array.isArray(App.state.schedules)) {
      schedules = App.state.schedules;
    }

    var aliveKindByDebtor = Object.create(null);

    for (var i = 0; i < schedules.length; i++) {
      var sc = schedules[i];
      if (!sc || sc.debtorId == null) continue;

      var kind = String(sc.kind || '').toLowerCase();
      if (!kind) {
        if (sc.loanId != null) kind = 'loan';
        else if (sc.claimId != null) kind = 'claim';
      }
      if (kind !== 'loan' && kind !== 'claim') continue;

      var status = String(sc.status || '').toUpperCase();
      if (status === 'PAID') continue;

      var did = String(sc.debtorId);
      if (!aliveKindByDebtor[did]) {
        aliveKindByDebtor[did] = { loan: false, claim: false };
      }
      aliveKindByDebtor[did][kind] = true;
    }

    var items = [];
    for (var dIdx = 0; dIdx < derivedDebtors.length; dIdx++) {
      var d = derivedDebtors[dIdx];
      if (!d || d.id == null) continue;

      var debtorId = String(d.id);
      var hasAlive = !!d.hasAliveSchedule;
      if (!hasAlive) continue;

      var debtorName = d.name || (debtorsById[debtorId] || '');
      var isOverdue = !!d.hasOverdueSchedule;
      var statusKey = isOverdue ? 'overdue' : 'normal';

      var kindFlags = aliveKindByDebtor[debtorId] || null;
      var hasLoanAlive = kindFlags ? !!kindFlags.loan : false;
      var hasClaimAlive = kindFlags ? !!kindFlags.claim : false;

      // Fallback only when schedules are unavailable.
      if (!hasLoanAlive && !hasClaimAlive) {
        // v3.2.8: App.data.debtors no longer carries loans/claims arrays.
        // Use derived counters only.
        hasLoanAlive = !!d.loanCount;
        hasClaimAlive = !!d.claimCount;
      }

      if (hasLoanAlive) {
        items.push({
          kind: 'loan',
          typeLabel: '대출',
          debtorId: debtorId,
          debtorName: debtorName,
          status: statusKey
        });
      }
      if (hasClaimAlive) {
        items.push({
          kind: 'claim',
          typeLabel: '채권',
          debtorId: debtorId,
          debtorName: debtorName,
          status: statusKey
        });
      }
    }

    return items;
  }

  function renderLogList(listRoot, logs) {
    if (!listRoot) return;
    clearChildren(listRoot);

    if (!logs || !logs.length) {
      var empty = document.createElement('div');
      empty.className = 'operation-log-empty';
      empty.textContent = '표시할 로그가 없습니다.';
      listRoot.appendChild(empty);
      return;
    }

    for (var i = 0; i < logs.length; i++) {
      var log = logs[i];
      var item = document.createElement('div');
      item.className = 'operation-log-item';

      var top = document.createElement('div');
      top.className = 'operation-log-row operation-log-row-top';

      var badge = document.createElement('span');
      badge.className = 'operation-log-type' + (log && log.kind === 'claim' ? ' is-claim' : ' is-loan');
      badge.textContent = (log && log.typeLabel) ? log.typeLabel : '';

      var debtor = document.createElement('span');
      debtor.className = 'operation-log-debtor';
      debtor.textContent = (log && log.debtorName) ? log.debtorName : (log && log.debtorId ? ('ID ' + log.debtorId) : '알 수 없음');

      var amount = document.createElement('span');
      amount.className = 'operation-log-amount';
      amount.textContent = formatCurrencySafe(log ? log.amount : 0);

      top.appendChild(badge);
      top.appendChild(debtor);
      top.appendChild(amount);

      var bottom = document.createElement('div');
      bottom.className = 'operation-log-row operation-log-row-bottom';

      var eventLabel = document.createElement('span');
      eventLabel.className = 'operation-log-meta-label';
      eventLabel.textContent = (log && log.kind === 'claim') ? '발생일' : '실행일';

      var eventValue = document.createElement('span');
      eventValue.className = 'operation-log-meta-value';
      eventValue.textContent = formatDateSafe(log ? log.eventDate : '');

      var sep = document.createElement('span');
      sep.className = 'operation-log-meta-sep';
      sep.textContent = '•';

      var logLabel = document.createElement('span');
      logLabel.className = 'operation-log-meta-label';
      logLabel.textContent = '기준';

      var logValue = document.createElement('span');
      logValue.className = 'operation-log-meta-value';
      logValue.textContent = formatDateSafe(log ? log.logDate : '');

      bottom.appendChild(eventLabel);
      bottom.appendChild(eventValue);
      bottom.appendChild(sep);
      bottom.appendChild(logLabel);
      bottom.appendChild(logValue);

      item.appendChild(top);
      item.appendChild(bottom);

      listRoot.appendChild(item);
    }
  }

  function renderMonitorGrid(gridRoot, items, opts) {
    opts = opts || {};
    var onSelectDebtor = opts.onSelectDebtor;

    if (!gridRoot) return;
    clearChildren(gridRoot);

    if (!items || !items.length) {
      var empty = document.createElement('div');
      empty.className = 'monitor-empty';
      empty.textContent = '표시할 대상이 없습니다.';
      gridRoot.appendChild(empty);
      return;
    }

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it) continue;

      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'monitor-card';
      if (it.debtorId != null) {
        card.setAttribute('data-debtor-id', String(it.debtorId));
      }
      if (it.kind) {
        card.setAttribute('data-kind', String(it.kind));
      }

      var top = document.createElement('div');
      top.className = 'monitor-card-top';

      var typeBadge = document.createElement('span');
      typeBadge.className = 'monitor-type' + (it.kind === 'claim' ? ' is-claim' : ' is-loan');
      typeBadge.textContent = it.typeLabel || '';

      var statusBadge = document.createElement('span');
      var isOverdue = it.status === 'overdue';
      statusBadge.className = 'monitor-status' + (isOverdue ? ' is-overdue' : ' is-normal');
      statusBadge.textContent = isOverdue ? '연체' : '정상';

      top.appendChild(typeBadge);
      top.appendChild(statusBadge);

      var name = document.createElement('div');
      name.className = 'monitor-debtor-name';
      name.textContent = it.debtorName ? String(it.debtorName) : (it.debtorId ? ('ID ' + it.debtorId) : '알 수 없음');

      card.appendChild(top);
      card.appendChild(name);

      (function (debtorId) {
        card.addEventListener('click', function () {
          if (!debtorId) return;
          if (typeof onSelectDebtor === 'function') {
            onSelectDebtor(String(debtorId));
          }
        });
      })(it.debtorId);

      gridRoot.appendChild(card);
    }
  }

  function renderMonitorSections(params) {
    if (!params) return;
    renderMonitorGrid(params.overdueGrid, params.overdueItems, { onSelectDebtor: params.onSelectDebtor });
    renderMonitorGrid(params.normalGrid, params.normalItems, { onSelectDebtor: params.onSelectDebtor });
  }

  function createMonitorController(params) {
    params = params || {};
    var baseItems = Array.isArray(params.baseItems) ? params.baseItems : [];

    var state = {
      type: 'all'
    };

    function filterAndGroup() {
      var overdue = [];
      var normal = [];

      for (var i = 0; i < baseItems.length; i++) {
        var it = baseItems[i];
        if (!it) continue;
        if (state.type !== 'all' && it.kind !== state.type) continue;

        if (it.status === 'overdue') overdue.push(it);
        else normal.push(it);
      }

      return { overdue: overdue, normal: normal };
    }

    function apply() {
      if (typeof params.renderFn !== 'function') return;
      var g = filterAndGroup();
      params.renderFn({
        overdueGrid: params.overdueGrid,
        normalGrid: params.normalGrid,
        overdueItems: g.overdue,
        normalItems: g.normal,
        onSelectDebtor: params.onSelectDebtor
      });
    }

    function setType(type) {
      state.type = type || 'all';
      apply();
    }

    function reset(nextBaseItems) {
      if (Array.isArray(nextBaseItems)) {
        baseItems = nextBaseItems;
      }
      state.type = 'all';
      apply();
    }

    return {
      apply: apply,
      setType: setType,
      reset: reset,
      getState: function () { return state; }
    };
  }

  function createLogController(params) {
    params = params || {};
    var baseLogs = Array.isArray(params.baseLogs) ? params.baseLogs : [];
    var listRoot = params.listRoot;
    var renderFn = params.renderFn;

    var state = {
      from: '',
      to: '',
      type: 'all',
      sortDir: 'desc'
    };

    function filterAndSort() {
      var fromMs = parseDateStartMs(state.from);
      var toMs = parseDateEndMs(state.to);

      var out = [];
      for (var i = 0; i < baseLogs.length; i++) {
        var log = baseLogs[i];
        if (!log) continue;

        if (state.type !== 'all' && log.kind !== state.type) continue;

        if (fromMs != null || toMs != null) {
          var t = (log.logDateMs != null) ? log.logDateMs : parseDateMs(log.logDate);
          if (t == null) continue;
          if (fromMs != null && t < fromMs) continue;
          if (toMs != null && t > toMs) continue;
        }

        out.push(log);
      }

      out.sort(function (a, b) {
        var at = (a && a.logDateMs != null) ? a.logDateMs : parseDateMs(a && a.logDate);
        var bt = (b && b.logDateMs != null) ? b.logDateMs : parseDateMs(b && b.logDate);
        at = (at != null) ? at : 0;
        bt = (bt != null) ? bt : 0;
        return state.sortDir === 'asc' ? (at - bt) : (bt - at);
      });

      return out;
    }

    function apply() {
      if (typeof renderFn !== 'function') return;
      renderFn(listRoot, filterAndSort());
    }

    function setPeriod(from, to) {
      state.from = from || '';
      state.to = to || '';
      apply();
    }

    function setType(type) {
      state.type = type || 'all';
      apply();
    }

    function setSortDir(dir) {
      state.sortDir = (dir === 'asc') ? 'asc' : 'desc';
      apply();
    }

    function toggleSortDir() {
      state.sortDir = (state.sortDir === 'asc') ? 'desc' : 'asc';
      apply();
      return state.sortDir;
    }

    function reset(nextBaseLogs) {
      if (Array.isArray(nextBaseLogs)) {
        baseLogs = nextBaseLogs;
      }
      state.from = '';
      state.to = '';
      state.type = 'all';
      state.sortDir = 'desc';
      apply();
    }

    return {
      apply: apply,
      setPeriod: setPeriod,
      setType: setType,
      setSortDir: setSortDir,
      toggleSortDir: toggleSortDir,
      reset: reset,
      getState: function () { return state; }
    };
  }

  function buildOperationModalDOM(refs, getController, getMonitorController) {
    var root = document.createElement('div');
    root.id = 'operation-modal-root';
    root.className = 'modal operation-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');

    // Header
    var header = document.createElement('div');
    header.className = 'modal-header';

    var title = document.createElement('div');
    title.className = 'modal-title';
    title.textContent = '운영현황';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close';
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.textContent = '×';

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Tabs
    var tabs = document.createElement('div');
    tabs.className = 'modal-tabs';

    var logBtn = document.createElement('button');
    logBtn.type = 'button';
    logBtn.setAttribute('data-tab', 'log');
    logBtn.className = 'operation-tab-btn is-active';
    logBtn.textContent = '로그';

    var monitorBtn = document.createElement('button');
    monitorBtn.type = 'button';
    monitorBtn.setAttribute('data-tab', 'monitor');
    monitorBtn.className = 'operation-tab-btn';
    monitorBtn.textContent = '관제';

    tabs.appendChild(logBtn);
    tabs.appendChild(monitorBtn);

    // Body
    var body = document.createElement('div');
    body.className = 'modal-body';

    // Log View
    var logView = document.createElement('div');
    logView.className = 'tab-view log-view';

    var toolbar = document.createElement('div');
    toolbar.className = 'log-toolbar';

    // Period filter
    var periodGroup = document.createElement('div');
    periodGroup.className = 'log-filter-group log-filter-period';

    var periodLabel = document.createElement('div');
    periodLabel.className = 'log-filter-label';
    periodLabel.textContent = '기간';

    var fromInput = document.createElement('input');
    fromInput.type = 'date';
    fromInput.className = 'log-filter-input log-filter-from';

    var toInput = document.createElement('input');
    toInput.type = 'date';
    toInput.className = 'log-filter-input log-filter-to';

    var periodSep = document.createElement('span');
    periodSep.className = 'log-filter-sep';
    periodSep.textContent = '~';

    var periodControls = document.createElement('div');
    periodControls.className = 'log-filter-controls';
    periodControls.appendChild(fromInput);
    periodControls.appendChild(periodSep);
    periodControls.appendChild(toInput);

    periodGroup.appendChild(periodLabel);
    periodGroup.appendChild(periodControls);

    // Type filter
    var typeGroup = document.createElement('div');
    typeGroup.className = 'log-filter-group log-filter-type';

    var typeLabel = document.createElement('div');
    typeLabel.className = 'log-filter-label';
    typeLabel.textContent = '유형';

    var typeSelect = document.createElement('select');
    typeSelect.className = 'log-filter-select';

    function addOption(value, labelText) {
      var opt = document.createElement('option');
      opt.value = value;
      opt.textContent = labelText;
      typeSelect.appendChild(opt);
    }
    addOption('all', '전체');
    addOption('loan', '대출');
    addOption('claim', '채권');

    typeGroup.appendChild(typeLabel);
    typeGroup.appendChild(typeSelect);

    // Sort toggle
    var sortGroup = document.createElement('div');
    sortGroup.className = 'log-filter-group log-filter-sort';

    var sortLabel = document.createElement('div');
    sortLabel.className = 'log-filter-label';
    sortLabel.textContent = '정렬';

    var sortBtn = document.createElement('button');
    sortBtn.type = 'button';
    sortBtn.className = 'log-sort-toggle';
    sortBtn.textContent = '날짜 DESC';

    sortGroup.appendChild(sortLabel);
    sortGroup.appendChild(sortBtn);

    toolbar.appendChild(periodGroup);
    toolbar.appendChild(typeGroup);
    toolbar.appendChild(sortGroup);

    var listRoot = document.createElement('div');
    listRoot.className = 'log-list-root';

    logView.appendChild(toolbar);
    logView.appendChild(listRoot);

    // Monitor View
    var monitorView = document.createElement('div');
    monitorView.className = 'tab-view monitor-view';
    monitorView.style.display = 'none';

    var monitorToolbar = document.createElement('div');
    monitorToolbar.className = 'monitor-toolbar';

    var monitorTypeGroup = document.createElement('div');
    monitorTypeGroup.className = 'monitor-filter-group monitor-filter-type';

    var monitorTypeLabel = document.createElement('div');
    monitorTypeLabel.className = 'monitor-filter-label';
    monitorTypeLabel.textContent = '유형';

    var monitorTypeSelect = document.createElement('select');
    monitorTypeSelect.className = 'monitor-filter-select';

    function addMonitorOption(value, labelText) {
      var opt = document.createElement('option');
      opt.value = value;
      opt.textContent = labelText;
      monitorTypeSelect.appendChild(opt);
    }
    addMonitorOption('all', '전체');
    addMonitorOption('loan', '대출');
    addMonitorOption('claim', '채권');

    monitorTypeGroup.appendChild(monitorTypeLabel);
    monitorTypeGroup.appendChild(monitorTypeSelect);
    monitorToolbar.appendChild(monitorTypeGroup);

    var monitorSections = document.createElement('div');
    monitorSections.className = 'monitor-sections';

    var overdueSection = document.createElement('div');
    overdueSection.className = 'monitor-section overdue';

    var overdueHeader = document.createElement('div');
    overdueHeader.className = 'section-header';
    overdueHeader.textContent = '연체 중';

    var overdueGrid = document.createElement('div');
    overdueGrid.className = 'monitor-grid';

    overdueSection.appendChild(overdueHeader);
    overdueSection.appendChild(overdueGrid);

    var normalSection = document.createElement('div');
    normalSection.className = 'monitor-section normal';

    var normalHeader = document.createElement('div');
    normalHeader.className = 'section-header';
    normalHeader.textContent = '정상';

    var normalGrid = document.createElement('div');
    normalGrid.className = 'monitor-grid';

    normalSection.appendChild(normalHeader);
    normalSection.appendChild(normalGrid);

    monitorSections.appendChild(overdueSection);
    monitorSections.appendChild(normalSection);

    monitorView.appendChild(monitorToolbar);
    monitorView.appendChild(monitorSections);

    body.appendChild(logView);
    body.appendChild(monitorView);

    root.appendChild(header);
    root.appendChild(tabs);
    root.appendChild(body);

    // Refs
    refs.root = root;
    refs.closeBtn = closeBtn;
    refs.logTabBtn = logBtn;
    refs.monitorTabBtn = monitorBtn;
    refs.logView = logView;
    refs.monitorView = monitorView;
    refs.fromInput = fromInput;
    refs.toInput = toInput;
    refs.typeSelect = typeSelect;
    refs.sortBtn = sortBtn;
    refs.listRoot = listRoot;
    refs.monitorTypeSelect = monitorTypeSelect;
    refs.monitorOverdueGrid = overdueGrid;
    refs.monitorNormalGrid = normalGrid;

    function setActiveTab(tab) {
      var isLog = tab === 'log';

      if (refs.logTabBtn) {
        if (isLog) refs.logTabBtn.classList.add('is-active');
        else refs.logTabBtn.classList.remove('is-active');
      }
      if (refs.monitorTabBtn) {
        if (!isLog) refs.monitorTabBtn.classList.add('is-active');
        else refs.monitorTabBtn.classList.remove('is-active');
      }

      if (refs.logView) refs.logView.style.display = isLog ? '' : 'none';
      if (refs.monitorView) refs.monitorView.style.display = isLog ? 'none' : '';
    }

    // Tab events: show/hide only (NO data recompute)
    logBtn.addEventListener('click', function () { setActiveTab('log'); });
    monitorBtn.addEventListener('click', function () { setActiveTab('monitor'); });

    // Toolbar events: emit to controller only
    fromInput.addEventListener('change', function () {
      var c = getController();
      if (!c) return;
      c.setPeriod(fromInput.value, toInput.value);
    });
    toInput.addEventListener('change', function () {
      var c = getController();
      if (!c) return;
      c.setPeriod(fromInput.value, toInput.value);
    });
    typeSelect.addEventListener('change', function () {
      var c = getController();
      if (!c) return;
      c.setType(typeSelect.value);
    });
    sortBtn.addEventListener('click', function () {
      var c = getController();
      if (!c) return;
      var dir = c.toggleSortDir();
      sortBtn.textContent = dir === 'asc' ? '날짜 ASC' : '날짜 DESC';
    });

    // Monitor toolbar events: emit to monitor controller only
    monitorTypeSelect.addEventListener('change', function () {
      if (typeof getMonitorController !== 'function') return;
      var mc = getMonitorController();
      if (!mc) return;
      mc.setType(monitorTypeSelect.value);
    });

    // Default tab is log
    setActiveTab('log');

    return root;
  }

  // Modal runtime state (module-scoped, not persisted to App.state)
  var modalRefs = {
    backdrop: null,
    root: null,
    closeBtn: null,
    logTabBtn: null,
    monitorTabBtn: null,
    logView: null,
    monitorView: null,
    fromInput: null,
    toInput: null,
    typeSelect: null,
    sortBtn: null,
    listRoot: null,
    monitorTypeSelect: null,
    monitorOverdueGrid: null,
    monitorNormalGrid: null
  };

  var controller = null;
  var monitorController = null;
  var escListenerAttached = false;

  function attachEscListener() {
    if (escListenerAttached) return;
    escListenerAttached = true;
    document.addEventListener('keydown', onKeyDown);
  }

  function detachEscListener() {
    if (!escListenerAttached) return;
    escListenerAttached = false;
    document.removeEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (!e) return;
    var key = e.key || e.keyCode;
    if (key === 'Escape' || key === 'Esc' || key === 27) {
      close();
    }
  }

  function close() {
    var host = document.getElementById('modal-root');
    if (modalRefs.backdrop && host && modalRefs.backdrop.parentNode === host) {
      host.removeChild(modalRefs.backdrop);
    }
    modalRefs.backdrop = null;
    modalRefs.root = null;
    modalRefs.closeBtn = null;
    modalRefs.logTabBtn = null;
    modalRefs.monitorTabBtn = null;
    modalRefs.logView = null;
    modalRefs.monitorView = null;
    modalRefs.fromInput = null;
    modalRefs.toInput = null;
    modalRefs.typeSelect = null;
    modalRefs.sortBtn = null;
    modalRefs.listRoot = null;
    modalRefs.monitorTypeSelect = null;
    modalRefs.monitorOverdueGrid = null;
    modalRefs.monitorNormalGrid = null;

    controller = null;
    monitorController = null;
    detachEscListener();
  }

  function open() {
    var host = document.getElementById('modal-root');
    if (!host) return;

    // Ensure single instance
    close();

    // Backdrop
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop operation-modal-backdrop';
    backdrop.setAttribute('data-operation-modal-backdrop', '1');

    // Click outside to close
    backdrop.addEventListener('click', function (e) {
      if (!e) return;
      if (e.target === backdrop) {
        close();
      }
    });

    modalRefs.backdrop = backdrop;

    // Build modal
    var modal = buildOperationModalDOM(
      modalRefs,
      function () { return controller; },
      function () { return monitorController; }
    );
    backdrop.appendChild(modal);
    host.appendChild(backdrop);

    // Close button
    if (modalRefs.closeBtn) {
      modalRefs.closeBtn.addEventListener('click', function () { close(); });
    }

    // Initialize controller + first render (default: date DESC)
    var baseLogs = collectOperationLogs();
    controller = createLogController({
      baseLogs: baseLogs,
      listRoot: modalRefs.listRoot,
      renderFn: renderLogList
    });

    // Reset controls to defaults
    if (modalRefs.fromInput) modalRefs.fromInput.value = '';
    if (modalRefs.toInput) modalRefs.toInput.value = '';
    if (modalRefs.typeSelect) modalRefs.typeSelect.value = 'all';
    if (modalRefs.sortBtn) modalRefs.sortBtn.textContent = '날짜 DESC';

    controller.reset(baseLogs);

    // Initialize Monitor controller + first render (read-only)
    var baseMonitorItems = collectMonitorTargets();
    monitorController = createMonitorController({
      baseItems: baseMonitorItems,
      overdueGrid: modalRefs.monitorOverdueGrid,
      normalGrid: modalRefs.monitorNormalGrid,
      renderFn: renderMonitorSections,
      onSelectDebtor: function (debtorId) {
        if (!debtorId) return;
        close();
        if (App.api && App.api.view && typeof App.api.view.openDebtorDetail === 'function') {
          App.api.view.openDebtorDetail(debtorId);
          return;
        }
        if (App.debtorDetail && typeof App.debtorDetail.render === 'function') {
          App.debtorDetail.render(debtorId);
        }
      }
    });

    if (modalRefs.monitorTypeSelect) {
      modalRefs.monitorTypeSelect.value = 'all';
    }
    if (monitorController) {
      monitorController.reset(baseMonitorItems);
    }

    attachEscListener();
  }

  App.ui.operationModal = {
    open: open,
    close: close
  };
})(window, document);
