from pathlib import Path
root = Path('/mnt/data/ls_v321')

# index.html: replace topbar and add script include
index = (root/'index.html').read_text(encoding='utf-8')
old_header = '''<header class="topbar">
<div class="topbar-main">
<div class="brand" id="app-brand-version">
    Loan Shark
</div>
<nav class="tab-strip top-tabs" data-tab-root="">
<button class="tab-btn tab-btn--debtors" data-tab="debtors" type="button">채무자관리</button>
<button class="tab-btn is-active" data-tab="calendar" type="button">Calendar</button>
<button class="tab-btn" data-tab="monitoring" type="button">Monitoring</button>
<button class="tab-btn" data-tab="report" type="button">Report</button>
</nav>
</div>
<div class="topbar-meta">
  <div class="account-area" id="account-area">
    <span class="auth-status" data-auth-status>오프라인 모드</span>
    <button type="button" class="auth-btn" data-action="auth-open-modal">로그인</button>
  </div>

  <div class="save-load-controls">
    <button id="local-save-btn" class="nav-btn">Local Save</button>
    <button id="local-load-trigger" class="nav-btn">Local Load</button>
    <input id="local-load-file" type="file" style="display:none">

    <button id="cloud-save-btn" class="nav-btn highlight">Cloud Save</button>
    <button id="cloud-load-btn" class="nav-btn">Cloud Load</button>
  </div>
</div>
</header>'''
new_header = '''<header class="topbar">
<div class="topbar-main">
<div class="brand" id="app-brand-version">
    Loan Shark
</div>
<nav class="tab-strip top-tabs" data-tab-root="">
<button class="tab-btn tab-btn--debtors" data-tab="debtors" type="button">채무자관리</button>
<button class="tab-btn is-active" data-tab="calendar" type="button">Calendar</button>
<button class="tab-btn" data-tab="monitoring" type="button">Monitoring</button>
<button class="tab-btn" data-tab="report" type="button">Report</button>
</nav>
</div>
<div class="topbar-center">
  <div id="snapshot-status-host" class="snapshot-status" aria-live="polite"></div>
</div>
<div class="topbar-meta">
  <div class="account-area" id="account-area">
    <span class="auth-status" data-auth-status>오프라인 모드</span>
    <button type="button" class="auth-btn" data-action="auth-open-modal">로그인</button>
  </div>

  <div class="snapshot-controls">
    <button id="save-btn" class="nav-btn highlight" type="button">Save</button>
    <button id="load-btn" class="nav-btn" type="button">Load</button>
    <div class="json-menu-root">
      <button id="json-btn" class="nav-btn" type="button" aria-haspopup="menu" aria-expanded="false">JSON</button>
      <div id="json-menu" class="json-menu" hidden>
        <button id="json-export-action" class="json-menu__item" type="button">Export JSON</button>
        <button id="json-import-action" class="json-menu__item" type="button">Import JSON</button>
      </div>
      <input id="json-import-file" type="file" accept="application/json,.json" hidden>
    </div>
  </div>
</div>
</header>'''
if old_header not in index:
    raise SystemExit('old header block not found')
index = index.replace(old_header, new_header)
old_scripts = '<script src="js/core/saveload.local.js"></script>\n<script src="js/core/db.js"></script>'
new_scripts = '<script src="js/core/saveload.local.js"></script>\n<script src="js/core/snapshotStatus.js"></script>\n<script src="js/core/db.js"></script>'
if old_scripts not in index:
    raise SystemExit('script block not found')
index = index.replace(old_scripts, new_scripts)
(root/'index.html').write_text(index, encoding='utf-8')

# state.js version
state_js = (root/'js/core/state.js').read_text(encoding='utf-8')
state_js = state_js.replace("App.meta.version = 'v3.2.31_stateio_ui_schema_final_lock';", "App.meta.version = 'v3.2.32_cloud_snapshot_history_status_bar';")
(root/'js/core/state.js').write_text(state_js, encoding='utf-8')

# app.js rewrite
(root/'js/app.js').write_text('''(function (window, document) {
  'use strict';
  var App = window.App || (window.App = {});
  var initialized = false;

  function getDisplayVersionShort() {
    var full = (App.meta && typeof App.meta.version === 'string' && App.meta.version) ? App.meta.version : 'unknown-version';
    var m = /^v\d+(?:\.\d+){0,3}/.exec(full);
    return m ? m[0] : String(full);
  }

  function syncAppVersionUi() {
    var shortVersion = getDisplayVersionShort();
    var brandEl = document.getElementById('app-brand-version');
    if (brandEl) {
      brandEl.textContent = 'Loan Shark ' + shortVersion;
    }
    document.title = 'Loan Shark ' + shortVersion;
  }

  function closeJsonMenu() {
    var btn = document.getElementById('json-btn');
    var menu = document.getElementById('json-menu');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (menu) menu.hidden = true;
  }

  function toggleJsonMenu() {
    var btn = document.getElementById('json-btn');
    var menu = document.getElementById('json-menu');
    if (!btn || !menu) return;
    var nextHidden = !menu.hidden;
    menu.hidden = nextHidden;
    btn.setAttribute('aria-expanded', nextHidden ? 'false' : 'true');
  }

  function bindSnapshotControls() {
    var saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        if (App.data && typeof App.data.saveSnapshotToSupabase === 'function') {
          App.data.saveSnapshotToSupabase();
        }
      });
    }

    var loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        if (App.snapshots && typeof App.snapshots.openLoadModal === 'function') {
          App.snapshots.openLoadModal();
        }
      });
    }

    var jsonBtn = document.getElementById('json-btn');
    if (jsonBtn) {
      jsonBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleJsonMenu();
      });
    }

    var exportBtn = document.getElementById('json-export-action');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        closeJsonMenu();
        if (App.jsonIO && typeof App.jsonIO.exportSnapshot === 'function') {
          App.jsonIO.exportSnapshot();
        }
      });
    }

    var importActionBtn = document.getElementById('json-import-action');
    var importInput = document.getElementById('json-import-file');
    if (importActionBtn && importInput) {
      importActionBtn.addEventListener('click', function () {
        closeJsonMenu();
        importInput.value = '';
        importInput.click();
      });
      importInput.addEventListener('change', function (e) {
        var files = e && e.target && e.target.files ? e.target.files : null;
        if (files && files.length && App.jsonIO && typeof App.jsonIO.importSnapshot === 'function') {
          App.jsonIO.importSnapshot(files[0]);
        }
        importInput.value = '';
      });
    }

    document.addEventListener('click', function (event) {
      var root = event.target && event.target.closest ? event.target.closest('.json-menu-root') : null;
      if (!root) {
        closeJsonMenu();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event && event.key === 'Escape') {
        closeJsonMenu();
        if (App.snapshots && typeof App.snapshots.closeLoadModal === 'function') {
          App.snapshots.closeLoadModal();
        }
      }
    });
  }

  function registerViewRenderers() {
    if (!App || !App.renderCoordinator || typeof App.renderCoordinator.register !== 'function') return;
    if (!App.ViewKey) return;

    if (App.debtors && typeof App.debtors._renderListFromState === 'function') {
      App.renderCoordinator.register(App.ViewKey.DEBTOR_LIST, App.debtors._renderListFromState);
    } else if (App.debtors && typeof App.debtors.renderList === 'function') {
      App.renderCoordinator.register(App.ViewKey.DEBTOR_LIST, function () { App.debtors.renderList(); });
    }

    if (App.debtorDetail && typeof App.debtorDetail._renderFromState === 'function') {
      App.renderCoordinator.register(App.ViewKey.DEBTOR_DETAIL, App.debtorDetail._renderFromState);
    }

    if (App.features && App.features.calendar && typeof App.features.calendar.renderImpl === 'function') {
      App.renderCoordinator.register(App.ViewKey.CALENDAR, App.features.calendar.renderImpl);
    }

    if (App.features && App.features.monitoring && typeof App.features.monitoring.renderImpl === 'function') {
      App.renderCoordinator.register(App.ViewKey.MONITORING, App.features.monitoring.renderImpl);
    }

    if (App.features && App.features.report && typeof App.features.report.renderImpl === 'function') {
      App.renderCoordinator.register(App.ViewKey.REPORT, App.features.report.renderImpl);
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;

    if (App.renderCoordinator && typeof App.renderCoordinator.enable === 'function') {
      App.renderCoordinator.enable();
    }

    registerViewRenderers();

    if (App.ui && App.ui.layout && App.ui.layout.init) {
      App.ui.layout.init();
    }
    if (App.ui && App.ui.events && App.ui.events.init) {
      App.ui.events.init();
    }
    if (App.debtorPanel && App.debtorPanel.init) {
      App.debtorPanel.init();
    }
    if (App.ui && App.ui.mobile && App.ui.mobile.init) {
      App.ui.mobile.init();
    }

    if (App.features && App.features.debtors && App.features.debtors.init) {
      App.features.debtors.init();
    }
    if (App.debtors && App.debtors.initDom) {
      App.debtors.initDom();
    }
    if (App.debtorDetail && App.debtorDetail.init) {
      App.debtorDetail.init();
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

    if (App.auth && App.auth.init) {
      App.auth.init();
    }

    bindSnapshotControls();
    syncAppVersionUi();

    if (App.snapshotStatus && typeof App.snapshotStatus.init === 'function') {
      App.snapshotStatus.init();
    }

    if (App.api && typeof App.api.commitAll === 'function') {
      App.api.commitAll('app:init');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
''', encoding='utf-8')

