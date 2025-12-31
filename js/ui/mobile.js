(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  App.ui = App.ui || {};

  var MOBILE_MAX_WIDTH = 900;

  var state = {
    isMobile: false,
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
      root.classList.add('ls-readonly');
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

  function applyReadOnlyUI(isMobile) {
    if (!isMobile) {
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
      '[data-action="loan-open-schedule"]',

      // Claim CRUD + schedule edit
      '[data-action="claim-open-create"]',
      '[data-action="claim-open-edit"]',
      '[data-action="claim-delete"]',
      '[data-action="claim-open-schedule"]',

      // Status change (write)
      'select[data-action="card-status-change"]'
    ];

    for (var s = 0; s < selectors.length; s++) {
      var list = document.querySelectorAll(selectors[s]);
      for (var i = 0; i < list.length; i++) {
        setDisabledByMobile(list[i], true);
      }
    }
  }

  function isReadOnly() {
    return !!state.isMobile;
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
      wrapFn(App.modalManager, 'openLoanScheduleModal', '모바일(Read-only)에서는 일정 변경이 불가합니다.');
      wrapFn(App.modalManager, 'openClaimScheduleModal', '모바일(Read-only)에서는 일정 변경이 불가합니다.');
    }

    // Other write-capable modals
    if (App.ui && App.ui.operationModal) {
      wrapFn(App.ui.operationModal, 'open', '모바일(Read-only)에서는 작업이 차단됩니다.');
    }
    if (App.ui && App.ui.availableCapitalModal) {
      wrapFn(App.ui.availableCapitalModal, 'open', '모바일(Read-only)에서는 수정할 수 없습니다.');
    }
  }

  function attachCaptureGuards() {
    // Guard click targets that still might fire even if UI isn't disabled yet.
    document.addEventListener('click', function (event) {
      if (!isReadOnly()) return;

      var t = event.target;

      // Block Save buttons explicitly (even if enabled via custom states)
      if (t && (t.closest('#local-save-btn') || t.closest('#cloud-save-btn'))) {
        event.preventDefault();
        event.stopPropagation();
        showToast('모바일(Read-only)에서는 저장할 수 없습니다.');
        return;
      }

      // Block card status change dropdown opening
      if (t && t.closest('select[data-action="card-status-change"]')) {
        event.preventDefault();
        event.stopPropagation();
        showToast('모바일(Read-only)에서는 상태 변경이 불가합니다.');
        return;
      }

      // Block schedule rows that would open edit modals
      if (t && (t.closest('.day-detail-item') || t.closest('.monitoring-schedule-item'))) {
        event.preventDefault();
        event.stopPropagation();
        showToast('모바일(Read-only)에서는 일정 상세 편집이 불가합니다.');
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
        'loan-open-schedule': true,
        'claim-open-create': true,
        'claim-open-edit': true,
        'claim-delete': true,
        'claim-open-schedule': true
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

    // Apply UI disable (and restore on desktop)
    applyReadOnlyUI(next);
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Public API for feature modules (e.g., calendar)
    App.ui.mobile = App.ui.mobile || {};
    App.ui.mobile.isMobile = function () { return state.isMobile; };
    App.ui.mobile.isReadOnly = function () { return state.isMobile; };
    App.ui.mobile.refresh = function () { refresh(true); };

    // Initial state
    state.isMobile = computeIsMobile();
    // Ensure slot captured before any move
    ensureDesktopSlot();

    // Apply once before App.init (app.js) runs
    refresh(true);

    // Write guards should be applied early (before click bindings call into them)
    applyWriteGuards();

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
