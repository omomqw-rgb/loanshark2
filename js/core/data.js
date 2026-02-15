(function (window) {
  'use strict';

  var App = window.App || (window.App = {});
  App.data = App.data || {};

  function getSupabase() {
    if (!App.supabase) {
      console.warn('[Data] App.supabase is not initialized.');
      return null;
    }
    return App.supabase;
  }



  async function getCloudShareInfo(supa, viewerId) {
    // Returns the effective target user_id to load from app_states.
    // - Default: viewer loads own state (targetUserId = viewerId)
    // - Shared: if state_shares grants viewer read access to an owner, targetUserId = ownerId
    if (!supa || !viewerId) {
      return { targetUserId: null, ownerId: null, viewerId: viewerId || null, role: null, isShared: false, isReadOnly: false };
    }

    // Default to self
    var info = { targetUserId: viewerId, ownerId: viewerId, viewerId: viewerId, role: 'owner', isShared: false, isReadOnly: false };

    // If state_shares doesn't exist or RLS blocks it, we silently fall back to self.
    try {
      var res = await supa
        .from('state_shares')
        .select('owner_id, role, created_at')
        .eq('viewer_id', viewerId)
        .order('created_at', { ascending: false })
        .limit(1);

      var err = res && res.error ? res.error : null;
      if (err) {
        return info;
      }

      var rows = (res && res.data) || [];
      if (!rows.length) {
        return info;
      }

      var row = rows[0] || null;
      var ownerId = row && row.owner_id ? row.owner_id : null;
      var role = row && row.role ? row.role : 'read';

      if (ownerId && ownerId !== viewerId) {
        info.targetUserId = ownerId;
        info.ownerId = ownerId;
        info.role = role;
        info.isShared = true;
        info.isReadOnly = (role === 'read');
      }

      return info;
    } catch (e) {
      return info;
    }
  }

  function ensureCloudStateModuleLoaded() {
    if (App.cloudState && typeof App.cloudState.build === 'function' && typeof App.cloudState.apply === 'function') {
      return;
    }
    if (typeof document === 'undefined') return;

    var scriptId = 'app-cloudstate-script';
    var existing = document.getElementById(scriptId);
    if (existing) return;

    try {
      var script = document.createElement('script');
      script.id = scriptId;
      script.src = 'js/core/cloudState.js';
      script.async = true;
      var head = document.head || document.getElementsByTagName('head')[0];
      if (head) {
        head.appendChild(script);
      } else if (document.body) {
        document.body.appendChild(script);
      }
    } catch (e) {
      console.warn('[Data] Failed to inject CloudState module script:', e);
    }
  }

  function parseNumber(value) {
    var n = Number(value);
    if (isNaN(n)) return 0;
    return n;
  }

  function parseJsonField(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (e) {
      console.warn('[Data] Failed to parse JSON field:', e);
      return null;
    }
  }

  function mapDebtorRow(row) {
    if (!row) return null;

    var gender = row.gender || row.debtor_gender || row.sex || '';
    var birth = row.birth || row.birth_date || row.birthDate || '';
    var region = row.region || '';
    var job = row.job || '';
    var riskTierAuto = row.risk_tier_auto || row.riskTierAuto || null;
    var riskTierManual = row.risk_tier_manual || row.riskTierManual || null;
    var riskTier = row.risk_tier || row.riskTier || null;

    return {
      id: String(row.id),
      userId: row.user_id,
      name: row.name || '',
      phone: row.phone || '',
      status: row.status || '진행',
      note: row.note || '',
      createdAt: row.created_at || row.createdAt || null,
      gender: gender || '',
      birth: birth || '',
      region: region || '',
      job: job || '',
      riskTierAuto: riskTierAuto,
      riskTierManual: riskTierManual,
      riskTier: riskTier
    };
  }

function mapLoanRow(row) {
    if (!row) return null;
    var loan = {
      id: String(row.id),
      userId: row.user_id,
      debtorId: row.debtor_id || row.debtorId || null,
      principal: parseNumber(row.principal),
      interestRate: parseNumber(row.interest_rate != null ? row.interest_rate : row.interestRate),
      totalRepayAmount: parseNumber(
        row.total_repay != null ? row.total_repay :
        (row.total_repay_amount != null ? row.total_repay_amount : row.totalRepayAmount)
      ),
      installmentCount: row.installment_count != null ? row.installment_count : (row.installmentCount || 0),
      startDate: row.start_date || row.startDate || null,
      cycleType: row.cycle_type || row.cycleType || 'month',
      dayInterval: row.day_interval != null ? row.day_interval : (row.dayInterval || 0),
      weekDay: row.week_day != null ? row.week_day : (row.weekDay || null),
      createdAt: row.created_at || row.createdAt || row.start_date || null,
      paidAmount: parseNumber(row.paid_amount != null ? row.paid_amount : row.paidAmount),
      remainingAmount: parseNumber(row.remaining_amount != null ? row.remaining_amount : row.remainingAmount),
      status: row.status || '진행',
      nextDueDate: row.next_due_date || row.nextDueDate || null,
      cardStatus: row.card_status || row.cardStatus || '진행',
      memo: row.memo || row.note || ''
    };
    return loan;
  }

  function mapClaimRow(row) {
    if (!row) return null;
    var claim = {
      id: String(row.id),
      userId: row.user_id,
      debtorId: row.debtor_id || row.debtorId || null,
      amount: parseNumber(row.amount),
      installmentCount: row.installment_count != null ? row.installment_count : (row.installmentCount || 0),
      startDate: row.start_date || row.startDate || null,
      cycleType: row.cycle_type || row.cycleType || 'month',
      dayInterval: row.day_interval != null ? row.day_interval : (row.dayInterval || 0),
      weekDay: row.week_day != null ? row.week_day : (row.weekDay || null),
      createdAt: row.created_at || row.createdAt || row.start_date || null,
      memo: row.memo || row.note || '',
      cardStatus: row.card_status || row.cardStatus || '진행',
      paidAmount: parseNumber(row.paid_amount != null ? row.paid_amount : row.paidAmount)
    };
    return claim;
  }

  function buildIndexById(list) {
    var map = Object.create(null);
    if (!list) return map;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item && item.id != null) {
        map[item.id] = item;
      }
    }
    return map;
  }

  function mapScheduleRows(rows, loansById, claimsById) {
    var list = [];
    if (!rows) return list;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row) continue;

      var loanId = row.loan_id || row.loanId || null;
      var claimId = row.claim_id || row.claimId || null;
      var kind = row.kind || (claimId ? 'claim' : 'loan');

      var debtorId = null;
      if (loanId && loansById && loansById[loanId]) {
        debtorId = loansById[loanId].debtorId;
      } else if (claimId && claimsById && claimsById[claimId]) {
        debtorId = claimsById[claimId].debtorId;
      }

      var amount = parseNumber(row.amount);
      var paid = parseNumber(row.paid_amount != null ? row.paid_amount : row.paidAmount);

      var status = row.status;
      if (!status) {
        if (paid >= amount && amount > 0) status = 'PAID';
        else status = 'PLANNED';
      }

      list.push({
        id: String(row.id),
        userId: row.user_id,
        kind: kind || (claimId ? 'claim' : 'loan'),
        debtorId: debtorId,
        loanId: loanId,
        claimId: claimId,
        installmentNo: row.installment_no != null ? row.installment_no : (row.installmentNo || null),
        dueDate: row.due_date || row.dueDate || null,
        amount: amount,
        status: status,
        partialPaidAmount: paid,
        paidAmount: paid
      });
    }

    return list;
  }

  function mapCashLogs(rows) {
    var list = [];
    if (!rows) return list;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row) continue;
      list.push({
        id: String(row.id),
        userId: row.user_id,
        kind: row.kind || row.type || '',
        amount: parseNumber(row.amount),
        note: row.note || row.memo || '',
        createdAt: row.created_at || row.createdAt || null
      });
    }
    return list;
  }

  function applyRiskSettings(rows) {
    if (!rows || !rows.length) {
      App.riskSettings = null;
      return;
    }

    var row = rows[0];
    App.riskSettings = {
      id: row.id,
      userId: row.user_id,
      weights: parseJsonField(row.weights),
      gradeRules: parseJsonField(row.grade_rules),
      highRiskRules: parseJsonField(row.high_risk_rules),
      earlyWarningRules: parseJsonField(row.early_warning_rules),
      raw: row
    };
  }

    function recomputeDerivedLoanFields() {
    if (!App.db || typeof App.db.deriveLoanFields !== 'function') return;
    if (!App.state) return;

    var loans = App.state.loans || [];
    var schedules = [];

    if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      try {
        schedules = App.schedulesEngine.getAll() || [];
      } catch (e) {
        schedules = [];
      }
    }

    for (var i = 0; i < loans.length; i++) {
      var loan = loans[i];
      var loanSchedules = [];
      for (var j = 0; j < schedules.length; j++) {
        var s = schedules[j];
        if (s && s.loanId === loan.id && s.kind === 'loan') {
          loanSchedules.push(s);
        }
      }
      App.db.deriveLoanFields(loan, loanSchedules);
    }
  }

  
  function buildDebtorsDetailed(debtors, loans, claims, schedules) {
    debtors = debtors || [];
    loans = loans || [];
    claims = claims || [];
    schedules = schedules || [];

    var loansByDebtor = Object.create(null);
    for (var i = 0; i < loans.length; i++) {
      var loan = loans[i];
      if (!loan || loan.debtorId == null) continue;
      var key = String(loan.debtorId);
      if (!loansByDebtor[key]) loansByDebtor[key] = [];
      loansByDebtor[key].push(loan);
    }

    var claimsByDebtor = Object.create(null);
    for (var j = 0; j < claims.length; j++) {
      var claim = claims[j];
      if (!claim || claim.debtorId == null) continue;
      var key2 = String(claim.debtorId);
      if (!claimsByDebtor[key2]) claimsByDebtor[key2] = [];
      claimsByDebtor[key2].push(claim);
    }

    var overdueByDebtor = Object.create(null);
    var hasOutstandingByDebtor = Object.create(null);

    // v022_1: debtor status icon criteria (alive/overdue schedule)
    // - Do NOT use loan/claim counts, outstanding/remaining amount, or card states.
    // - Only schedule status and dueDate are used.
    var hasAliveScheduleByDebtor = Object.create(null);
    var hasOverdueScheduleByDebtor = Object.create(null);

    function normalizeScheduleDueDate(sc) {
      if (!sc) return '';
      var due = sc.dueDate || sc.due_date || sc.date || null;
      if (!due) return '';
      // Prefer ISO-like strings if already present.
      if (typeof due === 'string') {
        // Keep YYYY-MM-DD portion.
        if (due.length >= 10) return due.slice(0, 10);
        return due;
      }
      if (App.date && typeof App.date.toISODate === 'function') {
        return App.date.toISODate(due) || '';
      }
      try {
        var d = new Date(due);
        if (isNaN(d.getTime())) return '';
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var dd = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + dd;
      } catch (e) {
        return '';
      }
    }

    var todayStr = (App.date && typeof App.date.getToday === 'function') ? App.date.getToday() : '';

    for (var k = 0; k < schedules.length; k++) {
      var sc = schedules[k];
      if (!sc || sc.debtorId == null) continue;

      var key3 = String(sc.debtorId);
      var amount = Number(sc.amount) || 0;
      var paid = Number(sc.paidAmount) || 0;
      var status = (sc.status || '').toUpperCase();

      // Alive schedule: any loan/claim schedule with status !== PAID.
      // Overdue schedule: any schedule with status !== PAID AND dueDate < today.
      // (No amount/balance/card-state conditions.)
      var kind = String(sc.kind || '').toLowerCase();
      if (!kind) {
        if (sc.loanId != null) kind = 'loan';
        else if (sc.claimId != null) kind = 'claim';
      }
      var isLoanOrClaim = (kind === 'loan' || kind === 'claim');
      if (isLoanOrClaim && status !== 'PAID') {
        hasAliveScheduleByDebtor[key3] = true;

        var dueStr = normalizeScheduleDueDate(sc);
        if (todayStr && dueStr && dueStr < todayStr) {
          hasOverdueScheduleByDebtor[key3] = true;
        }
      }

      if (amount > paid) {
        hasOutstandingByDebtor[key3] = true;
      }

      if (status !== 'OVERDUE') continue;

      var outstanding = amount - paid;
      if (!isFinite(outstanding) || outstanding < 0) outstanding = 0;
      if (!overdueByDebtor[key3]) overdueByDebtor[key3] = 0;
      overdueByDebtor[key3] += outstanding;
    }

    var byId = Object.create(null);
    var list = [];

    for (var dIdx = 0; dIdx < debtors.length; dIdx++) {
      var debtor = debtors[dIdx];
      if (!debtor || debtor.id == null) continue;

      var id = String(debtor.id);
      var dLoans = loansByDebtor[id] || [];
      var dClaims = claimsByDebtor[id] || [];

      var loanTotal = 0;
      for (var li = 0; li < dLoans.length; li++) {
        var ln = dLoans[li];
        var base = (ln.totalRepayAmount != null ? ln.totalRepayAmount : ln.principal);
        loanTotal += Number(base) || 0;
      }

      var claimTotal = 0;
      for (var ci = 0; ci < dClaims.length; ci++) {
        var cl = dClaims[ci];
        claimTotal += Number(cl.amount) || 0;
      }

      var overdueAmount = overdueByDebtor[id] || 0;
      var hasExposure = (loanTotal > 0) || (claimTotal > 0);
      var hasOutstanding = !!hasOutstandingByDebtor[id];

      // v022_1: derived flags for debtor list status icon.
      var hasAliveSchedule = !!hasAliveScheduleByDebtor[id];
      var hasOverdueSchedule = !!hasOverdueScheduleByDebtor[id];

      var detailStatus;
      if (hasOutstanding) {
        detailStatus = '진행';
      } else if (hasExposure) {
        detailStatus = '완납';
      } else {
        detailStatus = '보류';
      }

      var detail = {
        id: id,
        userId: debtor.userId,
        name: debtor.name || '',
        phone: debtor.phone || '',
        status: detailStatus,
        note: debtor.note || '',
        created: debtor.createdAt || null,
        gender: debtor.gender || '',
        birth: debtor.birth || '',
        region: debtor.region || '',
        job: debtor.job || '',
        riskTierAuto: debtor.riskTierAuto || null,
        riskTierManual: debtor.riskTierManual || null,
        riskTier: debtor.riskTier || null,
        loanCount: dLoans.length,
        claimCount: dClaims.length,
        loanTotal: loanTotal,
        claimTotal: claimTotal,
        overdueAmount: overdueAmount,
        hasAliveSchedule: hasAliveSchedule,
        hasOverdueSchedule: hasOverdueSchedule
      };

      byId[id] = detail;
      list.push(detail);
    }

    return {
      list: list,
      byId: byId
    };
  }