# auth.js rewrite
(root/'js/core/auth.js').write_text('''(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  App.auth = App.auth || {};

  var isInitialized = false;

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
        try { emailInput.focus(); } catch (e) {}
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
    if (App.stateIO && typeof App.stateIO.resetAll === 'function') {
      App.stateIO.resetAll({ uiPolicy: 'reset', reason: 'auth:clearAppDataState', sourceType: 'auth' });
      return;
    }
    if (App.stateIO && typeof App.stateIO.resetDataKeepUI === 'function') {
      App.stateIO.resetDataKeepUI({ reason: 'auth:clearAppDataState', sourceType: 'auth' });
      return;
    }

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

    document.addEventListener('click', handleDocumentClick);

    if (els.formEl) {
      els.formEl.addEventListener('submit', function (event) {
        event.preventDefault();
        loginWithPassword(els.formEl);
      });
    }
  }

  async function handleAuthResult(user) {
    App.user = user || null;
    updateAuthUI();

    if (App.user && App.data && typeof App.data.loadLatestSnapshotFromSupabase === 'function') {
      try {
        await App.data.loadLatestSnapshotFromSupabase({
          reason: 'auth:auto',
          silentNoData: true,
          silentSuccess: true,
          resetOnEmpty: true
        });
      } catch (err) {
        console.error('[Auth] Failed to load latest snapshot after login:', err);
      }
    } else if (!App.user) {
      try { document.documentElement.classList.remove('ls-viewer'); } catch (e) {}
      clearAppDataState();
      if (App.snapshotStatus && typeof App.snapshotStatus.clear === 'function') {
        App.snapshotStatus.clear();
      }
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
      if (App.snapshotStatus && typeof App.snapshotStatus.clear === 'function') {
        App.snapshotStatus.clear();
      }
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
        if (App.snapshotStatus && typeof App.snapshotStatus.clear === 'function') {
          App.snapshotStatus.clear();
        }
      }
    } catch (err) {
      console.warn('[Auth] restoreSession failed:', err && err.message ? err.message : err);
      App.user = null;
      updateAuthUI();
      if (App.snapshotStatus && typeof App.snapshotStatus.clear === 'function') {
        App.snapshotStatus.clear();
      }
    }
  }

  function init() {
    if (isInitialized) return;
    isInitialized = true;
    bindEvents();
    updateAuthUI();
    restoreSession();
  }

  App.auth.openModal = openModal;
  App.auth.closeModal = closeModal;
  App.auth.init = init;
  App.auth.updateAuthUI = updateAuthUI;
})(window, document);
''', encoding='utf-8')

# cloudState.js rewrite
(root/'js/core/cloudState.js').write_text('''(function (window) {
  'use strict';

  var App = window.App || (window.App = {});

  function isObject(v) {
    return v && typeof v === 'object';
  }

  function collectTypeStats(list, field) {
    var stats = Object.create(null);
    if (!list || !list.length) return stats;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!isObject(item)) continue;
      var v = item[field];
      var t = (v === null) ? 'null' : typeof v;
      stats[t] = (stats[t] || 0) + 1;
    }
    return stats;
  }

  function cloneDeep(value) {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      var arr = [];
      for (var i = 0; i < value.length; i++) {
        arr.push(cloneDeep(value[i]));
      }
      return arr;
    }
    var out = {};
    var keys = Object.keys(value);
    for (var j = 0; j < keys.length; j++) {
      out[keys[j]] = cloneDeep(value[keys[j]]);
    }
    return out;
  }

  function runShadowQA(source) {
    source = source || 'unknown';

    var loans = (App.state && App.state.loans) || [];
    var claims = (App.state && App.state.claims) || [];
    var schedules = [];
    if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      try {
        schedules = App.schedulesEngine.getAll() || [];
      } catch (e) {
        schedules = [];
      }
    }

    var engineListRef = (App.schedulesEngine && App.schedulesEngine.list) || null;
    var engineConsistency = {
      engineHasList: !!engineListRef,
      engineLength: Array.isArray(engineListRef) ? engineListRef.length : 0
    };

    var loanById = Object.create(null);
    var claimById = Object.create(null);
    var scheduleCountByLoan = Object.create(null);

    for (var i = 0; i < loans.length; i++) {
      var loan = loans[i];
      if (!loan || loan.id == null) continue;
      loanById[String(loan.id)] = loan;
    }

    for (var j = 0; j < claims.length; j++) {
      var claim = claims[j];
      if (!claim || claim.id == null) continue;
      claimById[String(claim.id)] = claim;
    }

    var orphanLoanSchedules = 0;
    var orphanClaimSchedules = 0;

    for (var k = 0; k < schedules.length; k++) {
      var sc = schedules[k];
      if (!sc || !sc.kind) continue;

      if (sc.kind === 'loan') {
        var lid = (typeof sc.loanId !== 'undefined') ? sc.loanId : sc.loan_id;
        if (lid == null) continue;
        var lidKey = String(lid);
        scheduleCountByLoan[lidKey] = (scheduleCountByLoan[lidKey] || 0) + 1;
        if (!loanById[lidKey]) orphanLoanSchedules++;
      } else if (sc.kind === 'claim') {
        var cid = (typeof sc.claimId !== 'undefined') ? sc.claimId : sc.claim_id;
        if (cid == null) continue;
        var cidKey = String(cid);
        if (!claimById[cidKey]) orphanClaimSchedules++;
      }
    }

    var missingLoanScheduleIds = [];
    for (var loanId in loanById) {
      if (!Object.prototype.hasOwnProperty.call(loanById, loanId)) continue;
      if (!scheduleCountByLoan[loanId]) missingLoanScheduleIds.push(loanId);
    }

    var report = {
      source: source,
      loansTotal: Object.keys(loanById).length,
      schedulesTotal: schedules.length,
      loansMissingSchedules: missingLoanScheduleIds,
      orphanLoanSchedules: orphanLoanSchedules,
      orphanClaimSchedules: orphanClaimSchedules,
      engineConsistency: engineConsistency,
      typeStats: {
        loanId: collectTypeStats(loans, 'id'),
        scheduleLoanId: collectTypeStats(schedules, 'loanId'),
        scheduleLoan_id: collectTypeStats(schedules, 'loan_id')
      }
    };

    App.cloudState = App.cloudState || {};
    App.cloudState.lastShadowQA = report;

    if (missingLoanScheduleIds.length || orphanLoanSchedules || orphanClaimSchedules) {
      console.warn('[ShadowQA] schedule link check found issues:', report);
    } else {
      console.log('[ShadowQA] schedule link check OK:', report);
    }

    return report;
  }

  App.cloudState = App.cloudState || {};

  App.cloudState.build = function () {
    if (!App.stateIO || typeof App.stateIO.buildSnapshotEnvelope !== 'function') {
      throw new Error('StateIO snapshot builder is not available.');
    }
    return App.stateIO.buildSnapshotEnvelope({ source: 'cloud' });
  };

  App.cloudState.buildComparablePayload = function (snapshot) {
    var base = snapshot;
    if (!base) {
      base = App.cloudState.build();
    }
    if (!base || !isObject(base)) {
      return { data: {}, meta: {} };
    }
    return {
      data: cloneDeep(isObject(base.data) ? base.data : {}),
      meta: cloneDeep(isObject(base.meta) ? base.meta : {})
    };
  };

  App.cloudState.validateSnapshot = function (snapshot, opts) {
    if (App.stateIO && typeof App.stateIO.validateSnapshot === 'function') {
      return App.stateIO.validateSnapshot(snapshot, opts);
    }
    return { ok: false, reason: 'stateio_unavailable' };
  };

  function shouldPersistPreCloudLoadBackup() {
    return !!(App.config && App.config.enablePreCloudLoadBackup === true);
  }

  function savePreCloudLoadBackup() {
    if (!shouldPersistPreCloudLoadBackup()) return;
    try {
      if (!window.localStorage) return;
      if (!App.cloudState || typeof App.cloudState.build !== 'function') return;
      var snapshot = App.cloudState.build();
      if (!snapshot) return;
      window.localStorage.setItem('loanshark_pre_cloud_load_backup', JSON.stringify(snapshot));
      window.localStorage.setItem('loanshark_pre_cloud_load_backup_savedAt', new Date().toISOString());
    } catch (e) {
      console.warn('[CloudState] Failed to persist pre-load backup:', e);
    }
  }

  App.cloudState.apply = function (snapshot, opts) {
    opts = opts || {};

    if (!App.stateIO || typeof App.stateIO.validateSnapshot !== 'function' || typeof App.stateIO.applySnapshot !== 'function') {
      console.error('[CloudState] StateIO snapshot pipeline is not available.');
      return false;
    }

    var validation = App.stateIO.validateSnapshot(snapshot, opts);
    if (!validation.ok) {
      console.warn('[CloudState] Snapshot rejected:', validation.reason, validation.counts || {}, validation.integrity || {});
      return false;
    }

    savePreCloudLoadBackup();

    var appliedInputFormat = validation.inputFormat || 'snapshot-v1';
    var appliedOriginalInputFormat = validation.originalInputFormat || appliedInputFormat;
    console.info('[CloudState] Applying snapshot with uiPolicy=preserve reason=load:cloud inputFormat=' + appliedInputFormat + ' originalInputFormat=' + appliedOriginalInputFormat);
    var applied = App.stateIO.applySnapshot(validation.snapshot, {
      uiPolicy: 'preserve',
      reason: 'load:cloud',
      sourceType: 'cloud',
      inputFormat: appliedInputFormat,
      originalInputFormat: appliedOriginalInputFormat
    });

    if (!applied) {
      console.error('[CloudState] Snapshot apply failed.');
      return false;
    }

    runShadowQA('cloudState.apply');
    return true;
  };

  App.cloudState.runShadowQA = function () {
    return runShadowQA('manual');
  };
})(window);
''', encoding='utf-8')

