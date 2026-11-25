/* Nhạc nền (2 nguồn: mp3 / YouTube) – danh sách do admin thêm, ở trang chủ chỉ nghe.
   Mỗi lúc chỉ phát MỘT nguồn: bật nguồn này thì nguồn kia tự dừng, kể cả ở cửa sổ/tab khác.
   Kèm đọc số, đọc giải bằng giọng tiếng Việt. */
(function () {
  'use strict';
  var CFG = window.KQXS_CONFIG, C = window.KQXS_CORE, S = window.KQXS_SEO;
  if (!C) return;
  var params = new URLSearchParams(location.search);
  function $(s) { return document.querySelector(s); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  var isObs = params.get('obs') === '1';

  /* Trình duyệt chỉ cho phát tiếng sau khi người dùng bấm/gõ phím ít nhất một lần */
  var unlocked = false, onUnlock = [];
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try { if (window.speechSynthesis) speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) { }
    var b = $('#obs-snd'); if (b) b.hidden = true;
    onUnlock.forEach(function (f) { try { f(); } catch (e) { } });
    onUnlock = [];
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, unlock, { once: true, capture: true }); });

  /* ====================== NHẠC ====================== */
  var MC = CFG.music || {};
  var Music = (function () {
    var folder = [], sys = [], links = [], src = lsGet('kqxs_msrc') || '', idx = { sys: -1, link: -1 };
    var playing = false, errs = 0, duckF = 1;
    var vol = lsGet('kqxs_mvol') != null ? +lsGet('kqxs_mvol') : (MC.volume != null ? MC.volume : 0.35);
    var audio = new Audio(); audio.preload = 'auto';
    var ytCur = null;
    var wanted = params.has('music') ? params.get('music') === '1' : lsGet('kqxs_music') === '1';

    /* --- Chỉ một cửa sổ phát nhạc tại một thời điểm --- */
    var me = Math.random().toString(36).slice(2);
    var bc = null; try { bc = new BroadcastChannel('kqxs-music'); } catch (e) { }
    function announcePlay() {
      var msg = { who: me, t: Date.now() };
      if (bc) { try { bc.postMessage(msg); } catch (e) { } }
      lsSet('kqxs_mplay', JSON.stringify(msg));
    }
    function otherStarted(m) {
      if (!m || m.who === me || !playing) return;
      stop(); now('Đã dừng vì nhạc đang phát ở cửa sổ khác.');
    }
    if (bc) bc.onmessage = function (e) { otherStarted(e.data); };
    window.addEventListener('storage', function (e) {
      if (e.key === 'kqxs_mplay' && e.newValue) { try { otherStarted(JSON.parse(e.newValue)); } catch (x) { } }
    });

    function now(t, s2) {
      s2 = s2 || src || 'sys';
      ['sys', 'link'].forEach(function (k) { var e = $('#m-now-' + k); if (e) e.textContent = k === s2 ? (t || '') : ''; });
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    function parse(u) {
      u = String(u || '').trim(); if (!u) return null;
      var m = /[?&]list=([\w-]+)/.exec(u);
      if (m && /youtu/.test(u)) return { type: 'yt-list', id: m[1], label: 'Danh sách phát YouTube' };
      m = /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/.exec(u);
      if (m) return { type: 'yt-video', id: m[1], label: 'Video YouTube' };
      if (/^https?:\/\//i.test(u)) {
        var name = ''; try { name = decodeURIComponent(u.split('/').pop().split('?')[0]); } catch (e) { name = 'Bài nhạc'; }
        return { type: 'file', src: u, label: name.replace(/-[A-Za-z0-9]{20,}(?=\.\w+$)/, '') };
      }
      return null;
    }
    function fromSite() {
      var site = (C.getSite && C.getSite()) || window.KQXS_SITE || {};
      var list = Array.isArray(site.music) ? site.music : [];
      var files = [], yts = [];
      list.forEach(function (m) {
        var p = parse(m && m.url); if (!p) return;
        p.url = m.url; p.title = m.title || '';
        if (p.type === 'file') files.push(p); else yts.push(p);
      });
      // Giữ bài đang phát nếu danh sách thay đổi
      var cur = playing ? list2()[idx[src]] : null;
      sys = folder.concat(files); links = yts;
      if (cur) {
        var l = list2(), j = -1;
        for (var i = 0; i < l.length; i++) if ((l[i].url || l[i].src) === (cur.url || cur.src)) { j = i; break; }
        idx[src] = j;
      } else { if (idx.sys >= sys.length) idx.sys = -1; if (idx.link >= links.length) idx.link = -1; }
      render();
    }
    function list2() { return src === 'link' ? links : sys; }
    function nameOf(it) { return it.title || it.label; }

    function discoverLocal() {
      var f = MC.folder || 'music/', from = MC.from || 1, to = MC.to || 20, jobs = [];
      for (var i = from; i <= to; i++) (function (n) {
        var s = f + n + '.mp3';
        jobs.push(fetch(s, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
          var ct = r.headers.get('content-type') || '';
          return (r.ok && /audio|octet-stream|mpeg/i.test(ct)) ? { type: 'file', src: s, url: s, label: 'Bài ' + n + '.mp3' } : null;
        }).catch(function () { return null; }));
      })(i);
      return Promise.all(jobs).then(function (a) { folder = a.filter(Boolean); fromSite(); return folder.length; });
    }

    /* ---- Danh sách hiển thị (chỉ nghe, không thêm/sửa/xóa) ---- */
    function render() {
      var a = $('#m-syslist'), b = $('#m-linklist');
      function row(it, i, s) {
        var on = src === s && idx[s] === i && playing;
        return '<li class="' + (on ? 'on' : '') + '"><span class="no">' + (i + 1) + '</span><span class="nm">' + esc(nameOf(it)) + '</span>' +
          '<span class="ac"><button type="button" data-s="' + s + '" data-a="play" data-i="' + i + '">' + (on ? 'Đang phát' : 'Phát') + '</button></span></li>';
      }
      if (a) a.innerHTML = sys.length ? sys.map(function (it, i) { return row(it, i, 'sys'); }).join('') : '<li class="empty">Chưa có bài mp3 nào.</li>';
      if (b) b.innerHTML = links.length ? links.map(function (it, i) { return row(it, i, 'link'); }).join('') : '<li class="empty">Chưa có bài YouTube nào.</li>';
      ['sys', 'link'].forEach(function (k) {
        var p = $('.tr[data-s="' + k + '"] [data-tr="play"]');
        if (p) { var on = playing && src === k; p.classList.toggle('on', on); p.textContent = on ? '▶ Đang phát' : '▶ Phát'; }
      });
    }

    function applyVol() {
      var v = Math.max(0, Math.min(1, vol * duckF));
      audio.volume = v;
      ytPost('setVolume', [Math.round(v * 100)]);
    }

    /* ---- YouTube: nhúng iframe trực tiếp ---- */
    function ytPost(func, args) {
      var f = document.querySelector('.ytbox iframe'); if (!f || !f.contentWindow) return;
      try { f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: args || [] }), '*'); } catch (e) { }
    }
    function ytClear() {
      var box = document.querySelector('.ytbox'); if (!box) return;
      var f = box.querySelector('iframe'); if (f) { f.src = 'about:blank'; box.removeChild(f); }
      ytCur = null;
    }
    window.addEventListener('message', function (e) {
      if (!/youtube(-nocookie)?\.com$/.test((e.origin || '').replace(/^https?:\/\//, ''))) return;
      var d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (x) { return; } }
      if (!d || !ytCur) return;
      if (d.event === 'onStateChange') {
        if (d.info === 1) { errs = 0; now('♪ ' + nameOf(ytCur)); }
        else if (d.info === 3) now('Đang đệm nhạc YouTube...');
        else if (d.info === 0 && ytCur.type === 'yt-video') next();
      } else if (d.event === 'onError') {
        var c = d.info, why = (c === 101 || c === 150 || c === 153) ? 'video không cho phép nhúng' : (c === 100 ? 'video riêng tư hoặc đã xóa' : 'lỗi phát (mã ' + c + ')');
        now('Bỏ qua bài YouTube: ' + why + '.');
        if (++errs <= list2().length) setTimeout(next, 1500); else stop();
      }
    });
    function playYT(it) {
      audio.pause();
      var box = document.querySelector('.ytbox');
      if (!box) { now('Thiếu khung video YouTube trong trang.'); return; }
      if (location.protocol === 'file:') { now('YouTube chỉ phát khi trang chạy qua http(s) (đã đưa lên Vercel).'); return; }
      ytClear(); ytCur = it;
      var o = '&origin=' + encodeURIComponent(location.origin);
      var s = it.type === 'yt-list'
        ? 'https://www.youtube.com/embed/videoseries?list=' + it.id + '&'
        : 'https://www.youtube.com/embed/' + it.id + '?';
      var f = document.createElement('iframe');
      f.title = 'Nhạc YouTube'; f.src = s + 'autoplay=1&playsinline=1&rel=0&enablejsapi=1' + o;
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.setAttribute('allowfullscreen', ''); f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.addEventListener('load', function () {
        try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch (e) { }
        applyVol(); setTimeout(applyVol, 800);
      });
      box.appendChild(f);
      now('Đang mở YouTube... nếu chưa nghe tiếng, bấm nút play ngay trong khung video.');
    }

    function playAt(i) {
      var l = list2();
      if (!l.length) { playing = false; render(); now(src === 'link' ? 'Chưa có bài YouTube nào.' : 'Chưa có bài mp3 nào.'); return; }
      i = ((i % l.length) + l.length) % l.length;
      // Dừng nguồn còn lại trước khi phát (không bao giờ phát 2 nguồn cùng lúc)
      audio.pause(); ytClear();
      idx[src] = i;
      var it = l[i]; playing = true; render();
      lsSet('kqxs_msrc', src);
      announcePlay();
      if (it.type === 'file') {
        audio.src = it.src; applyVol();
        now('♪ ' + nameOf(it) + ' (' + (i + 1) + '/' + l.length + ')');
        var p = audio.play();
        if (p && p.catch) p.catch(function () {
          playing = false; render();
          now('Bấm vào trang một lần để bật nhạc (trình duyệt chặn tự phát).');
          onUnlock.push(function () { if (wanted) start(); });
        });
      } else playYT(it);
    }
    function next() { playAt(idx[src] + 1); }
    function stop() { playing = false; audio.pause(); ytClear(); render(); }
    function start() { if (!playing) playAt(idx[src] < 0 ? 0 : idx[src]); }

    audio.addEventListener('ended', next);
    audio.addEventListener('playing', function () { errs = 0; });
    audio.addEventListener('error', function () {
      if (!playing) return;
      if (++errs <= list2().length) next(); else { stop(); now('Không phát được bài nào trong nguồn này.'); }
    });

    function onList(e) {
      var b = e.target.closest('button[data-a="play"]'); if (!b) return;
      unlock(); if (playing) stop();
      src = b.dataset.s; wanted = true; lsSet('kqxs_music', '1'); playAt(+b.dataset.i);
    }
    function transport(s2, act) {
      unlock();
      if (act === 'stop') { if (src === s2 || !src) { wanted = false; lsSet('kqxs_music', '0'); stop(); now('Đã dừng.', s2); } return; }
      if (src !== s2) { if (playing) stop(); src = s2; }
      wanted = true; lsSet('kqxs_music', '1');
      if (act === 'play') { if (!playing) playAt(idx[src] < 0 ? 0 : idx[src]); }
      else if (act === 'next') playAt(idx[src] + 1);
      else if (act === 'prev') playAt(idx[src] < 0 ? 0 : idx[src] - 1);
    }
    return {
      init: function () {
        applyVol();
        var v = $('#m-vol'); if (v) v.value = Math.round(vol * 100);
        ['#m-syslist', '#m-linklist'].forEach(function (s) { var e = $(s); if (e) e.addEventListener('click', onList); });
        document.querySelectorAll('.tr[data-s]').forEach(function (box) {
          box.addEventListener('click', function (e) { var b = e.target.closest('[data-tr]'); if (b) transport(box.dataset.s, b.dataset.tr); });
        });
        document.addEventListener('kqxs:settings', fromSite);
        fromSite();
        discoverLocal().then(function () {
          if (src !== 'link' && src !== 'sys') src = sys.length ? 'sys' : 'link';
          if (src === 'sys' && !sys.length && links.length) src = 'link';
          render();
          if (wanted) { if (unlocked) start(); else { now('Nhạc sẽ tự phát sau cú bấm đầu tiên.'); onUnlock.push(start); } }
        });
      },
      setVol: function (v) { vol = v; lsSet('kqxs_mvol', String(v)); applyVol(); },
      duck: function (on) { duckF = on ? (MC.duckTo != null ? MC.duckTo : 0.25) : 1; applyVol(); },
      wanted: function () { return wanted; }
    };
  })();

  /* ====================== ĐỌC SỐ ====================== */
  var VC = CFG.voice || {};
  var DIGIT = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  var PNAME = { g8: 'giải tám', g7: 'giải bảy', g6: 'giải sáu', g5: 'giải năm', g4: 'giải tư', g3: 'giải ba', g2: 'giải nhì', g1: 'giải nhất', db: 'giải đặc biệt' };
  var NT_ORDER = ['g8', 'g7', 'g6', 'g5', 'g4', 'g3', 'g2', 'g1', 'db'];
  var ORDER = { nam: NT_ORDER, trung: NT_ORDER, bac: ['g7', 'g6', 'g5', 'g4', 'g3', 'g2', 'g1', 'db'] };
  var voiceOn = params.has('voice') ? params.get('voice') === '1' : lsGet('kqxs_voice') === '1';
  var viVoice = null, pending = 0;
  var hasTTS = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);

  // Chỉ dùng giọng TIẾNG VIỆT. Ưu tiên giọng tự nhiên của máy (Edge: HoaiMy/NamMinh Online; Chrome: Google tiếng Việt).
  // Máy không có giọng tiếng Việt thì đọc bằng giọng Google tiếng Việt qua máy chủ của trang (/api/tts).
  function rankVoice(v) {
    var n = v.name || '';
    if (/HoaiMy|NamMinh|Natural|Online/i.test(n)) return 3;
    if (/Google/i.test(n)) return 2;
    return v.localService ? 1 : 1.5;
  }
  function pickVoice() {
    viVoice = null;
    if (hasTTS) {
      var vs = (speechSynthesis.getVoices() || []).filter(function (v) { return /^vi([-_]|$)/i.test(v.lang || ''); });
      vs.sort(function (a, b) { return rankVoice(b) - rankVoice(a); });
      viVoice = vs[0] || null;
    }
    var n = $('#v-note');
    if (!n) return;
    n.textContent = viVoice ? 'Giọng tiếng Việt: ' + viVoice.name : 'Giọng tiếng Việt: Google (đọc qua máy chủ của trang)';
  }
  if (hasTTS) { pickVoice(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', pickVoice); }

  /* Đọc qua máy chủ (khi máy không có giọng tiếng Việt): xếp hàng từng đoạn mp3 */
  var ttsQ = [], ttsAudio = new Audio(), ttsBusy = false;
  ttsAudio.preload = 'auto';
  function ttsNext() {
    if (!ttsQ.length) { ttsBusy = false; if (!pending) Music.duck(false); return; }
    ttsBusy = true; Music.duck(true);
    ttsAudio.src = 'api/tts?q=' + encodeURIComponent(ttsQ.shift());
    ttsAudio.volume = VC.volume != null ? VC.volume : 1;
    ttsAudio.playbackRate = Math.max(0.5, Math.min(1.5, (VC.rate || 0.9) + 0.1));
    var p = ttsAudio.play(); if (p && p.catch) p.catch(ttsNext);
  }
  ttsAudio.addEventListener('ended', ttsNext);
  ttsAudio.addEventListener('error', ttsNext);
  function chunks(text) {
    var out = [], cur = '';
    String(text).split(/(?<=[,.:;])\s+/).forEach(function (part) {
      if ((cur + ' ' + part).trim().length > 180) { if (cur) out.push(cur); cur = part; } else cur = (cur + ' ' + part).trim();
    });
    if (cur) out.push(cur);
    return out;
  }
  function stopSpeech() {
    if (hasTTS) speechSynthesis.cancel();
    ttsQ = []; try { ttsAudio.pause(); } catch (e) { } ttsBusy = false; pending = 0; Music.duck(false);
  }

  function say(text) {
    if (!voiceOn) return;
    if (!viVoice) {
      if (ttsQ.length > 20) ttsQ = [];
      ttsQ = ttsQ.concat(chunks(text));
      if (!ttsBusy) ttsNext();
      return;
    }
    if (pending > 12) { speechSynthesis.cancel(); pending = 0; Music.duck(false); }
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN'; u.voice = viVoice;
    u.rate = VC.rate || 0.9; u.volume = VC.volume != null ? VC.volume : 1;
    pending++;
    u.onstart = function () { Music.duck(true); };
    var done = function () { pending = Math.max(0, pending - 1); if (!pending && !ttsBusy) Music.duck(false); };
    u.onend = done; u.onerror = done;
    speechSynthesis.speak(u);
  }
  function spell(v) { return String(v).split('').map(function (ch) { return /\d/.test(ch) ? DIGIT[+ch] : ch; }).join(' '); }
  function isSet(v) { return v !== undefined && v !== null && v !== ''; }
  function arr(doc, key, pi, id) {
    var ps = doc && doc[key] && doc[key].provinces, p = ps && ps[pi];
    return (p && p.prizes && p.prizes[id]) || [];
  }

  function announce(prev, next) {
    var tab = C.getTab();
    var keys = (tab === 'nam' || tab === 'trung' || tab === 'bac') ? [tab] : ['nam', 'trung', 'bac'];
    keys.forEach(function (k) {
      var np = (next && next[k] && next[k].provinces) || [];
      var pp = (prev && prev[k] && prev[k].provinces) || [];
      var n = Math.max(np.length, pp.length);
      ORDER[k].forEach(function (id) {
        for (var pi = 0; pi < n; pi++) {
          var a = arr(prev, k, pi, id), b = arr(next, k, pi, id), fresh = [];
          b.forEach(function (v, i) { if (isSet(v) && !isSet(a[i])) fresh.push(v); });
          if (!fresh.length) continue;
          var who = k === 'bac' ? 'Miền Bắc' : S.name((np[pi] || pp[pi] || {}).name || '');
          say(who + ', ' + PNAME[id] + ': ' + fresh.map(spell).join(', '));
        }
      });
    });
    if (keys.indexOf('bac') >= 0) {
      [['dt123', 'Điện toán một hai ba'], ['thantai', 'Thần tài']].forEach(function (x) {
        var a = (prev && prev[x[0]]) || [], b = (next && next[x[0]]) || [], fresh = [];
        b.forEach(function (v, i) { if (isSet(v) && !isSet(a[i])) fresh.push(v); });
        if (fresh.length) say(x[1] + ': ' + fresh.map(spell).join(', '));
      });
    }
  }

  // Lần tải đầu chỉ ghi nhớ số đã có (không đọc lại cả bảng khi mở trang giữa buổi quay)
  document.addEventListener('kqxs:data', function (e) {
    var d = e.detail;
    if (d.first || !voiceOn || !d.data) return;
    announce(d.prev, d.data);
  });

  function setVoiceBtn() {
    var b = $('#v-toggle'); if (!b) return;
    b.textContent = 'Đọc số: ' + (voiceOn ? 'Bật' : 'Tắt');
    b.setAttribute('aria-pressed', voiceOn);
    b.classList.toggle('on', voiceOn);
  }

  /* ====================== NỐI GIAO DIỆN ====================== */
  document.addEventListener('DOMContentLoaded', function () {
    setVoiceBtn(); pickVoice();
    $('#m-vol').addEventListener('input', function (e) { Music.setVol(e.target.value / 100); });
    $('#v-toggle').addEventListener('click', function () {
      unlock(); voiceOn = !voiceOn; lsSet('kqxs_voice', voiceOn ? '1' : '0'); setVoiceBtn();
      if (voiceOn) say('Đã bật đọc số'); else stopSpeech();
    });
    $('#v-test').addEventListener('click', function () {
      unlock();
      var was = voiceOn; voiceOn = true;
      say('Đài ' + S.name('Đồng Nai') + ', giải tám: ' + spell('03') + '. Giải đặc biệt: ' + spell('123456'));
      voiceOn = was;
    });
    Music.init();

    // Khi phát sóng (?obs=1) các nút bị ẩn: hiện một nút nhỏ để bấm bật âm thanh một lần
    if (isObs && (voiceOn || Music.wanted())) {
      var b = $('#obs-snd');
      if (b) { b.hidden = false; b.addEventListener('click', unlock); }
    }
  });
})();
