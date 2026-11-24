/* Dòng chữ chạy ngang qua khung kết quả. Nội dung, tốc độ, vị trí do admin cài (mục 3. Chữ chạy).
   Áp dụng cho mọi máy đang xem (kể cả cửa sổ livestream). Thêm ?ticker=off vào link để tắt ở một khung xem. */
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  if (params.get('ticker') === 'off') return;
  var W = 3840, cfg = null, sig = '', timer = null, anim = null, el = null;

  function stage() { return document.getElementById('stage'); }
  function clear() {
    clearInterval(timer); timer = null;
    if (anim) { try { anim.cancel(); } catch (e) { } anim = null; }
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
    var s = stage(); if (s) s.classList.remove('mq-on-mid', 'mq-on-top', 'mq-on-bot');
  }
  function run() {
    var s = stage(); if (!s || !cfg || anim) return;
    el = document.createElement('div');
    el.className = 'mq ' + cfg.pos;
    el.setAttribute('aria-hidden', 'true');
    var t = document.createElement('span');
    t.className = 'mq-t'; t.textContent = cfg.text;
    el.appendChild(t);
    s.appendChild(el);
    s.classList.add('mq-on-' + cfg.pos);
    var w = t.offsetWidth || 2000;
    var ms = Math.max(3, cfg.seconds) * 1000 * (W + w) / W;
    if (!t.animate) { t.style.transform = 'translateX(0)'; setTimeout(done, ms); return; }
    anim = t.animate([{ transform: 'translateX(' + W + 'px)' }, { transform: 'translateX(' + (-w) + 'px)' }], { duration: ms, easing: 'linear' });
    anim.onfinish = done;
    function done() {
      anim = null;
      if (el && el.parentNode) el.parentNode.removeChild(el);
      el = null;
      s.classList.remove('mq-on-' + cfg.pos);
    }
  }
  function apply(t) {
    t = t || {};
    var c = { text: String(t.text || '').trim(), on: !!t.on, everySec: +t.everySec || 0, seconds: +t.seconds || 20,
      pos: ['mid', 'top', 'bot'].indexOf(t.pos) >= 0 ? t.pos : 'mid', id: t.id || 0 };
    var s2 = JSON.stringify(c);
    if (s2 === sig) return;
    sig = s2; clear();
    if (!c.on || !c.text) { cfg = null; return; }
    cfg = c;
    run();
    if (c.everySec > 0) timer = setInterval(run, Math.max(5, c.everySec) * 1000);
  }
  document.addEventListener('kqxs:settings', function (e) { apply(e.detail && e.detail.ticker); });
  document.addEventListener('DOMContentLoaded', function () {
    var S = window.KQXS_SITE; if (S) apply(S.ticker);
  });
})();