function renderAll() {
    if (App.features && App.features.debtors && App.features.debtors.render) {
      App.features.debtors.render();
    }
    if (App.features && App.features.calendar && App.features.calendar.render) {
      App.features.calendar.render();
    }
    if (App.features && App.features.monitoring && App.features.monitoring.render) {
      App.features.monitoring.render();
    }
    if (App.features && App.features.report && App.features.report.render) {
      App.features.report.render();
    }

    // Stage 2: Compatibility wrapper — also mark all core views as invalidated.
    // This must not replace existing renderAll behavior.
    if (App.renderCoordinator && App.ViewKeySet && App.ViewKeySet.ALL) {
      App.renderCoordinator.invalidate(App.ViewKeySet.ALL);
    }
  }

  App.renderAll = renderAll;


  
  async function loadAllFromSupabase() {
    var supa = getSupabase();
    if (!supa) return;

    ensureCloudStateModuleLoaded();

    var userId = (App.user && App.user.id) ? App.user.id : null;

    // Cloud Load policy (Stage6.1 split): allow load attempts without authentication (v001 style).
    // Access control is enforced by Supabase RLS.
    try {
      var query = supa
        .from('app_states')
        .select('state_json, updated_at');

      if (userId) {
        var shareInfo = await getCloudShareInfo(supa, userId);
        var targetUserId = (shareInfo && shareInfo.targetUserId) ? shareInfo.targetUserId : userId;

        if (!App.state) App.state = {};
        App.state.cloud = App.state.cloud || {};
        App.state.cloud.targetUserId = targetUserId;
        App.state.cloud.viewerId = userId;
        App.state.cloud.ownerId = (shareInfo && shareInfo.ownerId) ? shareInfo.ownerId : userId;
        App.state.cloud.role = (shareInfo && shareInfo.role) ? shareInfo.role : 'owner';
        App.state.cloud.isShared = !!(shareInfo && shareInfo.isShared);
        App.state.cloud.isReadOnly = !!(shareInfo && shareInfo.isReadOnly);
        try {
          var isViewer = !!(App.state.cloud.isShared && App.state.cloud.isReadOnly && App.state.cloud.viewerId && App.state.cloud.targetUserId && App.state.cloud.viewerId !== App.state.cloud.targetUserId);
          document.documentElement.classList.toggle('ls-viewer', isViewer);
        } catch (e) {}


        query = query.eq('user_id', targetUserId);
      }

      query = query
        .order('updated_at', { ascending: false })
        .limit(1);

      var result = await query;

      var error = result && result.error ? result.error : null;
      if (error) {
        console.error('[Cloud Load] Failed to load cloud state:', error);
        if (!userId) {
          App.showToast("Cloud 데이터를 불러올 수 없습니다.");
        } else {
          App.showToast("오류 발생 — 다시 시도해주세요.");
        }
        return;
      }

      var rows = (result && result.data) || [];
      if (!rows.length || !rows[0] || !rows[0].state_json) {
        console.warn('[Cloud Load] No cloud state found.');
        if (!userId) {
          App.showToast("Cloud 데이터를 불러올 수 없습니다.");
        } else {
          App.showToast("Cloud Load — 저장된 데이터가 없습니다.");
        }
        return;
      }

      var rawState = rows[0].state_json || null;

      var hasCloudStateModule = App.cloudState && typeof App.cloudState.apply === 'function';
      var version = rawState && rawState.version;
      var isV1Snapshot = !!(rawState && (version === 1 || version === '1') && rawState.data && typeof rawState.data === 'object');

      if (isV1Snapshot) {
        if (!hasCloudStateModule) {
          console.error('[Cloud Load] v1 cloud snapshot detected but CloudState.apply is not available.');
          App.showToast("오류 발생 — 다시 시도해주세요.");
          return;
        }

        // Stage 5: App.cloudState.apply() → App.stateIO.applySnapshot() → App.api.commitAll()
        // No direct state swapping or manual renders here.
        App.cloudState.apply(rawState);
        App.showToast("Cloud Load 완료 — 최신 데이터가 반영되었습니다.");
        return;
      }

      console.warn('[Cloud Load] Legacy cloud state detected. Applying UI only and resetting data.');

      // Preserve legacy UI payload (when present) BEFORE applying the reset snapshot.
      if (!App.state) App.state = {};
      App.state.ui = App.state.ui || {};

      if (rawState && rawState.ui) {
        if (rawState.ui.calendar) {
          App.state.ui.calendar = App.state.ui.calendar || {};
          var legacyCal = rawState.ui.calendar;
          var todayISO = (App.util && typeof App.util.todayISODate === 'function')
            ? App.util.todayISODate()
            : new Date().toISOString().slice(0, 10);

          // IMPORTANT: Calendar view must only change by explicit user action.
          // Legacy cloud payload may contain view, but applying it would override
          // the in-memory default (WEEK) or the user's current selection.
          // Therefore: keep current view if valid; otherwise fall back to the
          // single-source default.
          var currentView = App.state.ui.calendar.view;
          if (currentView !== 'month' && currentView !== 'week') {
            App.state.ui.calendar.view = (App.getDefaultCalendarView ? App.getDefaultCalendarView() : 'week');
          }
          App.state.ui.calendar.sortMode = legacyCal.sortMode || App.state.ui.calendar.sortMode || 'type';
          App.state.ui.calendar.currentDate = legacyCal.currentDate || App.state.ui.calendar.currentDate || todayISO;
        }

        if (typeof rawState.ui.activeTab === 'string') {
          App.state.ui.activeTab = rawState.ui.activeTab;
        }

        if (rawState.ui.debtorPanel) {
          App.state.ui.debtorPanel = App.state.ui.debtorPanel || {};
          var legacyPanel = rawState.ui.debtorPanel;
          App.state.ui.debtorPanel.mode = legacyPanel.mode || App.state.ui.debtorPanel.mode || 'list';
          App.state.ui.debtorPanel.page = legacyPanel.page || App.state.ui.debtorPanel.page || 1;
          App.state.ui.debtorPanel.searchQuery = legacyPanel.searchQuery || App.state.ui.debtorPanel.searchQuery || '';
          App.state.ui.debtorPanel.selectedDebtorId =
            typeof legacyPanel.selectedDebtorId === 'undefined'
              ? (typeof App.state.ui.debtorPanel.selectedDebtorId === 'undefined'
                  ? null
                  : App.state.ui.debtorPanel.selectedDebtorId)
              : legacyPanel.selectedDebtorId;
        }
      }

      // Reset domain data via stateIO (keeps UI state by default)
      if (App.stateIO && typeof App.stateIO.applySnapshot === 'function') {
        App.stateIO.applySnapshot({
          debtors: [],
          loans: [],
          claims: [],
          cashLogs: [],
          schedules: [],
          riskSettings: null
        }, { keepUI: true });
      } else if (App.stateIO && typeof App.stateIO.resetDataKeepUI === 'function') {
        App.stateIO.resetDataKeepUI();
      } else {
        // Fallback (should not happen): minimal reset without render calls.
        if (!App.state) App.state = {};
        if (Array.isArray(App.state.debtors)) App.state.debtors.length = 0;
        if (Array.isArray(App.state.loans)) App.state.loans.length = 0;
        if (Array.isArray(App.state.claims)) App.state.claims.length = 0;
        if (Array.isArray(App.state.cashLogs)) App.state.cashLogs.length = 0;
        if (App.schedulesEngine && typeof App.schedulesEngine.initEmpty === 'function') {
          App.schedulesEngine.initEmpty();
        }
      }

      App.showToast("Cloud Load 완료 — 최신 데이터가 반영되었습니다.");
      return;
    } catch (err) {
      console.error('[Data] Failed to load data from Supabase:', err);
      if (!userId) {
        App.showToast("Cloud 데이터를 불러올 수 없습니다.");
      } else {
        App.showToast("오류 발생 — 다시 시도해주세요.");
      }
    }
  }





  /**
   * V189 – Overview portfolio summary engine
   * scope: 'debt' | 'loan' | 'claim'
   * dateRange: { from: 'YYYY-MM-DD' | null, to: 'YYYY-MM-DD' | null }
   */
  
    function normalizeScheduleStatus(sc, todayStr) {
    if (!sc) return;

    // PARTIAL 상태는 사용자가 설정한 값을 그대로 유지한다.
    var currentStatus = (sc.status || '').toUpperCase();
    if (currentStatus === 'PARTIAL') {
      return;
    }

    var due = sc.dueDate || sc.due_date || sc.date || null;
    var amount = Number(sc.amount) || 0;
    var paidAmt = Number(sc.paidAmount != null ? sc.paidAmount : sc.partialPaidAmount || 0);

    if (!amount || !due || !todayStr) {
      return;
    }

    // 1) 완납
    if (paidAmt >= amount) {
      sc.status = 'PAID';
      return;
    }

    // 2) 부분납 (금액 기준으로 PARTIAL 도출)
    if (paidAmt > 0 && paidAmt < amount) {
      sc.status = 'PARTIAL';
      return;
    }

    // 3) 미납 (날짜 지났고 아직 한 푼도 안 냄)
    if (due < todayStr && paidAmt <= 0) {
      sc.status = 'OVERDUE';
      return;
    }

    // 4) 예정 (날짜 안 지났고 미납)
    sc.status = 'PLANNED';
  }

