/* Cấu hình KQXS Đức Anh.
   Chữ trên trang, chữ chạy, nhạc và mật khẩu giờ được sửa trong trang admin (admin.html).
   Các giá trị trong "site" dưới đây chỉ là chữ mặc định khi admin chưa lưu gì. */
window.KQXS_CONFIG = {
  site: {
    siteName: 'Xổ Số Đức Anh',
    slogan: 'KẾT QUẢ XỔ SỐ TRỰC TIẾP MỖI NGÀY',
    leftText: 'TRỰC TIẾP XỔ SỐ ĐỨC ANH YOUTUBE',
    rightText: 'KẾT QUẢ XỔ SỐ TRỰC TIẾP MỖI NGÀY',
    line1: 'Kết Quả Xổ Số Hôm Nay – Kết Quả Xổ Số Trực Tiếp Đức Anh',
    line2: 'Kết quả xổ số kiến thiết 3 miền, cập nhật trực tiếp mỗi ngày',
    wmText: 'Xổ Số Đức Anh',
    wmOpacity: 0.45,
    footer1: 'Lưu ý: Vui lòng đối chiếu kết quả chính thức trước khi lĩnh thưởng.',
    footer2: '© Đức Anh – Kết quả xổ số hôm nay · Kết quả xổ số trực tiếp · Xổ số kiến thiết',
    rollover: '14:00',   // giờ chuyển sang giao diện chờ quay (sửa trong admin, mục 2)
    ticker: { text: '', on: false, everySec: 60, seconds: 20, pos: 'mid', id: 0 },
    music: []
  },

  // Nơi đọc kết quả, thử lần lượt. {date} = YYYY-MM-DD (giờ Việt Nam).
  // 1) API trên Vercel (Upstash Redis)  2) file sao lưu trong thư mục data/ (GitHub)
  dataUrls: ['api/results?date={date}', 'data/{date}.json'],
  settingsUrl: 'api/settings',

  // Hỏi lại dữ liệu mỗi N giây trong giờ quay thưởng; ngoài giờ quay hỏi chậm hơn để tiết kiệm hạn mức
  pollSeconds: 4,
  idlePollSeconds: 60,
  settingsPollSeconds: 15,

  // Giờ bắt đầu quay thưởng (giờ Việt Nam). Sửa nếu đài đổi lịch.
  rolloverHour: 14,   // chỉ dùng khi admin chưa cài giờ chuyển ngày
  drawTime: { nam: '16:15', trung: '17:15', bac: '18:15' },

  // Nguồn lấy kết quả tự động (Minh Ngọc / Xổ Số VN) chọn trong trang admin, mục 7.

  // Tab "Trực tiếp Minh Ngọc" ở trang chủ: nhúng khung kết quả trực tiếp của Minh Ngọc
  // theo cách Minh Ngọc cho phép (thêm /free sau tên miền, chỉ chạy khi nhúng).
  // Nếu khung trống, đổi thành 'https://www.minhngoc.net.vn/free/index.php'. Để '' để ẩn tab.
  embedUrl: 'https://www.minhngoc.net.vn/free/xo-so-truc-tiep.html',
  embedLabel: 'Trực tiếp Minh Ngọc',

  // Đang giờ quay mà trang không lấy được số (quá 2,5 phút chưa có số nào, hoặc mất kết nối máy chủ)
  // thì tự hiện khung trực tiếp của Minh Ngọc ngay trong bảng. Có số lại thì tự quay về bảng của trang. Để '' để tắt.
  liveFallbackUrl: 'https://www.minhngoc.net.vn/free/xo-so-truc-tiep.html',

  /* ----- Nhạc nền -----
     Nhạc chỉ thêm trong trang admin (mục 4. Nhạc). File 1.mp3 … 20.mp3 trong thư mục music/ vẫn được phát nếu có. */
  music: {
    folder: 'music/',
    from: 1,
    to: 20,
    volume: 0.35,        // 0..1
    duckTo: 0.25         // hạ nhạc còn 25% khi đang đọc số
  },

  /* ----- Đọc số / đọc giải ----- */
  voice: {
    rate: 0.9,           // tốc độ đọc 0.5..1.5
    volume: 1
  }
};
