
// DebtorList DOM Render Integration
window.App = window.App || {};
App.debtors = App.debtors || {};

App.debtors.state = {
  query: "",
  page: 1,
  perPage: 15,

  // v2.4 UI-only: View mode + Active-only toggle for list exploration
  // - viewMode: 'all' | 'loan' | 'claim' | 'risk'
  // - activeOnly: boolean (default ON)
  viewMode: "all",
  activeOnly: true,

  filteredList: []
};

App.debtors.updateFilteredList = function () {
  var st = App.debtors.state || {};
  var q = (st.query || "").toLowerCase();
  var full = (App.data && App.data.debtors) ? App.data.debtors : [];

  var viewMode = st.viewMode || "all";
  var activeOnly = (st.activeOnly !== false); // default ON

  var out = full.filter(function (d) {
    if (!d) return false;

    // 조건 토글: 활성만보기 (derived flag only)
    if (activeOnly && !d.hasAliveSchedule) return false;

    // View 모드: 포함/제외 범위만 변경 (정렬/계산/판정 로직 변경 없음)
    if (viewMode === "loan") {
      var loanCnt = (d.loanCount != null) ? d.loanCount : 0;
      if (!(loanCnt > 0)) return false;
    } else if (viewMode === "claim") {
      var claimCnt = (d.claimCount != null) ? d.claimCount : 0;
      if (!(claimCnt > 0)) return false;
    } else if (viewMode === "risk") {
      // 위험 관점: derived overdue schedule flag only
      if (!d.hasOverdueSchedule) return false;
    }

    // 검색: 이름 기준 (기존 방식 유지)
    if (q) {
      if (!d.name) return false;
      return String(d.name).toLowerCase().indexOf(q) !== -1;
    }
    return true;
  });

  App.debtors.state.filteredList = out;
};

App.debtors.renderList = function () {
  var root = document.getElementById("debtor-list-root");
  if (!root) return;

  root.innerHTML = "";
  var st = App.debtors.state;
  var perPage = st.perPage;
  var start = (st.page - 1) * perPage;
  var end = start + perPage;
  var list = st.filteredList.slice(start, end);

  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    root.appendChild(App.debtors.renderItem(item));
  }

  if (typeof App.debtors._updatePaginationUI === "function") {
    App.debtors._updatePaginationUI();
  }
};

App.debtors.renderItem = function (d) {
  var wrap = document.createElement("div");
  wrap.className = "dlist-item";

  // 왼쪽: 6px 검정 점 + 이름
  var colLeft = document.createElement("div");
  colLeft.className = "dlist-col-left";

  var bullet = document.createElement("span");
  bullet.className = "dlist-bullet";

  var name = document.createElement("span");
  name.className = "dlist-name";
  name.textContent = d && d.name ? d.name : "";

  colLeft.appendChild(bullet);
  colLeft.appendChild(name);

  // 가운데: L{loanCount} · C{claimCount}
  var colCenter = document.createElement("div");
  colCenter.className = "dlist-col-center";

  var counts = document.createElement("span");
  counts.className = "dlist-counts";

  var loanCnt = (d && d.loanCount != null) ? d.loanCount : 0;
  var claimCnt = (d && d.claimCount != null) ? d.claimCount : 0;
  counts.textContent = "L" + loanCnt + " · C" + claimCnt;

  colCenter.appendChild(counts);

  // 오른쪽: 상태 점
  var colRight = document.createElement("div");
  colRight.className = "dlist-col-right";

  var statusDot = document.createElement("span");
  statusDot.className = "dlist-status-dot";

  // v022_1: status icon is derived strictly from schedule existence.
  // UI must only consume derived flags (no schedule traversal, no amounts, no card states).
  var hasAliveSchedule = !!(d && d.hasAliveSchedule);
  var hasOverdueSchedule = !!(d && d.hasOverdueSchedule);

  if (!hasAliveSchedule) {
    statusDot.className += " dlist-status--inactive";         // 회색
  } else if (hasOverdueSchedule) {
    statusDot.className += " dlist-status--active-overdue";   // 주황
  } else {
    statusDot.className += " dlist-status--active-ok";        // 초록
  }

  colRight.appendChild(statusDot);

  // 레이아웃 조립
  wrap.appendChild(colLeft);
  wrap.appendChild(colCenter);
  wrap.appendChild(colRight);

  // 클릭 시 DebtorDetail 진입 (기존 로직 유지)
  wrap.addEventListener("click", function () {
    var id = (d && d.id != null) ? String(d.id) : null;
    if (!id) return;

    // Stage 3: Navigation boundary via App.api.view
    if (App.api && App.api.view && typeof App.api.view.openDebtorDetail === 'function') {
      App.api.view.openDebtorDetail(id);
    }
  });

  return wrap;
};


/* ===== v2.4: List View / Active Toggle UI helpers ===== */

App.debtors._setViewModeUI = function (mode) {
  var btns = document.querySelectorAll(".dlist-view-btn[data-view]");
  if (!btns || !btns.length) return;
  for (var i = 0; i < btns.length; i++) {
    var b = btns[i];
    var v = b.getAttribute("data-view") || "all";
    if (v === mode) {
      b.classList.add("active");
      b.classList.add("is-active");
      b.setAttribute("aria-selected", "true");
    } else {
      b.classList.remove("active");
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    }
  }
};

