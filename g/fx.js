/*!
 * AMZ Toolbox — FX Layer 2.0
 * ------------------------------------------------------------------
 * 零侵入增强层：由 g/gate.js 在「解密前 / 解密后」各加载一次。
 * 不读取也不修改任何密文，不需要密码，不改变原有工具逻辑。
 *
 * 提供：
 *   1. 动态背景（极光 / 网格 / 星点粒子 / 光标聚光，支持降级）
 *   2. 深色玻璃化视觉（变量覆盖 + 运行时色彩规范化，自适应未知 DOM）
 *   3. 线性 SVG 图标系统（按工具 slug / 中文关键词匹配）
 *   4. 交互：卡片倾斜与高光、启动过渡、命令面板、微交互、页内导航
 */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;

  /* 站点根：g/fx.js 所在目录的上一级 */
  var BASE = (function () {
    var s = doc.currentScript && doc.currentScript.src;
    if (s) return s.replace(/g\/fx\.js(?:\?.*)?$/, '');
    return './';
  })();

  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* 以下状态在 init() 时计算，避免脚本先于 <body> 执行时读到 null */
  var DEMO = false, SKIP_NORMALIZE = false, GATED = false;

  /* 重复加载时先清掉自己上一次留下的节点（document.open 会重置 DOM） */
  ['amz-fx-style', 'amz-fx-bg', 'amz-fx-launch', 'amz-fx-palette',
   'amz-fx-nav', 'amz-fx-toast', 'amz-fx-guide'].forEach(function (id) {
    var n = doc.getElementById(id);
    if (n && n.parentNode) n.parentNode.removeChild(n);
  });
  root.classList.add('amz-fx');

  /* 幂等：撤掉上一次实例挂的全局监听与观察器，避免重复加载时事件叠加。
     document.open() 会清空监听器，此时 remove 是空操作，随后照常重新绑定。 */
  try {
    var pw = window.__AMZ_FX_WIN__;
    if (pw) {
      window.removeEventListener('resize', pw.resize);
      window.removeEventListener('pointermove', pw.pointer);
      doc.removeEventListener('visibilitychange', pw.vis);
    }
    var pd = doc.__AMZ_FX_DOC__;
    if (pd) {
      doc.removeEventListener('click', pd.ripple, true);
      doc.removeEventListener('keydown', pd.keydown);
      if (pd.cardClick) doc.removeEventListener('click', pd.cardClick, true);
    }
    if (window.__AMZ_FX_MO__) window.__AMZ_FX_MO__.disconnect();
  } catch (e) {}
  var EPOCH = (window.__AMZ_FX_EPOCH__ = (window.__AMZ_FX_EPOCH__ || 0) + 1);

  /* ------------------------------------------------------------------ *
   * 工具清单（与 p/*.enc 一一对应）
   * ------------------------------------------------------------------ */
  var TOOLS = [
    { s:'aba-rank',              n:'ABA 排名洞察',   c:'数据洞察', i:'chart',    d:'12 周排名趋势、竞品席位与周度变动全景' },
    { s:'aba-snapshot',          n:'类目快照',       c:'数据洞察', i:'grid',     d:'锁定某一周的类目结构，做前后对比留档' },
    { s:'search-term',           n:'搜索词分析',     c:'数据洞察', i:'search',   d:'拆分流量词与转化词，找出可放大的入口' },
    { s:'kw-gap',                n:'关键词缺口',     c:'数据洞察', i:'filter',   d:'对比自身与竞品的词覆盖，定位空白地带' },
    { s:'blue-ocean',            n:'蓝海选品',       c:'数据洞察', i:'radar',    d:'用需求与竞争强度筛选低拥挤度机会' },
    { s:'seasonality',           n:'季节性分析',     c:'数据洞察', i:'calendar', d:'识别淡旺季拐点，提前排产与备货' },
    { s:'snow-radar',            n:'雪情雷达',       c:'数据洞察', i:'snow',     d:'天气与区域需求联动监控，捕捉突发波动' },
    { s:'category-matrix',       n:'类目矩阵',       c:'数据洞察', i:'layers',   d:'按价格带与评分交叉，看清类目空位' },
    { s:'variant-matrix',        n:'变体矩阵',       c:'数据洞察', i:'grid',     d:'梳理变体表现，优化父子体结构' },
    { s:'bsr-calculator',        n:'BSR 计算器',     c:'数据洞察', i:'calc',     d:'由排名反推销量区间，校准预估模型' },

    { s:'ad-audit',              n:'广告审计',       c:'广告增长', i:'target',   d:'逐层排查投放结构、浪费词与无效花费' },
    { s:'ad-incremental',        n:'增量分析',       c:'广告增长', i:'trend',    d:'衡量加投带来的真实增量，而非账面归因' },
    { s:'heated-ad-structure',   n:'广告结构诊断',   c:'广告增长', i:'layers',   d:'拆解活动 / 广告组层级，重建投放骨架' },
    { s:'heated-demand-radar',   n:'需求雷达',       c:'广告增长', i:'radar',    d:'扫描需求信号，锁定值得加热的关键词' },
    { s:'heated-message-matrix', n:'卖点信息矩阵',   c:'广告增长', i:'message',  d:'把卖点、人群与场景做成可复用的表达矩阵' },
    { s:'roi-benchmark',         n:'ROI 基准',       c:'广告增长', i:'gauge',    d:'横向对比投放回报，给出可执行的阈值' },
    { s:'traffic-funnel',        n:'流量漏斗',       c:'广告增长', i:'filter',   d:'从曝光到购买逐层定位流失环节' },
    { s:'cvr-tree',              n:'转化决策树',     c:'广告增长', i:'pulse',    d:'按分支排查转化率下滑的具体成因' },
    { s:'launch-sim',            n:'新品推演',       c:'广告增长', i:'sparkles', d:'模拟上架节奏、预算与排名的联动结果' },

    { s:'profit-calculator',     n:'利润计算器',     c:'财务利润', i:'calc',     d:'扣清佣金、FBA、头程与广告后的真实毛利' },
    { s:'heated-profit',         n:'利润推演',       c:'财务利润', i:'coin',     d:'按价格 / 成本 / 促销组合推演利润曲线' },
    { s:'fx-cash',               n:'汇率与现金',     c:'财务利润', i:'globe',    d:'多站点回款换算与现金流节奏测算' },
    { s:'promo-planner',         n:'促销规划',       c:'财务利润', i:'calendar', d:'Deal / LD / BD 排期与价格门槛校验' },
    { s:'stockout-loss',         n:'断货损失',       c:'财务利润', i:'alert',    d:'量化断货期间的排名与营收机会成本' },

    { s:'replenish',             n:'补货计划',       c:'供应链',   i:'truck',    d:'结合在途与销量节奏给出下单时点' },
    { s:'excess-inventory',      n:'冗余库存',       c:'供应链',   i:'box',      d:'识别滞销与仓储费风险，排出处理优先级' },
    { s:'fulfillment',           n:'配送测算',       c:'供应链',   i:'cart',     d:'对比配送方式与尺寸段下的费用差异' },

    { s:'account-health',        n:'账户健康',       c:'诊断合规', i:'shield',   d:'汇总绩效指标与风险信号，提前预警' },
    { s:'review-audit',          n:'评论审计',       c:'诊断合规', i:'eye',      d:'分析评价结构与差评主题，定位产品问题' },
    { s:'heated-compliance',     n:'合规诊断',       c:'诊断合规', i:'shield',   d:'检查文案、类目与资质中的高风险表述' },
    { s:'heated-root-cause',     n:'根因定位',       c:'诊断合规', i:'flask',    d:'从症状回溯变量，收敛到最可能的原因' },

    { s:'ops-console',           n:'运营控制台',     c:'效率工具', i:'terminal', d:'集中查看关键指标与日常运营动作' },
    { s:'mcp-studio',            n:'MCP 工作台',     c:'效率工具', i:'cpu',      d:'连接数据能力与自动化流程的配置面板' },
    { s:'desktop-studio',        n:'桌面工作台',     c:'效率工具', i:'link',     d:'下载并配置本地桌面端工具' }
  ];
  var BY_SLUG = {};
  TOOLS.forEach(function (t) { BY_SLUG[t.s] = t; });

  var CAT_TINT = {
    '数据洞察': '#8b83ff', '广告增长': '#4cc9ff', '财务利润': '#43e6b0',
    '供应链': '#f0b87a', '诊断合规': '#ff7fa8', '效率工具': '#7ba6ff'
  };

  /* ------------------------------------------------------------------ *
   * 线性图标库（24×24，stroke 1.6）
   * ------------------------------------------------------------------ */
  var ICONS = {
    chart:    '<path d="M3 20h18M6.5 16v-5M11 16V6M15.5 16v-8M20 16v-3"/>',
    search:   '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    target:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>',
    shield:   '<path d="M12 3 4.5 6v6c0 4.4 3.1 7.6 7.5 9 4.4-1.4 7.5-4.6 7.5-9V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
    box:      '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    truck:    '<path d="M2 6h11v11H2zM13 10h4l3 3v4h-7"/><circle cx="6.5" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
    coin:     '<circle cx="12" cy="12" r="9"/><path d="M15 9.2c-.7-1-1.8-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 3 6 1.3 6 4.3 0 1.3-1.3 2.3-3 2.3-1.3 0-2.5-.6-3.2-1.6M12 6v12"/>',
    flask:    '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
    grid:     '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
    radar:    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 18.5 6.5"/><circle cx="16.5" cy="8.5" r="1"/>',
    pulse:    '<path d="M2 12h4l3-7 4 14 3-7h6"/>',
    message:  '<path d="M20 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9Z"/><path d="M8 9h8M8 12.5h5"/>',
    calc:     '<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M8 7h8M8 12h2m4 0h2M8 16h2m4 0h2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    sparkles: '<path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
    terminal: '<rect x="2.5" y="4" width="19" height="16" rx="2.5"/><path d="m7 9 3 3-3 3M13 15h4"/>',
    layers:   '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    eye:      '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.6"/>',
    alert:    '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17.5v.01"/>',
    gauge:    '<path d="M4 18a9 9 0 1 1 16 0"/><path d="m12 14 4-4"/><circle cx="12" cy="15" r="1.3"/>',
    snow:     '<path d="M12 2v20M4 6l16 12M20 6 4 18M9 4l3 3 3-3M9 20l3-3 3 3"/>',
    filter:   '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
    link:     '<path d="M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11 6.3"/><path d="M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.6-1.6"/>',
    cart:     '<path d="M3 4h2l2.4 11h10l2-7H6"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
    trend:    '<path d="m3 17 6-6 4 4 8-8"/><path d="M16 7h5v5"/>',
    globe:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    cpu:      '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    doc:      '<path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v5h4M9 12h6M9 16h6"/>'
  };
  function iconSvg(k) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[k] || ICONS.grid) + '</svg>';
  }

  /* ------------------------------------------------------------------ *
   * 样式
   * ------------------------------------------------------------------ */
  var CSS = [
'html.amz-fx{',
'  --af-bg:#070a12; --af-panel:rgba(18,23,38,.72); --af-line:rgba(255,255,255,.09);',
'  --af-text:#e9edf8; --af-dim:#98a3ba; --af-a:#8b83ff; --af-b:#4cc9ff; --af-c:#43e6b0;',
'  --bg:#070a12 !important; --card:rgba(18,23,38,.72) !important;',
'  --surface:rgba(18,23,38,.72) !important; --panel:rgba(18,23,38,.72) !important;',
'  --text:#e9edf8 !important; --muted:#98a3ba !important; --hint:#6f7a90 !important;',
'  --border:rgba(255,255,255,.09) !important; --line:rgba(255,255,255,.09) !important;',
'  --accent:#8b83ff !important; --accent-2:#4cc9ff !important; --primary:#8b83ff !important;',
'  --soft:rgba(139,131,255,.12) !important; --ring:rgba(139,131,255,.25) !important;',
'  --danger:#ff7a85 !important;',
'  --shadow:0 18px 48px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.05) !important;',
'  background:#070a12 !important; color-scheme:dark;',
'  scrollbar-color:rgba(255,255,255,.18) transparent;',
'}',
'html.amz-fx body{background:transparent !important;color:#e9edf8 !important;',
'  font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif !important;',
'  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}',
'html.amz-fx ::selection{background:rgba(139,131,255,.38);color:#fff;}',
'html.amz-fx ::-webkit-scrollbar{width:10px;height:10px}',
'html.amz-fx ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.13);border-radius:8px;border:2px solid transparent;background-clip:padding-box}',
'html.amz-fx ::-webkit-scrollbar-track{background:transparent}',
'html.amz-fx input,html.amz-fx textarea,html.amz-fx select{outline:none}',
'html.amz-fx input:focus,html.amz-fx textarea:focus,html.amz-fx select:focus{',
'  border-color:rgba(139,131,255,.6) !important;',
'  box-shadow:0 0 0 3px rgba(139,131,255,.14),0 0 24px rgba(76,201,255,.10) !important;}',
'html.amz-fx hr,html.amz-fx td,html.amz-fx th{border-color:rgba(255,255,255,.08) !important}',
'html.amz-fx h1,html.amz-fx h2,html.amz-fx h3,html.amz-fx h4,html.amz-fx strong{letter-spacing:-.015em}',
'html.amz-fx #boot{background:rgba(7,10,18,.72) !important;backdrop-filter:blur(8px)}',
'html.amz-fx #gate .card{backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);',
'  border-color:rgba(255,255,255,.10) !important}',
'html.amz-fx #gate .logo,html.amz-fx #gate button{',
'  background:linear-gradient(125deg,#8b83ff,#4cc9ff) !important;color:#fff !important}',
/* 若橙色横幅画在伪元素上，inline style 无法覆盖，用预置规则接管 */
'html.amz-fx .af-warm-pseudo::before,html.amz-fx .af-warm-pseudo::after{',
'  background-color:rgba(10,14,26,.72) !important;',
'  background-image:linear-gradient(125deg,rgba(139,131,255,.24),rgba(76,201,255,.13) 55%,rgba(67,230,176,.09)) !important}',

/* ---- 动态背景 ---- */
'#amz-fx-bg{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;',
'  background:radial-gradient(120% 90% at 50% -20%,#131a2e 0%,#0a0e1a 48%,#060810 100%);}',
'#amz-fx-bg .af-aurora{position:absolute;border-radius:50%;filter:blur(90px);opacity:.34;will-change:transform}',
'#amz-fx-bg .a1{width:46vw;height:46vw;left:-8vw;top:-14vw;background:#5b4bff;animation:afDrift1 26s ease-in-out infinite}',
'#amz-fx-bg .a2{width:40vw;height:40vw;right:-6vw;top:6vh;background:#128fb8;animation:afDrift2 32s ease-in-out infinite}',
'#amz-fx-bg .a3{width:36vw;height:36vw;left:36vw;bottom:-20vw;background:#265c6b;opacity:.24;animation:afDrift3 38s ease-in-out infinite}',
'@keyframes afDrift1{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(9vw,7vh,0) scale(1.14)}}',
'@keyframes afDrift2{0%,100%{transform:translate3d(0,0,0) scale(1.08)}50%{transform:translate3d(-8vw,10vh,0) scale(.92)}}',
'@keyframes afDrift3{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(-6vw,-9vh,0) scale(1.18)}}',
'#amz-fx-bg .af-grid{position:absolute;inset:0;opacity:.5;',
'  background-image:linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px);',
'  background-size:64px 64px;mask-image:radial-gradient(80% 65% at 50% 30%,#000 20%,transparent 100%);',
'  -webkit-mask-image:radial-gradient(80% 65% at 50% 30%,#000 20%,transparent 100%)}',
'#amz-fx-bg canvas{position:absolute;inset:0;width:100%;height:100%;opacity:.7}',
'#amz-fx-bg .af-spot{position:absolute;inset:0;opacity:.55;mix-blend-mode:screen;',
'  background:radial-gradient(380px circle at var(--mx,50%) var(--my,40%),rgba(120,140,255,.13),transparent 70%)}',
'#amz-fx-bg .af-noise{position:absolute;inset:0;opacity:.035;',
'  background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'180\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.8\' numOctaves=\'3\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")}',
'#amz-fx-bg .af-vig{position:absolute;inset:0;background:radial-gradient(100% 80% at 50% 40%,transparent 45%,rgba(2,4,10,.65) 100%)}',
'@media (prefers-reduced-motion:reduce){#amz-fx-bg .af-aurora{animation:none}}',

/* ---- 工具卡片 ---- */
'.amz-fx-card{position:relative;isolation:isolate;transition:transform .32s cubic-bezier(.2,.8,.2,1),box-shadow .32s,border-color .32s !important;',
'  will-change:transform}',
'.amz-fx-card::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:-1;',
'  background:radial-gradient(260px circle at var(--px,50%) var(--py,50%),rgba(139,131,255,.16),transparent 70%);opacity:0;transition:opacity .3s}',
'.amz-fx-card:hover::after{opacity:1}',
'.amz-fx-card:hover{border-color:rgba(139,131,255,.38) !important;',
'  box-shadow:0 24px 60px rgba(0,0,0,.42),0 0 0 1px rgba(139,131,255,.10),inset 0 1px 0 rgba(255,255,255,.08) !important}',
'.amz-fx-icon{width:46px;height:46px;flex:none;border-radius:14px;display:grid;place-items:center;',
'  background:linear-gradient(140deg,rgba(var(--tint-rgb,139,131,255),.20),rgba(255,255,255,.02));',
'  border:1px solid rgba(255,255,255,.10);',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 8px 22px rgba(0,0,0,.24);',
'  color:var(--tint,#8b83ff);transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s,color .35s}',
'.amz-fx-icon svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}',
'.amz-fx-card:hover .amz-fx-icon{transform:translateY(-2px) scale(1.06) rotate(-3deg);',
'  box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 10px 28px rgba(var(--tint-rgb,139,131,255),.24);color:#fff}',
'.amz-fx-card.af-rise{animation:afRise .62s cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(var(--i,0) * 32ms)}',
'@keyframes afRise{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}',
'@media (prefers-reduced-motion:reduce){.amz-fx-card.af-rise{animation:none}}',

/* ---- 启动过渡 ---- */
'#amz-fx-launch{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;',
'  background:rgba(6,8,16,.82);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);',
'  animation:afFade .28s ease both}',
'#amz-fx-launch.af-out{animation:afFadeOut .3s ease both}',
'@keyframes afFade{from{opacity:0}to{opacity:1}}@keyframes afFadeOut{to{opacity:0}}',
'.af-launch-inner{text-align:center;min-width:280px}',
'.af-orb{width:88px;height:88px;margin:0 auto 26px;border-radius:26px;display:grid;place-items:center;position:relative;',
'  background:linear-gradient(140deg,rgba(139,131,255,.22),rgba(76,201,255,.08));',
'  border:1px solid rgba(255,255,255,.14);box-shadow:0 0 60px rgba(139,131,255,.22),inset 0 1px 0 rgba(255,255,255,.18)}',
'.af-orb::before{content:"";position:absolute;inset:-14px;border-radius:36px;border:1px solid rgba(139,131,255,.28);',
'  animation:afSpin 2.4s linear infinite;border-right-color:transparent;border-bottom-color:transparent}',
'@keyframes afSpin{to{transform:rotate(360deg)}}',
'.af-orb svg{width:40px;height:40px;fill:none;stroke:#c9c5ff;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}',
'.af-launch-name{font-size:21px;font-weight:650;letter-spacing:-.02em;color:#f1f4ff;margin-bottom:8px}',
'.af-launch-sub{font-size:13px;color:#8d99b4;margin-bottom:28px}',
'.af-bar{height:3px;border-radius:4px;background:rgba(255,255,255,.09);overflow:hidden;margin:0 auto 14px;max-width:230px}',
'.af-bar i{display:block;height:100%;width:0;border-radius:4px;background:linear-gradient(90deg,#8b83ff,#4cc9ff,#43e6b0);',
'  animation:afLoad .72s cubic-bezier(.4,0,.2,1) forwards}',
'@keyframes afLoad{to{width:100%}}',
'.af-launch-tip{font-size:11.5px;color:#5f6b83;letter-spacing:.04em}',

/* ---- 命令面板 ---- */
'#amz-fx-palette{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:flex-start;justify-content:center;',
'  padding:13vh 20px 20px;background:rgba(4,6,12,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);',
'  animation:afFade .18s ease both}',
'#amz-fx-palette[hidden]{display:none}',
'.af-pal{width:min(620px,100%);border-radius:18px;overflow:hidden;',
'  background:rgba(17,22,36,.92);border:1px solid rgba(255,255,255,.11);',
'  box-shadow:0 40px 100px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.07);',
'  animation:afPop .26s cubic-bezier(.2,.8,.2,1) both;color:#e9edf8;font-family:inherit}',
'@keyframes afPop{from{opacity:0;transform:translateY(-12px) scale(.98)}to{opacity:1;transform:none}}',
'.af-pal-head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08)}',
'.af-pal-head svg{width:19px;height:19px;fill:none;stroke:#8b83ff;stroke-width:1.7;flex:none}',
'.af-pal-head input{flex:1;background:transparent;border:0;color:#eef2ff;font-size:15px;font-family:inherit;outline:none}',
'.af-pal-head input::placeholder{color:#66718a}',
'.af-pal kbd{font:11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8b96ad;',
'  border:1px solid rgba(255,255,255,.12);border-radius:5px;padding:5px 7px;background:rgba(255,255,255,.04)}',
'.af-pal-list{max-height:min(52vh,420px);overflow:auto;padding:8px 8px 10px}',
'.af-pal-item{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border-radius:11px;',
'  border:1px solid transparent;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit}',
'.af-pal-item.af-sel{background:rgba(139,131,255,.13);border-color:rgba(139,131,255,.28)}',
'.af-pal-ico{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;flex:none;',
'  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:var(--tint,#8b83ff)}',
'.af-pal-ico svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}',
'.af-pal-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;text-align:left}',
'.af-pal-name{display:block;font-size:13.5px;font-weight:580;color:#e9edf8}',
'.af-pal-desc{display:block;font-size:11.5px;color:#7e8aa2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.af-pal-cat{font-size:10.5px;color:#6f7a90;letter-spacing:.03em;flex:none}',
'.af-pal-foot{padding:10px 18px;border-top:1px solid rgba(255,255,255,.08);font-size:11px;color:#6b7690;display:flex;gap:16px}',
'.af-pal-empty{padding:36px;text-align:center;color:#6b7690;font-size:13px}',

/* ---- 工具页导航 / 提示 ---- */
'#amz-fx-nav{position:fixed;left:18px;bottom:18px;z-index:2147481000;display:flex;align-items:center;gap:10px;',
'  padding:7px 9px 7px 7px;border-radius:999px;background:rgba(15,20,33,.82);',
'  border:1px solid rgba(255,255,255,.10);box-shadow:0 12px 36px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.07);',
'  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);font-size:12px;color:#aab5cb;',
'  animation:afRise .5s .2s both}',
'#amz-fx-nav a,#amz-fx-nav button{font:inherit;color:#e9edf8;text-decoration:none;cursor:pointer;border:0;background:transparent}',
'#amz-fx-nav .af-back{padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.06);transition:background .2s}',
'#amz-fx-nav .af-back:hover{background:rgba(139,131,255,.22)}',
'#amz-fx-nav .af-sep{width:1px;height:16px;background:rgba(255,255,255,.12)}',
'#amz-fx-nav .af-cur{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8e9ab2}',
'#amz-fx-nav .af-k{padding:6px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.12) !important;',
'  font:10.5px ui-monospace,Menlo,monospace;color:#8e9ab2}',
'#amz-fx-toast{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:2147482500;',
'  padding:11px 18px;border-radius:12px;background:rgba(20,26,42,.94);border:1px solid rgba(255,255,255,.12);',
'  color:#e9edf8;font-size:12.5px;box-shadow:0 18px 44px rgba(0,0,0,.5);animation:afRise .3s both}',
'#amz-fx-guide{position:fixed;right:18px;bottom:18px;z-index:2147481000;width:270px;padding:16px 17px;',
'  border-radius:16px;background:rgba(17,22,36,.92);border:1px solid rgba(255,255,255,.11);',
'  box-shadow:0 22px 60px rgba(0,0,0,.5);backdrop-filter:blur(16px);color:#e9edf8;font-size:12px;',
'  animation:afRise .5s .4s both}',
'#amz-fx-guide h4{font-size:13px;font-weight:640;margin-bottom:10px;color:#f0f3ff}',
'#amz-fx-guide p{color:#93a0b8;line-height:1.7;margin-bottom:12px}',
'#amz-fx-guide button{width:100%;padding:8px;border-radius:9px;border:1px solid rgba(139,131,255,.32);',
'  background:rgba(139,131,255,.14);color:#cfcbff;cursor:pointer;font:inherit;font-size:12px}',
'.af-ripple{position:absolute;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%) scale(0);',
'  background:radial-gradient(circle,rgba(160,170,255,.42),transparent 70%);animation:afRipple .6s ease-out forwards}',
'@keyframes afRipple{to{transform:translate(-50%,-50%) scale(1);opacity:0}}'
  ].join('\n');

  /* ------------------------------------------------------------------ *
   * 工具函数
   * ------------------------------------------------------------------ */
  function el(tag, cls, html) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function hex2rgb(h) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)].join(',') : '139,131,255';
  }
  function parseColor(s) {
    var m = /^rgba?\(([^)]+)\)/i.exec(String(s || '').trim());
    if (!m) return null;
    var p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length < 3) return null;
    return { r:p[0], g:p[1], b:p[2], a:p.length > 3 ? p[3] : 1 };
  }
  function lum(c) { return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255; }
  function neutral(c) { return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 48; }
  /* 暖橙 / 高饱和亮色识别：按 RGB 数值判断，不依赖写死的色值名单。
     覆盖 #ff6a00、#f97316、#e8590c、rgba(255,106,0,..) 等任意橙红系。 */
  function isWarm(c) {
    if (!c || c.a < .3) return false;
    return c.r > 185 && c.b < 145 && (c.r - c.b) > 85 &&
           (c.r - c.g) > 15 && (c.g - c.b) > -25;
  }
  function warmInImage(s) {
    s = String(s || '');
    var re = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi, m;
    while ((m = re.exec(s))) {
      if (isWarm({ r:+m[1], g:+m[2], b:+m[3], a:1 })) return true;
    }
    re = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
    while ((m = re.exec(s))) {
      var h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      if (isWarm({ r:(n >> 16) & 255, g:(n >> 8) & 255, b:n & 255, a:1 })) return true;
    }
    return false;
  }
  function slugFromHref(href) {
    if (!href) return null;
    var h = String(href).split(/[?#]/)[0].replace(/\/$/, '');
    var m = /^#tool-(.+)$/.exec(String(href));
    if (m) return m[1];
    var parts = h.split('/');
    var last = parts[parts.length - 1];
    if (/^index\.html?$/i.test(last)) last = parts[parts.length - 2];
    return BY_SLUG[last] ? last : null;
  }
  function cssEscape(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  /* ------------------------------------------------------------------ *
   * 1. 样式 + 动态背景
   * ------------------------------------------------------------------ */
  var style = el('style'); style.id = 'amz-fx-style'; style.textContent = CSS;
  (doc.head || root).appendChild(style);

  function buildBackground() {
    var bg = el('div');
    bg.id = 'amz-fx-bg';
    bg.innerHTML =
      '<div class="af-aurora a1"></div><div class="af-aurora a2"></div><div class="af-aurora a3"></div>' +
      '<div class="af-grid"></div><canvas></canvas><div class="af-spot"></div>' +
      '<div class="af-noise"></div><div class="af-vig"></div>';
    (doc.body || root).insertBefore(bg, doc.body && doc.body.firstChild || null);

    var canvas = bg.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pts = [], mouse = { x:-999, y:-999 };

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.min(72, Math.max(24, Math.round(W * H / 24000)));
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({
          x:Math.random() * W, y:Math.random() * H,
          vx:(Math.random() - .5) * .20, vy:(Math.random() - .5) * .20,
          r:Math.random() * 1.5 + .5
        });
      }
    }
    function frame() {
      if (EPOCH !== window.__AMZ_FX_EPOCH__) return;   // 旧实例的动画自动退出
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (!REDUCE) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > W) p.vx *= -1;
          if (p.y < 0 || p.y > H) p.vy *= -1;
        }
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
          if (d2 < 15500) {
            ctx.strokeStyle = 'rgba(130,155,255,' + (0.10 * (1 - d2 / 15500)).toFixed(3) + ')';
            ctx.lineWidth = .6; ctx.beginPath();
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        var md = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        ctx.fillStyle = md < 140 ? 'rgba(180,200,255,.72)' : 'rgba(150,175,255,.34)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      if (!REDUCE && !doc.hidden) requestAnimationFrame(frame);
    }
    resize();
    var hResize = function () { resize(); if (REDUCE) frame(); };
    var hPointer = function (e) {
      mouse.x = e.clientX; mouse.y = e.clientY;
      bg.style.setProperty('--mx', (e.clientX / window.innerWidth * 100) + '%');
      bg.style.setProperty('--my', (e.clientY / window.innerHeight * 100) + '%');
    };
    var hVis = function () { if (!doc.hidden && !REDUCE) frame(); };
    window.addEventListener('resize', hResize, { passive:true });
    window.addEventListener('pointermove', hPointer, { passive:true });
    doc.addEventListener('visibilitychange', hVis);
    window.__AMZ_FX_WIN__ = { resize:hResize, pointer:hPointer, vis:hVis };
    frame();
  }

  /* ------------------------------------------------------------------ *
   * 2. 运行时色彩规范化（应对未知 / 硬编码的浅色样式）
   * ------------------------------------------------------------------ */
  var HERO_GRAD = 'linear-gradient(125deg,rgba(139,131,255,.24),rgba(76,201,255,.13) 55%,rgba(67,230,176,.09))';
  var BTN_GRAD  = 'linear-gradient(125deg,rgba(139,131,255,.42),rgba(76,201,255,.30))';
  function normalize() {
    if (SKIP_NORMALIZE || !doc.body) return;
    var nodes = doc.body.querySelectorAll('*');
    var skipRoot = '#amz-fx-bg,#amz-fx-launch,#amz-fx-palette,#amz-fx-nav,#amz-fx-toast,#amz-fx-guide';
    function apply(node) {
      if (node.closest && node.closest(skipRoot)) return;
      if (node.hasAttribute && node.hasAttribute('data-amz-fx-keep')) return;
      if (/^(SVG|CANVAS|VIDEO|IFRAME|IMG|STYLE|SCRIPT|BR|HR)$/.test(node.tagName)) return;
      var cs, r;
      try { cs = getComputedStyle(node); r = node.getBoundingClientRect(); } catch (e) { return; }
      var area = r.width * r.height;
      var c = parseColor(cs.backgroundColor);
      var img = cs.backgroundImage;
      var warmBg = isWarm(c);
      var warmImg = img && img !== 'none' && warmInImage(img);

      /* 暖橙色块：顶部横幅 / 橙色按钮统一接管。
         必须同时改 background-color 与 background-image，否则半透明渐变
         下面仍会透出原来的橙色底色。 */
      if (area > 700 && (warmBg || warmImg)) {
        var big = area > 12000;
        node.style.setProperty('background-color',
          big ? 'rgba(10,14,26,.70)' : 'rgba(18,23,38,.86)', 'important');
        node.style.setProperty('background-image', big ? HERO_GRAD : BTN_GRAD, 'important');
        node.style.setProperty('border-color', 'rgba(255,255,255,.12)', 'important');
        if (big) {
          node.style.setProperty('backdrop-filter', 'blur(20px)', 'important');
          node.style.setProperty('-webkit-backdrop-filter', 'blur(20px)', 'important');
          node.style.setProperty('box-shadow', 'inset 0 1px 0 rgba(255,255,255,.06)', 'important');
        } else {
          node.style.setProperty('color', '#f4f7ff', 'important');
        }
      } else if (c && c.a > .55 && lum(c) > .80) {
        if (area > 4200) {
          node.style.setProperty('background-color', 'rgba(18,23,38,.72)', 'important');
          node.style.setProperty('backdrop-filter', 'blur(18px)', 'important');
          node.style.setProperty('-webkit-backdrop-filter', 'blur(18px)', 'important');
          node.style.setProperty('border-color', 'rgba(255,255,255,.09)', 'important');
          node.style.setProperty('box-shadow', '0 18px 48px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.05)', 'important');
        } else if (area > 0) {
          /* 隐藏元素先不动，等它显示后再由延时扫描处理 */
          node.style.setProperty('background-color', 'rgba(255,255,255,.06)', 'important');
        }
      }
      /* 伪元素兜底：橙色若画在 ::before/::after 上，inline style 覆盖不到，
         改为打标记交给预置 CSS 规则。只查大面积元素，避免误伤装饰小圆点。 */
      if (area > 12000) {
        try {
          var pb = getComputedStyle(node, '::before');
          var pa = getComputedStyle(node, '::after');
          if ((pb && pb.backgroundImage !== 'none' && warmInImage(pb.backgroundImage)) ||
              (pa && pa.backgroundImage !== 'none' && warmInImage(pa.backgroundImage)) ||
              (pb && isWarm(parseColor(pb.backgroundColor))) ||
              (pa && isWarm(parseColor(pa.backgroundColor)))) {
            node.classList.add('af-warm-pseudo');
          }
        } catch (e) { /* 伪元素不可读时忽略 */ }
      }
      var f = parseColor(cs.color);
      if (f && f.a > .5 && lum(f) < .42 && neutral(f)) {
        node.style.setProperty('color', '#dfe6f5', 'important');
      }
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName) && node.type !== 'checkbox' && node.type !== 'radio') {
        node.style.setProperty('background-color', 'rgba(255,255,255,.045)', 'important');
        node.style.setProperty('color', '#e9edf8', 'important');
        node.style.setProperty('border-color', 'rgba(255,255,255,.12)', 'important');
      }
    }
    for (var i = 0; i < nodes.length; i++) apply(nodes[i]);

    /* html / body 自身不在 querySelectorAll('*') 里，橙色若画在它们的
       ::before / ::after 上就永远扫不到。这里只做伪元素标记，
       绝不改根元素的背景或加 backdrop-filter（那会把整页糊掉）。 */
    function markRootPseudo(root) {
      if (!root) return;
      try {
        var pb = getComputedStyle(root, '::before');
        var pa = getComputedStyle(root, '::after');
        if ((pb && pb.backgroundImage !== 'none' && warmInImage(pb.backgroundImage)) ||
            (pa && pa.backgroundImage !== 'none' && warmInImage(pa.backgroundImage)) ||
            (pb && isWarm(parseColor(pb.backgroundColor))) ||
            (pa && isWarm(parseColor(pa.backgroundColor)))) {
          root.classList.add('af-warm-pseudo');
        }
      } catch (e) { /* 伪元素不可读时忽略 */ }
    }
    markRootPseudo(doc.documentElement);
    markRootPseudo(doc.body);
  }

  /* ------------------------------------------------------------------ *
   * 3. 卡片识别 + 图标注入 + 悬停交互
   * ------------------------------------------------------------------ */
  var cardIndex = 0;
  function enhanceCards() {
    if (!doc.body) return;
    var links = doc.body.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.hasAttribute('data-amz-fx-done')) continue;
      var slug = slugFromHref(a.getAttribute('href'));
      if (!slug) continue;
      var t = BY_SLUG[slug];
      a.setAttribute('data-amz-fx-done', '1');
      a.setAttribute('data-amz-tool', slug);

      var card = a;
      /* 若 a 只是卡片内部的链接，向上找最接近的卡片容器 */
      if (a.children.length === 0 || a.getBoundingClientRect().height < 60) {
        var p = a.parentElement;
        while (p && p !== doc.body && p.getBoundingClientRect().height < 90) p = p.parentElement;
        if (p && p !== doc.body) card = p;
      }
      card.classList.add('amz-fx-card');
      card.style.setProperty('--tint', CAT_TINT[t.c] || '#8b83ff');
      card.style.setProperty('--tint-rgb', hex2rgb(CAT_TINT[t.c] || '#8b83ff'));
      card.style.setProperty('--i', String(Math.min(cardIndex++, 24)));

      /* 图标：优先替换已有图标位，否则插到卡片开头 */
      var holder = card.querySelector('[data-amz-icon]');
      if (!holder) {
        var heur = card.querySelector('.icon,.emoji,.ic,[class*="icon"],[class*="emoji"]');
        if (heur && heur.getBoundingClientRect().width < 90) holder = heur;
      }
      var svg = iconSvg(t.i);
      if (holder) {
        holder.classList.add('amz-fx-icon');
        holder.innerHTML = svg;
        holder.style.setProperty('--tint', CAT_TINT[t.c] || '#8b83ff');
        holder.style.setProperty('--tint-rgb', hex2rgb(CAT_TINT[t.c] || '#8b83ff'));
      } else if (card !== a || a.children.length) {
        /* 若旧卡片用纯 emoji 当图标，先清掉文字避免与 SVG 重复 */
        var kids = card.children;
        for (var k = 0; k < Math.min(kids.length, 3); k++) {
          var txt = (kids[k].textContent || '').trim();
          if (kids[k].children.length === 0 && txt && txt.length <= 4 &&
              !/[\u4e00-\u9fa5a-zA-Z0-9]/.test(txt)) {
            kids[k].textContent = ''; break;
          }
        }
        var ico = el('div', 'amz-fx-icon', svg);
        ico.setAttribute('data-amz-icon', '1');
        ico.style.setProperty('--tint', CAT_TINT[t.c] || '#8b83ff');
        ico.style.setProperty('--tint-rgb', hex2rgb(CAT_TINT[t.c] || '#8b83ff'));
        card.insertBefore(ico, card.firstChild);
      }
      if (!REDUCE) card.classList.add('af-rise');
      bindTilt(card);
    }
  }
  function bindTilt(card) {
    if (REDUCE || card.hasAttribute('data-amz-tilt')) return;
    card.setAttribute('data-amz-tilt', '1');
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--px', (x * 100) + '%');
      card.style.setProperty('--py', (y * 100) + '%');
      card.style.transform = 'perspective(900px) rotateX(' + ((.5 - y) * 4).toFixed(2) +
        'deg) rotateY(' + ((x - .5) * 4).toFixed(2) + 'deg) translateY(-3px)';
    });
    card.addEventListener('pointerleave', function () { card.style.transform = ''; });
  }

  /* ------------------------------------------------------------------ *
   * 4. 启动过渡（点击工具 → 有反馈地进入）
   * ------------------------------------------------------------------ */
  function toast(text) {
    var old = doc.getElementById('amz-fx-toast');
    if (old) old.parentNode.removeChild(old);
    var n = el('div', '', text); n.id = 'amz-fx-toast';
    doc.body.appendChild(n);
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 2600);
  }
  function launch(tool, href) {
    var old = doc.getElementById('amz-fx-launch');
    if (old) old.parentNode.removeChild(old);
    var layer = el('div');
    layer.id = 'amz-fx-launch';
    layer.innerHTML = '<div class="af-launch-inner">' +
      '<div class="af-orb">' + iconSvg(tool.i) + '</div>' +
      '<div class="af-launch-name">' + tool.n + '</div>' +
      '<div class="af-launch-sub">正在打开工作区 · ' + tool.c + '</div>' +
      '<div class="af-bar"><i></i></div>' +
      '<div class="af-launch-tip">本地解密 · 数据不上传</div></div>';
    doc.body.appendChild(layer);
    setTimeout(function () {
      if (DEMO) {
        layer.classList.add('af-out');
        setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 300);
        toast('演示模式 · 实际站点会打开「' + tool.n + '」');
      } else {
        window.location.href = href;
      }
    }, REDUCE ? 260 : 760);
  }
  function onClick(e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var slug = slugFromHref(a.getAttribute('href'));
    if (!slug) return;
    e.preventDefault();
    launch(BY_SLUG[slug], a.href);
  }

  /* ------------------------------------------------------------------ *
   * 5. 命令面板（Linear / Raycast 式）
   * ------------------------------------------------------------------ */
  var palette = null, palInput = null, palList = null, results = [], sel = 0;
  function buildPalette() {
    palette = el('div'); palette.id = 'amz-fx-palette'; palette.hidden = true;
    palette.innerHTML = '<div class="af-pal" role="dialog" aria-label="搜索工具">' +
      '<div class="af-pal-head">' + iconSvg('search') +
      '<input type="text" placeholder="搜索 34 个工具，或输入关键词…" autocomplete="off" spellcheck="false">' +
      '<kbd>ESC</kbd></div><div class="af-pal-list"></div>' +
      '<div class="af-pal-foot"><span>↑ ↓ 选择</span><span>Enter 打开</span><span>Esc 关闭</span><span>⌘K / Ctrl K 唤起</span></div></div>';
    doc.body.appendChild(palette);
    palInput = palette.querySelector('input');
    palList = palette.querySelector('.af-pal-list');
    palInput.addEventListener('input', renderResults);
    palInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, results.length - 1); renderResults(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); renderResults(); }
      else if (e.key === 'Enter') { e.preventDefault(); openResult(sel); }
    });
    palette.addEventListener('click', function (e) {
      if (e.target === palette) closePalette();
      var item = e.target.closest && e.target.closest('.af-pal-item');
      if (item) openResult(Number(item.getAttribute('data-i')));
    });
    renderResults();
  }
  function renderResults() {
    if (!palList) return;
    var q = (palInput.value || '').trim().toLowerCase();
    results = TOOLS.filter(function (t) {
      return !q || (t.n + ' ' + t.s + ' ' + t.c + ' ' + t.d).toLowerCase().indexOf(q) >= 0;
    });
    if (sel >= results.length) sel = 0;
    if (!results.length) { palList.innerHTML = '<div class="af-pal-empty">没有匹配的工具</div>'; return; }
    palList.innerHTML = results.map(function (t, i) {
      var tint = CAT_TINT[t.c] || '#8b83ff';
      return '<button class="af-pal-item' + (i === sel ? ' af-sel' : '') + '" data-i="' + i + '" ' +
        'style="--tint:' + tint + '">' +
        '<span class="af-pal-ico">' + iconSvg(t.i) + '</span>' +
        '<span class="af-pal-txt"><span class="af-pal-name">' + t.n + '</span>' +
        '<span class="af-pal-desc">' + t.d + '</span></span>' +
        '<span class="af-pal-cat">' + t.c + '</span></button>';
    }).join('');
  }
  function openResult(i) {
    var t = results[i];
    if (!t) return;
    closePalette();
    var href = DEMO ? '#tool-' + t.s : BASE + t.s + '/';
    launch(t, href);
  }
  function openPalette() {
    if (!palette) return;
    palette.hidden = false;
    palInput.value = ''; sel = 0; renderResults();
    setTimeout(function () { palInput.focus(); }, 30);
  }
  function closePalette() { if (palette) palette.hidden = true; }

  /* ------------------------------------------------------------------ *
   * 6. 工具页导航 + 首次引导 + 微交互
   * ------------------------------------------------------------------ */
  function currentTool() {
    var parts = window.location.pathname.replace(/\/$/, '').split('/');
    var last = parts[parts.length - 1];
    return BY_SLUG[last] || null;
  }
  function buildToolNav() {
    if (DEMO) return;
    var t = currentTool();
    if (!t) return;
    var nav = el('div'); nav.id = 'amz-fx-nav';
    nav.innerHTML = '<a class="af-back" href="' + BASE + '">← 工具箱</a>' +
      '<span class="af-sep"></span><span class="af-cur">' + t.n + '</span>' +
      '<button class="af-k" type="button">⌘K</button>';
    doc.body.appendChild(nav);
    nav.querySelector('.af-k').addEventListener('click', openPalette);

    var seen = false;
    try { seen = localStorage.getItem('amz_fx_guide_v2') === '1'; } catch (e) {}
    if (!seen) {
      var g = el('div'); g.id = 'amz-fx-guide';
      g.innerHTML = '<h4>这个工作区现在会响应你了</h4>' +
        '<p>卡片支持光标跟随与倾斜反馈；点开工具会有启动过渡；按 ⌘K / Ctrl K 可全局搜索并跳转任意工具，Esc 返回工具箱。</p>' +
        '<button type="button">知道了</button>';
      doc.body.appendChild(g);
      g.querySelector('button').addEventListener('click', function () {
        g.parentNode.removeChild(g);
        try { localStorage.setItem('amz_fx_guide_v2', '1'); } catch (e) {}
      });
    }
  }
  function bindMicro(cardClick) {
    function onRipple(e) {
      var b = e.target && e.target.closest && e.target.closest('button, [role="button"]');
      if (!b || b.closest('#amz-fx-palette, #amz-fx-nav, #amz-fx-guide')) return;
      var cs;
      try { cs = getComputedStyle(b); } catch (err) { return; }
      if (cs.position === 'static') b.style.position = 'relative';
      if (cs.overflow !== 'hidden') b.style.overflow = 'hidden';
      var r = b.getBoundingClientRect();
      var d = Math.max(r.width, r.height) * 2.2;
      var rip = el('span', 'af-ripple');
      rip.style.width = rip.style.height = d + 'px';
      rip.style.left = (e.clientX - r.left) + 'px';
      rip.style.top = (e.clientY - r.top) + 'px';
      b.appendChild(rip);
      setTimeout(function () { if (rip.parentNode) rip.parentNode.removeChild(rip); }, 620);
    }
    function onKeydown(e) {
      if (GATED) return;
      var k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault();
        palette && !palette.hidden ? closePalette() : openPalette();
        return;
      }
      if (e.key === 'Escape') {
        if (palette && !palette.hidden) { closePalette(); return; }
        if (!DEMO && currentTool()) window.location.href = BASE;
      }
      if ((k === '/' || k === 's') && !/^(INPUT|TEXTAREA|SELECT)$/.test(doc.activeElement.tagName) &&
          !(palette && !palette.hidden) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault(); openPalette();
      }
    }
    doc.addEventListener('click', onRipple, true);
    doc.addEventListener('keydown', onKeydown);
    doc.__AMZ_FX_DOC__ = { ripple:onRipple, keydown:onKeydown, cardClick:cardClick || null };
  }

  /* ------------------------------------------------------------------ *
   * 启动
   * ------------------------------------------------------------------ */
  var normalizeRuns = 0;
  function runEnhance() {
    enhanceCards();
    if (!SKIP_NORMALIZE && normalizeRuns < 4) { normalize(); normalizeRuns++; }
  }
  function init() {
    DEMO = !!(doc.body && doc.body.hasAttribute('data-amz-demo'));
    SKIP_NORMALIZE = !!(doc.body && doc.body.hasAttribute('data-amz-skip-normalize'));
    /* 门禁页不暴露工具清单、命令面板与跳转，只保留视觉层 */
    GATED = !!doc.getElementById('gate');
    /* gate.js 写的防白闪遮罩，这里做兜底移除 */
    var veil = doc.getElementById('amz-fx-veil');
    if (veil) {
      veil.className = 'af-gone';
      setTimeout(function () { if (veil.parentNode) veil.parentNode.removeChild(veil); }, 520);
    }
    buildBackground();
    var cardClick = null;
    if (!GATED) {
      buildPalette();
      buildToolNav();
      cardClick = onClick;
      doc.addEventListener('click', onClick, true);
    }
    bindMicro(cardClick);
    runEnhance();
    /* 工具页可能由自身脚本异步渲染 → 延后再扫两遍 */
    setTimeout(runEnhance, 420);
    setTimeout(runEnhance, 1400);
    var timer = null;
    var mo = new MutationObserver(function () {
      if (normalizeRuns >= 4) return;
      clearTimeout(timer);
      timer = setTimeout(runEnhance, 500);
    });
    mo.observe(doc.body, { childList:true, subtree:true });
    window.__AMZ_FX_MO__ = mo;
  }

  window.AMZ_FX = {
    base:BASE, tools:TOOLS, icon:iconSvg,
    refresh:runEnhance, palette:openPalette, launch:launch
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