# saveload.local.js rewrite
(root/'js/core/saveload.local.js').write_text('''(function (window) {
  'use strict';
  var App = window.App || (window.App = {});
  App.local = App.local || {};
  App.jsonIO = App.jsonIO || {};

  function pad2(v) {
    v = Number(v) || 0;
    return v < 10 ? '0' + v : String(v);
  }

  function buildSnapshotFileName(snapshot) {
    var when = new Date();
    var stamp = when.getFullYear() + '-' + pad2(when.getMonth() + 1) + '-' + pad2(when.getDate()) + '_' + pad2(when.getHours()) + pad2(when.getMinutes()) + pad2(when.getSeconds());
    var version = (snapshot && typeof snapshot.appVersion === 'string' && snapshot.appVersion) ? snapshot.appVersion : ((App.stateIO && typeof App.stateIO.getCurrentAppVersion === 'function') ? App.stateIO.getCurrentAppVersion() : 'unknown-version');
    version = String(version).replace(/[^a-zA-Z0-9._-]+/g, '_');
    return 'loanshark_snapshot_' + version + '_' + stamp + '.json';
  }

  function mapImportFailureMessage(reason) {
    switch (reason) {
      case 'unsupported_version':
        return 'Import JSON 차단 — 지원되지 않는 백업 버전입니다.';
      case 'data_shape_invalid':
        return 'Import JSON 차단 — 데이터 구조가 올바르지 않습니다.';
      case 'empty_data':
        return 'Import JSON 차단 — 형식은 맞지만 복원 가능한 데이터가 비어 있습니다.';
      case 'schedule_not_object':
      case 'schedule_kind_invalid':
      case 'schedule_loan_missing':
      case 'schedule_claim_missing':
      case 'schedule_debtor_missing':
      case 'schedule_ref_invalid':
        return 'Import JSON 차단 — 스케줄 참조 무결성이 깨진 백업입니다.';
      case 'legacy_required_collections_missing':
      case 'legacy_shape_invalid':
        return 'Import JSON 차단 — legacy 백업 형식이지만 필수 데이터 컬렉션이 누락되었거나 형식이 올바르지 않아 복원할 수 없습니다.';
      case 'snapshot_required_collections_missing':
      case 'snapshot_shape_invalid':
        return 'Import JSON 차단 — snapshot 백업 형식이지만 필수 데이터 컬렉션이 누락되었거나 형식이 올바르지 않아 복원할 수 없습니다.';
      case 'snapshot_missing':
      case 'data_missing':
        return 'Import JSON 차단 — 백업 데이터가 비어 있거나 인식되지 않습니다.';
      default:
        return '오류 발생 — 다시 시도해주세요.';
    }
  }

  function isReadOnlyViewer() {
    return !!(App.state && App.state.cloud && App.state.cloud.isShared && App.state.cloud.isReadOnly && App.state.cloud.viewerId && App.state.cloud.targetUserId && App.state.cloud.viewerId !== App.state.cloud.targetUserId);
  }

  function exportSnapshot() {
    try {
      if (isReadOnlyViewer()) {
        console.warn('[Export JSON] Read-only viewer account. Export is blocked.');
        App.showToast('읽기 전용 계정입니다 — JSON 내보내기 불가');
        return;
      }

      if (App.stateIO && typeof App.stateIO.ensureMeta === 'function') {
        App.stateIO.ensureMeta();
      }

      if (App.util && typeof App.util.repairLoanClaimDisplayIds === 'function') {
        App.util.repairLoanClaimDisplayIds();
      }

      if (App.util && typeof App.util.ensureLoanClaimDisplayIds === 'function') {
        App.util.ensureLoanClaimDisplayIds();
      }

      if (!App.stateIO || typeof App.stateIO.buildSnapshotEnvelope !== 'function') {
        throw new Error('StateIO snapshot builder is not available.');
      }

      var snapshot = App.stateIO.buildSnapshotEnvelope({ source: 'jsonExport' });
      var data = JSON.stringify(snapshot, null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = buildSnapshotFileName(snapshot);
      a.click();
      try {
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      } catch (e) {}
      console.log('[Export JSON] Success (reason=save:json, format=snapshot-v1)');
      App.showToast('Export JSON 완료 — snapshot JSON이 저장되었습니다.');
    } catch (err) {
      console.error('[Export JSON] Failed:', err);
      App.showToast('오류 발생 — 다시 시도해주세요.');
    }
  }

  async function importSnapshot(file) {
    try {
      if (isReadOnlyViewer()) {
        console.warn('[Import JSON] Read-only viewer account. Import is blocked.');
        App.showToast('읽기 전용 계정입니다 — JSON 불러오기 불가');
        return;
      }

      if (!file) {
        App.showToast('오류 발생 — 다시 시도해주세요.');
        return;
      }

      if (!App.stateIO || typeof App.stateIO.normalizeSnapshotInput !== 'function' || typeof App.stateIO.validateSnapshot !== 'function' || typeof App.stateIO.applySnapshot !== 'function') {
        console.warn('[Import JSON] StateIO snapshot pipeline is not available.');
        App.showToast('오류 발생 — 다시 시도해주세요.');
        return;
      }

      var text = await file.text();
      var obj;
      try {
        obj = JSON.parse(text);
      } catch (parseErr) {
        console.error('[Import JSON] JSON parse failed:', parseErr);
        App.showToast('Import JSON 차단 — JSON 파싱에 실패했습니다.');
        return;
      }

      var normalized = App.stateIO.normalizeSnapshotInput(obj, { sourceType: 'local' });
      if (!normalized.ok) {
        console.warn('[Import JSON] Normalize failed:', normalized.reason, {
          inputFormat: normalized.inputFormat || '',
          originalInputFormat: normalized.originalInputFormat || normalized.inputFormat || ''
        });
        App.showToast(mapImportFailureMessage(normalized.reason));
        return;
      }

      var validation = App.stateIO.validateSnapshot(normalized.snapshot, {
        rejectEmptyData: true,
        originalInputFormat: normalized.originalInputFormat || normalized.inputFormat || 'snapshot-v1'
      });
      if (!validation.ok) {
        console.warn('[Import JSON] Snapshot rejected:', validation.reason, validation.counts || {}, validation.integrity || {}, {
          inputFormat: validation.inputFormat || normalized.inputFormat || '',
          originalInputFormat: validation.originalInputFormat || normalized.originalInputFormat || validation.inputFormat || normalized.inputFormat || ''
        });
        App.showToast(mapImportFailureMessage(validation.reason));
        return;
      }

      var appliedInputFormat = validation.inputFormat || normalized.inputFormat || 'snapshot-v1';
      var appliedOriginalInputFormat = validation.originalInputFormat || normalized.originalInputFormat || appliedInputFormat;
      console.info('[Import JSON] Applying snapshot with uiPolicy=preserve reason=restore:jsonImport inputFormat=' + appliedInputFormat + ' originalInputFormat=' + appliedOriginalInputFormat);
      var applied = App.stateIO.applySnapshot(validation.snapshot, {
        uiPolicy: 'preserve',
        reason: 'restore:jsonImport',
        sourceType: 'local',
        inputFormat: appliedInputFormat,
        originalInputFormat: appliedOriginalInputFormat
      });

      if (!applied) {
        App.showToast('오류 발생 — 다시 시도해주세요.');
        return;
      }

      if (App.snapshotStatus && typeof App.snapshotStatus.markCleanFromSnapshot === 'function') {
        App.snapshotStatus.markCleanFromSnapshot({
          label: 'Imported JSON',
          sourceType: 'json',
          createdAt: validation.snapshot && validation.snapshot.savedAt ? validation.snapshot.savedAt : null,
          snapshotId: null,
          isImported: true
        }, validation.snapshot);
      }

      console.log('[Import JSON] Success');
      App.showToast('Import JSON 완료 — 데이터를 반영했습니다.');
    } catch (err) {
      console.error('[Import JSON] Failed:', err);
      App.showToast('오류 발생 — 다시 시도해주세요.');
    }
  }

  App.local.save = exportSnapshot;
  App.local.load = importSnapshot;
  App.jsonIO.exportSnapshot = exportSnapshot;
  App.jsonIO.importSnapshot = importSnapshot;
})(window);
''', encoding='utf-8')

