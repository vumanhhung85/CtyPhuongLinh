# Hướng dẫn chuyển app Phương Linh sang GitHub + Cloudflare

Làm một lần, theo đúng thứ tự, khoảng 45–60 phút. Không cần gõ lệnh hay SQL: mọi bước đều thao tác trên web GitHub và Cloudflare.

## Trong gói này có gì

| Tệp / thư mục | Vai trò |
|---|---|
| `index.html`, `css/`, `js/` | Giao diện mới (thay `index.html` cũ). Code tách theo nghiệp vụ, sau này sửa chỗ nào chỉ cần đổi đúng file đó. |
| `js/config.js` | **Tệp cấu hình duy nhất** của giao diện: địa chỉ máy chủ API. |
| `migrate.html` | Công cụ chuyển dữ liệu từ Google Sheet sang Cloudflare, chỉ dùng một lần. |
| `sw.js` | Thay `sw.js` cũ. Luôn lấy bản mới nhất, không bị kẹt bản cũ sau khi cập nhật. |
| `worker/src/index.js` | Máy chủ API (thay `Code.gs`), giữ nguyên đủ 61 chức năng. |
| `worker/wrangler.toml` | Cấu hình Worker. Anh cần sửa 2 dòng. |
| `worker/schema.sql` | Cấu trúc cơ sở dữ liệu, để tham khảo. Không cần chạy tay. |
| `test/` | Bộ kiểm thử tự động (Claude dùng khi sửa code sau này). |

Các tệp đang có sẵn trong repo (`manifest.json`, `favicon-32.png`, `apple-touch-icon.png`, `Logo_PhuongLinh_KoVien.png`) **giữ nguyên, không xoá**.

---

## Giai đoạn 0 — Chuẩn bị (≈10 phút)

**0.1. Tạo cơ sở dữ liệu D1** (trên tài khoản Cloudflare mới, riêng cho Phương Linh)
1. Cloudflare Dashboard → **Storage & Databases → D1** → **Create database**. Không thấy mục này thì gõ "D1" vào ô tìm kiếm trên đầu trang.
2. Tên: `phuonglinh_erp` → Create.
3. Chép lại dòng **Database ID** (dạng `xxxxxxxx-xxxx-...`).

**0.2. Đưa code lên GitHub** (repo đang chạy app)
1. Đổi tên `index.html` cũ thành `indexGAS.html`: mở file trên GitHub → bấm bút chì → sửa ô tên file → **Commit changes**.
   Bản cũ vẫn chạy ở `…/indexGAS.html` để tra cứu, không mất gì.
2. Giải nén gói này. Trên trang repo bấm **Add file → Upload files**, kéo thả **toàn bộ** các tệp/thư mục: `index.html`, `migrate.html`, `sw.js`, `HUONG-DAN.md`, thư mục `css`, `js`, `worker`, `test`. Chọn "ghi đè" khi GitHub hỏi `sw.js` → **Commit changes**.

**0.3. Sửa 2 dòng trong `worker/wrangler.toml`** (mở file trên GitHub → bút chì):
- `ALLOWED_ORIGINS = "https://…"`: điền tên miền phụ đang chạy app. Phải có `https://`, **không** có dấu `/` ở cuối. Ví dụ `"https://banhang.phuonglinh.vn"`.
- `database_id = "…"`: dán Database ID ở bước 0.1.
- → **Commit changes**.

---

## Giai đoạn 1 — Tạo Worker nối thẳng GitHub (≈10 phút)

**1.1.** Cloudflare → **Workers & Pages → Create → Import a repository**. Lần đầu sẽ phải bấm "Connect GitHub" và cho phép truy cập repo này.

**1.2.** Chọn repo, rồi điền:
- **Project name:** `phuonglinh-erp-api`. Phải trùng đúng dòng `name` trong `wrangler.toml`.
- **Root directory** (mục Advanced / Build settings): `worker`
- **Build command:** để trống
- **Deploy command:** `npx wrangler deploy`
- → **Deploy**, chờ 1–2 phút.

**1.3. Tạo mã chuyển dữ liệu (tạm thời)**
Vào Worker vừa tạo → **Settings → Variables and Secrets → Add**:
- Type: **Secret**
- Name: `MIGRATE_KEY`
- Value: một chuỗi tự đặt, dài ≥ 12 ký tự (ví dụ `PL-chuyen-du-lieu-2026-xyz`). Ghi lại để dùng ở giai đoạn 2.
- → **Deploy** / **Save**.

