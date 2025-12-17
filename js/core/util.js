(function (window) {
  'use strict';
  var App = window.App || (window.App = {});

  function pad2(v) {
    v = Number(v) || 0;
    return v < 10 ? '0' + v : String(v);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayISODate() {
    var d = new Date();
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }


  function formatNumber(v) {
    var n = Number(v);
    if (!isFinite(n)) return String(v);
    return n.toLocaleString('ko-KR');
  }

  function formatCurrency(v) {
    var n = Number(v);
    if (!isFinite(n) || !n) return '₩0';
    try {
      return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0
      }).format(n);
    } catch (e) {
      return formatNumber(n);
    }
  }


  function formatShortCurrency(v) {
    var n = Number(v);
    if (!isFinite(n) || !n) return '\u20a90';

    var abs = Math.abs(n);
    var sign = n < 0 ? '-' : '';

    var value = abs;
    var unit = '';

    if (abs >= 100000000) {
      value = abs / 100000000;
      unit = '\uc5b5';
    } else if (abs >= 10000) {
      value = abs / 10000;
      unit = '\ub9cc';
    }

    var rounded = Math.round(value * 10) / 10;
    var text = String(rounded).replace(/\.0$/, '');

    return sign + text + unit;
  }

  function escapeHTML(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  App.util = {
    pad2: pad2,
    formatDate: formatDate,
    formatNumber: formatNumber,
    formatCurrency: formatCurrency,
    formatShortCurrency: formatShortCurrency,
    escapeHTML: escapeHTML,
    todayISODate: todayISODate
  };

  App.showToast = function (msg) {
    var el = document.getElementById("toast");
    if (!el) return;

    el.textContent = msg;
    el.classList.add("show");

    clearTimeout(App._toastTimer);
    App._toastTimer = setTimeout(function () {
      el.classList.remove("show");
    }, 1500);
  };
})(window);