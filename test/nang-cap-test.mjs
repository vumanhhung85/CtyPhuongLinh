// Kiểm thử TỰ NÂNG CẤP CSDL ĐANG CHẠY THẬT, đúng như lúc deploy:
//   1) chạy Worker BẢN CŨ (lấy từ git, mặc định HEAD) trên 1 D1 trống -> khởi tạo + nạp dữ liệu như CSDL thật đang có;
//   2) tắt, chạy Worker BẢN MỚI trên CHÍNH D1 đó -> phải tự thêm bảng/cột mới, dữ liệu cũ giữ nguyên, tính năng mới chạy được.
// Chạy: node test/nang-cap-test.mjs [git-ref-ban-cu]   (tự bật/tắt wrangler dev ở cổng 8787 — dừng dev.sh trước)
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname;
const WR = process.env.WRANGLER || '/tmp/claude-0/-home-claude/2c28eb33-5af1-55c1-9ee2-5fa2e7bcef5e/scratchpad/tools/node_modules/.bin/wrangler';
const TMP = process.env.TMPDIR_NANGCAP || '/tmp/nangcap-test';
const PERSIST = TMP + '/d1';
const API = 'http://localhost:8787', KEY = 'khoa-chuyen-du-lieu-test-123';
const refCu = process.argv[2] || 'HEAD';
let pass = 0, fail = 0;
const ok = (dk, ten, ct) => { if (dk) { pass++; console.log('  ✓', ten); } else { fail++; console.log('  ✗', ten, ct !== undefined ? JSON.stringify(ct).slice(0, 400) : ''); } };
const goi = async body => (await fetch(API, { method: 'POST', body: JSON.stringify(body), headers: { Origin: 'http://localhost:8000' } })).json();
const ngu = ms => new Promise(r => setTimeout(r, ms));
function dungWorker() { try { execSync('pkill -f "wrangler dev"; pkill -f workerd', { stdio: 'ignore' }); } catch (e) { /* không có tiến trình */ } }
async function chayWorker(fileToml) {
  dungWorker(); await ngu(1500);
  const p = spawn(WR, ['dev', '--config', fileToml, '--port', '8787', '--local', '--persist-to', PERSIST, '--var', 'MIGRATE_KEY:' + KEY, '--var', 'ALLOWED_ORIGINS:http://localhost:8000'],
    { cwd: TMP, detached: true, stdio: 'ignore' });
  p.unref();
  for (let i = 0; i < 60; i++) { try { const r = await goi({ action: 'ping' }); if (r.error === 'AUTH_FAILED') return; } catch (e) { /* chưa lên */ } await ngu(1000); }
  throw new Error('Worker không khởi động được: ' + fileToml);
}

rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP + '/cu', { recursive: true });
writeFileSync(TMP + '/cu/index.js', execSync(`git show ${refCu}:worker/src/index.js`, { cwd: ROOT }));
const toml = (ten, main) => `name = "${ten}"\nmain = "${main}"\ncompatibility_date = "2025-09-01"\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "phuonglinh_erp_test"\ndatabase_id = "00000000-0000-0000-0000-00000000test"\n`;
writeFileSync(TMP + '/cu.toml', toml('pl-cu', 'cu/index.js'));
writeFileSync(TMP + '/moi.toml', toml('pl-moi', ROOT + 'worker/src/index.js'));

