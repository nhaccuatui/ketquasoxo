(function () {
  'use strict';
  var CFG = window.KQXS_CONFIG;
  var TZ = 'Asia/Ho_Chi_Minh';
  var WD_SHORT = ['CN', 'T.Hai', 'T.Ba', 'T.Tư', 'T.Năm', 'T.Sáu', 'T.Bảy'];
  var WD_FULL = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

  var SCHEDULE = window.KQXS_SCHEDULE;

  // [id, nhãn, giá trị, số lượng]
  var PR_NT = [
    ['g8', 'Giải Tám', '100N', 1], ['g7', 'Giải Bảy', '200N', 1], ['g6', 'Giải Sáu', '400N', 3],
    ['g5', 'Giải Năm', '1Tr', 1], ['g4', 'Giải Tư', '3Tr', 7], ['g3', 'Giải Ba', '10Tr', 2],
    ['g2', 'Giải Nhì', '15Tr', 1], ['g1', 'Giải Nhất', '30Tr', 1], ['db', 'Đặc Biệt', '2 Tỷ', 1]
  ];
  var PR_BAC = [
    ['db', 'Đặc Biệt', '500Tr', 1], ['g1', 'Giải Nhất', '10Tr', 1], ['g2', 'Giải Nhì', '5Tr', 2],
    ['g3', 'Giải Ba', '1Tr', 6], ['g4', 'Giải Tư', '400N', 4], ['g5', 'Giải Năm', '200N', 6],
    ['g6', 'Giải Sáu', '100N', 3], ['g7', 'Giải Bảy', '40N', 4]
  ];
  // Số giải trên một hàng
  var PER = {
    nam: { all: {}, single: { g6: 3, g4: 1, g3: 2 } },
    trung: { all: {}, single: { g6: 3, g4: 1, g3: 2 } },
    bac: {
      all: { db: 1, g1: 1, g2: 2, g3: 2, g4: 2, g5: 2, g6: 3, g7: 4 },
      single: { db: 1, g1: 1, g2: 2, g3: 3, g4: 4, g5: 3, g6: 3, g7: 4 }
    }
  };
  var REG = {
    nam: { title: 'MIỀN NAM', short: 'Miền Nam', prizes: PR_NT },
    trung: { title: 'MIỀN TRUNG', short: 'Miền Trung', prizes: PR_NT },
    bac: { title: 'MIỀN BẮC', short: 'Miền Bắc', prizes: PR_BAC }
  };

  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }

  /* ---------- Nội dung trang do admin cài (tên trang, chữ 2 bên, watermark, chân trang...) ---------- */
  var DEF = CFG.site || {};
  var SITE = merge(DEF, (function () { try { return JSON.parse(lsGet('kqxs_site') || '{}'); } catch (e) { return {}; } })());
  function merge(a, b) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    for (k in b) if (b[k] !== undefined && b[k] !== null) o[k] = b[k];
    o.ticker = Object.assign({}, a.ticker || {}, b.ticker || {});
    o.music = Array.isArray(b.music) ? b.music : (a.music || []);
    return o;
  }
  window.KQXS_SITE = SITE;
  var siteSig = '';
  function applySite(first) {
    var sig = JSON.stringify(SITE);
    if (!first && sig === siteSig) return;
    siteSig = sig;
    window.KQXS_SITE = SITE;
    var h1 = $('#s-line1'), p = $('#s-line2');
    if (h1) h1.textContent = SITE.line1;
    if (p) p.textContent = SITE.line2;
    var f1 = $('#f-1'), f2 = $('#f-2');
    if (f1) {
      var t = String(SITE.footer1 || ''), i = t.indexOf(':');
      f1.innerHTML = (i > 0 && i <= 14) ? '<strong>' + esc(t.slice(0, i + 1)) + '</strong>' + esc(t.slice(i + 1)) : esc(t);
    }
    if (f2) f2.textContent = SITE.footer2;
    buildWatermark();
    if (!first) render();
    document.dispatchEvent(new CustomEvent('kqxs:settings', { detail: SITE }));
  }
  function loadSite() {
    var u = CFG.settingsUrl || 'api/settings';
    fetch(u + '?_=' + Math.floor(Date.now() / 5000), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || typeof j !== 'object') return;
        lsSet('kqxs_site', JSON.stringify(j));
        SITE = merge(DEF, j);
        applySite(false);
      }).catch(function () { });
  }

  /* ---------- Thời gian (luôn theo giờ Việt Nam) ---------- */
  function vnNow() {
    var f = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short'
    });
    var o = {};
    f.formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
    return {
      y: +o.year, m: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second,
      wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday)
    };
  }

  var params = new URLSearchParams(location.search);
  var dateParam = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '') ? params.get('date') : null;

  function viewDate() {
    var n = vnNow(), y = n.y, m = n.m, d = n.d, wd = n.wd, isToday = true;
    // Trước giờ chuyển ngày (mặc định 14:00) vẫn hiện kết quả của ngày hôm trước; từ 14:00 mới chờ kết quả hôm nay
    // Giờ chuyển ngày do admin cài (mục 2), mặc định 14:00
    var ro = /^(\d{1,2}):(\d{2})$/.exec(String(SITE.rollover || '')), cut = ro ? (+ro[1]) * 60 + (+ro[2]) : (CFG.rolloverHour != null ? CFG.rolloverHour : 14) * 60;
    if (!dateParam && n.h * 60 + n.mi < cut) {
      var yd = new Date(Date.UTC(y, m - 1, d - 1));
      y = yd.getUTCFullYear(); m = yd.getUTCMonth() + 1; d = yd.getUTCDate(); wd = yd.getUTCDay(); isToday = false;
    }
    if (dateParam) {
      var p = dateParam.split('-').map(Number);
      y = p[0]; m = p[1]; d = p[2];
      wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      isToday = (y === n.y && m === n.m && d === n.d);
    }
    return {
      iso: y + '-' + pad(m) + '-' + pad(d), dmy: pad(d) + '/' + pad(m) + '/' + y, dm: pad(d) + '/' + pad(m),
      wd: wd, wdShort: WD_SHORT[wd], wdFull: WD_FULL[wd], isToday: isToday
    };
  }
  function drawSecs(key) { var t = CFG.drawTime[key].split(':'); return (+t[0]) * 3600 + (+t[1]) * 60; }
  function nowSecs() { var n = vnNow(); return n.h * 3600 + n.mi * 60 + n.s; }
  function hLabel(key) { var t = CFG.drawTime[key].split(':'); return t[0] + 'h' + t[1]; }
  function hmmss(sec) {
    sec = Math.max(0, sec);
    return pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor(sec % 3600 / 60)) + ':' + pad(sec % 60);
  }

  /* ---------- Dữ liệu ---------- */
  var data = null, dataSig = '';
  var TABS = ['all', 'nam', 'trung', 'bac'].concat(CFG.embedUrl ? ['embed'] : []);
  var tab = TABS.indexOf(params.get('tab')) >= 0 ? params.get('tab') : 'all';

  function provinces(key) {
    var list = data && data[key] && data[key].provinces;
    if (list && list.length) return list;
    return SCHEDULE[viewDate().wd][key].map(function (n) { return { name: n, prizes: {} }; });
  }
  function regionStats(key) {
    var defs = REG[key].prizes, any = false, complete = true;
    provinces(key).forEach(function (p) {
      defs.forEach(function (d) {
        var got = ((p.prizes && p.prizes[d[0]]) || []).filter(Boolean).length;
        if (got) any = true;
        if (got < d[3]) complete = false;
      });
    });
    return { any: any, complete: complete };
  }
  function status(key) {
    var s = regionStats(key), V = viewDate();
    if (s.complete && s.any) return 'done';
    if (!V.isToday) return s.any ? 'done' : 'nodata';
    if (nowSecs() < drawSecs(key) && !s.any) return 'waiting';
    return 'drawing';
  }

  var loaded = false, lastIso = '', embedIso = '';
  function fetchFirst(urls, i, allMissing) {
    if (i >= urls.length) { var e = new Error('no data'); e.allMissing = allMissing; return Promise.reject(e); }
    return fetch(urls[i], { cache: 'no-store' }).then(function (r) {
      if (!r.ok) { var er = new Error('HTTP ' + r.status); er.status = r.status; throw er; }
      return r.json();
    }).catch(function (er) { return fetchFirst(urls, i + 1, allMissing && er.status === 404); });
  }
  // Áp dữ liệu mới và báo cho các module khác (đọc số...) biết có số mới
  function apply(j, sig) {
    var first = !loaded; loaded = true;
    if (sig === dataSig) return;
    var prev = data; dataSig = sig; data = j;
    render();
    document.dispatchEvent(new CustomEvent('kqxs:data', { detail: { prev: prev, data: j, first: first } }));
  }
  var lastLoadOk = Date.now();
  // Đang trong giờ quay mà không có số (quá 2,5 phút) hoặc mất kết nối máy chủ quá 90 giây
  // → hiện khung trực tiếp của Minh Ngọc thay cho bảng đang chờ
  function fallbackKey() {
    if (!CFG.liveFallbackUrl || dateParam) return null;
    var V = viewDate(); if (!V.isToday) return null;
    var keys = (tab === 'nam' || tab === 'trung' || tab === 'bac') ? [tab] : (tab === 'all' ? ['nam', 'trung', 'bac'] : []);
    var ns = nowSecs();
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], d = drawSecs(k), s = regionStats(k);
      if (ns < d || ns > d + 2700 || s.complete) continue;
      if ((ns >= d + 150 && !s.any) || Date.now() - lastLoadOk > 90000) return k;
    }
    return null;
  }
  function load() {
    var iso = viewDate().iso;
    // Mốc 2 giây: mọi người xem cùng lúc dùng chung 1 bản đệm của Vercel (tiết kiệm hạn mức Redis)
    var bucket = Math.floor(Date.now() / 2000);
    var urls = CFG.dataUrls.map(function (u) {
      u = u.replace('{date}', iso);
      return u + (u.indexOf('?') >= 0 ? '&' : '?') + '_=' + bucket;
    });
    fetchFirst(urls, 0, true).then(function (j) { lastLoadOk = Date.now(); apply(j, JSON.stringify(j)); }, function (e) {
      if (e.allMissing) lastLoadOk = Date.now();
      // Lỗi mạng tạm thời: giữ nguyên số đang hiện. Chỉ xóa khi nguồn báo rõ "chưa có dữ liệu".
      if (e.allMissing) apply(null, 'none');
    });
  }
  // Trong giờ quay (10 phút trước Miền Nam đến 45 phút sau Miền Bắc) hỏi nhanh; ngoài giờ hỏi chậm
  function liveWindow() {
    if (!viewDate().isToday) return false;
    var ns = nowSecs();
    return ns >= drawSecs('nam') - 600 && ns <= drawSecs('bac') + 2700;
  }
  function pollLoop() {
    load();
    var s = liveWindow() ? (CFG.pollSeconds || 4) : (CFG.idlePollSeconds || 60);
    setTimeout(pollLoop, Math.max(3, s) * 1000);
  }

  /* ---------- Dựng HTML ---------- */
  function waitIcon(spin) { return '<span class="wait' + (spin ? ' spin' : '') + '"></span>'; }
  function perOf(key, mode, id) { return PER[key][mode][id] || 1; }

  // Số chữ số của từng giải và thứ tự quay
  var DIGITS = {
    nam: { g8: 2, g7: 3, g6: 4, g5: 4, g4: 5, g3: 5, g2: 5, g1: 5, db: 6 },
    bac: { g1: 5, g2: 5, g3: 5, g4: 4, g5: 4, g6: 3, g7: 2, db: 5 }
  };
  DIGITS.trung = DIGITS.nam;
  var DRAW_ORDER = { nam: ['g8', 'g7', 'g6', 'g5', 'g4', 'g3', 'g2', 'g1', 'db'], bac: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'db'] };
  DRAW_ORDER.trung = DRAW_ORDER.nam;
  // Ô sắp ra số của một đài: ô trống đầu tiên theo thứ tự quay
  function nextSlot(key, p) {
    var o = DRAW_ORDER[key], defs = REG[key].prizes;
    for (var a = 0; a < o.length; a++) {
      var n = 0; defs.forEach(function (d) { if (d[0] === o[a]) n = d[3]; });
      var arr = (p.prizes && p.prizes[o[a]]) || [];
      for (var i = 0; i < n; i++) if (!arr[i]) return { id: o[a], i: i };
    }
    return null;
  }
  function rollDigits(n) { var s = ''; for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 10); return s; }
  function cell(id, n, vals, spin, per, extra, roll) {
    var h = '<div class="cell p-' + id + '" style="--per:' + per + '">' + (extra || '');
    for (var i = 0; i < n; i++) {
      var v = vals && vals[i];
      if (v) h += '<span class="num">' + esc(v) + '</span>';
      else if (roll && roll.id === id && roll.i === i) h += '<span class="num roll" data-n="' + roll.len + '">' + rollDigits(roll.len) + '</span>';
      else h += waitIcon(spin);
    }
    return h + '</div>';
  }
  function kyhieu() {
    var arr = (data && data.bac && data.bac.kyhieu) || [], h = '<div class="kh">';
    for (var i = 0; i < 6; i++) h += '<span>' + esc(arr[i] || '') + '</span>';
    return h + '</div>';
  }

  // Trạng thái nằm ở MỘT DÒNG RIÊNG, không đè lên số
  function strip(key, st, mode) {
    var t;
    if (st === 'waiting') {
      t = (mode === 'single' ? 'Chờ quay kết quả · ' : 'Chờ quay · ') + '<b>' + hLabel(key) + '</b> · còn <span data-cd="' + key + '">--:--:--</span>';
    } else if (st === 'drawing') t = 'ĐANG QUAY THƯỞNG';
    else if (st === 'done') t = viewDate().isToday ? 'ĐÃ XỔ XONG' : 'ĐÃ XỔ XONG · KẾT QUẢ NGÀY ' + viewDate().dm;
    else t = viewDate().isToday ? 'CHƯA CÓ DỮ LIỆU' : 'CHƯA CÓ DỮ LIỆU NGÀY ' + viewDate().dm;
    return '<div class="stt ' + st + '"><span class="d">' + (st === 'drawing' ? LIVE_SVG : '') + '</span><span>' + t + '</span></div>';
  }

  function regionTable(key, mode) {
    var R = REG[key], V = viewDate(), st = status(key), spin = st === 'drawing';
    var rolling = st === 'drawing' && V.isToday && nowSecs() >= drawSecs(key);
    var provs = provinces(key), n = provs.length;
    var h = '<section class="tbl ' + key + ' m-' + mode + '" style="--n:' + n + '">';
    if (mode === 'all') h += '<div class="rh">KQXS ' + R.title + '</div>';
    h += strip(key, st, mode);
    h += '<div class="hd"><div class="lab dayc"><b>' + esc(V.wdShort) + '</b><i>' + V.dm + '</i></div>';
    provs.forEach(function (p) {
      var sub = p.code ? '<small>' + esc(p.code) + '</small>'
        : (key === 'bac' && mode === 'all' ? '<small>(Áp dụng chung cho khu vực MIỀN BẮC)</small>' : '');
      h += '<div class="ph"><b>' + esc(p.name) + '</b>' + sub + '</div>';
    });
    h += '</div><div class="body">';
    R.prizes.forEach(function (d) {
      var per = perOf(key, mode, d[0]);
      var lines = Math.ceil(d[3] / per) + (key === 'bac' && d[0] === 'db' ? 1 : 0);
      if (per === 1 && d[3] > 3) lines = d[3] * 0.62; // giải tư mỗi số một dòng: dòng thấp hơn
      h += '<div class="row" style="flex:' + (lines + 0.9) + ' 1 0"><div class="lab">' + d[1] + '<b>' + d[2] + '</b></div>';
      provs.forEach(function (p) {
        var extra = (key === 'bac' && d[0] === 'db') ? kyhieu() : '';
        var ns = rolling ? nextSlot(key, p) : null;
        if (ns) ns.len = DIGITS[key][ns.id];
        h += cell(d[0], d[3], p.prizes && p.prizes[d[0]], spin, per, extra, ns);
      });
      h += '</div>';
    });
    return h + '</div></section>';
  }

  var LIVE_SVG = '<svg class="liveico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.6" fill="currentColor"/>' +
    '<path class="w1" d="M8 8a5.7 5.7 0 0 0 0 8M16 8a5.7 5.7 0 0 1 0 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path class="w2" d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  // Tên trang: 2 chữ đầu màu đỏ, phần còn lại màu đen (vd "Xổ Số" + "Đức Anh")
  function logo() {
    var w = String(SITE.siteName || '').trim().split(/\s+/);
    var a = w.slice(0, Math.min(2, Math.max(1, w.length - 1))).join(' '), b = w.slice(a.split(' ').length).join(' ');
    return '<div class="logo"><div class="l1"><span class="a">' + esc(a) + '</span>' + (b ? ' <span class="b">' + esc(b) + '</span>' : '') +
      '<span class="livebadge">' + LIVE_SVG + '</span></div>' +
      '<div class="l2">' + esc(SITE.slogan) + '</div></div>';
  }
  function head(text, V, cls) {
    return '<div class="top">' + logo() + '<div class="ttl ' + (cls || '') + '"><span class="t1">' + text + '</span>' +
      '<span class="t2">' + esc(V.wdFull.toUpperCase()) + ' · ' + V.dmy + '</span></div></div>';
  }
  function balls(arr, groups, cls) {
    var h = '', i = 0;
    groups.forEach(function (g, gi) {
      if (gi) h += '<span class="gap"></span>';
      for (var k = 0; k < g; k++, i++) {
        var v = arr && arr[i];
        h += '<span class="ball ' + cls(gi) + '">' + (v !== undefined && v !== '' && v !== null ? esc(v) : waitIcon(false)) + '</span>';
      }
    });
    return h;
  }
  function clockBlock() {
    return '<div class="clockp"><span class="clk-l">GIỜ VIỆT NAM</span><span class="clk">--:--:--</span></div>';
  }

  var lastSig = '', fbShown = '';
  function render() {
    var V = viewDate(), h = '';
    // Tab khung ngoài: không dựng lại (tránh tải lại iframe mỗi lần có số mới)
    if (tab === 'embed' && embedIso === V.iso && $('#view .embed')) { updateTabs(); return; }
    if (tab !== 'embed') embedIso = '';
    var fb = tab === 'embed' ? null : fallbackKey();
    if (fb && fbShown === fb && $('#view .embed')) { updateTabs(); return; }
    fbShown = fb || '';
    if (fb) {
      h += head('KQXS ' + REG[fb].title, V) +
        '<div class="embed"><iframe src="' + esc(CFG.liveFallbackUrl) + '" title="Kết quả trực tiếp Minh Ngọc" referrerpolicy="no-referrer"></iframe></div>';
    } else if (tab === 'all') {
      var n = provinces('nam').length, t = provinces('trung').length;
      h += head('KẾT QUẢ XỔ SỐ 3 MIỀN', V, 'long') + '<div class="tables">';
      h += '<div style="display:flex;flex:' + (n + 1.2) + ' 1 0;min-width:0">' + regionTable('nam', 'all') + '</div>';
      h += '<div style="display:flex;flex:' + (t + 1.2) + ' 1 0;min-width:0">' + regionTable('trung', 'all') + '</div>';
      h += '<div class="bacwrap" style="flex:3.2 1 0">' + regionTable('bac', 'all') + clockBlock() + '</div></div>';
    } else if (tab === 'embed') {
      h += head('XỔ SỐ TRỰC TIẾP', V) +
        '<div class="embed"><iframe src="' + esc(CFG.embedUrl) + '" title="Khung xổ số trực tiếp" referrerpolicy="no-referrer" allow="autoplay"></iframe></div>';
      embedIso = V.iso;
    } else {
      var R = REG[tab];
      h += head('KQXS ' + R.title, V) + '<div class="single">';
      if (tab === 'bac') {
        h += '<aside class="side">' +
          '<div class="sbox"><h3>Điện Toán 1*2*3</h3><div class="balls">' +
          balls(data && data.dt123, [1, 2, 3], function (g) { return 'g' + (g + 1); }) + '</div></div>' +
          '<div class="sbox"><h3>Xổ Số Thần Tài</h3><div class="balls">' +
          balls(data && data.thantai, [4], function () { return 't'; }) + '</div></div>' + clockBlock() + '</aside>';
      }
      h += regionTable(tab, 'single') + '</div>';
    }
    $('#view').innerHTML =
      '<aside class="rail l"><i class="dot"></i><img class="vang" src="img/vang.png" alt="" width="75" height="65"><span>' + esc(SITE.leftText) + '</span></aside>' +
      '<div class="main">' + h + '</div>' +
      '<aside class="rail r"><i class="dot"></i><span>' + esc(SITE.rightText) + '</span><img class="vang" src="img/vang.png" alt="" width="75" height="65"></aside>';
    tick();
    updateTabs();
    updateSeoToday();
    document.dispatchEvent(new Event('kqxs:render'));
  }

  /* ---------- Đếm ngược lớn giữa khung: từ lúc chuyển ngày (14:00) đến khi đài đầu tiên quay ---------- */
  var cdSig = '';
  function updateCountdownOverlay() {
    var st = document.getElementById('stage'); if (!st) return;
    var el = document.getElementById('cdov');
    if (!el) { el = document.createElement('div'); el.id = 'cdov'; el.className = 'cdov'; el.hidden = true; st.appendChild(el); }
    var V = viewDate();
    updatePrep();
    var keys = (tab === 'nam' || tab === 'trung' || tab === 'bac') ? [tab] : (tab === 'all' ? ['nam', 'trung', 'bac'] : []);
    var show = keys.length && V.isToday && keys.every(function (k) { return status(k) === 'waiting'; });
    var ns = nowSecs(), target = keys.length ? Math.min.apply(null, keys.map(drawSecs)) : 0;
    // Còn 1 phút là tới giờ quay thì ẩn bảng đếm ngược để người xem thấy bảng kết quả
    if (show && ns >= target - 60) show = false;
    if (!show) { el.hidden = true; cdSig = ''; return; }
    var sig = keys.join(',');
    if (sig !== cdSig) {
      cdSig = sig;
      var sub = keys.map(function (k) { return '<span class="cs"><span class="cn">' + esc(REG[k].short) + '</span> <b class="ct ' + k + '">' + CFG.drawTime[k].replace(':', 'h') + '</b></span>'; }).join('');
      el.innerHTML = '<div class="cd-card"><div class="cd-top"><img class="vang" src="img/vang.png" alt="" width="75" height="65">' + LIVE_SVG + '<span>SẮP QUAY THƯỞNG</span><img class="vang" src="img/vang.png" alt="" width="75" height="65"></div>' +
        '<div class="cd-big"><span class="cd-l">Còn</span> <b id="cd-time">--:--:--</b></div><div class="cd-sub">' + sub + '</div></div>';
    }
    var t = document.getElementById('cd-time'); if (t) t.textContent = hmmss(target - ns);
    el.hidden = false;
  }

  /* ---------- Đồng hồ + đếm ngược (mỗi giây) ---------- */
  function prepOn(k) { var ns = nowSecs(), d = drawSecs(k); return viewDate().isToday && ns >= d - 3600 && ns <= d + 1800; }
  function updatePrep() {
    ['nam', 'trung', 'bac'].forEach(function (k) { document.body.classList.toggle('prep-' + k, prepOn(k)); });
  }
  function tick() {
    updatePrep();
    var n = vnNow(), t = pad(n.h) + ':' + pad(n.mi) + ':' + pad(n.s);
    document.querySelectorAll('.clk').forEach(function (e) { e.textContent = t; });
    var ns = nowSecs();
    document.querySelectorAll('[data-cd]').forEach(function (e) {
      e.textContent = hmmss(drawSecs(e.getAttribute('data-cd')) - ns);
    });
    updateCountdownOverlay();
    var iso = viewDate().iso;
    if (lastIso && iso !== lastIso && !dateParam) { data = null; dataSig = ''; }
    lastIso = iso;
    var sig = iso + '|' + ['nam', 'trung', 'bac'].map(status).join(',') + '|' + tab + '|' + (fallbackKey() || '');
    if (lastSig && sig !== lastSig) { lastSig = sig; if (!dateParam) { dataSig = ''; load(); } render(); return; }
    lastSig = sig;
  }

  /* ---------- Co giãn khung 4K 16:9 ---------- */
  function fit() {
    var wrap = $('.stage-wrap'), w = wrap.clientWidth, hh = wrap.clientHeight;
    var s = Math.min(w / 3840, hh / 2160);
    $('#stage').style.transform = 'translate(' + ((w - 3840 * s) / 2) + 'px,' + ((hh - 2160 * s) / 2) + 'px) scale(' + s + ')';
  }

  function buildWatermark() {
    var wmEl = $('.wm'); if (!wmEl) return;
    var txt = String(SITE.wmText == null ? '' : SITE.wmText), h = '';
    if (txt) for (var i = 0; i < 70; i++) h += '<span>' + esc(txt) + '</span>';
    wmEl.innerHTML = h;
    var wm = parseFloat(params.get('wm'));
    if (isNaN(wm)) wm = SITE.wmOpacity != null ? +SITE.wmOpacity : 0.45;
    $('#stage').style.setProperty('--wm', Math.max(0, Math.min(0.5, wm)));
  }

  /* ---------- Tab ---------- */
  function updateTabs() {
    document.querySelectorAll('.tabs [data-tab]').forEach(function (b) {
      var on = b.getAttribute('data-tab') === tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
  }
  function setTab(t) {
    tab = t;
    var p = new URLSearchParams(location.search);
    p.set('tab', t);
    history.replaceState(null, '', '?' + p.toString());
    render();
  }
  function updateSeoToday() {
    var V = viewDate(), el = $('#seo-today');
    if (!el) return;
    var S = SCHEDULE[V.wd];
    el.innerHTML = '<p>Kết quả xổ số hôm nay <strong>' + V.wdFull + ', ' + V.dmy + '</strong>: ' +
      '<strong>Miền Nam</strong> – ' + esc(S.nam.join(', ')) + ' (quay lúc ' + hLabel('nam') + '); ' +
      '<strong>Miền Trung</strong> – ' + esc(S.trung.join(', ')) + ' (' + hLabel('trung') + '); ' +
      '<strong>Miền Bắc</strong> – ' + esc(S.bac.join(', ')) + ' (' + hLabel('bac') + ').</p>';
  }

  window.KQXS_CORE = {
    REG: REG, SCHEDULE: SCHEDULE, TABS: TABS, viewDate: viewDate, provinces: provinces, hLabel: hLabel,
    getTab: function () { return tab; }, getData: function () { return data; }, getSite: function () { return SITE; }
  };

  /* ---------- Link chia sẻ toàn màn hình ---------- */
  function shareBase() { return location.origin + location.pathname.replace(/[^\/]*$/, '') + 'index.html'; }
  function buildShare() {
    var el = document.getElementById('share'); if (!el) return;
    var items = [['all', 'KQXS 3 Miền'], ['nam', 'KQXS Miền Nam'], ['trung', 'KQXS Miền Trung'], ['bac', 'KQXS Miền Bắc']];
    var base = /^https?:/.test(location.protocol) ? shareBase() : 'index.html';
    var h = '<h2>Link xem toàn màn hình để gửi cho người khác</h2><p>Mở link là thấy ngay khung kết quả vừa màn hình (nhấp đúp hoặc bấm nút góc phải dưới để phóng to hết cỡ).</p><ul class="share-list">';
    items.forEach(function (it) {
      var u = base + '?view=full&tab=' + it[0];
      h += '<li><b>' + it[1] + '</b><input type="text" readonly value="' + u + '" aria-label="Link ' + it[1] + '">' +
        '<a class="btn" href="' + u + '" target="_blank" rel="noopener">Mở</a><button type="button" data-share="' + u + '">Sao chép</button></li>';
    });
    el.innerHTML = h + '</ul><span id="share-msg" role="status"></span>';
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-share]'); if (!b) return;
      var u = b.getAttribute('data-share'), m = document.getElementById('share-msg');
      function ok(g) { if (m) { m.textContent = g ? 'Đã sao chép link' : 'Không sao chép được, hãy bôi đen và copy'; setTimeout(function () { m.textContent = ''; }, 2500); } }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(function () { ok(true); }, function () { ok(false); });
      else { var i = b.parentNode.querySelector('input'); i.select(); var g = false; try { g = document.execCommand('copy'); } catch (x) { } ok(g); }
    });
  }
  function setupFullView() {
    document.body.classList.add('fullview');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'fsfloat'; b.textContent = '⛶ Chạm bất kỳ đâu để toàn màn hình';
    function toggle() {
      var d = document.documentElement;
      if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen();
    }
    function enter() {
      var d = document.documentElement;
      if (!document.fullscreenElement && d.requestFullscreen) { try { var r = d.requestFullscreen(); if (r && r.catch) r.catch(function () {}); } catch (e) {} }
    }
    b.addEventListener('click', toggle);
    document.addEventListener('dblclick', toggle);
    enter();
    ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) {
      document.addEventListener(ev, function once() {
        enter();
        if (document.fullscreenElement) document.removeEventListener(ev, once, true);
      }, true);
    });
    document.addEventListener('fullscreenchange', function () { b.hidden = !!document.fullscreenElement; });
    document.body.appendChild(b);
  }

  /* ---------- Khởi động ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var fullView = params.get('view') === 'full';
    if (params.get('obs') === '1' || fullView) document.body.classList.add('obs');
    if (fullView) setupFullView();
    buildShare();
    var eb = document.querySelector('.tabs [data-tab="embed"]');
    if (eb && CFG.embedUrl) { eb.hidden = false; eb.textContent = CFG.embedLabel || 'Khung ngoài'; }
    applySite(true);
    document.querySelectorAll('.tabs [data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    });
    $('#fs').addEventListener('click', function () {
      var w = $('.stage-wrap');
      if (document.fullscreenElement) document.exitFullscreen(); else if (w.requestFullscreen) w.requestFullscreen();
    });
    document.addEventListener('keydown', function (e) {
      if (/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
      var i = '12345'.indexOf(e.key);
      if (i >= 0 && i < TABS.length && !e.ctrlKey && !e.metaKey) setTab(TABS[i]);
    });
    window.addEventListener('resize', fit);
    document.addEventListener('fullscreenchange', function () { setTimeout(fit, 50); });
    render(); fit(); pollLoop(); loadSite();
    setInterval(tick, 1000);
    setInterval(function () {
      var r = document.querySelectorAll('#view .roll');
      for (var i = 0; i < r.length; i++) r[i].textContent = rollDigits(+r[i].getAttribute('data-n') || 2);
    }, 70);
    setInterval(loadSite, Math.max(5, CFG.settingsPollSeconds || 15) * 1000);
  });
})();
