// Kiểm thử giao diện bằng Chromium thật: đăng nhập, đi qua mọi tab, tạo phiếu nhập theo Cuộn, xuất bán, xem
// popup trên màn hình điện thoại, xuất Excel. Bắt mọi lỗi JS trên trang.
// Chạy: (Worker đã chạy ở :8787, web tĩnh ở :8000) node test/ui-test.mjs
import { createRequire } from 'node:module';
const require = createRequire('/tmp/claude-0/-home-claude/2c28eb33-5af1-55c1-9ee2-5fa2e7bcef5e/scratchpad/tools/package.json');
const { chromium } = require('playwright-core');
const XLSX = require('xlsx');
import { mkdirSync } from 'node:fs';

const WEB = 'http://localhost:8000', API = 'http://localhost:8787';
const SHOT = '/tmp/claude-0/-home-claude/2c28eb33-5af1-55c1-9ee2-5fa2e7bcef5e/scratchpad/shots';
mkdirSync(SHOT, { recursive: true });
let pass = 0, fail = 0;
const ok = (dk, ten, ct) => { if (dk) { pass++; console.log('  ✓', ten); } else { fail++; console.log('  ✗', ten, ct !== undefined ? JSON.stringify(ct).slice(0, 300) : ''); } };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function moTrang(viewport) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  await ctx.route('**/js/config.js*', r => r.fulfill({ contentType: 'application/javascript', body: `window.PL_CONFIG={API_URL:'${API}'};` }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ contentType: 'application/javascript',
    path: '/tmp/claude-0/-home-claude/2c28eb33-5af1-55c1-9ee2-5fa2e7bcef5e/scratchpad/tools/node_modules/xlsx/dist/xlsx.full.min.js' }));
  const page = await ctx.newPage();
  const loi = [];
  page.on('pageerror', e => loi.push('pageerror: ' + e.message));
  // Tệp có sẵn trong repo của anh (logo, icon, manifest) nhưng máy test không có -> bỏ qua; font Google bị chặn chủ ý.
  const BO_QUA = /favicon|apple-touch|Logo_|manifest\.json|icon-|fonts\.g/;
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) loi.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !BO_QUA.test(r.url())) loi.push('HTTP ' + r.status() + ': ' + r.url()); });
  page.on('requestfailed', r => { if (!BO_QUA.test(r.url())) loi.push('requestfailed: ' + r.url()); });
  page.on('dialog', d => d.accept());
  return { ctx, page, loi };
}
const cho = ms => new Promise(r => setTimeout(r, ms));
// Bấm 1 mục menu trái; trên điện thoại menu là ngăn kéo -> mở bằng nút ☰ trước.
async function moTab(pg, tab) {
  if (!(await pg.isVisible(`#tabbar button[data-tab="${tab}"]`)) || await pg.evaluate(() => matchMedia('(max-width:900px)').matches && !document.body.classList.contains('sbMo'))) {
    await pg.click('#btnMenu'); await cho(300);
  }
  await pg.click(`#tabbar button[data-tab="${tab}"]`);
}

console.log('A. Máy tính (1280x800)');
const { ctx, page, loi } = await moTrang({ width: 1280, height: 800 });
await page.goto(WEB + '/index.html');
ok(await page.isVisible('#loginScreen'), 'hiện màn đăng nhập');
await page.fill('#userInput', 'admin'); await page.fill('#pwInput', 'sai-mat-khau');
await page.click('#btnLogin'); await cho(800);
ok((await page.textContent('#loginErr')).includes('Sai mật khẩu'), 'báo sai mật khẩu', await page.textContent('#loginErr'));
await page.fill('#pwInput', 'phuonglinh2026'); await page.click('#btnLogin');
await page.waitForSelector('#dashCards .statCard', { timeout: 8000 });
ok(await page.isVisible('#appShell'), 'đăng nhập vào app');
ok((await page.textContent('#dashCards')).includes('Công nợ phải thu'), 'dashboard có thẻ số liệu');
ok((await page.textContent('#companyNameLabel')).includes('PHƯƠNG LINH'), 'tên công ty từ Config');
await page.screenshot({ path: SHOT + '/1-dashboard.png', fullPage: true });

const tabs = ['danhmuc', 'nhapkho', 'xuatban', 'suachua', 'giacong', 'congno', 'soquy', 'baocao', 'doitac', 'dongbohd', 'nguoidung', 'caidat', 'dashboard'];
for (const t of tabs) {
  await moTab(page, t); await cho(700);
  ok(await page.isVisible('#view-' + t), 'mở tab ' + t);
}
await moTab(page, 'baocao'); await cho(300);
await page.click('#btnXemBaoCao'); await cho(900);
ok((await page.textContent('#baocaoCards')).includes('Lợi nhuận gộp'), 'báo cáo doanh thu hiện số liệu');