# new snapshotStatus.js
(root/'js/core/snapshotStatus.js').write_text('''(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  var snapshotStatus = App.snapshotStatus || (App.snapshotStatus = {});
  var snapshotsApi = App.snapshots || (App.snapshots = {});

  var statusState = {
    baselineHash: '',
    dirty: false,
    currentMeta: {
      label: 'none',
      createdAt: null,
      sourceType: 'none',
      snapshotId: null,
      appVersion: null,
      ownerId: null,
      note: null,
      legacy: false,
      isImported: false
    },
    pendingCheck: false,
    modalEl: null,
    modalEscHandler: null,
    apiWrapped: false,
    initialized: false
  };

  function queueMicrotaskCompat(fn) {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(fn);
      return;
    }
    if (typeof Promise !== 'undefined' && Promise && typeof Promise.resolve === 'function') {
      Promise.resolve().then(fn);
      return;
    }
    setTimeout(fn, 0);
  }

  function isObject(value) {
    return value && typeof value === 'object';
  }

  function pad2(v) {
    v = Number(v) || 0;
    return v < 10 ? '0' + v : String(v);
  }

  function formatSnapshotTimestamp(value) {
    if (!value) return 'none';
    var date = value instanceof Date ? value : new Date(value);
    if (!date || isNaN(date.getTime())) return 'none';
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) + ' ' + pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  }

  function deepSort(value) {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      var arr = [];
      for (var i = 0; i < value.length; i++) {
        arr.push(deepSort(value[i]));
      }
      return arr;
    }
    var out = {};
    var keys = Object.keys(value).sort();
    for (var j = 0; j < keys.length; j++) {
      out[keys[j]] = deepSort(value[keys[j]]);
    }
    return out;
  }

  function stableHash(value) {
    try {
      return JSON.stringify(deepSort(value || {}));
    } catch (e) {
      return '__snapshot_hash_error__';
    }
  }

  function buildComparableFromSnapshot(snapshot) {
    if (App.cloudState && typeof App.cloudState.buildComparablePayload === 'function') {
      return App.cloudState.buildComparablePayload(snapshot);
    }
    return {
      data: isObject(snapshot) && isObject(snapshot.data) ? snapshot.data : {},
      meta: isObject(snapshot) && isObject(snapshot.meta) ? snapshot.meta : {}
    };
  }

  function buildComparableFromCurrentState() {
    if (App.cloudState && typeof App.cloudState.buildComparablePayload === 'function') {
      return App.cloudState.buildComparablePayload();
    }
    return { data: {}, meta: {} };
  }

  function normalizeMeta(meta) {
    meta = isObject(meta) ? meta : {};
    return {
      label: (typeof meta.label === 'string' && meta.label) ? meta.label : '',
      createdAt: meta.createdAt || null,
      sourceType: (typeof meta.sourceType === 'string' && meta.sourceType) ? meta.sourceType : 'cloud',
      snapshotId: meta.snapshotId || null,
      appVersion: meta.appVersion || null,
      ownerId: meta.ownerId || null,
      note: meta.note || null,
      legacy: !!meta.legacy,
      isImported: !!meta.isImported
    };
  }

  function getLabelText(meta) {
    meta = normalizeMeta(meta);
    if (meta.label) return meta.label;
    if (meta.isImported) return 'Imported JSON';
    if (meta.createdAt) return formatSnapshotTimestamp(meta.createdAt);
    return 'none';
  }

  function getStatusHost() {
    return document.getElementById('snapshot-status-host');
  }

  function clearNode(node) {
    if (!node) return;
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function renderStatus() {
    var host = getStatusHost();
    if (!host) return;

    clearNode(host);

    var labelEl = document.createElement('span');
    labelEl.className = 'snapshot-status__label';
    labelEl.textContent = 'Snapshot · ' + getLabelText(statusState.currentMeta);
    host.appendChild(labelEl);

    if (statusState.dirty) {
      var dirtyEl = document.createElement('span');
      dirtyEl.className = 'snapshot-status__dirty';
      dirtyEl.textContent = 'Unsaved changes';
      host.appendChild(dirtyEl);
    }

    host.title = labelEl.textContent + (statusState.dirty ? ' | Unsaved changes' : '');
  }

  function syncCloudAccessState(accessInfo, viewerId) {
    accessInfo = accessInfo || {};
    if (!App.state) App.state = {};
    App.state.cloud = App.state.cloud || {};
    App.state.cloud.targetUserId = accessInfo.targetUserId || viewerId || null;
    App.state.cloud.viewerId = viewerId || null;
    App.state.cloud.ownerId = accessInfo.ownerId || viewerId || null;
    App.state.cloud.role = accessInfo.role || 'owner';
    App.state.cloud.isShared = !!accessInfo.isShared;
    App.state.cloud.isReadOnly = !!accessInfo.isReadOnly;
    try {
      var isViewer = !!(App.state.cloud.isShared && App.state.cloud.isReadOnly && App.state.cloud.viewerId && App.state.cloud.targetUserId && App.state.cloud.viewerId !== App.state.cloud.targetUserId);
      document.documentElement.classList.toggle('ls-viewer', isViewer);
    } catch (e) {}
  }

  async function getCloudShareInfo(supa, viewerId) {
    if (!supa || !viewerId) {
      return { targetUserId: null, ownerId: null, viewerId: viewerId || null, role: null, isShared: false, isReadOnly: false };
    }

    var info = { targetUserId: viewerId, ownerId: viewerId, viewerId: viewerId, role: 'owner', isShared: false, isReadOnly: false };

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

  function getSupabase() {
    if (!App.supabase) {
      console.warn('[Snapshots] App.supabase is not initialized.');
      return null;
    }
    return App.supabase;
  }

  async function resolveCloudAccess(opts) {
    opts = opts || {};
    var supa = getSupabase();
    var viewerId = App.user && App.user.id ? App.user.id : null;
    if (!supa) {
      return { ok: false, reason: 'supabase_unavailable', supa: null, viewerId: viewerId, accessInfo: null };
    }
    if (!viewerId) {
      if (!opts.silentAuthError && typeof App.showToast === 'function') {
        App.showToast('Cloud 저장/불러오기는 로그인 후 사용 가능합니다.');
      }
      return { ok: false, reason: 'auth_required', supa: supa, viewerId: null, accessInfo: null };
    }

    var accessInfo = await getCloudShareInfo(supa, viewerId);
    syncCloudAccessState(accessInfo, viewerId);
    return { ok: true, supa: supa, viewerId: viewerId, accessInfo: accessInfo };
  }

  function isReadOnlyViewer(accessInfo, viewerId) {
    return !!(accessInfo && accessInfo.isShared && accessInfo.isReadOnly && accessInfo.targetUserId && viewerId && accessInfo.targetUserId !== viewerId);
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
      console.warn('[Snapshots] Failed to inject CloudState module script:', e);
    }
  }

  function markCleanFromSnapshot(meta, snapshot) {
    statusState.currentMeta = normalizeMeta(meta);
    statusState.baselineHash = stableHash(buildComparableFromSnapshot(snapshot));
    statusState.dirty = false;
    renderStatus();
  }

  function markCleanFromCurrent(meta) {
    statusState.currentMeta = normalizeMeta(meta);
    statusState.baselineHash = stableHash(buildComparableFromCurrentState());
    statusState.dirty = false;
    renderStatus();
  }

  function clearStatus() {
    statusState.currentMeta = normalizeMeta({ label: 'none', sourceType: 'none' });
    statusState.baselineHash = stableHash(buildComparableFromCurrentState());
    statusState.dirty = false;
    renderStatus();
  }

  function runDirtyCheck() {
    var currentHash = stableHash(buildComparableFromCurrentState());
    var nextDirty = currentHash !== statusState.baselineHash;
    if (statusState.dirty !== nextDirty) {
      statusState.dirty = nextDirty;
      renderStatus();
    }
  }

  function scheduleDirtyCheck() {
    if (statusState.pendingCheck) return;
    statusState.pendingCheck = true;
    queueMicrotaskCompat(function () {
      statusState.pendingCheck = false;
      runDirtyCheck();
    });
  }

  function wrapCommitApis() {
    if (statusState.apiWrapped) return;
    statusState.apiWrapped = true;

    function wrapMethod(obj, key) {
      if (!obj || typeof obj[key] !== 'function' || obj[key]._snapshotWrapped) return;
      var original = obj[key];
      var wrapped = function () {
        var result = original.apply(this, arguments);
        scheduleDirtyCheck();
        return result;
      };
      wrapped._snapshotWrapped = true;
      wrapped._snapshotOriginal = original;
      obj[key] = wrapped;
    }

    if (App.api) {
      wrapMethod(App.api, 'commit');
      wrapMethod(App.api, 'commitAll');
      if (App.api.domain) wrapMethod(App.api.domain, 'commit');
      if (App.api.view) wrapMethod(App.api.view, 'invalidate');
    }
  }

  function validateAndApplySnapshot(snapshot, opts) {
    opts = opts || {};
    ensureCloudStateModuleLoaded();

    if (!App.cloudState || typeof App.cloudState.apply !== 'function' || typeof App.cloudState.validateSnapshot !== 'function') {
      console.error('[Snapshots] CloudState module is not available.');
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return { ok: false, reason: 'cloudstate_unavailable' };
    }

    var validation = App.cloudState.validateSnapshot(snapshot, { rejectEmptyData: true });
    if (!validation.ok) {
      console.warn('[Snapshots] Snapshot rejected before apply:', validation.reason, validation.counts || {});
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('Snapshot Load 차단 — 비정상 또는 빈 스냅샷입니다.');
      }
      return { ok: false, reason: validation.reason };
    }

    var applied = App.cloudState.apply(snapshot, { rejectEmptyData: true });
    if (!applied) {
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('Snapshot Load 차단 — 비정상 스냅샷입니다.');
      }
      return { ok: false, reason: 'apply_failed' };
    }

    return { ok: true, snapshot: snapshot };
  }

  function applyEmptyStateBaseline(opts) {
    opts = opts || {};
    if (opts.resetData !== false && App.stateIO && typeof App.stateIO.resetDataKeepUI === 'function') {
      App.stateIO.resetDataKeepUI({ reason: 'load:cloudEmpty', sourceType: 'cloud' });
    }
    markCleanFromCurrent({ label: 'none', sourceType: 'none' });
  }

  function buildSnapshotMetaFromRow(row, sourceType) {
    sourceType = sourceType || 'cloud';
    return {
      label: row && row.label ? row.label : '',
      createdAt: row && (row.created_at || row.updated_at || row.createdAt) ? (row.created_at || row.updated_at || row.createdAt) : null,
      sourceType: sourceType,
      snapshotId: row && row.id ? row.id : null,
      appVersion: row && row.app_version ? row.app_version : null,
      ownerId: row && row.owner_id ? row.owner_id : null,
      note: row && row.note ? row.note : null,
      legacy: sourceType === 'legacy',
      isImported: sourceType === 'json'
    };
  }

  async function tryLoadLegacyLatest(supa, targetUserId, opts) {
    opts = opts || {};
    var legacyResult = await supa
      .from('app_states')
      .select('user_id, updated_at, state_json')
      .eq('user_id', targetUserId)
      .order('updated_at', { ascending: false })
      .limit(1);

    var legacyError = legacyResult && legacyResult.error ? legacyResult.error : null;
    if (legacyError) {
      console.warn('[Snapshots] Legacy app_states fallback failed:', legacyError);
      return { ok: false, reason: 'legacy_query_failed', error: legacyError };
    }

    var rows = (legacyResult && legacyResult.data) || [];
    if (!rows.length || !rows[0] || !rows[0].state_json) {
      return { ok: false, reason: 'empty' };
    }

    var applyResult = validateAndApplySnapshot(rows[0].state_json, { silentError: !!opts.silentError });
    if (!applyResult.ok) {
      return applyResult;
    }

    markCleanFromSnapshot(buildSnapshotMetaFromRow(rows[0], 'legacy'), rows[0].state_json);
    return { ok: true, source: 'legacy', row: rows[0] };
  }

  async function loadLatestSnapshotFromSupabase(opts) {
    opts = opts || {};
    var access = await resolveCloudAccess({ silentAuthError: !!opts.silentAuthError });
    if (!access.ok) return false;

    var supa = access.supa;
    var targetUserId = access.accessInfo && access.accessInfo.targetUserId ? access.accessInfo.targetUserId : access.viewerId;

    try {
      var result = await supa
        .from('app_snapshots')
        .select('id, owner_id, created_at, app_version, note, state_json')
        .eq('owner_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(1);

      var error = result && result.error ? result.error : null;
      if (error) {
        console.error('[Snapshots] Failed to load latest snapshot:', error);
        if (!opts.silentError && typeof App.showToast === 'function') {
          App.showToast('오류 발생 — 다시 시도해주세요.');
        }
        return false;
      }

      var rows = (result && result.data) || [];
      if (rows.length && rows[0] && rows[0].state_json) {
        var applyResult = validateAndApplySnapshot(rows[0].state_json, { silentError: !!opts.silentError });
        if (!applyResult.ok) return false;
        markCleanFromSnapshot(buildSnapshotMetaFromRow(rows[0], 'cloud'), rows[0].state_json);
        if (!opts.silentSuccess && typeof App.showToast === 'function') {
          App.showToast('Snapshot Load 완료 — 최신 저장본을 반영했습니다.');
        }
        return true;
      }

      var legacy = await tryLoadLegacyLatest(supa, targetUserId, { silentError: !!opts.silentError });
      if (legacy.ok) {
        if (!opts.silentSuccess && typeof App.showToast === 'function') {
          App.showToast('Legacy Snapshot Load 완료 — 기존 저장본을 반영했습니다.');
        }
        return true;
      }

      if (opts.resetOnEmpty !== false) {
        applyEmptyStateBaseline({ resetData: true });
      } else {
        markCleanFromCurrent({ label: 'none', sourceType: 'none' });
      }
      if (!opts.silentNoData && typeof App.showToast === 'function') {
        App.showToast('Load — 저장된 snapshot이 없습니다.');
      }
      return false;
    } catch (err) {
      console.error('[Snapshots] Unexpected latest snapshot load error:', err);
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return false;
    }
  }

  async function saveSnapshotToSupabase(opts) {
    opts = opts || {};
    var access = await resolveCloudAccess({ silentAuthError: false });
    if (!access.ok) return false;

    if (isReadOnlyViewer(access.accessInfo, access.viewerId)) {
      console.warn('[Snapshots] Save blocked for read-only viewer account.');
      if (typeof App.showToast === 'function') {
        App.showToast('읽기 전용 계정입니다 — Save 불가');
      }
      return false;
    }

    ensureCloudStateModuleLoaded();
    if (!App.cloudState || typeof App.cloudState.build !== 'function') {
      console.error('[Snapshots] CloudState module is not available.');
      if (typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return false;
    }

    if (App.util && typeof App.util.repairLoanClaimDisplayIds === 'function') {
      App.util.repairLoanClaimDisplayIds();
    }
    if (App.util && typeof App.util.ensureLoanClaimDisplayIds === 'function') {
      App.util.ensureLoanClaimDisplayIds();
    }

    var snapshot;
    try {
      snapshot = App.cloudState.build();
    } catch (e) {
      console.error('[Snapshots] Failed to build snapshot:', e);
      if (typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return false;
    }

    try {
      var insertResult = await access.supa
        .from('app_snapshots')
        .insert({
          owner_id: access.viewerId,
          app_version: snapshot && snapshot.appVersion ? snapshot.appVersion : null,
          note: null,
          state_json: snapshot
        })
        .select('id, owner_id, created_at, app_version, note')
        .single();

      var error = insertResult && insertResult.error ? insertResult.error : null;
      if (error) {
        console.error('[Snapshots] Save failed:', error);
        if (typeof App.showToast === 'function') {
          App.showToast('오류 발생 — 다시 시도해주세요.');
        }
        return false;
      }

      var row = insertResult && insertResult.data ? insertResult.data : null;
      markCleanFromSnapshot(buildSnapshotMetaFromRow(row, 'cloud'), snapshot);
      if (typeof App.showToast === 'function') {
        App.showToast('Save 완료 — 새 snapshot이 생성되었습니다.');
      }
      return true;
    } catch (err) {
      console.error('[Snapshots] Unexpected save error:', err);
      if (typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return false;
    }
  }

  function classifyRows(rows) {
    var now = Date.now();
    var cutoff = now - (30 * 24 * 60 * 60 * 1000);
    var recent = [];
    var older = [];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var tsValue = row && (row.created_at || row.updated_at);
      var ts = tsValue ? new Date(tsValue).getTime() : 0;
      if (ts && ts >= cutoff) {
        recent.push(row);
      } else {
        older.push(row);
      }
    }

    return { recent: recent, older: older };
  }

  async function listSnapshotsFromSupabase(opts) {
    opts = opts || {};
    var access = await resolveCloudAccess({ silentAuthError: !!opts.silentAuthError });
    if (!access.ok) return null;

    var supa = access.supa;
    var targetUserId = access.accessInfo && access.accessInfo.targetUserId ? access.accessInfo.targetUserId : access.viewerId;

    try {
      var result = await supa
        .from('app_snapshots')
        .select('id, owner_id, created_at, app_version, note')
        .eq('owner_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(300);

      var error = result && result.error ? result.error : null;
      if (error) {
        console.error('[Snapshots] Failed to list snapshots:', error);
        if (!opts.silentError && typeof App.showToast === 'function') {
          App.showToast('오류 발생 — 다시 시도해주세요.');
        }
        return null;
      }

      var rows = (result && result.data) || [];
      var classified = classifyRows(rows);

      if (!rows.length) {
        var legacyResult = await supa
          .from('app_states')
          .select('user_id, updated_at')
          .eq('user_id', targetUserId)
          .order('updated_at', { ascending: false })
          .limit(1);
        var legacyError = legacyResult && legacyResult.error ? legacyResult.error : null;
        if (!legacyError) {
          var legacyRows = (legacyResult && legacyResult.data) || [];
          if (legacyRows.length && legacyRows[0]) {
            classified.recent.push({
              id: 'legacy-latest',
              owner_id: targetUserId,
              created_at: legacyRows[0].updated_at,
              app_version: null,
              note: 'Legacy app_states latest',
              _legacy: true
            });
          }
        }
      }

      return {
        access: access,
        recent: classified.recent,
        older: classified.older
      };
    } catch (err) {
      console.error('[Snapshots] Unexpected list error:', err);
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return null;
    }
  }

  async function loadSnapshotByIdFromSupabase(snapshotId, opts) {
    opts = opts || {};
    var access = await resolveCloudAccess({ silentAuthError: !!opts.silentAuthError });
    if (!access.ok) return false;

    var supa = access.supa;
    var targetUserId = access.accessInfo && access.accessInfo.targetUserId ? access.accessInfo.targetUserId : access.viewerId;

    if (snapshotId === 'legacy-latest') {
      var legacy = await tryLoadLegacyLatest(supa, targetUserId, { silentError: !!opts.silentError });
      if (legacy.ok && !opts.silentSuccess && typeof App.showToast === 'function') {
        App.showToast('Legacy Snapshot Load 완료 — 기존 저장본을 반영했습니다.');
      }
      return !!legacy.ok;
    }

    try {
      var result = await supa
        .from('app_snapshots')
        .select('id, owner_id, created_at, app_version, note, state_json')
        .eq('owner_id', targetUserId)
        .eq('id', snapshotId)
        .limit(1)
        .single();

      var error = result && result.error ? result.error : null;
      if (error) {
        console.error('[Snapshots] Failed to load snapshot by id:', error);
        if (!opts.silentError && typeof App.showToast === 'function') {
          App.showToast('오류 발생 — 다시 시도해주세요.');
        }
        return false;
      }

      var row = result && result.data ? result.data : null;
      if (!row || !row.state_json) {
        if (!opts.silentError && typeof App.showToast === 'function') {
          App.showToast('Load — 선택한 snapshot을 찾지 못했습니다.');
        }
        return false;
      }

      var applyResult = validateAndApplySnapshot(row.state_json, { silentError: !!opts.silentError });
      if (!applyResult.ok) return false;
      markCleanFromSnapshot(buildSnapshotMetaFromRow(row, 'cloud'), row.state_json);
      if (!opts.silentSuccess && typeof App.showToast === 'function') {
        App.showToast('Snapshot Load 완료 — 선택한 저장본을 반영했습니다.');
      }
      return true;
    } catch (err) {
      console.error('[Snapshots] Unexpected snapshot load error:', err);
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return false;
    }
  }

  async function deleteSnapshotsFromSupabase(ids, opts) {
    opts = opts || {};
    ids = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (!ids.length) return false;

    var access = await resolveCloudAccess({ silentAuthError: !!opts.silentAuthError });
    if (!access.ok) return false;
    if (isReadOnlyViewer(access.accessInfo, access.viewerId)) {
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('읽기 전용 계정입니다 — 삭제 불가');
      }
      return false;
    }

    try {
      var result = await access.supa
        .from('app_snapshots')
        .delete()
        .eq('owner_id', access.viewerId)
        .in('id', ids);

      var error = result && result.error ? result.error : null;
      if (error) {
        console.error('[Snapshots] Failed to delete snapshots:', error);
        if (!opts.silentError && typeof App.showToast === 'function') {
          App.showToast('오류 발생 — 다시 시도해주세요.');
        }
        return false;
      }

      if (!opts.silentSuccess && typeof App.showToast === 'function') {
        App.showToast('삭제 완료 — snapshot을 정리했습니다.');
      }
      return true;
    } catch (err) {
      console.error('[Snapshots] Unexpected delete error:', err);
      if (!opts.silentError && typeof App.showToast === 'function') {
        App.showToast('오류 발생 — 다시 시도해주세요.');
      }
      return false;
    }
  }

  async function deleteOldSnapshotsFromSupabase(opts) {
    opts = opts || {};
    var listing = await listSnapshotsFromSupabase({ silentError: !!opts.silentError });
    if (!listing) return false;
    var ids = [];
    for (var i = 0; i < listing.older.length; i++) {
      if (listing.older[i] && listing.older[i].id && !listing.older[i]._legacy) {
        ids.push(listing.older[i].id);
      }
    }
    if (!ids.length) {
      if (!opts.silentSuccess && typeof App.showToast === 'function') {
        App.showToast('삭제할 오래된 snapshot이 없습니다.');
      }
      return false;
    }
    return deleteSnapshotsFromSupabase(ids, opts);
  }

  function buildMetaLine(row) {
    var parts = [];
    if (row && row.app_version) parts.push(String(row.app_version));
    if (row && row.note) parts.push(String(row.note));
    if (row && row._legacy) parts.push('legacy fallback');
    return parts.join(' · ');
  }

  function createButton(text, className, onClick) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = text;
    if (typeof onClick === 'function') {
      btn.addEventListener('click', onClick);
    }
    return btn;
  }

  function createRow(row, allowDelete, onLoad, onDelete) {
    var rowEl = document.createElement('div');
    rowEl.className = 'snapshot-list-row';

    var body = document.createElement('div');
    body.className = 'snapshot-list-row__body';

    var title = document.createElement('div');
    title.className = 'snapshot-list-row__title';
    title.textContent = formatSnapshotTimestamp(row && (row.created_at || row.updated_at));
    body.appendChild(title);

    var metaText = buildMetaLine(row);
    if (metaText) {
      var meta = document.createElement('div');
      meta.className = 'snapshot-list-row__meta';
      meta.textContent = metaText;
      body.appendChild(meta);
    }

    var actions = document.createElement('div');
    actions.className = 'snapshot-list-row__actions';
    actions.appendChild(createButton('Load', 'snapshot-list-row__btn snapshot-list-row__btn--load', function () {
      onLoad(row);
    }));
    if (allowDelete && !row._legacy) {
      actions.appendChild(createButton('Delete', 'snapshot-list-row__btn snapshot-list-row__btn--delete', function () {
        onDelete(row);
      }));
    }

    rowEl.appendChild(body);
    rowEl.appendChild(actions);
    return rowEl;
  }

  function createSection(titleText, rows, allowDelete, onLoad, onDelete) {
    var section = document.createElement('section');
    section.className = 'snapshot-list-group';

    var title = document.createElement('h4');
    title.className = 'snapshot-list-group__title';
    title.textContent = titleText;
    section.appendChild(title);

    if (!rows.length) {
      var empty = document.createElement('div');
      empty.className = 'snapshot-list-empty';
      empty.textContent = '표시할 snapshot이 없습니다.';
      section.appendChild(empty);
      return section;
    }

    for (var i = 0; i < rows.length; i++) {
      section.appendChild(createRow(rows[i], allowDelete, onLoad, onDelete));
    }
    return section;
  }

  function createOlderDisclosure(rows, allowDelete, onLoad, onDelete, onDeleteOlderAll) {
    var section = document.createElement('section');
    section.className = 'snapshot-list-group';

    var details = document.createElement('details');
    details.className = 'snapshot-list-older';

    var summary = document.createElement('summary');
    summary.className = 'snapshot-list-older__summary';
    summary.textContent = 'Older snapshots (' + rows.length + ')';
    details.appendChild(summary);

    if (allowDelete && rows.length) {
      var toolbar = document.createElement('div');
      toolbar.className = 'snapshot-list-older__toolbar';
      toolbar.appendChild(createButton('Delete older snapshots', 'snapshot-list-row__btn snapshot-list-row__btn--delete', onDeleteOlderAll));
      details.appendChild(toolbar);
    }

    var content = document.createElement('div');
    content.className = 'snapshot-list-older__content';
    if (!rows.length) {
      var empty = document.createElement('div');
      empty.className = 'snapshot-list-empty';
      empty.textContent = '오래된 snapshot이 없습니다.';
      content.appendChild(empty);
    } else {
      for (var i = 0; i < rows.length; i++) {
        content.appendChild(createRow(rows[i], allowDelete, onLoad, onDelete));
      }
    }
    details.appendChild(content);
    section.appendChild(details);
    return section;
  }

  function closeLoadModal() {
    if (statusState.modalEscHandler) {
      document.removeEventListener('keydown', statusState.modalEscHandler, true);
      statusState.modalEscHandler = null;
    }
    if (statusState.modalEl && statusState.modalEl.parentNode) {
      statusState.modalEl.parentNode.removeChild(statusState.modalEl);
    }
    statusState.modalEl = null;
  }

  function renderLoadModalBody(dialog, listing) {
    var body = dialog.querySelector('.snapshot-modal__body');
    if (!body) return;
    clearNode(body);

    var accessInfo = listing && listing.access ? listing.access.accessInfo : null;
    var viewerId = listing && listing.access ? listing.access.viewerId : null;
    var allowDelete = !isReadOnlyViewer(accessInfo, viewerId) && !!viewerId;

    var recent = listing ? listing.recent : [];
    var older = listing ? listing.older : [];

    function handleLoad(row) {
      loadSnapshotByIdFromSupabase(row.id).then(function (ok) {
        if (ok) closeLoadModal();
      });
    }

    function handleDelete(row) {
      var ok = window.confirm('이 snapshot을 삭제할까요?');
      if (!ok) return;
      deleteSnapshotsFromSupabase([row.id]).then(function (deleted) {
        if (deleted) {
          listSnapshotsFromSupabase({ silentError: false }).then(function (nextListing) {
            if (nextListing) renderLoadModalBody(dialog, nextListing);
          });
        }
      });
    }

    function handleDeleteOlder() {
      var ok = window.confirm('30일보다 오래된 snapshot을 일괄 삭제할까요?');
      if (!ok) return;
      deleteOldSnapshotsFromSupabase({ silentError: false }).then(function (deleted) {
        if (deleted) {
          listSnapshotsFromSupabase({ silentError: false }).then(function (nextListing) {
            if (nextListing) renderLoadModalBody(dialog, nextListing);
          });
        }
      });
    }

    body.appendChild(createSection('Recent snapshots (last 30 days)', recent, allowDelete, handleLoad, handleDelete));
    body.appendChild(createOlderDisclosure(older, allowDelete, handleLoad, handleDelete, handleDeleteOlder));
  }

  async function openLoadModal() {
    closeLoadModal();

    var listing = await listSnapshotsFromSupabase({ silentError: false });
    if (!listing) return;

    var overlay = document.createElement('div');
    overlay.className = 'snapshot-modal';

    var backdrop = document.createElement('div');
    backdrop.className = 'snapshot-modal__backdrop';
    backdrop.addEventListener('click', closeLoadModal);

    var dialog = document.createElement('div');
    dialog.className = 'snapshot-modal__dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Load snapshot');

    var header = document.createElement('div');
    header.className = 'snapshot-modal__header';

    var title = document.createElement('h3');
    title.className = 'snapshot-modal__title';
    title.textContent = 'Load snapshot';
    header.appendChild(title);

    header.appendChild(createButton('Close', 'snapshot-modal__close', closeLoadModal));
    dialog.appendChild(header);

    var body = document.createElement('div');
    body.className = 'snapshot-modal__body';
    dialog.appendChild(body);

    overlay.appendChild(backdrop);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    statusState.modalEl = overlay;

    statusState.modalEscHandler = function (event) {
      if (event && event.key === 'Escape') {
        closeLoadModal();
      }
    };
    document.addEventListener('keydown', statusState.modalEscHandler, true);

    renderLoadModalBody(dialog, listing);
  }

  function init() {
    if (statusState.initialized) return;
    statusState.initialized = true;
    wrapCommitApis();
    if (!statusState.baselineHash) {
      clearStatus();
    } else {
      renderStatus();
    }
  }

  snapshotStatus.init = init;
  snapshotStatus.clear = clearStatus;
  snapshotStatus.markCleanFromSnapshot = markCleanFromSnapshot;
  snapshotStatus.markCleanFromCurrent = markCleanFromCurrent;
  snapshotStatus.scheduleDirtyCheck = scheduleDirtyCheck;
  snapshotStatus.runDirtyCheck = runDirtyCheck;
  snapshotStatus.formatSnapshotTimestamp = formatSnapshotTimestamp;
  snapshotStatus.getCurrentMeta = function () { return normalizeMeta(statusState.currentMeta); };

  snapshotsApi.openLoadModal = openLoadModal;
  snapshotsApi.closeLoadModal = closeLoadModal;

  App.data = App.data || {};
  App.data.loadLatestSnapshotFromSupabase = loadLatestSnapshotFromSupabase;
  App.data.saveSnapshotToSupabase = saveSnapshotToSupabase;
  App.data.listSnapshotsFromSupabase = listSnapshotsFromSupabase;
  App.data.loadSnapshotByIdFromSupabase = loadSnapshotByIdFromSupabase;
  App.data.deleteSnapshotsFromSupabase = deleteSnapshotsFromSupabase;
  App.data.deleteOldSnapshotsFromSupabase = deleteOldSnapshotsFromSupabase;

  App.data.loadAllFromSupabase = function (opts) {
    return loadLatestSnapshotFromSupabase(opts || {});
  };
  App.data.saveToSupabase = function (opts) {
    return saveSnapshotToSupabase(opts || {});
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
''', encoding='utf-8')

