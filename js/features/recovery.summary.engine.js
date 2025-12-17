(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  App.features = App.features || {};

  App.features.recoverySummary = (function () {

        function computeSummaryFromSeries(daily, monthly) {
      daily = daily || {};
      monthly = monthly || {};

      var dailyPlanned = daily.planned || [];
      var dailyActual = daily.actual || [];
      var monthlyPlanned = monthly.planned || [];
      var monthlyActual = monthly.actual || [];

      function safeNumber(v) {
        var n = Number(v);
        if (!isFinite(n)) return 0;
        return n;
      }

      function sliceLast(arr, count) {
        if (!arr || !arr.length) return [];
        if (arr.length <= count) return arr.slice();
        return arr.slice(arr.length - count);
      }

      function sum(arr) {
        if (!arr || !arr.length) return 0;
        var total = 0;
        for (var i = 0; i < arr.length; i++) {
          total += safeNumber(arr[i]);
        }
        return total;
      }

      // 최근 30일 / 90일 공식에 맞게 시계열 기반 값 사용
      var lastDailyPlanned = sliceLast(dailyPlanned, 30);
      var lastDailyActual = sliceLast(dailyActual, 30);
      var lastMonthlyPlanned = sliceLast(monthlyPlanned, 3);
      var lastMonthlyActual = sliceLast(monthlyActual, 3);

      var dailyPlannedSum = sum(lastDailyPlanned);
      var dailyActualSum = sum(lastDailyActual);
      var monthlyPlannedSum = sum(lastMonthlyPlanned);
      var monthlyActualSum = sum(lastMonthlyActual);

      // 공식 1: 최근 30일간 예정금 합계 ÷ 30
      var dailyPlannedAvg = dailyPlannedSum / 30;
      // 공식 2: 최근 30일간 실제 회수금 합계 ÷ 30
      var dailyPaidAvg = dailyActualSum / 30;
      // 공식 3: 최근 90일간 예정금 합계 ÷ 3
      var monthlyPlannedAvg = monthlyPlannedSum / 3;
      // 공식 4: 최근 90일간 실제 회수금 합계 ÷ 3
      var monthlyPaidAvg = monthlyActualSum / 3;

      if (!isFinite(dailyPlannedAvg)) dailyPlannedAvg = 0;
      if (!isFinite(dailyPaidAvg)) dailyPaidAvg = 0;
      if (!isFinite(monthlyPlannedAvg)) monthlyPlannedAvg = 0;
      if (!isFinite(monthlyPaidAvg)) monthlyPaidAvg = 0;

      return {
        dailyPlanned: dailyPlannedAvg,
        dailyPaid: dailyPaidAvg,
        monthlyPlanned: monthlyPlannedAvg,
        monthlyPaid: monthlyPaidAvg
      };
    }


    function formatCurrency(value) {
      var util = App.util || {};
      var v = Number(value) || 0;
      if (typeof util.formatShortCurrency === 'function') {
        return util.formatShortCurrency(v);
      }
      if (typeof util.formatCurrency === 'function') {
        return util.formatCurrency(v);
      }
      return String(v);
    }

    function clearChildren(node) {
      if (!node) return;
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    }

    function renderSummary(root, summary) {
      if (!root) return null;
      clearChildren(root);

      var labels = [
        '일평균 회수예정액',
        '일평균 회수액',
        '월평균 회수예정액',
        '월평균 회수액'
      ];
      var keys = ['dailyPlanned', 'dailyPaid', 'monthlyPlanned', 'monthlyPaid'];
      var ids = ['kpi-daily-planned', 'kpi-daily-actual', 'kpi-monthly-planned', 'kpi-monthly-actual'];

      for (var i = 0; i < labels.length; i++) {
        var item = document.createElement('div');
        item.className = 'recovery-kpi-item';

        var labelEl = document.createElement('div');
        labelEl.className = 'label';
        labelEl.textContent = labels[i];
        item.appendChild(labelEl);

        var valueEl = document.createElement('div');
        valueEl.className = 'value';
        valueEl.id = ids[i];
        var raw = summary ? summary[keys[i]] : 0;
        valueEl.textContent = formatCurrency(raw);
        item.appendChild(valueEl);

        root.appendChild(item);
      }

      return root;
    }

    function updateSummaryValues(root, summary) {
      if (!root || !summary) return;
      var ids = ['kpi-daily-planned', 'kpi-daily-actual', 'kpi-monthly-planned', 'kpi-monthly-actual'];
      var keys = ['dailyPlanned', 'dailyPaid', 'monthlyPlanned', 'monthlyPaid'];

      for (var i = 0; i < ids.length; i++) {
        var el = root.querySelector('#' + ids[i]);
        if (!el) continue;
        var raw = summary[keys[i]];
        el.textContent = formatCurrency(raw);
      }
    }

    function init(root) {
      if (!root) return null;
      // Initial empty summary; actual values will be driven by trends engine
      renderSummary(root, {
        dailyPlanned: 0,
        dailyPaid: 0,
        monthlyPlanned: 0,
        monthlyPaid: 0
      });

      var controller = {
        root: root,
        updateFromSeries: function (daily, monthly) {
          var summary = computeSummaryFromSeries(daily, monthly);
          updateSummaryValues(root, summary);
        },
        computeSummaryFromSeries: computeSummaryFromSeries
      };

      return controller;
    }

    return {
      init: init,
      computeSummaryFromSeries: computeSummaryFromSeries,
      updateSummaryValues: updateSummaryValues
    };
  })();
})(window, document);
