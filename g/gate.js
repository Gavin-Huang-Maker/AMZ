/*
 * AMZ 工具箱 · 本地解密加载器（外观增强版）
 * ---------------------------------------------------------------
 * 在原版流程基础上新增：备用密码本（p/keys.json），让多个密码都能
 * 解开同一份密文；以及在「门禁页」与「解密后的页面」各挂载一次 g/fx.js，
 * 并插入一段防白闪的关键样式与加载遮罩。
 *
 * 这里没有任何秘密：密钥由用户输入的密码 + 公开 salt 在浏览器内
 * 用 PBKDF2 现算出来，只存在于本次会话的内存/本机存储里。
 * 没有密码，p/ 里的密文就是一堆随机字节。
 */
(function () {
  'use strict';

  var self = document.currentScript;
  var BASE = self.src.replace(/g\/gate\.js(?:\?.*)?$/, '');
  var PAGE = document.documentElement.getAttribute('data-page') || 'catalog';

  var K_SESSION = 'amz_k';
  var K_REMEMBER = 'amz_r';
  var REMEMBER_DAYS = 7;

  var $boot = document.getElementById('boot');
  var $gate = document.getElementById('gate');
  var $pw = document.getElementById('pw');
  var $go = document.getElementById('go');
  var $msg = document.getElementById('msg');
  var $rm = document.getElementById('rm');

  var meta = null;
  var busy = false;

  /* ================= 外观增强层（新增） ================= */
  var FX_SRC = BASE + 'g/fx.js?v=3';

  var CRITICAL =
    '<style id="amz-fx-critical">' +
    'html:not(.amz-light){background:#070a12!important;color-scheme:dark}' +
    '#amz-fx-veil{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;' +
    'background:radial-gradient(120% 90% at 50% -10%,#141c32 0%,#090d18 55%,#060810 100%);' +
    'transition:opacity .45s ease;color:#8490a8;' +
    'font:13px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}' +
    '#amz-fx-veil.af-gone{opacity:0;pointer-events:none}' +
    '.af-ring{width:34px;height:34px;margin:0 auto 16px;border-radius:50%;' +
    'border:2px solid rgba(255,255,255,.10);border-top-color:#8b83ff;animation:afspin .8s linear infinite}' +
    '@keyframes afspin{to{transform:rotate(360deg)}}' +
    '.af-veil-t{letter-spacing:.08em;font-size:12px}' +
    '#boot{background:rgba(7,10,18,.72)!important;backdrop-filter:blur(8px)}' +
    /* 亮度调节面板（展示用：可拉高拉低整页亮度，跨所有页面生效） */
    '#brightness-panel{position:fixed;top:50%;right:14px;transform:translateY(-50%);z-index:2147483500;' +
    'width:184px;max-height:88vh;overflow-y:auto;background:rgba(18,20,26,.92);color:#e8eaed;border:1px solid rgba(255,255,255,.16);' +
    'border-radius:14px;padding:12px 14px;box-shadow:0 10px 34px rgba(0,0,0,.5);backdrop-filter:blur(8px);' +
    'font-family:inherit;-webkit-user-select:none;user-select:none}' +
    '#brightness-panel .bp-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}' +
    '#brightness-panel .bp-title{font-size:13px;font-weight:600;letter-spacing:.3px;display:flex;align-items:center;gap:6px}' +
    '#brightness-panel .bp-toggle{cursor:pointer;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);' +
    'color:#e8eaed;border-radius:8px;width:24px;height:24px;line-height:1;font-size:15px;' +
    'display:flex;align-items:center;justify-content:center;padding:0}' +
    '#brightness-panel .bp-toggle:hover{background:rgba(255,255,255,.2)}' +
    '#brightness-panel input[type=range]{width:100%;accent-color:#ff8f3f;cursor:pointer;height:22px}' +
    '#brightness-panel .bp-val{text-align:center;font-size:12.5px;color:#a2a8b3;margin-top:4px}' +
    '#brightness-panel .bp-val b{color:#ff8f3f;font-size:15px;font-weight:700}' +
    '#brightness-panel .bp-presets{display:flex;gap:6px;margin-top:10px}' +
    '#brightness-panel .bp-presets button{flex:1;cursor:pointer;font-size:12px;padding:6px 0;border-radius:8px;' +
    'background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#e8eaed}' +
    '#brightness-panel .bp-presets button:hover{background:rgba(255,255,255,.18)}' +
    '#brightness-panel .bp-sec{margin-top:12px;padding-top:9px;border-top:1px solid rgba(255,255,255,.12);' +
    'font-size:11.5px;color:#a2a8b3;font-weight:600;letter-spacing:.5px}' +
    '#brightness-panel .bp-sec:first-child{margin-top:0;padding-top:0;border-top:none}' +
    '#brightness-panel.collapsed{width:auto;padding:8px}' +
    '#brightness-panel.collapsed .bp-head{margin-bottom:0}' +
    '#brightness-panel.collapsed .bp-title{display:none}' +
    '#brightness-panel.collapsed .bp-body{display:none}' +
    '@media (max-width:680px){#brightness-panel{top:auto;bottom:12px;right:50%;transform:translateX(50%)}}' +
    /* 底色配色（标准深色之外的三种）：白底走滤镜，纯黑/暖褐用变量覆盖，
       并接管 fx.js 的 #amz-fx-bg 装饰背景层（蓝紫渐变/光球） */
    'html.amz-c-black{--app-bg:#000!important;--card:#0a0a0b!important}' +
    'html.amz-c-black,html.amz-c-black body{background:#000!important}' +
    'html.amz-c-black #amz-fx-bg{background:#000!important}' +
    'html.amz-c-black #amz-fx-bg .af-aurora{display:none}' +
    'html.amz-c-warm{--app-bg:#211910!important;--card:#2b2214!important;--text:#ecdcb8!important;' +
    '--muted:#c4b28a!important;--hint:#ab9a76!important}' +
    'html.amz-c-warm,html.amz-c-warm body{background:#211910!important}' +
    'html.amz-c-warm #amz-fx-bg{background:linear-gradient(180deg,#2b2114 0%,#211910 48%,#150f08 100%)!important}' +
    'html.amz-c-warm #amz-fx-bg .af-aurora{display:none}' +
    '</style>';

  /* ---------- 明亮手绘涂鸦主题（一处注入，全站生效） ----------
     选择器统一用 html.amz-light（必要时叠 .amz-fx）以提高优先级，
     压过 fx.js 的深色 !important 规则；fan 明亮模式由 body 上的
     data-amz-skip-normalize 让 fx.js 停止把浅色块重刷成深色。 */
  var DOODLE = '<style id="amz-doodle">' + [
    'html.amz-light,html.amz-fx.amz-light{--dk:#2a2838;--paper:#fbf7ee;--card:#fffdf7;--card2:#fff3d6;--ink:#262438;--ink2:#6b6478;--ink3:#9a93a4;--sun:#ef6c2b;--yellow:#ffcf3f;--blue:#49b6e8;--pink:#ff87a8;--green:#43c189;--purple:#9b8bf5;--app-bg:#fbf7ee!important;--bg:#fbf7ee!important;--card:#fffdf7!important;--text:#262438!important;--muted:#6b6478!important;--hint:#8b8494!important;--border:#2a2838!important;--border-strong:#5a5566!important;--accent:#ef6c2b!important;--accent-soft:#fff3d6!important;--accent-2:#d9541f!important;--row-alt:#fff9ec!important;--ok:#237a4d!important;--warn:#9a6410!important;--bad:#a83a2c!important;--oksoft:#e4f7ec!important;--warnsoft:#fff0cf!important;--badsoft:#ffe3df!important;--soft:#fff3d6!important;--ring:rgba(239,108,43,.25)!important;--danger:#a83a2c!important;color-scheme:light!important;background:var(--paper)!important}',
    'html.amz-light body{background:transparent!important;color:var(--ink)!important}',
    'html.amz-light.amz-fx body{color:var(--ink)!important}',
    'html.amz-light #amz-fx-bg{background:radial-gradient(circle at 1px 1px,rgba(42,40,56,.06) 1px,transparent 0) 0 0/22px 22px,linear-gradient(180deg,#fdfaf2 0%,#f7f2e6 55%,#f1ebdb 100%)!important}',
    'html.amz-light #amz-fx-bg .af-aurora{opacity:.12!important}',
    'html.amz-light #amz-fx-bg .af-aurora.a1{background:#ffcf3f}',
    'html.amz-light #amz-fx-bg .af-aurora.a2{background:#49b6e8}',
    'html.amz-light #amz-fx-bg .af-aurora.a3{background:#ff87a8}',
    'html.amz-light #amz-fx-bg .af-grid{opacity:.3!important;background-image:linear-gradient(rgba(42,40,56,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(42,40,56,.05) 1px,transparent 1px)}',
    'html.amz-light #amz-fx-bg .af-spot{opacity:.2!important;mix-blend-mode:multiply}',
    'html.amz-light #amz-fx-bg .af-noise{opacity:.025!important}',
    'html.amz-light #amz-fx-bg canvas{opacity:.6!important}',
    'html.amz-light.amz-fx body,html.amz-light.amz-fx p,html.amz-light.amz-fx li,html.amz-light.amz-fx dd,html.amz-light.amz-fx dt,html.amz-light.amz-fx td,html.amz-light.amz-fx th,html.amz-light.amz-fx label,html.amz-light.amz-fx summary,html.amz-light.amz-fx h2,html.amz-light.amz-fx h3,html.amz-light.amz-fx h4,html.amz-light.amz-fx strong,html.amz-light.amz-fx b,html.amz-light.amz-fx .lead{color:var(--ink)!important}',
    'html.amz-light.amz-fx h1{color:var(--dk)!important;-webkit-text-fill-color:var(--dk)!important;text-shadow:none!important}',
    'html.amz-light.amz-fx .lead{color:var(--ink2)!important;-webkit-text-fill-color:var(--ink2)!important}',
    'html.amz-light #amz-fx-nav{background:#fffdf7!important;border:2px solid var(--dk)!important;box-shadow:3px 3px 0 rgba(42,40,56,.18)!important;border-radius:999px!important;backdrop-filter:none!important}',
    'html.amz-light #amz-fx-nav a,html.amz-light #amz-fx-nav button,html.amz-light #amz-fx-nav .af-cur,html.amz-light #amz-fx-nav .af-k{color:var(--ink)!important}',
    'html.amz-light #amz-fx-nav .af-back{background:#fff3d6!important;border:1.5px solid var(--dk)!important}',
    'html.amz-light #amz-fx-nav .af-sep{background:rgba(42,40,56,.25)!important}',
    'html.amz-light #amz-fx-scenes{background:#fffdf7!important;border:2px solid var(--dk)!important;box-shadow:4px 5px 0 rgba(42,40,56,.18)!important;backdrop-filter:none!important}',
    'html.amz-light #amz-fx-scenes .af-sc-label{color:var(--ink2)!important}',
    'html.amz-light #amz-fx-scenes button{color:var(--ink2)!important;border:1.5px solid transparent!important}',
    'html.amz-light #amz-fx-scenes button:hover{color:var(--ink)!important;background:#fff3d6!important}',
    'html.amz-light #amz-fx-scenes button.on{color:#fff!important;background:var(--sun)!important;border-color:var(--dk)!important;box-shadow:2px 2px 0 var(--dk)!important}',
    'html.amz-light #amz-fx-guide{background:#fffdf7!important;border:2px solid var(--dk)!important;box-shadow:4px 5px 0 rgba(42,40,56,.18)!important;color:var(--ink)!important;backdrop-filter:none!important}',
    'html.amz-light #amz-fx-toast{background:#fffdf7!important;border:2px solid var(--dk)!important;box-shadow:4px 5px 0 rgba(42,40,56,.18)!important;color:var(--ink)!important}',
    'html.amz-light.amz-fx small,html.amz-light.amz-fx .desc,html.amz-light.amz-fx .muted,html.amz-light.amz-fx .hint,html.amz-light.amz-fx .sub,html.amz-light.amz-fx .tag,html.amz-light.amz-fx .k,html.amz-light.amz-fx .formula{color:var(--ink2)!important}',
    'html.amz-light.amz-fx ::selection{background:rgba(255,207,63,.6);color:var(--ink)}',
    'html.amz-light .card,html.amz-light a.card,html.amz-light .mcpbox,html.amz-light .flow,html.amz-light .note,html.amz-light .step,html.amz-light .kv .box,html.amz-light .risk,html.amz-light .formula,html.amz-light .callout,html.amz-light .stats div{position:relative;background:var(--card)!important;border:2px solid var(--dk)!important;border-radius:18px 26px 20px 24px/24px 20px 26px 18px!important;box-shadow:4px 5px 0 rgba(42,40,56,.15)!important;color:var(--ink)!important}',
    'html.amz-light .grid a.card:nth-child(3n+1){border-color:var(--sun)!important}',
    'html.amz-light .grid a.card:nth-child(3n+2){border-color:var(--blue)!important}',
    'html.amz-light .grid a.card:nth-child(3n){border-color:var(--green)!important}',
    'html.amz-light.amz-fx .amz-fx-card:hover{border-color:var(--sun)!important;box-shadow:7px 9px 0 rgba(42,40,56,.22)!important}',
    'html.amz-light input,html.amz-light textarea,html.amz-light select{background:#fffdf7!important;color:var(--ink)!important;border:2px solid var(--dk)!important;border-radius:10px 14px 11px 13px/13px 11px 14px 10px!important;box-shadow:2px 2px 0 rgba(42,40,56,.1)!important}',
    'html.amz-light.amz-fx input:focus,html.amz-light.amz-fx textarea:focus,html.amz-light.amz-fx select:focus,html.amz-light input:focus,html.amz-light textarea:focus,html.amz-light select:focus{border-color:var(--sun)!important;box-shadow:2px 2px 0 var(--sun)!important}',
    'html.amz-light.amz-fx button,html.amz-light.amz-fx .btn{font-weight:700}',
    'html.amz-light button,html.amz-light .btn,html.amz-light .mcp-cp,html.amz-light .mcp-open,html.amz-light .mcp-more{border:2px solid var(--dk)!important;border-radius:12px 9px 14px 10px/10px 14px 9px 12px!important;box-shadow:3px 3px 0 var(--dk)!important;color:var(--ink)!important}',
    'html.amz-light button:active,html.amz-light .btn:active{transform:translate(2px,2px)!important;box-shadow:1px 1px 0 var(--dk)!important}',
    'html.amz-light .hero{background:linear-gradient(135deg,#fff3cf 0%,#ffe6bd 46%,#ffd9e2 100%)!important;border-bottom:3px dashed var(--sun);color:var(--ink)!important}',
    'html.amz-light.amz-fx .hero h1{color:var(--dk)!important;text-shadow:2px 3px 0 var(--yellow)!important;-webkit-text-fill-color:var(--dk)!important}',
    'html.amz-light.amz-fx .hero .lead{color:var(--ink)!important;-webkit-text-fill-color:var(--ink)!important}',
    'html.amz-light.amz-fx .hero .lead b{color:var(--sun)!important;-webkit-text-fill-color:var(--sun)!important}',
    'html.amz-light.amz-fx .hero .kicker{background:var(--yellow)!important;color:var(--dk)!important;-webkit-text-fill-color:var(--dk)!important;border:2px solid var(--dk)!important}',
    'html.amz-light .btn-p{background:var(--sun)!important;color:#fff!important;border-color:var(--dk)!important}',
    'html.amz-light.amz-fx .hero .cta .btn-o,html.amz-light .btn-o{background:#fffdf7!important;color:var(--ink)!important;-webkit-text-fill-color:var(--ink)!important;border:2px solid var(--dk)!important}',
    'html.amz-light.amz-fx .hero .stats div{background:#fffdf7!important;border-color:var(--dk)!important;box-shadow:4px 5px 0 rgba(42,40,56,.15)!important}',
    'html.amz-light.amz-fx .hero .stats span{color:var(--ink2)!important;-webkit-text-fill-color:var(--ink2)!important}',
    'html.amz-light.amz-fx .hero .stats b{color:var(--sun)!important;-webkit-text-fill-color:var(--sun)!important}',
    'html.amz-light .sect::before{content:"✦";width:auto;height:auto;background:none;color:var(--sun);font-size:17px;transform:rotate(-14deg)}',
    'html.amz-light .sect h3,html.amz-light .card h2{position:relative;display:inline-block}',
    'html.amz-light .sect h3::after,html.amz-light .card h2::after{content:"";position:absolute;left:0;bottom:-3px;width:100%;height:5px;background:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 120 6\' preserveAspectRatio=\'none\'%3E%3Cpath d=\'M2 4 Q 16 0 32 4 T 64 4 T 96 4 T 119 4\' fill=\'none\' stroke=\'%23ffcf3f\' stroke-width=\'2.5\' stroke-linecap=\'round\'/%3E%3C/svg%3E") repeat-x left bottom/100px 5px;opacity:.85;pointer-events:none}',
    'html.amz-light .tag,html.amz-light .badge{border:1.5px solid var(--dk)!important;border-radius:8px 5px 9px 6px/6px 9px 5px 8px!important;transform:rotate(-2deg);display:inline-block}',
    'html.amz-light.amz-fx .tag{background:var(--yellow)!important;color:var(--dk)!important}',
    'html.amz-light .go{color:var(--sun)!important}',
    'html.amz-light.amz-fx table,html.amz-light.amz-fx th,html.amz-light.amz-fx td{border-color:rgba(42,40,56,.16)!important}',
    'html.amz-light thead th,html.amz-light tr:first-child > th{background:#fff3d6!important}',
    'html.amz-light tbody tr:nth-child(even){background:#fff9ec!important}',
    'html.amz-light .co-info{background:#fff3d6!important;color:var(--ink)!important}',
    'html.amz-light .co-ok{background:#e4f7ec!important;color:#237a4d!important}',
    'html.amz-light .co-warn{background:#fff0cf!important;color:#9a6410!important}',
    'html.amz-light .co-bad{background:#ffe3df!important;color:#a83a2c!important}',
    'html.amz-light .ic{border:2px solid var(--dk)!important}',
    'html.amz-light .step .n{background:var(--sun)!important;color:#fff!important;border:2px solid var(--dk)}',
    'html.amz-light code{background:rgba(239,108,43,.12)!important;color:var(--sun)!important}',
    'html.amz-light hr.sep,html.amz-light .sect .line{border-color:rgba(42,40,56,.18)!important;background:rgba(42,40,56,.18)!important}',
    'html.amz-light #brightness-panel{background:#fffdf7!important;color:var(--ink)!important;border:2px solid var(--dk)!important;border-radius:15px 19px 16px 18px/18px 16px 19px 15px!important;box-shadow:4px 5px 0 rgba(42,40,56,.2)!important}',
    'html.amz-light #brightness-panel .bp-title,html.amz-light #brightness-panel .bp-val b{color:var(--sun)!important}',
    'html.amz-light #brightness-panel .bp-val,html.amz-light #brightness-panel .bp-sec{color:var(--ink2)!important}',
    'html.amz-light #brightness-panel input[type=range]{accent-color:var(--sun)!important}',
    'html.amz-light #brightness-panel .bp-toggle{background:#fff!important;color:var(--ink)!important;border-color:var(--dk)!important}',
    'html.amz-light #brightness-panel .bp-presets button{background:#fffdf7!important;color:var(--ink)!important;border:1.5px solid var(--dk)!important;border-radius:8px 6px 9px 7px/7px 9px 6px 8px!important;font-weight:600}',
    'html.amz-light #brightness-panel .bp-presets button:hover{background:var(--yellow)!important}',
    'html.amz-light #brightness-panel .bp-presets button.on{background:var(--sun)!important;color:#fff!important;border-color:var(--dk)!important}',
    'html.amz-light #gate .card{background:#fffdf7!important;border:2px solid var(--dk)!important;color:var(--ink)!important;box-shadow:5px 6px 0 rgba(42,40,56,.18)!important}',
    'html.amz-light #gate .card h1,html.amz-light #gate .card .sub,html.amz-light #gate .card label,html.amz-light #gate .card .foot{color:var(--ink)!important}',
    'html.amz-light #gate input[type=password]{background:#fff!important;color:var(--ink)!important;border:2px solid var(--dk)!important}'
  ].join('\n') + '</style>';

  var VEIL =
    '<div id="amz-fx-veil"><div style="text-align:center">' +
    '<div class="af-ring"></div><div class="af-veil-t">正在载入工作区</div>' +
    '</div></div>';

  var PANEL =
    '<div id="brightness-panel">' +
    '<div class="bp-head"><span class="bp-title">⚙ 显示设置</span>' +
    '<button id="brightness-toggle" class="bp-toggle" title="收起/展开">×</button></div>' +
    '<div class="bp-body">' +
    '<div class="bp-sec">☀ 亮度</div>' +
    '<input id="brightness-slider" type="range" min="50" max="250" step="5" value="100">' +
    '<div class="bp-val">当前 <b id="brightness-val">100%</b></div>' +
    '<div class="bp-presets">' +
    '<button data-b="70">暗</button><button data-b="100">标准</button><button data-b="160">亮</button>' +
    '</div>' +
    '<div class="bp-sec">字 体 大 小</div>' +
    '<input id="font-slider" type="range" min="100" max="200" step="5" value="100">' +
    '<div class="bp-val">当前 <b id="font-val">100%</b></div>' +
    '<div class="bp-presets">' +
    '<button data-f="100">标准</button><button data-f="120">大</button><button data-f="140">特大</button><button data-f="170">巨无霸</button>' +
    '</div>' +
    '<div class="bp-sec">主 题 风 格</div>' +
    '<div class="bp-presets">' +
    '<button data-c="doodle">✎ 涂鸦明亮</button><button data-c="">经典深色</button>' +
    '</div>' +
    '<div class="bp-sec">底 色 配 色</div>' +
    '<div class="bp-presets">' +
    '<button data-c="black">纯黑</button><button data-c="light">白底</button><button data-c="warm">暖褐</button>' +
    '</div>' +
    '<div class="bp-sec">字 体 颜 色</div>' +
    '<div class="bp-presets">' +
    '<button data-t="">默认</button><button data-t="#ffffff">纯白</button><button data-t="#ffe14d">亮黄</button><button data-t="#8fe3ff">浅青</button>' +
    '</div>' +
    '<div class="bp-sec">背 景 锦 鲤</div>' +
    '<input id="koi-slider" type="range" min="0" max="100" step="1" value="86">' +
    '<div class="bp-val">浓度 <b id="koi-val">86%</b></div>' +
    '<div class="bp-presets">' +
    '<button data-k="0">隐藏</button><button data-k="45">淡</button><button data-k="86">标准</button><button data-k="100">浓</button>' +
    '</div>' +
    '</div></div>';

  function dismissVeil() {
    var v = document.getElementById('amz-fx-veil');
    if (!v || v.className === 'af-gone') return;
    v.className = 'af-gone';
    setTimeout(function () { if (v.parentNode) v.parentNode.removeChild(v); }, 520);
  }

  /* fx.js 缺失 / 加载失败：撤掉遮罩与关键样式，页面完整回退到原版 */
  function fallback() {
    var v = document.getElementById('amz-fx-veil');
    if (v && v.parentNode) v.parentNode.removeChild(v);
    var c = document.getElementById('amz-fx-critical');
    if (c && c.parentNode) c.parentNode.removeChild(c);
  }

  function loadFx() {
    try {
      var s = document.createElement('script');
      s.src = FX_SRC + '&t=' + Date.now();
      s.async = true;
      s.onload = dismissVeil;
      s.onerror = fallback;
      document.head.appendChild(s);
      setTimeout(dismissVeil, 1600);
    } catch (e) { fallback(); }
  }

  /* 显示设置（展示用）：亮度 / 字体大小 / 底色配色 / 字体颜色，跨所有页面生效。
     亮度与配色（白底=反色滤镜）合并挂在 <html> 的 filter 上；面板自身用反向
     filter 抵消，始终保持在标准状态，避免被一起改变。 */
  var AMZ_VIEW = { b: 100, c: 'doodle' };

  function amzApplyFilter() {
    var b = (AMZ_VIEW.b / 100).toFixed(3);
    var f = AMZ_VIEW.c === 'light' ? 'invert(0.92) hue-rotate(180deg) ' : '';
    document.documentElement.style.filter = f + 'brightness(' + b + ')';
    var panel = document.getElementById('brightness-panel');
    if (panel) panel.style.filter = f + 'brightness(' + (100 / AMZ_VIEW.b).toFixed(3) + ')';
  }

  /* 明亮涂鸦主题开关：给 <html> 加 amz-light 让覆盖样式生效，
     并给 <body> 加 data-amz-skip-normalize，让 fx.js 不再把浅色块重刷成深色。
     切回深色主题时两个标记都撤掉，fx.js 恢复原样。 */
  function applyDoodle(on) {
    var h = document.documentElement;
    if (on) h.classList.add('amz-light');
    else h.classList.remove('amz-light');
    if (document.body) {
      if (on) document.body.setAttribute('data-amz-skip-normalize', '');
      else document.body.removeAttribute('data-amz-skip-normalize');
    }
  }

  function initBrightness() {
    var KEY = 'amz-brightness';
    var panel = document.getElementById('brightness-panel');
    if (!panel) return;
    var slider = document.getElementById('brightness-slider');
    var valEl = document.getElementById('brightness-val');
    var toggle = document.getElementById('brightness-toggle');
    function apply(v) {
      v = Math.max(50, Math.min(250, v));
      AMZ_VIEW.b = v;
      if (valEl) valEl.textContent = v + '%';
      amzApplyFilter();
    }
    var saved = parseFloat(localStorage.getItem(KEY));
    if (isNaN(saved)) saved = 100;
    if (slider) slider.value = saved;
    apply(saved);
    if (slider) slider.addEventListener('input', function () {
      var v = +this.value; apply(v);
      try { localStorage.setItem(KEY, v); } catch (e) {}
    });
    var presets = panel.querySelectorAll('[data-b]');
    for (var i = 0; i < presets.length; i++) {
      presets[i].addEventListener('click', function () {
        var v = +this.getAttribute('data-b');
        if (slider) slider.value = v;
        apply(v);
        try { localStorage.setItem(KEY, v); } catch (e) {}
      });
    }
    if (toggle) toggle.addEventListener('click', function () {
      var c = panel.classList.toggle('collapsed');
      toggle.textContent = c ? '⚙' : '×';
      toggle.title = c ? '展开显示设置面板' : '收起显示设置面板';
    });
  }

  /* 字体大小：直接改写页面样式表里的 font-size（以及 px 单位的 line-height），
     文字按倍率放大，盒子（卡片/按钮/表格单元格）随内容自动撑大——
     不是整页 zoom，布局不变宽，只是字与行距变大。 */
  function initFontSize() {
    var KEY = 'amz-fontscale';
    var slider = document.getElementById('font-slider');
    var valEl = document.getElementById('font-val');
    var panel = document.getElementById('brightness-panel');
    if (!panel) return;
    var factor = 1;
    var orig = typeof WeakMap === 'function' ? new WeakMap() : null;
    if (!orig) return;

    function scaled(prop, checkPx) {
      /* 逐条改写 CSSOM 规则；原始值记进 WeakMap，重复应用不会叠乘 */
      var sheets = document.styleSheets;
      for (var s = 0; s < sheets.length; s++) {
        var rules;
        try { rules = sheets[s].cssRules; } catch (e) { continue; }
        if (!rules) continue;
        (function walk(list) {
          for (var i = 0; i < list.length; i++) {
            var r = list[i];
            if (!r) continue;
            if (r.style) {
              var cur = r.style.getPropertyValue(prop);
              if (!orig.has(r)) orig.set(r, cur ? cur + '|' + r.style.getPropertyPriority(prop) : null);
              var saved0 = orig.get(r);
              if (saved0) {
                var parts = saved0.split('|');
                var val = parts[0], pri = parts[1] || '';
                var mt = val.match(/^([\d.]+)(px|pt|rem|em|%)$/);
                if (mt && !(checkPx && mt[2] !== 'px')) { /* line-height 只缩放 px 固定值 */
                  var nv = (parseFloat(mt[1]) * factor).toFixed(2) + mt[2];
                  try { r.style.setProperty(prop, nv, pri); } catch (e) {}
                }
              }
            }
            /* CSS 嵌套：递归子规则（普通规则该属性为空列表，无副作用） */
            if (r.cssRules && r.cssRules.length) walk(r.cssRules);
          }
        })(rules);
      }
    }

    function apply(v) {
      factor = Math.max(100, Math.min(200, v)) / 100;
      scaled('font-size', false);
      scaled('line-height', true);
      if (valEl) valEl.textContent = v + '%';
    }
    var saved = parseFloat(localStorage.getItem(KEY));
    if (isNaN(saved)) saved = 100;
    if (slider) slider.value = saved;
    apply(saved);
    if (slider) slider.addEventListener('input', function () {
      var v = +this.value; apply(v);
      try { localStorage.setItem(KEY, v); } catch (e) {}
    });
    var presets = panel.querySelectorAll('[data-f]');
    for (var i = 0; i < presets.length; i++) {
      presets[i].addEventListener('click', function () {
        var v = +this.getAttribute('data-f');
        if (slider) slider.value = v;
        apply(v);
        try { localStorage.setItem(KEY, v); } catch (e) {}
      });
    }
  }

  /* 主题 / 配色：doodle(默认,手绘明亮) / 经典深色 / 纯黑 / 白底(反色滤镜) / 暖褐 */
  function initBgScheme() {
    var KEY = 'amz-color';
    var panel = document.getElementById('brightness-panel');
    if (!panel) return;
    function apply(v) {
      AMZ_VIEW.c = v;
      var h = document.documentElement;
      h.classList.remove('amz-c-black', 'amz-c-light', 'amz-c-warm');
      if (v && v !== 'doodle') h.classList.add('amz-c-' + v);
      applyDoodle(v === 'doodle');   /* doodle 走独立覆盖样式，其余走 fx 变量/滤镜 */
      /* 旧配色(纯黑/白底/暖褐)彼此互斥，用于经典深色主题下的微调 */
      amzApplyFilter();
      var presets = panel.querySelectorAll('[data-c]');
      for (var j = 0; j < presets.length; j++) {
        presets[j].classList.toggle('on', presets[j].getAttribute('data-c') === v);
      }
    }
    var saved = localStorage.getItem(KEY);
    if (saved === null || saved === '') saved = 'doodle';  /* 默认明亮涂鸦 */
    apply(saved);
    var presets = panel.querySelectorAll('[data-c]');
    for (var i = 0; i < presets.length; i++) {
      presets[i].addEventListener('click', function () {
        var v = this.getAttribute('data-c');
        apply(v);
        try { localStorage.setItem(KEY, v); } catch (e) {}
      });
    }
  }

  /* 字体颜色：整体覆盖正文文字颜色（面板自身除外） */
  function initTextColor() {
    var KEY = 'amz-textcolor';
    var panel = document.getElementById('brightness-panel');
    if (!panel) return;
    var tag = document.getElementById('amz-tc-style');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'amz-tc-style';
      document.head.appendChild(tag);
    }
    function apply(v) {
      tag.textContent = v
        ? 'html[data-amz-tc="1"] body *:not(#brightness-panel):not(#brightness-panel *){color:' + v + '!important}'
        : '';
      if (v) document.documentElement.setAttribute('data-amz-tc', '1');
      else document.documentElement.removeAttribute('data-amz-tc');
    }
    var saved = localStorage.getItem(KEY) || '';
    apply(saved);
    var presets = panel.querySelectorAll('[data-t]');
    for (var i = 0; i < presets.length; i++) {
      presets[i].addEventListener('click', function () {
        var v = this.getAttribute('data-t');
        apply(v);
        try { localStorage.setItem(KEY, v); } catch (e) {}
      });
    }
  }
  /* 滚轮守卫：Chrome 的 range 滑块在鼠标悬停时会被滚轮直接改值
     （不需要点击/拖动），用户滚动页面路过面板就会误改亮度/字号。
     这里拦截滑块上的滚轮：滑块保持不动，滚轮改为滚动面板或整页。 */
  function initSliderWheelGuard() {
    var panel = document.getElementById('brightness-panel');
    if (!panel) return;
    var inputs = panel.querySelectorAll('input[type=range]');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener('wheel', function (e) {
        if (e.ctrlKey) return; /* 保留 Ctrl+滚轮 浏览器缩放 */
        e.preventDefault();
        e.stopPropagation();
        var d = e.deltaY;
        if (panel.scrollHeight > panel.clientHeight + 2) {
          panel.scrollTop += d;
        } else {
          window.scrollBy(0, d);
        }
      }, { passive: false });
    }
  }
  /* 背景锦鲤浓度：写 window.__amzKoiAlpha（0–1），fx.js 每帧读取，实时生效 */
  function initKoiAlpha() {
    var KEY = 'amz-koi-alpha';
    var panel = document.getElementById('brightness-panel');
    if (!panel) return;
    var slider = document.getElementById('koi-slider');
    var valEl = document.getElementById('koi-val');
    function apply(v) {
      v = Math.max(0, Math.min(100, v));
      window.__amzKoiAlpha = v / 100;
      if (valEl) valEl.textContent = v + '%';
      if (slider) slider.value = v;
    }
    var saved = parseFloat(localStorage.getItem(KEY));
    if (isNaN(saved)) saved = 86;
    apply(saved);
    if (slider) slider.addEventListener('input', function () {
      apply(+this.value);
      try { localStorage.setItem(KEY, +this.value); } catch (e) {}
    });
    var presets = panel.querySelectorAll('[data-k]');
    for (var i = 0; i < presets.length; i++) {
      presets[i].addEventListener('click', function () {
        var v = +this.getAttribute('data-k');
        apply(v);
        try { localStorage.setItem(KEY, v); } catch (e) {}
      });
    }
  }
  /* ==================================================== */

  /* ---------- 编码工具 ---------- */
  function b64ToBuf(s) {
    var bin = atob(s);
    var u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function bufToB64(buf) {
    var u = new Uint8Array(buf);
    var s = '';
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }

  /* ---------- 提示 ---------- */
  function say(text, kind) {
    if (!$msg) return;
    $msg.textContent = text || '';
    $msg.className = 'msg' + (kind ? ' ' + kind : '');
  }
  function showForm(text) {
    if ($boot) $boot.classList.add('hide');
    if ($gate) $gate.style.display = '';
    if (text) say(text, 'err');
    setTimeout(function () { if ($pw) $pw.focus(); }, 60);
  }
  function setBusy(on, label) {
    busy = on;
    if ($go) {
      $go.disabled = on;
      $go.textContent = on ? (label || '正在解密…') : '进入工具箱';
    }
    if ($pw) $pw.disabled = on;
  }

  /* ---------- 存储 ---------- */
  var cache = {
    get: function () {
      try {
        var s = sessionStorage.getItem(K_SESSION);
        if (s) return s;
        var r = localStorage.getItem(K_REMEMBER);
        if (r) {
          var o = JSON.parse(r);
          if (o && o.k && o.exp > Date.now()) return o.k;
          localStorage.removeItem(K_REMEMBER);
        }
      } catch (e) {}
      return null;
    },
    set: function (kb64, remember) {
      try { sessionStorage.setItem(K_SESSION, kb64); } catch (e) {}
      if (remember) {
        try {
          localStorage.setItem(K_REMEMBER, JSON.stringify({
            k: kb64,
            exp: Date.now() + REMEMBER_DAYS * 864e5
          }));
        } catch (e) {}
      }
    },
    clear: function () {
      try { sessionStorage.removeItem(K_SESSION); } catch (e) {}
      try { localStorage.removeItem(K_REMEMBER); } catch (e) {}
    }
  };

  /* ---------- 密码学 ---------- */
  function importKey(kb64) {
    return crypto.subtle.importKey('raw', b64ToBuf(kb64), { name: 'AES-GCM' }, false, ['decrypt']);
  }

  function deriveKey(password) {
    var enc = new TextEncoder();
    return crypto.subtle
      .importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (km) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: b64ToBuf(meta.salt), iterations: meta.iter, hash: 'SHA-256' },
          km,
          { name: 'AES-GCM', length: 256 },
          true,                 // 可导出：为了在会话内缓存派生结果，避免每次翻页重算
          ['encrypt', 'decrypt']
        );
      });
  }

  function decryptBuf(buf, key) {
    var bytes = new Uint8Array(buf);
    var iv = bytes.subarray(0, 12);
    var ct = bytes.subarray(12);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
  }

  function getEnc(name) {
    return fetch(BASE + 'p/' + name + '.enc', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('E_FETCH');
      return r.arrayBuffer();
    });
  }

  /* ---------- 主题偏好 ---------- */
  function savedTheme() {
    var v = '';
    try { v = localStorage.getItem('amz-color') || ''; } catch (e) {}
    return (v === '') ? 'doodle' : v;   /* 默认手绘明亮 */
  }

  /* 把主题标记直接印进 HTML 字符串：首帧即生效，且 fx.js 初始化时
     body 上已有 data-amz-skip-normalize，不会再重刷浅色块。 */
  function stampTheme(html, theme) {
    var doodle = (theme === 'doodle');
    if (doodle) {
      if (/<html([^>]*)>/i.test(html)) {
        html = html.replace(/<html([^>]*)>/i, function (m, attrs) {
          if (/\bclass\s*=/.test(attrs)) {
            return m.replace(/class\s*=\s*"([^"]*)"/i, function (mm, c) {
              return 'class="' + c + ' amz-light"';
            });
          }
          return '<html' + attrs + ' class="amz-light">';
        });
      }
      if (/<body([^>]*)>/i.test(html)) {
        html = html.replace(/<body([^>]*)>/i, function (m, attrs) {
          return '<body' + attrs + ' data-amz-skip-normalize';
        });
      }
    }
    return html;
  }

  /* ---------- 渲染 ---------- */
  function render(html) {
    // document.open() 保留当前 URL，写回后页面内相对路径、脚本都照常工作
    setTimeout(function () {
      html = stampTheme(html, savedTheme());
      // 防白闪：把关键样式与加载遮罩写进新文档，解析第一帧即为目标主题
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, function (m) { return m + CRITICAL + DOODLE; });
      } else {
        html = CRITICAL + DOODLE + html;
      }
      if (/<body[^>]*>/i.test(html)) {
        html = html.replace(/<body[^>]*>/i, function (m) { return m + VEIL + PANEL; });
      } else {
        html = PANEL + html;
      }
      document.open();
      document.write(html);
      document.close();
      // document.open() 会清空上一个文档的所有脚本 → 重新挂载增强层
      loadFx();
      initBrightness();
      initFontSize();
      initBgScheme();
      initTextColor();
      initSliderWheelGuard();
      initKoiAlpha();
    }, 0);
  }

  /* ---------- 多密码：先试主密码，再试备用密码本 ----------
     备用密码本里的每个条目，都是用该密码派生出的密钥包裹的「主密钥」。
     解包成功后必须缓存/使用主密钥本身，否则后续翻页解不开。 */
  function resolvePassword(pw) {
    return deriveKey(pw).then(function (key) {
      return getEnc('v')
        .then(function (buf) { return decryptBuf(buf, key); })
        .then(function () {
          return crypto.subtle.exportKey('raw', key).then(function (raw) {
            return { key: key, kb64: bufToB64(raw) };
          });
        })
        .catch(function (err) {
          if (err && err.message === 'E_FETCH') throw err;
          return tryBook(key, err);
        });
    });
  }

  function tryBook(key, originalErr) {
    return fetch(BASE + 'p/keys.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw originalErr;
        return r.json();
      })
      .then(function (book) {
        var items = book && book.items;
        if (!items || !items.length) throw originalErr;
        var i = 0;
        function next() {
          if (i >= items.length) throw originalErr;
          var it = items[i++];
          return crypto.subtle
            .decrypt({ name: 'AES-GCM', iv: b64ToBuf(it.iv) }, key, b64ToBuf(it.ct))
            .then(function (raw) {
              return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
            })
            .then(function (master) {
              return getEnc('v')
                .then(function (buf) { return decryptBuf(buf, master); })
                .then(function () {
                  return crypto.subtle.exportKey('raw', master).then(function (raw) {
                    return { key: master, kb64: bufToB64(raw) };
                  });
                });
            })
            .catch(function () { return next(); });
        }
        return next();
      });
  }

  /* ---------- 主流程 ---------- */
  function unlock(key, kb64) {
    return getEnc('v')
      .then(function (buf) { return decryptBuf(buf, key); })
      .then(function () { return getEnc(PAGE); })
      .then(function (buf) { return decryptBuf(buf, key); })
      .then(function (plain) {
        if (kb64) cache.set(kb64, $rm && $rm.checked);
        render(new TextDecoder().decode(plain));
      });
  }

  function boot() {
    if (!(window.crypto && crypto.subtle)) {
      showForm('当前环境不支持 Web Crypto，请用 https 打开（或换 Chrome / Edge / Safari 新版）。');
      return;
    }

    fetch(BASE + 'p/m.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (m) {
        meta = m;
        var kb64 = cache.get();
        if (!kb64) return showForm();

        var keyRef;
        return importKey(kb64)
          .then(function (k) {
            keyRef = k;
            return getEnc('v').then(function (b) { return decryptBuf(b, k); });
          })
          .then(function () { return unlock(keyRef, null); })
          .catch(function () {
            // 缓存失效（换了密码 / 换了构建）→ 清掉缓存重新输密码
            cache.clear();
            showForm('访问凭据已更新，请重新输入密码。');
          });
      })
      .catch(function () {
        showForm('站点数据加载失败，请刷新重试（或检查网络 / 离线缓存）。');
      });
  }

  /* ---------- 登录 ---------- */
  function submit() {
    if (busy) return;
    var pw = $pw ? $pw.value : '';
    if (!pw) { say('请输入密码。', 'err'); if ($pw) $pw.focus(); return; }

    setBusy(true, '正在解密…');
    say('');

    var t0 = Date.now();
    resolvePassword(pw)
      .then(function (r) {
        // 密码正确：给出一点反馈，避免 600k 次迭代像卡死
        if (Date.now() - t0 < 250) {
          return new Promise(function (res) { setTimeout(function () { res(r); }, 250); });
        }
        return r;
      })
      .then(function (r) { return unlock(r.key, r.kb64); })
      .catch(function (err) {
        setBusy(false);
        say(
          err && err.message === 'E_FETCH'
            ? '密文分片缺失，站点可能未完整上传。'
            : '密码不正确。',
          'err'
        );
        if ($pw) { $pw.value = ''; $pw.focus(); }
      });
  }

  if ($go) $go.addEventListener('click', submit);
  if ($pw) $pw.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') submit();
  });

  /* 门禁页（未解密）也同步主题：注入涂鸦样式并标记跳过重刷。
     内容页由 render()/stampTheme() 处理，两条路径互不干扰。 */
  (function initGateTheme() {
    if (savedTheme() !== 'doodle') return;
    var h = document.documentElement;
    h.classList.add('amz-light');
    if (document.body) document.body.setAttribute('data-amz-skip-normalize', '');
    var st = document.createElement('style');
    st.textContent = DOODLE.replace(/^<style[^>]*>/i, '').replace(/<\/style>\s*$/i, '');
    document.head.appendChild(st);
  })();

  loadFx();   // 门禁页也使用同一套视觉
  boot();
})();
