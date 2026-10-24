// Kiểm thử giao diện các tính năng 10/2026: in chứng từ, báo giá -> chốt phiếu xuất, kiểm kê / nhập tồn đầu kỳ,
// thông tin công ty. Chromium thật, cả máy tính lẫn điện thoại, bắt mọi lỗi JS. Tự dọn dữ liệu tạo ra.
// Chạy SAU api-test.mjs (cần dữ liệu nền: admin, KH1, CHUOT...): node test/in-an-test.mjs
import { createRequire } from 'node:module';
const require = createRequire('/tmp/claude-0/-home-claude/2c28eb33-5af1-55c1-9ee2-5fa2e7bcef5e/scratchpad/tools/package.json');
const { chromium } = require('playwright-core');
import { mkdirSync } from 'node:fs';

const WEB = 'http://localhost:8000', API = 'http://localhost:8787';
const SHOT = '/tmp/claude-0/-home-claude/2c28eb33-5af1-55c1-9ee2-5fa2e7bcef5e/scratchpad/shots';
mkdirSync(SHOT, { recursive: true });
let pass = 0, fail = 0;
const ok = (dk, ten, ct) => { if (dk) { pass++; console.log('  ✓', ten); } else { fail++; console.log('  ✗', ten, ct !== undefined ? JSON.stringify(ct).slice(0, 300) : ''); } };
const cho = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function moTrang(viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route('**/js/config.js*', r => r.fulfill({ contentType: 'application/javascript', body: `window.PL_CONFIG={API_URL:'${API}'};` }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  const loi = [];
  page.on('pageerror', e => loi.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) loi.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !/favicon|fonts\.g/.test(r.url())) loi.push('HTTP ' + r.status() + ': ' + r.url()); });
  page.on('dialog', d => d.accept());
  await page.goto(WEB + '/index.html');
  await page.fill('#userInput', 'admin'); await page.fill('#pwInput', 'phuonglinh2026'); await page.click('#btnLogin');
  await page.waitForSelector('#dashCards .statCard', { timeout: 10000 });
  await cho(800);
  return { ctx, page, loi };
}
async function moTab(pg, tab) {
  if (await pg.evaluate(() => matchMedia('(max-width:900px)').matches && !document.body.classList.contains('sbMo'))) { await pg.click('#btnMenu'); await cho(300); }
  await pg.click(`#tabbar button[data-tab="${tab}"]`); await cho(900);
}
// Nội dung bản in trong khung xem trước (iframe srcdoc)
async function chuBanIn(pg) {
  await pg.waitForSelector('#khungIn', { timeout: 8000 });
  await cho(700);
  return pg.frameLocator('#khungIn').locator('body').textContent();
}
const api = (pg, action, extra) => pg.evaluate(([a, e]) => apiCall(a, e), [action, extra || {}]);
const thuong = s => String(s || '').toLowerCase();

console.log('A. Máy tính (1280x800)');
const { ctx, page, loi } = await moTrang({ width: 1280, height: 800 });

// --- Đọc số thành chữ ---
const chu = await page.evaluate(() => [1603800, 1000000, 105000, 21, 15, 1005, 2025000000, 0, 310000, 1250].map(docSoThanhChu));
ok(chu[0] === 'Một triệu sáu trăm lẻ ba nghìn tám trăm đồng' && chu[1] === 'Một triệu đồng' && chu[2] === 'Một trăm lẻ năm nghìn đồng'
  && chu[3] === 'Hai mươi mốt đồng' && chu[4] === 'Mười lăm đồng' && chu[5] === 'Một nghìn không trăm lẻ năm đồng'
  && chu[6] === 'Hai tỷ không trăm hai mươi lăm triệu đồng' && chu[7] === 'Không đồng' && chu[8] === 'Ba trăm mười nghìn đồng' && chu[9] === 'Một nghìn hai trăm năm mươi đồng', 'đọc số tiền thành chữ đúng', chu);