# layout.css append overrides
layout_css = (root/'css/layout.css').read_text(encoding='utf-8')
layout_css += '''

/* v3.2.32 snapshot topbar + modal */
.topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, auto) auto;
  align-items: center;
}

.topbar-main,
.topbar-center,
.topbar-meta {
  min-width: 0;
}

.topbar-main {
  display: flex;
  align-items: center;
  gap: var(--font-md);
}

.topbar-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.topbar-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.snapshot-status {
  min-width: 0;
  max-width: min(100%, 520px);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--charcoal-border-subtle);
  background: var(--charcoal-bg-elevated);
  color: var(--charcoal-text-secondary);
  box-shadow: 0 1px 10px rgba(15, 23, 42, 0.06);
}

.snapshot-status__label {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.snapshot-status__dirty {
  flex: 0 0 auto;
  white-space: nowrap;
  color: #b42318;
  font-weight: 700;
}

.snapshot-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.json-menu-root {
  position: relative;
}

.json-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 168px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid var(--charcoal-border-subtle);
  background: #fff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
  z-index: 90;
}

.json-menu[hidden] {
  display: none !important;
}

.json-menu__item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  padding: 9px 12px;
  border: 0;
  background: transparent;
  border-radius: 10px;
  color: var(--charcoal-text-primary);
  font-size: 13px;
  cursor: pointer;
}

.json-menu__item:hover {
  background: rgba(15, 23, 42, 0.06);
}

.snapshot-modal {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
}

.snapshot-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(3px);
}

.snapshot-modal__dialog {
  position: relative;
  z-index: 1;
  width: min(760px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid var(--charcoal-border-subtle);
  background: #fff;
  box-shadow: 0 22px 48px rgba(15, 23, 42, 0.28);
}

.snapshot-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--charcoal-border-subtle);
}

.snapshot-modal__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--charcoal-text-primary);
}

.snapshot-modal__close {
  border: 1px solid var(--charcoal-border-subtle);
  background: #fff;
  color: var(--charcoal-text-secondary);
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
}

.snapshot-modal__body {
  overflow: auto;
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.snapshot-list-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.snapshot-list-group__title {
  margin: 0;
  font-size: 13px;
  color: var(--charcoal-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.snapshot-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--charcoal-border-subtle);
  background: var(--charcoal-bg-elevated);
}

.snapshot-list-row__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.snapshot-list-row__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--charcoal-text-primary);
}

.snapshot-list-row__meta {
  font-size: 12px;
  color: var(--charcoal-text-muted);
}

.snapshot-list-row__actions {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.snapshot-list-row__btn {
  border-radius: 10px;
  border: 1px solid var(--charcoal-border-subtle);
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
}

.snapshot-list-row__btn--load {
  background: var(--accent, #2563eb);
  color: #fff;
  border-color: var(--accent, #2563eb);
}

.snapshot-list-row__btn--delete {
  background: #fff;
  color: #b42318;
}

.snapshot-list-older {
  border-radius: 14px;
  border: 1px solid var(--charcoal-border-subtle);
  background: #fff;
}

.snapshot-list-older__summary {
  list-style: none;
  cursor: pointer;
  padding: 14px 16px;
  font-weight: 700;
  color: var(--charcoal-text-primary);
}

.snapshot-list-older__summary::-webkit-details-marker {
  display: none;
}

.snapshot-list-older__toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 0 16px 12px;
}

.snapshot-list-older__content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 16px 16px;
}

.snapshot-list-empty {
  padding: 16px;
  border-radius: 14px;
  border: 1px dashed var(--charcoal-border-subtle);
  color: var(--charcoal-text-muted);
  background: rgba(255, 255, 255, 0.9);
}

.ls-viewer .save-load-controls { display: none !important; }
.ls-viewer #save-btn,
.ls-viewer .json-menu-root { display: none !important; }
'''
(root/'css/layout.css').write_text(layout_css, encoding='utf-8')

