(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  App.ui = App.ui || {};

  var MOBILE_MAX_WIDTH = 900;

  var state = {
    isMobile: false,
    // v3.2.7: Mobile에서도 Desktop과 동일하게 쓰기 기능을 허용한다.
    // (과거 Mobile Read-only 정책은 제거/미사용화)
    readOnly: false,
    initialized: false,
    desktopSlot: null,
    observer: null,
    hasSetInitialTab: false
  };

  function computeIsMobile() {
    try {
      if (window.matchMedia) {
        return window.matchMedia('(max-width: ' + MOBILE_MAX_WIDTH + 'px)').matches;
      }
    } catch (e) {}
    return (window.innerWidth || 0) <= MOBILE_MAX_WIDTH;
  }

  function setRootClasses(isMobile) {
    var root = document.documentElement;
    if (!root) return;

    if (isMobile) {
      root.classList.add('ls-mobile');
      // v3.2.7: 모바일에서도 Read-only 클래스를 적용하지 않는다.
      root.classList.remove('ls-readonly');
    } else {
      root.classList.remove('ls-mobile');
      root.classList.remove('ls-readonly');
    }
  }

  function ensureDesktopSlot() {
    if (state.desktopSlot) return state.desktopSlot;

    var sidepanel = document.getElementById('debtor-sidepanel');
    if (!sidepanel) return null;

    state.desktopSlot = {
      parent: sidepanel.parentNode,
      next: sidepanel.nextSibling
    };
    return state.desktopSlot;
  }

  function moveDebtorSidepanel(isMobile) {
    var sidepanel = document.getElementById('debtor-sidepanel');
    if (!sidepanel) return;

    var mobileHost = document.getElementById('mobile-debtor-host');
    var desktopSlot = ensureDesktopSlot();

    if (isMobile) {
      if (mobileHost && sidepanel.parentNode !== mobileHost) {
        mobileHost.appendChild(sidepanel);
      }
    } else {
      if (desktopSlot && desktopSlot.parent) {
        if (sidepanel.parentNode !== desktopSlot.parent) {
          // Restore to original place (before the original next sibling if still present)
          if (desktopSlot.next && desktopSlot.next.parentNode === desktopSlot.parent) {
            desktopSlot.parent.insertBefore(sidepanel, desktopSlot.next);
          } else {
            desktopSlot.parent.appendChild(sidepanel);
          }
        }
      }
    }
  }

  function setActiveTab(tabKey) {
    if (!tabKey) return;

    var buttons = document.querySelectorAll('.tab-btn[data-tab]');
    var panels = document.querySelectorAll('.tab-panel');

    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var k = b.getAttribute('data-tab');
      if (k === tabKey) b.classList.add('is-active');
      else b.classList.remove('is-active');
    }

    for (var j = 0; j < panels.length; j++) {
      var p = panels[j];
      if (p.id === 'tab-' + tabKey) p.classList.add('is-active');
      else p.classList.remove('is-active');
    }
  }

  function showToast(msg) {
    if (typeof App.showToast === 'function') {
      App.showToast(msg);
    }
  }

  function setDisabledByMobile(el, disabled) {
    if (!el) return;

    // Only touch form-like controls (button/select/input)
    var tag = (el.tagName || '').toUpperCase();
    var isFormControl = (tag === 'BUTTON' || tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA');

    if (disabled) {
      if (isFormControl) {
        if (!el.disabled) {
          el.disabled = true;
          el.dataset.lsMobileDisabled = '1';
        }
      }
      el.classList.add('ls-disabled');
      el.setAttribute('aria-disabled', 'true');
    } else {
      if (el.dataset && el.dataset.lsMobileDisabled === '1') {
        if (isFormControl) el.disabled = false;
        delete el.dataset.lsMobileDisabled;
      }
      el.classList.remove('ls-disabled');
      el.removeAttribute('aria-disabled');
    }
  }

  function restoreDisabledUI() {
    var els = document.querySelectorAll('[data-ls-mobile-disabled="1"], .ls-disabled');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      setDisabledByMobile(el, false);
    }
  }

  function applyReadOnlyUI(shouldReadOnly) {
    if (!shouldReadOnly) {
      restoreDisabledUI();
      return;
    }

    var selectors = [
      // Global save buttons (policy: Save ❌)
      '#local-save-btn',
      '#cloud-save-btn',

      // Debtor CRUD
      '[data-action="debtor-add"]',
      '[data-action="debtor-open-create"]',
      '[data-action="debtor-open-edit"]',
      '[data-action="debtor-delete"]',

      // Loan CRUD + schedule edit
      '[data-action="loan-open-create"]',
      '[data-action="loan-open-edit"]',
      '[data-action="loan-delete"]',

      // Claim CRUD + schedule edit
      '[data-action="claim-open-create"]',
      '[data-action="claim-open-edit"]',
      '[data-action="claim-delete"]',

      // Status change (write)
      'select[data-action="card-status-change"]',

      // Available Capital modal (read-only view allowed; editing controls disabled)
      '.available-capital-modal .avail-action-btn',
      '.available-capital-modal .ledger-mini-btn',
      '.available-capital-modal .ledger-editor-btn.is-save',
      '.available-capital-modal .ledger-editor .ledger-input'
    ];

    for (var s = 0; s < selectors.length; s++) {
      var list = document.querySelectorAll(selectors[s]);
      for (var i = 0; i < list.length; i++) {
        setDisabledByMobile(list[i], true);
      }
    }

    // Seed schedule modal control snapshots early so "value change" guards can reliably revert.
    // (Some mobile browsers may fire change before focusin.)
    seedScheduleModalSnapshots();
  }

  function seedScheduleModalSnapshots() {
    if (!isReadOnly()) return;
    var forms = document.querySelectorAll(
      'form[data-role="modal-form"][data-modal-kind="schedule-loan"], form[data-role="modal-form"][data-modal-kind="schedule-claim"]'
    );
    for (var f = 0; f < forms.length; f++) {
      var form = forms[f];
      if (!form) continue;

      var controls = form.querySelectorAll('select, input, textarea');
      for (var i = 0; i < controls.length; i++) {
        var el = controls[i];
        if (!el || !el.dataset) continue;
        if (el.dataset.lsRoSnapshot === '1') continue;

        var tag = (el.tagName || '').toUpperCase();
        try {
          el.dataset.lsRoSnapshot = '1';
          if (tag === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
            el.dataset.lsRoChecked = el.checked ? '1' : '0';
          } else {
            el.dataset.lsRoValue = el.value != null ? String(el.value) : '';
          }
        } catch (e) {}
      }
    }
  }

  function isReadOnly() {
    return !!state.readOnly;
  }

  function wrapFn(obj, key, msg) {
    if (!obj) return;
    var fn = obj[key];
    if (typeof fn !== 'function') return;
    if (fn._lsMobileGuarded) return;

    var wrapped = function () {
      if (isReadOnly()) {
        showToast(msg);
        return;
      }
      return fn.apply(this, arguments);
    };

    wrapped._lsMobileGuarded = true;
    wrapped._lsOriginal = fn;

    obj[key] = wrapped;
  }

  function applyWriteGuards() {
    // Save is blocked on mobile
    if (App.local) wrapFn(App.local, 'save', '모바일(Read-only)에서는 저장할 수 없습니다.');
    if (App.data) wrapFn(App.data, 'saveToSupabase', '모바일(Read-only)에서는 Cloud Save가 차단됩니다.');

    // Domain CRUD + schedule save
    if (App.api && App.api.domain) {
      if (App.api.domain.debtor) {
        wrapFn(App.api.domain.debtor, 'createFromForm', '모바일(Read-only)에서는 생성할 수 없습니다.');
        wrapFn(App.api.domain.debtor, 'editFromForm', '모바일(Read-only)에서는 수정할 수 없습니다.');
        wrapFn(App.api.domain.debtor, 'deleteById', '모바일(Read-only)에서는 삭제할 수 없습니다.');
      }
      if (App.api.domain.loan) {
        wrapFn(App.api.domain.loan, 'createFromForm', '모바일(Read-only)에서는 생성할 수 없습니다.');
        wrapFn(App.api.domain.loan, 'editFromForm', '모바일(Read-only)에서는 수정할 수 없습니다.');
        wrapFn(App.api.domain.loan, 'deleteById', '모바일(Read-only)에서는 삭제할 수 없습니다.');
      }
      if (App.api.domain.claim) {
        wrapFn(App.api.domain.claim, 'createFromForm', '모바일(Read-only)에서는 생성할 수 없습니다.');
        wrapFn(App.api.domain.claim, 'editFromForm', '모바일(Read-only)에서는 수정할 수 없습니다.');
        wrapFn(App.api.domain.claim, 'deleteById', '모바일(Read-only)에서는 삭제할 수 없습니다.');
      }
      if (App.api.domain.schedule) {
        wrapFn(App.api.domain.schedule, 'saveLoanFromForm', '모바일(Read-only)에서는 저장할 수 없습니다.');
        wrapFn(App.api.domain.schedule, 'saveClaimFromForm', '모바일(Read-only)에서는 저장할 수 없습니다.');
      }
    }

    // Modal entry points (avoid opening write modals on mobile)
    if (App.modalManager) {
      wrapFn(App.modalManager, 'openDebtorModal', '모바일(Read-only)에서는 생성/수정 모달을 열 수 없습니다.');
      wrapFn(App.modalManager, 'openLoanModal', '모바일(Read-only)에서는 생성/수정 모달을 열 수 없습니다.');
      wrapFn(App.modalManager, 'openClaimModal', '모바일(Read-only)에서는 생성/수정 모달을 열 수 없습니다.');
    }

    // KPI detail modals are allowed to open on mobile (view-only).
    // Editing controls inside those modals are disabled via applyReadOnlyUI + capture guards.
  }

  function isScheduleModalControl(el) {
    if (!el || !el.closest) return false;
    var form = el.closest('form[data-role="modal-form"][data-modal-kind]');
    if (!form) return false;
    var kind = String(form.getAttribute('data-modal-kind') || '');
    return kind === 'schedule-loan' || kind === 'schedule-claim';
  }

  function attachReadOnlyValueGuards() {
    // NOTE: Mobile Read-only v2 policy
    // - Opening modals is allowed.
    // - Blocking happens only when attempting to change values / submit.
    function ensureSnapshot(el) {
      if (!el || !el.dataset) return;
      if (el.dataset.lsRoSnapshot === '1') return;

      var tag = (el.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        try {
          el.dataset.lsRoSnapshot = '1';
          if (tag === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
            el.dataset.lsRoChecked = el.checked ? '1' : '0';
          } else {
            el.dataset.lsRoValue = el.value != null ? String(el.value) : '';
          }
        } catch (e) {}
      }
    }

    function restoreSnapshot(el) {
      if (!el || !el.dataset) return;
      var tag = (el.tagName || '').toUpperCase();
      if (tag === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
        el.checked = el.dataset.lsRoChecked === '1';
        return;
      }
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (el.dataset.lsRoValue != null) {
          el.value = el.dataset.lsRoValue;
        }
      }
    }

    // Snapshot the initial value on focus/touch
    document.addEventListener('focusin', function (event) {
      if (!isReadOnly()) return;
      var el = event && event.target;
      if (!isScheduleModalControl(el)) return;
      ensureSnapshot(el);
    }, true);

    // Touch devices sometimes don't trigger focus before change; capture pointerdown.
    document.addEventListener('pointerdown', function (event) {
      if (!isReadOnly()) return;
      var el = event && event.target;
      if (!isScheduleModalControl(el)) return;
      ensureSnapshot(el);
    }, true);

    // Prevent value changes inside schedule modals.
    var lastToastAt = 0;
    function onValueAttempt(event) {
      if (!isReadOnly()) return;
      var el = event && event.target;
      if (!isScheduleModalControl(el)) return;

      // Allow focus/copy, but revert any actual change.
      ensureSnapshot(el);
      restoreSnapshot(el);

      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
      // Do not call preventDefault here: many input/change events are not cancelable.
      var now = Date.now();
      if (now - lastToastAt > 900) {
        lastToastAt = now;
        showToast('모바일(Read-only)에서는 값 변경이 불가합니다.');
      }
    }

    document.addEventListener('change', onValueAttempt, true);
    document.addEventListener('input', onValueAttempt, true);
  }

  function attachCaptureGuards() {
    // Guard click targets that still might fire even if UI isn't disabled yet.
    document.addEventListener('click', function (event) {
      if (!isReadOnly()) return;

      var t = event.target;


      // v3.2.3: Schedule modals MUST be allowed to open on mobile (view-only).
      // Some click paths rely on bubble-phase delegation; handle explicitly in capture to guarantee open.
      var schedLoanEl = t && t.closest && t.closest('[data-action="loan-open-schedule"][data-loan-id]');
      if (schedLoanEl) {
        var loanId = schedLoanEl.getAttribute('data-loan-id');
        if (loanId && window.App && App.modalManager && typeof App.modalManager.openLoanScheduleModal === 'function') {
          event.preventDefault();
          event.stopPropagation();
          App.modalManager.openLoanScheduleModal(String(loanId));
          return;
        }
      }

      var schedClaimEl = t && t.closest && t.closest('[data-action="claim-open-schedule"][data-claim-id]');
      if (schedClaimEl) {
        var claimId = schedClaimEl.getAttribute('data-claim-id');
        if (claimId && window.App && App.modalManager && typeof App.modalManager.openClaimScheduleModal === 'function') {
          event.preventDefault();
          event.stopPropagation();
          App.modalManager.openClaimScheduleModal(String(claimId));
          return;
        }
      }

      // Block Save buttons explicitly (even if enabled via custom states)
      if (t && (t.closest('#local-save-btn') || t.closest('#cloud-save-btn'))) {
        event.preventDefault();
        event.stopPropagation();
        showToast('모바일(Read-only)에서는 저장할 수 없습니다.');
        return;
      }

      // Block Available Capital write controls (defensive)
      if (t && t.closest('.available-capital-modal') &&
          (t.closest('.avail-action-btn') || t.closest('.ledger-mini-btn') || t.closest('.ledger-editor-btn.is-save'))) {
        event.preventDefault();
        event.stopPropagation();
        showToast('모바일(Read-only)에서는 수정/저장이 차단됩니다.');
        return;
      }

      // Block card status change dropdown opening
      if (t && t.closest('select[data-action="card-status-change"]')) {
        event.preventDefault();
        event.stopPropagation();
        showToast('모바일(Read-only)에서는 상태 변경이 불가합니다.');
        return;
      }

      var actionEl = t && t.closest('[data-action]');
      if (!actionEl) return;

      var action = actionEl.getAttribute('data-action') || '';
      var blocked = {
        'debtor-add': true,
        'debtor-open-create': true,
        'debtor-open-edit': true,
        'debtor-delete': true,
        'loan-open-create': true,
        'loan-open-edit': true,
        'loan-delete': true,
        'claim-open-create': true,
        'claim-open-edit': true,
        'claim-delete': true,
        // NOTE: schedule modal open is allowed on mobile (view-only).
      };

      if (blocked[action]) {
        event.preventDefault();
        event.stopPropagation();
        showToast('모바일(Read-only)에서는 작업이 차단됩니다.');
      }
    }, true);

    // Block modal form submits (defensive)
    document.addEventListener('submit', function (event) {
      if (!isReadOnly()) return;
      var form = event.target;
      if (form && form.matches && form.matches('[data-role="modal-form"]')) {
        event.preventDefault();
        event.stopPropagation();
        showToast('모바일(Read-only)에서는 저장/제출이 차단됩니다.');
      }
    }, true);
  }

  function observeDomForReadOnly() {
    if (state.observer) return;
    try {
      state.observer = new MutationObserver(function () {
        if (!state.isMobile) return;
        if (!isReadOnly()) return;
        applyReadOnlyUI(true);
      });
      state.observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      state.observer = null;
    }
  }

  function refresh(force) {
    var next = computeIsMobile();
    var changed = force || (next !== state.isMobile);
    state.isMobile = next;

    if (!changed) return;

    // Layout reflow + read-only policy
    moveDebtorSidepanel(next);
    setRootClasses(next);

    // Activate the first mobile tab once (Debtor panel)
    if (next && !state.hasSetInitialTab) {
      setActiveTab('debtors');
      state.hasSetInitialTab = true;
    }

    // Apply UI disable only when Read-only policy is enabled.
    // v3.2.7: default isReadOnly() === false on mobile.
    applyReadOnlyUI(next && isReadOnly());
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Public API for feature modules (e.g., calendar)
    App.ui.mobile = App.ui.mobile || {};
    App.ui.mobile.isMobile = function () { return state.isMobile; };
    App.ui.mobile.isReadOnly = function () { return isReadOnly(); };
    App.ui.mobile.refresh = function () { refresh(true); };

    // Initial state
    state.isMobile = computeIsMobile();
    // Ensure slot captured before any move
    ensureDesktopSlot();

    // Apply once before App.init (app.js) runs
    refresh(true);

    // Write guards should be applied early (before click bindings call into them)
    applyWriteGuards();

    // Value-change guards (schedule modals are view-only on mobile)
    attachReadOnlyValueGuards();

    // Event guards
    attachCaptureGuards();

    // Observe dynamic renders (debtor detail, etc.)
    observeDomForReadOnly();

    // Listen for size changes
    try {
      if (window.matchMedia) {
        var mq = window.matchMedia('(max-width: ' + MOBILE_MAX_WIDTH + 'px)');
        if (mq && typeof mq.addEventListener === 'function') {
          mq.addEventListener('change', function () { refresh(true); });
        } else if (mq && typeof mq.addListener === 'function') {
          mq.addListener(function () { refresh(true); });
        }
      }
    } catch (e) {}

    window.addEventListener('resize', function () { refresh(true); });
    window.addEventListener('orientationchange', function () { refresh(true); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
