/* Thẻ tag + từ khóa SEO tự đổi theo ngày, miền (tab) và các tỉnh mở thưởng hôm đó. */
(function () {
  'use strict';
  var C = window.KQXS_CORE;
  if (!C) return;

  // Tên chuẩn để làm từ khóa (khác tên viết gọn trên bảng)
  var NAMES = { 'TP. HCM': 'TP.HCM', 'Thừa T. Huế': 'Thừa Thiên Huế' };
  var CODES = {
    'TP. HCM': 'HCM', 'Đồng Tháp': 'DT', 'Cà Mau': 'CM', 'Tiền Giang': 'TG', 'Kiên Giang': 'KG', 'Đà Lạt': 'DL',
    'Bến Tre': 'BTR', 'Vũng Tàu': 'VT', 'Bạc Liêu': 'BL', 'Đồng Nai': 'DN', 'Cần Thơ': 'CT', 'Sóc Trăng': 'ST',
    'Tây Ninh': 'TN', 'An Giang': 'AG', 'Bình Thuận': 'BTH', 'Vĩnh Long': 'VL', 'Bình Dương': 'BD', 'Trà Vinh': 'TV',
    'Long An': 'LA', 'Bình Phước': 'BP', 'Hậu Giang': 'HG',
    'Kon Tum': 'KT', 'Khánh Hòa': 'KH', 'Thừa T. Huế': 'TTH', 'Phú Yên': 'PY', 'Đắk Lắk': 'DLK', 'Quảng Nam': 'QNM',
    'Đà Nẵng': 'DNG', 'Bình Định': 'BDI', 'Quảng Trị': 'QT', 'Quảng Bình': 'QB', 'Gia Lai': 'GL', 'Ninh Thuận': 'NT',
    'Quảng Ngãi': 'QNG', 'Đắk Nông': 'DNO',
    'Hà Nội': 'HN', 'Quảng Ninh': 'QN', 'Bắc Ninh': 'BN', 'Hải Phòng': 'HP', 'Nam Định': 'ND', 'Thái Bình': 'TB'
  };
  var ABBR = { nam: 'MN', trung: 'MT', bac: 'MB' };
  var GENERAL = ['Kết Quả Xổ Số', 'Kết Quả Xổ Số Mới Nhất', 'Kết Quả Xổ Số Hôm Nay', 'Kết quả xổ số trực tiếp',
    'KẾT QUẢ XỔ SỐ KIẾN THIẾT', 'XỔ SỐ KIẾN THIẾT'];
  var GEN_TAGS = ['#KếtQuảXổSố', '#KếtQuảXổSốHômNay', '#KếtQuảXổSốTrựcTiếp', '#XổSốKiếnThiết'];

  function name(n) { return NAMES[n] || n; }
  function code(n) { return CODES[n] || ''; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function tag(s) {
    return '#' + String(s).normalize('NFC').split(/\s+/).map(function (w) {
      w = w.replace(/[^\p{L}\p{M}\p{N}]/gu, '');
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('');
  }
  function noAccent(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  }
  function uniq(a) { var seen = {}; return a.filter(function (x) { var k = x.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; }); }

  window.KQXS_SEO = { name: name, code: code };

  var lastSig = '';
  function groupsFor(tab, V) {
    var keys = (tab === 'nam' || tab === 'trung' || tab === 'bac') ? [tab] : ['nam', 'trung', 'bac'];
    return keys.map(function (k) {
      var R = C.REG[k], ab = ABBR[k];
      var provs = C.provinces(k).map(function (p) { return name(p.name); });
      var raw = C.provinces(k).map(function (p) { return p.name; });
      var kw = [], tg = [];
      // Theo đúng thứ tự: KQXS từng tỉnh → KẾT QUẢ XỔ SỐ từng tỉnh → các biến thể khác
      provs.forEach(function (p) { kw.push('KQXS ' + p); tg.push(tag('KQXS ' + p)); });
      provs.forEach(function (p) { kw.push('KẾT QUẢ XỔ SỐ ' + p); });
      provs.forEach(function (p, i) {
        var c = code(raw[i]);
        kw.push('Kết quả xổ số ' + p + ' hôm nay');
        kw.push('KQXS ' + p + ' ' + V.dmy);
        kw.push('Xổ số ' + p + ' ' + V.wdFull.toLowerCase() + ' ' + V.dmy);
        kw.push('Xổ số kiến thiết ' + p);
        if (c) { kw.push('XS' + c); tg.push('#XS' + c); }
        tg.push(tag('XổSố ' + p));
      });
      kw.push('KQXS' + ab, 'XS' + ab, 'XS' + ab + ' ' + V.wdFull.toLowerCase(),
        'Kết quả xổ số ' + R.short.toLowerCase() + ' hôm nay',
        'Kết quả xổ số ' + R.short.toLowerCase() + ' ngày ' + V.dmy,
        'Xổ số kiến thiết ' + R.short.toLowerCase(), 'Kết quả xổ số ' + R.short.toLowerCase() + ' trực tiếp');
      tg.unshift('#KQXS' + ab, '#XS' + ab, tag('KếtQuảXổSố ' + R.short));
      return { key: k, title: R.short, provs: provs, kw: uniq(kw), tg: uniq(tg) };
    });
  }

  function setMeta(sel, val) { var e = document.querySelector(sel); if (e) e.setAttribute('content', val); }

  function updateHead(tab, V, groups) {
    var d = V.wdFull + ' ' + V.dmy, title, desc;
    if (groups.length === 1) {
      var g = groups[0], list = g.provs.join(', ');
      title = 'KQXS ' + g.title + ' ' + d + ' – Kết Quả Xổ Số ' + list + ' | Đức Anh';
      desc = 'Kết quả xổ số ' + g.title.toLowerCase() + ' ' + d + ' trực tiếp: ' + list + '. Cập nhật KQXS ' + g.title + ' mới nhất từng giải ngay khi quay thưởng.';
    } else {
      title = 'Kết Quả Xổ Số Hôm Nay ' + d + ' – KQXS 3 Miền Trực Tiếp | Đức Anh';
      desc = 'Kết quả xổ số hôm nay ' + d + ': ' + groups.map(function (g) { return g.title + ' (' + g.provs.join(', ') + ')'; }).join('; ') + '. Xem kết quả xổ số kiến thiết trực tiếp, mới nhất.';
    }
    document.title = title;
    setMeta('meta[name="description"]', desc);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', desc);
    var all = [];
    groups.forEach(function (g) { all = all.concat(g.kw); });
    setMeta('meta[name="keywords"]', uniq(all.concat(GENERAL)).join(', '));
  }

  function chips(list, cls) {
    return list.map(function (t) { return '<li class="' + cls + '">' + esc(t) + '</li>'; }).join('');
  }

  var store = { tags: '', kw: '', reg: {} };

  function build() {
    var el = document.getElementById('tags');
    if (!el) return;
    var V = C.viewDate(), tab = C.getTab();
    var groups = groupsFor(tab, V);
    var sig = tab + '|' + V.iso + '|' + groups.map(function (g) { return g.provs.join(','); }).join('/');
    if (sig === lastSig) return;
    lastSig = sig;
    updateHead(tab, V, groups);

    var allTags = [], allKw = [];
    groups.forEach(function (g) { allTags = allTags.concat(g.tg); allKw = allKw.concat(g.kw); });
    store.reg = {};
    groups.forEach(function (g) {
      store.reg[g.key] = {
        tags: uniq(g.tg.concat(GEN_TAGS)).slice(0, 15).join(' '),
        kw: uniq(g.kw.concat(GENERAL, g.kw.concat(GENERAL).map(noAccent))).join(', ')
      };
    });
    allTags = uniq(allTags.concat(GEN_TAGS));
    // YouTube chỉ nhận tối đa 15 hashtag (quá 15 sẽ bị bỏ hết) nên bản sao chép giới hạn 15
    store.tags = allTags.slice(0, 15).join(' ');
    var kwNo = allKw.concat(GENERAL).map(noAccent);
    store.kw = uniq(allKw.concat(GENERAL, kwNo)).join(', ');

    var h = '<div class="tg-head"><div><h2>Từ khóa &amp; thẻ tag ngày ' + esc(V.wdFull) + ', ' + V.dmy + '</h2>' +
      '<p>Tự đổi theo ngày, miền và các tỉnh mở thưởng hôm đó.</p></div>' +
      '<div class="tg-btns"><button type="button" data-copy="tags">Sao chép hashtag chung</button>' +
      '<button type="button" data-copy="kw">Sao chép từ khóa chung</button><span id="tg-msg" role="status"></span></div></div>';
    groups.forEach(function (g) {
      h += '<div class="tg"><div class="tg-row"><h3>' + esc(g.title) + ' · ' + esc(g.provs.join(', ')) + '</h3>' +
        '<div class="tg-btns"><button type="button" class="r" data-copy="rtags" data-k="' + g.key + '">Sao chép hashtag ' + esc(g.title) + '</button>' +
        '<button type="button" class="r" data-copy="rkw" data-k="' + g.key + '">Sao chép từ khóa ' + esc(g.title) + '</button></div></div>' +
        '<ul class="chips">' + chips(g.tg, 'hash') + '</ul>' +
        '<ul class="chips">' + chips(g.kw, 'kw') + '</ul></div>';
    });
    h += '<div class="tg"><h3>Từ khóa chung</h3><ul class="chips">' + chips(GENERAL, 'kw') + chips(GEN_TAGS, 'hash') + '</ul></div>';
    el.innerHTML = h;
  }

  function copy(text, ok) {
    var msg = document.getElementById('tg-msg');
    function done(good) { if (msg) { msg.textContent = good ? ok : 'Không sao chép được, hãy bôi đen và copy.'; setTimeout(function () { msg.textContent = ''; }, 2500); } }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
      var good = false; try { good = document.execCommand('copy'); } catch (e) { }
      document.body.removeChild(t); done(good);
    }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copy]');
    if (!b) return;
    var t = b.getAttribute('data-copy'), k = b.getAttribute('data-k');
    if (t === 'tags') copy(store.tags, 'Đã sao chép hashtag chung (tối đa 15)');
    else if (t === 'kw') copy(store.kw, 'Đã sao chép từ khóa chung');
    else if (t === 'rtags' && store.reg[k]) copy(store.reg[k].tags, 'Đã sao chép hashtag riêng của miền');
    else if (t === 'rkw' && store.reg[k]) copy(store.reg[k].kw, 'Đã sao chép từ khóa riêng của miền');
  });

  document.addEventListener('kqxs:render', build);
  build();
})();