# mobile.css append overrides
mobile_css = (root/'css/mobile.css').read_text(encoding='utf-8')
mobile_css += '''

/* v3.2.32 snapshot controls */
html.ls-mobile .topbar {
  grid-template-columns: 1fr;
  align-items: stretch;
}

html.ls-mobile .topbar-main,
html.ls-mobile .topbar-center,
html.ls-mobile .topbar-meta {
  width: 100%;
}

html.ls-mobile .topbar-center {
  order: 2;
  justify-content: flex-start;
}

html.ls-mobile .topbar-meta {
  order: 3;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

html.ls-mobile .snapshot-status {
  width: 100%;
  max-width: none;
}

html.ls-mobile .snapshot-status__label {
  min-width: 0;
  max-width: 100%;
}

html.ls-mobile .snapshot-controls {
  width: auto;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

html.ls-mobile .snapshot-controls .nav-btn {
  flex: 0 0 auto;
  min-width: 0;
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 8px;
}

html.ls-mobile .json-menu {
  right: 0;
  left: auto;
  min-width: 152px;
  max-width: calc(100vw - 24px);
}

html.ls-mobile .snapshot-modal__dialog {
  width: calc(100vw - 20px);
  max-height: calc(100vh - 20px);
}

html.ls-mobile .snapshot-list-row {
  align-items: flex-start;
  flex-direction: column;
}

html.ls-mobile .snapshot-list-row__actions {
  width: 100%;
  justify-content: flex-end;
}
'''
(root/'css/mobile.css').write_text(mobile_css, encoding='utf-8')