function normalizeAllSchedules(todayStr) {
    if (App.schedulesEngine && typeof App.schedulesEngine.normalizeAll === 'function') {
      App.schedulesEngine.normalizeAll(todayStr);
    }
  }



function computePortfolioSummary(scope, dateRange) {
    scope = scope || 'debt';
    // v010 claim portfolio summary: card + schedule hybrid
    if (scope === 'claim') {
      var claims = (App.state && App.state.claims) ? App.state.claims.slice() : [];
      var claimTotal = 0;
      for (var ci = 0; ci < claims.length; ci++) {
        var c = claims[ci];
        if (!c) continue;
        claimTotal += Number(c.amount) || 0;
      }

      var schedulesForClaim = [];
      if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
        try {
          schedulesForClaim = (App.schedulesEngine.getAll() || []).slice();
        } catch (e) {
          schedulesForClaim = [];
        }
      }
      var todayStrClaim = null;
      if (App.util && typeof App.util.formatDate === 'function') {
        todayStrClaim = App.util.formatDate(new Date());
      }
      // 스케줄 상태 정규화
      if (typeof normalizeAllSchedules === 'function') {
        normalizeAllSchedules(todayStrClaim);
      }

      var fromClaim = dateRange && dateRange.from ? dateRange.from : null;
      var toClaim = dateRange && dateRange.to ? dateRange.to : null;

      var paidClaim = 0;
      for (var si = 0; si < schedulesForClaim.length; si++) {
        var sc = schedulesForClaim[si];
        if (!sc || sc.kind !== 'claim') continue;

        var due = sc.dueDate || sc.due_date || null;
        if (fromClaim && due && due < fromClaim) continue;
        if (toClaim && due && due > toClaim) continue;

        var amt = Number(sc.amount) || 0;
        if (!amt) continue;

        var st = (sc.status || '').toUpperCase();
        // 채권은 부분 회수 개념이 없으므로 PAID만 회수금으로 취급
        if (st === 'PAID') {
          paidClaim += amt;
        }
      }

      var outstandingClaim = claimTotal - paidClaim;
      if (outstandingClaim < 0) outstandingClaim = 0;

      return {
        scope: scope,
        plannedAmount: 0,
        paidAmount: paidClaim,
        partialAmount: 0,
        overdueAmount: outstandingClaim,
        totalAmount: claimTotal
      };
    }

    var schedules = [];
    if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      try {
        schedules = (App.schedulesEngine.getAll() || []).slice();
      } catch (e) {
        schedules = [];
      }
    }
    if (!schedules.length) {
      return {
        scope: scope,
        plannedAmount: 0,
        paidAmount: 0,
        partialAmount: 0,
        overdueAmount: 0,
        totalAmount: 0
      };
    }

    var todayStr = null;
    if (App.util && typeof App.util.formatDate === 'function') {
      todayStr = App.util.formatDate(new Date());
    }

    var from = dateRange && dateRange.from ? dateRange.from : null;
    var to = dateRange && dateRange.to ? dateRange.to : null;

    var planned = 0;
    var paid = 0;
    var partial = 0;
    var overdue = 0;

    // 스케줄 상태 정규화 (PAID / PARTIAL / OVERDUE / PLANNED)
    normalizeAllSchedules(todayStr);

    for (var i = 0; i < schedules.length; i++) {
      var sc = schedules[i];
      if (!sc) continue;

      // scope filter
      if (scope === 'loan' && sc.kind !== 'loan') continue;
      if (scope === 'claim' && sc.kind !== 'claim') continue;

      // dateRange filter: dueDate 기준
      var due = sc.dueDate || sc.due_date || null;
      if (from && due && due < from) continue;
      if (to && due && due > to) continue;

      var amount = Number(sc.amount) || 0;
      if (!amount) continue;

      var status = (sc.status || '').toUpperCase();

      if (status === 'PAID') {
        paid += amount;
      } else if (status === 'PARTIAL') {
        // 부분납(PARTIAL)은 "상태"일 뿐이며, 잔액(remaining)의 분류는 dueDate 기준으로만 결정한다.
        // - paidAmount(또는 partialPaidAmount)는 항상 paid로 합산
        // - remaining = amount - paidAmount
        //   - dueDate < todayStr  → overdue += remaining
        //   - dueDate >= todayStr → planned += remaining
        var paidAmt = Number(sc.paidAmount != null ? sc.paidAmount : sc.partialPaidAmount || 0);
        if (paidAmt > 0) {
          paid += paidAmt;
        }

        var remaining = amount - paidAmt;
        if (!isFinite(remaining) || remaining < 0) remaining = 0;

        if (remaining > 0) {
          // dueDate가 없거나 todayStr 산출이 실패한 경우에도 Monitoring 정의(= dueDate < today)와 동일하게,
          // overdue 판정은 오직 dueDate < todayStr 일 때만 true가 되도록 한다. 그 외는 planned로 분류한다.
          if (due && todayStr && due < todayStr) {
            overdue += remaining;
          } else {
            planned += remaining;
          }
        }
      } else if (status === 'OVERDUE') {
        overdue += amount;
      } else if (status === 'PLANNED') {
        planned += amount;
      } else {
        // 기타 상태는 일단 무시 (향후 확장 가능)
      }
    }