**1.4. Lấy địa chỉ Worker**
Trong trang Worker, mục **Domains & Routes** có địa chỉ dạng `https://phuonglinh-erp-api.<tên-tài-khoản>.workers.dev`. Mở thử: thấy `{"ok":true,"app":"phuonglinh-erp-api",…}` là máy chủ đã chạy.

**1.5. Khai địa chỉ cho giao diện**
Trên GitHub mở `js/config.js` → bút chì → thay `https://DIEN-DIA-CHI-WORKER.workers.dev` bằng địa chỉ ở bước 1.4 → **Commit**.

> Từ đây về sau, **mỗi lần đẩy code lên GitHub, Cloudflare tự triển khai Worker** (xem trong tab Deployments). Không còn bước "dán code → Deploy → New version" như Apps Script.

---

## Giai đoạn 2 — Chuyển dữ liệu (≈15 phút)

> Làm vào lúc không ai nhập liệu. **Từ lúc tải file Sheet trở đi, không nhập gì vào bản cũ nữa**, vì phần nhập thêm sẽ không sang bản mới.

**2.1.** Mở Google Sheet của app cũ → **Tệp → Tải xuống → Microsoft Excel (.xlsx)**. Xem luôn múi giờ ở **Tệp → Cài đặt** (thường là GMT+7).

**2.2.** Mở `https://<tên-miền-phụ>/migrate.html`, rồi làm theo 4 bước trên trang:
1. Địa chỉ API tự điền sẵn. Nhập **mã MIGRATE_KEY** → **Kiểm tra & khởi tạo cấu trúc** (máy chủ tự tạo đủ bảng dữ liệu).
2. Chọn file .xlsx → **Đọc & kiểm tra file**. Đọc kỹ phần "lưu ý", đặc biệt 2 chỗ sau:
   - **Phiếu tạo tự động từ XML/bảng kê bị lùi 1 ngày** (lỗi của bản cũ). Mở 1–2 hoá đơn gốc so với bảng mẫu; nếu ngày thật trùng cột "Nếu cộng 1 ngày" thì tick ô sửa.
   - **Dòng chi tiết "mồ côi"** (không có phiếu tương ứng, do bản cũ ghi dở giữa chừng) sẽ bị bỏ qua.
3. **Rà tồn kho.** Danh sách mặt hàng mà tồn trên Sheet khác tồn tính lại từ sổ nhập–xuất:
   - **Không tick** = tin số tính từ sổ. Đây là lựa chọn đúng khi lệch do lỗi cũ, ví dụ xoá phiếu theo Cuộn chỉ hoàn lại 1 thay vì 300.
   - **Tick "Giữ số Sheet"** = số trên Sheet mới đúng thực tế, ví dụ anh đã kiểm kê và sửa tay.
4. **Bắt đầu chuyển dữ liệu** → chờ đến khi hiện **"✓ ĐỐI SOÁT KHỚP 100%"**. Trang so từng hạng mục giữa file Sheet và Cloudflare: số dòng mỗi bảng, công nợ phải thu/phải trả, doanh thu, số dư quỹ và tồn từng mặt hàng.

Chạy lại được nhiều lần: lần sau tick ô "xoá sạch rồi chuyển lại".

---

## Giai đoạn 3 — Chuyển chính thức (≈10 phút)

**3.1. Đăng nhập** `https://<tên-miền-phụ>/` (tức `index.html` mới) **bằng đúng tài khoản và mật khẩu cũ**. Mật khẩu cũ được tự động nâng lên kiểu mã hoá mạnh hơn ngay lần đăng nhập đầu tiên. Thử nhanh một vòng: xem Tổng quan, Danh mục (tồn kho), mở vài phiếu. Nếu muốn, tạo một phiếu thử rồi xoá đi.

**3.2. Đổi webhook SePay**
Tab **Cài đặt** → chép **Webhook URL** (dạng `https://…workers.dev/webhook/sepay?secret=…`; mã bí mật giữ nguyên như cũ) → SePay → **Cấu hình → Webhooks** → sửa URL của webhook cũ thành URL mới → Lưu.
Worker trung gian (relay) dùng cho bản cũ không cần nữa, xoá được sau khi thấy SePay chạy ổn.

**3.3. Khoá công cụ chuyển dữ liệu:** Worker → **Settings → Variables and Secrets** → xoá `MIGRATE_KEY`. Từ đó `migrate.html` không dùng được nữa.