// --- Thông tin công ty ---
await moTab(page, 'caidat');
await page.waitForFunction(() => document.getElementById('fCtMST').value === '0317838601', null, { timeout: 8000 });
ok(await page.inputValue('#fCtTen') === 'CÔNG TY TNHH DỊCH VỤ CÔNG NGHỆ PHƯƠNG LINH', 'Cài đặt: điền sẵn thông tin công ty');
await page.fill('#fCtDaiDien', 'Vũ Mạnh Hưng'); await page.fill('#fCtSDT', '0983.642.606');
await page.click('#btnLuuThongTinCongTy'); await cho(900);
ok((await page.textContent('#toast')).includes('Đã lưu thông tin công ty'), 'lưu thông tin công ty', await page.textContent('#toast'));
await page.screenshot({ path: SHOT + '/in-1-caidat.png', fullPage: true });

// Mặt hàng test tồn 0 (giống "Camera Yoose 2 mắt" anh hỏi)
const cam = await api(page, 'saveHangHoa', { data: { TenHH: 'Camera Yoose 2 mắt UI', Loai: 'HangHoa', DVT: 'Cái', GiaBan: 880000, TonKhoToiThieu: 1 } });
await page.evaluate(() => renderHangHoaTable()); await cho(800);

// --- Báo giá qua giao diện ---
await moTab(page, 'baogia');
ok((await page.textContent('#baoGiaTableWrap')).includes('Chưa có báo giá'), 'tab Báo giá trống ban đầu');
await page.click('#btnAddBaoGia'); await page.waitForSelector('#bgItemsContainer .itemRow');
await page.selectOption('#fDoiTac', 'KH1'); await cho(200);
ok(await page.inputValue('#fMSTKhach') === '0312345678', 'chọn khách -> tự điền MST');
await page.fill('#fTieuDe', 'Báo giá camera văn phòng');
ok((await page.inputValue('#fHieuLuc')) > (await page.inputValue('#fNgay')), 'hiệu lực mặc định sau ngày báo giá');
ok((await page.inputValue('#fDieuKhoan')).includes('Hàng mới 100%'), 'điều khoản mặc định từ cài đặt');
const dong1 = page.locator('#bgItemsContainer .itemRow').nth(0);
await dong1.locator('.itemHHSearch').fill('Camera Yoose');
await cho(300);
await dong1.locator(`.hhComboItem[data-mahh="${cam.maHH}"]`).dispatchEvent('mousedown');
await cho(200);
ok(await dong1.locator('.itemHH').inputValue() === cam.maHH, 'báo giá chọn được hàng đang hết tồn (không trừ kho)');
ok(await dong1.locator('.itemGia').inputValue() === '880.000', 'giá gợi ý = giá bán');
await dong1.locator('.itemSL').fill('2'); await dong1.locator('.itemSL').dispatchEvent('input');
await page.click('#bgItemsContainer button:has-text("Thêm dòng hàng")');
const dong2 = page.locator('#bgItemsContainer .itemRow').nth(1);
await dong2.locator('.itemHHSearch').fill('Công cài');
await cho(300);
await dong2.locator('.hhComboItem[data-mahh="DV1"]').dispatchEvent('mousedown');
await cho(200);
await page.screenshot({ path: SHOT + '/in-2-form-baogia.png', fullPage: true });
await page.click('#modalCard .modalActions button:has-text("Lưu báo giá")');
const txtBG = await chuBanIn(page);
ok(thuong(txtBG).includes('bảng báo giá') && txtBG.includes('Kính gửi: Trạm Y tế Linh Xuân') && txtBG.includes('0317838601'), 'lưu báo giá -> tự mở bản in đúng khách + MST công ty', txtBG.slice(0, 200));
// 2 x 880.000 + 200.000 = 1.960.000; thuế 8% = 156.800; tổng 2.116.800
ok(txtBG.includes('1.960.000') && txtBG.includes('156.800') && txtBG.includes('2.116.800') && txtBG.includes('Hai triệu một trăm mười sáu nghìn tám trăm đồng'), 'bản in báo giá: tiền hàng, thuế 8%, tổng, bằng chữ', txtBG.slice(0, 1500));
ok(txtBG.includes('Vũ Mạnh Hưng') && txtBG.includes('Báo giá camera văn phòng') && txtBG.includes('Hàng mới 100%') && /BG\d\d-0001/.test(txtBG), 'bản in báo giá: người đại diện, V/v, điều khoản, số BG');
await page.screenshot({ path: SHOT + '/in-3-banin-baogia.png' });
await page.click('#modalCard .modalActions button:has-text("Đóng")'); await cho(300);
ok(await page.locator('#modalCard').evaluate(el => !el.classList.contains('modalIn')), 'đóng xem trước -> popup sau không bị dính khổ rộng');
const bgRow = page.locator('#baoGiaTableWrap tbody tr').first();
ok((await bgRow.textContent()).includes('Mới tạo') && (await bgRow.textContent()).includes('2.116.800'), 'danh sách báo giá có dòng mới', await bgRow.textContent());