var total = planned + paid + overdue;

    return {
      scope: scope,
      plannedAmount: planned,
      paidAmount: paid,
      partialAmount: 0,
      overdueAmount: overdue,
      totalAmount: total
    };
  }


function computeRecoveryFlowSummary(today) {
    var schedules = [];
    if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      try {
        schedules = (App.schedulesEngine.getAll() || []).slice();
      } catch (e) {
        schedules = [];
      }
    }
    if (!schedules.length) {
      return {
        weekPlanned: 0,
        weekActual: 0,
        monthPlanned: 0,
        monthActual: 0
      };
    }

    var baseDate = today instanceof Date ? today : new Date();
    var year = baseDate.getFullYear();
    var month = baseDate.getMonth(); // 0-based
    var day = baseDate.getDay(); // 0=Sun

    // 주 범위 (월요일 시작 기준)
    var diffToMonday = (day === 0 ? -6 : 1 - day); // 월요일이 1
    var weekStart = new Date(baseDate);
    weekStart.setDate(baseDate.getDate() + diffToMonday);
    var weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // 월 범위
    var monthStart = new Date(year, month, 1);
    var monthEnd = new Date(year, month + 1, 0);

    function toKey(d) {
      if (!d) return null;
      var y = d.getFullYear();
      var m = d.getMonth() + 1;
      var dd = d.getDate();
      return y + '-' + (m < 10 ? '0' + m : m) + '-' + (dd < 10 ? '0' + dd : dd);
    }

    var weekStartKey = toKey(weekStart);
    var weekEndKey = toKey(weekEnd);
    var monthStartKey = toKey(monthStart);
    var monthEndKey = toKey(monthEnd);

    var weekPlanned = 0;
    var weekActual = 0;
    var monthPlanned = 0;
    var monthActual = 0;

    for (var i = 0; i < schedules.length; i++) {
      var sc = schedules[i];
      if (!sc) continue;

      var due = sc.dueDate || sc.due_date || null;
      if (!due) continue;

      var amount = Number(sc.amount) || 0;
      if (!amount) continue;

      var paidAmt = Number(sc.paidAmount != null ? sc.paidAmount : sc.partialPaidAmount || 0);

      // 주/월 범위 플래그
      var inWeek = (!weekStartKey || due >= weekStartKey) && (!weekEndKey || due <= weekEndKey);
      var inMonth = (!monthStartKey || due >= monthStartKey) && (!monthEndKey || due <= monthEndKey);

      // 예정금액: 해당 기간에 스케줄된 전체 회차 금액
      var isScheduled = amount > 0;
      // 실제 회수금액: 납입 금액
      var hasActual = paidAmt > 0;

      if (inWeek) {
        if (isScheduled) weekPlanned += amount;
        if (hasActual) weekActual += paidAmt;
      }
      if (inMonth) {
        if (isScheduled) monthPlanned += amount;
        if (hasActual) monthActual += paidAmt;
      }
    }

    return {
      weekPlanned: weekPlanned,
      weekActual: weekActual,
      monthPlanned: monthPlanned,
      monthActual: monthActual
    };
  }


  /**
   * V189 – Recovery flow time-series
   * interval: 'daily' | 'monthly' | 'yearly'
   */
  function computeRecoveryFlowSeries(interval, dateRange) {
    interval = interval || 'daily';
    var schedules = [];
    if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      try {
        schedules = (App.schedulesEngine.getAll() || []).slice();
      } catch (e) {
        schedules = [];
      }
    }
    var from = dateRange && dateRange.from ? dateRange.from : null;
    var to = dateRange && dateRange.to ? dateRange.to : null;

    var buckets = [];
    var planned = [];
    var actual = [];

    if (!schedules.length || !from || !to) {
      return {
        interval: interval,
        buckets: buckets,
        planned: planned,
        actual: actual
      };
    }

    // 간단한 일 단위 버킷 생성 (월/년은 후속 버전에서 정교화 가능)
    var start = new Date(from);
    var end = new Date(to);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return {
        interval: interval,
        buckets: buckets,
        planned: planned,
        actual: actual
      };
    }

    var cursor = new Date(start);
    while (cursor <= end) {
      var y = cursor.getFullYear();
      var m = cursor.getMonth() + 1;
      var d = cursor.getDate();

      var key;
      if (interval === 'yearly') {
        key = String(y);
      } else if (interval === 'monthly') {
        key = y + '-' + (m < 10 ? '0' + m : m);
      } else {
        key = y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
      }

      buckets.push(key);
      planned.push(0);
      actual.push(0);

      cursor.setDate(cursor.getDate() + 1);
    }

    var indexByKey = {};
    for (var i = 0; i < buckets.length; i++) {
      indexByKey[buckets[i]] = i;
    }

    for (var j = 0; j < schedules.length; j++) {
      var sc = schedules[j];
      if (!sc) continue;
      var due = sc.dueDate || sc.due_date || null;
      if (!due) continue;
      if (due < from || due > to) continue;

      var idx = indexByKey[due];
      if (interval === 'monthly') {
        var ym = due.slice(0, 7);
        idx = indexByKey[ym];
      } else if (interval === 'yearly') {
        var yOnly = due.slice(0, 4);
        idx = indexByKey[yOnly];
      }
      if (typeof idx !== 'number' || idx < 0 || idx >= buckets.length) continue;

      var amount = Number(sc.amount) || 0;
      if (!amount) continue;

      var paidAmt = Number(sc.paidAmount != null ? sc.paidAmount : sc.partialPaidAmount || 0);
      var status = (sc.status || '').toUpperCase();

      // 예정 – 해당 날짜에 스케줄된 전체 회차 금액
      if (amount > 0) {
        planned[idx] += amount;
      }
      // 실제 회수 – 납입 금액
      if (paidAmt > 0) {
        actual[idx] += paidAmt;
      }
    }

    return {
      interval: interval,
      buckets: buckets,
      planned: planned,
      actual: actual
    };
  }


  App.data.loadAllFromSupabase = loadAllFromSupabase;

