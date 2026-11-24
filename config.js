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
  rolloverHour: 14,   // trước 14:00 hiện kết quả hôm trước, từ 14:00 chờ kết quả hôm nay
  drawTime: { nam: '16:15', trung: '17:15', bac: '18:15' },

  // Nguồn tham khảo để đối chiếu khi nhập số. KHÔNG hiện ở trang chủ, chỉ có nút mở trong trang admin (mục 1).
  sourceUrl: 'https://xsmn.mobi/xo-so-truc-tiep.html',
  sourceLabel: 'xsmn.mobi',

  // Khung nhúng nguồn ngoài thành 1 tab ở trang chủ. Để '' để ẩn (mặc định ẩn).
  embedUrl: '',
  embedLabel: '',

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