// Chốt khi kho chưa đủ -> cảnh báo ngay trong form, máy chủ chặn khi lưu
await bgRow.locator('button[title="Chốt → tạo phiếu xuất"]').click();
await page.waitForSelector('#xuatItemsContainer .itemRow');
await cho(400);
ok((await page.textContent('#modalCard h3')).includes('Tạo phiếu xuất từ báo giá'), 'mở form phiếu xuất từ báo giá');
ok(await page.locator('#xuatItemsContainer .itemRow').count() === 2 && await page.inputValue('#fDoiTac') === 'KH1', 'form phiếu xuất điền sẵn khách + 2 dòng hàng');
ok((await page.textContent('#modalCard .hopGhiChu')).includes('Kho chưa đủ'), 'cảnh báo kho chưa đủ trước khi lưu', await page.textContent('#modalCard .hopGhiChu'));
await page.click('#modalCard .modalActions button:has-text("Lưu phiếu")'); await cho(900);
ok((await page.textContent('#toast')).includes('KHONG_DU_TON_KHO'), 'máy chủ chặn bán quá tồn', await page.textContent('#toast'));
await page.click('#modalCard .modalActions button:has-text("Huỷ")'); await cho(300);

// --- Nhập tồn đầu kỳ từ form sửa hàng hoá (đúng chỗ anh hỏi) ---
await moTab(page, 'danhmuc');
await page.fill('#searchHH', 'Camera Yoose 2 mắt UI'); await cho(300);
await page.locator('#hhTableWrap button[title="Sửa"]').first().click(); await cho(300);
ok((await page.textContent('#modalCard')).includes('Nhập tồn đầu kỳ cho mặt hàng này'), 'form sửa hàng hoá có nút nhập tồn đầu kỳ');
await page.screenshot({ path: SHOT + '/in-4-form-hanghoa.png', fullPage: true });
await page.click('#modalCard button:has-text("Nhập tồn đầu kỳ cho mặt hàng này")');
await page.waitForSelector('#kkKhung .kkBang tbody tr');
ok(await page.locator('#kkKhung tbody tr').count() === 1, 'form tồn đầu kỳ lọc sẵn đúng 1 mặt hàng');
await page.locator('#kkKhung .kkSL').fill('3'); await page.locator('#kkKhung .kkSL').dispatchEvent('input');
await page.locator('#kkKhung .kkGia').fill('500000'); await page.locator('#kkKhung .kkGia').dispatchEvent('input');
ok((await page.textContent('#kkTomTat')).includes('1.500.000'), 'tóm tắt tổng giá trị tồn đầu kỳ', await page.textContent('#kkTomTat'));
await page.screenshot({ path: SHOT + '/in-5-tondauky.png', fullPage: true });
await page.click('#modalCard .modalActions button:has-text("Lưu tồn đầu kỳ")'); await cho(1200);
let camHH = await page.evaluate(ma => STATE.hangHoaList.find(h => h.MaHH === ma), cam.maHH);
ok(Number(camHH.TonKho) === 3 && Number(camHH.GiaVonTB) === 500000, 'lưu tồn đầu kỳ -> tồn 3, giá vốn 500.000 (cập nhật ngay trên bảng)', camHH);

