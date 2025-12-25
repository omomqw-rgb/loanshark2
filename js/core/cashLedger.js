(function (window) {
  'use strict';

  var App = window.App || (window.App = {});

  var TYPES = {
    INIT: 'INIT',
    AUTO_IN: 'AUTO_IN',
    AUTO_OUT: 'AUTO_OUT',
    // v2.2: explicit capital execution outflow (idempotent, executionDate-based)
    LOAN_EXECUTION: 'LOAN_EXECUTION',
    AUTO_ADJUST: 'AUTO_ADJUST',
    MANUAL_IN: 'MANUAL_IN',
    MANUAL_OUT: 'MANUAL_OUT'
  };

  function ensureState() {
    if (!App.state) App.state = {};
    if (!Array.isArray(App.state.cashLogs)) App.state.cashLogs = [];
    return App.state;
  }

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

  function safeToNumber(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function abs(n) {
    n = safeToNumber(n);
    return n < 0 ? -n : n;
  }

  function normalizeISODate(value) {
    if (!value) return '';
    if (typeof value !== 'string') {
      try {
        var d = new Date(value);
        if (!isNaN(d.getTime())) {
          return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
        }
      } catch (e) {}
      return '';
    }

    var s = String(value).trim();
    if (!s) return '';
    // Keep first 10 chars when it looks like an ISO date.
    if (s.length >= 10) {
      var head = s.slice(0, 10);
      var parts = head.split('-');
      if (parts.length === 3 && parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2) {
        var y = Number(parts[0]);
        var m = Number(parts[1]);
        var d2 = Number(parts[2]);
        if (isFinite(y) && isFinite(m) && isFinite(d2) && y > 0 && m >= 1 && m <= 12 && d2 >= 1 && d2 <= 31) {
          return head;
        }
      }
    }

    // Fallback: Date parse
    try {
      var d0 = new Date(s);
      if (!isNaN(d0.getTime())) {
        return d0.getFullYear() + '-' + pad2(d0.getMonth() + 1) + '-' + pad2(d0.getDate());
      }
    } catch (e2) {}

    return '';
  }

  function generateId() {
    var a = Date.now().toString(36);
    var b = Math.floor(Math.random() * 1679616).toString(36); // 36^4
    return 'cashlog_' + a + '_' + b;
  }

  function isAutoType(type) {
    return type === TYPES.AUTO_IN || type === TYPES.AUTO_OUT || type === TYPES.AUTO_ADJUST || type === TYPES.LOAN_EXECUTION;
  }

  function isEditableType(type) {
    // INIT is user-managed (treated as editable).
    return type === TYPES.INIT || type === TYPES.MANUAL_IN || type === TYPES.MANUAL_OUT;
  }

  function normalizeAmountByType(type, amount) {
    var n = safeToNumber(amount);
    if (type === TYPES.AUTO_OUT || type === TYPES.MANUAL_OUT || type === TYPES.AUTO_ADJUST || type === TYPES.LOAN_EXECUTION) {
      return -abs(n);
    }
    // INIT / *_IN
    return abs(n);
  }

  function getLogs() {
    var st = ensureState();
    return st.cashLogs;
  }

  

  function shouldIncludeInEffective(log, ctx) {
    if (!log) return false;
    var t = log.type || '';

    // v2.2+ policy:
    // - executionDate가 도입되기 전(legacy) AUTO_OUT(대출 실행)은 KPI/Ledger에서 제외한다.
    if (t === TYPES.AUTO_OUT) return false;

    // v2.3 policy:
    // - LOAN_EXECUTION은 "cashLogs 기록"이 단일 기준(Source of Truth)이다.
    // - loan.executionDate를 참조하여 포함 여부를 판단하지 않는다.
    // - Future-dated LOAN_EXECUTION은 아직 유효하지 않으므로 제외한다.
    if (t === TYPES.LOAN_EXECUTION) {
      var today = (ctx && ctx.today) ? ctx.today : todayISODate();
      var d = log.date ? String(log.date).slice(0, 10) : '';
      if (d && today && d > today) return false;

      // Must be linked to a loan entry (for display/join safety)
      var rt = (log.refType != null) ? String(log.refType)
        : (log.refKind != null ? String(log.refKind) : '');
      if (rt !== 'loan') return false;

      var rid = (log.refId != null) ? String(log.refId) : '';
      if (!rid) return false;
    }

    return true;
  }

  function getEffectiveLogs() {
    var logs = getLogs();
    var out = [];
    var ctx = { today: todayISODate() };
    if (!Array.isArray(logs) || !logs.length) return out;
    for (var i = 0; i < logs.length; i++) {
      var it = logs[i];
      if (!it) continue;
      if (!shouldIncludeInEffective(it, ctx)) continue;
      out.push(it);
    }
    return out;
  }


  

  // v2.3: Single Source of Truth alignment
  // - Balance/KPI is calculated purely from effective cashLogs
  // - No virtual events, no loan.executionDate reference
  function getBalanceEvents() {
    return getEffectiveLogs();
  }


  function sumAmounts(logs) {
    if (!Array.isArray(logs)) return 0;
    var sum = 0;
    for (var i = 0; i < logs.length; i++) {
      var it = logs[i];
      if (!it) continue;
      sum += safeToNumber(it.amount);
    }
    return sum;
  }

  function addLog(payload) {
    payload = payload || {};
    var st = ensureState();
    var logs = st.cashLogs;

    var type = payload.type || TYPES.MANUAL_IN;
    var date = normalizeISODate(payload.date) || todayISODate();
    var title = payload.title != null ? String(payload.title) : '';
    var amount = normalizeAmountByType(type, payload.amount);

    var refType = payload.refType != null ? String(payload.refType)
      : (payload.refKind != null ? String(payload.refKind) : undefined);
    var refKind = payload.refKind != null ? String(payload.refKind)
      : (payload.refType != null ? String(payload.refType) : undefined);

    var log = {
      id: payload.id != null ? String(payload.id) : generateId(),
      type: type,
      date: date,
      title: title,
      amount: amount,
      createdAt: payload.createdAt != null ? String(payload.createdAt) : new Date().toISOString(),
      auto: payload.auto != null ? !!payload.auto : isAutoType(type),
      // Optional link info (read-only, does not affect ledger math)
      refType: refType,
      refKind: refKind,
      refId: payload.refId != null ? String(payload.refId) : undefined,
      debtorId: payload.debtorId != null ? String(payload.debtorId) : undefined,
      editable: isEditableType(type),
      deletable: isEditableType(type)
    };

    logs.push(log);
    return log;
  }

  function upsertInitialCapital(params) {
    params = params || {};
    var logs = getLogs();

    var date = normalizeISODate(params.date) || todayISODate();
    var title = params.title != null ? String(params.title) : '초기자본';
    var amount = normalizeAmountByType(TYPES.INIT, params.amount);

    // Update first INIT when present to keep "초기자본" as a single anchor.
    var target = null;
    for (var i = 0; i < logs.length; i++) {
      var it = logs[i];
      if (!it) continue;
      if (it.type === TYPES.INIT) {
        target = it;
        break;
      }
    }

    if (target) {
      target.date = date;
      target.title = title;
      target.amount = amount;
      target.updatedAt = new Date().toISOString();
      return target;
    }

    return addLog({
      type: TYPES.INIT,
      date: date,
      title: title,
      amount: amount
    });
  }

  function addManualIn(params) {
    params = params || {};
    return addLog({
      type: TYPES.MANUAL_IN,
      date: params.date,
      title: params.title,
      amount: params.amount
    });
  }

  function addManualOut(params) {
    params = params || {};
    return addLog({
      type: TYPES.MANUAL_OUT,
      date: params.date,
      title: params.title,
      amount: params.amount
    });
  }

  function addAutoOut(params) {
    params = params || {};
    return addLog({
      type: TYPES.AUTO_OUT,
      date: params.date,
      title: params.title != null ? params.title : '대출 실행',
      amount: params.amount,
      refType: params.refType != null ? params.refType : params.refKind,
      refKind: params.refKind != null ? params.refKind : params.refType,
      refId: params.refId,
      debtorId: params.debtorId
    });
  }

  function addAutoIn(params) {
    params = params || {};
    return addLog({
      type: TYPES.AUTO_IN,
      date: params.date,
      title: params.title != null ? params.title : '대출상환',
      amount: params.amount,
      refType: params.refType != null ? params.refType : params.refKind,
      refKind: params.refKind != null ? params.refKind : params.refType,
      refId: params.refId,
      debtorId: params.debtorId
    });
  }

  function addAutoAdjust(params) {
    params = params || {};
    return addLog({
      type: TYPES.AUTO_ADJUST,
      date: params.date,
      title: params.title != null ? params.title : '상환 정정',
      amount: params.amount,
      refType: params.refType != null ? params.refType : params.refKind,
      refKind: params.refKind != null ? params.refKind : params.refType,
      refId: params.refId,
      debtorId: params.debtorId
    });
  }

  function findLogById(id) {
    if (id == null) return null;
    var key = String(id);
    var logs = getLogs();
    for (var i = 0; i < logs.length; i++) {
      var it = logs[i];
      if (!it) continue;
      if (it.id != null && String(it.id) === key) return it;
    }
    return null;
  }

  function updateEditableLog(id, patch) {
    patch = patch || {};
    var it = findLogById(id);
    if (!it) return null;
    if (!isEditableType(it.type)) return null;

    if (patch.date != null) {
      it.date = normalizeISODate(patch.date) || it.date;
    }
    if (patch.title != null) {
      it.title = String(patch.title);
    }
    if (patch.amount != null) {
      it.amount = normalizeAmountByType(it.type, patch.amount);
    }
    it.updatedAt = new Date().toISOString();
    return it;
  }

  function deleteEditableLog(id) {
    if (id == null) return false;
    var key = String(id);
    var logs = getLogs();
    for (var i = 0; i < logs.length; i++) {
      var it = logs[i];
      if (!it) continue;
      if (it.id != null && String(it.id) === key) {
        if (!isEditableType(it.type)) return false;
        logs.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  App.cashLedger = App.cashLedger || {};
  App.cashLedger.TYPES = TYPES;
  App.cashLedger.isAutoType = isAutoType;
  App.cashLedger.isEditableType = isEditableType;
  App.cashLedger.getLogs = getLogs;
  App.cashLedger.getEffectiveLogs = getEffectiveLogs;
  App.cashLedger.getBalanceEvents = getBalanceEvents;
  App.cashLedger.sumAmounts = sumAmounts;
  App.cashLedger.getCurrentBalance = function () {
    return sumAmounts(getBalanceEvents());
  };
  App.cashLedger.addLog = addLog;
  App.cashLedger.upsertInitialCapital = upsertInitialCapital;
  App.cashLedger.addManualIn = addManualIn;
  App.cashLedger.addManualOut = addManualOut;
  App.cashLedger.addAutoOut = addAutoOut;
  App.cashLedger.addAutoIn = addAutoIn;
  App.cashLedger.addAutoAdjust = addAutoAdjust;
  App.cashLedger.findById = findLogById;
  App.cashLedger.updateEditable = updateEditableLog;
  App.cashLedger.deleteEditable = deleteEditableLog;
})(window);
