(function () {
  var D = window.DASHBOARD_DATA;
  if (!D) return;

  var $ = function (sel) { return document.querySelector(sel); };
  var total = D.meta.total;

  // 副标题
  $("#page-subtitle").textContent =
    D.meta.range + " · " + D.meta.rangeLabel + " · " + D.meta.market +
    " · 数据来源 " + D.meta.source;

  // KPI
  var days = 22; // 9/24–10/15
  var kpis = [
    { num: total, label: "邮件总数（样本）" },
    { num: D.meta.brandCount, label: "品牌" },
    { num: D.meta.weekCount, label: "周" },
    { num: (total / days).toFixed(1), label: "日均邮件（6 品牌合计）" }
  ];
  $("#kpis").innerHTML = kpis.map(function (k) {
    return '<div class="kpi"><div class="num">' + k.num + '</div><div class="label">' + k.label + '</div></div>';
  }).join("");

  // 品牌 × 周热力表
  var maxWeekly = 0;
  D.brands.forEach(function (b) {
    b.weekly.forEach(function (n) { if (n > maxWeekly) maxWeekly = n; });
  });
  var tbody = D.brands.map(function (b) {
    var cells = b.weekly.map(function (n) {
      var alpha = 0.08 + 0.72 * (n / maxWeekly);
      return '<td class="heat" style="background:rgba(37,99,235,' + alpha.toFixed(2) + ')">' + n + '</td>';
    }).join("");
    return "<tr><td><b>" + b.name + "</b></td>" + cells +
      '<td class="num">' + b.total + "</td>" +
      '<td class="num">' + b.perDay.toFixed(1) + "</td>" +
      "<td>" + b.strategy + "</td></tr>";
  }).join("");
  var weekTotals = D.weeks.map(function (w, i) {
    return D.brands.reduce(function (s, b) { return s + b.weekly[i]; }, 0);
  });
  tbody += "<tr><td><b>合计</b></td>" +
    weekTotals.map(function (n) {
      return '<td class="heat" style="background:rgba(17,24,39,0.08)">' + n + "</td>";
    }).join("") +
    '<td class="num">' + total + "</td><td class=\"num\">" + (total / days).toFixed(1) + "</td><td>—</td></tr>";
  $("#brand-week-table tbody").innerHTML = tbody;

  // 每周主要 Campaign
  $("#campaign-list").innerHTML = D.brands.map(function (b) {
    var lines = b.campaigns.map(function (c, i) {
      return "<div><b>" + D.weeks[i].label + "：</b>" + c + "</div>";
    }).join("");
    return '<div class="campaign-item"><b>' + b.name + "</b>" + lines + "</div>";
  }).join("");

  // 内容结构饼图（环形，stroke-dasharray 实现）
  var C = 2 * Math.PI * 80;
  var acc = 0;
  var pieSvg = "";
  D.themes.forEach(function (t) {
    var frac = t.count / total;
    var len = frac * C;
    pieSvg += '<circle cx="120" cy="120" r="80" fill="none" stroke="' + t.color +
      '" stroke-width="44" stroke-dasharray="' + len.toFixed(1) + " " + (C - len).toFixed(1) +
      '" stroke-dashoffset="' + (-acc).toFixed(1) + '" transform="rotate(-90 120 120)" />';
    acc += len;
  });
  $("#pie").innerHTML = pieSvg;
  $("#pie-legend").innerHTML = D.themes.map(function (t) {
    var pct = (t.count / total * 100).toFixed(1);
    return '<li><span class="dot" style="background:' + t.color + '"></span>' +
      t.labelZh + " " + t.label + " · " + t.count + " 封 · " + pct + "%</li>";
  }).join("");

  // 各品牌内容结构
  var themeByKey = {};
  D.themes.forEach(function (t) { themeByKey[t.key] = t; });
  $("#brand-mix").innerHTML = D.brands.map(function (b) {
    var segs = D.themes.filter(function (t) { return (b.themes[t.key] || 0) > 0; }).map(function (t) {
      var w = (b.themes[t.key] / b.total * 100).toFixed(1);
      return '<div style="width:' + w + '%;background:' + t.color + '" title="' + t.labelZh + " " + b.themes[t.key] + ' 封"></div>';
    }).join("");
    var legend = D.themes.filter(function (t) { return (b.themes[t.key] || 0) > 0; }).map(function (t) {
      return t.labelZh + " " + b.themes[t.key];
    }).join(" · ");
    return '<div class="mix-row"><div class="mix-head"><b>' + b.name + "</b><span>" + b.total + " 封</span></div>" +
      '<div class="mix-bar">' + segs + '</div><div class="mix-legend">' + legend + "</div></div>";
  }).join("");

  // 词云
  var maxWord = D.words.reduce(function (m, w) { return Math.max(m, w.count); }, 0);
  var palette = ["#111827", "#e85d7a", "#2563eb", "#3fa66a", "#8e7cc3", "#f0a030"];
  $("#word-cloud").innerHTML = D.words.map(function (w, i) {
    var size = 13 + (w.count / maxWord) * 31;
    return '<span style="font-size:' + size.toFixed(0) + 'px;color:' + palette[i % palette.length] +
      '" title="' + w.text + " · " + w.count + ' 封邮件">' + w.text + "</span>";
  }).join("");
  $("#word-list").innerHTML = D.words.map(function (w) {
    return "<li>" + w.text + " · " + w.count + " 封</li>";
  }).join("");

  // 洞察
  $("#insights").innerHTML = D.insights.map(function (s) { return "<li>" + s + "</li>"; }).join("");
})();
