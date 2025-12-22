(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  App.ui = App.ui || {};

  function pad2(n) {
    n = Number(n) || 0;
    return n < 10 ? '0' + n : String(n);
  }

  function todayISODate() {
    if (App.util && typeof App.util.todayISODate === 'function') {
      return App.util.todayISODate();
    }
    var d = new Date();
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function toLocalDayMs(isoDate) {
    if (!isoDate) return NaN;
    if (typeof isoDate !== 'string') return NaN;
    var parts = String(isoDate).slice(0, 10).split('-');
    if (parts.length !== 3) return NaN;
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var d = Number(parts[2]);
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return NaN;
    return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  }

  function toISOFromDate(d) {
    if (!d || Object.prototype.toString.call(d) !== '[object Date]') return '';
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function addDays(isoDate, deltaDays) {
    var ms = toLocalDayMs(isoDate);
    if (!isFinite(ms)) return '';
    var d = new Date(ms);
    d.setDate(d.getDate() + (Number(deltaDays) || 0));
    return toISOFromDate(d);
  }

  function safeNumber(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function formatCurrency(n) {
    var util = App.util || {};
    if (util && typeof util.formatCurrency === 'function') {
      return util.formatCurrency(n || 0);
    }
    var x = safeNumber(n);
    try {
      return x.toLocaleString('ko-KR');
    } catch (e) {
      return String(x);
    }
  }

  function formatSignedCurrency(n) {
    var x = safeNumber(n);
    var sign = x > 0 ? '+' : (x < 0 ? '-' : '');
    var abs = x < 0 ? -x : x;
    return sign + formatCurrency(abs);
  }

  function clearNode(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function toKey(v) {
    return v != null ? String(v) : '';
  }

  function buildIdMap(list) {
    var map = Object.create(null);
    if (!Array.isArray(list)) return map;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it) continue;
      if (it.id == null) continue;
      var key = String(it.id);
      if (!key) continue;
      map[key] = it;
    }
    return map;
  }

  function getAllSchedulesForLookup() {
    if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      return App.schedulesEngine.getAll() || [];
    }
    var st = App.state || {};
    return Array.isArray(st.schedules) ? st.schedules : [];
  }

  function defaultTitleByType(type, title) {
    if (title) return title;
    if (type === 'INIT') return '초기자본';
    if (type === 'AUTO_OUT') return '대출 실행';
    if (type === 'AUTO_IN') return '대출상환';
    if (type === 'AUTO_ADJUST') return '상환 정정';
    if (type === 'MANUAL_IN') return '수동 유입';
    if (type === 'MANUAL_OUT') return '수동 유출';
    return '';
  }

  function resolveDebtorName(row, maps) {
    maps = maps || {};
    var debtorMap = maps.debtorMap || Object.create(null);
    var loanMap = maps.loanMap || Object.create(null);
    var claimMap = maps.claimMap || Object.create(null);
    var scheduleMap = maps.scheduleMap || Object.create(null);

    var debtorId = toKey(row && row.debtorId);

    // Fallback by referenced entity when debtorId is missing.
    if (!debtorId) {
      var rt = (row && (row.refType || row.refKind)) ? String(row.refType || row.refKind) : '';
      var rid = toKey(row && row.refId);

      if (rt === 'loan' && rid && loanMap[rid] && loanMap[rid].debtorId != null) {
        debtorId = String(loanMap[rid].debtorId);
      } else if (rt === 'claim' && rid && claimMap[rid] && claimMap[rid].debtorId != null) {
        debtorId = String(claimMap[rid].debtorId);
      } else if (rt === 'schedule' && rid && scheduleMap[rid]) {
        var sc = scheduleMap[rid];
        if (sc.debtorId != null) {
          debtorId = String(sc.debtorId);
        } else if (sc.loanId != null && loanMap[String(sc.loanId)] && loanMap[String(sc.loanId)].debtorId != null) {
          debtorId = String(loanMap[String(sc.loanId)].debtorId);
        } else if (sc.claimId != null && claimMap[String(sc.claimId)] && claimMap[String(sc.claimId)].debtorId != null) {
          debtorId = String(claimMap[String(sc.claimId)].debtorId);
        }
      }
    }

    if (!debtorId) return '';
    var debtor = debtorMap[debtorId];
    if (!debtor) return '';
    if (debtor.name != null && String(debtor.name).trim()) {
      return String(debtor.name).trim();
    }
    return '';
  }

  function buildLedgerDisplayTitle(row, maps) {
    if (!row) return '';
    var baseTitle = defaultTitleByType(row.type, row.title);

    // AUTO logs: append debtor name for operational readability (UI only).
    if (row.type === 'AUTO_IN' || row.type === 'AUTO_OUT' || row.type === 'AUTO_ADJUST') {
      var debtorName = resolveDebtorName(row, maps);
      if (debtorName) {
        if (baseTitle.indexOf(debtorName) === -1) {
          return baseTitle + ' · ' + debtorName;
        }
      }
    }

    return baseTitle;
  }

  function getCashLogs() {
    if (App.cashLedger && typeof App.cashLedger.getLogs === 'function') {
      return App.cashLedger.getLogs() || [];
    }
    var st = App.state || {};
    return Array.isArray(st.cashLogs) ? st.cashLogs : [];
  }

  function buildFilteredRows(logs, from, to) {
    var fromMs = from ? toLocalDayMs(from) : NaN;
    var toMs = to ? toLocalDayMs(to) : NaN;

    // Inclusive range: expand end to end-of-day
    if (isFinite(toMs)) {
      toMs = toMs + (24 * 60 * 60 * 1000) - 1;
    }

    // Ledger display order: date ASC, createdAt ASC
    // Running balance MUST be calculated in the same (sorted) order.
    var list = (Array.isArray(logs) ? logs.slice() : []);
    list.sort(function (a, b) {
      var da = toLocalDayMs(a && a.date);
      var db = toLocalDayMs(b && b.date);

      if (!isFinite(da)) da = 0;
      if (!isFinite(db)) db = 0;
      if (da !== db) return da - db;

      var ta = 0;
      var tb = 0;
      if (a && a.createdAt) {
        var d1 = new Date(a.createdAt);
        if (!isNaN(d1.getTime())) ta = d1.getTime();
      }
      if (b && b.createdAt) {
        var d2 = new Date(b.createdAt);
        if (!isNaN(d2.getTime())) tb = d2.getTime();
      }
      if (ta !== tb) return ta - tb;

      var ia = a && a.id != null ? String(a.id) : '';
      var ib = b && b.id != null ? String(b.id) : '';
      if (ia < ib) return -1;
      if (ia > ib) return 1;
      return 0;
    });

    var rows = [];
    var running = 0;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it) continue;

      // Always accumulate in sorted order to keep the ledger balance truthful.
      running += safeNumber(it.amount);

      var dms = toLocalDayMs(it.date);
      if (isFinite(fromMs) && isFinite(dms) && dms < fromMs) continue;
      if (isFinite(toMs) && isFinite(dms) && dms > toMs) continue;

      rows.push({
        id: it.id != null ? String(it.id) : '',
        type: it.type != null ? String(it.type) : '',
        date: it.date || '',
        title: it.title || '',
        refType: it.refType != null ? String(it.refType) : (it.refKind != null ? String(it.refKind) : ''),
        refKind: it.refKind != null ? String(it.refKind) : (it.refType != null ? String(it.refType) : ''),
        refId: it.refId != null ? String(it.refId) : '',
        debtorId: it.debtorId != null ? String(it.debtorId) : '',
        amount: safeNumber(it.amount),
        balance: running,
        createdAt: it.createdAt || ''
      });
    }

    return {
      rows: rows,
      // Summary uses the full ledger total (NOT filtered)
      total: running
    };
  }

  function isEditableType(type) {
    if (App.cashLedger && typeof App.cashLedger.isEditableType === 'function') {
      return !!App.cashLedger.isEditableType(type);
    }
    return type === 'INIT' || type === 'MANUAL_IN' || type === 'MANUAL_OUT';
  }

  function isAutoType(type) {
    if (App.cashLedger && typeof App.cashLedger.isAutoType === 'function') {
      return !!App.cashLedger.isAutoType(type);
    }
    return type === 'AUTO_IN' || type === 'AUTO_OUT' || type === 'AUTO_ADJUST';
  }

  function typeBadgeText(type) {
    if (type === 'INIT') return '초기';
    if (type === 'AUTO_IN' || type === 'AUTO_OUT' || type === 'AUTO_ADJUST') return '자동';
    if (type === 'MANUAL_IN' || type === 'MANUAL_OUT') return '수동';
    return '';
  }

  function buildModalDOM(refs) {
    var root = document.createElement('div');
    root.id = 'available-capital-modal-root';
    root.className = 'modal available-capital-modal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');

    var header = document.createElement('div');
    header.className = 'modal-header';

    var title = document.createElement('div');
    title.className = 'modal-title';
    title.textContent = '가용자산';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close';
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.textContent = '×';

    header.appendChild(title);
    header.appendChild(closeBtn);

    var body = document.createElement('div');
    body.className = 'modal-body';

    // Summary
    var summary = document.createElement('div');
    summary.className = 'avail-summary';

    var summaryLabel = document.createElement('div');
    summaryLabel.className = 'avail-summary-label';
    summaryLabel.textContent = '현재 가용자산';

    var summaryValue = document.createElement('div');
    summaryValue.className = 'avail-summary-value';
    summaryValue.textContent = formatCurrency(0);

    summary.appendChild(summaryLabel);
    summary.appendChild(summaryValue);

    // Actions
    var actions = document.createElement('div');
    actions.className = 'avail-actions';

    var btnInit = document.createElement('button');
    btnInit.type = 'button';
    btnInit.className = 'avail-action-btn is-init';
    btnInit.textContent = '초기자본 설정';

    var btnIn = document.createElement('button');
    btnIn.type = 'button';
    btnIn.className = 'avail-action-btn is-in';
    btnIn.textContent = '+ 자본 유입';

    var btnOut = document.createElement('button');
    btnOut.type = 'button';
    btnOut.className = 'avail-action-btn is-out';
    btnOut.textContent = '− 자본 유출';

    actions.appendChild(btnInit);
    actions.appendChild(btnIn);
    actions.appendChild(btnOut);

    // Editor (hidden by default)
    var editor = document.createElement('div');
    editor.className = 'ledger-editor';
    editor.style.display = 'none';

    var editorTitle = document.createElement('div');
    editorTitle.className = 'ledger-editor-title';
    editorTitle.textContent = '';

    var editorFields = document.createElement('div');
    editorFields.className = 'ledger-editor-fields';

    var fieldDate = document.createElement('label');
    fieldDate.className = 'ledger-field';
    var fieldDateLabel = document.createElement('span');
    fieldDateLabel.className = 'ledger-field-label';
    fieldDateLabel.textContent = '날짜';
    var inputDate = document.createElement('input');
    inputDate.type = 'date';
    inputDate.className = 'ledger-input ledger-input-date';
    fieldDate.appendChild(fieldDateLabel);
    fieldDate.appendChild(inputDate);

    var fieldAmount = document.createElement('label');
    fieldAmount.className = 'ledger-field';
    var fieldAmountLabel = document.createElement('span');
    fieldAmountLabel.className = 'ledger-field-label';
    fieldAmountLabel.textContent = '금액';
    var inputAmount = document.createElement('input');
    inputAmount.type = 'number';
    inputAmount.className = 'ledger-input ledger-input-amount';
    inputAmount.step = '1';
    fieldAmount.appendChild(fieldAmountLabel);
    fieldAmount.appendChild(inputAmount);

    var fieldMemo = document.createElement('label');
    fieldMemo.className = 'ledger-field';
    var fieldMemoLabel = document.createElement('span');
    fieldMemoLabel.className = 'ledger-field-label';
    fieldMemoLabel.textContent = '내용';
    var inputMemo = document.createElement('input');
    inputMemo.type = 'text';
    inputMemo.className = 'ledger-input ledger-input-memo';
    inputMemo.placeholder = '메모';
    fieldMemo.appendChild(fieldMemoLabel);
    fieldMemo.appendChild(inputMemo);

    editorFields.appendChild(fieldDate);
    editorFields.appendChild(fieldAmount);
    editorFields.appendChild(fieldMemo);

    var editorActions = document.createElement('div');
    editorActions.className = 'ledger-editor-actions';

    var btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.className = 'ledger-editor-btn is-save';
    btnSave.textContent = '저장';

    var btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'ledger-editor-btn is-cancel';
    btnCancel.textContent = '취소';

    editorActions.appendChild(btnSave);
    editorActions.appendChild(btnCancel);

    editor.appendChild(editorTitle);
    editor.appendChild(editorFields);
    editor.appendChild(editorActions);

    // Filter
    var filter = document.createElement('div');
    filter.className = 'ledger-filter';

    var rangeRow = document.createElement('div');
    rangeRow.className = 'ledger-filter-row';

    var fromWrap = document.createElement('label');
    fromWrap.className = 'ledger-filter-field';
    var fromLabel = document.createElement('span');
    fromLabel.className = 'ledger-filter-label';
    fromLabel.textContent = '시작';
    var fromInput = document.createElement('input');
    fromInput.type = 'date';
    fromInput.className = 'ledger-filter-input ledger-filter-from';
    fromWrap.appendChild(fromLabel);
    fromWrap.appendChild(fromInput);

    var sep = document.createElement('span');
    sep.className = 'ledger-filter-sep';
    sep.textContent = '~';

    var toWrap = document.createElement('label');
    toWrap.className = 'ledger-filter-field';
    var toLabel = document.createElement('span');
    toLabel.className = 'ledger-filter-label';
    toLabel.textContent = '종료';
    var toInput = document.createElement('input');
    toInput.type = 'date';
    toInput.className = 'ledger-filter-input ledger-filter-to';
    toWrap.appendChild(toLabel);
    toWrap.appendChild(toInput);

    rangeRow.appendChild(fromWrap);
    rangeRow.appendChild(sep);
    rangeRow.appendChild(toWrap);

    var presetRow = document.createElement('div');
    presetRow.className = 'ledger-preset-row';

    function makePresetBtn(key, label) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ledger-preset-btn';
      b.setAttribute('data-preset', key);
      b.textContent = label;
      return b;
    }

    var pToday = makePresetBtn('today', '오늘');
    var p7 = makePresetBtn('7d', '7일');
    var p30 = makePresetBtn('30d', '30일');
    var pAll = makePresetBtn('all', '전체');

    presetRow.appendChild(pToday);
    presetRow.appendChild(p7);
    presetRow.appendChild(p30);
    presetRow.appendChild(pAll);

    filter.appendChild(rangeRow);
    filter.appendChild(presetRow);

    // Ledger table (scroll)
    var tableWrap = document.createElement('div');
    tableWrap.className = 'ledger-table-wrap';

    var table = document.createElement('table');
    table.className = 'ledger-table';

    var thead = document.createElement('thead');
    var headTr = document.createElement('tr');
    var thItem = document.createElement('th');
    thItem.textContent = '항목';
    var thAmount = document.createElement('th');
    thAmount.className = 'amount';
    thAmount.textContent = '금액';
    var thBalance = document.createElement('th');
    thBalance.className = 'balance';
    thBalance.textContent = '가용자산';
    headTr.appendChild(thItem);
    headTr.appendChild(thAmount);
    headTr.appendChild(thBalance);
    thead.appendChild(headTr);

    var tbody = document.createElement('tbody');
    tbody.className = 'ledger-tbody';

    table.appendChild(thead);
    table.appendChild(tbody);
    tableWrap.appendChild(table);

    body.appendChild(summary);
    body.appendChild(actions);
    body.appendChild(editor);
    body.appendChild(filter);
    body.appendChild(tableWrap);

    root.appendChild(header);
    root.appendChild(body);

    // refs
    refs.root = root;
    refs.closeBtn = closeBtn;
    refs.summaryValue = summaryValue;
    refs.btnInit = btnInit;
    refs.btnIn = btnIn;
    refs.btnOut = btnOut;
    refs.editor = editor;
    refs.editorTitle = editorTitle;
    refs.editorDate = inputDate;
    refs.editorAmount = inputAmount;
    refs.editorMemo = inputMemo;
    refs.editorSave = btnSave;
    refs.editorCancel = btnCancel;
    refs.filterFrom = fromInput;
    refs.filterTo = toInput;
    refs.presetBtns = [pToday, p7, p30, pAll];
    refs.tbody = tbody;

    return root;
  }

  function createController(refs) {
    var state = {
      from: '',
      to: '',
      editorMode: null, // 'INIT' | 'MANUAL_IN' | 'MANUAL_OUT' | 'EDIT'
      editId: null,
      editType: null
    };

    function updatePresetActive(activeKey) {
      var btns = refs.presetBtns || [];
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (!b) continue;
        var key = b.getAttribute('data-preset');
        b.classList.toggle('is-active', key === activeKey);
      }
    }

    function setPeriod(from, to, presetKey) {
      state.from = from || '';
      state.to = to || '';
      if (refs.filterFrom) refs.filterFrom.value = state.from;
      if (refs.filterTo) refs.filterTo.value = state.to;
      if (presetKey) updatePresetActive(presetKey);
      else updatePresetActive('');
      render();
    }

    function applyPreset(key) {
      var today = todayISODate();
      if (key === 'today') {
        setPeriod(today, today, key);
        return;
      }
      if (key === '7d') {
        setPeriod(addDays(today, -6), today, key);
        return;
      }
      if (key === '30d') {
        setPeriod(addDays(today, -29), today, key);
        return;
      }
      // all
      setPeriod('', '', key);
    }

    function hideEditor() {
      state.editorMode = null;
      state.editId = null;
      state.editType = null;
      if (refs.editor) refs.editor.style.display = 'none';
      if (refs.editorTitle) refs.editorTitle.textContent = '';
      if (refs.editorDate) refs.editorDate.value = '';
      if (refs.editorAmount) refs.editorAmount.value = '';
      if (refs.editorMemo) refs.editorMemo.value = '';
    }

    function showEditor(mode, log) {
      state.editorMode = mode;
      state.editId = log && log.id != null ? String(log.id) : null;
      state.editType = log && log.type != null ? String(log.type) : mode;

      if (refs.editor) refs.editor.style.display = '';

      if (refs.editorTitle) {
        if (mode === 'INIT') refs.editorTitle.textContent = '초기자본 설정';
        else if (mode === 'MANUAL_IN') refs.editorTitle.textContent = '자본 유입 추가';
        else if (mode === 'MANUAL_OUT') refs.editorTitle.textContent = '자본 유출 추가';
        else refs.editorTitle.textContent = '현금 로그 수정';
      }

      var baseDate = todayISODate();
      var baseAmount = '';
      var baseTitle = '';

      if (log) {
        baseDate = log.date || baseDate;
        baseAmount = String(safeNumber(log.amount));
        baseTitle = log.title || '';
      } else {
        baseDate = todayISODate();
        baseAmount = '';
        baseTitle = '';
        if (mode === 'INIT') baseTitle = '초기자본';
      }

      // For OUT types, show absolute value to the user.
      if ((mode === 'MANUAL_OUT') || (log && log.type === 'MANUAL_OUT')) {
        var n = safeNumber(baseAmount);
        if (n < 0) n = -n;
        baseAmount = n ? String(n) : '';
      }
      if (log && log.type === 'AUTO_OUT') {
        var n2 = safeNumber(baseAmount);
        if (n2 < 0) n2 = -n2;
        baseAmount = n2 ? String(n2) : '';
      }

      if (refs.editorDate) refs.editorDate.value = baseDate;
      if (refs.editorAmount) refs.editorAmount.value = baseAmount;
      if (refs.editorMemo) refs.editorMemo.value = baseTitle;
    }

    function commitReport() {
      if (App.api && typeof App.api.commit === 'function' && App.ViewKey && App.ViewKey.REPORT) {
        App.api.commit({
          reason: 'cashLogs-change',
          invalidate: [App.ViewKey.REPORT]
        });
      }
    }

    function saveEditor() {
      var mode = state.editorMode;
      if (!mode) return;

      var date = refs.editorDate ? refs.editorDate.value : '';
      var amountRaw = refs.editorAmount ? refs.editorAmount.value : '';
      var title = refs.editorMemo ? refs.editorMemo.value : '';
      var amount = safeNumber(amountRaw);

      if (!isFinite(amount) || (String(amountRaw).trim() === '')) {
        alert('금액을 입력하세요.');
        return;
      }

      // Mode dispatch
      if (mode === 'INIT') {
        if (App.cashLedger && typeof App.cashLedger.upsertInitialCapital === 'function') {
          App.cashLedger.upsertInitialCapital({ date: date, amount: amount, title: title || '초기자본' });
        }
        hideEditor();
        commitReport();
        render();
        return;
      }

      if (mode === 'MANUAL_IN') {
        if (App.cashLedger && typeof App.cashLedger.addManualIn === 'function') {
          App.cashLedger.addManualIn({ date: date, amount: amount, title: title || '수동 유입' });
        }
        hideEditor();
        commitReport();
        render();
        return;
      }

      if (mode === 'MANUAL_OUT') {
        if (App.cashLedger && typeof App.cashLedger.addManualOut === 'function') {
          App.cashLedger.addManualOut({ date: date, amount: amount, title: title || '수동 유출' });
        }
        hideEditor();
        commitReport();
        render();
        return;
      }

      // EDIT existing
      if (mode === 'EDIT') {
        var id = state.editId;
        var type = state.editType;
        if (!id || !type) {
          hideEditor();
          render();
          return;
        }

        // Only editable types are allowed.
        if (!isEditableType(type)) {
          hideEditor();
          render();
          return;
        }

        if (App.cashLedger && typeof App.cashLedger.updateEditable === 'function') {
          App.cashLedger.updateEditable(id, {
            date: date,
            amount: amount,
            title: title
          });
        }
        hideEditor();
        commitReport();
        render();
      }
    }

    function deleteLog(id, type) {
      if (!id) return;
      if (!isEditableType(type)) return;
      if (!window.confirm('이 로그를 삭제할까요?')) return;

      if (App.cashLedger && typeof App.cashLedger.deleteEditable === 'function') {
        App.cashLedger.deleteEditable(id);
      }
      hideEditor();
      commitReport();
      render();
    }

    function render() {
      var logs = getCashLogs();
      var result = buildFilteredRows(logs, state.from, state.to);

      // Lookup maps (UI-only) for AUTO log title readability.
      var st = App.state || {};
      var maps = {
        debtorMap: buildIdMap(st.debtors),
        loanMap: buildIdMap(st.loans),
        claimMap: buildIdMap(st.claims),
        scheduleMap: buildIdMap(getAllSchedulesForLookup())
      };

      // Summary uses the full ledger total (NOT filtered)
      var total = 0;
      if (App.cashLedger && typeof App.cashLedger.getCurrentBalance === 'function') {
        total = safeNumber(App.cashLedger.getCurrentBalance());
      } else {
        total = safeNumber(result.total);
      }
      if (refs.summaryValue) refs.summaryValue.textContent = formatCurrency(total);

      // Table
      clearNode(refs.tbody);
      var rows = result.rows || [];
      if (!rows.length) {
        var trEmpty = document.createElement('tr');
        trEmpty.className = 'ledger-empty-row';
        var tdEmpty = document.createElement('td');
        tdEmpty.colSpan = 3;
        tdEmpty.className = 'ledger-empty-cell';
        tdEmpty.textContent = '표시할 로그가 없습니다.';
        trEmpty.appendChild(tdEmpty);
        refs.tbody.appendChild(trEmpty);
        return;
      }

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var tr = document.createElement('tr');
        tr.className = 'ledger-row';
        if (isAutoType(row.type)) tr.classList.add('is-auto');
        if (isEditableType(row.type)) tr.classList.add('is-manual');

        // Item cell
        var tdItem = document.createElement('td');
        tdItem.className = 'ledger-cell ledger-cell-item';

        var itemTop = document.createElement('div');
        itemTop.className = 'ledger-item-top';

        var titleWrap = document.createElement('div');
        titleWrap.className = 'ledger-item-titlewrap';

        var title = document.createElement('div');
        title.className = 'ledger-item-title';
        var titleText = row.title || (row.type === 'INIT' ? '초기자본' : '');
        if (isAutoType(row.type)) {
          titleText = buildLedgerDisplayTitle(row, maps);
        }
        title.textContent = titleText;

        var badge = document.createElement('span');
        badge.className = 'ledger-item-badge';
        var badgeText = typeBadgeText(row.type);
        badge.textContent = badgeText;
        if (row.type === 'AUTO_IN' || row.type === 'AUTO_OUT' || row.type === 'AUTO_ADJUST') badge.classList.add('is-auto');
        if (row.type === 'MANUAL_IN' || row.type === 'MANUAL_OUT') badge.classList.add('is-manual');
        if (row.type === 'INIT') badge.classList.add('is-init');

        titleWrap.appendChild(title);
        if (badgeText) titleWrap.appendChild(badge);
        itemTop.appendChild(titleWrap);

        // Actions (manual only)
        if (isEditableType(row.type)) {
          var actions = document.createElement('div');
          actions.className = 'ledger-item-actions';

          var editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'ledger-mini-btn is-edit';
          editBtn.textContent = '수정';
          editBtn.addEventListener('click', (function (rid, rtype) {
            return function (e) {
              if (e) e.stopPropagation();
              var found = null;
              var logs2 = getCashLogs();
              for (var k = 0; k < logs2.length; k++) {
                var it = logs2[k];
                if (!it) continue;
                if (it.id != null && String(it.id) === rid) { found = it; break; }
              }
              if (!found) return;
              showEditor('EDIT', found);
            };
          })(row.id, row.type));

          var delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'ledger-mini-btn is-delete';
          delBtn.textContent = '삭제';
          delBtn.addEventListener('click', (function (rid, rtype) {
            return function (e) {
              if (e) e.stopPropagation();
              deleteLog(rid, rtype);
            };
          })(row.id, row.type));

          actions.appendChild(editBtn);
          actions.appendChild(delBtn);
          itemTop.appendChild(actions);
        }

        var sub = document.createElement('div');
        sub.className = 'ledger-item-sub';
        sub.textContent = row.date || '';

        tdItem.appendChild(itemTop);
        tdItem.appendChild(sub);

        // Amount cell
        var tdAmt = document.createElement('td');
        tdAmt.className = 'ledger-cell ledger-cell-amount amount';
        if (row.amount > 0) tdAmt.classList.add('is-plus');
        if (row.amount < 0) tdAmt.classList.add('is-minus');
        tdAmt.textContent = formatSignedCurrency(row.amount);

        // Balance cell
        var tdBal = document.createElement('td');
        tdBal.className = 'ledger-cell ledger-cell-balance balance';
        tdBal.textContent = formatCurrency(row.balance);

        tr.appendChild(tdItem);
        tr.appendChild(tdAmt);
        tr.appendChild(tdBal);

        refs.tbody.appendChild(tr);
      }
    }

    // Wire toolbar buttons
    if (refs.btnInit) {
      refs.btnInit.addEventListener('click', function () {
        showEditor('INIT', null);
      });
    }
    if (refs.btnIn) {
      refs.btnIn.addEventListener('click', function () {
        showEditor('MANUAL_IN', null);
      });
    }
    if (refs.btnOut) {
      refs.btnOut.addEventListener('click', function () {
        showEditor('MANUAL_OUT', null);
      });
    }

    if (refs.editorCancel) {
      refs.editorCancel.addEventListener('click', function () {
        hideEditor();
      });
    }
    if (refs.editorSave) {
      refs.editorSave.addEventListener('click', function () {
        saveEditor();
      });
    }

    if (refs.filterFrom) {
      refs.filterFrom.addEventListener('change', function () {
        state.from = refs.filterFrom.value || '';
        updatePresetActive('');
        render();
      });
    }
    if (refs.filterTo) {
      refs.filterTo.addEventListener('change', function () {
        state.to = refs.filterTo.value || '';
        updatePresetActive('');
        render();
      });
    }

    var presetBtns = refs.presetBtns || [];
    for (var i = 0; i < presetBtns.length; i++) {
      var b = presetBtns[i];
      if (!b) continue;
      b.addEventListener('click', function () {
        var k = this.getAttribute('data-preset');
        applyPreset(k);
      });
    }

    return {
      render: render,
      setPeriod: setPeriod,
      applyPreset: applyPreset,
      hideEditor: hideEditor
    };
  }

  // Runtime state
  var modalRefs = {
    backdrop: null,
    root: null,
    closeBtn: null,
    summaryValue: null,
    btnInit: null,
    btnIn: null,
    btnOut: null,
    editor: null,
    editorTitle: null,
    editorDate: null,
    editorAmount: null,
    editorMemo: null,
    editorSave: null,
    editorCancel: null,
    filterFrom: null,
    filterTo: null,
    presetBtns: null,
    tbody: null
  };

  var controller = null;
  var escListenerAttached = false;

  function onKeyDown(e) {
    if (!e) return;
    var key = e.key || e.keyCode;
    if (key === 'Escape' || key === 'Esc' || key === 27) {
      close();
    }
  }

  function attachEsc() {
    if (escListenerAttached) return;
    escListenerAttached = true;
    document.addEventListener('keydown', onKeyDown);
  }

  function detachEsc() {
    if (!escListenerAttached) return;
    escListenerAttached = false;
    document.removeEventListener('keydown', onKeyDown);
  }

  function close() {
    var host = document.getElementById('modal-root');
    if (modalRefs.backdrop && host && modalRefs.backdrop.parentNode === host) {
      host.removeChild(modalRefs.backdrop);
    }

    // reset refs
    modalRefs.backdrop = null;
    modalRefs.root = null;
    modalRefs.closeBtn = null;
    modalRefs.summaryValue = null;
    modalRefs.btnInit = null;
    modalRefs.btnIn = null;
    modalRefs.btnOut = null;
    modalRefs.editor = null;
    modalRefs.editorTitle = null;
    modalRefs.editorDate = null;
    modalRefs.editorAmount = null;
    modalRefs.editorMemo = null;
    modalRefs.editorSave = null;
    modalRefs.editorCancel = null;
    modalRefs.filterFrom = null;
    modalRefs.filterTo = null;
    modalRefs.presetBtns = null;
    modalRefs.tbody = null;

    controller = null;
    detachEsc();
  }

  function open() {
    var host = document.getElementById('modal-root');
    if (!host) return;

    // Ensure single instance
    close();

    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop available-capital-modal-backdrop';
    backdrop.setAttribute('data-available-capital-backdrop', '1');
    backdrop.addEventListener('click', function (e) {
      if (!e) return;
      if (e.target === backdrop) {
        close();
      }
    });

    modalRefs.backdrop = backdrop;

    var modal = buildModalDOM(modalRefs);
    backdrop.appendChild(modal);
    host.appendChild(backdrop);

    if (modalRefs.closeBtn) {
      modalRefs.closeBtn.addEventListener('click', function () {
        close();
      });
    }

    controller = createController(modalRefs);

    // Default filter = 최근 7일 (오늘 포함 7일)
    // - 시작일: 오늘 - 6일
    // - 종료일: 오늘
    // - 정렬은 기존 ASC 유지 (과거 → 현재)
    if (controller && typeof controller.applyPreset === 'function') {
      controller.applyPreset('7d');
    } else {
      var today = todayISODate();
      if (modalRefs.filterFrom) modalRefs.filterFrom.value = addDays(today, -6);
      if (modalRefs.filterTo) modalRefs.filterTo.value = today;
      if (controller) controller.render();
    }

    // Initial scroll position: show latest logs (bottom)
    var wrap = modal && modal.querySelector ? modal.querySelector('.ledger-table-wrap') : null;
    if (wrap && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(function () {
        wrap.scrollTop = wrap.scrollHeight;
      });
    } else if (wrap) {
      wrap.scrollTop = wrap.scrollHeight;
    }

    attachEsc();
  }

  App.ui.availableCapitalModal = {
    open: open,
    close: close
  };
})(window, document);
