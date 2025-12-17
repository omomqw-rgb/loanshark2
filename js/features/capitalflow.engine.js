(function (window, document) {
  'use strict';

  var App = window.App || (window.App = {});
  App.features = App.features || {};

  App.features.capitalFlow = (function () {
    var state = {
      mode: 'daily',
      offsets: {
        daily: 0,
        monthly: 0,
        yearly: 0
      },
      chart: null,
      root: null,
      cache: {
        dailyMap: null,
        monthlyMap: null,
        yearlyMap: null,
        rawMonthlyMap: null,
        rawYearMap: null
      },
      summaryController: null
    };

    function getSchedules() {
      var s = [];

      if (App.schedulesEngine && typeof App.schedulesEngine.getAll === 'function') {
        try {
          s = App.schedulesEngine.getAll() || [];
        } catch (e) {
          s = [];
        }
      }

      if (!s || !s.length) return [];
      return s.slice();
    }

    function ymd(date) {
      var y = date.getFullYear();
      var m = date.getMonth() + 1;
      var d = date.getDate();
      var mm = m < 10 ? '0' + m : '' + m;
      var dd = d < 10 ? '0' + d : '' + d;
      return y + '-' + mm + '-' + dd;
    }

    function addDays(date, n) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
    }

    function addMonths(date, n) {
      return new Date(date.getFullYear(), date.getMonth() + n, 1);
    }

    function parseYMD(str) {
      var y = parseInt(str.slice(0, 4), 10);
      var m = parseInt(str.slice(5, 7), 10) - 1;
      var d = parseInt(str.slice(8, 10), 10);
      return new Date(y, m, d);
    }

    function getBucket(map, key) {
      var b = map[key];
      if (!b) {
        return { planned: 0, actual: 0 };
      }
      return b;
    }

        function buildRecoveryCache() {
      var schedules = getSchedules();
      var dailyMap = {};
      var monthlyMap = {};
      var yearlyMap = {};

      for (var i = 0; i < schedules.length; i++) {
        var sch = schedules[i];
        if (!sch) continue;

        var d = sch.date || sch.dueDate;
        if (!d || typeof d !== 'string') continue;

        var y = d.slice(0, 4);
        var ym = d.slice(0, 7);

        var amtPlanned = Number(sch.amount || 0);
        var amtActual = Number(sch.paidAmount != null ? sch.paidAmount : (sch.actualAmount || 0));

        var dayBucket = dailyMap[d];
        if (!dayBucket) {
          dayBucket = dailyMap[d] = { planned: 0, actual: 0 };
        }
        dayBucket.planned += amtPlanned;
        dayBucket.actual += amtActual;

        var mBucket = monthlyMap[ym];
        if (!mBucket) {
          mBucket = monthlyMap[ym] = { planned: 0, actual: 0 };
        }
        mBucket.planned += amtPlanned;
        mBucket.actual += amtActual;

        var yBucket = yearlyMap[y];
        if (!yBucket) {
          yBucket = yearlyMap[y] = { planned: 0, actual: 0 };
        }
        yBucket.planned += amtPlanned;
        yBucket.actual += amtActual;
      }

      // derive rawYearMap from monthlyMap so that yearly mode can work purely from month buckets
      var rawYearMap = {};
      for (var ymKey in monthlyMap) {
        if (!Object.prototype.hasOwnProperty.call(monthlyMap, ymKey)) continue;
        var yearKey = ymKey.slice(0, 4);
        var src = monthlyMap[ymKey] || {};
        var dest = rawYearMap[yearKey];
        if (!dest) {
          dest = rawYearMap[yearKey] = { planned: 0, actual: 0 };
        }
        dest.planned += src.planned || 0;
        dest.actual += src.actual || 0;
      }

      state.cache.dailyMap = dailyMap;
      state.cache.monthlyMap = monthlyMap;
      state.cache.yearlyMap = yearlyMap;
      state.cache.rawMonthlyMap = monthlyMap;
      state.cache.rawYearMap = rawYearMap;
    }


    function getDailyViewportDates() {
      var today = new Date();
      var offset = state.offsets.daily || 0;
      var end = addDays(today, -offset);
      var start = addDays(end, -14);

      var dates = [];
      var cur = new Date(start.getTime());
      while (cur <= end) {
        dates.push(ymd(cur));
        cur = addDays(cur, 1);
      }
      return dates;
    }

    function buildDailySeries() {
      var dailyMap = state.cache.dailyMap || {};
      var dates = getDailyViewportDates();
      if (!dates.length) {
        return { labels: [], planned: [], actual: [] };
      }

      var labels = [];
      var plannedSeries = [];
      var actualSeries = [];

      for (var i = 0; i < dates.length; i++) {
        var curStr = dates[i];
        var curDate = parseYMD(curStr);
        var from = addDays(curDate, -29);

        var sumPlanned = 0;
        var sumActual = 0;

        var cur = new Date(from.getTime());
        while (cur <= curDate) {
          var key = ymd(cur);
          var bucket = getBucket(dailyMap, key);
          sumPlanned += bucket.planned;
          sumActual += bucket.actual;
          cur = addDays(cur, 1);
        }

        labels.push(curStr);
        plannedSeries.push(sumPlanned / 30);
        actualSeries.push(sumActual / 30);
      }

      return {
        labels: labels,
        planned: plannedSeries,
        actual: actualSeries
      };
    }

    function getMonthlyViewportMonths() {
      var today = new Date();
      var offset = state.offsets.monthly || 0;
      var end = new Date(today.getFullYear(), today.getMonth() - offset, 1);

      var months = [];
      for (var i = 11; i >= 0; i--) {
        var d = new Date(end.getFullYear(), end.getMonth() - i, 1);
        var y = d.getFullYear();
        var m = d.getMonth() + 1;
        var mm = m < 10 ? '0' + m : '' + m;
        months.push(y + '-' + mm);
      }
      return months;
    }

        function buildMonthlySeries() {
      var dailyMap = state.cache.dailyMap || {};
      var baseMonthlyMap = state.cache.monthlyMap || {};
      var months = getMonthlyViewportMonths();
      if (!months.length) {
        return { labels: [], planned: [], actual: [] };
      }

      var rawMonthlyMap = {};
      var labels = [];
      var plannedSeries = [];
      var actualSeries = [];

      // prepare raw monthly buckets for all visible months
      for (var i = 0; i < months.length; i++) {
        var cur = months[i];
        var rawBucket = baseMonthlyMap[cur] || { planned: 0, actual: 0 };
        rawMonthlyMap[cur] = {
          planned: rawBucket.planned || 0,
          actual: rawBucket.actual || 0
        };
      }

      // expose rawMonthlyMap for tooltip usage
      state.cache.rawMonthlyMap = rawMonthlyMap;

      // build 3-month rolling average series
      for (var j = 0; j < months.length; j++) {
        var curKey = months[j];
        var base = new Date(parseInt(curKey.slice(0, 4), 10), parseInt(curKey.slice(5, 7), 10) - 1, 1);

        var sumPlanned = 0;
        var sumActual = 0;
        for (var k = 0; k < 3; k++) {
          var d = addMonths(base, -k);
          var y = d.getFullYear();
          var m = d.getMonth() + 1;
          var mm = m < 10 ? '0' + m : '' + m;
          var key = y + '-' + mm;
          var bucket = baseMonthlyMap[key] || { planned: 0, actual: 0 };
          sumPlanned += bucket.planned || 0;
          sumActual += bucket.actual || 0;
        }

        labels.push(curKey);
        plannedSeries.push(sumPlanned / 3);
        actualSeries.push(sumActual / 3);
      }

      return {
        labels: labels,
        planned: plannedSeries,
        actual: actualSeries
      };
    }


    function getYearlyViewportYears() {
      var today = new Date();
      var offset = state.offsets.yearly || 0;
      var endYear = today.getFullYear() - offset;
      var startYear = endYear - 9;

      var years = [];
      for (var y = startYear; y <= endYear; y++) {
        years.push(String(y));
      }
      return years;
    }

        function buildYearlySeries() {
      var baseMonthlyMap = state.cache.monthlyMap || {};
      var years = getYearlyViewportYears();
      if (!years.length) {
        return { labels: [], planned: [], actual: [] };
      }

      // determine which years we need raw sums for (viewport years and their 2-year history)
      var neededYears = {};
      for (var i = 0; i < years.length; i++) {
        var y = parseInt(years[i], 10);
        neededYears[y] = true;
        neededYears[y - 1] = true;
        neededYears[y - 2] = true;
      }

      // aggregate monthly buckets into raw year totals
      var rawYearMap = {};
      for (var ymKey in baseMonthlyMap) {
        if (!Object.prototype.hasOwnProperty.call(baseMonthlyMap, ymKey)) continue;
        var yearKeyStr = ymKey.slice(0, 4);
        var yearKey = parseInt(yearKeyStr, 10);
        if (!neededYears[yearKey]) continue;
        var bucket = baseMonthlyMap[ymKey] || {};
        var dest = rawYearMap[yearKeyStr];
        if (!dest) {
          dest = rawYearMap[yearKeyStr] = { planned: 0, actual: 0 };
        }
        dest.planned += bucket.planned || 0;
        dest.actual += bucket.actual || 0;
      }

      state.cache.rawYearMap = rawYearMap;

      var labels = [];
      var plannedSeries = [];
      var actualSeries = [];

      for (var j = 0; j < years.length; j++) {
        var yearStr = years[j];
        var y = parseInt(yearStr, 10);

        var sumPlanned = 0;
        var sumActual = 0;
        for (var k = 0; k < 3; k++) {
          var yy = String(y - k);
          var bucketY = rawYearMap[yy] || { planned: 0, actual: 0 };
          sumPlanned += bucketY.planned || 0;
          sumActual += bucketY.actual || 0;
        }

        labels.push(yearStr);
        plannedSeries.push(sumPlanned / 3);
        actualSeries.push(sumActual / 3);
      }

      return {
        labels: labels,
        planned: plannedSeries,
        actual: actualSeries
      };
    }


    function buildDatasetFromSeries(series) {
      series = series || {};
      return {
        labels: series.labels || [],
        planned: series.planned || [],
        actual: series.actual || []
      };
    }

                function initTrendChart(canvas, dataset) {
      if (!canvas || typeof Chart === 'undefined') {
        return null;
      }

      var ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }

      var util = App.util || {};

      var config = {
        type: 'line',
        data: {
          labels: dataset.labels || [],
          datasets: [
            {
              label: 'Planned',
              data: dataset.planned || [],
              borderColor: 'rgba(160,160,160,1)',
              borderWidth: 2,
              borderDash: [6, 4],
              tension: 0.3,
              pointRadius: 2,
              pointHoverRadius: 6,
              hitRadius: 8,
              hoverRadius: 6,
              fill: false
            },
            {
              label: 'Actual',
              data: dataset.actual || [],
              borderColor: 'rgba(60,130,255,1)',
              borderWidth: 3,
              tension: 0.35,
              pointRadius: 2,
              pointHoverRadius: 6,
              hitRadius: 8,
              hoverRadius: 6,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'nearest',
            intersect: false
          },
          plugins: {
            legend: { display: true },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var index = ctx.dataIndex;
                  var chartData = ctx.chart && ctx.chart.data ? ctx.chart.data : null;
                  var labels = chartData && chartData.labels ? chartData.labels : [];
                  var label = (labels && labels[index] != null) ? labels[index] : '';

                  var utilLocal = App.util || {};
                  function format(v) {
                    var n = Number(v) || 0;
                    return utilLocal.formatCurrency ? utilLocal.formatCurrency(n) : String(n);
                  }

                  var graphValue = (ctx.parsed && ctx.parsed.y != null) ? ctx.parsed.y : 0;

                  var rawPlanned = 0;
                  var rawActual = 0;

                  if (state && state.cache && label) {
                    if (state.mode === 'daily' && state.cache.dailyMap) {
                      var bucketD = state.cache.dailyMap[label] || {};
                      rawPlanned = bucketD.planned || 0;
                      rawActual = bucketD.actual || 0;
                    } else if (state.mode === 'monthly') {
                      var mapM = state.cache.rawMonthlyMap || state.cache.monthlyMap || {};
                      var bucketM = mapM[label] || {};
                      rawPlanned = bucketM.planned || 0;
                      rawActual = bucketM.actual || 0;
                    } else if (state.mode === 'yearly') {
                      var mapY = state.cache.rawYearMap || state.cache.yearlyMap || {};
                      var bucketY = mapY[label] || {};
                      rawPlanned = bucketY.planned || 0;
                      rawActual = bucketY.actual || 0;
                    }
                  }

                  var lines;
                  if (ctx.dataset && ctx.dataset.label === 'Planned') {
                    lines = [
                      label || '',
                      '회수예정(raw): ' + format(rawPlanned),
                      '회수예정(그래프): ' + format(graphValue)
                    ];
                  } else {
                    lines = [
                      label || '',
                      '회수액(raw): ' + format(rawActual),
                      '회수액(그래프): ' + format(graphValue)
                    ];
                  }

                  return lines;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              min: 0,
              grid: { display: false },
              ticks: { }
            }
          }
        }
      };

      return new Chart(ctx, config);
    }




    function updateTrendChart(chart, dataset) {
      if (!chart || !dataset) return;
      chart.data.labels = dataset.labels || [];
      if (chart.data.datasets && chart.data.datasets.length >= 2) {
        chart.data.datasets[0].data = dataset.planned || [];
        chart.data.datasets[1].data = dataset.actual || [];
      }
      chart.update();
    }

    function renderInsights(root, cache, daily, monthly) {
      if (!root) return;
      var box = root.querySelector('.recovery-flow-insight-box');
      if (!box) return;

      daily = daily || { planned: [], actual: [] };
      monthly = monthly || { planned: [], actual: [] };

      var dailyPlanned = daily.planned || [];
      var dailyActual = daily.actual || [];
      var monthlyActual = monthly.actual || [];

      var last30Actual = 0;
      var last30Planned = 0;
      for (var i = 0; i < dailyActual.length; i++) {
        last30Actual += Number(dailyActual[i] || 0);
      }
      for (var j = 0; j < dailyPlanned.length; j++) {
        last30Planned += Number(dailyPlanned[j] || 0);
      }
      var rate30 = last30Planned ? ((last30Actual / last30Planned) * 100).toFixed(1) + '%' : '--';

      var thisMonth = monthlyActual[11] || 0;
      var prevMonth = monthlyActual[10] || 0;
      var mom = prevMonth ? (((thisMonth - prevMonth) / prevMonth) * 100).toFixed(1) + '%' : '--';

      var last3Total = 0;
      var last3Count = 0;
      for (var k = 9; k <= 11; k++) {
        if (monthlyActual[k] != null) {
          last3Total += Number(monthlyActual[k] || 0);
          last3Count++;
        }
      }
      var prev3Total = 0;
      var prev3Count = 0;
      for (var k2 = 6; k2 <= 8; k2++) {
        if (monthlyActual[k2] != null) {
          prev3Total += Number(monthlyActual[k2] || 0);
          prev3Count++;
        }
      }

      var avg3 = last3Count ? (last3Total / last3Count) : 0;
      var prevAvg3 = prev3Count ? (prev3Total / prev3Count) : 0;
      var growth3 = prevAvg3 ? (((avg3 - prevAvg3) / prevAvg3) * 100).toFixed(1) + '%' : '--';

      var dailyMap = (cache && cache.dailyMap) || {};
      var totalPl = 0;
      var totalAc = 0;
      var keys = Object.keys(dailyMap);
      for (var t = 0; t < keys.length; t++) {
        var b = dailyMap[keys[t]];
        if (!b) continue;
        totalPl += Number(b.planned || 0);
        totalAc += Number(b.actual || 0);
      }
      var totalRate = totalPl ? ((totalAc / totalPl) * 100).toFixed(1) + '%' : '--';

      while (box.firstChild) {
        box.removeChild(box.firstChild);
      }

      function addLine(text) {
        var div = document.createElement('div');
        div.textContent = text;
        box.appendChild(div);
      }

      addLine('최근 30일 회수율: ' + rate30);
      addLine('전월 대비 회수 증가율: ' + mom);
      addLine('3개월 평균 회수 성장률: ' + growth3);
      addLine('전체 기간 회수율: ' + totalRate);
    }

    function render() {
      if (!state.root) return;

      var root = state.root;

      var dailySeries = buildDailySeries();
      var monthlySeries = buildMonthlySeries();
      var series;
      if (state.mode === 'daily') {
        series = dailySeries;
      } else if (state.mode === 'monthly') {
        series = monthlySeries;
      } else {
        series = buildYearlySeries();
      }

      var canvas = root.querySelector('#recoveryFlowChart');
      if (!canvas || typeof Chart === 'undefined') {
        return;
      }

      var dataset = buildDatasetFromSeries(series);

      if (!state.chart) {
        state.chart = initTrendChart(canvas, dataset);
      } else {
        updateTrendChart(state.chart, dataset);
      }

      if (state.summaryController && typeof state.summaryController.updateFromSeries === 'function') {
        if (state.mode === 'daily') {
          state.summaryController.updateFromSeries(dailySeries, monthlySeries);
        }
      }

      renderInsights(root, state.cache, dailySeries, monthlySeries);
    }

        function wireEvents() {
      if (!state.root) return;
      var root = state.root;

      var switchHost = root.querySelector('.recovery-interval-switch');
      if (switchHost) {
        var btns = switchHost.querySelectorAll('.switch-btn');

        var applyActiveMode = function () {
          for (var j = 0; j < btns.length; j++) {
            var btn = btns[j];
            var mode = btn.getAttribute('data-mode') || 'daily';
            var isActive = (mode === state.mode);
            if (btn.classList) {
              if (btn.classList.toggle) {
                btn.classList.toggle('active', isActive);
                btn.classList.toggle('is-active', isActive);
              } else {
                if (isActive) {
                  btn.className += ' active';
                }
              }
            }
          }
        };

        applyActiveMode();

        for (var i = 0; i < btns.length; i++) {
          (function (btn) {
            btn.addEventListener('click', function () {
              var mode = btn.getAttribute('data-mode') || 'daily';
              if (mode === state.mode) return;
              state.mode = mode;
              applyActiveMode();
              render();
            });
          })(btns[i]);
        }
      }

      var left = root.querySelector('.recovery-flow-nav.left');
      var right = root.querySelector('.recovery-flow-nav.right');

      if (left) {
        left.addEventListener('click', function () {
          if (state.mode === 'daily') {
            state.offsets.daily = (state.offsets.daily || 0) + 1;
          } else if (state.mode === 'monthly') {
            state.offsets.monthly = (state.offsets.monthly || 0) + 1;
          } else {
            state.offsets.yearly = (state.offsets.yearly || 0) + 1;
          }
          render();
        });
      }

      if (right) {
        right.addEventListener('click', function () {
          if (state.mode === 'daily') {
            state.offsets.daily = Math.max(0, (state.offsets.daily || 0) - 1);
          } else if (state.mode === 'monthly') {
            state.offsets.monthly = Math.max(0, (state.offsets.monthly || 0) - 1);
          } else {
            state.offsets.yearly = Math.max(0, (state.offsets.yearly || 0) - 1);
          }
          render();
        });
      }
    }


    function init(root, options) {
      if (!root) return null;

      state.root = root;
      state.summaryController = options && options.summaryController ? options.summaryController : null;

      buildRecoveryCache();
      state.mode = 'daily';
      state.offsets.daily = 0;
      state.offsets.monthly = 0;
      state.offsets.yearly = 0;

      wireEvents();
      render();

      return {
        root: root,
        render: render,
        update: function () {
          buildRecoveryCache();
          render();
        }
      };
    }

    function getState() {
      return state;
    }

    return {
      init: init,
      getState: getState
    };
  })();
})(window, document);