# mobile.js targeted updates
mobile_js = (root/'js/ui/mobile.js').read_text(encoding='utf-8')
mobile_js = mobile_js.replace("      '#local-save-btn',\n      '#cloud-save-btn',", "      '#save-btn',\n      '#json-btn',")
mobile_js = mobile_js.replace("    if (App.local) wrapFn(App.local, 'save', '모바일(Read-only)에서는 저장할 수 없습니다.');\n    if (App.data) wrapFn(App.data, 'saveToSupabase', '모바일(Read-only)에서는 Cloud Save가 차단됩니다.');", "    if (App.local) wrapFn(App.local, 'save', '모바일(Read-only)에서는 저장할 수 없습니다.');\n    if (App.data) wrapFn(App.data, 'saveToSupabase', '모바일(Read-only)에서는 Save가 차단됩니다.');\n    if (App.data) wrapFn(App.data, 'saveSnapshotToSupabase', '모바일(Read-only)에서는 Save가 차단됩니다.');\n    if (App.jsonIO) wrapFn(App.jsonIO, 'exportSnapshot', '모바일(Read-only)에서는 JSON 기능이 차단됩니다.');\n    if (App.jsonIO) wrapFn(App.jsonIO, 'importSnapshot', '모바일(Read-only)에서는 JSON 기능이 차단됩니다.');")
mobile_js = mobile_js.replace("      if (t && (t.closest('#local-save-btn') || t.closest('#cloud-save-btn'))) {\n        event.preventDefault();\n        event.stopPropagation();\n        showToast('모바일(Read-only)에서는 저장할 수 없습니다.');\n        return;\n      }", "      if (t && (t.closest('#save-btn') || t.closest('#json-btn'))) {\n        event.preventDefault();\n        event.stopPropagation();\n        showToast('모바일(Read-only)에서는 저장/JSON 기능이 차단됩니다.');\n        return;\n      }")
(root/'js/ui/mobile.js').write_text(mobile_js, encoding='utf-8')

