/* 亚马逊卖家运营工具箱 - 公共算法库 v1.0
   放：幂律门槛、加权滚动窗口、节奏仿真、格式化。所有工具共用 */
(function(global){
  var TK = {};

  /* ---------- 基础工具 ---------- */
  TK.$ = function(id){ return document.getElementById(id); };
  TK.num = function(id){ var v = parseFloat(TK.$(id).value); return isNaN(v) ? 0 : v; };
  TK.money = function(v){ return (v < 0 ? '-' : '') + '$' + Math.abs(v).toFixed(2); };
  TK.money0 = function(v){ return (v < 0 ? '-' : '') + '$' + Math.abs(v).toFixed(0); };
  TK.pct = function(v, d){ return (v * 100).toFixed(d === undefined ? 1 : d) + '%'; };
  TK.clamp = function(v, a, b){ return Math.max(a, Math.min(b, v)); };

  /* 批量绑定 input 事件 */
  TK.bind = function(ids, fn){
    ids.forEach(function(id){
      var el = TK.$(id);
      if (el) el.addEventListener('input', fn);
    });
  };
  TK.bindAll = function(fn){
    document.querySelectorAll('input,select,textarea').forEach(function(el){
      el.addEventListener('input', fn);
    });
  };

  /* ---------- 滚动窗口权重 ---------- */
  TK.makeWeights = function(n){
    if (n === 3) return [0.5, 0.3, 0.2];
    if (n === 7) return [0.30, 0.22, 0.16, 0.12, 0.09, 0.07, 0.04];
    var arr = [], s = 0, q = 0.88, i;
    for (i = 0; i < n; i++){ arr.push(Math.pow(q, i)); s += Math.pow(q, i); }
    return arr.map(function(v){ return v / s; });
  };

  /* ---------- 幂律：U(r) = K * r^(-a) ---------- */
  /* 两点拟合 alpha：需要 ua 在 ra 名、ub 在 rb 名 */
  TK.fitAlpha = function(ra, ua, rb, ub){
    if (ra === rb || ua <= 0 || ub <= 0 || ra <= 0 || rb <= 0) return null;
    var a = Math.log(ua / ub) / Math.log(rb / ra);
    return (isFinite(a) && a > 0) ? a : null;
  };
  /* 由自身点与 alpha 求 K（≈第 1 名门槛） */
  TK.calcK = function(U, r, a){ return U * Math.pow(r, a); };
  /* 目标排名 r* 所需日均门槛 */
  TK.ustar = function(U, rNow, rStar, a){ return U * Math.pow(rNow / rStar, a); };
  /* 门槛反解排名：已知还想卖 U' 单，能排到第几 */
  TK.rankOf = function(K, U, a){
    if (U <= 0) return Infinity;
    return Math.pow(K / U, 1 / a);
  };

  /* ---------- 节奏序列与仿真 ---------- */
  var HORIZON = 120;
  TK.HORIZON = HORIZON;

  /* 生成冲刺期每日单量序列（索引 0 = 第 1 天） */
  TK.genSeq = function(mode, B, P, p){
    p = p || {};
    var d = [], t, v, G, Dp, Df, S, F;
    for (t = 1; t <= HORIZON; t++){
      if (mode === 'flat'){ v = P; }
      else if (mode === 'ramp'){
        G = p.G || 5;
        v = t <= G ? B + (P - B) * t / G : P;
      } else {
        Dp = p.Dp || 3; Df = p.Df || 4; S = P * (p.m || 2.5); F = P * (p.f || 0.7);
        if (t <= Dp) v = S;
        else if (t <= Dp + Df) v = F;
        else v = P;
      }
      d.push(v);
    }
    return d;
  };

  /* 逐日滚动：返回首个「加权分 >= target」的天数，达不到返回 null */
  TK.simulate = function(seq, base, w, target){
    var t, i, s, d;
    for (t = 1; t <= HORIZON; t++){
      s = 0;
      for (i = 0; i < w.length; i++){
        d = (t - i >= 1) ? seq[t - i - 1] : base;
        s += w[i] * d;
      }
      if (s >= target) return t;
    }
    return null;
  };

  /* 一次性算：门槛 / 天数 / 累计单量 / 是否短暂达成 */
  TK.run = function(opts){
    var U = opts.base, P = opts.push, target = opts.target,
        w = opts.weights || TK.makeWeights(7),
        seq = TK.genSeq(opts.mode || 'flat', U, P, opts);
    var days = TK.simulate(seq, U, w, target), cum = 0, i;
    if (days !== null){ for (i = 0; i < days; i++) cum += seq[i]; }
    return { days: days, cum: cum, seq: seq, reachable: days !== null, temporary: days !== null && P < target };
  };

  /* ---------- 表格辅助 ---------- */
  TK.rows = function(tbody, html){ tbody.insertAdjacentHTML('beforeend', html); };
  TK.clear = function(tbody){ tbody.innerHTML = ''; };

  /* ---------- 日期 ---------- */
  TK.addDays = function(iso, days){
    if (!iso) return '';
    var dt = new Date(iso);
    dt.setDate(dt.getDate() + days);
    return dt.toISOString().slice(5, 10);
  };

  /* ---------- 进度条 HTML（红线预警用） ---------- */
  /* used: 已用比例 0~1；higherBetter: 有效追踪率这类越大越好 */
  TK.barHTML = function(used, level){
    var cls = level === 'bad' ? 'bar-bad' : (level === 'warn' ? 'bar-warn' : 'bar-ok');
    return '<div class="bar ' + cls + '"><i style="width:' + TK.clamp(used * 100, 2, 100) + '%"></i></div>';
  };

  global.TK = TK;
})(window);
