(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  App.auth = App.auth || {};

  var isInitialized = false;
  var isDocumentClickBound = false;
  var onFormSubmit = null;

  function getSupabase() {
    if (!App.supabase) {
      console.warn('[Auth] App.supabase is not initialized.');
      return null;
    }
    return App.supabase;
  }

  function getAuthElements() {
    var accountArea = document.getElementById('account-area');
    var statusEl = accountArea ? accountArea.querySelector('[data-auth-status]') : null;
    var buttonEl = accountArea ? accountArea.querySelector('.auth-btn') : null;
    var modalEl = document.getElementById('auth-modal');
    var formEl = document.getElementById('auth-login-form');
    var errorEl = document.getElementById('auth-error');
    return {
      accountArea: accountArea,
      statusEl: statusEl,
      buttonEl: buttonEl,
      modalEl: modalEl,
      formEl: formEl,
      errorEl: errorEl
    };
  }

  function openModal() {
    var els = getAuthElements();
    if (!els.modalEl) return;
    els.modalEl.hidden = false;
    if (els.errorEl) {
      els.errorEl.textContent = '';
      els.errorEl.hidden = true;
    }
    if (els.formEl) {
      var emailInput = els.formEl.querySelector('input[name="email"]');
      if (emailInput) {
        try {
          emailInput.focus();
        } catch (e) {}
      }
    }
  }

  function closeModal() {
    var els = getAuthElements();
    if (!els.modalEl) return;
    els.modalEl.hidden = true;
    if (els.formEl) {
      els.formEl.reset();
    }
    if (els.errorEl) {
      els.errorEl.textContent = '';
      els.errorEl.hidden = true;
    }
  }

  function setError(message) {
    var els = getAuthElements();
    if (!els.errorEl) return;
    els.errorEl.textContent = message || '';
    els.errorEl.hidden = !message;
  }

  function updateAuthUI() {
    var els = getAuthElements();
    if (!els.accountArea || !els.statusEl || !els.buttonEl) return;

    if (App.user && App.user.email) {
      els.statusEl.textContent = App.user.email;
      els.buttonEl.textContent = '로그아웃';
      els.buttonEl.setAttribute('data-action', 'auth-logout');
    } else {
      els.statusEl.textContent = '오프라인 모드';
      els.buttonEl.textContent = '로그인';
      els.buttonEl.setAttribute('data-action', 'auth-open-modal');
    }
  }

  function clearAppDataState() {
    // Stage 5: unify reset path via App.stateIO → App.api.commitAll()
    if (App.stateIO && typeof App.stateIO.resetDataKeepUI === 'function') {
      App.stateIO.resetDataKeepUI();
      return;
    }

    // Fallback (should not happen in Stage 5): clear domain arrays without direct render calls.
    if (!App.state) return;
    if (Array.isArray(App.state.debtors)) App.state.debtors.length = 0;
    if (Array.isArray(App.state.loans)) App.state.loans.length = 0;
    if (Array.isArray(App.state.claims)) App.state.claims.length = 0;
    if (Array.isArray(App.state.cashLogs)) App.state.cashLogs.length = 0;

    if (App.schedulesEngine && typeof App.schedulesEngine.initEmpty === 'function') {
      App.schedulesEngine.initEmpty();
    }
  }

  function handleDocumentClick(event) {
    var target = event.target;
    if (!target) return;

    var control = target.closest('[data-action]');
    if (!control) return;

    var action = control.getAttribute('data-action');
    if (!action) return;

    if (action === 'auth-open-modal') {
      event.preventDefault();
      openModal();
    } else if (action === 'auth-close-modal') {
      event.preventDefault();
      closeModal();
    } else if (action === 'auth-logout') {
      event.preventDefault();
      logout();
    }
  }

  function bindEvents() {
    var els = getAuthElements();

    if (!isDocumentClickBound) {
      document.addEventListener('click', handleDocumentClick);
      isDocumentClickBound = true;
    }

    if (els.formEl && !onFormSubmit) {
      onFormSubmit = function (event) {
        event.preventDefault();
        loginWithPassword(els.formEl);
      };
      els.formEl.addEventListener('submit', onFormSubmit);
    }
  }

  // Mobile Mode Phase 1: allow temporarily disabling Desktop-level global listeners
  // without destroying auth/session state.
  function pause() {
    if (isDocumentClickBound) {
      document.removeEventListener('click', handleDocumentClick);
      isDocumentClickBound = false;
    }
    closeModal();
  }

  function resume() {
    if (!isInitialized) return;
    if (!isDocumentClickBound) {
      document.addEventListener('click', handleDocumentClick);
      isDocumentClickBound = true;
    }
    updateAuthUI();
  }

  async function handleAuthResult(user) {
    App.user = user || null;
    updateAuthUI();

    if (App.user && App.data && typeof App.data.loadAllFromSupabase === 'function') {
      try {
        await App.data.loadAllFromSupabase();
      } catch (err) {
        console.error('[Auth] Failed to load data after login:', err);
      }
    } else if (!App.user) {
      clearAppDataState();
    }
  }

  async function loginWithPassword(formEl) {
    var supa = getSupabase();
    if (!supa || !formEl) return;

    var emailInput = formEl.querySelector('input[name="email"]');
    var passwordInput = formEl.querySelector('input[name="password"]');
    var email = emailInput ? emailInput.value.trim() : '';
    var password = passwordInput ? passwordInput.value : '';

    if (!email || !password) {
      setError('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setError('');
    try {
      var result = await supa.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (result.error) {
        console.warn('[Auth] Login error:', result.error);
        setError(result.error.message || '로그인에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      var user = result.data && result.data.user ? result.data.user : null;
      if (!user) {
        setError('로그인 정보가 올바르지 않습니다.');
        return;
      }

      closeModal();
      await handleAuthResult(user);
    } catch (err) {
      console.error('[Auth] Unexpected login error:', err);
      setError('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  async function logout() {
    var supa = getSupabase();
    try {
      if (supa) {
        await supa.auth.signOut();
      }
    } catch (err) {
      console.error('[Auth] Logout error:', err);
    }

    await handleAuthResult(null);
  }

  async function restoreSession() {
    var supa = getSupabase();
    if (!supa) {
      updateAuthUI();
      return;
    }

    try {
      var result = await supa.auth.getUser();
      var user = result && result.data && result.data.user ? result.data.user : null;
      if (user) {
        await handleAuthResult(user);
      } else {
        App.user = null;
        updateAuthUI();
      }
    } catch (err) {
      // 세션이 없을 때도 오류가 발생할 수 있으므로 조용히 처리한다.
      console.warn('[Auth] restoreSession failed:', err && err.message ? err.message : err);
      App.user = null;
      updateAuthUI();
    }
  }

  function init() {
    if (isInitialized) return;
    isInitialized = true;

    if (!App.user) {
      App.user = null;
    }

    bindEvents();
    updateAuthUI();
    // 초기 세션 복원
    restoreSession();
  }

  App.auth.init = init;
  // Desktop lifecycle helpers (used by Mode Switcher).
  App.auth.pause = pause;
  App.auth.resume = resume;
  App.auth.activate = function () {
    if (!isInitialized) init();
    else resume();
  };
  App.auth.deactivate = pause;
  App.auth.openModal = openModal;
  App.auth.closeModal = closeModal;
  App.auth.updateAuthUI = updateAuthUI;
})(window, document);