// --- Chốt lại báo giá: lần này đủ kho ---
await moTab(page, 'baogia');
await page.locator('#baoGiaTableWrap tbody tr').first().locator('button[title="Chốt → tạo phiếu xuất"]').click();
await page.waitForSelector('#xuatItemsContainer .itemRow'); await cho(400);
ok(!(await page.textContent('#modalCard .hopGhiChu')).includes('Kho chưa đủ'), 'đủ kho -> không còn cảnh báo');
await page.click('#modalCard .modalActions button:has-text("Lưu phiếu")'); await cho(1200);
ok((await page.textContent('#toast')).includes('Đã chốt'), 'lưu phiếu xuất -> thông báo báo giá đã chốt', await page.textContent('#toast'));
await moTab(page, 'baogia');
const bgRow2 = await page.locator('#baoGiaTableWrap tbody tr').first().textContent();
ok(bgRow2.includes('Đã chốt') && bgRow2.includes('XB'), 'báo giá hiện "Đã chốt" + mã phiếu xuất', bgRow2);
ok(await page.locator('#baoGiaTableWrap tbody tr').first().locator('button[title="Chốt → tạo phiếu xuất"]').count() === 0, 'báo giá đã chốt không còn nút chốt/sửa');
camHH = await page.evaluate(() => apiCall('getHangHoaList')).then(l => l.find(h => h.MaHH === cam.maHH));
ok(Number(camHH.TonKho) === 1, 'chốt báo giá trừ kho: 3 − 2 = 1', camHH);

// --- In các chứng từ khác ---
await moTab(page, 'xuatban');
const idXB = await page.evaluate(ma => STATE.xuatBanList.find(x => (x.GhiChu || '').startsWith('Theo báo giá')).IDPhieu);
await page.locator(`button[title="In biên bản giao nhận"][onclick*="${idXB}"]`).click();
let t = await chuBanIn(page);
ok(thuong(t).includes('biên bản giao nhận hàng hoá') && thuong(t).includes('cộng hoà xã hội chủ nghĩa việt nam') && t.includes('Trạm Y tế Linh Xuân') && t.includes('2.116.800'), 'in biên bản giao nhận (có quốc hiệu, bên nhận, tổng tiền)', t.slice(0, 300));
await page.screenshot({ path: SHOT + '/in-6-bbgn.png' });
await page.uncheck('#modalCard .inThanh input[data-k="gia"]'); await cho(600);
t = await page.frameLocator('#khungIn').locator('body').textContent();
ok(!t.includes('Đơn giá') && !t.includes('2.116.800') && t.includes('Camera Yoose 2 mắt UI'), 'tắt "Hiện đơn giá" -> biên bản chỉ còn tên hàng, số lượng');
await page.click('#modalCard .modalActions button:has-text("Đóng")'); await cho(300);

await moTab(page, 'nhapkho');
await page.locator('#nhapTableWrap button[title="In phiếu nhập kho"]').first().click();
t = await chuBanIn(page);
ok(thuong(t).includes('phiếu nhập kho') && t.includes('Mẫu số 01 - VT') && t.includes('Thông tư số 133/2016/TT-BTC') && t.includes('Tổng số tiền (viết bằng chữ)'), 'in phiếu nhập kho mẫu 01-VT', t.slice(0, 300));
await page.screenshot({ path: SHOT + '/in-7-pnk.png' });
await page.click('#modalCard .modalActions button:has-text("Đóng")'); await cho(300);

await moTab(page, 'soquy');
await page.fill('#quyTuNgay', '2026-01-01'); await page.click('#btnLocQuy'); await cho(900);
await page.locator('#soQuyTableWrap button[title^="In phiếu"]').first().click();
t = await chuBanIn(page);
ok((thuong(t).includes('phiếu thu') && t.includes('Mẫu số 01 - TT')) || (thuong(t).includes('phiếu chi') && t.includes('Mẫu số 02 - TT')), 'in phiếu thu/chi theo mẫu 01-TT/02-TT', t.slice(0, 300));
ok(t.includes('(Viết bằng chữ)') && t.includes('Thủ quỹ'), 'phiếu thu/chi có bằng chữ + chữ ký thủ quỹ');
await page.screenshot({ path: SHOT + '/in-8-phieuthu.png' });
await page.click('#modalCard .modalActions button:has-text("Đóng")'); await cho(300);

