/*!
 * AMZ Toolbox — FX Layer 3.0
 * ------------------------------------------------------------------
 * 零侵入增强层：由 g/gate.js 在「解密前 / 解密后」各加载一次。
 * 不读取也不修改任何密文，不需要密码，不改变原有工具逻辑。
 *
 * 提供：
 *   1. 动态背景（极光 / 网格 / 星点粒子 / 光标聚光，支持降级）
 *   2. 首页深海鱼群（光柱 / 气泡 / 浮游光点 / 摆尾游鱼，Canvas）
 *   3. 深色玻璃化视觉（变量覆盖 + 运行时色彩规范化，自适应未知 DOM）
 *   4. 锐利文字渲染：不再用渐变裁剪文字、不再对大块文字层做模糊
 *   5. 线性 SVG 图标系统（按工具 slug / 中文关键词匹配）
 *   6. 交互：卡片倾斜与高光、启动过渡、命令面板、微交互、页内导航
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
   'amz-fx-nav', 'amz-fx-toast', 'amz-fx-guide',
   'amz-fx-sea', 'amz-fx-hero-top'].forEach(function (id) {
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
'  --af-text:#eef2fb; --af-dim:#a9b4ca; --af-a:#8b83ff; --af-b:#4cc9ff; --af-c:#43e6b0;',
'  --bg:#070a12 !important; --card:rgba(18,23,38,.72) !important;',
'  --surface:rgba(18,23,38,.72) !important; --panel:rgba(18,23,38,.72) !important;',
'  --text:#eef2fb !important; --muted:#a9b4ca !important; --hint:#8792a8 !important;',
'  --border:rgba(255,255,255,.09) !important; --line:rgba(255,255,255,.09) !important;',
'  --accent:#8b83ff !important; --accent-2:#4cc9ff !important; --primary:#8b83ff !important;',
'  --soft:rgba(139,131,255,.12) !important; --ring:rgba(139,131,255,.25) !important;',
'  --danger:#ff7a85 !important;',
'  --shadow:0 18px 48px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.05) !important;',
'  background:#070a12 !important; color-scheme:dark;',
'  scrollbar-color:rgba(255,255,255,.18) transparent;',
'}',
'html.amz-fx body{background:transparent !important;color:#f2f5fd !important;',
'  font-size:17px !important;line-height:1.75 !important;',
'  font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif !important;',
'  -webkit-font-smoothing:auto;text-rendering:optimizeLegibility;}',
/* 字号与对比度：原站正文偏小偏灰，深底上显得发虚。
   关键：绝不在文字上用 background-clip:text / text-fill-color:transparent ——
   Chromium/Windows 下渐变裁剪会把字形栅格化得发灰发糊。一律改高对比实色。 */