App.data.saveToSupabase = async function () {
  var supa = getSupabase();
  var userId = (App.user && App.user.id) ? App.user.id : null;
  if (!supa || !userId) {
    console.warn('[Cloud Save] Cannot save: not authenticated.');
    App.showToast("Cloud 저장은 로그인 후 사용 가능합니다.");
    return;
  }

  ensureCloudStateModuleLoaded();
  var shareInfo = await getCloudShareInfo(supa, userId);
  if (shareInfo && shareInfo.isShared && shareInfo.isReadOnly && shareInfo.targetUserId && shareInfo.targetUserId !== userId) {
    console.warn('[Cloud Save] Read-only viewer account. Save is blocked.');
    App.showToast("읽기 전용 계정입니다 — Cloud 저장 불가");
    return;
  }

  if (!App.cloudState || typeof App.cloudState.build !== 'function') {
    console.error('[Cloud Save] CloudState module is not available.');
    App.showToast("오류 발생 — 다시 시도해주세요.");
    return;
  }

  
// displayId repair (Loan/Claim): fix invalid ids before persisting to Cloud.
// - Only repairs when displayId exists (no bulk generation).
if (App.util && typeof App.util.repairLoanClaimDisplayIds === 'function') {
  App.util.repairLoanClaimDisplayIds();
}

// displayId (Loan/Claim): generate only at save-time when missing.
  // Must not run during app load/applySnapshot.
  if (App.util && typeof App.util.ensureLoanClaimDisplayIds === 'function') {
    App.util.ensureLoanClaimDisplayIds();
  }

  var snapshot;
  try {
    snapshot = App.cloudState.build();
  } catch (e) {
    console.error('[Cloud Save] Failed to build cloud snapshot:', e);
    App.showToast("오류 발생 — 다시 시도해주세요.");
    return;
  }

  var payload = {
    user_id: userId,
    updated_at: new Date().toISOString(),
    state_json: snapshot
  };

  try {
    var result = await supa
      .from('app_states')
      .upsert(payload, { onConflict: 'user_id' })
      .eq('user_id', userId);

    var error = result && result.error ? result.error : null;
    if (error) {
      console.error('[Cloud Save] Failed:', error);
      App.showToast("오류 발생 — 다시 시도해주세요.");
    } else {
      console.log('[Cloud Save] Success');
      App.showToast("Cloud Save 완료 — Supabase에 저장되었습니다.");
    }
  } catch (err) {
    console.error('[Cloud Save] Unexpected error:', err);
    App.showToast("오류 발생 — 다시 시도해주세요.");
  }
};



  App.data.computePortfolioSummary = computePortfolioSummary;
  App.data.computeRecoveryFlowSummary = computeRecoveryFlowSummary;
  App.data.computeRecoveryFlowSeries = computeRecoveryFlowSeries;

  App.data.buildDebtorsDetailed = buildDebtorsDetailed;
})(window);