await moTab(page, 'suachua');
await page.locator('#suaChuaTableWrap button[title="In phiếu sửa chữa"]').first().click();
t = await chuBanIn(page);
ok(thuong(t).includes('sửa chữa') && t.includes('Thiết bị:') && t.includes('Bảo hành:'), 'in phiếu sửa chữa', t.slice(0, 300));
await page.click('#modalCard .modalActions button:has-text("Đóng")'); await cho(300);

await moTab(page, 'giacong');
await page.locator('#giaCongTableWrap button[title="In biên bản nghiệm thu"]').first().click();
t = await chuBanIn(page);
ok(thuong(t).includes('nghiệm thu') && t.includes('Bên A') && t.includes('Bên B'), 'in biên bản nghiệm thu gia công', t.slice(0, 300));
await page.screenshot({ path: SHOT + '/in-9-giacong.png' });
await page.click('#modalCard .modalActions button:has-text("Đóng")'); await cho(300);

// --- Kiểm kê qua giao diện ---
await moTab(page, 'kiemke');
const tonChuot = await page.evaluate(() => apiCall('getHangHoaList')).then(l => Number(l.find(h => h.MaHH === 'CHUOT').TonKho));
await page.click('#btnKiemKe'); await page.waitForSelector('#kkKhung .kkBang tbody tr');
await page.fill('#timKK', 'Chuột'); await page.dispatchEvent('#timKK', 'input'); await cho(300);
const dongChuot = page.locator('#kkKhung tr[data-mahh="CHUOT"]');
await dongChuot.locator('.kkSL').fill(String(tonChuot - 1)); await dongChuot.locator('.kkSL').dispatchEvent('input');
await dongChuot.locator('.kkLyDo').fill('Hỏng 1 cái'); await dongChuot.locator('.kkLyDo').dispatchEvent('input');
ok((await dongChuot.locator('.kkCL').textContent()).includes('-1'), 'kiểm kê: chênh lệch -1 hiện ngay', await dongChuot.locator('.kkCL').textContent());
ok((await page.textContent('#kkTomTat')).includes('Thiếu: 1'), 'tóm tắt thừa/thiếu', await page.textContent('#kkTomTat'));
await page.fill('#timKK', ''); await page.dispatchEvent('#timKK', 'input'); await cho(300);
ok(await page.locator('#kkKhung tr[data-mahh="CHUOT"] .kkSL').inputValue() === String(tonChuot - 1), 'lọc lại danh sách không mất số đã nhập');
await page.screenshot({ path: SHOT + '/in-10-kiemke.png', fullPage: true });
await page.click('#modalCard .modalActions button:has-text("Lưu phiếu kiểm kê")'); await cho(1200);
ok((await page.textContent('#toast')).includes('điều chỉnh 1 mặt hàng'), 'lưu phiếu kiểm kê', await page.textContent('#toast'));
ok(Number(await page.evaluate(() => STATE.hangHoaList.find(h => h.MaHH === 'CHUOT').TonKho)) === tonChuot - 1, 'tồn chuột giảm 1 ngay trên bảng');
const kkRows = await page.textContent('#kiemKeTableWrap');
ok(kkRows.includes('Kiểm kê') && kkRows.includes('Tồn đầu kỳ'), 'danh sách phiếu có cả kiểm kê và tồn đầu kỳ');
const idKK = await page.evaluate(() => STATE.kiemKeList.find(p => p.Loai === 'KiemKe').IDPhieu);
await page.locator(`button[title="In biên bản"][onclick*="${idKK}"]`).click();
t = await chuBanIn(page);
ok(thuong(t).includes('biên bản kiểm kê') && t.includes('Mẫu số 05 - VT') && t.includes('Hỏng 1 cái') && t.includes('Trưởng ban kiểm kê'), 'in biên bản kiểm kê mẫu 05-VT', t.slice(0, 300));
await page.screenshot({ path: SHOT + '/in-11-bbkk.png' });
await page.click('#modalCard .modalActions button:has-text("Đóng")'); await cho(300);
await page.locator(`button[title="Xoá"][onclick*="${idKK}"]`).click(); await cho(1200);
ok(Number(await page.evaluate(() => STATE.hangHoaList.find(h => h.MaHH === 'CHUOT').TonKho)) === tonChuot, 'xoá phiếu kiểm kê -> tồn chuột về như cũ');
for (const tab of ['baogia', 'kiemke']) { await moTab(page, tab); await page.screenshot({ path: SHOT + `/in-tab-${tab}-desktop.png`, fullPage: true }); }
ok(!loi.length, 'máy tính: không có lỗi JS', loi);