# add supabase SQL
supa_dir = root/'supabase'
supa_dir.mkdir(exist_ok=True)
(supa_dir/'app_snapshots_setup.sql').write_text('''-- LoanShark v3.2.32
-- Apply this once in Supabase SQL Editor before using the new Save/Load snapshot history UI.

create extension if not exists pgcrypto;

create table if not exists public.app_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  app_version text null,
  note text null,
  state_json jsonb not null
);

create index if not exists idx_app_snapshots_owner_created_at
  on public.app_snapshots (owner_id, created_at desc);

alter table public.app_snapshots enable row level security;

grant select, insert, delete on public.app_snapshots to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_snapshots'
      and policyname = 'app_snapshots_select_owner_or_shared'
  ) then
    create policy app_snapshots_select_owner_or_shared
      on public.app_snapshots
      for select
      to authenticated
      using (
        auth.uid() = owner_id
        or exists (
          select 1
          from public.state_shares ss
          where ss.owner_id = app_snapshots.owner_id
            and ss.viewer_id = auth.uid()
            and coalesce(ss.role, 'read') in ('read', 'owner', 'edit')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_snapshots'
      and policyname = 'app_snapshots_insert_owner_only'
  ) then
    create policy app_snapshots_insert_owner_only
      on public.app_snapshots
      for insert
      to authenticated
      with check (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_snapshots'
      and policyname = 'app_snapshots_delete_owner_only'
  ) then
    create policy app_snapshots_delete_owner_only
      on public.app_snapshots
      for delete
      to authenticated
      using (auth.uid() = owner_id);
  end if;
end
$$;
''', encoding='utf-8')

# add log
log_dir = root/'log'
(log_dir/'v3232_cloud_snapshot_history_status_bar.json').write_text('''{
  "version": "v3.2.32_cloud_snapshot_history_status_bar",
  "baseVersion": "LoanShark_v3.2.31_stateio_ui_schema_final_lock",
  "summary": [
    "Save/Load/JSON 3-button snapshot UI",
    "Cloud snapshot history via app_snapshots insert-based storage",
    "Topbar snapshot label with unsaved changes detection",
    "JSON import/export downgraded to helper workflow",
    "Supabase SQL setup file included"
  ]
}
''', encoding='utf-8')