console.log(`1. Bản cũ (${refCu}): khởi tạo + nạp dữ liệu`);
await chayWorker(TMP + '/cu.toml');
ok((await goi({ action: 'migrate.initSchema', key: KEY })).success, 'bản cũ khởi tạo cấu trúc');
await goi({ action: 'migrate.insert', key: KEY, table: 'HangHoa', rows: [{ MaHH: 'CU1', TenHH: 'Hàng cũ', Loai: 'HangHoa', DVT: 'Cái', GiaVonTB: 0, GiaBan: 200, TonKho: 0, TonKhoToiThieu: 0 }] });
const fin = await goi({ action: 'migrate.finalize', key: KEY, maHHs: ['CU1'], ngay: '2026-09-26', dieuChinh: [{ MaHH: 'CU1', SoLuongQuyDoi: 5, DonGiaQuyDoi: 100 }] });
ok(fin.success && fin.data.hangHoa[0].TonKho === 5, 'bản cũ: dòng điều chỉnh chuyển dữ liệu -> tồn 5', fin);
ok((await goi({ action: 'migrate.taoAdmin', key: KEY, matKhau: 'admin123', tenDangNhap: 'admin' })).success, 'bản cũ: tạo admin');
const lgCu = await goi({ action: 'login', tenDangNhap: 'admin', password: 'admin123' });
ok((await goi({ action: 'getBaoGiaList', token: lgCu.token })).error.startsWith('UNKNOWN_ACTION'), 'bản cũ chưa có báo giá (đúng là cấu trúc cũ)');

console.log('2. Bản mới chạy trên CHÍNH CSDL đó');
await chayWorker(TMP + '/moi.toml');
const lg = await goi({ action: 'login', tenDangNhap: 'admin', password: 'admin123' });
ok(lg.success, 'đăng nhập bình thường sau khi đổi bản', lg);
const api = async (action, extra = {}) => goi({ action, token: lg.token, ...extra });
const ds = await api('getBaoGiaList', { gioiHan: 200 });
ok(ds.success && Array.isArray(ds.data) && ds.data.length === 0, 'bảng BaoGia được tự tạo', ds);
ok((await api('getKiemKeList')).success, 'bảng KiemKe được tự tạo');
const ex = await api('exportTable', { table: 'DieuChinhKho' });
ok(ex.success && ex.data.cols.includes('IDPhieu') && ex.data.rows.length === 1 && ex.data.rows[0].LyDo.includes('Google Sheet') && ex.data.rows[0].SoLuongQuyDoi === 5 && ex.data.rows[0].IDPhieu === '', 'DieuChinhKho có thêm cột IDPhieu THẬT (giá trị trống, không phải chữ "IDPhieu"), dòng cũ giữ nguyên', ex);
const hh = await api('getHangHoaList');
ok(hh.success && hh.data.find(h => h.MaHH === 'CU1').TonKho === 5 && hh.data.find(h => h.MaHH === 'CU1').GiaVonTB === 100, 'tồn kho + giá vốn cũ giữ nguyên', hh);
const kk = await api('saveKiemKe', { data: { Loai: 'KiemKe', items: [{ MaHH: 'CU1', SoLuong: 4 }] } });
ok(kk.success && kk.data.tonKhoCapNhat.CU1.TonKho === 4, 'kiểm kê trên CSDL vừa nâng cấp: tồn tính từ sổ (5 cũ − 1)', kk);
if (kk.success) {
  const del = await api('xoaKiemKe', { idPhieu: kk.data.idPhieu });
  ok(del.success && del.data.tonKhoCapNhat.CU1.TonKho === 5, 'xoá phiếu kiểm kê chỉ gỡ dòng của phiếu, dòng chuyển dữ liệu cũ không bị đụng', del);
}
const bg = await api('saveBaoGia', { data: { TenKH: 'Khách', items: [{ MaHH: 'CU1', SoLuong: 1, DonGia: 200, ThueSuat: '8' }] } });
ok(bg.success && /^BG\d\d-0001$/.test(bg.data.phieu.SoBaoGia), 'tạo báo giá trên CSDL vừa nâng cấp', bg);
await chayWorker(TMP + '/moi.toml'); // khởi động lại lần nữa: kiểm tra lại cấu trúc không lỗi khi đã đủ bảng/cột
const lg2 = await goi({ action: 'login', tenDangNhap: 'admin', password: 'admin123' });
ok(lg2.success && (await goi({ action: 'getBaoGiaList', token: lg2.token, gioiHan: 200 })).data.length === 1, 'khởi động lại lần 2: không lỗi, dữ liệu mới còn nguyên');
dungWorker();
console.log(`\nKẾT QUẢ NÂNG CẤP: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
