(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  App.features = App.features || {};

  App.features.monitoring = (function () {
    var ROOT_ID = 'monitoring-root';
    var today = null;
    var tomorrow = null;
    var schedulesByDebtorCache = null;

    function createEl(tag, className, text) {
      var el = document.createElement(tag);
      if (className) el.className = className;
      if (text != null) el.textContent = text;
      return el;
    }

    function recomputeDateAnchors() {
      if (App.date && typeof App.date.getToday === 'function') {
        today = App.date.getToday();
        if (typeof App.date.addDays === 'function') {
          tomorrow = App.date.addDays(today, 1);
        } else {
          var d = new Date();
          d.setDate(d.getDate() + 1);
          if (App.util && typeof App.util.formatDate === 'function') {
            tomorrow = App.util.formatDate(d);
          } else {
            tomorrow = d.toISOString().slice(0, 10);
          }
        }
      } else if (App.util && typeof App.util.formatDate === 'function') {
        today = App.util.formatDate(new Date());
        var d2 = new Date();
        d2.setDate(d2.getDate() + 1);
        tomorrow = App.util.formatDate(d2);
      } else {
        var now = new Date();
        today = now.toISOString().slice(0, 10);
        var t2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        tomorrow = t2.toISOString().slice(0, 10);
      }
    }

    function getSchedules() {
      if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
        try {
          var engineList = App.schedulesEngine.getAll() || [];
          if (Array.isArray(engineList)) {
            return engineList;
          }
        } catch (e) {
          return [];
        }
      }
      return [];
    }

    function getDebtors() {
      var data = App.data || {};
      var debtors = data.debtors || (App.state && App.state.debtors) || [];
      if (!Array.isArray(debtors)) return [];
      return debtors;
    }

    function getSchedulesByDebtor() {
      if (schedulesByDebtorCache) return schedulesByDebtorCache;

      var map = Object.create(null);
      var list = getSchedules();
      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc || sc.debtorId == null) continue;
        var id = String(sc.debtorId);
        if (!map[id]) map[id] = [];
        map[id].push(sc);
      }
      schedulesByDebtorCache = map;
      return map;
    }

    function getScheduleDueDate(sc) {
      if (!sc) return null;
      return sc.dueDate || sc.due_date || sc.date || null;
    }

    function getScheduleRemaining(sc) {
      if (!sc) return 0;
      var explicit = sc.remaining != null ? Number(sc.remaining) : NaN;
      if (!isNaN(explicit)) {
        return explicit;
      }
      var amount = Number(sc.amount) || 0;
      var paid = 0;
      if (sc.paidAmount != null) {
        paid = Number(sc.paidAmount) || 0;
      } else if (sc.partialPaidAmount != null) {
        paid = Number(sc.partialPaidAmount) || 0;
      }
      var remaining = amount - paid;
      if (!isFinite(remaining) || remaining < 0) remaining = 0;
      return remaining;
    }

    function summarizeSchedules(schedules) {
      schedules = schedules || [];
      var totalRemaining = 0;
      var maxOverdueDays = 0;
      var overdueCount = 0;
      for (var i = 0; i < schedules.length; i++) {
        var sc = schedules[i];
        if (!sc) continue;
        totalRemaining += getScheduleRemaining(sc);
        var due = getScheduleDueDate(sc);
        if (!due || !today) continue;
        if (due < today) {
          overdueCount++;
          if (App.date && typeof App.date.diffDays === 'function') {
            var od = App.date.diffDays(today, due);
            if (od > maxOverdueDays) {
              maxOverdueDays = od;
            }
          }
        }
      }
      return {
        totalRemaining: totalRemaining,
        maxOverdueDays: maxOverdueDays,
        overdueCount: overdueCount
      };
    }

    function dedupeSchedules(list) {
      var result = [];
      var seen = Object.create(null);
      list = list || [];
      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) continue;
        var id = sc.id != null ? String(sc.id) : String(i);
        if (seen[id]) continue;
        seen[id] = true;
        result.push(sc);
      }
      return result;
    }

    function filterDDay(sc) {
      if (!sc) return false;
      var status = (sc.status || '').toUpperCase();
      if (status === 'PAID') return false;
      var due = getScheduleDueDate(sc);
      if (!due || !today) return false;
      return due === today;
    }

    function filterD1(sc) {
      if (!sc) return false;
      var status = (sc.status || '').toUpperCase();
      if (status === 'PAID') return false;
      var due = getScheduleDueDate(sc);
      if (!due || !tomorrow) return false;
      return due === tomorrow;
    }

    function filterOverdue(sc) {
      if (!sc) return false;
      var status = (sc.status || '').toUpperCase();
      if (status === 'PAID') return false;
      var due = getScheduleDueDate(sc);
      if (!due || !today) return false;
      return due < today;
    }

    function groupByDebtor(schedules) {
      var map = Object.create(null);
      schedules = schedules || [];

      var debtors = getDebtors();
      var debtorById = Object.create(null);
      for (var i = 0; i < debtors.length; i++) {
        var d = debtors[i];
        if (!d || d.id == null) continue;
        debtorById[String(d.id)] = d;
      }

      for (var j = 0; j < schedules.length; j++) {
        var sc = schedules[j];
        if (!sc || sc.debtorId == null) continue;
        var debtorId = String(sc.debtorId);
        var debtor = debtorById[debtorId];
        if (!debtor) continue;

        if (!map[debtorId]) {
          map[debtorId] = {
            debtor: debtor,
            schedules: [],
            totalAmount: 0,
            maxOverdueDays: 0
          };
        }

        var group = map[debtorId];
        var amt = getScheduleRemaining(sc);
        group.schedules.push(sc);
        group.totalAmount += amt;

        var due = getScheduleDueDate(sc);
        if (due && today && due < today && App.date && typeof App.date.diffDays === 'function') {
          var od = App.date.diffDays(today, due);
          if (od > group.maxOverdueDays) {
            group.maxOverdueDays = od;
          }
        }
      }

      var out = [];
      for (var key in map) {
        if (Object.prototype.hasOwnProperty.call(map, key)) {
          out.push(map[key]);
        }
      }
      return out;
    }

    function detectConsecutiveMiss(debtorId) {
      if (!today) return null;
      var byDebtor = getSchedulesByDebtor();
      var list = byDebtor[String(debtorId)] || [];
      if (!list.length) return null;

      var missed = [];
      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) continue;
        var due = getScheduleDueDate(sc);
        if (!due || due >= today) continue;
        var status = (sc.status || '').toUpperCase();
        if (status === 'PAID') continue;
        missed.push(sc);
      }

      if (missed.length < 2) return null;

      missed.sort(function (a, b) {
        var da = getScheduleDueDate(a) || '';
        var db = getScheduleDueDate(b) || '';
        if (App.date && typeof App.date.compare === 'function') {
          return App.date.compare(da, db);
        }
        if (da < db) return -1;
        if (da > db) return 1;
        return 0;
      });

      return {
        count: missed.length,
        schedules: missed
      };
    }

    function detectPaymentStop(debtorId) {
      if (!today || !App.date || typeof App.date.addDays !== 'function') return null;
      var byDebtor = getSchedulesByDebtor();
      var list = byDebtor[String(debtorId)] || [];
      if (!list.length) return null;

      var from = App.date.addDays(today, -30);
      var hasActive = false;
      var hasPaidInWindow = false;
      var relevant = [];

      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) continue;
        var due = getScheduleDueDate(sc);
        if (!due) continue;
        var status = (sc.status || '').toUpperCase();

        if (due <= today && status !== 'PAID') {
          hasActive = true;
          if (due >= from) {
            relevant.push(sc);
          }
        }

        if (due >= from && due <= today && (status === 'PAID' || status === 'PARTIAL')) {
          hasPaidInWindow = true;
        }
      }

      if (!hasActive || hasPaidInWindow) return null;

      if (!relevant.length) {
        relevant = list.slice(0, 3);
      }

      return {
        from: from,
        to: today,
        schedules: relevant
      };
    }

    function detectPartialPattern(debtorId) {
      var byDebtor = getSchedulesByDebtor();
      var list = byDebtor[String(debtorId)] || [];
      if (!list.length) return null;

      var partials = [];
      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) continue;
        var status = (sc.status || '').toUpperCase();
        if (status === 'PARTIAL') {
          partials.push(sc);
        }
      }

      if (partials.length < 3) return null;

      partials.sort(function (a, b) {
        var da = getScheduleDueDate(a) || '';
        var db = getScheduleDueDate(b) || '';
        if (App.date && typeof App.date.compare === 'function') {
          return App.date.compare(da, db);
        }
        if (da < db) return -1;
        if (da > db) return 1;
        return 0;
      });

      return {
        count: partials.length,
        schedules: partials
      };
    }

    function buildRiskAlerts() {
      var alerts = [];
      var debtors = getDebtors();
      if (!debtors.length) return alerts;

      for (var i = 0; i < debtors.length; i++) {
        var debtor = debtors[i];
        if (!debtor || debtor.id == null) continue;
        var debtorId = debtor.id;

        var reasons = [];
        var schedules = [];

        var cMiss = detectConsecutiveMiss(debtorId);
        if (cMiss) {
          reasons.push('연속 미납 ' + cMiss.count + '회');
          schedules = schedules.concat(cMiss.schedules);
        }

        var pStop = detectPaymentStop(debtorId);
        if (pStop) {
          reasons.push('최근 30일 상환 중단');
          schedules = schedules.concat(pStop.schedules);
        }

        var pPattern = detectPartialPattern(debtorId);
        if (pPattern) {
          reasons.push('부분납 ' + pPattern.count + '회');
          schedules = schedules.concat(pPattern.schedules);
        }

        if (!reasons.length) continue;

        schedules = dedupeSchedules(schedules);
        var summary = summarizeSchedules(schedules);

        alerts.push({
          debtor: debtor,
          reason: reasons.join(' · '),
          schedules: schedules,
          totalAmount: summary.totalRemaining,
          maxOverdueDays: summary.maxOverdueDays
        });
      }

      return alerts;
    }

    function buildEnforcementAlerts() {
      var alerts = [];
      var debtors = getDebtors();
      if (!debtors.length) return alerts;

      var litigationCases = App.litigation && App.litigation.activeCases ? App.litigation.activeCases : null;
      var byDebtor = getSchedulesByDebtor();

      for (var i = 0; i < debtors.length; i++) {
        var debtor = debtors[i];
        if (!debtor || debtor.id == null) continue;
        var id = String(debtor.id);
        var list = byDebtor[id] || [];
        if (!list.length) continue;

        var openSchedules = [];
        for (var j = 0; j < list.length; j++) {
          var sc = list[j];
          if (!sc) continue;
          var status = (sc.status || '').toUpperCase();
          if (status === 'PAID') continue;
          openSchedules.push(sc);
        }

        if (!openSchedules.length) continue;

        var summary = summarizeSchedules(openSchedules);
        var totalRemaining = summary.totalRemaining;
        var overdueDays = summary.maxOverdueDays;

        var cMiss = detectConsecutiveMiss(id);
        var consecutiveCount = cMiss ? cMiss.count : 0;

        var contactFail = 0;
        if (debtor.contactFailCount != null) contactFail = Number(debtor.contactFailCount) || 0;
        else if (debtor.contactFail != null) contactFail = Number(debtor.contactFail) || 0;
        else if (debtor.contact_fail_count != null) contactFail = Number(debtor.contact_fail_count) || 0;

        var thresholdAmount = 300000;

        if (totalRemaining >= thresholdAmount && (overdueDays >= 30 || consecutiveCount >= 2)) {
          alerts.push({
            debtor: debtor,
            tag: '압류 권고',
            schedules: openSchedules.slice(),
            overdueDays: overdueDays,
            totalAmount: totalRemaining
          });
        }

        if (contactFail >= 3 && overdueDays >= 20) {
          alerts.push({
            debtor: debtor,
            tag: '소송 권고',
            schedules: openSchedules.slice(),
            overdueDays: overdueDays,
            totalAmount: totalRemaining,
            contactFail: contactFail
          });
        }

        if (litigationCases && (litigationCases[id] || litigationCases[debtor.id])) {
          var caseData = litigationCases[id] || litigationCases[debtor.id];
          alerts.push({
            debtor: debtor,
            tag: '전자소송 진행중',
            schedules: openSchedules.slice(0, 3),
            overdueDays: overdueDays,
            totalAmount: totalRemaining,
            litigation: caseData
          });
        }
      }

      return alerts;
    }

    function buildDebtorOverview(debtorId) {
      var debtors = getDebtors();
      var debtor = null;
      var id = String(debtorId);
      for (var i = 0; i < debtors.length; i++) {
        var d = debtors[i];
        if (!d || d.id == null) continue;
        if (String(d.id) === id) {
          debtor = d;
          break;
        }
      }
      if (!debtor) return null;

      var byDebtor = getSchedulesByDebtor();
      var list = byDebtor[id] || [];
      var openSchedules = [];
      for (var j = 0; j < list.length; j++) {
        var sc = list[j];
        if (!sc) continue;
        var status = (sc.status || '').toUpperCase();
        if (status === 'PAID') continue;
        openSchedules.push(sc);
      }

      var summary = summarizeSchedules(openSchedules);

      return {
        debtor: debtor,
        schedules: openSchedules,
        totalAmount: summary.totalRemaining,
        maxOverdueDays: summary.maxOverdueDays
      };
    }

    function buildWatchlist() {
      var data = App.data || {};
      var list = data.watchlist || [];
      if (!list || !list.length) return [];

      var groups = [];
      for (var i = 0; i < list.length; i++) {
        var id = list[i];
        var group = buildDebtorOverview(id);
        if (group) {
          groups.push(group);
        }
      }
      return groups;
    }

    function createHeader(group, mode) {
      // Card header (collapsed view) must be single-row:
      // [Name] [Status summary text] [Amount]
      // NOTE: Right-side count UI is intentionally removed to avoid duplication.
      var header = createEl('div', 'monitoring-debtor-header');

      var nameText = (group.debtor && group.debtor.name) ? group.debtor.name : ('채무자 #' + (group.debtor && group.debtor.id != null ? group.debtor.id : ''));
      var nameEl = createEl('div', 'monitoring-debtor-name', nameText);

      var count = group.schedules && group.schedules.length ? group.schedules.length : 0;
      var overdueDays = group.overdueDays || group.maxOverdueDays || 0;

      // Single status summary text (contains the only visible "n건" count if needed)
      var summaryText = '';

      if (mode === 'dday') {
        summaryText = '오늘만기 ' + count + '건';
      } else if (mode === 'd1') {
        summaryText = '내일만기 ' + count + '건';
      } else if (mode === 'overdue') {
        if (overdueDays) {
          summaryText = '미납 ' + count + '건 · 최대 ' + overdueDays + '일 경과';
        } else {
          summaryText = '미납 ' + count + '건';
        }
      } else if (mode === 'risk') {
        if (overdueDays) {
          summaryText = '미납 ' + count + '건 · 최대 ' + overdueDays + '일 경과';
        } else {
          summaryText = '미납 ' + count + '건';
        }
        if (group.reason) {
          summaryText += ' · ' + group.reason;
        }
      } else if (mode === 'enforce') {
        if (overdueDays) {
          summaryText = '미납 ' + count + '건 · 최대 ' + overdueDays + '일 경과';
        } else {
          summaryText = '미납 ' + count + '건';
        }
        if (group.tag) {
          summaryText += ' · ' + group.tag;
        }
      } else if (mode === 'watch') {
        if (count > 0) {
          if (overdueDays) {
            summaryText = '미납 ' + count + '건 · 최대 ' + overdueDays + '일 경과';
          } else {
            summaryText = '미납 ' + count + '건';
          }
        } else {
          summaryText = '관심 채무자';
        }
      } else {
        summaryText = group.reason || group.tag || '';
      }

      if (!summaryText) summaryText = '-';

      var subtitleEl = createEl('div', 'monitoring-debtor-subtitle', summaryText);

      // Info block wrapper: centered within the card, left-aligned text.
      var infoWrap = createEl('div', 'monitoring-debtor-info');
      var infoInner = createEl('div', 'monitoring-debtor-info-inner');
      infoInner.appendChild(subtitleEl);
      infoWrap.appendChild(infoInner);

      header.appendChild(nameEl);
      header.appendChild(infoWrap);

      var meta = createEl('div', 'monitoring-debtor-meta');

      var amountValue = 0;
      if (typeof group.totalAmount === 'number') {
        amountValue = group.totalAmount;
      } else if (group.schedules && group.schedules.length) {
        var summary = summarizeSchedules(group.schedules);
        amountValue = summary.totalRemaining;
      }

      var amountText = '';
      if (amountValue && App.util && typeof App.util.formatCurrency === 'function') {
        amountText = App.util.formatCurrency(amountValue);
      } else if (amountValue) {
        amountText = String(amountValue);
      } else {
        amountText = '-';
      }

      var amountEl = createEl('div', 'monitoring-debtor-amount', amountText);
      meta.appendChild(amountEl);

      header.appendChild(meta);
      return header;
    }

    function createScheduleItem(sc) {
      var item = createEl('div', 'monitoring-schedule-item');
      var left = createEl('div', 'monitoring-schedule-main');
      var right = createEl('div', 'monitoring-schedule-meta');

      var parts = [];
      if (sc.installmentNo != null) {
        parts.push('회차 ' + sc.installmentNo);
      }
      if (sc.kind === 'loan') {
        parts.push('대출');
      } else if (sc.kind === 'claim') {
        parts.push('채권');
      }

      var titleText = parts.length ? parts.join(' · ') : '상환 일정';
      var titleEl = createEl('div', 'monitoring-schedule-title', titleText);

      var dueRaw = getScheduleDueDate(sc);
      var dueText = '';
      if (dueRaw) {
        if (App.util && typeof App.util.formatDate === 'function') {
          dueText = App.util.formatDate(dueRaw);
        } else {
          dueText = String(dueRaw);
        }
      }
      var dateEl = createEl('div', 'monitoring-schedule-date', dueText);

      left.appendChild(titleEl);
      left.appendChild(dateEl);

      var amount = getScheduleRemaining(sc);
      var amountText = '';
      if (App.util && typeof App.util.formatCurrency === 'function') {
        amountText = App.util.formatCurrency(amount);
      } else {
        amountText = String(amount || 0);
      }
      var amountEl = createEl('div', 'monitoring-schedule-amount', amountText);

      var badge = createEl('span', 'schedule-badge');
      var status = (sc.status || '').toUpperCase();
      var badgeClass = '';

      if (status === 'PLANNED') {
        badgeClass = 'status-planned';
        badge.textContent = '예정';
      } else if (status === 'PARTIAL') {
        badgeClass = 'status-partial';
        badge.textContent = '부분납';
      } else if (status === 'OVERDUE') {
        badgeClass = 'status-overdue';
        badge.textContent = '미납';
      } else if (status === 'PAID') {
        badgeClass = 'status-paid';
        badge.textContent = '완납';
      } else {
        badgeClass = 'status-planned';
        badge.textContent = status || '기타';
      }

      badge.className = 'schedule-badge ' + badgeClass;

      right.appendChild(amountEl);
      right.appendChild(badge);

      item.appendChild(left);
      item.appendChild(right);

      // v021: schedule item click opens schedule detail modal without collapsing the debtor card
      item.addEventListener('click', function (event) {
        if (event && typeof event.stopPropagation === 'function') {
          event.stopPropagation();
        }

        var scheduleId = sc && sc.id != null ? String(sc.id) : null;
        if (!scheduleId) return;

        if (sc.kind === 'loan') {
          var loanId = sc.loanId != null ? String(sc.loanId) : null;
          if (loanId && App.features && App.features.debtors && typeof App.features.debtors.openLoanScheduleModal === 'function') {
            App.features.debtors.openLoanScheduleModal(loanId, scheduleId);
          }
          return;
        }

        if (sc.kind === 'claim') {
          var claimId = sc.claimId != null ? String(sc.claimId) : null;
          if (claimId && App.features && App.features.debtors && typeof App.features.debtors.openClaimScheduleModal === 'function') {
            App.features.debtors.openClaimScheduleModal(claimId, scheduleId);
          }
        }
      });

      return item;
    }

    function createScheduleList(group) {
      var listEl = createEl('div', 'monitoring-schedule-list');
      var schedules = group.schedules || [];

      if (!schedules.length) {
        var empty = createEl('div', 'monitoring-schedule-empty', '상세 일정이 없습니다.');
        listEl.appendChild(empty);
        return listEl;
      }

      var sorted = schedules.slice();
      sorted.sort(function (a, b) {
        var da = getScheduleDueDate(a) || '';
        var db = getScheduleDueDate(b) || '';
        if (App.date && typeof App.date.compare === 'function') {
          return App.date.compare(da, db);
        }
        if (da < db) return -1;
        if (da > db) return 1;
        return 0;
      });

      for (var i = 0; i < sorted.length; i++) {
        var item = createScheduleItem(sorted[i]);
        listEl.appendChild(item);
      }

      return listEl;
    }

    function createDebtorCard(group, mode) {
      var wrapper = createEl('div', 'monitoring-debtor');
      var header = createHeader(group, mode);
      var list = createScheduleList(group);

      wrapper.appendChild(header);
      wrapper.appendChild(list);

      wrapper.addEventListener('click', function () {
        var isActive = wrapper.classList.contains('active');
        if (isActive) {
          wrapper.classList.remove('active');
          list.style.display = 'none';
        } else {
          wrapper.classList.add('active');
          list.style.display = 'block';
        }
      });

      return wrapper;
    }

    function ensureBaseLayout() {
      var root = document.getElementById(ROOT_ID);
      if (!root) return null;

      var existing = root.querySelector('.monitoring-container');
      if (existing) {
        // v016: remove Enforcement Alerts + Watchlist sections if they exist.
        // This is a defensive cleanup to guarantee the sections are not present in DOM.
        var enforceOld = existing.querySelector('.monitoring-section[data-section="enforce"]');
        if (enforceOld && enforceOld.parentNode) {
          enforceOld.parentNode.removeChild(enforceOld);
        }
        var watchOld = existing.querySelector('.monitoring-section[data-section="watch"]');
        if (watchOld && watchOld.parentNode) {
          watchOld.parentNode.removeChild(watchOld);
        }
        return existing;
      }

      while (root.firstChild) {
        root.removeChild(root.firstChild);
      }

      var container = createEl('div', 'monitoring-container');

      var sections = [
        { key: 'dday', title: 'Today (D-Day)' },
        { key: 'd1', title: 'Tomorrow (D-1)' },
        { key: 'overdue', title: 'Overdue' },
        { key: 'risk', title: 'Risk Alerts' }
      ];

      for (var i = 0; i < sections.length; i++) {
        var meta = sections[i];
        var section = createEl('section', 'monitoring-section');
        section.setAttribute('data-section', meta.key);

        var titleEl = createEl('h2', 'monitoring-title', meta.title);
        section.appendChild(titleEl);

        var listEl = createEl('div', 'monitoring-list');
        listEl.setAttribute('data-list', meta.key);
        section.appendChild(listEl);

        container.appendChild(section);
      }

      root.appendChild(container);
      return container;
    }

    function renderSection(sectionKey, groups, mode) {
      var root = document.getElementById(ROOT_ID);
      if (!root) return;
      var listEl = root.querySelector('.monitoring-list[data-list="' + sectionKey + '"]');
      if (!listEl) return;

      while (listEl.firstChild) {
        listEl.removeChild(listEl.firstChild);
      }

      if (!groups || !groups.length) {
        var empty = createEl('div', 'monitoring-empty', '표시할 항목이 없습니다.');
        listEl.appendChild(empty);
        return;
      }

      for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        if (!group || !group.debtor) continue;
        var card = createDebtorCard(group, mode);
        listEl.appendChild(card);
      }
    }

    function render() {
      var root = document.getElementById(ROOT_ID);
      if (!root) return;

      recomputeDateAnchors();
      schedulesByDebtorCache = null;

      var container = ensureBaseLayout();
      if (!container) return;

      var schedules = getSchedules();

      var ddayGroups = groupByDebtor(schedules.filter(filterDDay));
      var d1Groups = groupByDebtor(schedules.filter(filterD1));
      var overdueGroups = groupByDebtor(schedules.filter(filterOverdue));

      var riskAlerts = buildRiskAlerts();

      renderSection('dday', ddayGroups, 'dday');
      renderSection('d1', d1Groups, 'd1');
      renderSection('overdue', overdueGroups, 'overdue');
      renderSection('risk', riskAlerts, 'risk');
    }

    function init() {
      // Stage 2: Register the actual monitoring render implementation (observer-only). No behavior change.
      if (App.renderCoordinator && App.ViewKey && App.ViewKey.MONITORING) {
        App.renderCoordinator.register(App.ViewKey.MONITORING, render);
      }
      render();
    }

    return {
      init: init,
      // Stage 6: expose the real render implementation for internal callers,
      // but force external render() entry to go through invalidate.
      renderImpl: render,
      render: (function () {
        var warned = false;
        function warnOnce() {
          if (warned) return;
          warned = true;
          try {
            console.warn('[DEPRECATED] direct monitoring.render() called. Use commit/invalidate instead.');
          } catch (e) {}
        }
        var wrapper = function () {
          warnOnce();
          if (App.api && App.api.view && typeof App.api.view.invalidate === 'function' && App.ViewKey) {
            App.api.view.invalidate(App.ViewKey.MONITORING);
            return;
          }
          // Fallback (no direct DOM render): best-effort invalidate only.
          if (App.renderCoordinator && typeof App.renderCoordinator.invalidate === 'function' && App.ViewKey) {
            App.renderCoordinator.invalidate(App.ViewKey.MONITORING);
          }
        };
        wrapper._deprecatedInvalidateWrapper = true;
        return wrapper;
      })(),
      _internal: {
        recomputeDateAnchors: recomputeDateAnchors,
        filterDDay: filterDDay,
        filterD1: filterD1,
        filterOverdue: filterOverdue,
        groupByDebtor: groupByDebtor,
        detectConsecutiveMiss: detectConsecutiveMiss,
        detectPaymentStop: detectPaymentStop,
        detectPartialPattern: detectPartialPattern,
        buildRiskAlerts: buildRiskAlerts,
        buildEnforcementAlerts: buildEnforcementAlerts,
        buildWatchlist: buildWatchlist
      }
    };
  })();
})(window, document);
