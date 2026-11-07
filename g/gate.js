/*
 * AMZ 工具箱 · 本地解密加载器
 * ---------------------------------------------------------------
 * 这里没有任何秘密：密钥由用户输入的密码 + 公开 salt 在浏览器内
 * 用 PBKDF2 现算出来，只存在于本次会话的内存/本机存储里。
 * 没有密码，dist/p/ 里的密文就是一堆随机字节。
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
    $msg.textContent = text || '';
    $msg.className = 'msg' + (kind ? ' ' + kind : '');
  }
  function showForm(text) {
    $boot.classList.add('hide');
    $gate.style.display = '';
    if (text) say(text, 'err');
    setTimeout(function () { $pw.focus(); }, 60);
  }
  function setBusy(on, label) {
    busy = on;
    $go.disabled = on;
    $go.textContent = on ? (label || '正在解密…') : '进入工具箱';
    $pw.disabled = on;
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
      document.open();
      document.write(html);
      document.close();
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
    var pw = $pw.value;
    if (!pw) { say('请输入密码。', 'err'); $pw.focus(); return; }

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
        $pw.value = '';
        $pw.focus();
      });
  }

  $go.addEventListener('click', submit);
  $pw.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') submit();
  });

  boot();
})();
