(function () {
  'use strict';
  var SCH = window.KQXS_SCHEDULE, CFG = window.KQXS_CONFIG || {}, DEF = CFG.site || {};
  var NT = [['g8', 'Giải Tám', 2, 1], ['g7', 'Giải Bảy', 3, 1], ['g6', 'Giải Sáu', 4, 3], ['g5', 'Giải Năm', 4, 1],
    ['g4', 'Giải Tư', 5, 7], ['g3', 'Giải Ba', 5, 2], ['g2', 'Giải Nhì', 5, 1], ['g1', 'Giải Nhất', 5, 1], ['db', 'Đặc Biệt', 6, 1]];
  var BAC = [['g7', 'Giải Bảy', 2, 4], ['g6', 'Giải Sáu', 3, 3], ['g5', 'Giải Năm', 4, 6], ['g4', 'Giải Tư', 4, 4],
    ['g3', 'Giải Ba', 5, 6], ['g2', 'Giải Nhì', 5, 2], ['g1', 'Giải Nhất', 5, 1], ['db', 'Đặc Biệt', 5, 1]];
  var DEFS = { nam: NT, trung: NT, bac: BAC };
  var LABEL = { nam: 'Miền Nam', trung: 'Miền Trung', bac: 'Miền Bắc' };

  var $ = function (s) { return document.querySelector(s); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var pw = ''; try { pw = sessionStorage.getItem('kqxs_pw') || ''; } catch (e) { }
  var doc = null, region = 'nam', saveT = null, seq = 0, site = {};

  function msg(sel, t, bad) { var e = $(sel); if (!e) return; e.textContent = t || ''; e.classList.toggle('bad', !!bad); }
  function fmtBytes(b) {
    b = +b || 0;
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(2) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
  }
  function fmtTime(iso) {
    try { return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }); } catch (e) { return iso; }
  }
  // Gọi API kèm mật khẩu; lỗi thì ném ra câu báo lỗi tiếng Việt
  function api(path, method, body, pass) {
    return fetch(path, {
      method: method || 'GET', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (pass != null ? pass : pw) },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { message: t }; }
        if (!r.ok) { var er = new Error(j.message || ('Lỗi HTTP ' + r.status)); er.status = r.status; throw er; }
        return j;
      });
    }, function () { throw new Error('Không kết nối được máy chủ (trang đã đưa lên Vercel chưa?).'); });
  }

  /* =================== Chuyển mục =================== */
  var cur = 'nhap'; try { cur = sessionStorage.getItem('kqxs_sec') || 'nhap'; } catch (e) { }
  function showSec(s) {
    cur = s; try { sessionStorage.setItem('kqxs_sec', s); } catch (e) { }
    document.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== s; });
    document.querySelectorAll('#secnav [data-sec]').forEach(function (b) { b.classList.toggle('on', b.dataset.sec === s); });
    if (s === 'dulieu') loadStorage();
    if (s === 'nguon') loadSource();
  }
  $('#secnav').addEventListener('click', function (e) { var b = e.target.closest('[data-sec]'); if (b) showSec(b.dataset.sec); });

  /* =================== 1. NHẬP SỐ =================== */
  function todayVN() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()); }
  function wdOf(iso) { return new Date(iso + 'T00:00:00Z').getUTCDay(); }
  function fresh(iso) {
    var s = SCH[wdOf(iso)];
    function mk(k) { return { provinces: s[k].map(function (n) { return { name: n, code: '', prizes: {} }; }) }; }
    return { date: iso, nam: mk('nam'), trung: mk('trung'), bac: Object.assign(mk('bac'), { kyhieu: [] }), dt123: [], thantai: [] };
  }
  function normalize(d, iso) {
    var f = fresh(iso);
    d = d && typeof d === 'object' ? d : {};
    d.date = iso;
    ['nam', 'trung', 'bac'].forEach(function (k) {
      if (!d[k] || !d[k].provinces || !d[k].provinces.length) d[k] = f[k];
      d[k].provinces.forEach(function (p) {
        p.prizes = p.prizes || {};
        DEFS[k].forEach(function (df) {
          var a = p.prizes[df[0]] || [];
          while (a.length < df[3]) a.push('');
          p.prizes[df[0]] = a;
        });
      });
    });
    d.bac.kyhieu = d.bac.kyhieu || [];
    d.dt123 = d.dt123 || []; d.thantai = d.thantai || []; d.dt636 = d.dt636 || [];
    return d;
  }
  function status(t, bad) { var e = $('#status'); e.textContent = t; e.className = bad ? 'bad' : ''; }

  function save() {
    var my = ++seq;
    status('Đang gửi...');
    doc.updatedAt = new Date().toISOString();
    api('api/push', 'POST', doc).then(function () {
      if (my !== seq) return;
      var t = new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
      status('Đã gửi ' + t + ' ✓');
    }).catch(function (e) { if (my === seq) status('Lỗi gửi: ' + e.message, true); });
  }
  function queueSave() { clearTimeout(saveT); saveT = setTimeout(save, 150); }

  function inp(cls, attrs, v, max, ph) {
    var short = cls.indexOf('kh') < 0 && v && v.length < max;
    return '<input class="n ' + cls + (v ? ' filled' : '') + (short ? ' short' : '') + '" inputmode="' + (cls.indexOf('kh') >= 0 ? 'text' : 'numeric') + '" maxlength="' + max +
      '" autocomplete="off" ' + attrs + ' value="' + esc(v) + '" placeholder="' + esc(ph) + '">';
  }

  function renderGrid() {
    var defs = DEFS[region], provs = doc[region].provinces;
    var h = '<table class="g"><thead><tr><th></th>';
    provs.forEach(function (p, pi) {
      h += '<th><input class="pn" data-meta="name" data-p="' + pi + '" value="' + esc(p.name) + '" aria-label="Tên đài">' +
        (region === 'bac' ? '' : '<input class="pc" data-meta="code" data-p="' + pi + '" value="' + esc(p.code || '') + '" placeholder="Mã kỳ quay (vd 11B2)" aria-label="Mã kỳ quay">') + '</th>';
    });
    h += '</tr></thead><tbody>';
    defs.forEach(function (d) {
      h += '<tr><th class="pl">' + d[1] + '<small>' + d[2] + ' số</small></th>';
      provs.forEach(function (p, pi) {
        h += '<td>';
        for (var i = 0; i < d[3]; i++) h += inp('', 'data-d="' + d[0] + '" data-p="' + pi + '" data-i="' + i + '"', (p.prizes[d[0]] || [])[i] || '', d[2], new Array(d[2] + 1).join('0'));
        h += '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table>';
    if (region === 'bac') {
      h += '<div class="x"><h3>Ký hiệu giải Đặc Biệt (6 ô)</h3>';
      for (var i = 0; i < 6; i++) h += inp('kh', 'data-x="kh" data-i="' + i + '"', doc.bac.kyhieu[i] || '', 4, '12XD');
      h += '<h3>Điện Toán 1*2*3 (6 số: 1 + 2 + 3)</h3>';
      for (i = 0; i < 6; i++) h += inp('s', 'data-x="dt" data-i="' + i + '"', doc.dt123[i] || '', 1, '0');
      h += '<h3>Xổ Số Thần Tài (4 số)</h3>';
      for (i = 0; i < 4; i++) h += inp('s', 'data-x="tt" data-i="' + i + '"', doc.thantai[i] || '', 1, '0');
      h += '<h3>Điện Toán 6x36 (6 số, mỗi số 2 chữ số – chỉ thứ Tư và thứ Bảy)</h3>';
      for (i = 0; i < 6; i++) h += inp('s', 'data-x="d6" data-i="' + i + '"', doc.dt636[i] || '', 2, '00');
      if (doc.vietlott && (doc.vietlott.mega || doc.vietlott.power)) {
        h += '<h3>Vietlott (tự lấy từ Minh Ngọc)</h3><p class="hint">' + ['mega', 'power'].filter(function (k) { return doc.vietlott[k]; }).map(function (k) {
          var v = doc.vietlott[k]; return (k === 'mega' ? 'Mega 6/45' : 'Power 6/55') + ' – kỳ #' + esc(v.ky) + ' (' + esc(v.date) + '): <b>' + esc(v.nums.join(' ')) + '</b>';
        }).join('<br>') + '</p>';
      }
      h += '</div>';
    }
    $('#grid').innerHTML = h;
  }

  function setVal(el) {
    var v = el.value, ds = el.dataset;
    if (ds.x === 'kh') { v = v.toUpperCase().replace(/[^0-9A-Z]/g, ''); }
    else v = v.replace(/\D/g, '');
    el.value = v;
    el.classList.toggle('filled', !!v);
    el.classList.toggle('short', ds.x !== 'kh' && !!v && v.length < (+el.maxLength));
    var i = +ds.i;
    function put(a) { while (a.length <= i) a.push(''); a[i] = v; }
    if (ds.d) { var p = doc[region].provinces[+ds.p]; put(p.prizes[ds.d]); }
    else if (ds.x === 'kh') put(doc.bac.kyhieu);
    else if (ds.x === 'dt') put(doc.dt123);
    else if (ds.x === 'tt') put(doc.thantai);
    else if (ds.x === 'd6') put(doc.dt636);
    return v;
  }
  function numInputs() { return Array.prototype.slice.call(document.querySelectorAll('#grid input.n')); }
  function focusAt(list, i) { var e = list[i]; if (e) { e.focus(); e.select(); } }

  var lastInput = 0;
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.classList || !el.classList.contains('n')) return;
    lastInput = Date.now();
    var v = setVal(el);
    queueSave();
    if (v.length >= (+el.maxLength)) { var l = numInputs(); focusAt(l, l.indexOf(el) + 1); }
  });
  document.addEventListener('keydown', function (e) {
    var el = e.target;
    if (!el.classList || !el.classList.contains('n')) return;
    var l = numInputs(), i = l.indexOf(el);
    if (e.key === 'Enter') { e.preventDefault(); focusAt(l, i + 1); }
    else if (e.key === 'Backspace' && !el.value) { e.preventDefault(); focusAt(l, i - 1); }
    else if (e.key === 'ArrowRight' && el.selectionStart === el.value.length) focusAt(l, i + 1);
    else if (e.key === 'ArrowLeft' && el.selectionStart === 0) focusAt(l, i - 1);
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.meta && doc) {
      doc[region].provinces[+el.dataset.p][el.dataset.meta] = el.value.trim();
      queueSave();
    }
  });

  function renderTabs() {
    $('#rtabs').innerHTML = Object.keys(LABEL).map(function (k) {
      return '<button type="button" data-r="' + k + '" class="' + (k === region ? 'on' : '') + '">' + LABEL[k] + '</button>';
    }).join('');
  }
  $('#rtabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-r]'); if (!b) return;
    region = b.dataset.r; renderTabs(); renderGrid();
  });

  function loadDay() {
    var iso = $('#date').value || todayVN();
    status('Đang tải...');
    fetch('api/results?date=' + iso + '&_=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (d) {
        doc = normalize(d, iso);
        renderTabs(); renderGrid();
        status(d ? 'Đã tải dữ liệu ngày ' + iso : 'Ngày mới, chưa có dữ liệu');
      });
  }
  $('#date').addEventListener('change', loadDay);
  // Tự tải lại bảng nhập khi nguồn tự động vừa thêm số (chỉ khi bạn không đang gõ)
  setInterval(function () {
    if (!doc || cur !== 'nhap' || document.hidden) return;
    var a = document.activeElement;
    if (Date.now() - lastInput < 8000 || saveT && Date.now() - lastInput < 9000 || (a && a.classList && (a.classList.contains('n') || a.classList.contains('pn') || a.classList.contains('pc')) && Date.now() - lastInput < 20000)) return;
    var iso = doc.date;
    fetch('api/results?date=' + iso + '&_=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !doc || doc.date !== iso || Date.now() - lastInput < 8000) return;
      var n = normalize(d, iso);
      if (JSON.stringify(n[region]) === JSON.stringify(doc[region]) && JSON.stringify(n.bac.kyhieu) === JSON.stringify(doc.bac.kyhieu)) { doc = n; return; }
      doc = n; renderGrid(); status('Đã cập nhật số mới từ nguồn tự động');
    }).catch(function () { });
  }, 8000);
  $('#g-fetch').addEventListener('click', function () {
    var b = $('#g-fetch'); b.disabled = true; status('Đang lấy số từ nguồn...');
    api('api/source', 'POST', { action: 'sync', date: $('#date').value || todayVN() }).then(function (r) {
      if (r.skipped) { status('Nguồn tự động đang tắt (mục 7).', true); return; }
      loadDay(); status(srcSummary(r));
    }).catch(function (e) { status('Lỗi: ' + e.message, true); }).then(function () { b.disabled = false; });
  });

  /* =================== 2. GIAO DIỆN & NỘI DUNG =================== */
  var FIELDS = ['siteName', 'slogan', 'leftText', 'rightText', 'line1', 'line2', 'wmText', 'footer1', 'footer2'];
  function val(k) { return site[k] !== undefined && site[k] !== null ? site[k] : DEF[k]; }
  function fillSite() {
    FIELDS.forEach(function (k) { var e = $('#s-' + k); if (e) e.value = val(k) || ''; });
    var o = val('wmOpacity'); $('#s-wmOpacity').value = o != null ? o : 0.45; $('#s-wmv').textContent = (+$('#s-wmOpacity').value).toFixed(2);
    preview();
    $('#ro-time').value = val('rollover') || '14:00';
    $('#bc-ink').value = site.ballColor || '#2b2d33'; $('#bc-sp').value = site.ballSpColor || '#ffffff'; bcPreview();
    var dtv = Object.assign({}, CFG.drawTime || {}, site.drawTime || {});
    ['nam', 'trung', 'bac'].forEach(function (k) { $('#dt-' + k).value = dtv[k] || ''; });
    roNow();
    var t = site.ticker || DEF.ticker || {};
    $('#t-text').value = t.text || '';
    $('#t-every').value = t.everySec != null ? t.everySec : 60;
    $('#t-sec').value = t.seconds || 20;
    $('#t-pos').value = t.pos || 'mid';
    msg('#t-msg', t.on && t.text ? 'Đang bật: chữ đang chạy trên trang xem.' : 'Đang tắt.');
    renderMusic();
  }
  function preview() {
    var w = String($('#s-siteName').value || '').trim().split(/\s+/);
    var a = w.slice(0, Math.min(2, Math.max(1, w.length - 1))).join(' '), b = w.slice(a.split(' ').length).join(' ');
    $('#s-pv').innerHTML = '<div class="lg"><span class="a">' + esc(a) + '</span> ' + esc(b) + '</div>' +
      '<div style="color:#5b6068;font-weight:700;letter-spacing:2px">' + esc($('#s-slogan').value) + '</div>' +
      '<div style="margin-top:8px">Bên trái: <b>' + esc($('#s-leftText').value) + '</b> · Bên phải: <b>' + esc($('#s-rightText').value) + '</b></div>' +
      '<div>Watermark: <b>' + (esc($('#s-wmText').value) || '(tắt)') + '</b>, độ đậm ' + (+$('#s-wmOpacity').value).toFixed(2) + '</div>';
  }
  $('#sf').addEventListener('input', function () { $('#s-wmv').textContent = (+$('#s-wmOpacity').value).toFixed(2); preview(); });
  function loadSite() {
    return fetch('api/settings?_=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
      .then(function (j) { site = j || {}; fillSite(); });
  }
  function saveSite(patch, sel, okText) {
    msg(sel, 'Đang lưu...');
    return api('api/settings', 'POST', patch).then(function (j) { site = j; fillSite(); msg(sel, okText || 'Đã lưu ✓'); return j; })
      .catch(function (e) { msg(sel, 'Lỗi: ' + e.message, true); throw e; });
  }
  $('#sf').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = {}; FIELDS.forEach(function (k) { p[k] = $('#s-' + k).value; });
    p.wmOpacity = +$('#s-wmOpacity').value;
    saveSite(p, '#s-msg', 'Đã lưu ✓ Trang xem đổi sau khoảng 15 giây.').catch(function () { });
  });
  $('#s-reset').addEventListener('click', function () {
    if (!confirm('Đưa tất cả chữ về mặc định ban đầu?')) return;
    FIELDS.forEach(function (k) { $('#s-' + k).value = DEF[k] || ''; });
    $('#s-wmOpacity').value = DEF.wmOpacity != null ? DEF.wmOpacity : 0.45;
    $('#s-wmv').textContent = (+$('#s-wmOpacity').value).toFixed(2);
    preview();
    msg('#s-msg', 'Đã điền chữ mặc định, bấm "Lưu nội dung" để áp dụng.');
  });

  /* ---- Giờ chuyển ngày ---- */
  function roNow() {
    var v = $('#ro-time').value || '14:00', p = v.split(':');
    var f = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(function (x) { f[x.type] = x.value; });
    var now = (+f.hour) * 60 + (+f.minute), cut = (+p[0]) * 60 + (+p[1]);
    $('#ro-now').innerHTML = 'Bây giờ là <b>' + f.hour + ':' + f.minute + '</b> → nếu đặt chuyển lúc <b>' + v + '</b> thì trang chủ đang hiện: <b>' +
      (now < cut ? 'kết quả ngày hôm trước' : 'ngày hôm nay (chờ quay / đang quay / kết quả hôm nay)') + '</b>.';
  }
  $('#ro-time').addEventListener('input', roNow);
  setInterval(function () { if (cur === 'giaodien') roNow(); }, 30000);
  $('#ro-save').addEventListener('click', function () {
    var v = $('#ro-time').value;
    if (!/^\d{2}:\d{2}$/.test(v)) { msg('#ro-msg', 'Chọn giờ hợp lệ (vd 14:00).', true); return; }
    saveSite({ rollover: v }, '#ro-msg', 'Đã lưu ✓ Trang chủ áp dụng sau khoảng 15 giây.').catch(function () { });
  });
  function bcPreview() {
    var g = 'radial-gradient(circle at 34% 28%,#fff 0%,#f3f4f6 18%,#d4d6db 52%,#a9acb4 82%,#8b8e97 100%)';
    var r = 'radial-gradient(circle at 34% 28%,#ffd6d6 0%,#f59a9a 20%,#e2565a 55%,#c4343a 82%,#a3242a 100%)';
    function ball(bg, c, n) { return '<span style="width:48px;height:48px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font:800 22px Arial;background:' + bg + ';color:' + c + ';box-shadow:0 3px 6px rgba(0,0,0,.25)">' + n + '</span>'; }
    $('#bc-pv').innerHTML = ball(g, $('#bc-ink').value, '14') + ball(g, $('#bc-ink').value, '28') + ball(r, $('#bc-sp').value, '32');
  }
  $('#bc-ink').addEventListener('input', bcPreview); $('#bc-sp').addEventListener('input', bcPreview);
  $('#bc-save').addEventListener('click', function () {
    saveSite({ ballColor: $('#bc-ink').value, ballSpColor: $('#bc-sp').value }, '#bc-msg', 'Đã lưu ✓ Trang chủ đổi màu sau khoảng 15 giây.').catch(function () { });
  });
  $('#bc-def').addEventListener('click', function () { $('#bc-ink').value = '#2b2d33'; $('#bc-sp').value = '#ffffff'; bcPreview(); msg('#bc-msg', 'Bấm "Lưu màu số" để áp dụng.'); });
  $('#dt-save').addEventListener('click', function () {
    var dt = {}; ['nam', 'trung', 'bac'].forEach(function (k) { dt[k] = $('#dt-' + k).value; });
    if (!/^\d{2}:\d{2}$/.test(dt.nam + '') || !/^\d{2}:\d{2}$/.test(dt.trung + '') || !/^\d{2}:\d{2}$/.test(dt.bac + '')) { msg('#dt-msg', 'Chọn đủ giờ cho 3 miền.', true); return; }
    saveSite({ drawTime: dt }, '#dt-msg', 'Đã lưu ✓ Trang chủ áp dụng sau khoảng 15 giây.').catch(function () { });
  });
  $('#dt-def').addEventListener('click', function () {
    $('#dt-nam').value = '16:10'; $('#dt-trung').value = '17:10'; $('#dt-bac').value = '18:10';
    msg('#dt-msg', 'Bấm "Lưu giờ quay" để áp dụng.');
  });
  $('#ro-def').addEventListener('click', function () { $('#ro-time').value = '14:00'; roNow(); msg('#ro-msg', 'Bấm "Lưu giờ chuyển" để áp dụng.'); });

  /* =================== 3. CHỮ CHẠY =================== */
  function tickerPatch(on) {
    return { ticker: { text: $('#t-text').value, on: on, everySec: +$('#t-every').value, seconds: +$('#t-sec').value, pos: $('#t-pos').value } };
  }
  $('#tf').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!$('#t-text').value.trim()) { msg('#t-msg', 'Nhập nội dung chữ chạy trước.', true); return; }
    saveSite(tickerPatch(true), '#t-msg', 'Đã lưu ✓ Chữ sẽ chạy trên trang xem trong khoảng 15 giây.').catch(function () { });
  });
  $('#t-off').addEventListener('click', function () {
    saveSite(tickerPatch(false), '#t-msg', 'Đã tắt chữ chạy ✓').catch(function () { });
  });

  /* =================== 4. NHẠC =================== */
  function musicList() { return Array.isArray(site.music) ? site.music.slice() : []; }
  function kindOf(url) { return /youtu\.?be/i.test(url) ? 'yt' : 'file'; }
  function nameOf(m) {
    if (m.title) return m.title;
    if (m.kind === 'yt') return /list=/.test(m.url) ? 'Danh sách phát YouTube' : 'Video YouTube';
    try { return decodeURIComponent(m.url.split('/').pop().split('?')[0]); } catch (e) { return 'Bài nhạc'; }
  }
  function renderMusic() {
    var l = musicList(), el = $('#m-list');
    if (!el) return;
    el.innerHTML = l.length ? l.map(function (m, i) {
      return '<li><span class="no">' + (i + 1) + '</span><span class="k">' + (m.kind === 'yt' ? 'YouTube' : 'mp3') + '</span>' +
        '<input class="t" data-i="' + i + '" value="' + esc(m.title || '') + '" placeholder="' + esc(nameOf(m)) + '" aria-label="Tên bài">' +
        '<button type="button" data-a="up" data-i="' + i + '"' + (i ? '' : ' disabled') + '>▲</button>' +
        '<button type="button" data-a="down" data-i="' + i + '"' + (i < l.length - 1 ? '' : ' disabled') + '>▼</button>' +
        '<button type="button" class="danger" data-a="del" data-i="' + i + '">Xóa</button>' +
        '<span class="u">' + esc(m.url) + '</span></li>';
    }).join('') : '<li class="empty">Chưa có bài nào. Thêm link hoặc tải file mp3 ở trên.</li>';
  }
  function saveMusic(list, text) { return saveSite({ music: list }, '#m-msg', text); }
  $('#mf').addEventListener('submit', function (e) {
    e.preventDefault();
    var u = $('#m-url').value.trim();
    if (!/^https:\/\//i.test(u)) { msg('#m-msg', 'Link phải bắt đầu bằng https://', true); return; }
    if (kindOf(u) === 'file' && !/\.(mp3|m4a|ogg|oga|wav|aac)(\?|$)/i.test(u)) { msg('#m-msg', 'Link không phải YouTube hoặc file nhạc (.mp3, .m4a...).', true); return; }
    var l = musicList(); l.push({ url: u, title: $('#m-title').value.trim(), kind: kindOf(u) });
    saveMusic(l, 'Đã thêm bài ✓').then(function () { $('#m-url').value = ''; $('#m-title').value = ''; }).catch(function () { });
  });
  $('#m-list').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-a]'); if (!b) return;
    var l = musicList(), i = +b.dataset.i, a = b.dataset.a, t;
    if (a === 'up' && i > 0) { t = l[i - 1]; l[i - 1] = l[i]; l[i] = t; saveMusic(l, 'Đã đổi thứ tự ✓').catch(function () { }); }
    else if (a === 'down' && i < l.length - 1) { t = l[i + 1]; l[i + 1] = l[i]; l[i] = t; saveMusic(l, 'Đã đổi thứ tự ✓').catch(function () { }); }
    else if (a === 'del') {
      if (!confirm('Xóa bài "' + nameOf(l[i]) + '"?')) return;
      var gone = l.splice(i, 1)[0];
      saveMusic(l, 'Đã xóa bài ✓').then(function () {
        if (/\.blob\.vercel-storage\.com\//.test(gone.url)) api('api/upload', 'POST', { action: 'delete', url: gone.url }).catch(function () { });
      }).catch(function () { });
    }
  });
  $('#m-list').addEventListener('change', function (e) {
    var el = e.target; if (!el.classList.contains('t')) return;
    var l = musicList(), i = +el.dataset.i; if (!l[i]) return;
    l[i].title = el.value.trim();
    saveMusic(l, 'Đã đổi tên bài ✓').catch(function () { });
  });
  var blobMod = null;
  function blobClient() {
    if (blobMod) return Promise.resolve(blobMod);
    return import('https://esm.sh/@vercel/blob@1/client').then(function (m) { blobMod = m; return m; });
  }
  $('#m-up').addEventListener('click', function () {
    var files = Array.prototype.slice.call($('#m-file').files || []);
    if (!files.length) { msg('#m-upmsg', 'Bấm "Chọn tệp" để chọn file mp3 trước.', true); return; }
    var btn = $('#m-up'); btn.disabled = true;
    var added = [];
    msg('#m-upmsg', 'Đang chuẩn bị tải lên...');
    blobClient().then(function (B) {
      var chain = Promise.resolve();
      files.forEach(function (f, k) {
        chain = chain.then(function () {
          msg('#m-upmsg', 'Đang tải ' + (k + 1) + '/' + files.length + ': ' + f.name + '...');
          var safe = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\w.\-]+/g, '-');
          return B.upload('music/' + safe, f, {
            access: 'public', handleUploadUrl: 'api/upload', clientPayload: JSON.stringify({ pw: pw }),
            onUploadProgress: function (p) { msg('#m-upmsg', 'Đang tải ' + (k + 1) + '/' + files.length + ': ' + f.name + ' – ' + Math.round(p.percentage) + '%'); }
          }).then(function (r) { added.push({ url: r.url, title: f.name.replace(/\.[^.]+$/, ''), kind: 'file' }); });
        });
      });
      return chain;
    }).then(function () {
      return saveMusic(musicList().concat(added), 'Đã thêm ' + added.length + ' bài ✓');
    }).then(function () {
      msg('#m-upmsg', 'Tải lên xong ' + added.length + ' file ✓'); $('#m-file').value = '';
    }).catch(function (e) {
      var m = (e && e.message) || 'lỗi';
      msg('#m-upmsg', 'Lỗi tải lên: ' + m + (added.length ? ' (đã tải xong ' + added.length + ' file)' : ''), true);
      if (added.length) saveMusic(musicList().concat(added), 'Đã thêm ' + added.length + ' bài ✓').catch(function () { });
    }).then(function () { btn.disabled = false; });
  });

  /* =================== 5. DỮ LIỆU & LƯU TRỮ =================== */
  var MONTHS = {};
  function fillClearSelects() {
    var now = todayVN(), y = +now.slice(0, 4), ys = {}, h = '';
    ys[y] = 1; ys[y - 1] = 1;
    Object.keys(MONTHS).forEach(function (m) { ys[m.slice(0, 4)] = 1; });
    var keep = $('#cl-y').value || String(y);
    Object.keys(ys).sort().reverse().forEach(function (k) { h += '<option' + (k === keep ? ' selected' : '') + '>' + k + '</option>'; });
    $('#cl-y').innerHTML = h;
    if (!$('#cl-m').options.length) {
      h = ''; for (var i = 1; i <= 12; i++) { var mm = (i < 10 ? '0' : '') + i; h += '<option value="' + mm + '"' + (+now.slice(5, 7) === i ? ' selected' : '') + '>Tháng ' + mm + '</option>'; }
      $('#cl-m').innerHTML = h;
    }
    updClearHint();
  }
  function selMonth() { return $('#cl-y').value + '-' + $('#cl-m').value; }
  function updClearHint() {
    var m = selMonth(), info = MONTHS[m];
    $('#cl-hint').textContent = $('#cl-m').value + '/' + $('#cl-y').value;
    $('#cl-go').textContent = 'Xóa dữ liệu tháng ' + $('#cl-m').value + '/' + $('#cl-y').value + (info ? ' (' + info.days + ' ngày)' : '');
    $('#bk-month').textContent = 'Sao lưu cả tháng ' + $('#cl-m').value + '/' + $('#cl-y').value;
  }
  $('#cl-y').addEventListener('change', updClearHint);
  $('#cl-m').addEventListener('change', updClearHint);

  function renderStorage(j) {
    MONTHS = j.months || {};
    var pct = j.limitBytes ? Math.min(100, j.bytes / j.limitBytes * 100) : 0;
    $('#st-days').textContent = j.days + ' ngày';
    $('#st-range').textContent = j.days ? j.oldest.split('-').reverse().join('/') + ' → ' + j.newest.split('-').reverse().join('/') : 'Chưa có dữ liệu';
    $('#st-size').textContent = fmtBytes(j.bytes);
    $('#st-limit').textContent = 'Hạn mức ' + fmtBytes(j.limitBytes) + ' (gói miễn phí Upstash)';
    var bar = $('#st-bar');
    bar.style.width = Math.max(2, pct) + '%';
    bar.style.background = pct < 60 ? '#1f9d4d' : (pct < 85 ? '#ff9f43' : '#d70f28');
    $('#st-pct').textContent = pct.toFixed(pct < 1 ? 3 : 1) + '%';
    var lb = j.lastBackup;
    if (!lb) { $('#st-bk').textContent = 'Chưa sao lưu lần nào'; $('#st-bk2').textContent = ''; }
    else if (lb.error) { $('#st-bk').textContent = 'Lỗi lúc ' + fmtTime(lb.at); $('#st-bk2').textContent = lb.error; }
    else { $('#st-bk').textContent = fmtTime(lb.at); $('#st-bk2').textContent = (lb.by === 'cron' ? 'Tự động' : 'Bấm tay') + ' · ' + lb.days + ' ngày' + (lb.changed ? '' : ' (không có gì mới)'); }
    var gi = j.github
      ? 'Tự động mỗi ngày lúc 20:00–21:00 giờ Việt Nam vào thư mục <b>data/</b> của repo <b>' + esc(j.github.repo) + '</b> (nhánh ' + esc(j.github.branch) + ').' +
        (j.cron ? '' : ' <b style="color:#d70f28">Chưa có CRON_SECRET nên chưa tự sao lưu được.</b>') +
        (j.pendingBackup ? ' Còn ' + j.pendingBackup + ' ngày có thay đổi chưa sao lưu.' : '')
      : '<b style="color:#d70f28">Chưa cài GITHUB_TOKEN và GITHUB_REPO trên Vercel nên chưa sao lưu GitHub được.</b>';
    $('#bk-info').innerHTML = gi;
    $('#bk-now').disabled = $('#bk-month').disabled = !j.github;
    var ks = Object.keys(MONTHS).sort().reverse();
    $('#st-months').innerHTML = ks.length ? ks.map(function (m) {
      return '<tr><td>' + m.slice(5) + '/' + m.slice(0, 4) + '</td><td>' + MONTHS[m].days + '</td><td>' + fmtBytes(MONTHS[m].bytes) + '</td></tr>';
    }).join('') : '<tr><td colspan="3">Chưa có dữ liệu</td></tr>';
    fillClearSelects();
  }
  function loadStorage() {
    msg('#st-msg', 'Đang tải...');
    return api('api/storage', 'POST', {}).then(function (j) { renderStorage(j); msg('#st-msg', ''); })
      .catch(function (e) { msg('#st-msg', e.message, true); fillClearSelects(); });
  }
  $('#st-refresh').addEventListener('click', loadStorage);
  function backup(month) {
    $('#bk-now').disabled = $('#bk-month').disabled = true;
    msg('#bk-msg', 'Đang sao lưu lên GitHub...');
    api('api/backup', 'POST', month ? { month: month } : {}).then(function (j) {
      msg('#bk-msg', j.changed ? 'Đã sao lưu ' + j.days + ' ngày lên GitHub ✓' : 'GitHub đã có bản mới nhất, không cần sao lưu thêm ✓');
      loadStorage();
    }).catch(function (e) { msg('#bk-msg', 'Lỗi: ' + e.message, true); $('#bk-now').disabled = $('#bk-month').disabled = false; });
  }
  $('#bk-now').addEventListener('click', function () { backup(null); });
  $('#bk-month').addEventListener('click', function () { backup(selMonth()); });
  $('#cl-go').addEventListener('click', function () {
    var m = selMonth(), want = $('#cl-m').value + '/' + $('#cl-y').value;
    if ($('#cl-confirm').value.trim() !== want) { msg('#cl-msg', 'Gõ đúng ' + want + ' vào ô xác nhận.', true); $('#cl-confirm').focus(); return; }
    if (!confirm('Xóa TOÀN BỘ dữ liệu tháng ' + want + '? Không lấy lại được.')) return;
    $('#cl-go').disabled = true;
    msg('#cl-msg', 'Đang xóa...');
    api('api/clear', 'POST', { month: m, confirm: $('#cl-confirm').value.trim(), github: $('#cl-gh').checked }).then(function (j) {
      var t = 'Đã xóa ' + j.deleted + ' ngày của tháng ' + want + ' ✓';
      if ($('#cl-gh').checked) t += j.ghError ? ' · GitHub lỗi: ' + j.ghError : ' · GitHub: xóa ' + j.ghDeleted + ' file';
      msg('#cl-msg', t, !!j.ghError);
      $('#cl-confirm').value = '';
      loadStorage();
    }).catch(function (e) { msg('#cl-msg', 'Lỗi: ' + e.message, true); }).then(function () { $('#cl-go').disabled = false; });
  });

  /* =================== 6. MẬT KHẨU =================== */
  $('#pf').addEventListener('submit', function (e) {
    e.preventDefault();
    var a = $('#p-cur').value, b = $('#p-new').value, c = $('#p-new2').value;
    if (b !== c) { msg('#p-msg', 'Hai ô mật khẩu mới không giống nhau.', true); return; }
    if (b.length < 6) { msg('#p-msg', 'Mật khẩu mới phải có ít nhất 6 ký tự.', true); return; }
    msg('#p-msg', 'Đang đổi...');
    api('api/password', 'POST', { current: a, next: b }).then(function () {
      pw = b; try { sessionStorage.setItem('kqxs_pw', b); } catch (er) { }
      $('#pf').reset();
      msg('#p-msg', 'Đã đổi mật khẩu ✓ Lần sau đăng nhập bằng mật khẩu mới.');
    }).catch(function (er) { msg('#p-msg', er.status === 401 ? 'Mật khẩu hiện tại không đúng.' : 'Lỗi: ' + er.message, true); });
  });


  /* =================== 7. NGUỒN KẾT QUẢ =================== */
  var SRC = { cfg: null, sources: [] };
  var RNAME = { nam: 'Miền Nam', trung: 'Miền Trung', bac: 'Miền Bắc' };
  function srcSummary(r) {
    if (!r || !r.report) return '';
    return Object.keys(r.report).map(function (k) {
      var x = r.report[k];
      return RNAME[k] + ': ' + (x.ok ? (x.filled + ' số' + (x.changed ? ' (+' + x.changed + ' mới)' : '')) : 'lỗi');
    }).join(' · ');
  }
  function renderSrcOpts() {
    var cfg = SRC.cfg || { mode: 'minhngoc', fallback: true };
    var opts = [
      { id: 'minhngoc', t: 'Minh Ngọc (minhngoc.net.vn) – ưu tiên', d: 'Đọc trực tiếp trang kết quả của Minh Ngọc. Không phải API chính thức: nếu Minh Ngọc đổi giao diện hoặc chặn, trang sẽ báo lỗi và (nếu bật ô bên dưới) tự chuyển sang Xổ Số VN.' },
      { id: 'xosovnm', t: 'Xổ Số VN (xosovnm.net)', d: 'API công khai, miễn phí, không cần đăng ký.' },
      { id: 'off', t: 'Tắt – chỉ nhập tay', d: 'Không tự lấy số; bạn nhập ở mục 1.' }
    ];
    $('#src-opts').innerHTML = opts.map(function (o) {
      return '<label class="box" style="margin:0;display:flex;gap:12px;align-items:flex-start;cursor:pointer' + (cfg.mode === o.id ? ';border-color:#d70f28;background:#fff7f8' : '') + '">' +
        '<input type="radio" name="src-mode" value="' + o.id + '"' + (cfg.mode === o.id ? ' checked' : '') + ' style="margin-top:4px">' +
        '<span><b>' + o.t + '</b><br><span class="hint">' + o.d + '</span></span></label>';
    }).join('');
    $('#src-fb').checked = cfg.fallback !== false;
    $('#g-fetch').hidden = cfg.mode === 'off';
  }
  function renderSrcLast(last) {
    if (!last) { $('#src-last').textContent = 'Chưa có lần lấy nào.'; return; }
    var h = '<b>' + fmtTime(last.at) + '</b> · ngày ' + last.date.split('-').reverse().join('/') + '<br>';
    Object.keys(last.report || {}).forEach(function (k) {
      var x = last.report[k];
      h += RNAME[k] + ': ' + (x.ok ? '✓ ' + x.filled + ' số' + (x.note ? ' <i>(' + esc(x.note) + ')</i>' : '') : '<b style="color:#d70f28">lỗi – ' + esc(x.error) + '</b>') + '<br>';
    });
    $('#src-last').innerHTML = h;
  }
  function loadSource() {
    if (!$('#src-date').value) $('#src-date').value = todayVN();
    api('api/source', 'POST', { action: 'get' }).then(function (j) {
      SRC.cfg = j.cfg; SRC.sources = j.sources; renderSrcOpts(); renderSrcLast(j.last);
      $('#src-test-mode').value = j.cfg.mode === 'xosovnm' ? 'xosovnm' : 'minhngoc';
    }).catch(function (e) { msg('#src-msg', e.message, true); });
  }
  $('#src-opts').addEventListener('change', function () {
    var r = document.querySelector('input[name=src-mode]:checked');
    if (r) { SRC.cfg = Object.assign({}, SRC.cfg, { mode: r.value }); renderSrcOpts(); }
  });
  $('#src-save').addEventListener('click', function () {
    var r = document.querySelector('input[name=src-mode]:checked');
    msg('#src-msg', 'Đang lưu...');
    api('api/source', 'POST', { action: 'save', mode: r ? r.value : 'minhngoc', fallback: $('#src-fb').checked }).then(function (j) {
      SRC.cfg = j.cfg; renderSrcOpts();
      msg('#src-msg', j.cfg.mode === 'off' ? 'Đã tắt lấy số tự động ✓' : 'Đã lưu ✓ Từ giờ trang tự lấy số từ ' + (j.cfg.mode === 'minhngoc' ? 'Minh Ngọc' : 'Xổ Số VN') + '.');
    }).catch(function (e) { msg('#src-msg', 'Lỗi: ' + e.message, true); });
  });
  function previewTable(d) {
    var h = '';
    ['nam', 'trung', 'bac'].forEach(function (k) {
      var ps = (d[k] && d[k].provinces) || [];
      if (!ps.length) return;
      var defs = DEFS[k];
      h += '<h3>' + RNAME[k] + '</h3><table class="mt"><thead><tr><th></th>' + ps.map(function (p) { return '<th>' + esc(p.name) + (p.code ? '<br><small>' + esc(p.code) + '</small>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>';
      defs.slice().reverse().forEach(function (df) {
        h += '<tr><th>' + df[1] + '</th>' + ps.map(function (p) { return '<td>' + esc(((p.prizes && p.prizes[df[0]]) || []).filter(Boolean).join(' · ')) + '</td>'; }).join('') + '</tr>';
      });
      if (k === 'bac' && d.bac.kyhieu && d.bac.kyhieu.length) h += '<tr><th>Ký hiệu ĐB</th><td>' + esc(d.bac.kyhieu.join(' - ')) + '</td></tr>';
      h += '</tbody></table>';
    });
    return h || '<p class="hint">Nguồn chưa có số của ngày này.</p>';
  }
  function trySrc(dry) {
    var date = $('#src-date').value || todayVN(), mode = $('#src-test-mode').value;
    $('#src-try').disabled = $('#src-apply').disabled = true;
    msg('#src-tmsg', 'Đang lấy từ ' + (mode === 'minhngoc' ? 'Minh Ngọc' : 'Xổ Số VN') + '...');
    api('api/source', 'POST', { action: 'sync', date: date, mode: mode, dry: dry }).then(function (r) {
      var bad = Object.keys(r.report || {}).filter(function (k) { return !r.report[k].ok; });
      msg('#src-tmsg', (dry ? 'Xem thử: ' : 'Đã lưu ✓ ') + srcSummary(r), bad.length > 0);
      $('#src-preview').innerHTML = (bad.length ? '<p class="msg bad">' + bad.map(function (k) { return RNAME[k] + ': ' + esc(r.report[k].error); }).join('<br>') + '</p>' : '') + previewTable(r.doc);
      if (!dry) { renderSrcLast(r); if ($('#date').value === date) loadDay(); }
    }).catch(function (e) { msg('#src-tmsg', 'Lỗi: ' + e.message, true); })
      .then(function () { $('#src-try').disabled = $('#src-apply').disabled = false; });
  }
  $('#src-try').addEventListener('click', function () { trySrc(true); });
  var dbgText = '';
  $('#dbg-go').addEventListener('click', function () {
    var r = $('#dbg-r').value, date = $('#src-date').value || todayVN();
    msg('#dbg-msg', 'Đang kiểm tra...'); $('#dbg-out').textContent = ''; $('#dbg-copy').hidden = true;
    api('api/source', 'POST', { action: 'debug', region: r, date: date }).then(function (j) {
      var d = j.out[r] || {};
      var ok = d.classParser || d.tableParser;
      msg('#dbg-msg', d.error ? 'Không kết nối được Minh Ngọc' : (ok ? 'Đọc được bảng số ✓' : 'Chưa đọc được bảng số'), !ok);
      $('#dbg-out').innerHTML =
        '<b>Địa chỉ:</b> ' + esc(d.url) + '<br>' +
        '<b>Kết nối:</b> ' + (d.error ? '<b style="color:#d70f28">lỗi – ' + esc(d.error) + '</b>' : 'mã ' + esc(d.status) + ', ' + esc(d.bytes) + ' ký tự') + '<br>' +
        '<b>Có ngày ' + esc(date.split('-').reverse().join('/')) + ' trong trang:</b> ' + (d.hasDate ? 'có' : '<b style="color:#d70f28">không</b>') + '<br>' +
        '<b>Cách đọc 1:</b> ' + (d.classParser ? 'được ✓' : 'không') + ' · <b>Cách đọc 2:</b> ' + (d.tableParser ? 'được ✓' : 'không') + '<br>' +
        '<b>Chữ gần ngày quay:</b><br>' + esc(d.textNearDate || '');
      dbgText = JSON.stringify(j, null, 1); $('#dbg-copy').hidden = false;
    }).catch(function (e) { msg('#dbg-msg', 'Lỗi: ' + e.message, true); });
  });
  $('#dbg-copy').addEventListener('click', function () {
    function done(g) { msg('#dbg-msg', g ? 'Đã sao chép – dán (Ctrl + V) gửi cho người hỗ trợ.' : 'Không sao chép được, hãy chụp màn hình.', !g); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(dbgText).then(function () { done(true); }, function () { done(false); });
    else done(false);
  });
  $('#mn-live').addEventListener('click', function () {
    var box = $('#mn-box'), on = box.hidden;
    box.hidden = !on;
    box.innerHTML = on ? '<iframe src="' + esc(CFG.liveFallbackUrl || 'https://www.minhngoc.net.vn/free/xo-so-truc-tiep.html') + '" style="width:100%;height:100%;border:0" referrerpolicy="no-referrer" title="Trực tiếp Minh Ngọc"></iframe>' : '';
    $('#mn-live').textContent = on ? 'Đóng khung trực tiếp Minh Ngọc' : 'Mở khung trực tiếp Minh Ngọc';
  });
  $('#src-apply').addEventListener('click', function () {
    if (!confirm('Lấy số từ nguồn và lưu vào ngày ' + ($('#src-date').value || todayVN()).split('-').reverse().join('/') + '? Ô đã có số sẽ được thay bằng số của nguồn.')) return;
    trySrc(false);
  });

  /* =================== ĐĂNG NHẬP =================== */
  function enter() {
    $('#login').hidden = true; $('#app').hidden = false; $('#logout').hidden = false;
    $('#date').value = todayVN();
    loadDay(); loadSite();
    api('api/source', 'POST', { action: 'get' }).then(function (j) { SRC.cfg = j.cfg; $('#g-fetch').hidden = j.cfg.mode === 'off'; }).catch(function () { });
    showSec(cur);
  }
  $('#logout').addEventListener('click', function () {
    try { sessionStorage.removeItem('kqxs_pw'); } catch (e) { }
    location.reload();
  });
  $('#lf').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = $('#pw').value;
    $('#lerr').textContent = '';
    api('api/push', 'POST', { ping: true }, p).then(function (j) {
      if (j.role !== 'admin') { $('#lerr').textContent = 'Mã này chỉ dùng để gửi số tự động, không vào được trang quản trị.'; return; }
      pw = p; try { sessionStorage.setItem('kqxs_pw', p); } catch (er) { }
      enter();
    }).catch(function (er) { $('#lerr').textContent = er.status === 401 ? 'Sai mật khẩu.' : er.message; });
  });
  if (pw) api('api/push', 'POST', { ping: true }).then(function (j) { if (j.role === 'admin') enter(); }).catch(function () { });
})();