// v011 global summary engine
App.data.getLoanSummary = function(dateRange){
  var schedules = [];
  if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
    try {
      schedules = (App.schedulesEngine.getAll() || []).slice();
    } catch (e) {
      schedules = [];
    }
  }
  var total=0, paid=0, partial=0, planned=0, overdue=0;
  schedules.forEach(function(sc){
    if(!sc || sc.kind!=='loan') return;
    var amt = Number(sc.amount)||0;
    var paidAmt = Number(sc.paidAmount||0);
    total += amt;
    var st = (sc.status||'').toUpperCase();
    if(st==='PAID'){ paid+=amt; }
    else if(st==='PARTIAL'){ paid+=paidAmt; overdue+=(amt-paidAmt); }
    else if(st==='PLANNED'){ planned+=amt; }
    else if(st==='OVERDUE'){ overdue+=amt; }
  });
  return {totalAmount:total, paidAmount:paid, partialAmount:partial, plannedAmount:planned, overdueAmount:overdue};
};

App.data.getClaimSummary = function(dateRange){
  var claims = (App.state && App.state.claims)? App.state.claims.slice():[];
  var claimTotal = claims.reduce(function(s,c){ return s+(Number(c.amount)||0); },0);
  var schedules = [];
  if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
    try {
      schedules = (App.schedulesEngine.getAll() || []).slice();
    } catch (e) {
      schedules = [];
    }
  }
  var collected=0;
  schedules.forEach(function(sc){
    if(!sc || sc.kind!=='claim') return;
    var st=(sc.status||'').toUpperCase();
    if(st==='PAID'){ collected += Number(sc.amount)||0; }
  });
  var outstanding = claimTotal - collected;
  if(outstanding<0) outstanding=0;
  return {totalAmount:claimTotal, paidAmount:collected, partialAmount:0, plannedAmount:0, overdueAmount:outstanding};
};

App.data.getPortfolioSummary = function(dateRange){
  return {
    loan: App.data.getLoanSummary(dateRange),
    claim: App.data.getClaimSummary(dateRange)
  };
};