'html.amz-fx p,html.amz-fx li,html.amz-fx dd,html.amz-fx dt{',
'  font-size:16.5px !important;line-height:1.86 !important;color:#dbe3f4 !important}',
'html.amz-fx td,html.amz-fx th,html.amz-fx label,html.amz-fx summary{',
'  font-size:16px !important;color:#d3dcf0 !important}',
'html.amz-fx small,html.amz-fx .desc,html.amz-fx .muted,html.amz-fx .hint{',
'  font-size:15px !important;line-height:1.75 !important;color:#aab7d0 !important}',
'html.amz-fx h1{font-size:clamp(40px,4.8vw,60px) !important;line-height:1.16 !important;',
'  font-weight:760 !important;letter-spacing:-.034em !important;color:#f6f8ff !important;',
'  -webkit-text-fill-color:#f6f8ff;text-shadow:0 4px 40px rgba(120,150,255,.16)}',
'html.amz-fx h2{font-size:clamp(24px,2.5vw,31px) !important;line-height:1.32 !important;',
'  font-weight:700 !important;color:#eef3ff !important}',
'html.amz-fx h3{font-size:20px !important;line-height:1.42 !important;color:#e8eefc !important}',
'html.amz-fx h4{font-size:17px !important;color:#e2e9f8 !important}',
'html.amz-fx strong,html.amz-fx b{color:#dce6fa !important;font-weight:600 !important}',
'html.amz-fx input,html.amz-fx textarea,html.amz-fx select{font-size:16px !important}',
'html.amz-fx button,html.amz-fx .btn,html.amz-fx [role="button"]{font-size:15.5px !important;letter-spacing:.01em}',
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
'  background:radial-gradient(70% 50% at 16% 2%,rgba(91,75,255,.20),transparent 78%),',
'             radial-gradient(62% 54% at 88% 6%,rgba(18,143,184,.16),transparent 80%),',
'             radial-gradient(90% 60% at 50% 105%,rgba(35,52,92,.26),transparent 72%),',
'             linear-gradient(180deg,#0e1426 0%,#0a0e1b 48%,#060810 100%);}',
'#amz-fx-bg .af-aurora{position:absolute;border-radius:50%;filter:blur(120px);opacity:.24;will-change:transform}',
'#amz-fx-bg .a1{width:46vw;height:46vw;left:-14vw;top:-24vw;background:#5b4bff;animation:afDrift1 26s ease-in-out infinite}',
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
/* 暗角交给 #amz-fx-bg 自身的径向渐变，避免第二层椭圆在左上角留下可见弧线 */
'#amz-fx-bg .af-vig{position:absolute;inset:0;background:none}',
'@media (prefers-reduced-motion:reduce){#amz-fx-bg .af-aurora{animation:none}}',

/* ---- 工具卡片 ---- */
'.amz-fx-card{position:relative;isolation:isolate;transition:transform .32s cubic-bezier(.2,.8,.2,1),box-shadow .32s,border-color .32s !important}',
/* will-change 常驻会强制整卡独立栅格化，文字抗锯齿退化发虚；只在 hover 时开启 */
'.amz-fx-card:hover{will-change:transform}',
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
'@keyframes afRipple{to{transform:translate(-50%,-50%) scale(1);opacity:0}}',

/* ---- 首页 hero：无缝深海舞台（3.0） ----
   旧版把 hero 换成「半透明玻璃 + blur」，与下方透明内容区形成硬色差线；
   现在 hero 完全透明，与全站 fixed 背景连成一片，只靠光晕与鱼群分层。 */
'html.amz-fx .hero{',
'  position:relative !important;overflow:hidden !important;isolation:isolate;',
'  background:transparent !important;background-image:none !important;',
'  backdrop-filter:none !important;-webkit-backdrop-filter:none !important;',
'  border:0 !important;box-shadow:none !important;',
'  padding:108px 24px 66px !important;min-height:520px}',
'html.amz-fx .hero::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;',
'  -webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 38%,transparent 100%);',
'  mask-image:linear-gradient(to bottom,#000 0%,#000 38%,transparent 100%);',
'  background:radial-gradient(84% 66% at 50% -8%,rgba(88,104,214,.26),transparent 72%),',
'             radial-gradient(60% 58% at 12% 76%,rgba(28,124,158,.16),transparent 76%),',
'             radial-gradient(58% 56% at 88% 68%,rgba(122,76,196,.14),transparent 76%)}',
/* 原站 .hero::after 是 340px 装饰圆：直接关掉。
   若改造成别的用途而不重置 right/top/width/border-radius，左上角会残留半椭圆黑影，
   且底部会多出一条与全站 fixed 背景对不齐的水平色带。
   hero 与 main 的过渡交给 ::before 的纵向 mask + 全站连续背景。 */