**3.4. Bản cũ:** giữ `indexGAS.html` và Google Sheet 1–2 tháng để tra cứu (**chỉ xem, không nhập**). Sau đó có thể lưu trữ Apps Script.

**3.5. Sao lưu định kỳ:** tab **Cài đặt → Tải file Excel toàn bộ dữ liệu**, nên làm hàng tuần. Ngoài ra D1 tự lưu lịch sử 7 ngày ("Time Travel"): Cloudflare khôi phục được về thời điểm bất kỳ trong 7 ngày gần nhất.

---

## Những gì thay đổi so với bản Apps Script

- **Nhanh hơn nhiều:** mỗi thao tác tính bằng phần mười giây thay vì 1–4 giây, vì máy chủ chỉ đọc đúng dòng cần, không đọc nguyên sheet.
- **Mỗi phiếu ghi trọn trong 1 giao dịch:** hoặc ghi đủ (đầu phiếu, chi tiết, tồn kho, sổ quỹ), hoặc không ghi gì. Không còn lệch kho/quỹ do lỗi giữa chừng.
- **Tồn kho luôn tính từ sổ nhập–xuất, và mỗi dòng phiếu lưu sẵn số lượng đã quy đổi (Cuộn → Mét).** Việc này sửa gốc cả 3 chỗ quy đổi sai của bản cũ:
  - nút "Tính lại tồn kho";
  - xoá phiếu theo Cuộn hoàn kho sai;
  - giá vốn và lợi nhuận trong báo cáo sai khi bán theo Cuộn.
- **Chặn bán quá tồn chính xác hơn:** cộng dồn cùng một mặt hàng trên nhiều dòng trong phiếu. Bản cũ kiểm từng dòng riêng nên có thể lọt.
- **SePay không ghi thu 2 lần** khi gửi lại cùng một giao dịch.
- **Bảo mật:**
  - mật khẩu mã hoá có "muối" (PBKDF2);
  - sai 5 lần thì khoá 10 phút;
  - nhật ký không lưu mật khẩu/token;
  - chỉ tên miền của anh được gọi API.
- **Sửa lỗi cũ phát hiện khi chuyển:**
  - ngày đọc từ XML/bảng kê/PDF bị lùi 1 ngày;
  - "Từ ngày" mặc định ở Sổ quỹ/Báo cáo bị lùi về cuối tháng trước;
  - trước 7h sáng, ngày mặc định của phiếu là hôm qua;
  - Tổng quan quên cộng công nợ "Nhận gia công";
  - popup chi tiết phiếu trên điện thoại bị đè chữ (nay hiển thị dạng thẻ).
- **Giữ nguyên các quyết định cũ:** tiêu đề bảng không dính khi cuộn; không tự đăng xuất khi ngồi yên; một tài khoản chỉ đăng nhập một nơi.

## Khi gặp lỗi

| Thấy gì | Làm gì |
|---|---|
| "Chưa cấu hình địa chỉ máy chủ" | Sửa `js/config.js` (bước 1.5). |
| "Không kết nối được máy chủ" / trang trắng số liệu | Kiểm tra `ALLOWED_ORIGINS` trong `wrangler.toml`: đúng tên miền, có `https://`, không có `/` cuối. |
| "Cơ sở dữ liệu chưa được khởi tạo" | Mở `migrate.html`, làm Bước 1. |
| Deploy báo lỗi D1 / `database_id` | Kiểm tra Database ID trong `wrangler.toml` (bước 0.3). |
| Lỗi "1102" / "vượt giới hạn xử lý" | Gói Free giới hạn 10ms CPU mỗi lượt. Báo Claude kèm thao tác đang làm. |
| Cần xem lỗi chi tiết phía máy chủ | Worker → **Observability / Logs** (thay cho mục "Thực thi" của Apps Script). |
| Xem/sửa dữ liệu bằng tay | D1 → `phuonglinh_erp` → tab **Studio** (lưới kiểu Excel, xem trước câu lệnh trước khi lưu). |

## Sửa code về sau

- Sửa file trên GitHub, hoặc để Claude commit thẳng khi được gắn repo.
- Có đổi `worker/` thì Worker tự triển khai lại (1–2 phút). Giao diện (GitHub Pages) cập nhật sau khoảng 1 phút.
- Khi thêm chức năng mới có cả phần máy chủ lẫn giao diện: chờ Worker triển khai xong rồi mới dùng giao diện mới.
