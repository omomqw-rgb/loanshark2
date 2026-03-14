(function (window) {
  'use strict';

  var App = window.App || (window.App = {});

  function toStr(value) {
    if (value === undefined || value === null) return null;
    return String(value);
  }

  function shallowClone(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    var copy = {};
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        copy[key] = obj[key];
      }
    }
    return copy;
  }

  function sortSchedulesForMatching(list) {
    return (list || []).slice().sort(function (a, b) {
      var ai = Number(a && a.installmentNo != null ? a.installmentNo : 0) || 0;
      var bi = Number(b && b.installmentNo != null ? b.installmentNo : 0) || 0;
      if (ai !== bi) return ai - bi;
      var ad = (a && (a.dueDate || a.due_date || '')) || '';
      var bd = (b && (b.dueDate || b.due_date || '')) || '';
      if (ad === bd) return 0;
      return ad < bd ? -1 : 1;
    });
  }

  function toNonNegativeNumber(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  function getScheduleDueDate(sc) {
    return (sc && (sc.dueDate || sc.due_date || sc.date || '')) || '';
  }

  function getScheduleInstallmentNo(sc) {
    if (!sc || sc.installmentNo == null) return null;
    var n = Number(sc.installmentNo);
    if (!isFinite(n)) return null;
    return n;
  }

  function parseISODateToUtcDay(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!m) return null;
    var y = Number(m[1]);
    var mo = Number(m[2]) - 1;
    var d = Number(m[3]);
    return Math.floor(Date.UTC(y, mo, d) / 86400000);
  }

  function diffIsoDays(a, b) {
    var ad = parseISODateToUtcDay(a);
    var bd = parseISODateToUtcDay(b);
    if (ad === null || bd === null) return null;
    return bd - ad;
  }

  function nearlyEqualAmounts(a, b, ratio) {
    var av = toNonNegativeNumber(a);
    var bv = toNonNegativeNumber(b);
    if (!av && !bv) return true;
    var max = Math.max(av, bv, 1);
    return Math.abs(av - bv) <= max * ratio;
  }

  function cloneTrace(obj) {
    return JSON.parse(JSON.stringify(obj || {}));
  }

  var engine = {
    list: [],
    _initialized: false,
    _lastMergeTrace: null,

    _ensureInitialized: function () {
      if (this._initialized && Array.isArray(this.list)) return;

      if (!Array.isArray(this.list)) {
        this.list = [];
      }

      this._initialized = true;
      this._syncAlias();
    },

    _syncAlias: function () {
      var state = App.state || (App.state = {});
      var data = App.data || (App.data = {});
      state.schedules = this.list || [];
      data.schedules = this.list || [];
    },

    _debugLog: function (level, message, payload) {
      if (typeof console === 'undefined') return;
      var fn = console[level] || console.log;
      if (typeof fn !== 'function') return;
      try {
        if (typeof payload === 'undefined') {
          fn.call(console, message);
        } else {
          fn.call(console, message, payload);
        }
      } catch (e) {
        try {
          console.log(message);
        } catch (ignore) {}
      }
    },

    _captureScheduleTotals: function (list) {
      var result = {
        paidTotal: 0,
        partialTotal: 0,
        overdueTotal: 0,
        plannedTotal: 0,
        scheduleCount: 0,
        statusCounts: {
          PAID: 0,
          PARTIAL: 0,
          OVERDUE: 0,
          PLANNED: 0,
          OTHER: 0
        }
      };
      var items = Array.isArray(list) ? list : [];
      for (var i = 0; i < items.length; i++) {
        var sc = items[i];
        if (!sc) continue;
        result.scheduleCount += 1;
        var status = String(sc.status || 'PLANNED').toUpperCase();
        var amount = toNonNegativeNumber(sc.amount);
        var paidAmount = toNonNegativeNumber(sc.paidAmount != null ? sc.paidAmount : sc.partialPaidAmount);
        var remaining = Math.max(0, amount - paidAmount);
        if (status === 'PAID') {
          result.paidTotal += amount;
          result.statusCounts.PAID += 1;
        } else if (status === 'PARTIAL') {
          result.paidTotal += paidAmount;
          result.partialTotal += remaining;
          result.statusCounts.PARTIAL += 1;
        } else if (status === 'OVERDUE') {
          result.overdueTotal += amount;
          result.statusCounts.OVERDUE += 1;
        } else if (status === 'PLANNED') {
          result.plannedTotal += amount;
          result.statusCounts.PLANNED += 1;
        } else {
          result.statusCounts.OTHER += 1;
        }
      }
      return result;
    },

    _diffScheduleTotals: function (beforeTotals, afterTotals) {
      var keys = ['paidTotal', 'partialTotal', 'overdueTotal', 'plannedTotal', 'scheduleCount'];
      var diff = {};
      var hasDelta = false;
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var beforeValue = Number(beforeTotals && beforeTotals[key] != null ? beforeTotals[key] : 0) || 0;
        var afterValue = Number(afterTotals && afterTotals[key] != null ? afterTotals[key] : 0) || 0;
        var delta = afterValue - beforeValue;
        diff[key] = {
          before: beforeValue,
          after: afterValue,
          delta: delta
        };
        if (Math.abs(delta) > 0.000001) hasDelta = true;
      }
      diff.hasDelta = hasDelta;
      return diff;
    },

    _hasInstallmentContinuityBreak: function (list) {
      var prevInst = null;
      var hasGap = false;
      var hasDuplicate = false;
      var items = Array.isArray(list) ? list : [];
      for (var i = 0; i < items.length; i++) {
        var inst = getScheduleInstallmentNo(items[i]);
        if (inst === null) continue;
        if (prevInst !== null) {
          if (inst === prevInst) hasDuplicate = true;
          if (inst !== prevInst + 1) hasGap = true;
        }
        prevInst = inst;
      }
      return {
        hasGap: hasGap,
        hasDuplicate: hasDuplicate,
        broken: hasGap || hasDuplicate
      };
    },

    _computeAlignedShiftInfo: function (prevList, nextList) {
      var minLen = Math.min(prevList.length, nextList.length);
      var info = {
        comparable: 0,
        changed: 0,
        dominantShiftDays: null,
        dominantShiftCount: 0,
        wholeListShift: false
      };
      if (!minLen) return info;

      var shiftCountMap = Object.create(null);
      for (var i = 0; i < minLen; i++) {
        var prevDue = getScheduleDueDate(prevList[i]);
        var nextDue = getScheduleDueDate(nextList[i]);
        var dayDiff = diffIsoDays(prevDue, nextDue);
        if (dayDiff === null) continue;
        info.comparable += 1;
        if (dayDiff !== 0) {
          info.changed += 1;
          var key = String(dayDiff);
          shiftCountMap[key] = (shiftCountMap[key] || 0) + 1;
          if (shiftCountMap[key] > info.dominantShiftCount) {
            info.dominantShiftCount = shiftCountMap[key];
            info.dominantShiftDays = dayDiff;
          }
        }
      }

      if (info.comparable > 0 && info.changed > 0 && info.dominantShiftCount >= Math.ceil(info.comparable * 0.6)) {
        info.wholeListShift = true;
      }

      return info;
    },

    _computeSequenceDriftInfo: function (prevList, nextList) {
      var minLen = Math.min(prevList.length, nextList.length);
      var firstMismatch = -1;
      var mismatchCount = 0;
      for (var i = 0; i < minLen; i++) {
        var prevInst = getScheduleInstallmentNo(prevList[i]);
        var nextInst = getScheduleInstallmentNo(nextList[i]);
        var prevDue = getScheduleDueDate(prevList[i]);
        var nextDue = getScheduleDueDate(nextList[i]);
        var sameInst = (prevInst === null && nextInst === null) || (prevInst !== null && nextInst !== null && prevInst === nextInst);
        var sameDue = prevDue === nextDue;
        if (!sameInst || !sameDue) {
          if (firstMismatch < 0) firstMismatch = i;
          mismatchCount += 1;
        }
      }
      return {
        firstMismatch: firstMismatch,
        mismatchCount: mismatchCount,
        suffixShiftLikely: firstMismatch >= 0 && mismatchCount >= Math.ceil(Math.max(1, minLen) * 0.5)
      };
    },

    _computeAmountPatternChange: function (prevList, nextList) {
      var minLen = Math.min(prevList.length, nextList.length);
      if (!minLen) {
        return {
          comparable: 0,
          changed: 0,
          significant: false
        };
      }
      var changed = 0;
      for (var i = 0; i < minLen; i++) {
        var prevAmount = toNonNegativeNumber(prevList[i] && prevList[i].amount);
        var nextAmount = toNonNegativeNumber(nextList[i] && nextList[i].amount);
        if (!nearlyEqualAmounts(prevAmount, nextAmount, 0.25)) {
          changed += 1;
        }
      }
      return {
        comparable: minLen,
        changed: changed,
        significant: changed >= Math.ceil(minLen * 0.6)
      };
    },

    _detectStructureChange: function (kind, prevList, nextList) {
      var report = {
        kind: kind,
        changed: false,
        reasons: [],
        countDelta: Math.abs((prevList || []).length - (nextList || []).length),
        previousCount: (prevList || []).length,
        nextCount: (nextList || []).length,
        installmentBreak: {
          previous: this._hasInstallmentContinuityBreak(prevList),
          next: this._hasInstallmentContinuityBreak(nextList)
        },
        shiftInfo: this._computeAlignedShiftInfo(prevList || [], nextList || []),
        sequenceDrift: this._computeSequenceDriftInfo(prevList || [], nextList || []),
        amountPattern: this._computeAmountPatternChange(prevList || [], nextList || [])
      };

      if (report.countDelta > 0) {
        report.reasons.push('count-changed');
      }
      if (report.installmentBreak.previous.broken || report.installmentBreak.next.broken) {
        report.reasons.push('installment-continuity-break');
      }
      if (report.shiftInfo.wholeListShift) {
        report.reasons.push('dueDate-whole-list-shift');
      }
      if (report.sequenceDrift.suffixShiftLikely) {
        report.reasons.push('sequence-drift');
      }
      if (report.amountPattern.significant) {
        report.reasons.push('amount-pattern-changed');
      }
      if (kind === 'claim' && report.countDelta > 0) {
        report.reasons.push('claim-structure-count-change');
      }

      report.changed = report.reasons.length > 0;
      return report;
    },

    _evaluateScheduleMatch: function (kind, prevMatched, next, matchType, prevIndex, nextIndex, structureReport) {
      var score = 0;
      var reasons = [];
      var prevInst = getScheduleInstallmentNo(prevMatched);
      var nextInst = getScheduleInstallmentNo(next);
      var prevDue = getScheduleDueDate(prevMatched);
      var nextDue = getScheduleDueDate(next);
      var amountMatchStrong = nearlyEqualAmounts(prevMatched && prevMatched.amount, next && next.amount, 0.05);
      var amountMatchLoose = nearlyEqualAmounts(prevMatched && prevMatched.amount, next && next.amount, 0.2);
      var dueDiffDays = diffIsoDays(prevDue, nextDue);

      if (matchType === 'installment') {
        score += 5;
        reasons.push('same-installment');
      } else if (matchType === 'dueDate') {
        score += 3;
        reasons.push('same-dueDate');
      } else if (matchType === 'order') {
        score += 1;
        reasons.push('order-fallback');
      }

      if (prevInst !== null && nextInst !== null && prevInst === nextInst) {
        score += 2;
        reasons.push('installment-confirmed');
      } else if (prevInst !== null && nextInst !== null && Math.abs(prevInst - nextInst) <= 1) {
        score += 1;
        reasons.push('installment-nearby');
      }

      if (prevDue && nextDue && prevDue === nextDue) {
        score += 2;
        reasons.push('dueDate-confirmed');
      } else if (dueDiffDays !== null && Math.abs(dueDiffDays) <= 3) {
        score += 1;
        reasons.push('dueDate-nearby');
      }

      if (amountMatchStrong) {
        score += 2;
        reasons.push('amount-close');
      } else if (amountMatchLoose) {
        score += 1;
        reasons.push('amount-similar');
      }

      if (prevIndex === nextIndex) {
        score += 1;
        reasons.push('same-index');
      }

      if (structureReport && structureReport.changed) {
        score -= 2;
        reasons.push('structure-change-penalty');
      }

      if (matchType === 'order') {
        score -= 2;
      }

      if (kind === 'claim') {
        if (matchType === 'dueDate') {
          score -= 1;
          reasons.push('claim-dueDate-penalty');
        }
        if (!amountMatchLoose) {
          score -= 2;
          reasons.push('claim-amount-mismatch');
        }
      }

      var tier = 'LOW';
      if (kind === 'claim') {
        if (score >= 8) tier = 'HIGH';
        else if (score >= 5) tier = 'MEDIUM';
      } else {
        if (score >= 7) tier = 'HIGH';
        else if (score >= 4) tier = 'MEDIUM';
      }

      if (structureReport && structureReport.changed && matchType === 'order') {
        tier = 'LOW';
      }

      return {
        score: score,
        tier: tier,
        reasons: reasons,
        matchType: matchType,
        dueDiffDays: dueDiffDays,
        amountClose: amountMatchStrong,
        amountSimilar: amountMatchLoose
      };
    },

    _canUseOrderFallback: function (kind, structureReport, trace) {
      var allowed = true;
      var reasons = [];
      if (structureReport && structureReport.changed) {
        allowed = false;
        reasons.push('structure-change');
      }
      if (kind === 'claim') {
        allowed = false;
        reasons.push('claim-order-fallback-disabled');
      }
      if (trace && trace.beforeTotals && trace.beforeTotals.statusCounts) {
        var partialCount = Number(trace.beforeTotals.statusCounts.PARTIAL || 0);
        var overdueCount = Number(trace.beforeTotals.statusCounts.OVERDUE || 0);
        if (partialCount > 0 || overdueCount > 1) {
          allowed = false;
          reasons.push('risky-runtime-status-present');
        }
      }
      return {
        allowed: allowed,
        reasons: reasons
      };
    },

    _applyPreservedScheduleState: function (kind, next, prevMatched, confidence, trace) {
      var prevStatus = String(prevMatched.status || '').toUpperCase();
      var nextAmount = toNonNegativeNumber(next.amount);
      var prevPaid = toNonNegativeNumber(prevMatched.paidAmount != null ? prevMatched.paidAmount : prevMatched.partialPaidAmount);
      var prevPartial = toNonNegativeNumber(prevMatched.partialPaidAmount);
      var tier = confidence && confidence.tier ? confidence.tier : 'LOW';

      if (tier === 'LOW') {
        trace.skippedPreserve += 1;
        return;
      }

      if (tier === 'HIGH' && prevMatched.id != null) {
        next.id = toStr(prevMatched.id);
      }

      if (prevMatched.memo != null && typeof next.memo === 'undefined' && tier !== 'LOW') {
        next.memo = prevMatched.memo;
      }

      if (kind === 'claim' && !nextAmount) {
        nextAmount = toNonNegativeNumber(prevMatched.amount);
        next.amount = nextAmount;
      }

      if (prevStatus === 'PAID') {
        next.status = 'PAID';
        next.paidAmount = nextAmount;
        next.partialPaidAmount = 0;
        return;
      }

      if (prevStatus === 'PARTIAL') {
        if (tier !== 'HIGH') {
          trace.partialPreserveBlocked += 1;
          trace.skippedPreserve += 1;
          this._debugLog('log', '[SchedulesEngine] partial preserve skipped due to low confidence', {
            kind: kind,
            confidence: confidence,
            previousId: prevMatched.id != null ? String(prevMatched.id) : null,
            nextInstallmentNo: next.installmentNo != null ? Number(next.installmentNo) : null,
            nextDueDate: getScheduleDueDate(next)
          });
          return;
        }
        var clampedPaid = prevPaid;
        if (nextAmount > 0 && clampedPaid > nextAmount) clampedPaid = nextAmount;
        next.status = 'PARTIAL';
        next.partialPaidAmount = clampedPaid || prevPartial;
        next.paidAmount = clampedPaid;
        trace.partialPreserveSuccess += 1;
        return;
      }

      next.paidAmount = 0;
      next.partialPaidAmount = 0;

      if (prevStatus === 'OVERDUE') {
        if (tier === 'HIGH') {
          next.status = 'OVERDUE';
        }
        return;
      }

      if (prevStatus === 'PLANNED') {
        next.status = 'PLANNED';
      }
    },

    _finalizeMergeTrace: function (trace) {
      trace.afterTotals = this._captureScheduleTotals(trace.outputSchedules || []);
      trace.totalsDiff = this._diffScheduleTotals(trace.beforeTotals, trace.afterTotals);
      this._lastMergeTrace = cloneTrace(trace);

      this._debugLog('log', '[SchedulesEngine] merge trace', {
        kind: trace.kind,
        ownerId: trace.ownerId,
        directMatches: trace.directMatches,
        dueDateMatches: trace.dueDateMatches,
        orderFallback: trace.orderFallback,
        skippedPreserve: trace.skippedPreserve,
        partialPreserveSuccess: trace.partialPreserveSuccess,
        partialPreserveBlocked: trace.partialPreserveBlocked,
        confidenceDistribution: trace.confidenceDistribution,
        structureChange: trace.structureChange
      });

      if (trace.structureChange && trace.structureChange.changed) {
        this._debugLog('warn', '[SchedulesEngine] structure change detected; conservative preserve mode enabled', trace.structureChange);
      }

      if (trace.totalsDiff && trace.totalsDiff.hasDelta) {
        this._debugLog('warn', '[SchedulesEngine] merge totals changed after rebuild', {
          kind: trace.kind,
          ownerId: trace.ownerId,
          diff: trace.totalsDiff,
          structureChange: trace.structureChange && trace.structureChange.reasons ? trace.structureChange.reasons : []
        });
      }
    },

    initEmpty: function () {
      this.list = [];
      this._initialized = true;
      this._syncAlias();
    },

    fromSnapshot: function (snapshot) {
      var list = [];
      if (Array.isArray(snapshot)) {
        for (var i = 0; i < snapshot.length; i++) {
          var sc = snapshot[i];
          if (!sc) continue;
          list.push(shallowClone(sc));
        }
      }
      this.list = list;
      this._initialized = true;
      this._syncAlias();
    },

    toSnapshot: function () {
      this._ensureInitialized();
      var result = [];
      var list = this.list || [];
      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) continue;
        result.push(shallowClone(sc));
      }
      return result;
    },

    _normalizeScheduleStatus: function (sc, todayStr) {
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
    },

    _mergeRuntimeScheduleState: function (kind, owner, previousSchedules, nextSchedules) {
      var out = [];
      var prevList = sortSchedulesForMatching(previousSchedules);
      var nextList = sortSchedulesForMatching(nextSchedules);
      var matchedPrevIndexes = Object.create(null);
      var prevByInstallment = Object.create(null);
      var prevByDueDate = Object.create(null);
      var todayStr = null;
      var structureReport = this._detectStructureChange(kind, prevList, nextList);
      var ownerId = owner && owner.id != null ? String(owner.id) : null;
      var trace = {
        kind: kind,
        ownerId: ownerId,
        previousCount: prevList.length,
        nextCount: nextList.length,
        directMatches: 0,
        dueDateMatches: 0,
        orderFallback: {
          attempted: 0,
          allowed: 0,
          blocked: 0,
          blockedReasons: []
        },
        skippedPreserve: 0,
        partialPreserveSuccess: 0,
        partialPreserveBlocked: 0,
        confidenceDistribution: {
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0
        },
        structureChange: structureReport,
        beforeTotals: this._captureScheduleTotals(prevList),
        outputSchedules: out,
        sampleMatches: []
      };

      if (App.util && typeof App.util.todayISODate === 'function') {
        todayStr = App.util.todayISODate();
      } else {
        todayStr = new Date().toISOString().slice(0, 10);
      }

      for (var i = 0; i < prevList.length; i++) {
        var prev = prevList[i];
        if (!prev) continue;

        var instKey = (prev.installmentNo != null) ? String(prev.installmentNo) : '';
        if (instKey && typeof prevByInstallment[instKey] === 'undefined') {
          prevByInstallment[instKey] = i;
        }

        var dueKey = prev.dueDate || prev.due_date || '';
        if (dueKey) {
          if (!prevByDueDate[dueKey]) prevByDueDate[dueKey] = [];
          prevByDueDate[dueKey].push(i);
        }
      }

      function findUnmatchedIndexByDueDate(dueKey) {
        var indexes = prevByDueDate[dueKey] || [];
        for (var di = 0; di < indexes.length; di++) {
          var idx = indexes[di];
          if (!matchedPrevIndexes[idx]) return idx;
        }
        return -1;
      }

      function findFirstUnmatchedIndex() {
        for (var fi = 0; fi < prevList.length; fi++) {
          if (!matchedPrevIndexes[fi]) return fi;
        }
        return -1;
      }

      var fallbackPolicy = this._canUseOrderFallback(kind, structureReport, trace);
      if (!fallbackPolicy.allowed) {
        trace.orderFallback.blockedReasons = fallbackPolicy.reasons.slice();
      }

      for (var j = 0; j < nextList.length; j++) {
        var next = shallowClone(nextList[j]);
        if (!next) continue;

        var matchedIndex = -1;
        var matchType = 'none';
        var nextInstKey = (next.installmentNo != null) ? String(next.installmentNo) : '';
        if (nextInstKey && typeof prevByInstallment[nextInstKey] !== 'undefined') {
          var instIndex = prevByInstallment[nextInstKey];
          if (!matchedPrevIndexes[instIndex]) {
            matchedIndex = instIndex;
            matchType = 'installment';
          }
        }

        if (matchedIndex < 0) {
          var nextDueKey = next.dueDate || next.due_date || '';
          if (nextDueKey) {
            matchedIndex = findUnmatchedIndexByDueDate(nextDueKey);
            if (matchedIndex >= 0) matchType = 'dueDate';
          }
        }

        if (matchedIndex < 0) {
          trace.orderFallback.attempted += 1;
          if (fallbackPolicy.allowed) {
            matchedIndex = findFirstUnmatchedIndex();
            if (matchedIndex >= 0) {
              trace.orderFallback.allowed += 1;
              matchType = 'order';
            }
          } else {
            trace.orderFallback.blocked += 1;
          }
        }

        if (matchedIndex >= 0) {
          matchedPrevIndexes[matchedIndex] = true;
          var prevMatched = prevList[matchedIndex];
          var confidence = this._evaluateScheduleMatch(kind, prevMatched, next, matchType, matchedIndex, j, structureReport);
          if (confidence && confidence.tier && trace.confidenceDistribution[confidence.tier] != null) {
            trace.confidenceDistribution[confidence.tier] += 1;
          }

          if (matchType === 'installment') trace.directMatches += 1;
          else if (matchType === 'dueDate') trace.dueDateMatches += 1;

          if (trace.sampleMatches.length < 8) {
            trace.sampleMatches.push({
              matchType: matchType,
              confidence: confidence,
              prevId: prevMatched && prevMatched.id != null ? String(prevMatched.id) : null,
              prevInstallmentNo: prevMatched && prevMatched.installmentNo != null ? Number(prevMatched.installmentNo) : null,
              nextInstallmentNo: next && next.installmentNo != null ? Number(next.installmentNo) : null,
              prevDueDate: getScheduleDueDate(prevMatched),
              nextDueDate: getScheduleDueDate(next)
            });
          }

          if (prevMatched) {
            this._applyPreservedScheduleState(kind, next, prevMatched, confidence, trace);
          }
        } else {
          trace.skippedPreserve += 1;
        }

        if (kind === 'loan') {
          this._normalizeScheduleStatus(next, todayStr);
        } else {
          var claimAmount = toNonNegativeNumber(next.amount);
          next.amount = claimAmount;
          if ((String(next.status || '').toUpperCase() === 'PARTIAL') && claimAmount <= 0) {
            next.status = 'PLANNED';
            next.paidAmount = 0;
            next.partialPaidAmount = 0;
          }
        }

        out.push(next);
      }

      this._finalizeMergeTrace(trace);
      return out;
    },

    _mergeLoanRuntimeScheduleState: function (loan, previousSchedules, nextSchedules) {
      return this._mergeRuntimeScheduleState('loan', loan, previousSchedules, nextSchedules);
    },

    _mergeClaimRuntimeScheduleState: function (claim, previousSchedules, nextSchedules) {
      return this._mergeRuntimeScheduleState('claim', claim, previousSchedules, nextSchedules);
    },

    rebuildForLoan: function (loan) {
      if (!loan || loan.id == null) return;

      this._ensureInitialized();

      var normalizedLoanId = toStr(loan.id);
      var newList = [];
      var current = this.list || [];
      var previousLoanSchedules = [];

      // 1) 기존 loan 스케줄 제거
      for (var i = 0; i < current.length; i++) {
        var s = current[i];
        if (!s) {
          newList.push(s);
          continue;
        }
        if (s.kind === 'loan' && toStr(s.loanId) === normalizedLoanId) {
          previousLoanSchedules.push(shallowClone(s));
          continue;
        }
        newList.push(s);
      }

      // 2) 새 스케줄 생성
      var newSchedules = [];
      if (App.db && typeof App.db.buildLoanSchedule === 'function') {
        newSchedules = App.db.buildLoanSchedule(loan) || [];
      }
      newSchedules = this._mergeLoanRuntimeScheduleState(loan, previousLoanSchedules, newSchedules);

      for (var j = 0; j < newSchedules.length; j++) {
        var ns = shallowClone(newSchedules[j]);
        if (!ns) continue;

        if (ns.id != null) ns.id = toStr(ns.id);
        if (ns.loanId != null) ns.loanId = toStr(ns.loanId);
        else ns.loanId = normalizedLoanId;

        if (ns.debtorId != null) ns.debtorId = toStr(ns.debtorId);
        else if (loan.debtorId != null) ns.debtorId = toStr(loan.debtorId);

        if (ns.claimId != null) ns.claimId = toStr(ns.claimId);

        if (!ns.kind) ns.kind = 'loan';

        newList.push(ns);
      }

      // 3) ID 정규화
      for (var k = 0; k < newList.length; k++) {
        var sc = newList[k];
        if (!sc) continue;
        if (sc.loanId != null) sc.loanId = toStr(sc.loanId);
        if (sc.debtorId != null) sc.debtorId = toStr(sc.debtorId);
        if (sc.claimId != null) sc.claimId = toStr(sc.claimId);
        if (sc.id != null) sc.id = toStr(sc.id);
      }

      this.list = newList;
      this._syncAlias();

      // 4) Loan 파생 필드 업데이트
      if (App.db && typeof App.db.deriveLoanFields === 'function') {
        var loanSchedules = [];
        for (var m = 0; m < newList.length; m++) {
          var sc2 = newList[m];
          if (!sc2) continue;
          if (sc2.kind === 'loan' && toStr(sc2.loanId) === normalizedLoanId) {
            loanSchedules.push(sc2);
          }
        }
        App.db.deriveLoanFields(loan, loanSchedules);
      }
    },

    rebuildForClaim: function (claim) {
      if (!claim || claim.id == null) return;

      this._ensureInitialized();

      var normalizedClaimId = toStr(claim.id);
      var newList = [];
      var current = this.list || [];
      var previousClaimSchedules = [];

      // 1) 기존 claim 스케줄 제거
      for (var i = 0; i < current.length; i++) {
        var s = current[i];
        if (!s) {
          newList.push(s);
          continue;
        }
        if (s.kind === 'claim' && toStr(s.claimId) === normalizedClaimId) {
          previousClaimSchedules.push(shallowClone(s));
          continue;
        }
        newList.push(s);
      }

      // 2) 새 스케줄 생성
      var newSchedules = [];
      if (App.db && typeof App.db.buildClaimSchedule === 'function') {
        newSchedules = App.db.buildClaimSchedule(claim) || [];
      }
      newSchedules = this._mergeClaimRuntimeScheduleState(claim, previousClaimSchedules, newSchedules);

      for (var j = 0; j < newSchedules.length; j++) {
        var ns = shallowClone(newSchedules[j]);
        if (!ns) continue;

        if (ns.id != null) ns.id = toStr(ns.id);
        if (ns.claimId != null) ns.claimId = toStr(ns.claimId);
        else ns.claimId = normalizedClaimId;

        if (ns.debtorId != null) ns.debtorId = toStr(ns.debtorId);
        else if (claim.debtorId != null) ns.debtorId = toStr(claim.debtorId);

        if (ns.loanId != null) ns.loanId = toStr(ns.loanId);

        if (!ns.kind) ns.kind = 'claim';

        newList.push(ns);
      }

      // 3) ID 정규화
      for (var k = 0; k < newList.length; k++) {
        var sc = newList[k];
        if (!sc) continue;
        if (sc.claimId != null) sc.claimId = toStr(sc.claimId);
        if (sc.debtorId != null) sc.debtorId = toStr(sc.debtorId);
        if (sc.loanId != null) sc.loanId = toStr(sc.loanId);
        if (sc.id != null) sc.id = toStr(sc.id);
      }

      this.list = newList;
      this._syncAlias();
    },

    updateSchedule: function (id, patch) {
      if (!id || !patch) return;
      this._ensureInitialized();

      var targetId = toStr(id);
      var list = this.list || [];

      for (var i = 0; i < list.length; i++) {
        var sc = list[i];
        if (!sc) continue;
        if (toStr(sc.id) === targetId) {
          for (var key in patch) {
            if (Object.prototype.hasOwnProperty.call(patch, key)) {
              sc[key] = patch[key];
            }
          }
          break;
        }
      }

      this._syncAlias();
    },

    bulkUpdateFromLoanForm: function (form) {
      if (!form) return;

      this._ensureInitialized();

      var api = App.features && App.features.debtors;
      var loanId = form.getAttribute('data-loan-id');
      var normalizedLoanId = loanId != null ? String(loanId) : loanId;
      var list = this.list || [];

      // 1단계: 상태(select)를 기준으로 status 및 금액 기본값 설정
      var selects = form.querySelectorAll('select[data-schedule-id]');
      for (var i = 0; i < selects.length; i++) {
        var sel = selects[i];
        var sid = sel.getAttribute('data-schedule-id');
        var val = sel.value || 'PLANNED';

        for (var j = 0; j < list.length; j++) {
          var sc = list[j];
          if (!sc) continue;
          if (String(sc.id) === String(sid)) {
            var amount = Number(sc.amount) || 0;

            sc.status = val;

            if (val === 'PAID') {
              sc.paidAmount = amount;
              sc.partialPaidAmount = 0;
            } else if (val === 'PLANNED' || val === 'OVERDUE') {
              sc.paidAmount = 0;
              sc.partialPaidAmount = 0;
            } else if (val === 'PARTIAL') {
              // PARTIAL 은 이 단계에서는 status 만 설정하고 금액은 건드리지 않는다.
            }
            break;
          }
        }
      }

      // 2단계: 부분 납입 금액(partialPaidAmount) 입력값 반영
      var partialInputs = form.querySelectorAll('input[data-partial-id]');
      for (var k = 0; k < partialInputs.length; k++) {
        var input = partialInputs[k];
        var sid2 = input.getAttribute('data-partial-id');
        var raw = input.value != null ? String(input.value).trim() : '';
        var num = raw === '' ? 0 : Number(raw);
        if (!isFinite(num) || num < 0) num = 0;

        for (var m = 0; m < list.length; m++) {
          var sc2 = list[m];
          if (!sc2) continue;
          if (String(sc2.id) === String(sid2)) {
            sc2.partialPaidAmount = num;
            if ((sc2.status || '').toUpperCase() === 'PARTIAL') {
              sc2.paidAmount = num;
            }
            break;
          }
        }
      }

      // Loan 파생 필드 업데이트
      if (App.db && App.db.deriveLoanFields && normalizedLoanId != null) {
        var loan = null;
        var state = App.state || {};
        var loans = state.loans || [];
        for (var n = 0; n < loans.length; n++) {
          var candidate = loans[n];
          if (!candidate) continue;
          if (String(candidate.id) === String(normalizedLoanId)) {
            loan = candidate;
            break;
          }
        }
        if (loan) {
          var loanSchedules = [];
          for (var p = 0; p < list.length; p++) {
            var sc3 = list[p];
            if (!sc3) continue;
            if (sc3.kind === 'loan' && String(sc3.loanId) === String(normalizedLoanId)) {
              loanSchedules.push(sc3);
            }
          }
          App.db.deriveLoanFields(loan, loanSchedules);
        }
      }

      this._syncAlias();

      // Stage 4A: UI 업데이트(모달 close / render / refresh)는 App.api.domain.commit 파이프라인에서 처리한다.
      if (api && typeof api.closeModal === 'function') {
        api.closeModal();
      }
    }
  };

  App.schedulesEngine = engine;
})(window);