console.log('B. Tạo phiếu nhập theo Cuộn qua giao diện');
await moTab(page, 'nhapkho'); await cho(500);
await page.click('#btnAddNhap'); await page.waitForSelector('#modalBg.active');
await page.fill('.itemHHSearch', 'cáp'); await cho(300);
await page.click('.hhComboItem >> nth=0'); await cho(300);
ok(await page.isVisible('.itemDonViChon'), 'mặt hàng có đơn vị lớn -> hiện ô chọn Cuộn/Mét');
ok(await page.$eval('.itemDonViChon', s => s.value) === 'nhap', 'nhập kho mặc định chọn Cuộn');
await page.fill('.itemSL', '2');
await page.fill('.itemGia', '1500000');
await page.dispatchEvent('.itemGia', 'input');
await page.click('button:has-text("Lưu phiếu")'); await cho(1500);
ok(!(await page.isVisible('#modalBg.active')), 'lưu phiếu nhập -> đóng popup');
await moTab(page, 'danhmuc'); await cho(800);
const dongCap = await page.textContent('#hhTableWrap');
ok(/Dây cáp mạng Cat5E[\s\S]*850/.test(dongCap), 'danh mục: tồn cáp 250 + 2 Cuộn x 300 = 850 Mét', dongCap.slice(0, 300));

console.log('C. Xuất bán theo Mét, xem popup chi tiết');
await moTab(page, 'xuatban'); await cho(500);
await page.click('#btnAddXuat'); await page.waitForSelector('#modalBg.active');
await page.fill('.itemHHSearch', 'cáp'); await cho(300);
await page.click('.hhComboItem >> nth=0'); await cho(300);
ok(await page.$eval('.itemDonViChon', s => s.value) === 'goc', 'xuất bán mặc định chọn Mét');
await page.fill('.itemSL', '100'); await page.fill('.itemGia', '12000'); await page.dispatchEvent('.itemGia', 'input');
await page.click('button:has-text("Lưu phiếu")'); await cho(1500);
ok(!(await page.isVisible('#modalBg.active')), 'lưu phiếu xuất');
const hangDau = await page.textContent('#xuatTableWrap tbody tr:first-child');
ok(hangDau.includes('1.296.000'), 'phiếu mới nằm đầu danh sách, tổng 100 x 12.000 + 8% = 1.296.000', hangDau);
await page.click('#xuatTableWrap tbody tr:first-child button[title="Xem"]'); await page.waitForSelector('#modalBg.active');
ok((await page.textContent('#modalCard')).includes('100 Mét'), 'popup chi tiết hiện 100 Mét');
await page.click('#modalCard button:has-text("Đóng")'); await cho(300);

console.log('C2. Bố cục mới: thẻ số liệu, bảng, bộ lọc, tab phụ, thu gọn menu');
ok(await page.locator('#kpiXuat .statCard.kpi').count() === 4, 'trang Bán hàng có 4 thẻ số liệu màu');
const tongThang = await page.evaluate(() => STATE.xuatBanList.filter(x => laThangNay(x.Ngay)).reduce((s, x) => s + Number(x.TongTien), 0));
ok(tongThang >= 1296000 && (await page.textContent('#kpiXuat .statCard:first-child')).includes(tongThang.toLocaleString('vi-VN')), 'thẻ "Bán hàng tháng này" = tổng các phiếu tháng này (có phiếu vừa tạo)', tongThang);
ok(/Tổng số:\s*\d+\s*bản ghi/.test(await page.textContent('#xuatTableWrap .chanBang')), 'chân bảng "Tổng số: N bản ghi"');
const cotTien = await page.$$eval('#xuatTableWrap thead th', ths => ths.filter(t => t.classList.contains('soCot')).map(t => t.textContent));
ok(cotTien.includes('Tổng thanh toán') && !cotTien.includes('Khách hàng'), 'cột tiền căn phải, cột chữ giữ căn trái', cotTien);
ok((await page.textContent('#xuatTableWrap thead th:last-child')).trim() === 'Chức năng', 'cột nút có tiêu đề "Chức năng"');
await page.fill('#timXuat', 'khong-co-khach-nay'); await cho(300);
ok((await page.textContent('#xuatTableWrap')).includes('Không có phiếu nào khớp'), 'ô tìm kiếm lọc danh sách');
await page.fill('#timXuat', ''); await cho(300);
await page.selectOption('#locXuat', 'chuaHD'); await cho(300);
ok((await page.textContent('#xuatTableWrap tbody')).includes('Chưa xuất HĐ') && !(await page.textContent('#xuatTableWrap tbody')).includes('Đã xuất HĐ'), 'lọc "Chưa xuất hoá đơn"');
await page.selectOption('#locXuat', ''); await cho(300);
await moTab(page, 'doitac'); await cho(800);
ok(await page.isVisible('#khTableWrap') && !(await page.isVisible('#nccTableWrap')), 'Đối tác: mặc định tab Khách hàng');
await page.click('.pillTabs[data-nhom="doitac"] button[data-pane="ncc"]'); await cho(200);
ok(await page.isVisible('#nccTableWrap') && !(await page.isVisible('#khTableWrap')), 'bấm tab Nhà cung cấp -> đổi bảng');
await page.click('#btnMenu'); await cho(300);
const rongMenu = await page.$eval('#sidebar', el => el.getBoundingClientRect().width);
ok(rongMenu < 80, 'nút ☰ thu gọn menu còn biểu tượng', rongMenu);
await page.screenshot({ path: SHOT + '/1b-menu-thu-gon.png' });
await page.click('#btnMenu'); await cho(300);
ok(loi.length === 0, 'không có lỗi JavaScript trên trang (máy tính)', loi);

