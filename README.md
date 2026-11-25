# Xổ Số Đức Anh – bản 2.0

## Có gì mới
- **Trang admin (`admin.html`) có 6 mục:** 1. Nhập số trực tiếp · 2. Giao diện & nội dung · 3. Chữ chạy · 4. Nhạc · 5. Dữ liệu & lưu trữ · 6. Mật khẩu.
- **Mật khẩu mặc định `29081989@`**, đổi được trong mục 6. Mật khẩu lưu ở dạng mã hóa, không lưu chữ thật.
- **Sửa chữ trên trang trong admin:** tên trang, dòng nhỏ dưới tên, nội dung bên trái, nội dung bên phải, dòng 1, dòng 2, chữ watermark (và độ đậm), chân trang 2 dòng.
- **Chữ chạy ngang màn hình** chỉnh trong admin, áp dụng cho mọi máy đang xem (kể cả cửa sổ livestream).
- **Nhạc chỉ thêm trong admin** (dán link YouTube / link mp3, hoặc tải file mp3 từ máy lên). Trang chủ chỉ có nút nghe. Mỗi lúc chỉ phát một nguồn (bật nguồn này thì nguồn kia tự dừng, kể cả khi mở nhiều cửa sổ).
- **Không còn xóa tự động 30 ngày.** Chỉ xóa khi bấm “Xóa dữ liệu tháng” trong admin (chọn năm + tháng, gõ lại MM/YYYY để xác nhận).
- **Lưu trên Vercel (Upstash Redis) + sao lưu lên GitHub mỗi ngày** (20:00–21:00 giờ VN) vào thư mục `data/`, có nút “Sao lưu ngay”. Ngày cũ không còn trên Vercel sẽ tự đọc lại từ bản sao lưu GitHub.
- **Thanh màu dung lượng** (xanh → cam → đỏ) nằm trong admin, mục 5.
- Ô nhập số **thiếu chữ số hiện màu cam** để tránh nhập sai.

## Vì sao đổi nơi lưu dữ liệu sang Upstash Redis
Gói miễn phí của Vercel Blob chỉ có 2.000 lượt ghi/liệt kê mỗi tháng; bản cũ tốn khoảng 2 lượt ghi cho mỗi lần gõ số nên chỉ vài ngày là hết hạn mức.
Upstash Redis (gói miễn phí 500.000 lệnh/tháng, 256 MB) đủ dùng lâu dài. Trang xem đọc qua bộ đệm của Vercel (2 giây) và ngoài giờ quay chỉ hỏi 1 phút/lần nên rất ít tốn lệnh.
Blob giờ chỉ dùng để chứa file nhạc mp3 tải lên.

## Các biến môi trường trên Vercel (Settings → Environment Variables)
| Tên | Bắt buộc | Giá trị |
|---|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Có | Tự có khi kết nối Upstash Redis ở mục Storage |
| `BLOB_READ_WRITE_TOKEN` | Cho nhạc tải lên | Tự có khi kết nối Blob (bạn đã có) |
| `GITHUB_TOKEN` | Cho sao lưu GitHub | Token GitHub quyền Contents: Read and write |
| `GITHUB_REPO` | Cho sao lưu GitHub | `tên-tài-khoản/tên-repo` |
| `GITHUB_BRANCH` | Không | Mặc định `main` |
| `CRON_SECRET` | Cho sao lưu tự động | Một chuỗi bí mật bất kỳ, ví dụ `kqxs-2026-bi-mat` |
| `PUSH_TOKEN` | Không | Mã riêng cho chương trình tự động gửi số vào `/api/push` (không vào được admin) |
| `ADMIN_PASSWORD` | Không | Nên xóa biến này. Nếu còn, nó dùng được như mật khẩu thứ hai cho đến khi bạn đổi mật khẩu trong admin |

## Các file API (thư mục `api/`)
| File | Việc |
|---|---|
| `results.js` | Trang xem đọc kết quả theo ngày |
| `push.js` | Admin gửi số (và kiểm tra mật khẩu khi đăng nhập) |
| `settings.js` | Chữ trên trang, chữ chạy, danh sách nhạc |
| `ticker.js` | Đường dẫn cũ, giờ dùng chung với `settings.js` |
| `password.js` | Đổi mật khẩu |
| `storage.js` | Thống kê dung lượng, theo tháng |
| `clear.js` | Xóa dữ liệu 1 tháng |
| `backup.js` | Sao lưu GitHub (tự động + nút bấm) |
| `upload.js` | Tải file nhạc lên Vercel Blob |
| `source.js` | Chọn nguồn tự động, thử lấy / lấy ngay |
| `_sources.js` | Đọc Minh Ngọc / Xổ Số VN (không phải route) |

## Nguồn dữ liệu
Admin mục **7. Nguồn kết quả** chọn 1 trong 2 nguồn tự động (hoặc tắt để nhập tay):
- **Minh Ngọc** (mặc định, ưu tiên): đọc trang `minhngoc.net.vn/ket-qua-xo-so/<miền>/<DD-MM-YYYY>.html`. Minh Ngọc không có API dữ liệu
  (chỉ có khung nhúng iframe), nên đây không phải kênh chính thức: nếu họ đổi giao diện hoặc chặn, trang báo lỗi ở mục 7.
- **Xổ Số VN**: API công khai `api.xosovnm.net/api` (không cần key).
- Ô "tự chuyển sang nguồn còn lại nếu lỗi" bật sẵn.
- Trong giờ quay, mỗi lần có người xem (kể cả cửa sổ OBS) mà đã quá 6 giây, máy chủ tự lấy số mới của miền đang quay.
  Quay xong mà chưa đủ số thì 2 phút lấy lại 1 lần. Lúc sao lưu tự động 20:00 cũng lấy lại đủ cả ngày.
- Số tự lấy chỉ thay ô có số mới; ô nguồn chưa có thì giữ số nhập tay. Vẫn sửa tay được ở mục 1.

Ngoài ra vẫn có thể nhập tay trong admin (mục 1), hoặc một chương trình bên ngoài gửi vào:
`POST /api/push`, header `Authorization: Bearer <mật khẩu hoặc PUSH_TOKEN>`, nội dung JSON cùng cấu trúc `data/2026-11-09.json`.

## Lưu ý
- `vercel.json` có `ignoreCommand`: mỗi lần sao lưu chỉ đổi thư mục `data/` thì Vercel **không** deploy lại.
- Nhạc YouTube: video tắt chức năng nhúng sẽ tự bị bỏ qua. Khi livestream nên dùng nhạc miễn phí bản quyền.
- Livestream OBS: mở `index.html?obs=1&tab=all&voice=1&music=1`, bấm vào trang 1 lần để mở âm thanh.
- Thêm `?ticker=off` vào link để tắt chữ chạy ở một khung xem.
