(function (window) {
  'use strict';

  var App = window.App || (window.App = {});
  App.date = App.date || {};

  function pad2(v) {
    if (App.util && typeof App.util.pad2 === 'function') {
      return App.util.pad2(v);
    }
    v = Number(v) || 0;
    return v < 10 ? '0' + v : String(v);
  }

  function toISODate(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function parseISODate(str) {
    if (!str) return null;
    if (str instanceof Date) {
      return new Date(str.getFullYear(), str.getMonth(), str.getDate());
    }
    var d = new Date(str);
    if (isNaN(d.getTime())) {
      return null;
    }
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function getToday() {
    return toISODate(new Date());
  }

  function addDays(base, days) {
    var d = null;
    if (base instanceof Date) {
      d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    } else if (base) {
      d = parseISODate(base);
    }
    if (!d) {
      d = new Date();
    }
    d.setDate(d.getDate() + (Number(days) || 0));
    return toISODate(d);
  }

  function diffDays(a, b) {
    var d1 = parseISODate(a);
    var d2 = parseISODate(b);
    if (!d1 || !d2) return 0;
    var t1 = d1.getTime();
    var t2 = d2.getTime();
    var diffMs = t1 - t2;
    return Math.round(diffMs / 86400000);
  }

  function compare(a, b) {
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    var d1 = parseISODate(a);
    var d2 = parseISODate(b);
    if (!d1 && !d2) return 0;
    if (!d1) return -1;
    if (!d2) return 1;
    var t1 = d1.getTime();
    var t2 = d2.getTime();
    if (t1 < t2) return -1;
    if (t1 > t2) return 1;
    return 0;
  }

  App.date.toISODate = toISODate;
  App.date.parseISODate = parseISODate;
  App.date.getToday = getToday;
  App.date.addDays = addDays;
  App.date.diffDays = diffDays;
  App.date.compare = compare;
})(window);