App.debtors._setActiveOnlyUI = function (isOn) {
  var btn = document.querySelector('[data-role="dlist-active-toggle"]');
  if (!btn) return;
  if (isOn) {
    btn.classList.add("is-on");
    btn.classList.remove("is-off");
    btn.setAttribute("aria-pressed", "true");
  } else {
    btn.classList.remove("is-on");
    btn.classList.add("is-off");
    btn.setAttribute("aria-pressed", "false");
  }
};

App.debtors.initDom = function () {
  // Stage 6: Register a safe coordinator renderer that refreshes the filtered list
  // before rendering. This avoids stale list UI after DERIVED rebuilds.
  if (App.renderCoordinator && App.ViewKey && App.ViewKey.DEBTOR_LIST && typeof App.debtors.renderList === "function") {
    var renderListFromState = function () {
      if (App.debtors && typeof App.debtors.updateFilteredList === "function") {
        App.debtors.updateFilteredList();
      }
      if (App.debtors && typeof App.debtors.renderList === "function") {
        App.debtors.renderList();
      }
    };
    renderListFromState._ls_fromUIState = true;
    App.renderCoordinator.register(App.ViewKey.DEBTOR_LIST, renderListFromState);
  }

  var searchInput = document.querySelector(".dlist-search-input");
  var addBtn = document.querySelector(".dlist-add-btn");
  var prevBtn = document.querySelector(".dlist-page-prev");
  var nextBtn = document.querySelector(".dlist-page-next");
  var pageLabel = document.querySelector(".dlist-page-label");
  var viewBtns = document.querySelectorAll(".dlist-view-btn[data-view]");
  var activeToggleBtn = document.querySelector('[data-role="dlist-active-toggle"]');


  if (searchInput) {
    searchInput.addEventListener("input", function () {
      App.debtors.state.query = searchInput.value.trim();
      App.debtors.updateFilteredList();
      App.debtors.state.page = 1;
      App.debtors.renderList();
    });
  }

  if (addBtn) {
    addBtn.addEventListener("click", function () {
      if (App.features && App.features.debtors &&
          typeof App.features.debtors.openDebtorModal === 'function') {
        App.features.debtors.openDebtorModal('create', null);
      }
    });
  }

  // v2.4: View 모드 (전체/대출/채권/위험)
  if (viewBtns && viewBtns.length) {
    for (var vb = 0; vb < viewBtns.length; vb++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          var mode = btn.getAttribute("data-view") || "all";
          App.debtors.state.viewMode = mode;

          if (typeof App.debtors._setViewModeUI === "function") {
            App.debtors._setViewModeUI(mode);
          }

          App.debtors.updateFilteredList();
          App.debtors.state.page = 1;
          App.debtors.renderList();
        });
      })(viewBtns[vb]);
    }
  }

  // v2.4: 조건 토글 (활성만보기)
  if (activeToggleBtn) {
    activeToggleBtn.addEventListener("click", function () {
      var st = App.debtors.state || {};
      st.activeOnly = !st.activeOnly;

      if (typeof App.debtors._setActiveOnlyUI === "function") {
        App.debtors._setActiveOnlyUI(!!st.activeOnly);
      }

      App.debtors.updateFilteredList();
      st.page = 1;
      App.debtors.renderList();
    });
  }


  var updatePaginationUI = function () {
    if (!pageLabel) return;
    var st = App.debtors.state;
    var totalPages = Math.max(1, Math.ceil(st.filteredList.length / st.perPage));
    pageLabel.textContent = st.page + " / " + totalPages;
    if (prevBtn) {
      prevBtn.disabled = (st.page <= 1);
    }
    if (nextBtn) {
      nextBtn.disabled = (st.page >= totalPages);
    }
  };

  App.debtors._updatePaginationUI = updatePaginationUI;

  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      var st = App.debtors.state;
      if (st.page > 1) {
        st.page -= 1;
        App.debtors.renderList();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      var st = App.debtors.state;
      var totalPages = Math.max(1, Math.ceil(st.filteredList.length / st.perPage));
      if (st.page < totalPages) {
        st.page += 1;
        App.debtors.renderList();
      }
    });
  }

  // v2.4 defaults (UI-only)
  if (!App.debtors.state.viewMode) App.debtors.state.viewMode = "all";
  if (typeof App.debtors.state.activeOnly !== "boolean") App.debtors.state.activeOnly = true;

  if (typeof App.debtors._setViewModeUI === "function") {
    App.debtors._setViewModeUI(App.debtors.state.viewMode);
  }
  if (typeof App.debtors._setActiveOnlyUI === "function") {
    App.debtors._setActiveOnlyUI(!!App.debtors.state.activeOnly);
  }

  App.debtors.updateFilteredList();
  App.debtors.state.page = 1;
  App.debtors.renderList();

  if (App.debtorPanel && typeof App.debtorPanel.showList === "function") {
    App.debtorPanel.showList();
  }
};

document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById("debtor-sidepanel")) {
    App.debtors.initDom();
  }
});