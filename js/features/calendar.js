(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  App.features = App.features || {};
  var util = App.util || {};

  var DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

  var STATUS_LABEL = {
    PLANNED: '예정',
    PAID: '완납',
    PARTIAL: '부분납',
    OVERDUE: '미납'
  };
  var STATUS_AMOUNT_CLASS = {
    PLANNED: 'amount-planned',
    PAID: 'amount-paid',
    PARTIAL: 'amount-partial',
    OVERDUE: 'amount-overdue'
  };

  function getAmountClassByStatus(status) {
    if (!status) return '';
    status = String(status).toUpperCase();
    return STATUS_AMOUNT_CLASS[status] || '';
  }


  var eventsBound = false;

  function pad2(v) {
    if (util.pad2) return util.pad2(v);
    v = Number(v) || 0;
    return v < 10 ? '0' + v : String(v);
  }

  function toISODate(date) {
    if (!(date instanceof Date)) date = new Date(date);
    if (isNaN(date.getTime())) return '';
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function parseISODate(str) {
    if (!str) return null;
    var d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function addDays(date, days) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + days);
    return d;
  }

  function addMonths(date, months) {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
  }

  function getDefaultCalendarView() {
    // Default must be centralized (core/state.js). This helper only reads it.
    if (App && typeof App.getDefaultCalendarView === 'function') {
      return App.getDefaultCalendarView();
    }
    // Safety fallback (should not be hit in this build)
    return 'week';
  }

  function ensureCalendarState() {
    var state = App.state || (App.state = {});
    state.ui = state.ui || {};
    if (!state.ui.calendar) {
      var today = new Date();
      state.ui.calendar = {
        view: getDefaultCalendarView(), // 'month' | 'week'
        currentDate: toISODate(today),
        // 주 상세 패널의 정렬 모드. 'type' = 대출/채권 타입 기준, 'status' = 상태 기준
        sortMode: 'type'
      };
    } else {
      if (!state.ui.calendar.currentDate) {
        state.ui.calendar.currentDate = toISODate(new Date());
      }
      if (state.ui.calendar.view !== 'month' && state.ui.calendar.view !== 'week') {
        state.ui.calendar.view = getDefaultCalendarView();
      }
      // sortMode 기본값 지정
      if (!state.ui.calendar.sortMode) {
        state.ui.calendar.sortMode = 'type';
      }
    }
    return state.ui.calendar;
  }

  function buildIndex(list, key) {
    var map = Object.create(null);
    if (!list) return map;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item && item[key] != null) {
        map[item[key]] = item;
      }
    }
    return map;
  }

  function buildCalendarData() {
    var state = App.state || {};
    var schedules = [];

    if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      try {
        schedules = App.schedulesEngine.getAll() || [];
      } catch (e) {
        schedules = [];
      }
    }

    var debtorsById = buildIndex(state.debtors || [], 'id');
    var loansById = buildIndex(state.loans || [], 'id');
    var claimsById = buildIndex(state.claims || [], 'id');

    var todayISO = toISODate(new Date());

    var metricsByDate = Object.create(null);
    var itemsByDate = Object.create(null);

    for (var i = 0; i < schedules.length; i++) {
      var s = schedules[i];
      if (!s || !s.dueDate) continue;

      // 카드 상태가 꺾기(Roll)인 경우 해당 스케줄은 렌더 대상에서 제외한다
      if (s.kind === 'loan') {
        var parentLoan = loansById[s.loanId];
        if (parentLoan && parentLoan.cardStatus === '꺾기') continue;
      } else if (s.kind === 'claim') {
        var parentClaim = claimsById[s.claimId];
        if (parentClaim && parentClaim.cardStatus === '꺾기') continue;
      }

      var dateISO = String(s.dueDate);
      var status = s.status || 'PLANNED';

      var bucket = metricsByDate[dateISO];
      if (!bucket) {
        // 통계 집계: planned, paid, overdue. 부분입금은 planned 로 구분하지 않고 별도 필요시 확장 가능
        bucket = { planned: 0, paid: 0, partial: 0, overdue: 0 };
        metricsByDate[dateISO] = bucket;
      }

      var isPaid = status === 'PAID';
      var isPartial = status === 'PARTIAL';
      var isOverStatus = status === 'OVERDUE';
      var isOverdue = !isPaid && (isOverStatus || (dateISO < todayISO));

      if (isPaid) {
  bucket.paid += 1;
} else if (isPartial) {
  bucket.partial += 1;
} else if (isOverdue) {
  bucket.overdue += 1;
} else {
  bucket.planned += 1;
}

      var debtor = debtorsById[s.debtorId];
      var loan = loansById[s.loanId];
      var claim = claimsById[s.claimId];

      var kind = s.kind || (s.claimId ? 'claim' : 'loan');
      var typeLabel = kind === 'claim' ? '채권' : '대출';

      var debtorName = debtor && debtor.name ? debtor.name : '';
      var mainLabel = typeLabel;
      if (debtorName) mainLabel += ' · ' + debtorName;

      var amount = Number(s.amount || 0);
      var partial = Number(s.partialPaidAmount || 0);
      if (status === 'PARTIAL' && partial > 0 && partial < amount) {
        amount = amount - partial;
      }
      var amountText = '';
      if (amount) {
        if (util.formatCurrency) amountText = util.formatCurrency(amount);
        else amountText = String(amount);
      }

      var statusLabel = STATUS_LABEL[status] || status || '';

      // 회차 총 개수를 parent 객체의 installmentCount 값에서 가져온다
      var totalInstallments = 0;
      if (kind === 'loan' && loan) {
        totalInstallments = Number(loan.installmentCount) || 0;
      } else if (kind === 'claim' && claim) {
        totalInstallments = Number(claim.installmentCount) || 0;
      }

      var vm = {
        id: s.id,
        kind: kind,
        date: dateISO,
        debtorName: debtorName,
        typeLabel: typeLabel,
        mainLabel: mainLabel,
        amount: amount,
        amountText: amountText,
        installmentNo: s.installmentNo,
        totalInstallments: totalInstallments,
        status: status,
        statusLabel: statusLabel,
        isPaid: isPaid,
        isPartial: isPartial,
        isOverdue: isOverdue
      };

      var list = itemsByDate[dateISO];
      if (!list) {
        list = [];
        itemsByDate[dateISO] = list;
      }
      list.push(vm);
    }

    // sort each day's items a little
    for (var dateKey in itemsByDate) {
      if (!Object.prototype.hasOwnProperty.call(itemsByDate, dateKey)) continue;
      itemsByDate[dateKey].sort(function (a, b) {
        if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
        if (a.debtorName !== b.debtorName) return a.debtorName < b.debtorName ? -1 : 1;
        if (a.installmentNo !== b.installmentNo) {
          return (a.installmentNo || 0) - (b.installmentNo || 0);
        }
        return 0;
      });
    }

    return {
      metricsByDate: metricsByDate,
      itemsByDate: itemsByDate,
      todayISO: todayISO
    };
  }

  function buildHeader(calState, monthBase) {
    var header = document.createElement('div');
    header.className = 'calendar-header';

    var center = document.createElement('div');
    center.className = 'calendar-header-center';

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'calendar-nav-btn calendar-nav-prev';
    prevBtn.setAttribute('data-cal-nav', 'prev-month');
    prevBtn.textContent = '\u2039';

    var labelBtn = document.createElement('button');
    labelBtn.type = 'button';
    labelBtn.className = 'calendar-month-label-btn';
    labelBtn.textContent = monthBase.getFullYear() + '년 ' + (monthBase.getMonth() + 1) + '월';
    // 향후: labelBtn 클릭시 연/월 선택 패널 열기 등 확장 가능

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'calendar-nav-btn calendar-nav-next';
    nextBtn.setAttribute('data-cal-nav', 'next-month');
    nextBtn.textContent = '\u203a';

    center.appendChild(prevBtn);
    center.appendChild(labelBtn);
    center.appendChild(nextBtn);

    var right = document.createElement('div');
    right.className = 'calendar-header-right';

    var todayBtn = document.createElement('button');
    todayBtn.type = 'button';
    todayBtn.className = 'calendar-today-btn';
    todayBtn.setAttribute('data-cal-nav', 'today');
    todayBtn.textContent = '오늘';

    var toggle = document.createElement('div');
    toggle.className = 'calendar-view-toggle';

    var monthBtn = document.createElement('button');
    monthBtn.type = 'button';
    monthBtn.className = 'calendar-view-btn';
    monthBtn.setAttribute('data-cal-view', 'month');
    monthBtn.textContent = '월';

    var weekBtn = document.createElement('button');
    weekBtn.type = 'button';
    weekBtn.className = 'calendar-view-btn';
    weekBtn.setAttribute('data-cal-view', 'week');
    weekBtn.textContent = '주';

    if (calState.view === 'week') {
      weekBtn.classList.add('is-active');
    } else {
      monthBtn.classList.add('is-active');
    }

    toggle.appendChild(monthBtn);
    toggle.appendChild(weekBtn);

    right.appendChild(todayBtn);
    right.appendChild(toggle);

    header.appendChild(center);
    header.appendChild(right);

    return header;
  }

  function createMetricLine(kind, count) {
    var line = document.createElement('div');
    line.className = 'calendar-day-metric metric-' + kind;

    var dot = document.createElement('span');
    dot.className = 'calendar-metric-dot';
    dot.setAttribute('aria-hidden', 'true');

    var num = document.createElement('span');
    num.className = 'calendar-metric-count';
    num.textContent = String(count);

    line.appendChild(dot);
    line.appendChild(num);
    return line;
  }

  

  function buildMonthView(calState, monthBase, data) {
    var metricsByDate = data.metricsByDate;
    var todayISO = data.todayISO;
    var currentISO = calState.currentDate;
    var isWeekMode = calState.view === 'week';

    var container = document.createElement('div');
    container.className = 'calendar-month-view';
    if (isWeekMode) {
      container.classList.add('is-week-mode');
    } else {
      container.classList.add('is-month-mode');
    }

    var weekdayRow = document.createElement('div');
    weekdayRow.className = 'calendar-weekdays-row';

    for (var i = 0; i < 7; i++) {
      var wd = document.createElement('div');
      wd.className = 'calendar-weekday dow-' + i;
      wd.textContent = DAY_NAMES[i];
      weekdayRow.appendChild(wd);
    }

    container.appendChild(weekdayRow);

    var weeksWrap = document.createElement('div');
    weeksWrap.className = 'calendar-weeks';

    var year = monthBase.getFullYear();
    var monthIndex = monthBase.getMonth();

    var firstOfMonth = new Date(year, monthIndex, 1);
    var firstDayOfWeek = firstOfMonth.getDay(); // 0=Sun
    var gridStart = new Date(year, monthIndex, 1 - firstDayOfWeek);

    var gridDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate());

    var weeksInfo = [];

    for (var w = 0; w < 6; w++) {
      var weekRow = document.createElement('div');
      weekRow.className = 'calendar-week-row';

      var weekDays = [];

      for (var d = 0; d < 7; d++) {
        var cellDate = new Date(gridDate.getFullYear(), gridDate.getMonth(), gridDate.getDate());
        var iso = toISODate(cellDate);
        var dow = cellDate.getDay();
        var inMonth = cellDate.getMonth() === monthIndex;

        var dayBtn = document.createElement('button');
        dayBtn.type = 'button';
        dayBtn.className = 'calendar-day dow-' + dow;
        dayBtn.setAttribute('data-cal-date', iso);
        if (dow === 0) {
          dayBtn.classList.add('is-sunday');
        }
        if (dow === 6) {
          dayBtn.classList.add('is-saturday');
        }

        if (!inMonth) {
          dayBtn.classList.add('is-outside');
        }
        if (iso === todayISO) {
          dayBtn.classList.add('is-today');
        }
        if (iso === currentISO) {
          dayBtn.classList.add('is-selected');
        }

        var header = document.createElement('div');
        header.className = 'calendar-day-header';

        var dayLabel = document.createElement('span');
        dayLabel.className = 'calendar-day-number';
        dayLabel.textContent = String(cellDate.getDate());
        header.appendChild(dayLabel);

        dayBtn.appendChild(header);

        var metrics = metricsByDate[iso];
        if (metrics) {
          var metricsWrap = document.createElement('div');
          metricsWrap.className = 'calendar-day-metrics';

          if (metrics.planned > 0) {
            metricsWrap.appendChild(createMetricLine('planned', metrics.planned));
          }
          if (metrics.paid > 0) {
            metricsWrap.appendChild(createMetricLine('paid', metrics.paid));
          }
          if (metrics.partial > 0) {
            metricsWrap.appendChild(createMetricLine('partial', metrics.partial));
          }
          if (metrics.overdue > 0) {
            metricsWrap.appendChild(createMetricLine('overdue', metrics.overdue));
          }

          header.appendChild(metricsWrap);
        }

        weekRow.appendChild(dayBtn);

        weekDays.push({
          iso: iso,
          date: cellDate,
          dow: dow,
          el: dayBtn
        });

        gridDate.setDate(gridDate.getDate() + 1);
      }

      weeksWrap.appendChild(weekRow);

      weeksInfo.push({
        rowEl: weekRow,
        days: weekDays
      });
    }


    // mark current week (week containing today) for subtle highlight
    var currentWeekIndex = -1;
    for (var cwi = 0; cwi < weeksInfo.length; cwi++) {
      var cWeek = weeksInfo[cwi];
      for (var cdi = 0; cdi < cWeek.days.length; cdi++) {
        if (cWeek.days[cdi].iso === todayISO) {
          currentWeekIndex = cwi;
          break;
        }
      }
      if (currentWeekIndex !== -1) break;
    }
    if (currentWeekIndex !== -1 && weeksInfo[currentWeekIndex] && weeksInfo[currentWeekIndex].rowEl) {
      weeksInfo[currentWeekIndex].rowEl.classList.add('is-current-week');
    }
    // decide active week index
    var activeWeekIndex = -1;
    if (isWeekMode) {
      for (var wi = 0; wi < weeksInfo.length; wi++) {
        var week = weeksInfo[wi];
        for (var di = 0; di < week.days.length; di++) {
          if (week.days[di].iso === currentISO) {
            activeWeekIndex = wi;
            break;
          }
        }
        if (activeWeekIndex !== -1) break;
      }
      if (activeWeekIndex === -1) {
        activeWeekIndex = 0;
      }
    }

    if (isWeekMode && activeWeekIndex >= 0 && activeWeekIndex < weeksInfo.length) {
      var activeWeek = weeksInfo[activeWeekIndex];
      activeWeek.rowEl.classList.add('is-active-week');

      var itemsByDate = data.itemsByDate;

      for (var k = 0; k < activeWeek.days.length; k++) {
        var dayInfo = activeWeek.days[k];
        var iso = dayInfo.iso;
        var cellEl = dayInfo.el;
        if (!cellEl) continue;

        cellEl.classList.add('has-week-detail');

        var listWrap = document.createElement('div');
        listWrap.className = 'week-detail-items';

        var items = itemsByDate[iso] || [];
        if (!items.length) {
          var empty = document.createElement('div');
          empty.className = 'week-detail-empty';
          empty.textContent = '일정 없음';
          listWrap.appendChild(empty);
        } else {
          for (var j = 0; j < items.length; j++) {
            var it = items[j];
            var row = document.createElement('div');
            row.className = 'week-detail-item';
            // 상태에 따라 클래스 적용: PARTIAL 우선, 그 다음 PAID, 그 다음 OVERDUE
            if (it.isPartial) {
              row.classList.add('is-partial');
            } else if (it.isPaid) {
              row.classList.add('is-paid');
            } else if (it.isOverdue) {
              row.classList.add('is-overdue');
            }

            var main = document.createElement('div');
            main.className = 'week-detail-main';

            var pill = document.createElement('span');
            pill.className = 'week-item-pill week-item-pill-' + it.kind;
            pill.textContent = it.typeLabel;

            var nameSpan = document.createElement('span');
            nameSpan.className = 'week-item-debtor';
            // 이름 텍스트에도 상태별 amount-* 클래스를 적용해 색상을 금액과 동일 톤으로 맞춘다.
            // (색상 값은 기존 CSS 토큰/규칙을 그대로 사용)
            var nameCls = getAmountClassByStatus(it.status);
            if (nameCls) nameSpan.classList.add(nameCls);
            nameSpan.textContent = it.debtorName || '';

            main.appendChild(pill);
            if (it.debtorName) main.appendChild(nameSpan);

            var meta = document.createElement('div');
            meta.className = 'week-detail-meta';

            if (it.amountText) {
              var amt = document.createElement('span');
              amt.className = 'week-item-amount';
              var amtCls = getAmountClassByStatus(it.status);
              if (amtCls) amt.classList.add(amtCls);
              amt.textContent = it.amountText;
              meta.appendChild(amt);
            }

            var st = document.createElement('span');
            st.className = 'week-item-status';
            st.textContent = it.statusLabel;
            meta.appendChild(st);

            row.appendChild(main);
            row.appendChild(meta);

            listWrap.appendChild(row);
          }
        }

        cellEl.appendChild(listWrap);
      }
    }

    container.appendChild(weeksWrap);

    if (isWeekMode) {
      var arrows = document.createElement('div');
      arrows.className = 'calendar-week-arrows';

      var up = document.createElement('button');
      up.type = 'button';
      up.className = 'calendar-week-arrow arrow-up';
      up.setAttribute('data-cal-nav', 'week-prev');
      up.textContent = '\u02C4'; // small up arrow

      var down = document.createElement('button');
      down.type = 'button';
      down.className = 'calendar-week-arrow arrow-down';
      down.setAttribute('data-cal-nav', 'week-next');
      down.textContent = '\u02C5'; // small down arrow

      arrows.appendChild(up);
      arrows.appendChild(down);
      container.appendChild(arrows);
    }

    return container;
  }

  function buildDayDetail(calState, data) {
    // 데이터 참조 초기화
    var metricsByDate = data.metricsByDate;
    var itemsByDate = data.itemsByDate;
    var todayISO = data.todayISO;

    var currentISO = calState.currentDate;
    var dateObj = parseISODate(currentISO) || new Date();

    var container = document.createElement('div');
    container.className = 'calendar-day-detail';

    // 헤더 및 정렬 토글
    var header = document.createElement('div');
    header.className = 'day-detail-header';

    var title = document.createElement('div');
    title.className = 'day-detail-title';
    var dateText;
    if (util.formatDate) {
      dateText = util.formatDate(currentISO);
    } else {
      dateText = toISODate(dateObj);
    }
    var weekdayText = DAY_NAMES[dateObj.getDay()] || '';
    title.textContent = dateText + ' (' + weekdayText + ')';
    header.appendChild(title);

    if (currentISO === todayISO) {
      var todayBadge = document.createElement('span');
      todayBadge.className = 'day-detail-today';
      todayBadge.textContent = '오늘';
      header.appendChild(todayBadge);
    }

    var sortBtn = document.createElement('button');
    sortBtn.type = 'button';
    sortBtn.className = 'day-sort-toggle';
    sortBtn.setAttribute('data-day-sort-toggle', 'toggle');
    sortBtn.textContent = (calState.sortMode === 'status') ? '상태순' : '기본순';
    header.appendChild(sortBtn);
    container.appendChild(header);

    // 요약 메트릭
    var metrics = metricsByDate[currentISO] || { planned: 0, paid: 0, partial: 0, overdue: 0 };
    var summary = document.createElement('div');
    summary.className = 'day-detail-summary';
    var chipPlanned = document.createElement('div');
chipPlanned.className = 'day-summary-chip chip-planned';
chipPlanned.textContent = '예정 ' + metrics.planned;

var chipPaid = document.createElement('div');
chipPaid.className = 'day-summary-chip chip-paid';
chipPaid.textContent = '완료 ' + metrics.paid;

var chipPartial = document.createElement('div');
chipPartial.className = 'day-summary-chip chip-partial';
chipPartial.textContent = '부분 ' + metrics.partial;

var chipOverdue = document.createElement('div');
chipOverdue.className = 'day-summary-chip chip-overdue';
chipOverdue.textContent = '미납 ' + metrics.overdue;

summary.appendChild(chipPlanned);
summary.appendChild(chipPaid);
summary.appendChild(chipPartial);
summary.appendChild(chipOverdue);
    container.appendChild(summary);

    var listWrap = document.createElement('div');
    listWrap.className = 'day-detail-list';

    var items = itemsByDate[currentISO] || [];
    var sorted = items.slice();
    if (calState.sortMode === 'status') {
      var statusOrder = { 'PLANNED': 0, 'PAID': 1, 'PARTIAL': 2, 'OVERDUE': 3 };
      sorted.sort(function(a, b) {
        var sa = (statusOrder[a.status] !== undefined) ? statusOrder[a.status] : 0;
        var sb = (statusOrder[b.status] !== undefined) ? statusOrder[b.status] : 0;
        if (sa !== sb) return sa - sb;
        var an = (a.debtorName || '').toString();
        var bn = (b.debtorName || '').toString();
        return an.localeCompare(bn, 'ko-KR');
      });
    } else {
      sorted.sort(function(a, b) {
        if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
        var an = (a.debtorName || '').toString();
        var bn = (b.debtorName || '').toString();
        return an.localeCompare(bn, 'ko-KR');
      });
    }
    if (!sorted.length) {
      var empty = document.createElement('div');
      empty.className = 'day-detail-empty';
      empty.textContent = '등록된 일정이 없습니다.';
      listWrap.appendChild(empty);
    } else {
      for (var i = 0; i < sorted.length; i++) {
        var it = sorted[i];
        var row = document.createElement('div');
        row.className = 'day-detail-item';
        // add classes based on status for color styling
        if (it.isPartial) {
          row.classList.add('is-partial');
        } else if (it.isPaid) {
          row.classList.add('is-paid');
        } else if (it.isOverdue) {
          row.classList.add('is-overdue');
        }
        row.setAttribute('data-schedule-id', it.id);
        row.setAttribute('data-kind', it.kind);
        // 타입 텍스트 배지 (대출/채권) 생성
        var typeBadge = document.createElement('span');
        typeBadge.className = 'day-type-text-badge';
        if (it.kind === 'loan') {
          typeBadge.classList.add('badge-loan');
          typeBadge.textContent = 'L';
          typeBadge.title = '대출';
        } else {
          typeBadge.classList.add('badge-claim');
          typeBadge.textContent = 'C';
          typeBadge.title = '채권';
        }
        // 채무자명
        var nameEl = document.createElement('span');
        nameEl.className = 'day-item-name';
        // 이름 텍스트에도 상태별 amount-* 클래스를 적용해 색상을 금액과 동일 톤으로 맞춘다.
        // (색상 값은 기존 CSS 토큰/규칙을 그대로 사용)
        var nameCls = getAmountClassByStatus(it.status);
        if (nameCls) nameEl.classList.add(nameCls);
        nameEl.textContent = it.debtorName || '';
        // 금액
        var amtEl = null;
        if (it.amountText && (it.kind === 'loan' || (it.kind === 'claim' && it.amount > 0))) {
          amtEl = document.createElement('span');
          amtEl.className = 'day-item-amount';
          var amtCls = getAmountClassByStatus(it.status);
          if (amtCls) amtEl.classList.add(amtCls);
          amtEl.textContent = it.amountText;
        }
        // 상태 텍스트 배지
        var statusBadge = document.createElement('span');
        statusBadge.className = 'day-status-text-badge';
        var statusLabel;
        if (it.status === 'PAID') {
          statusBadge.classList.add('badge-paid');
          statusLabel = '완료';
        } else if (it.status === 'PARTIAL') {
          statusBadge.classList.add('badge-partial');
          statusLabel = '부분';
        } else if (it.status === 'OVERDUE') {
          statusBadge.classList.add('badge-overdue');
          statusLabel = '미납';
        } else {
          statusBadge.classList.add('badge-planned');
          statusLabel = '예정';
        }
        statusBadge.title = statusLabel;
        // Assemble row elements: type badge, name, installment info, amount, status
        row.appendChild(typeBadge);
        row.appendChild(nameEl);
        // Insert installment information between the debtor name and the amount/status.
        // If the schedule VM provides installmentNo and totalInstallments, render them.
        if (it.installmentNo && it.totalInstallments) {
          var instEl = document.createElement('span');
          instEl.className = 'day-item-installment';
          instEl.textContent = it.installmentNo + '/' + it.totalInstallments;
          row.appendChild(instEl);
        }
        // Wrap the amount and status in a right‑aligned container. Even if there is no amount,
        // the status badge should still be placed in this wrapper so that both elements
        // align to the right edge via CSS.
        var amtWrap = document.createElement('div');
        amtWrap.className = 'day-item-right';
        if (amtEl) {
          amtWrap.appendChild(amtEl);
        }
        amtWrap.appendChild(statusBadge);
        row.appendChild(amtWrap);
        listWrap.appendChild(row);
      }
    }
    container.appendChild(listWrap);
    return container;
  }

  function handleNav(action) {
    var calState = ensureCalendarState();
    var current = parseISODate(calState.currentDate) || new Date();

    if (action === 'prev-month') {
      var prevMonth = addMonths(new Date(current.getFullYear(), current.getMonth(), 1), -1);
      calState.currentDate = toISODate(prevMonth);
    } else if (action === 'next-month') {
      var nextMonth = addMonths(new Date(current.getFullYear(), current.getMonth(), 1), 1);
      calState.currentDate = toISODate(nextMonth);
    } else if (action === 'today') {
      calState.currentDate = toISODate(new Date());
    } else if (action === 'prev-day') {
      var prevDay = addDays(current, -1);
      calState.currentDate = toISODate(prevDay);
    } else if (action === 'next-day') {
      var nextDay = addDays(current, 1);
      calState.currentDate = toISODate(nextDay);
    } else if (action === 'week-prev') {
      var prev = addDays(current, -7);
      calState.currentDate = toISODate(prev);
    } else if (action === 'week-next') {
      var next = addDays(current, 7);
      calState.currentDate = toISODate(next);
    }

    render();
  }

  function handleViewToggle(view) {
    var calState = ensureCalendarState();
    if (view !== 'month' && view !== 'week') return;
    if (calState.view === view) return;
    calState.view = view;
    render();
  }

  function handleSelectDate(dateStr) {
    if (!dateStr) return;
    var calState = ensureCalendarState();
    calState.currentDate = dateStr;
    render();
  }

  // 정렬 토글 처리: 상태 모드와 타입 모드 사이를 전환한다.
  function handleDaySortToggle() {
    var calState = ensureCalendarState();
    var mode = calState.sortMode || 'type';
    calState.sortMode = (mode === 'type') ? 'status' : 'type';
    render();
  }

  // 일정 행 클릭 처리: 해당 스케줄에 맞는 모달을 열고 해당 회차로 스크롤 및 하이라이트 한다.
  function handleDayItemClick(scheduleId) {
    if (!scheduleId) return;

    // v3.2 Mobile(Read-only): 일정 모달(수정/저장)을 열지 않는다.
    if (App.ui && App.ui.mobile && typeof App.ui.mobile.isReadOnly === 'function' && App.ui.mobile.isReadOnly()) {
      if (typeof App.showToast === 'function') {
        App.showToast('모바일(Read-only)에서는 일정 변경이 불가합니다.');
      }
      return;
    }

    var schedules = [];
    if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
      try {
        schedules = App.schedulesEngine.getAll() || [];
      } catch (e) {
        schedules = [];
      }
    }

    var target = null;
    for (var i = 0; i < schedules.length; i++) {
      if (schedules[i].id === scheduleId) {
        target = schedules[i];
        break;
      }
    }
    if (!target) return;
    // 모달 열기: 대출/채권 구분
    if (target.kind === 'loan') {
      if (App.features.debtors && App.features.debtors.openLoanScheduleModal) {
        App.features.debtors.openLoanScheduleModal(target.loanId, scheduleId);
      }
    } else if (target.kind === 'claim') {
      if (App.features.debtors && App.features.debtors.openClaimScheduleModal) {
        App.features.debtors.openClaimScheduleModal(target.claimId, scheduleId);
      }
    }
  }

  function bindEvents() {
    if (eventsBound) return;
    var root = document.getElementById('calendar-root');
    if (!root) return;
    eventsBound = true;

    root.addEventListener('click', function (event) {
      var t = event.target;

      var navBtn = t.closest('[data-cal-nav]');
      if (navBtn && root.contains(navBtn)) {
        var action = navBtn.getAttribute('data-cal-nav');
        handleNav(action);
        return;
      }

      var viewBtn = t.closest('[data-cal-view]');
      if (viewBtn && root.contains(viewBtn)) {
        var view = viewBtn.getAttribute('data-cal-view');
        handleViewToggle(view);
        return;
      }

      var dayEl = t.closest('[data-cal-date]');
      if (dayEl && root.contains(dayEl)) {
        var dateStr = dayEl.getAttribute('data-cal-date');
        handleSelectDate(dateStr);
        return;
      }

      // 정렬 토글 클릭: [data-day-sort-toggle] 요소가 눌렸는지 확인
      var sortToggle = t.closest('[data-day-sort-toggle]');
      if (sortToggle && root.contains(sortToggle)) {
        handleDaySortToggle();
        return;
      }

      // Day detail 일정 행 클릭 처리
      var dayRow = t.closest('.day-detail-item');
      if (dayRow && root.contains(dayRow)) {
        var sid = dayRow.getAttribute('data-schedule-id');
        handleDayItemClick(sid);
        return;
      }
    });
  }

  // v3.2: Mobile layout detection (panel-based reuse)
  function isMobileLayout() {
    try {
      return !!(App.ui && App.ui.mobile && typeof App.ui.mobile.isMobile === 'function' && App.ui.mobile.isMobile());
    } catch (e) {
      return false;
    }
  }

  function clearRoot(node) {
    if (!node) return;
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  // v3.2 Mobile Calendar: reuse the PC right-side panel (day detail list) only.
  // - Month grid is NOT rendered on mobile.
  // - Adds mobile-only date navigation controls (Prev / Today / Next).
  function renderMobile(root, calState, data) {
    clearRoot(root);

    var shell = document.createElement('div');
    shell.className = 'calendar-mobile-shell';

    var nav = document.createElement('div');
    nav.className = 'calendar-mobile-nav';

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'calendar-mobile-nav-btn';
    prevBtn.setAttribute('data-cal-nav', 'prev-day');
    prevBtn.textContent = '◀ 이전 날짜';

    var todayBtn = document.createElement('button');
    todayBtn.type = 'button';
    todayBtn.className = 'calendar-mobile-nav-btn';
    todayBtn.setAttribute('data-cal-nav', 'today');
    todayBtn.textContent = '오늘';

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'calendar-mobile-nav-btn';
    nextBtn.setAttribute('data-cal-nav', 'next-day');
    nextBtn.textContent = '다음 날짜 ▶';

    nav.appendChild(prevBtn);
    nav.appendChild(todayBtn);
    nav.appendChild(nextBtn);

    var sidepanel = document.createElement('aside');
    sidepanel.className = 'calendar-sidepanel calendar-sidepanel--mobile';
    sidepanel.appendChild(buildDayDetail(calState, data));

    shell.appendChild(nav);
    shell.appendChild(sidepanel);

    root.appendChild(shell);
  }

  function render() {
    var root = document.getElementById('calendar-root');
    if (!root) return;

    var calState = ensureCalendarState();
    var current = parseISODate(calState.currentDate) || new Date();
    var monthBase = new Date(current.getFullYear(), current.getMonth(), 1);
    var data = buildCalendarData();

    if (isMobileLayout()) {
      renderMobile(root, calState, data);
      return;
    }

    clearRoot(root);

    var shell = document.createElement('div');
    shell.className = 'calendar-shell';

    var main = document.createElement('div');
    main.className = 'calendar-main';

    var side = document.createElement('aside');
    side.className = 'calendar-sidepanel';

    var header = buildHeader(calState, monthBase);
    var body = document.createElement('div');
    body.className = 'calendar-main-body';

    body.appendChild(buildMonthView(calState, monthBase, data));

    main.appendChild(header);
    main.appendChild(body);

    side.appendChild(buildDayDetail(calState, data));

    shell.appendChild(main);
    shell.appendChild(side);

    root.appendChild(shell);
  }

  function init() {
    ensureCalendarState();
    bindEvents();
    // Stage 2: Register the actual render implementation (observer-only). No behavior change.
    if (App.renderCoordinator && App.ViewKey && App.ViewKey.CALENDAR) {
      App.renderCoordinator.register(App.ViewKey.CALENDAR, render);
    }
    render();
  }

  App.features.calendar = {
    init: init,
    // Stage 6: keep the real render implementation accessible for internal use,
    // but prevent external direct render calls from touching DOM.
    renderImpl: render,
    render: (function () {
      var warned = false;
      function warnOnce() {
        if (warned) return;
        warned = true;
        try {
          console.warn('[DEPRECATED] direct calendar.render() called. Use commit/invalidate instead.');
        } catch (e) {}
      }
      var wrapper = function () {
        warnOnce();
        if (App.api && App.api.view && typeof App.api.view.invalidate === 'function' && App.ViewKey) {
          App.api.view.invalidate(App.ViewKey.CALENDAR);
          return;
        }
        // Fallback (no direct DOM render): best-effort invalidate only.
        if (App.renderCoordinator && typeof App.renderCoordinator.invalidate === 'function' && App.ViewKey) {
          App.renderCoordinator.invalidate(App.ViewKey.CALENDAR);
        }
      };
      // Marker for internal guards
      wrapper._deprecatedInvalidateWrapper = true;
      return wrapper;
    })()
  };
})(window, document);