console.log('B. Điện thoại (390x844)');
const m = await moTrang({ width: 390, height: 844 });
await moTab(m.page, 'baogia');
ok((await m.page.textContent('#baoGiaTableWrap')).includes('Đã chốt'), 'điện thoại: thấy danh sách báo giá');
await m.page.screenshot({ path: SHOT + '/in-m1-baogia.png', fullPage: true });
await m.page.locator('#baoGiaTableWrap button[title="In báo giá"]').first().click();
t = await chuBanIn(m.page);
ok(thuong(t).includes('bảng báo giá'), 'điện thoại: xem trước bản in báo giá');
const zoom = await m.page.frameLocator('#khungIn').locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--z'));
ok(Number(zoom) > 0.3 && Number(zoom) < 0.6, 'điện thoại: bản in thu nhỏ vừa khung (không phải cuộn ngang)', zoom);
const tran = await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
ok(tran, 'điện thoại: popup xem trước không làm tràn ngang trang');
await m.page.screenshot({ path: SHOT + '/in-m2-banin.png' });
await m.page.click('#modalCard .modalActions button:has-text("Đóng")'); await cho(300);
await moTab(m.page, 'kiemke');
await m.page.screenshot({ path: SHOT + '/in-m3-kiemke.png', fullPage: true });
await m.page.click('#btnKiemKe'); await m.page.waitForSelector('#kkKhung .kkBang tbody tr');
ok(await m.page.evaluate(() => { const k = document.getElementById('kkKhung'); return document.documentElement.scrollWidth <= window.innerWidth + 1 && k.scrollWidth <= k.clientWidth + 1; }), 'điện thoại: form kiểm kê không tràn ngang (cả bảng bên trong)');
await m.page.screenshot({ path: SHOT + '/in-m4-form-kiemke.png', fullPage: true });
await m.page.click('#modalCard .modalActions button:has-text("Huỷ")'); await cho(300);
await moTab(m.page, 'baogia');
await m.page.click('#btnAddBaoGia'); await m.page.waitForSelector('#bgItemsContainer .itemRow');
ok(await m.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'điện thoại: form báo giá không tràn ngang');
await m.page.screenshot({ path: SHOT + '/in-m5-form-baogia.png', fullPage: true });
await m.page.click('#modalCard .modalActions button:has-text("Huỷ")');
ok(!m.loi.length, 'điện thoại: không có lỗi JS', m.loi);

// --- Dọn dẹp dữ liệu test (dùng trang điện thoại: đăng nhập sau nên phiên máy tính đã bị đá ra — đơn phiên) ---
const bgIds = await api(m.page, 'getBaoGiaList', { gioiHan: 0 }).then(l => l.map(x => x.IDPhieu));
await api(m.page, 'xoaPhieuXuat', { idPhieu: idXB });
for (const id of bgIds) await api(m.page, 'xoaBaoGia', { idPhieu: id });
for (const p of await api(m.page, 'getKiemKeList')) await api(m.page, 'xoaKiemKe', { idPhieu: p.IDPhieu });
await api(m.page, 'deleteHangHoa', { maHH: cam.maHH });
const hhCuoi = await api(m.page, 'getHangHoaList');
ok(!hhCuoi.some(h => h.MaHH === cam.maHH) && Number(hhCuoi.find(h => h.MaHH === 'CHUOT').TonKho) === tonChuot, 'dọn dẹp xong, tồn chuột như ban đầu');

await browser.close();
console.log(`\nKẾT QUẢ IN ẤN / BÁO GIÁ / KIỂM KÊ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