'html.amz-fx .hero::after{display:none !important}',
'#amz-fx-sea{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;',
'  -webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 60%,transparent 100%);',
'  mask-image:linear-gradient(to bottom,#000 0%,#000 60%,transparent 100%)}',
'#amz-fx-hero-top{position:absolute;top:26px;left:0;right:0;z-index:5;',
'  display:flex;align-items:center;justify-content:space-between;gap:20px;',
'  padding:0 max(28px,calc((100% - 1200px)/2));text-align:left;pointer-events:none}',
'#amz-fx-hero-top .af-brand{display:flex;align-items:center;gap:11px}',
'#amz-fx-hero-top .af-mark{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;',
'  background:linear-gradient(140deg,rgba(139,131,255,.92),rgba(76,201,255,.62));',
'  box-shadow:0 8px 26px rgba(139,131,255,.35),inset 0 1px 0 rgba(255,255,255,.42)}',
'#amz-fx-hero-top .af-mark svg{width:20px;height:20px;fill:none;stroke:#fff;',
'  stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}',
'#amz-fx-hero-top .af-bn{font-size:13.5px;font-weight:660;color:#eef3ff;line-height:1.2}',
'#amz-fx-hero-top .af-bs{font-size:10.5px;letter-spacing:.16em;color:#7f8aa5;margin-top:3px}',
'#amz-fx-hero-top .af-tr{display:flex;align-items:center;gap:14px;font-size:12px;color:#9aa7c1}',
'#amz-fx-hero-top .af-on{display:flex;align-items:center;gap:8px;padding:7px 13px;',
'  border-radius:999px;background:rgba(67,230,176,.07);',
'  border:1px solid rgba(67,230,176,.20);color:#8ee9c5}',
'#amz-fx-hero-top .af-on i{width:6px;height:6px;border-radius:50%;background:#43e6b0;',
'  box-shadow:0 0 10px #43e6b0;animation:afPulse 2.2s ease-in-out infinite}',
'@keyframes afPulse{50%{opacity:.35;transform:scale(.8)}}',
'#amz-fx-hero-top .af-k{font:11px/1 ui-monospace,Menlo,monospace;color:#9aa6bd;',
'  border:1px solid rgba(255,255,255,.14);border-radius:6px;padding:6px 9px;',
'  background:rgba(255,255,255,.04)}',
'html.amz-fx .hero-in{position:relative !important;z-index:4 !important;',
'  max-width:1120px !important;text-align:center !important}',
'html.amz-fx .hero .kicker{font-size:13px !important;letter-spacing:.14em !important;',
'  font-weight:600 !important;padding:8px 18px !important;border-radius:999px !important;',
'  margin-bottom:26px !important;background:rgba(139,131,255,.13) !important;',
'  border:1px solid rgba(139,131,255,.30) !important;color:#cfcaff !important;',
'  backdrop-filter:none !important;-webkit-backdrop-filter:none !important}',
'html.amz-fx .hero h1{font-size:clamp(46px,5.6vw,72px) !important;line-height:1.1 !important;',
'  font-weight:780 !important;letter-spacing:-.045em !important;margin-bottom:22px !important;',
'  color:#f7f9ff !important;-webkit-text-fill-color:#f7f9ff;',
'  text-shadow:0 6px 46px rgba(110,140,255,.28)}',
'html.amz-fx .hero .lead{font-size:17.5px !important;line-height:1.95 !important;',
'  max-width:790px !important;margin:0 auto !important;color:#cbd6ec !important}',
'html.amz-fx .hero .lead b{color:#dbe7ff !important;font-weight:600 !important}',
'html.amz-fx .hero .cta{gap:14px !important;margin-top:34px !important}',
'html.amz-fx .hero .btn{font-size:16px !important;font-weight:640 !important;',
'  padding:14px 26px !important;border-radius:12px !important;letter-spacing:.01em !important}',
'html.amz-fx .hero .btn-p{background:linear-gradient(120deg,#8b83ff,#5cb8f5) !important;',
'  color:#fff !important;border:1px solid rgba(255,255,255,.18) !important;',
'  box-shadow:0 16px 40px rgba(110,120,255,.30) !important}',
'html.amz-fx .hero .btn-o{background:rgba(255,255,255,.055) !important;',
'  border:1px solid rgba(255,255,255,.16) !important;color:#e6edff !important}',
'html.amz-fx .hero .btn:hover{transform:translateY(-3px)}',
'html.amz-fx .hero .stats{max-width:920px !important;margin:52px auto 0 !important;',
'  gap:14px !important;border-top:1px solid rgba(255,255,255,.11) !important;',
'  padding-top:28px !important}',
'html.amz-fx .hero .stats div{background:rgba(255,255,255,.045) !important;',
'  border:1px solid rgba(255,255,255,.11) !important;border-radius:16px !important;',
'  padding:20px 12px !important;box-shadow:inset 0 1px 0 rgba(255,255,255,.06) !important;',
'  backdrop-filter:none !important;-webkit-backdrop-filter:none !important;',
'  transition:border-color .25s,background .25s}',
'html.amz-fx .hero .stats div:hover{border-color:rgba(139,131,255,.4) !important;',
'  background:rgba(139,131,255,.08) !important}',
'html.amz-fx .hero .stats b{font-size:36px !important;line-height:1.15 !important;',
'  font-weight:720 !important;color:#f2f6ff !important;letter-spacing:-.04em}',
'html.amz-fx .hero .stats span{font-size:14.5px !important;color:#aab7d0 !important;letter-spacing:.02em}',
'@media (max-width:720px){',
'  html.amz-fx .hero{padding:96px 16px 60px !important;min-height:auto !important}',
'  html.amz-fx .hero h1{font-size:clamp(36px,9vw,48px) !important}',
'  html.amz-fx .hero .lead{font-size:15.5px !important}',
'  html.amz-fx .hero .stats{grid-template-columns:repeat(2,1fr) !important}',
'  #amz-fx-hero-top{padding:0 16px !important}',
'  #amz-fx-hero-top .af-k{display:none}',
'}',
'@media (prefers-reduced-motion:reduce){#amz-fx-hero-top .af-on i{animation:none}}'
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
    /* ---- 鱼群（boids）：会游、会聚、会躲鼠标 ---- */
    var school = [], meteors = [], mTimer = 2.5;
    function seedFish() {
      school = [];
      var n = W < 760 ? 9 : (W < 1200 ? 16 : 22);
      for (var i = 0; i < n; i++) {
        school.push({
          x: Math.random() * W,
          y: Math.random() * H * 0.60,
          vx: (Math.random() - .5) * 1.1,
          vy: (Math.random() - .5) * .4,
          a: Math.random() * Math.PI * 2,
          ph: Math.random() * Math.PI * 2,
          sp: .016 + Math.random() * .016,
          len: 15 + Math.random() * 17
        });
      }
    }
    function stepFish() {
      var sepR = 44, aliR = 90, cohR = 138, mouseR = 175;
      for (var i = 0; i < school.length; i++) {
        var f = school[i], sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0;
        for (var j = 0; j < school.length; j++) {
          if (i === j) continue;
          var o = school[j], dx = f.x - o.x, dy = f.y - o.y;
          var d = Math.sqrt(dx * dx + dy * dy) || 1;
          if (d < sepR) { sx += dx / (d * d) * 70; sy += dy / (d * d) * 70; }
          if (d < aliR) { ax += o.vx; ay += o.vy; n++; }
          if (d < cohR) { cx += o.x; cy += o.y; }
        }
        if (n) { f.vx += (ax / n - f.vx) * .022; f.vy += (ay / n - f.vy) * .022; }
        if (cx) { f.vx += (cx / n - f.x) * .00055; f.vy += (cy / n - f.y) * .00055; }
        f.vx += sx * .018; f.vy += sy * .018;
        var mdx = f.x - mouse.x, mdy = f.y - mouse.y;
        var md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < mouseR && md > .1) { f.vx += mdx / md * .85; f.vy += mdy / md * .85; }
        f.vy -= (f.y - H * .30) * .00032;          /* 轻微偏上，聚在顶部区域 */
        var sp2 = Math.sqrt(f.vx * f.vx + f.vy * f.vy), maxS = 1.45, minS = .40;
        if (sp2 > maxS) { f.vx *= maxS / sp2; f.vy *= maxS / sp2; }
        else if (sp2 > 0 && sp2 < minS) { f.vx *= minS / sp2; f.vy *= minS / sp2; }
        f.x += f.vx; f.y += f.vy;
        if (f.x < -70) f.x = W + 70; if (f.x > W + 70) f.x = -70;
        if (f.y < -70) f.y = H + 70; if (f.y > H + 70) f.y = -70;
        var ta = Math.atan2(f.vy, f.vx), da = ta - f.a;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        f.a += da * .15;
        f.ph += f.sp;
      }
    }
    function drawFish(f) {
      var L = f.len, Wd = L * .255;
      var g = ctx.createLinearGradient(-L * .6, 0, L * .55, 0);
      g.addColorStop(0, 'rgba(110,130,255,0)');
      g.addColorStop(.48, 'rgba(140,175,255,.30)');
      g.addColorStop(1, 'rgba(165,238,255,.66)');
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.a);
      ctx.fillStyle = g;
      ctx.shadowColor = 'rgba(125,175,255,.50)';
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.ellipse(0, 0, L * .46, Wd, 0, 0, Math.PI * 2);
      ctx.fill();
      var wag = Math.sin(f.ph) * Wd * 1.2;
      ctx.beginPath();
      ctx.moveTo(-L * .38, 0);
      ctx.lineTo(-L * .74, -Wd * 1.3 + wag);
      ctx.lineTo(-L * .66, wag * .55);
      ctx.lineTo(-L * .74, Wd * 1.3 + wag);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    function stepMeteors() {
      mTimer -= .016;
      if (mTimer <= 0) {
        mTimer = 5 + Math.random() * 7;
        var fromLeft = Math.random() > .5;
        meteors.push({
          x: fromLeft ? -90 : W + 90,
          y: Math.random() * H * .42,
          vx: (fromLeft ? 1 : -1) * (6.5 + Math.random() * 4),
          vy: 2.2 + Math.random() * 1.5,
          life: 1
        });
      }
      for (var i = meteors.length - 1; i >= 0; i--) {
        var m = meteors[i];
        m.x += m.vx; m.y += m.vy; m.life -= .0085;
        if (m.life <= 0 || m.x < -260 || m.x > W + 260 || m.y > H + 260) meteors.splice(i, 1);
      }
    }
    function drawMeteors() {
      for (var i = 0; i < meteors.length; i++) {
        var m = meteors[i], tx = m.x - m.vx * 15, ty = m.y - m.vy * 15;
        var gg = ctx.createLinearGradient(m.x, m.y, tx, ty);
        gg.addColorStop(0, 'rgba(205,228,255,' + (.62 * m.life).toFixed(3) + ')');
        gg.addColorStop(1, 'rgba(120,160,255,0)');
        ctx.strokeStyle = gg; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      }
    }

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
      if (!REDUCE) { stepMeteors(); stepFish(); }
      drawMeteors();
      for (var k = 0; k < school.length; k++) drawFish(school[k]);
      if (!REDUCE && !doc.hidden) requestAnimationFrame(frame);
    }
    resize();
    seedFish();
    var hResize = function () { resize(); seedFish(); if (REDUCE) frame(); };
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
   * 1.5 首页深海鱼群（Canvas，零依赖、无外部资源）
   *     光柱 / 气泡 / 浮游光点 / 五条摆尾游鱼；仅在工具箱首页挂载。
   * ------------------------------------------------------------------ */
  function buildHomeSea() {
    var hero = doc.querySelector('.hero');
    if (!hero || !hero.querySelector('.stats') || currentTool()) return;
    if (doc.getElementById('amz-fx-sea')) return;

    /* 顶部品牌栏 —— 给 hero 一个「产品」而非「Demo 页」的第一眼 */
    var top = el('div');
    top.id = 'amz-fx-hero-top';
    top.innerHTML =
      '<div class="af-brand">' +
        '<span class="af-mark"><svg viewBox="0 0 24 24">' +
        '<path d="m12 2 9 5.2v9.6L12 22l-9-5.2V7.2L12 2Z"/>' +
        '<path d="m3 7.2 9 5.2 9-5.2M12 12.4V22"/></svg></span>' +
        '<div><div class="af-bn">AMZ OPERATIONS</div>' +
        '<div class="af-bs">亚马逊运营决策台</div></div>' +
      '</div>' +
      '<div class="af-tr">' +
        '<span class="af-on"><i></i>本地加密 · 34 个工具在线</span>' +
        '<span class="af-k">⌘ K / Ctrl K</span>' +
      '</div>';
    hero.insertBefore(top, hero.firstChild);

    var cv = el('canvas');
    cv.id = 'amz-fx-sea';
    hero.insertBefore(cv, top.nextSibling);
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var W = 0, H = 0, dpr = 1, epoch = EPOCH;
    var mx = 0, my = 0, tx = 0, ty = 0, raf = 0;

    function resize() {
      W = hero.clientWidth || window.innerWidth;
      H = hero.clientHeight || 560;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    function rnd(a, b) { return a + Math.random() * (b - a); }

    var rays = [], bubbles = [], motes = [], i;
    for (i = 0; i < 5; i++) {
      rays.push({ x:rnd(.05,.95), w:rnd(.06,.16), a:rnd(.035,.085),
                  sp:rnd(.12,.28), ph:rnd(0,6.28) });
    }
    for (i = 0; i < 30; i++) {
      bubbles.push({ x:rnd(0,1), y:rnd(0,1), r:rnd(1.2,4.6),
                     v:rnd(.012,.042), ph:rnd(0,6.28), a:rnd(.14,.42) });
    }
    for (i = 0; i < 46; i++) {
      motes.push({ x:rnd(0,1), y:rnd(0,1), r:rnd(.6,1.8),
                   ph:rnd(0,6.28), sp:rnd(.3,.9), a:rnd(.15,.5) });
    }
    var FISH = [
      { s:1.00, sp: .045, y:.16, amp:.045, fr:.38, ph:.4,  glow:'rgba(80,200,255,',  dir: 1, x:.18 },
      { s:0.66, sp: .058, y:.48, amp:.062, fr:.52, ph:2.1, glow:'rgba(150,130,255,', dir: 1, x:.60 },
      { s:0.48, sp: .072, y:.15, amp:.055, fr:.61, ph:3.7, glow:'rgba(90,230,190,',  dir: 1, x:.78 },
      { s:0.80, sp:-.040, y:.62, amp:.050, fr:.33, ph:1.2, glow:'rgba(255,140,190,', dir:-1, x:.26 },
      { s:0.42, sp:-.056, y:.34, amp:.070, fr:.47, ph:4.9, glow:'rgba(120,170,255,', dir:-1, x:.66 }
    ];

    function drawRays(t) {
      for (var n = 0; n < rays.length; n++) {
        var r = rays[n];
        var cx = (r.x + Math.sin(t * r.sp + r.ph) * .035) * W;
        var w = r.w * W;
        var g = ctx.createLinearGradient(cx, 0, cx + w * .55, H);
        g.addColorStop(0,   'rgba(150,190,255,' + r.a + ')');
        g.addColorStop(.55, 'rgba(110,160,255,' + (r.a * .35) + ')');
        g.addColorStop(1,   'rgba(110,160,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx - w * .30, 0);
        ctx.lineTo(cx + w * .30, 0);
        ctx.lineTo(cx + w * 1.05, H);
        ctx.lineTo(cx - w * .10, H);
        ctx.closePath();
        ctx.fill();
      }
    }

    function drawBubbles(t) {
      for (var n = 0; n < bubbles.length; n++) {
        var b = bubbles[n];
        var y = (1 - ((b.y + t * b.v) % 1)) * H;
        var x = b.x * W + Math.sin(t * .55 + b.ph) * 12;
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, 6.2832);
        ctx.strokeStyle = 'rgba(190,225,255,' + b.a + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - b.r * .3, y - b.r * .3, Math.max(.5, b.r * .25), 0, 6.2832);
        ctx.fillStyle = 'rgba(225,245,255,' + (b.a * .7) + ')';
        ctx.fill();
      }
    }

    function drawMotes(t) {
      for (var n = 0; n < motes.length; n++) {
        var m = motes[n];
        var a = m.a * (.55 + .45 * Math.sin(t * m.sp + m.ph));
        var x = m.x * W + Math.sin(t * .22 + m.ph) * 18 + tx * 10;
        var y = m.y * H + Math.cos(t * .19 + m.ph) * 14 + ty * 8;
        ctx.beginPath();
        ctx.arc(x, y, m.r, 0, 6.2832);
        ctx.fillStyle = 'rgba(170,205,255,' + Math.max(.02, a).toFixed(3) + ')';
        ctx.fill();
      }
    }

    /* 流线鱼身 + 摆动尾鳍 + 背腹鳍 + 侧线高光 + 眼 */
    function drawFish(f, t) {
      var p = (f.x + t * f.sp) % 1;
      if (p < 0) p += 1;
      var x = (p * 1.35 - .18) * W;
      if (f.dir < 0) x = W - x;
      var y = (f.y + Math.sin(t * f.fr + f.ph) * f.amp) * H + ty * 14;
      var sc = f.s * (.72 + Math.min(W, 1400) / 2600);
      var wag = Math.sin(t * 5.2 + f.ph) * .34;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(f.dir * sc, sc);
      ctx.rotate(Math.cos(t * f.fr + f.ph) * .07);

      /* 尾鳍 */
      ctx.save();
      ctx.translate(-46, 0);
      ctx.rotate(wag);
      var tg = ctx.createLinearGradient(-46, 0, 0, 0);
      tg.addColorStop(0, f.glow + '.03)');
      tg.addColorStop(1, f.glow + '.42)');
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-20, -20, -46, -27);
      ctx.quadraticCurveTo(-34, 0, -46, 27);
      ctx.quadraticCurveTo(-20, 20, 0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = f.glow + '.48)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      /* 身体 */
      var bg = ctx.createLinearGradient(-50, -24, 62, 22);
      bg.addColorStop(0,   f.glow + '.09)');
      bg.addColorStop(.42, f.glow + '.36)');
      bg.addColorStop(1,   f.glow + '.14)');
      ctx.beginPath();
      ctx.moveTo(64, 0);
      ctx.bezierCurveTo(38, -25, -12, -27, -46, -8);
      ctx.quadraticCurveTo(-52, 0, -46, 8);
      ctx.bezierCurveTo(-12, 27, 38, 25, 64, 0);
      ctx.closePath();
      ctx.fillStyle = bg;
      ctx.shadowColor = f.glow + '.65)';
      ctx.shadowBlur = 26;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = f.glow + '.78)';
      ctx.lineWidth = 1.35;
      ctx.stroke();

      /* 背鳍 / 腹鳍 */
      ctx.fillStyle = f.glow + '.22)';
      ctx.beginPath();
      ctx.moveTo(10, -20);
      ctx.quadraticCurveTo(-4, -40, -22, -19);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(4, 18);
      ctx.quadraticCurveTo(-8, 32, -20, 16);
      ctx.closePath(); ctx.fill();

      /* 侧线高光 */
      ctx.strokeStyle = 'rgba(235,250,255,.46)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(52, -2);
      ctx.quadraticCurveTo(6, -10, -38, -3);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220,245,255,.13)';
      for (var q = 0; q < 3; q++) {
        ctx.beginPath();
        ctx.arc(20 - q * 20, 1, 13, -1.15, 1.15);
        ctx.stroke();
      }

      /* 眼 */
      ctx.beginPath(); ctx.arc(46, -5, 3.1, 0, 6.2832);
      ctx.fillStyle = 'rgba(8,14,28,.85)'; ctx.fill();
      ctx.beginPath(); ctx.arc(47, -6, 1.15, 0, 6.2832);
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();

      ctx.restore();
    }

    function frame(ts) {
      if (epoch !== EPOCH) return;
      if (hero.clientWidth !== W || hero.clientHeight !== H) resize();
      var t = (ts || 0) / 1000;
      tx += (mx - tx) * .045;
      ty += (my - ty) * .045;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(tx * 14, ty * 10);
      drawRays(t);
      drawMotes(t);
      drawBubbles(t);
      for (var n = 0; n < FISH.length; n++) drawFish(FISH[n], t);
      ctx.restore();
      if (!REDUCE) raf = requestAnimationFrame(frame);
    }

    var hPointer = function (e) {
      mx = (e.clientX / (window.innerWidth || 1) - .5) * 2;
      my = (e.clientY / (window.innerHeight || 1) - .5) * 2;
    };
    try {
      if (window.__AMZ_FX_SEA_PTR__) window.removeEventListener('pointermove', window.__AMZ_FX_SEA_PTR__);
    } catch (e) {}
    window.addEventListener('pointermove', hPointer, { passive:true });
    window.__AMZ_FX_SEA_PTR__ = hPointer;
    raf = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ *
   * 2. 运行时色彩规范化（应对未知 / 硬编码的浅色样式）
   * ------------------------------------------------------------------ */
  var HERO_GRAD = 'linear-gradient(125deg,rgba(139,131,255,.24),rgba(76,201,255,.13) 55%,rgba(67,230,176,.09))';
  var BTN_GRAD  = 'linear-gradient(125deg,rgba(139,131,255,.42),rgba(76,201,255,.30))';
  function normalize() {
    if (SKIP_NORMALIZE || !doc.body) return;
    var nodes = doc.body.querySelectorAll('*');
    var skipRoot = '#amz-fx-bg,#amz-fx-launch,#amz-fx-palette,#amz-fx-nav,#amz-fx-toast,#amz-fx-guide,#amz-fx-sea,#amz-fx-hero-top';
    /* 首页 hero 由深海皮肤完整接管。inline !important 的换色会盖掉它的样式，
       所以这一整块（含所有子元素）跳过运行时规范化。 */
    var heroEl = doc.querySelector('.hero');
    var isHomeHero = !!(heroEl && heroEl.querySelector('.stats') && !currentTool());
    function apply(node) {
      if (node.closest && node.closest(skipRoot)) return;
      if (isHomeHero && (node === heroEl || heroEl.contains(node))) return;
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
        /* 用不透明深色面板代替「半透明玻璃 + backdrop-filter」：
           后者会让整块文字所在的合成层被重新采样，边缘发灰发糊，
           还会在 hero 与非 hero 之间形成一条明显的水平色差线。 */
        node.style.setProperty('background-color',
          big ? 'rgba(10,14,26,.88)' : 'rgba(18,23,38,.94)', 'important');
        node.style.setProperty('background-image', big ? HERO_GRAD : BTN_GRAD, 'important');
        node.style.setProperty('border-color', 'rgba(255,255,255,.12)', 'important');
        if (big) {
          node.style.setProperty('box-shadow', 'inset 0 1px 0 rgba(255,255,255,.06)', 'important');
        } else {
          node.style.setProperty('color', '#f4f7ff', 'important');
        }
      } else if (c && c.a > .55 && lum(c) > .80) {
        if (area > 4200) {
          node.style.setProperty('background-color', 'rgba(18,23,38,.93)', 'important');
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
    /* 首页 hero 的 CTA 也是工具链接，但绝不能当卡片处理：
       旧逻辑会向上找到 .hero-in 并插一枚孤立图标，还给整块标题文字
       挂上倾斜 + scale 入场动画（字形被重采样 → 发虚）。 */
    var homeHero = doc.querySelector('.hero .stats');
    var heroBox = homeHero ? homeHero.closest('.hero') : null;
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.hasAttribute('data-amz-fx-done')) continue;
      if (heroBox && heroBox.contains(a)) continue;
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
    buildHomeSea();
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
