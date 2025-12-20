(function (window) {
  'use strict';
  var App = window.App || (window.App = {});

  function pad2(v) {
    v = Number(v) || 0;
    return v < 10 ? '0' + v : String(v);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayISODate() {
    var d = new Date();
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }


  // --- displayId (Loan/Claim) helpers ---
  // displayId is for UI/ops identification only.
  // It MUST NOT be used for internal references/logic.
  //
  // Generation rules:
  //   Loan : L-{debtorId}-{YYMMDD}-{RN}
  //   Claim: C-{debtorId}-{YYMMDD}-{RN}
  //
  // Date source priority (when generating at save-time for legacy entities):
  //   1) entity.createdAt
  //   2) entity.startDate OR first schedule date
  //   3) today (only if no date is available)

  function isObject(v) {
    return v && typeof v === 'object';
  }

  function normalizeISODate(value) {
    if (!value) return null;

    // Strings: accept YYYY-MM-DD or ISO-ish and normalize to YYYY-MM-DD
    if (typeof value === 'string') {
      var s = String(value).trim();
      if (!s) return null;
      if (s.length >= 10) {
        var head = s.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
      }
      var d0 = new Date(s);
      if (!isNaN(d0.getTime())) {
        return d0.getFullYear() + '-' + pad2(d0.getMonth() + 1) + '-' + pad2(d0.getDate());
      }
      return null;
    }

    // Date objects
    var tag = Object.prototype.toString.call(value);
    if (tag === '[object Date]') {
      var d = value;
      if (isNaN(d.getTime())) return null;
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    return null;
  }

  function toYYMMDD(isoDate) {
    isoDate = normalizeISODate(isoDate);
    if (!isoDate) return null;
    // YYYY-MM-DD -> YYMMDD
    return isoDate.slice(2, 4) + isoDate.slice(5, 7) + isoDate.slice(8, 10);
  }

  function randomBase36_2() {
    // 00 ~ ZZ (36^2 = 1296)
    var n = Math.floor(Math.random() * 1296);
    var s = n.toString(36).toUpperCase();
    if (s.length < 2) s = '0' + s;
    if (s.length > 2) s = s.slice(-2);
    return s;
  }

  function getFirstScheduleDate(kind, entityId) {
    var id = (entityId != null) ? String(entityId) : '';
    if (!id) return null;

    var list = [];
    try {
      if (kind === 'loan' && window.App && App.schedulesEngine && typeof App.schedulesEngine.getByLoanId === 'function') {
        list = App.schedulesEngine.getByLoanId(id) || [];
      } else if (kind === 'claim' && window.App && App.schedulesEngine && typeof App.schedulesEngine.getByClaimId === 'function') {
        list = App.schedulesEngine.getByClaimId(id) || [];
      }
    } catch (e) {
      list = [];
    }

    // Fallback to raw state list when engine helpers are unavailable.
    if (!list || !list.length) {
      var st = (window.App && App.state) ? App.state : null;
      var raw = st && Array.isArray(st.schedules) ? st.schedules : [];
      list = [];
      for (var i = 0; i < raw.length; i++) {
        var sc = raw[i];
        if (!sc) continue;
        if (kind === 'loan') {
          var lid = (typeof sc.loanId !== 'undefined') ? sc.loanId : sc.loan_id;
          if (lid != null && String(lid) === id) list.push(sc);
        } else if (kind === 'claim') {
          var cid = (typeof sc.claimId !== 'undefined') ? sc.claimId : sc.claim_id;
          if (cid != null && String(cid) === id) list.push(sc);
        }
      }
    }

    var min = null;
    for (var j = 0; j < list.length; j++) {
      var s = list[j];
      if (!s) continue;
      var due = s.dueDate || s.due_date || s.date || null;
      var iso = normalizeISODate(due);
      if (!iso) continue;
      if (!min || iso < min) min = iso;
    }
    return min;
  }

  function pickDisplayIdDate(kind, entity) {
    if (!isObject(entity)) return todayISODate();

    var created = normalizeISODate(entity.createdAt || entity.created_at);
    if (created) return created;

    var start = normalizeISODate(entity.startDate || entity.start_date);
    if (start) return start;

    var firstSc = getFirstScheduleDate(kind, entity.id);
    if (firstSc) return firstSc;

    return todayISODate();
  }

  function isDisplayIdTaken(kind, displayId, selfId) {
    if (!displayId) return false;
    var st = window.App && App.state ? App.state : null;
    if (!st) return false;
    var list = (kind === 'loan') ? (st.loans || []) : (st.claims || []);
    if (!Array.isArray(list) || !list.length) return false;
    var sid = (selfId != null) ? String(selfId) : null;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!isObject(it) || !it.displayId) continue;
      if (sid && it.id != null && String(it.id) === sid) continue;
      if (String(it.displayId) === String(displayId)) return true;
    }
    return false;
  }

  function generateDisplayId(kind, entity) {
    kind = (kind === 'claim') ? 'claim' : 'loan';
    var prefix = (kind === 'claim') ? 'C' : 'L';
    var debtorId = '';
    if (isObject(entity)) {
      debtorId = entity.debtorId || entity.debtor_id || '';
    }
    debtorId = debtorId != null ? String(debtorId) : '';
    if (!debtorId) debtorId = 'unknown';

    var iso = pickDisplayIdDate(kind, entity);
    var ymd = toYYMMDD(iso) || '000000';

    var rn = randomBase36_2();
    var candidate = prefix + '-' + debtorId + '-' + ymd + '-' + rn;

    // Collision guard: retry once when collision is detected.
    if (isDisplayIdTaken(kind, candidate, entity && entity.id)) {
      var rn2 = randomBase36_2();
      candidate = prefix + '-' + debtorId + '-' + ymd + '-' + rn2;
    }

    return candidate;
  }

  function ensureDisplayId(kind, entity) {
    if (!isObject(entity)) return;
    if (entity.displayId) return;
    entity.displayId = generateDisplayId(kind, entity);
  }

  function ensureLoanClaimDisplayIds() {
    var st = window.App && App.state ? App.state : null;
    if (!st) return;

    var loans = Array.isArray(st.loans) ? st.loans : [];
    var claims = Array.isArray(st.claims) ? st.claims : [];

    for (var i = 0; i < loans.length; i++) {
      ensureDisplayId('loan', loans[i]);
    }
    for (var j = 0; j < claims.length; j++) {
      ensureDisplayId('claim', claims[j]);
    }
  }



// --- displayId repair (existing data) ---
// Repairs invalid displayIds already present in stored state (Local / Cloud / memory).
// - DOES NOT generate when displayId is missing.
// - Corrects only when displayId exists but is invalid by rules.
//
// BaseDate priority for repair:
//   1) startDate
//   2) createdAt
//   3) today (only if both are missing)

function parseDisplayId(displayId) {
  if (!displayId) return null;
  var s = String(displayId).trim();
  if (!s) return null;

  // L-{debtorId}-{YYMMDD}-{RN} / C-{debtorId}-{YYMMDD}-{RN}
  // debtorId must not contain '-' (separator)
  var m = s.match(/^([LC])-([^-]+)-(\d{6})-([0-9A-Z]{2})$/i);
  if (!m) return null;

  return {
    prefix: String(m[1]).toUpperCase(),
    debtorId: String(m[2]),
    yymmdd: String(m[3]),
    rn: String(m[4]).toUpperCase()
  };
}

function pickRepairBaseDate(kind, entity) {
  // Repair uses startDate first (ops expectation), then createdAt, then today.
  if (!isObject(entity)) return todayISODate();

  var start = normalizeISODate(entity.startDate || entity.start_date);
  if (start) return start;

  var created = normalizeISODate(entity.createdAt || entity.created_at);
  if (created) return created;

  return todayISODate();
}

function displayIdValid(kind, entity) {
  if (!isObject(entity) || !entity.displayId) return false;

  kind = (kind === 'claim') ? 'claim' : 'loan';
  var expectedPrefix = (kind === 'claim') ? 'C' : 'L';

  var parsed = parseDisplayId(entity.displayId);
  if (!parsed) return false;

  // prefix must match entity kind
  if (parsed.prefix !== expectedPrefix) return false;

  // debtorId segment must match entity.debtorId
  var debtorId = entity.debtorId || entity.debtor_id || '';
  debtorId = (debtorId != null) ? String(debtorId) : '';
  if (!debtorId) debtorId = 'unknown';
  if (parsed.debtorId !== debtorId) return false;

  // date segment must match baseDate (startDate -> createdAt -> today)
  var baseIso = pickRepairBaseDate(kind, entity);
  var expectedYYMMDD = toYYMMDD(baseIso) || '000000';
  if (parsed.yymmdd !== expectedYYMMDD) return false;

  // Explicit policy: treat "today-date" ids as invalid when they don't match entity baseDate.
  // (Redundant with the expectedYYMMDD check, kept for clarity.)
  var todayYYMMDD = toYYMMDD(todayISODate()) || '000000';
  if (parsed.yymmdd === todayYYMMDD && expectedYYMMDD !== todayYYMMDD) return false;

  return true;
}

function generateDisplayIdFromDate(kind, entity, isoDate) {
  kind = (kind === 'claim') ? 'claim' : 'loan';
  var prefix = (kind === 'claim') ? 'C' : 'L';

  var debtorId = '';
  if (isObject(entity)) {
    debtorId = entity.debtorId || entity.debtor_id || '';
  }
  debtorId = (debtorId != null) ? String(debtorId) : '';
  if (!debtorId) debtorId = 'unknown';

  var ymd = toYYMMDD(isoDate) || '000000';

  var rn = randomBase36_2();
  var candidate = prefix + '-' + debtorId + '-' + ymd + '-' + rn;

  // Collision guard: retry once when collision is detected.
  if (isDisplayIdTaken(kind, candidate, entity && entity.id)) {
    var rn2 = randomBase36_2();
    candidate = prefix + '-' + debtorId + '-' + ymd + '-' + rn2;
  }

  return candidate;
}

function repairDisplayId(kind, entity) {
  // Guard: only repair when displayId exists and is invalid.
  if (!isObject(entity) || !entity.displayId) return false;
  if (displayIdValid(kind, entity)) return false;

  var baseIso = pickRepairBaseDate(kind, entity);
  entity.displayId = generateDisplayIdFromDate(kind, entity, baseIso);
  return true;
}

function repairLoanClaimDisplayIds() {
  var st = window.App && App.state ? App.state : null;
  if (!st) return 0;

  var loans = Array.isArray(st.loans) ? st.loans : [];
  var claims = Array.isArray(st.claims) ? st.claims : [];

  var repaired = 0;

  for (var i = 0; i < loans.length; i++) {
    var loan = loans[i];
    if (!loan || !loan.displayId) continue;
    if (repairDisplayId('loan', loan)) repaired++;
  }

  for (var j = 0; j < claims.length; j++) {
    var claim = claims[j];
    if (!claim || !claim.displayId) continue;
    if (repairDisplayId('claim', claim)) repaired++;
  }

  return repaired;
}

  function formatNumber(v) {
    var n = Number(v);
    if (!isFinite(n)) return String(v);
    return n.toLocaleString('ko-KR');
  }

  function formatCurrency(v) {
    var n = Number(v);
    if (!isFinite(n) || !n) return '₩0';
    try {
      return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0
      }).format(n);
    } catch (e) {
      return formatNumber(n);
    }
  }


  function formatShortCurrency(v) {
    var n = Number(v);
    if (!isFinite(n) || !n) return '\u20a90';

    var abs = Math.abs(n);
    var sign = n < 0 ? '-' : '';

    var value = abs;
    var unit = '';

    if (abs >= 100000000) {
      value = abs / 100000000;
      unit = '\uc5b5';
    } else if (abs >= 10000) {
      value = abs / 10000;
      unit = '\ub9cc';
    }

    var rounded = Math.round(value * 10) / 10;
    var text = String(rounded).replace(/\.0$/, '');

    return sign + text + unit;
  }

  function escapeHTML(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  App.util = {
    pad2: pad2,
    formatDate: formatDate,
    formatNumber: formatNumber,
    formatCurrency: formatCurrency,
    formatShortCurrency: formatShortCurrency,
    escapeHTML: escapeHTML,
    todayISODate: todayISODate,

    // displayId helpers (Loan/Claim cards)
    generateDisplayId: generateDisplayId,
    ensureDisplayId: ensureDisplayId,
    ensureLoanClaimDisplayIds: ensureLoanClaimDisplayIds,

    // displayId repair (existing data)
    displayIdValid: displayIdValid,
    repairDisplayId: repairDisplayId,
    repairLoanClaimDisplayIds: repairLoanClaimDisplayIds
  };

  App.showToast = function (msg) {
    var el = document.getElementById("toast");
    if (!el) return;

    el.textContent = msg;
    el.classList.add("show");

    clearTimeout(App._toastTimer);
    App._toastTimer = setTimeout(function () {
      el.classList.remove("show");
    }, 1500);
  };
})(window);