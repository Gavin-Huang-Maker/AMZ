/*
 * AMZ 工具箱 · 本地解密加载器（外观增强版）
 * ---------------------------------------------------------------
 * 解密 / 密钥 / 密码流程与官方原版完全一致，未作任何改动。
 * 仅新增：在「门禁页」与「解密后的页面」各挂载一次 g/fx.js，
 *         并插入一段防白闪的关键样式与加载遮罩。
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
    'html{background:#070a12!important;color-scheme:dark}' +
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
    '<div class="bp-sec">底 色 配 色</div>' +
    '<div class="bp-presets">' +
    '<button data-c="">标准</button><button data-c="black">纯黑</button><button data-c="light">白底</button><button data-c="warm">暖褐</button>' +
    '</div>' +
    '<div class="bp-sec">字 体 颜 色</div>' +
    '<div class="bp-presets">' +
    '<button data-t="">默认</button><button data-t="#ffffff">纯白</button><button data-t="#ffe14d">亮黄</button><button data-t="#8fe3ff">浅青</button>' +
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
  var AMZ_VIEW = { b: 100, c: '' };

  function amzApplyFilter() {
    var b = (AMZ_VIEW.b / 100).toFixed(3);
    var f = AMZ_VIEW.c === 'light' ? 'invert(0.92) hue-rotate(180deg) ' : '';
    document.documentElement.style.filter = f + 'brightness(' + b + ')';
    var panel = document.getElementById('brightness-panel');
    if (panel) panel.style.filter = f + 'brightness(' + (100 / AMZ_VIEW.b).toFixed(3) + ')';
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

  /* 底色配色：标准(默认深色) / 纯黑 / 白底(反色滤镜，整页翻成浅色) / 暖褐 */
  function initBgScheme() {
    var KEY = 'amz-color';
    var panel = document.getElementById('brightness-panel');
    if (!panel) return;
    function apply(v) {
      AMZ_VIEW.c = v;
      var h = document.documentElement;
      h.classList.remove('amz-c-black', 'amz-c-light', 'amz-c-warm');
      if (v) h.classList.add('amz-c-' + v);
      amzApplyFilter();
    }
    var saved = localStorage.getItem(KEY) || '';
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

  /* ---------- 渲染 ---------- */
  function render(html) {
    // document.open() 保留当前 URL，写回后页面内相对路径、脚本都照常工作
    setTimeout(function () {
      // 防白闪：把关键深色样式与加载遮罩写进新文档，解析第一帧即为深色
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, function (m) { return m + CRITICAL; });
      } else {
        html = CRITICAL + html;
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
    }, 0);
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
    deriveKey(pw)
      .then(function (key) {
        return getEnc('v')
          .then(function (buf) { return decryptBuf(buf, key); })
          .then(function () {
            return crypto.subtle.exportKey('raw', key).then(function (raw) {
              return { key: key, kb64: bufToB64(raw) };
            });
          });
      })
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

  loadFx();   // 门禁页也使用同一套视觉
  boot();
})();
