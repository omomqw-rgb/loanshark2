
// DebtorList DOM Render Integration
window.App = window.App || {};
App.debtors = App.debtors || {};

App.debtors.state = {
  query: "",
  page: 1,
  perPage: 15,
  filteredList: []
};

App.debtors.updateFilteredList = function () {
  var q = (App.debtors.state.query || "").toLowerCase();
  var full = (App.data && App.data.debtors) ? App.data.debtors : [];
  if (!q) {
    App.debtors.state.filteredList = full.slice();
    return;
  }
  App.debtors.state.filteredList = full.filter(function (d) {
    if (!d || !d.name) return false;
    return String(d.name).toLowerCase().indexOf(q) !== -1;
  });
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