console.log('D. Xuất Excel toàn bộ dữ liệu');
await moTab(page, 'caidat'); await cho(600);
ok((await page.inputValue('#settingsApiUrl')) === API, 'Cài đặt hiện đúng địa chỉ API');
await page.click('#btnKiemTraKetNoi'); await cho(800);
ok((await page.textContent('#ketQuaKetNoi')).includes('Kết nối tốt'), 'nút kiểm tra kết nối', await page.textContent('#ketQuaKetNoi'));
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#btnXuatExcel')]);
const duongDan = SHOT + '/xuat.xlsx'; await dl.saveAs(duongDan);
const wb = XLSX.readFile(duongDan);
ok(wb.SheetNames.includes('HangHoa') && wb.SheetNames.includes('XuatBanCT') && wb.SheetNames.length === 17, 'file Excel đủ 17 sheet đúng tên cũ', wb.SheetNames);
const kh = XLSX.utils.sheet_to_json(wb.Sheets.KhachHang);
const o = wb.Sheets.KhachHang; const oMST = Object.keys(o).find(k => o[k].v === '0312345678');
ok(oMST && o[oMST].t === 's', 'MST xuất ra Excel là ô CHỮ, giữ số 0 đầu', kh[0]);
ok(!XLSX.utils.sheet_to_json(wb.Sheets.NguoiDung)[0].MatKhauHash, 'không xuất mật khẩu băm');
ok((await page.textContent('#xuatExcelTrangThai')).includes('Đã xuất'), 'báo đã xuất xong');
await ctx.close();

console.log('E. Điện thoại (390x844): popup chi tiết không tràn ngang');
const m = await moTrang({ width: 390, height: 844 });
await m.page.goto(WEB + '/index.html');
await m.page.fill('#userInput', 'admin'); await m.page.fill('#pwInput', 'phuonglinh2026'); await m.page.click('#btnLogin');
await m.page.waitForSelector('#dashCards .statCard', { timeout: 8000 });
await moTab(m.page, 'xuatban'); await cho(800);
await m.page.evaluate(() => document.querySelector('#xuatTableWrap tbody tr:first-child button[title="Xem"]').click());
await m.page.waitForSelector('#modalBg.active'); await cho(300);
const tran = await m.page.$eval('#modalCard', el => ({ sw: el.scrollWidth, cw: el.clientWidth, w: el.getBoundingClientRect().width }));
ok(tran.sw <= tran.cw + 1 && tran.w <= 390, 'popup vừa khít màn hình điện thoại', tran);
await m.page.screenshot({ path: SHOT + '/2-mobile-popup.png' });
await m.page.click('#modalCard button:has-text("Đóng")');
await m.page.evaluate(() => window.scrollTo(0, 600)); await cho(300);
const thead = await m.page.$eval('#xuatTableWrap thead th', th => getComputedStyle(th).position);
ok(thead !== 'sticky', 'tiêu đề bảng không còn sticky (đã bỏ theo yêu cầu)', thead);
const hdrTop = await m.page.$eval('header.topbar', el => el.getBoundingClientRect().top);
ok(Math.abs(hdrTop) <= 1, 'thanh đầu trang (nút ☰) vẫn dính trên cùng khi cuộn', { hdrTop });
const menuAn = await m.page.$eval('#sidebar', el => el.getBoundingClientRect().right);
ok(menuAn <= 1, 'menu trái ẩn trên điện thoại (không chiếm màn hình)', { menuAn });
await moTab(m.page, 'xuatban'); await cho(400);
ok(!(await m.page.evaluate(() => document.body.classList.contains('sbMo'))), 'chọn mục menu xong ngăn kéo tự đóng');
ok((await m.page.textContent('#sbHoTen')).length > 0, 'tên người đăng nhập hiện ngay đầu menu');
await m.page.screenshot({ path: SHOT + '/3-mobile-cuon.png' });

console.log('F. Đơn phiên: đăng nhập máy khác -> máy này bị đưa về màn đăng nhập ở thao tác kế tiếp');
await fetch(API, { method: 'POST', body: JSON.stringify({ action: 'login', tenDangNhap: 'admin', password: 'phuonglinh2026' }) });
await moTab(m.page, 'congno'); await cho(1200);
ok(await m.page.isVisible('#loginScreen') && (await m.page.textContent('#loginErr')).includes('hết hiệu lực'), 'bị đưa về đăng nhập kèm lý do rõ ràng', await m.page.textContent('#loginErr'));
ok(m.loi.length === 0, 'không có lỗi JavaScript trên trang (điện thoại)', m.loi);
await m.ctx.close();
await browser.close();
console.log(`\nKẾT QUẢ GIAO DIỆN: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
