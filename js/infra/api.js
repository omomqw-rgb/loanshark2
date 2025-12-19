(function (window) {
  'use strict';
  if (!window.App) window.App = {};
  var App = window.App;

  // Stage 1: scaffolding only. No domain/state wiring yet.
  if (!App.api) App.api = {};

  if (!App.api.view) App.api.view = {};
  if (!App.api.domain) App.api.domain = {};

  // Stage 6: Debug flags (default OFF)
  // - Keeps production console noise unchanged unless explicitly enabled.
  // - Used by commit/invalidate tracing.
  App.debug = App.debug || {};
  if (typeof App.debug.traceCommit !== 'boolean') App.debug.traceCommit = false;
  if (typeof App.debug.traceInvalidate !== 'boolean') App.debug.traceInvalidate = false;

  function scheduleMicrotask(fn) {
    if (typeof queueMicrotask === 'function') return queueMicrotask(fn);
    if (typeof Promise !== 'undefined' && Promise && typeof Promise.resolve === 'function') {
      return Promise.resolve().then(fn);
    }
    return setTimeout(fn, 0);
  }

  function isArray(x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  }

  function normalizeKeys(keys) {
    if (!keys) return [];
    var list = isArray(keys) ? keys : [keys];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var k = list[i];
      if (!k) continue;
      // Deduplicate while preserving order.
      var exists = false;
      for (var j = 0; j < out.length; j++) {
        if (out[j] === k) { exists = true; break; }
      }
      if (!exists) out.push(k);
    }
    return out;
  }

  // Stage 3: Navigation boundary helpers
  // - We keep the existing render implementations untouched.
  // - We do NOT call render() directly from the navigation API.
  // - We temporarily enable the coordinator for one scheduled flush so that
  //   invalidation can drive the registered renderers without changing other flows.
  function enableCoordinator() {
    if (!App.renderCoordinator || typeof App.renderCoordinator.enable !== 'function' || typeof App.renderCoordinator.disable !== 'function') {
      return;
    }
    App.renderCoordinator.enable();
  }

  function disableCoordinatorSoon() {
    if (!App.renderCoordinator || typeof App.renderCoordinator.disable !== 'function') return;
    scheduleMicrotask(function () {
      try { App.renderCoordinator.disable(); } catch (e) {}
    });
  }

  // Stage 6: Make render registration stable (no per-call anonymous functions)
  // so that duplicate register warnings are meaningful.
  var _navDebtorListRenderer = function () {
    // DOM list mode
    if (App.debtors && typeof App.debtors.updateFilteredList === 'function' && typeof App.debtors.renderList === 'function') {
      App.debtors.updateFilteredList();
      App.debtors.renderList();
      return;
    }
    // Legacy list mode fallback (should be rare in v001)
    if (App.features && App.features.debtors && typeof App.features.debtors.render === 'function') {
      App.features.debtors.render();
    }
  };

  var _navDebtorDetailRenderer = function () {
    var id = null;
    try {
      id = (App.state && App.state.ui && App.state.ui.debtorPanel) ? App.state.ui.debtorPanel.selectedDebtorId : null;
    } catch (e) {
      id = null;
    }
    if (id == null) return;
    id = String(id);
    if (!id) return;

    // Prefer the real DOM render implementation when available.
    if (App.debtorDetail && typeof App.debtorDetail._renderImpl === 'function') {
      App.debtorDetail._renderImpl(id);
      return;
    }

    // Backward fallbacks (avoid hard crash if stage ordering is unexpected)
    if (App.debtorDetail && typeof App.debtorDetail.renderImpl === 'function') {
      App.debtorDetail.renderImpl(id);
      return;
    }
    if (App.debtorDetail && typeof App.debtorDetail.render === 'function' && !App.debtorDetail.render._deprecatedInvalidateWrapper) {
      App.debtorDetail.render(id);
      return;
    }
    if (App.debtors && typeof App.debtors.openDetail === 'function') {
      App.debtors.openDetail(id);
    }
  };

  function ensureNavigationRenderersRegistered() {
    if (!App.renderCoordinator || !App.ViewKey || typeof App.renderCoordinator.register !== 'function') return;

    if (App.ViewKey.DEBTOR_LIST) {
      // If debtorList already registered a safe from-state renderer, don't override it.
      try {
        var existingList =
          App.renderCoordinator &&
          App.renderCoordinator._registry &&
          App.renderCoordinator._registry[App.ViewKey.DEBTOR_LIST];
        if (!(existingList && existingList._ls_fromUIState)) {
          App.renderCoordinator.register(App.ViewKey.DEBTOR_LIST, _navDebtorListRenderer);
        }
      } catch (e) {
        App.renderCoordinator.register(App.ViewKey.DEBTOR_LIST, _navDebtorListRenderer);
      }
    }
    if (App.ViewKey.DEBTOR_DETAIL) {
      // If debtorDetail already registered a safe from-state renderer, don't override it.
      try {
        var existing = App.renderCoordinator._registry && App.renderCoordinator._registry[App.ViewKey.DEBTOR_DETAIL];
        if (existing && existing._ls_fromUIState) return;
      } catch (e) {}
      App.renderCoordinator.register(App.ViewKey.DEBTOR_DETAIL, _navDebtorDetailRenderer);
    }
  }

  function traceCommit(reason, keys) {
    if (!App.debug || !App.debug.traceCommit) return;
    try {
      var list = normalizeKeys(keys);
      console.log('[commit] reason=' + String(reason || ''), list.length ? ('invalidate=' + list.join(', ')) : '');
    } catch (e) {}
  }

  // Stage 6: commit({ reason, invalidate }) as the default API
  function commitInternal(opts) {
    if (!opts) return;
    var reason = opts.reason || opts.label || '';
    var keys = normalizeKeys(opts.invalidate || opts.keys);
    if (!keys.length) return;

    if (!App.renderCoordinator || typeof App.renderCoordinator.invalidate !== 'function') return;

    traceCommit(reason, keys);
    ensureNavigationRenderersRegistered();
    enableCoordinator();
    App.renderCoordinator.invalidate(keys);
    disableCoordinatorSoon();
  }

  if (typeof App.api.commit !== 'function') {
    App.api.commit = function (opts) {
      commitInternal(opts);
    };
  }

  function setDebtorPanelDetailState(debtorId) {
    var id = (debtorId != null) ? String(debtorId) : null;
    if (!id) return;
    if (App.state && App.state.ui && App.state.ui.debtorPanel) {
      App.state.ui.debtorPanel.mode = 'detail';
      App.state.ui.debtorPanel.selectedDebtorId = id;
    }
  }

  function findLoanById(loanId) {
    var id = (loanId != null) ? String(loanId) : null;
    if (!id) return null;
    var state = App.state || {};
    var loans = state.loans || [];
    for (var i = 0; i < loans.length; i++) {
      var loan = loans[i];
      if (!loan) continue;
      if (String(loan.id) === id) return loan;
    }
    return null;
  }

  function findClaimById(claimId) {
    var id = (claimId != null) ? String(claimId) : null;
    if (!id) return null;
    var state = App.state || {};
    var claims = state.claims || [];
    for (var i = 0; i < claims.length; i++) {
      var claim = claims[i];
      if (!claim) continue;
      if (String(claim.id) === id) return claim;
    }
    return null;
  }

  // Stage 4A: commitAll helper
  // - Keep the coordinator passive by default
  // - Temporarily enable it for one scheduled flush to drive registered renderers
  if (typeof App.api.commitAll !== 'function') {
    App.api.commitAll = function () {
      // Safe fallback: full invalidation (kept intentionally)
      var keys = null;
      if (App.ViewKeySet && App.ViewKeySet.ALL_WITH_DERIVED) {
        keys = App.ViewKeySet.ALL_WITH_DERIVED;
      } else if (App.ViewKeySet && App.ViewKeySet.ALL) {
        keys = App.ViewKeySet.ALL;
      } else if (App.ViewKey) {
        keys = [
          App.ViewKey.DERIVED,
          App.ViewKey.DEBTOR_LIST,
          App.ViewKey.DEBTOR_DETAIL,
          App.ViewKey.CALENDAR,
          App.ViewKey.MONITORING,
          App.ViewKey.REPORT
        ];
      }
      commitInternal({ reason: 'commitAll', invalidate: keys });
    };
  }
  if (typeof App.api.view.invalidate !== 'function') {
    App.api.view.invalidate = function (keys) {
      commitInternal({ reason: 'view.invalidate', invalidate: keys });
    };
  }

  
  // UI safety: remove orphan modal scrim that can leave the shell visually/interactively locked.
  // This does NOT close valid modals (it only clears when a .modal-backdrop exists without any .modal).
  function cleanupOrphanModalBackdrop(reason) {
    try {
      var modalRoot = document.getElementById('modal-root');
      if (!modalRoot) return false;
      var hasBackdrop = !!modalRoot.querySelector('.modal-backdrop');
      if (!hasBackdrop) return false;
      var hasModal = !!modalRoot.querySelector('.modal');
      if (hasBackdrop && !hasModal) {
        modalRoot.innerHTML = '';
        try { console.warn('[UI] Cleared orphan modal backdrop:', reason || ''); } catch (e2) {}
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Stage 3: Navigation boundary APIs (List <-> Detail)
  if (typeof App.api.view.openDebtorDetail !== 'function') {
    App.api.view.openDebtorDetail = function (debtorId) {
      var id = (debtorId != null) ? String(debtorId) : null;
      if (!id) return;

      cleanupOrphanModalBackdrop('view.openDebtorDetail');

      if (App.state && App.state.ui && App.state.ui.debtorPanel) {
        App.state.ui.debtorPanel.mode = 'detail';
        App.state.ui.debtorPanel.selectedDebtorId = id;
      }

      // Do not call render() directly. Use commit → invalidate.
      if (App.ViewKey) {
        commitInternal({
          reason: 'view.openDebtorDetail',
          invalidate: [App.ViewKey.DEBTOR_DETAIL, App.ViewKey.DEBTOR_LIST]
        });
      }
    };
  }

  if (typeof App.api.view.openDebtorList !== 'function') {
    App.api.view.openDebtorList = function () {
      cleanupOrphanModalBackdrop('view.openDebtorList');
      if (App.state && App.state.ui && App.state.ui.debtorPanel) {
        App.state.ui.debtorPanel.mode = 'list';
        App.state.ui.debtorPanel.selectedDebtorId = null;
      }

      // Keep existing visibility behavior.
      if (App.debtorPanel && typeof App.debtorPanel.showList === 'function') {
        App.debtorPanel.showList();
      }

      if (App.ViewKey) {
        commitInternal({
          reason: 'view.openDebtorList',
          invalidate: [App.ViewKey.DEBTOR_LIST]
        });
      }
    };
  }

  if (typeof App.api.domain.commit !== 'function') {
    App.api.domain.commit = function (opts) {
      // Deprecated alias kept for legacy compatibility.
      // Prefer: App.api.commit({ reason, invalidate })
      commitInternal(opts);
    };
  }



  // Stage 4B: Derived-data rebuild implementation
  // - Rebuild App.data.* from App.state (Single Source of Truth)
  // - No DOM access. No render calls.
  // - Called from RenderCoordinator.flush when ViewKey.DERIVED is invalidated.
  if (typeof App.rebuildDerived !== 'function' || !App.rebuildDerived._stage4B) {
    var rebuildDerivedStage4B = function (reason) {
      try {
        if (!App.state) App.state = {};
        if (!App.data) App.data = {};

        var debtors = Array.isArray(App.state.debtors) ? App.state.debtors : [];
        var loans = Array.isArray(App.state.loans) ? App.state.loans : [];
        var claims = Array.isArray(App.state.claims) ? App.state.claims : [];

        var schedules = [];
        if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
          schedules = App.schedulesEngine.getAll() || [];
        } else if (Array.isArray(App.state.schedules)) {
          schedules = App.state.schedules;
        }

        // Keep derived loan fields in sync with schedules (same approach as core/data.js).
        if (App.db && typeof App.db.deriveLoanFields === 'function' && loans.length && schedules.length) {
          for (var i = 0; i < loans.length; i++) {
            var loan = loans[i];
            if (!loan || loan.id == null) continue;
            var loanSchedules = [];
            for (var j = 0; j < schedules.length; j++) {
              var sc = schedules[j];
              if (!sc) continue;
              if (sc.loanId === loan.id && String(sc.kind || '').toLowerCase() === 'loan') {
                loanSchedules.push(sc);
              }
            }
            try {
              App.db.deriveLoanFields(loan, loanSchedules);
            } catch (e1) {}
          }
        }

        // Debtor bridge rebuild (used by DOM list + some summary UIs)
        if (App.data && typeof App.data.buildDebtorsDetailed === 'function') {
          var bridge = App.data.buildDebtorsDetailed(debtors, loans, claims, schedules);
          if (bridge) {
            App.data.debtors = Array.isArray(bridge.list) ? bridge.list : [];
            App.data.debtorsDetailed = bridge.byId || {};
          }
        }
      } catch (e) {
        try { console.warn('[Derived] rebuildDerived(stage4B) failed:', e); } catch (e2) {}
      }
    };

    rebuildDerivedStage4B._stage4B = true;
    App.rebuildDerived = rebuildDerivedStage4B;
  }

  // Stage 4B: Debtor CRUD domain API
  if (!App.api.domain.debtor) App.api.domain.debtor = {};
  // Stage 4C: Loan CRUD domain API
  if (!App.api.domain.loan) App.api.domain.loan = {};
  // Stage 4D: Claim CRUD domain API
  if (!App.api.domain.claim) App.api.domain.claim = {};

  function findDebtorById(debtorId) {
    var id = (debtorId != null) ? String(debtorId) : null;
    if (!id) return null;
    var list = (App.state && Array.isArray(App.state.debtors)) ? App.state.debtors : [];
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (d && d.id != null && String(d.id) === id) return d;
    }
    return null;
  }

  function ensureMeta() {
    if (!App.state) App.state = {};
    if (!App.state.meta || typeof App.state.meta !== 'object') {
      App.state.meta = {};
    }
    return App.state.meta;
  }

  function parseIdNumber(id) {
    if (id == null) return 0;
    var m = String(id).match(/(\d+)/);
    if (!m) return 0;
    var n = parseInt(m[1], 10);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  function computeNextCounter(list) {
    var max = 0;
    if (!Array.isArray(list)) return 1;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it || it.id == null) continue;
      var num = parseIdNumber(it.id);
      if (num > max) max = num;
    }
    return max + 1;
  }

  function ensureMetaCounters() {
    var meta = ensureMeta();

    var nextD = Number(meta.nextDebtorId);
    if (!isFinite(nextD) || nextD < 1) nextD = 0;
    var computedD = computeNextCounter((App.state && App.state.debtors) || []);
    meta.nextDebtorId = Math.max(nextD, computedD);

    var nextL = Number(meta.nextLoanId);
    if (!isFinite(nextL) || nextL < 1) nextL = 0;
    var computedL = computeNextCounter((App.state && App.state.loans) || []);
    meta.nextLoanId = Math.max(nextL, computedL);

    var nextC = Number(meta.nextClaimId);
    if (!isFinite(nextC) || nextC < 1) nextC = 0;
    var computedC = computeNextCounter((App.state && App.state.claims) || []);
    meta.nextClaimId = Math.max(nextC, computedC);

    return meta;
  }

  function nextDebtorId() {
    if (!App.state) App.state = {};
    if (!Array.isArray(App.state.debtors)) App.state.debtors = [];
    var meta = ensureMetaCounters();
    var n = meta.nextDebtorId;
    meta.nextDebtorId = n + 1;
    return 'D' + String(n).padStart(3, '0');
  }

  function nextLoanId() {
    if (!App.state) App.state = {};
    if (!Array.isArray(App.state.loans)) App.state.loans = [];
    var meta = ensureMetaCounters();
    var n = meta.nextLoanId;
    meta.nextLoanId = n + 1;
    return 'L' + String(n).padStart(3, '0');
  }

  function nextClaimId() {
    if (!App.state) App.state = {};
    if (!Array.isArray(App.state.claims)) App.state.claims = [];
    var meta = ensureMetaCounters();
    var n = meta.nextClaimId;
    meta.nextClaimId = n + 1;
    return 'C' + String(n).padStart(3, '0');
  }

  if (typeof App.api.domain.debtor.createFromForm !== 'function') {
    App.api.domain.debtor.createFromForm = function (form) {
      if (!form) return;

      var nameInput = form.querySelector('[name="debtor-name"]');
      var noteInput = form.querySelector('[name="debtor-note"]');

      var name = nameInput ? String(nameInput.value || '').trim() : '';
      var note = noteInput ? String(noteInput.value || '').trim() : '';

      // Legacy validation (v001)
      if (!name) {
        alert('이름을 입력하세요.');
        return;
      }

      if (!App.state) App.state = {};
      if (!Array.isArray(App.state.debtors)) App.state.debtors = [];

      var newId = nextDebtorId();
      var today = new Date().toISOString().slice(0, 10);

      var newDebtor = {
        id: newId,
        name: name,
        createdAt: today,
        note: note
      };

      App.state.debtors.push(newDebtor);

      // Legacy UX: auto-open detail after create
      if (!App.state.ui) App.state.ui = {};
      if (!App.state.ui.debtorPanel) App.state.ui.debtorPanel = { mode: 'detail', selectedDebtorId: newId, page: 1 };
      App.state.ui.debtorPanel.page = 1;

      if (App.api && App.api.view && typeof App.api.view.openDebtorDetail === 'function') {
        App.api.view.openDebtorDetail(newId);
      } else {
        // Fallback: just set selection state
        App.state.ui.debtorPanel.mode = 'detail';
        App.state.ui.debtorPanel.selectedDebtorId = newId;
      }

      // Close modal on success (legacy UX)
      if (App.modalManager && typeof App.modalManager.close === 'function') {
        App.modalManager.close();
      }

      // Stage 6: Narrow invalidate scope (still keeps UX identical)
      if (App.api && typeof App.api.commit === 'function' && App.ViewKey) {
        App.api.commit({
          reason: 'debtor-create',
          invalidate: [
            App.ViewKey.DERIVED,
            App.ViewKey.DEBTOR_LIST,
            App.ViewKey.DEBTOR_DETAIL,
            App.ViewKey.CALENDAR,
            App.ViewKey.MONITORING,
            App.ViewKey.REPORT
          ]
        });
      } else if (App.api && typeof App.api.commitAll === 'function') {
        // Fallback (safety)
        App.api.commitAll();
      }
    };
  }

  if (typeof App.api.domain.debtor.editFromForm !== 'function') {
    App.api.domain.debtor.editFromForm = function (form) {
      if (!form) return;

      var id = form.getAttribute('data-debtor-id');
      var debtor = findDebtorById(id);
      if (!debtor) {
        if (App.modalManager && typeof App.modalManager.close === 'function') {
          App.modalManager.close();
        }
        return;
      }

      function getValue(selector) {
        var input = form.querySelector(selector);
        return input ? String(input.value || '').trim() : '';
      }

      var name = getValue('[name="debtor-name"]');
      var phone = getValue('[name="debtor-phone"]');
      var gender = getValue('[name="debtor-gender"]');
      var birth = getValue('[name="debtor-birth"]');
      var region = getValue('[name="debtor-region"]');
      var job = getValue('[name="debtor-job"]');
      var note = getValue('[name="debtor-note"]');
      var manualTier = getValue('[name="debtor-riskTier-manual"]');

      // Legacy validation (v001)
      if (!name) {
        alert('이름을 입력하세요.');
        return;
      }

      // Legacy riskTier rules
      var autoTier = debtor.riskTierAuto || debtor.riskTier || '';
      if (!autoTier) autoTier = 'B';
      var finalTier = manualTier || autoTier || 'B';

      debtor.name = name;
      debtor.phone = phone;
      debtor.gender = gender;
      debtor.birth = birth;
      debtor.region = region;
      debtor.job = job;
      debtor.note = note;
      debtor.riskTierAuto = autoTier;
      debtor.riskTierManual = manualTier || '';
      debtor.riskTier = finalTier;

      // Keep selection on the edited debtor (legacy UX)
      if (!App.state.ui) App.state.ui = {};
      if (!App.state.ui.debtorPanel) App.state.ui.debtorPanel = {};
      if (id != null) {
        App.state.ui.debtorPanel.selectedDebtorId = String(id);
      }

      // Close modal on success (legacy UX)
      if (App.modalManager && typeof App.modalManager.close === 'function') {
        App.modalManager.close();
      }

      // Stage 6: Narrow invalidate scope
      if (App.api && typeof App.api.commit === 'function' && App.ViewKey) {
        App.api.commit({
          reason: 'debtor-edit',
          invalidate: [
            App.ViewKey.DERIVED,
            App.ViewKey.DEBTOR_LIST,
            App.ViewKey.DEBTOR_DETAIL,
            App.ViewKey.CALENDAR,
            App.ViewKey.MONITORING,
            App.ViewKey.REPORT
          ]
        });
      } else if (App.api && typeof App.api.commitAll === 'function') {
        App.api.commitAll();
      }
    };
  }

  if (typeof App.api.domain.debtor.deleteById !== 'function') {
    App.api.domain.debtor.deleteById = function (debtorId) {
      var id = (debtorId != null) ? String(debtorId) : null;
      if (!id) return;

      // Legacy confirm (v001)
      if (!window.confirm('채무자를 삭제하면 관련 대출·채권 카드도 함께 삭제됩니다. 계속할까요?')) {
        return;
      }

      if (!App.state) App.state = {};

      var state = App.state;
      var debtors = Array.isArray(state.debtors) ? state.debtors : [];
      var loans = Array.isArray(state.loans) ? state.loans : [];
      var claims = Array.isArray(state.claims) ? state.claims : [];

      state.debtors = debtors.filter(function (d) {
        return d && String(d.id) !== id;
      });

      state.loans = loans.filter(function (loan) {
        return loan && String(loan.debtorId) !== id;
      });

      state.claims = claims.filter(function (claim) {
        return claim && String(claim.debtorId) !== id;
      });

      if (App.schedulesEngine && typeof App.schedulesEngine.removeByDebtorId === 'function') {
        App.schedulesEngine.removeByDebtorId(id);
      }

      // Legacy UX: go back to list
      if (App.api && App.api.view && typeof App.api.view.openDebtorList === 'function') {
        App.api.view.openDebtorList();
      } else {
        if (!state.ui) state.ui = {};
        if (!state.ui.debtorPanel) state.ui.debtorPanel = {};
        state.ui.debtorPanel.mode = 'list';
        state.ui.debtorPanel.selectedDebtorId = null;
        if (App.debtorPanel && typeof App.debtorPanel.showList === 'function') {
          App.debtorPanel.showList();
        }
      }

      // Stage 6: Narrow invalidate scope
      if (App.api && typeof App.api.commit === 'function' && App.ViewKey) {
        App.api.commit({
          reason: 'debtor-delete',
          invalidate: [
            App.ViewKey.DERIVED,
            App.ViewKey.DEBTOR_LIST,
            App.ViewKey.DEBTOR_DETAIL,
            App.ViewKey.CALENDAR,
            App.ViewKey.MONITORING,
            App.ViewKey.REPORT
          ]
        });
      } else if (App.api && typeof App.api.commitAll === 'function') {
        App.api.commitAll();
      }
    };
  }

  // Stage 4C: Loan CRUD domain API
  if (typeof App.api.domain.loan.createFromForm !== 'function') {
    App.api.domain.loan.createFromForm = function (form) {
      if (!form) return;

      var debtorId = form.getAttribute('data-debtor-id');
      if (!debtorId) return;

      var principal = Number(form.querySelector('[name="loan-principal"]').value || 0);
      var rate = Number(form.querySelector('[name="loan-rate"]').value || 0);
      var total = Number(form.querySelector('[name="loan-total"]').value || 0);
      var count = Number(form.querySelector('[name="loan-count"]').value || 1);
      var cycleType = form.querySelector('[name="loan-cycle-type"]').value || 'day';
      var dayInterval = Number(form.querySelector('[name="loan-day-interval"]').value || 7);
      var weekDayStr = form.querySelector('[name="loan-weekday"]').value;
      var weekDay = weekDayStr === '' ? null : Number(weekDayStr);
      var startDate = form.querySelector('[name="loan-start-date"]').value || new Date().toISOString().slice(0, 10);

      // Legacy validation (v001)
      if (!principal) {
        alert('원금을 입력하세요.');
        return;
      }
      if (!total) {
        alert('원리금을 입력하세요.');
        return;
      }
      if (!count || count < 1) {
        alert('회차 수를 1 이상으로 입력하세요.');
        return;
      }

      if (!App.state) App.state = {};
      if (!Array.isArray(App.state.loans)) App.state.loans = [];

      var newId = nextLoanId();

      var loan = {
        id: newId,
        debtorId: debtorId,
        principal: principal,
        interestRate: rate,
        totalRepayAmount: total,
        installmentCount: count,
        cycleType: cycleType,
        dayInterval: dayInterval,
        weekDay: weekDay,
        startDate: startDate
      };

      App.state.loans.push(loan);

      // schedules regeneration (legacy logic)
      if (App.db && typeof App.db.rebuildSchedulesForLoan === 'function') {
        App.db.rebuildSchedulesForLoan(newId);
      }

      // Close modal on success (legacy UX)
      if (App.modalManager && typeof App.modalManager.close === 'function') {
        App.modalManager.close();
      }

      // Stage 6: Narrow invalidate scope
      if (App.api && typeof App.api.commit === 'function' && App.ViewKey) {
        App.api.commit({
          reason: 'loan-create',
          invalidate: [
            App.ViewKey.DERIVED,
            App.ViewKey.DEBTOR_LIST,
            App.ViewKey.DEBTOR_DETAIL,
            App.ViewKey.CALENDAR,
            App.ViewKey.MONITORING,
            App.ViewKey.REPORT
          ]
        });
      } else if (App.api && typeof App.api.commitAll === 'function') {
        App.api.commitAll();
      }
    };
  }

  if (typeof App.api.domain.loan.editFromForm !== 'function') {
    App.api.domain.loan.editFromForm = function (form) {
      if (!form) return;

      var loanId = form.getAttribute('data-loan-id');
      var loan = findLoanById(loanId);
      if (!loan) {
        if (App.modalManager && typeof App.modalManager.close === 'function') {
          App.modalManager.close();
        }
        return;
      }

      var principal = Number(form.querySelector('[name="loan-principal"]').value || 0);
      var rate = Number(form.querySelector('[name="loan-rate"]').value || 0);
      var total = Number(form.querySelector('[name="loan-total"]').value || 0);
      var count = Number(form.querySelector('[name="loan-count"]').value || 1);
      var cycleType = form.querySelector('[name="loan-cycle-type"]').value || 'day';
      var dayInterval = Number(form.querySelector('[name="loan-day-interval"]').value || 7);
      var weekDayStr = form.querySelector('[name="loan-weekday"]').value;
      var weekDay = weekDayStr === '' ? null : Number(weekDayStr);
      var startDate = form.querySelector('[name="loan-start-date"]').value || new Date().toISOString().slice(0, 10);

      // Legacy validation (v001)
      if (!principal) {
        alert('원금을 입력하세요.');
        return;
      }
      if (!total) {
        alert('원리금을 입력하세요.');
        return;
      }
      if (!count || count < 1) {
        alert('회차 수를 1 이상으로 입력하세요.');
        return;
      }

      loan.principal = principal;
      loan.interestRate = rate;
      loan.totalRepayAmount = total;
      loan.installmentCount = count;
      loan.cycleType = cycleType;
      loan.dayInterval = dayInterval;
      loan.weekDay = weekDay;
      loan.startDate = startDate;

      // schedules regeneration (legacy logic)
      if (App.db && typeof App.db.rebuildSchedulesForLoan === 'function') {
        App.db.rebuildSchedulesForLoan(loanId);
      }

      // Close modal on success (legacy UX)
      if (App.modalManager && typeof App.modalManager.close === 'function') {
        App.modalManager.close();
      }

      // Stage 6: Narrow invalidate scope
      if (App.api && typeof App.api.commit === 'function' && App.ViewKey) {
        App.api.commit({
          reason: 'loan-edit',
          invalidate: [
            App.ViewKey.DERIVED,
            App.ViewKey.DEBTOR_LIST,
            App.ViewKey.DEBTOR_DETAIL,
            App.ViewKey.CALENDAR,
            App.ViewKey.MONITORING,
            App.ViewKey.REPORT
          ]
        });
      } else if (App.api && typeof App.api.commitAll === 'function') {
        App.api.commitAll();
      }
    };
  }

  if (typeof App.api.domain.loan.deleteById !== 'function') {
    App.api.domain.loan.deleteById = function (loanId) {
      var id = (loanId != null) ? String(loanId) : null;
      if (!id) return;

      var loan = findLoanById(id);
      if (!loan) return;

      // Legacy confirm (v001)
      if (!window.confirm('대출 카드를 삭제할까요?')) return;

      if (!App.state) App.state = {};
      if (!Array.isArray(App.state.loans)) App.state.loans = [];

      // Remove in-place (preserves any legacy alias pointers)
      var loans = App.state.loans;
      for (var i = 0; i < loans.length; i++) {
        var item = loans[i];
        if (item && item.id != null && String(item.id) === id) {
          loans.splice(i, 1);
          break;
        }
      }

      if (App.schedulesEngine && typeof App.schedulesEngine.removeByLoanId === 'function') {
        App.schedulesEngine.removeByLoanId(id);
      }

      // Stage 6: Narrow invalidate scope
      if (App.api && typeof App.api.commit === 'function' && App.ViewKey) {
        App.api.commit({
          reason: 'loan-delete',
          invalidate: [
            App.ViewKey.DERIVED,
            App.ViewKey.DEBTOR_LIST,
            App.ViewKey.DEBTOR_DETAIL,
            App.ViewKey.CALENDAR,
            App.ViewKey.MONITORING,
            App.ViewKey.REPORT
          ]
        });
      } else if (App.api && typeof App.api.commitAll === 'function') {
        App.api.commitAll();
      }
    };
  }
  // Stage 4A: Schedule save domain API
  if (!App.api.domain.schedule) App.api.domain.schedule = {};

  if (typeof App.api.domain.schedule.saveLoanFromForm !== 'function') {
    App.api.domain.schedule.saveLoanFromForm = function (form) {
      if (!form) return;

      // Align selected debtor state to match legacy UX (engine used to call debtorDetail.render(debtorId)).
      var loanId = form.getAttribute('data-loan-id');
      var loan = findLoanById(loanId);
      if (loan && loan.debtorId != null) {
        setDebtorPanelDetailState(loan.debtorId);
      }

      if (App.schedulesEngine && typeof App.schedulesEngine.bulkUpdateFromLoanForm === 'function') {
        App.schedulesEngine.bulkUpdateFromLoanForm(form);
      }

      // Close modal (legacy UX)
      if (App.modalManager && typeof App.modalManager.close === 'function') {
        App.modalManager.close();
      }

      // Stage 6: Narrow invalidate scope (schedule-save affects monitoring/report)
      if (App.api && typeof App.api.commit === 'function' && App.ViewKey) {
        App.api.commit({
          reason: 'schedule-save-loan',
          invalidate: [
            App.ViewKey.DERIVED,
            App.ViewKey.DEBTOR_DETAIL,
            App.ViewKey.CALENDAR,
            App.ViewKey.MONITORING,
            App.ViewKey.REPORT
          ]
        });
      } else if (App.api && typeof App.api.commitAll === 'function') {
        App.api.commitAll();
      }
    };
  }

  
  // Stage 4D: Claim CRUD domain API
  if (typeof App.api.domain.claim.createFromForm !== 'function') {
    App.api.domain.claim.createFromForm = function (form) {
      if (!form) return;

      var debtorId = form.getAttribute('data-debtor-id');
      if (!debtorId) return;

      var amount = Number(form.querySelector('[name="claim-amount"]').value || 0);
      var count = Number(form.querySelector('[name="claim-count"]').value || 1);
      var startDate = form.querySelector('[name="claim-start-date"]').value || new Date().toISOString().slice(0, 10);
      var cycleType = form.querySelector('[name="claim-cycle-type"]').value || 'day';
      var dayInterval = Number(form.querySelector('[name="claim-day-interval"]').value || 7);
      var weekDayStr = form.querySelector('[name="claim-weekday"]').value;
      var weekDay = weekDayStr === '' ? null : Number(weekDayStr);
      var memoInput = form.querySelector('[name="claim-memo"]');
      var memo = memoInput ? memoInput.value : '';

      // Legacy validation (v001)
      if (!amount) {
        alert('채권금을 입력하세요.');
        return;
      }
      if (!count || count < 1) {
        alert('회차 수를 1 이상으로 입력하세요.');
        return;
      }

      if (!App.state) App.state = {};
      if (!Array.isArray(App.state.claims)) App.state.claims = [];

      var newId = nextClaimId();
      var claim = {
        id: newId,
        debtorId: debtorId,
        amount: amount,
        installmentCount: count,
        startDate: startDate,
        cycleType: cycleType,
        dayInterval: dayInterval,
        weekDay: weekDay,
        createdAt: startDate,
        memo: memo,
        cardStatus: '진행'
      };

      App.state.claims.push(claim);

      // schedules regeneration (legacy logic)
      if (App.db && typeof App.db.rebuildSchedulesForClaim === 'function') {
        App.db.rebuildSchedulesForClaim(newId);
      }

      // Close modal on success (legacy UX)
      if (App.modalManager && typeof App.modalManager.close === 'function') {
        App.modalManager.close();
      }

      // Keep current debtor detail view (legacy UX)
      setDebtorPanelDetailState(debtorId);

      // Stage 6: Narrow invalidate scope
      if (App.api && typeof App.api.commit === 'function' && App.ViewKey) {
        App.api.commit({
          reason: 'claim-create',
          invalidate: [
            App.ViewKey.DERIVED,
            App.ViewKey.DEBTOR_LIST,
            App.ViewKey.DEBTOR_DETAIL,
            App.ViewKey.CALENDAR,
            App.ViewKey.MONITORING,
            App.ViewKey.REPORT
          ]
        });
      } else if (App.api && typeof App.api.commitAll === 'function') {
        App.api.commitAll();
      }
    };
  }

  if (typeof App.api.domain.claim.editFromForm !== 'function') {
    App.api.domain.claim.editFromForm = function (form) {
      if (!form) return;

      var claimId = form.getAttribute('data-claim-id');
      var claim = findClaimById(claimId);
      if (!claim) {
        if (App.modalManager && typeof App.modalManager.close === 'function') {
          App.modalManager.close();
        }
        return;
      }

      var amount = Number(form.querySelector('[name="claim-amount"]').value || 0);
      var count = Number(form.querySelector('[name="claim-count"]').value || 1);
      var startDate = form.querySelector('[name="claim-start-date"]').value || new Date().toISOString().slice(0, 10);
      var cycleType = form.querySelector('[name="claim-cycle-type"]').value || 'day';
      var dayInterval = Number(form.querySelector('[name="claim-day-interval"]').value || 7);
      var weekDayStr = form.querySelector('[name="claim-weekday"]').value;
      var weekDay = weekDayStr === '' ? null : Number(weekDayStr);
      var memoInput = form.querySelector('[name="claim-memo"]');
      var memo = memoInput ? memoInput.value : '';

      // Legacy validation (v001)
      if (!amount) {
        alert('채권금을 입력하세요.');
        return;
      }
      if (!count || count < 1) {
        alert('회차 수를 1 이상으로 입력하세요.');
        return;
      }

      claim.amount = amount;
      claim.installmentCount = count;
      claim.startDate = startDate;
      claim.cycleType = cycleType;
      claim.dayInterval = dayInterval;
      claim.weekDay = weekDay;
      claim.memo = memo;

      // schedules regeneration (legacy logic)
      if (App.db && typeof App.db.rebuildSchedulesForClaim === 'function') {
        App.db.rebuildSchedulesForClaim(claimId);
      }

      // Close modal on success (legacy UX)
      if (App.modalManager && typeof App.modalManager.close === 'function') {
        App.modalManager.close();
      }

      if (claim && claim.debtorId != null) {
        setDebtorPanelDetailState(claim.debtorId);
      }

      // Stage 6: Narrow invalidate scope
      if (App.api && typeof App.api.commit === 'function' && App.ViewKey) {
        App.api.commit({
          reason: 'claim-edit',
          invalidate: [
            App.ViewKey.DERIVED,
            App.ViewKey.DEBTOR_LIST,
            App.ViewKey.DEBTOR_DETAIL,
            App.ViewKey.CALENDAR,
            App.ViewKey.MONITORING,
            App.ViewKey.REPORT
          ]
        });
      } else if (App.api && typeof App.api.commitAll === 'function') {
        App.api.commitAll();
      }
    };
  }

  if (typeof App.api.domain.claim.deleteById !== 'function') {
    App.api.domain.claim.deleteById = function (claimId) {
      var id = (claimId != null) ? String(claimId) : null;
      if (!id) return;

      var claim = findClaimById(id);
      if (!claim) return;

      // Legacy confirm (v001)
      if (!window.confirm('채권 카드를 삭제할까요?')) return;

      // Remove from App.state.claims (in-place)
      if (!App.state) App.state = {};
      var claims = App.state.claims;
      if (Array.isArray(claims)) {
        for (var i = 0; i < claims.length; i++) {
          var c = claims[i];
          if (c && String(c.id) === id) {
            claims.splice(i, 1);
            break;
          }
        }
      }

      // Remove schedules
      if (App.schedulesEngine && typeof App.schedulesEngine.removeByClaimId === 'function') {
        App.schedulesEngine.removeByClaimId(id);
      }

      if (claim && claim.debtorId != null) {
        setDebtorPanelDetailState(claim.debtorId);
      }

      // Stage 6: Narrow invalidate scope
      if (App.api && typeof App.api.commit === 'function' && App.ViewKey) {
        App.api.commit({
          reason: 'claim-delete',
          invalidate: [
            App.ViewKey.DERIVED,
            App.ViewKey.DEBTOR_LIST,
            App.ViewKey.DEBTOR_DETAIL,
            App.ViewKey.CALENDAR,
            App.ViewKey.MONITORING,
            App.ViewKey.REPORT
          ]
        });
      } else if (App.api && typeof App.api.commitAll === 'function') {
        App.api.commitAll();
      }
    };
  }

  if (typeof App.api.domain.schedule.saveClaimFromForm !== 'function') {
    App.api.domain.schedule.saveClaimFromForm = function (form) {
      if (!form) return;

      // Align selected debtor state to match legacy UX (engine used to call debtorDetail.render(debtorId)).
      var claimId = form.getAttribute('data-claim-id');
      var claim = findClaimById(claimId);
      if (claim && claim.debtorId != null) {
        setDebtorPanelDetailState(claim.debtorId);
      }

      if (App.schedulesEngine && typeof App.schedulesEngine.bulkUpdateFromClaimForm === 'function') {
        App.schedulesEngine.bulkUpdateFromClaimForm(form);
      }

      // Close modal (legacy UX)
      if (App.modalManager && typeof App.modalManager.close === 'function') {
        App.modalManager.close();
      }

      // Stage 6: Narrow invalidate scope (schedule-save affects monitoring/report)
      if (App.api && typeof App.api.commit === 'function' && App.ViewKey) {
        App.api.commit({
          reason: 'schedule-save-claim',
          invalidate: [
            App.ViewKey.DERIVED,
            App.ViewKey.DEBTOR_DETAIL,
            App.ViewKey.CALENDAR,
            App.ViewKey.MONITORING,
            App.ViewKey.REPORT
          ]
        });
      } else if (App.api && typeof App.api.commitAll === 'function') {
        App.api.commitAll();
      }
    };
  }
})(window);
