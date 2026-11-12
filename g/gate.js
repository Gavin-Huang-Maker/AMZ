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

  /* ================= 扩展主题引擎（6 套艺术风格） =================
     思路：复用 doodle 的结构层（amz-light 类带来的描边/圆角/fx 覆盖），
     每套主题只重定义 CSS 变量 + 被 DOODLE 写死的色值 + 少量专属效果。
     这样新增一套风格只需往 THEME_DEFS 加一条，且 doodle 本身零改动。 */
  var THEME_DEFS = {
    neon: {
      name: '霓虹赛博', dark: true,
      paper: '#0b0f2b', bg: 'radial-gradient(120% 90% at 50% -8%,#1b1040 0%,#0b0f2b 52%,#07091c 100%)',
      card: 'rgba(18,22,48,.84)', card2: 'rgba(34,211,238,.10)', hero: 'linear-gradient(135deg,#1b1040 0%,#0b2540 52%,#2a0f3a 100%)',
      ink: '#cfe9ff', ink2: '#93a9d6', ink3: '#6c80b0', dk: '#7df9ff', accent: '#22d3ee', accent2: '#ff3df5',
      yellow: 'rgba(255,61,245,.20)', c1: '#22d3ee', c2: '#ff3df5', c3: '#39f5b0',
      line: 'rgba(34,211,238,.55)', shadow: 'rgba(34,211,238,.28)', radius: '10px 14px 11px 13px/13px 11px 14px 10px',
      iradius: '9px 12px 10px 11px/11px 10px 12px 9px', bradius: '8px', tradius: '7px',
      thead: 'rgba(34,211,238,.16)', alt: 'rgba(34,211,238,.05)', u: '22d3ee', h1s: '0 0 16px rgba(34,211,238,.6)',
      ok: '#39f5b0', warn: '#ffcf6b', bad: '#ff6b9d', oks: 'rgba(57,245,176,.12)', warns: 'rgba(255,207,107,.12)', bads: 'rgba(255,107,157,.12)',
      extras: [
        'S .card,S a.card,S .mcpbox,S .flow,S .note,S .step,S .kv .box,S .risk,S .formula,S .callout,S .stats div,S #gate .card{box-shadow:0 0 0 1px rgba(34,211,238,.28),0 0 24px rgba(34,211,238,.12)!important}',
        'S button,S .btn,S .mcp-cp,S .mcp-open,S .mcp-more{box-shadow:0 0 0 1px rgba(34,211,238,.5),0 0 14px rgba(34,211,238,.28)!important}',
        'SF .hero h1{text-shadow:' + '0 0 16px rgba(34,211,238,.6)' + '!important}',
        'SF .hero .stats b{text-shadow:0 0 12px rgba(34,211,238,.6)!important}'
      ]
    },
    glass: {
      name: '毛玻璃', dark: false,
      paper: '#eef3fb', bg: 'radial-gradient(42% 52% at 12% 8%,#cfe8ff 0%,transparent 62%),radial-gradient(38% 48% at 88% 18%,#f7d6ff 0%,transparent 62%),radial-gradient(48% 46% at 50% 94%,#a7f3d0 0%,transparent 62%),linear-gradient(180deg,#f8fbff 0%,#eef3fb 100%)',
      card: 'rgba(255,255,255,.58)', card2: 'rgba(207,232,255,.38)', hero: 'linear-gradient(135deg,rgba(207,232,255,.7) 0%,rgba(247,214,255,.6) 50%,rgba(167,243,208,.65) 100%)',
      ink: '#26384b', ink2: '#5a6b7e', ink3: '#8695a6', dk: '#2a3a5c', accent: '#6c63e8', accent2: '#4f46c7',
      yellow: 'rgba(199,210,254,.62)', c1: '#68b6f0', c2: '#e88ac0', c3: '#4fc8a0',
      line: 'rgba(255,255,255,.9)', shadow: 'rgba(60,80,120,.16)', radius: '18px', iradius: '14px', bradius: '12px', tradius: '10px',
      thead: 'rgba(108,99,232,.10)', alt: 'rgba(255,255,255,.35)', u: '8b7ff0', h1s: 'none',
      ok: '#237a4d', warn: '#9a6410', bad: '#a83a2c', oks: 'rgba(36,122,77,.10)', warns: 'rgba(154,100,16,.10)', bads: 'rgba(168,58,44,.10)',
      extras: [
        'S .card,S a.card,S .mcpbox,S .flow,S .note,S .step,S .kv .box,S .risk,S .formula,S .callout,S .stats div,S #amz-fx-nav,S #amz-fx-scenes,S #amz-fx-guide,S #brightness-panel,S #gate .card{backdrop-filter:blur(16px) saturate(1.4)!important;-webkit-backdrop-filter:blur(16px) saturate(1.4)!important;border:1px solid rgba(255,255,255,.92)!important;box-shadow:0 10px 34px rgba(60,80,120,.16)!important}',
        'S input,S textarea,S select{backdrop-filter:blur(8px)!important;-webkit-backdrop-filter:blur(8px)!important;background:rgba(255,255,255,.62)!important}',
        'S #amz-fx-bg .af-aurora{opacity:.5!important}'
      ]
    },
    qinghua: {
      name: '青花瓷', dark: false,
      paper: '#f7f9fc', bg: 'linear-gradient(rgba(43,95,168,.045) 1px,transparent 1px) 0 0/28px 28px,linear-gradient(90deg,rgba(43,95,168,.045) 1px,transparent 1px) 0 0/28px 28px,linear-gradient(180deg,#fbfdff 0%,#eef4fb 100%)',
      card: '#ffffff', card2: '#eaf2fb', hero: 'linear-gradient(135deg,#eaf2fb 0%,#dceafa 48%,#f2f7fd 100%)',
      ink: '#1c3352', ink2: '#4a6584', ink3: '#8095ac', dk: '#2b5fa8', accent: '#2b5fa8', accent2: '#1d4479',
      yellow: '#dbe9f7', c1: '#2b5fa8', c2: '#8fb3d9', c3: '#4a8f7a',
      line: 'rgba(43,95,168,.34)', shadow: 'rgba(43,95,168,.12)', radius: '6px', iradius: '6px', bradius: '5px', tradius: '4px',
      thead: '#eaf2fb', alt: '#f5f9fe', u: '2b5fa8', h1s: 'none',
      ok: '#237a4d', warn: '#9a6410', bad: '#a83a2c', oks: '#e4f7ec', warns: '#fff0cf', bads: '#ffe3df',
      extras: [
        'S .card,S a.card,S .mcpbox,S .flow,S .note,S .step,S .kv .box,S .risk,S .formula,S .callout,S .stats div,S #gate .card{border:1px solid rgba(43,95,168,.32)!important;box-shadow:0 2px 0 rgba(43,95,168,.10)!important}',
        'S h1,S h2,S h3,S .hero h1,S #gate .card h1{font-family:"Songti SC","STSong","Noto Serif SC",Georgia,serif!important;letter-spacing:.04em}',
        'S #amz-fx-bg .af-grid{opacity:.7!important}'
      ]
    },
    macaron: {
      name: '奶油马卡龙', dark: false,
      paper: '#fffafc', bg: 'radial-gradient(38% 46% at 18% 8%,#ffe4e6 0%,transparent 66%),radial-gradient(36% 44% at 84% 18%,#e0e7ff 0%,transparent 66%),radial-gradient(42% 44% at 50% 96%,#fef3c7 0%,transparent 66%),linear-gradient(180deg,#fffafc 0%,#fdf7f2 100%)',
      card: '#ffffff', card2: '#fff0f5', hero: 'linear-gradient(135deg,#ffe4e6 0%,#e0e7ff 50%,#fef3c7 100%)',
      ink: '#4a3f52', ink2: '#7c7086', ink3: '#a89db0', dk: '#b0567a', accent: '#e8799f', accent2: '#cf5f88',
      yellow: '#ffe0ec', c1: '#8fb8f0', c2: '#e8799f', c3: '#7ac9a6',
      line: 'rgba(224,121,159,.34)', shadow: 'rgba(180,110,140,.16)', radius: '24px', iradius: '18px', bradius: '16px', tradius: '12px',
      thead: '#ffeef4', alt: '#fff8fa', u: 'e8799f', h1s: 'none',
      ok: '#2f9160', warn: '#a5741c', bad: '#c04a5a', oks: '#e6f7ee', warns: '#fff3da', bads: '#ffe8ea',
      extras: [
        'S .card,S a.card,S .mcpbox,S .flow,S .note,S .step,S .kv .box,S .risk,S .formula,S .callout,S .stats div,S #gate .card{border:1.5px solid rgba(224,121,159,.3)!important;box-shadow:0 8px 24px rgba(180,110,140,.16)!important}',
        'S .grid a.card:nth-child(3n+1){border-color:#e8799f!important}S .grid a.card:nth-child(3n+2){border-color:#8fb8f0!important}S .grid a.card:nth-child(3n){border-color:#7ac9a6!important}'
      ]
    },
    spring: {
      name: '春日樱绿', dark: false,
      paper: '#f8fdf4', bg: 'radial-gradient(42% 50% at 14% 6%,#eaf7d9 0%,transparent 62%),radial-gradient(36% 44% at 86% 16%,#f7c6d9 0%,transparent 62%),linear-gradient(180deg,#f8fdf4 0%,#f1f9ea 100%)',
      card: '#ffffff', card2: '#f0f9e8', hero: 'linear-gradient(135deg,#eaf7d9 0%,#d9f0e0 46%,#f7c6d9 100%)',
      ink: '#2f4a2a', ink2: '#5f7a55', ink3: '#93a889', dk: '#3f6b34', accent: '#7aa85c', accent2: '#5f8f45',
      yellow: '#fde6ef', c1: '#6bb8d8', c2: '#e88fb0', c3: '#7aa85c',
      line: 'rgba(122,168,92,.4)', shadow: 'rgba(90,130,70,.14)', radius: '16px', iradius: '12px', bradius: '11px', tradius: '9px',
      thead: '#eef8e6', alt: '#f8fcf4', u: '7aa85c', h1s: 'none',
      ok: '#237a4d', warn: '#9a6410', bad: '#a83a2c', oks: '#e4f7ec', warns: '#fff0cf', bads: '#ffe3df',
      extras: [
        'S .card,S a.card,S .mcpbox,S .flow,S .note,S .step,S .kv .box,S .risk,S .formula,S .callout,S .stats div,S #gate .card{border:1.5px solid rgba(122,168,92,.4)!important;box-shadow:0 6px 20px rgba(90,130,70,.14)!important}',
        'S .grid a.card:nth-child(3n+1){border-color:#7aa85c!important}S .grid a.card:nth-child(3n+2){border-color:#e88fb0!important}S .grid a.card:nth-child(3n){border-color:#6bb8d8!important}'
      ]
    },
    bamboo: {
      name: '竹林青', dark: false,
      paper: '#f6f9f0', bg: 'repeating-linear-gradient(90deg,rgba(107,143,94,.05) 0 2px,transparent 2px 48px),linear-gradient(180deg,#f6f9f0 0%,#eef4e6 100%)',
      card: '#fbfdf8', card2: '#eef5e6', hero: 'linear-gradient(135deg,#eef5e6 0%,#dfeade 48%,#f3f7ee 100%)',
      ink: '#2e3d2a', ink2: '#5a6b50', ink3: '#89967d', dk: '#3d5a3a', accent: '#5d804f', accent2: '#46683b',
      yellow: '#e6efd8', c1: '#6f9a9a', c2: '#b98f8f', c3: '#5d804f',
      line: 'rgba(93,128,79,.36)', shadow: 'rgba(70,100,60,.14)', radius: '10px', iradius: '9px', bradius: '8px', tradius: '7px',
      thead: '#eef5e6', alt: '#f7fbf3', u: '5d804f', h1s: 'none',
      ok: '#237a4d', warn: '#9a6410', bad: '#a83a2c', oks: '#e4f7ec', warns: '#fff0cf', bads: '#ffe3df',
      extras: [
        'S .card,S a.card,S .mcpbox,S .flow,S .note,S .step,S .kv .box,S .risk,S .formula,S .callout,S .stats div,S #gate .card{border:1px solid rgba(93,128,79,.32)!important;box-shadow:0 3px 0 rgba(93,128,79,.10)!important}',
        'S h1,S h2,S h3,S .hero h1{font-family:"Songti SC","STSong","Noto Serif SC",Georgia,serif!important;letter-spacing:.03em}'
      ]
    }
  };

  function buildThemeStyles() {
    var blocks = [];
    Object.keys(THEME_DEFS).forEach(function (id) {
      var T = THEME_DEFS[id];
      var S = 'html.amz-light.amz-' + id;
      var F = 'html.amz-light.amz-' + id + '.amz-fx';
      var r = [];
      r.push(S + '{--dk:' + T.dk + '!important;--paper:' + T.paper + '!important;--card:' + T.card + '!important;--card2:' + T.card2 + '!important;' +
        '--ink:' + T.ink + '!important;--ink2:' + T.ink2 + '!important;--ink3:' + T.ink3 + '!important;' +
        '--sun:' + T.accent + '!important;--yellow:' + T.yellow + '!important;--blue:' + T.c1 + '!important;--pink:' + T.c2 + '!important;' +
        '--green:' + T.c3 + '!important;--purple:' + T.accent + '!important;' +
        '--app-bg:' + T.paper + '!important;--bg:' + T.paper + '!important;--text:' + T.ink + '!important;' +
        '--muted:' + T.ink2 + '!important;--hint:' + T.ink3 + '!important;--border:' + T.line + '!important;--border-strong:' + T.dk + '!important;' +
        '--accent:' + T.accent + '!important;--accent-soft:' + T.card2 + '!important;--accent-2:' + T.accent2 + '!important;' +
        '--row-alt:' + T.alt + '!important;--ok:' + T.ok + '!important;--warn:' + T.warn + '!important;--bad:' + T.bad + '!important;' +
        '--oksoft:' + T.oks + '!important;--warnsoft:' + T.warns + '!important;--badsoft:' + T.bads + '!important;' +
        '--soft:' + T.card2 + '!important;--ring:' + T.line + '!important;--danger:' + T.bad + '!important;' +
        'color-scheme:' + (T.dark ? 'dark' : 'light') + '!important;background:' + T.paper + '!important}');
      r.push(S + ' #amz-fx-bg{background:' + T.bg + '!important}');
      r.push(S + ' #amz-fx-bg .af-aurora.a1{background:' + T.c1 + '!important}');
      r.push(S + ' #amz-fx-bg .af-aurora.a2{background:' + T.c2 + '!important}');
      r.push(S + ' #amz-fx-bg .af-aurora.a3{background:' + T.c3 + '!important}');
      r.push(F + ' body,F p,F li,F dd,F dt,F td,F th,F label,F summary,F h2,F h3,F h4,F strong,F b,F .lead{color:' + T.ink + '!important}');
      r.push(F + ' h1{color:' + T.dk + '!important;-webkit-text-fill-color:' + T.dk + '!important;text-shadow:' + T.h1s + '!important}');
      r.push(F + ' .lead{color:' + T.ink2 + '!important;-webkit-text-fill-color:' + T.ink2 + '!important}');
      r.push(F + ' small,F .desc,F .muted,F .hint,F .sub,F .tag,F .k,F .formula{color:' + T.ink2 + '!important}');
      r.push(S + ' #amz-fx-nav{background:' + T.card + '!important;border:1.5px solid ' + T.line + '!important;box-shadow:0 4px 18px ' + T.shadow + '!important;border-radius:999px!important;backdrop-filter:none!important}');
      r.push(S + ' #amz-fx-nav a,S #amz-fx-nav button,S #amz-fx-nav .af-cur,S #amz-fx-nav .af-k{color:' + T.ink + '!important}');
      r.push(S + ' #amz-fx-nav .af-back{background:' + T.card2 + '!important;border:1px solid ' + T.line + '!important}');
      r.push(S + ' #amz-fx-scenes,S #amz-fx-guide,S #amz-fx-toast{background:' + T.card + '!important;border:1px solid ' + T.line + '!important;box-shadow:0 6px 22px ' + T.shadow + '!important;color:' + T.ink + '!important;backdrop-filter:none!important}');
      r.push(S + ' #amz-fx-scenes .af-sc-label,S #amz-fx-scenes button{color:' + T.ink2 + '!important}');
      r.push(S + ' #amz-fx-scenes button.on{color:#fff!important;background:' + T.accent + '!important;border-color:' + T.accent + '!important;box-shadow:none!important}');
      r.push(S + ' .card,S a.card,S .mcpbox,S .flow,S .note,S .step,S .kv .box,S .risk,S .formula,S .callout,S .stats div{background:' + T.card + '!important;border:1.5px solid ' + T.line + '!important;border-radius:' + T.radius + '!important;box-shadow:0 4px 16px ' + T.shadow + '!important;color:' + T.ink + '!important}');
      r.push(S + ' .grid a.card:nth-child(3n+1){border-color:' + T.c1 + '!important}S .grid a.card:nth-child(3n+2){border-color:' + T.c2 + '!important}S .grid a.card:nth-child(3n){border-color:' + T.c3 + '!important}');
      r.push(S + ' input,S textarea,S select{background:' + T.card + '!important;color:' + T.ink + '!important;border:1.5px solid ' + T.line + '!important;border-radius:' + T.iradius + '!important;box-shadow:none!important}');
      r.push(F + ' input:focus,F textarea:focus,F select:focus,S input:focus,S textarea:focus,S select:focus{border-color:' + T.accent + '!important;box-shadow:0 0 0 3px ' + T.line + '!important}');
      r.push(S + ' button,S .btn,S .mcp-cp,S .mcp-open,S .mcp-more{border:1.5px solid ' + T.accent + '!important;border-radius:' + T.bradius + '!important;box-shadow:none!important;color:' + T.ink + '!important}');
      r.push(S + ' button:active,S .btn:active{transform:translateY(1px)!important}');
      r.push(S + ' .hero{background:' + T.hero + '!important;border-bottom:2px solid ' + T.accent + '!important;color:' + T.ink + '!important}');
      r.push(F + ' .hero h1{color:' + T.dk + '!important;-webkit-text-fill-color:' + T.dk + '!important}');
      r.push(F + ' .hero .lead,F .hero .lead b{color:' + T.ink + '!important;-webkit-text-fill-color:' + T.ink + '!important}');
      r.push(F + ' .hero .kicker{background:' + T.yellow + '!important;color:' + T.dk + '!important;-webkit-text-fill-color:' + T.dk + '!important;border:1px solid ' + T.accent + '!important}');
      r.push(S + ' .btn-p{background:' + T.accent + '!important;color:#fff!important;border-color:' + T.accent + '!important}');
      r.push(F + ' .hero .cta .btn-o,S .btn-o{background:' + T.card + '!important;color:' + T.ink + '!important;-webkit-text-fill-color:' + T.ink + '!important;border:1.5px solid ' + T.line + '!important}');
      r.push(S + ' .stats div{background:' + T.card + '!important;border-color:' + T.line + '!important;box-shadow:0 4px 16px ' + T.shadow + '!important}');
      /* DOODLE 对 .hero .stats div 用了 (0,4,1)，这里同结构 + amz-<id> 抬到 (0,5,1) 压过 */
      r.push(S + '.amz-fx .hero .stats div{background:' + T.card + '!important;border-color:' + T.line + '!important;box-shadow:0 4px 16px ' + T.shadow + '!important}');
      r.push(F + ' .hero .stats span{color:' + T.ink2 + '!important;-webkit-text-fill-color:' + T.ink2 + '!important}');
      r.push(F + ' .hero .stats b{color:' + T.accent + '!important;-webkit-text-fill-color:' + T.accent + '!important}');
      r.push(S + ' .sect::before{content:"✦";width:auto;height:auto;background:none;color:' + T.accent + ';font-size:17px;transform:rotate(-14deg)}');
      r.push(S + ' .sect h3,S .card h2{position:relative;display:inline-block}');
      r.push(S + ' .sect h3::after,S .card h2::after{content:"";position:absolute;left:0;bottom:-3px;width:100%;height:5px;background:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 120 6\' preserveAspectRatio=\'none\'%3E%3Cpath d=\'M2 4 Q 16 0 32 4 T 64 4 T 96 4 T 119 4\' fill=\'none\' stroke=\'%23' + T.u + '\' stroke-width=\'2.5\' stroke-linecap=\'round\'/%3E%3C/svg%3E") repeat-x left bottom/100px 5px;opacity:.85;pointer-events:none}');
      r.push(S + ' .tag,S .badge{border:1.5px solid ' + T.line + '!important;border-radius:' + T.tradius + '!important;display:inline-block}');
      r.push(F + ' .tag{background:' + T.yellow + '!important;color:' + T.dk + '!important}');
      r.push(S + ' .go{color:' + T.accent + '!important}');
      r.push(F + ' table,F th,F td{border-color:' + T.line + '!important}');
      r.push(S + ' thead th,S tr:first-child > th{background:' + T.thead + '!important}');
      r.push(S + ' tbody tr:nth-child(even){background:' + T.alt + '!important}');
      r.push(S + ' .co-info{background:' + T.card2 + '!important;color:' + T.ink + '!important}');
      r.push(S + ' .co-ok{background:' + T.oks + '!important;color:' + T.ok + '!important}');
      r.push(S + ' .co-warn{background:' + T.warns + '!important;color:' + T.warn + '!important}');
      r.push(S + ' .co-bad{background:' + T.bads + '!important;color:' + T.bad + '!important}');
      r.push(S + ' .ic{border:1.5px solid ' + T.line + '!important}');
      r.push(S + ' .step .n{background:' + T.accent + '!important;color:#fff!important;border:1px solid ' + T.accent + '}');
      r.push(S + ' code{background:' + T.card2 + '!important;color:' + T.accent + '!important}');
      r.push(S + ' hr.sep,S .sect .line{border-color:' + T.line + '!important;background:' + T.line + '!important}');
      r.push(S + ' #brightness-panel{background:' + T.card + '!important;color:' + T.ink + '!important;border:1px solid ' + T.line + '!important;border-radius:' + T.radius + '!important;box-shadow:0 8px 30px ' + T.shadow + '!important}');
      r.push(S + ' #brightness-panel .bp-title,S #brightness-panel .bp-val b{color:' + T.accent + '!important}');
      r.push(S + ' #brightness-panel .bp-val,S #brightness-panel .bp-sec{color:' + T.ink2 + '!important}');
      r.push(S + ' #brightness-panel input[type=range]{accent-color:' + T.accent + '!important}');
      r.push(S + ' #brightness-panel .bp-toggle{background:' + T.card2 + '!important;color:' + T.ink + '!important;border-color:' + T.line + '!important}');
      r.push(S + ' #brightness-panel .bp-presets button{background:' + T.card + '!important;color:' + T.ink + '!important;border:1px solid ' + T.line + '!important;border-radius:' + T.tradius + '!important;font-weight:600}');
      r.push(S + ' #brightness-panel .bp-presets button:hover{background:' + T.card2 + '!important}');
      r.push(S + ' #brightness-panel .bp-presets button.on{background:' + T.accent + '!important;color:#fff!important;border-color:' + T.accent + '!important}');
      r.push(S + ' #gate .card{background:' + T.card + '!important;border:1.5px solid ' + T.line + '!important;color:' + T.ink + '!important;box-shadow:0 10px 40px ' + T.shadow + '!important}');
      r.push(S + ' #gate .card h1,S #gate .card .sub,S #gate .card label,S #gate .card .foot{color:' + T.ink + '!important}');
      r.push(S + ' #gate input[type=password]{background:' + T.card + '!important;color:' + T.ink + '!important;border:1.5px solid ' + T.line + '!important}');
      T.extras.forEach(function (x) { r.push(x); });
      // 统一展开占位符：规则串里所有独立的 S / F 都替换为对应选择器，
      // 避免逗号分隔的多选择器只替换第一个导致后半段失效。
      blocks.push('/* ' + T.name + ' */\n' + r.join('\n').replace(/\bS\b/g, S).replace(/\bF\b/g, F));
    });
    return '<style id="amz-themes">' + blocks.join('\n') + '</style>';
  }
  var THEMES = buildThemeStyles();
  var THEME_IDS = Object.keys(THEME_DEFS);

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
    '<div class="bp-sec">艺 术 主 题</div>' +
    '<div class="bp-presets" style="margin-top:6px">' +
    '<button data-c="neon">霓虹赛博</button><button data-c="glass">毛玻璃</button>' +
    '</div>' +
    '<div class="bp-presets" style="margin-top:5px">' +
    '<button data-c="qinghua">青花瓷</button><button data-c="macaron">奶油马卡龙</button>' +
    '</div>' +
    '<div class="bp-presets" style="margin-top:5px">' +
    '<button data-c="spring">春日樱绿</button><button data-c="bamboo">竹林青</button>' +
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

  /* 明亮系主题开关（涂鸦 + 6 套艺术主题共用）：
     amz-light 给结构层，amz-<id> 激活对应 token 覆盖（doodle 无此标记），
     data-amz-skip-normalize 让 fx.js 停止把浅色块重刷成深色。
     切回经典深色/纯黑/白底/暖褐时全部撤掉，fx.js 恢复原样。 */
  function applyLightTheme(v) {
    var h = document.documentElement;
    var light = (v === 'doodle' || THEME_IDS.indexOf(v) >= 0);
    h.classList.remove('amz-light');
    for (var i = 0; i < THEME_IDS.length; i++) h.classList.remove('amz-' + THEME_IDS[i]);
    if (light) {
      h.classList.add('amz-light');
      if (v !== 'doodle') h.classList.add('amz-' + v);
    }
    if (document.body) {
      if (light) document.body.setAttribute('data-amz-skip-normalize', '');
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
      if (v === 'black' || v === 'light' || v === 'warm') h.classList.add('amz-c-' + v);
      applyLightTheme(v);   /* doodle + 6 套艺术主题走覆盖样式，其余走 fx 变量/滤镜 */
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
    var light = (theme === 'doodle' || THEME_IDS.indexOf(theme) >= 0);
    if (!light) return html;
    var cls = (theme === 'doodle') ? 'amz-light' : ('amz-light amz-' + theme);
    if (/<html([^>]*)>/i.test(html)) {
      html = html.replace(/<html([^>]*)>/i, function (m, attrs) {
        if (/\bclass\s*=/.test(attrs)) {
          return m.replace(/class\s*=\s*"([^"]*)"/i, function (mm, c) {
            return 'class="' + c + ' ' + cls + '"';
          });
        }
        return '<html' + attrs + ' class="' + cls + '">';
      });
    }
    if (/<body([^>]*)>/i.test(html)) {
      html = html.replace(/<body([^>]*)>/i, function (m, attrs) {
        return '<body' + attrs + ' data-amz-skip-normalize';
      });
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
        html = html.replace(/<head[^>]*>/i, function (m) { return m + CRITICAL + DOODLE + THEMES; });
      } else {
        html = CRITICAL + DOODLE + THEMES + html;
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
    var theme = savedTheme();
    var light = (theme === 'doodle' || THEME_IDS.indexOf(theme) >= 0);
    if (!light) return;
    var h = document.documentElement;
    h.classList.add('amz-light');
    if (theme !== 'doodle') h.classList.add('amz-' + theme);
    if (document.body) document.body.setAttribute('data-amz-skip-normalize', '');
    var st = document.createElement('style');
    st.textContent = (DOODLE + THEMES).replace(/<\/?style[^>]*>/gi, '');
    document.head.appendChild(st);
  })();

  loadFx();   // 门禁页也使用同一套视觉
  boot();
})();
