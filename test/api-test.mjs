// Kiểm thử API trên Worker thật (wrangler dev + D1 cục bộ). Chạy: bash test/dev.sh start && node test/api-test.mjs
import { createHash } from 'node:crypto';
const API = process.env.API || 'http://localhost:8787';
const KEY = 'khoa-chuyen-du-lieu-test-123';
let pass = 0, fail = 0;
const ok = (dk, ten, chiTiet) => { if (dk) { pass++; console.log('  ✓', ten); } else { fail++; console.log('  ✗', ten, chiTiet !== undefined ? JSON.stringify(chiTiet).slice(0, 400) : ''); } };
const gan = (a, b, e = 1e-6) => Math.abs(Number(a) - Number(b)) <= e;
async function goi(body, path = '/') {
  const r = await fetch(API + path, { method: 'POST', body: JSON.stringify(body), headers: { Origin: 'http://localhost:8000' } });
  return r.json();
}
const mig = (action, extra = {}) => goi({ action, key: KEY, ...extra });
let TOKEN = '';
async function api(action, extra = {}) { const r = await goi({ action, token: TOKEN, ...extra }); if (!r.success) throw new Error(action + ': ' + r.error); return r.data; }
async function apiLoi(action, extra = {}) { const r = await goi({ action, token: TOKEN, ...extra }); return r.success ? null : r.error; }
const sha256b64 = s => createHash('sha256').update(s, 'utf8').digest('base64');

console.log('1. Khởi tạo & chuyển dữ liệu tối thiểu');
ok((await mig('migrate.initSchema')).success, 'initSchema');
ok((await mig('migrate.initSchema')).success, 'initSchema chạy lại lần 2 không lỗi (IF NOT EXISTS)');
ok((await goi({ action: 'migrate.status', key: 'sai-khoa-123456' })).error === 'SAI_MA_CHUYEN_DU_LIEU', 'sai MIGRATE_KEY bị chặn');
await mig('migrate.insert', { table: 'Config', rows: [
  { Key: 'CompanyName', Value: 'CÔNG TY TNHH DỊCH VỤ CÔNG NGHỆ PHƯƠNG LINH' }, { Key: 'SePayWebhookSecret', Value: 'bi-mat-sepay-abc' },
  { Key: 'SoDuTienMatDauKy', Value: 1000000 }, { Key: 'BankBin', Value: '970426' }] });
// Mật khẩu kiểu cũ của Code.gs: base64(SHA-256) không salt
const r1 = await mig('migrate.insert', { table: 'NguoiDung', rows: [
  { MaNV: 'NV001', HoTen: 'Vũ Mạnh Hưng', TenDangNhap: 'admin', MatKhauHash: sha256b64('phuonglinh2026'), VaiTro: 'Admin', TrangThai: 'Active', NgayTao: '2026-01-01' },
  { MaNV: 'NV002', HoTen: 'Nhân viên BH', TenDangNhap: 'banhang', MatKhauHash: sha256b64('matkhau1'), VaiTro: 'BanHang', TrangThai: 'Active', NgayTao: '2026-01-01' }] });
ok(r1.success && r1.data.inserted === 2, 'chèn NguoiDung', r1);
await mig('migrate.insert', { table: 'HangHoa', rows: [
  { MaHH: 'CAP', TenHH: 'Dây cáp mạng Cat5E', Loai: 'HangHoa', DVT: 'Mét', GiaVonTB: 0, GiaBan: 10000, TonKho: 0, TonKhoToiThieu: 20, DVTNhap: 'Cuộn', HeSoQuyDoi: 300 },
  { MaHH: 'CHUOT', TenHH: 'Chuột Logitech', Loai: 'HangHoa', DVT: 'Cái', GiaVonTB: 0, GiaBan: 150000, TonKho: 0, TonKhoToiThieu: 1 },
  { MaHH: 'DV1', TenHH: 'Công cài đặt', Loai: 'DichVu', DVT: 'lần', GiaBan: 200000 }] });
await mig('migrate.insert', { table: 'KhachHang', rows: [{ MaKH: 'KH1', TenKH: 'Trạm Y tế Linh Xuân', MST: '0312345678', SDT: '0909123456' }] });
await mig('migrate.insert', { table: 'NhaCungCap', rows: [{ MaNCC: 'NCC1', TenNCC: 'Công ty Ngôi Sao Lớn', MST: '0301234567' }] });
const st = await mig('migrate.status');
ok(st.data.dem.HangHoa === 3 && st.data.dem.NguoiDung === 2, 'đếm dữ liệu sau chèn', st.data.dem);
const mstKH = (await mig('migrate.status'));

console.log('2. Đăng nhập (mật khẩu kiểu cũ -> tự nâng cấp PBKDF2), đơn phiên, khoá khi sai nhiều');
let lg = await goi({ action: 'login', tenDangNhap: 'admin', password: 'sai' });
ok(!lg.success && lg.error === 'SAI_MAT_KHAU', 'sai mật khẩu', lg);
lg = await goi({ action: 'login', tenDangNhap: 'khongco', password: 'x' });
ok(!lg.success && lg.error === 'SAI_TAI_KHOAN', 'sai tài khoản');
lg = await goi({ action: 'login', tenDangNhap: 'admin', password: 'phuonglinh2026' });
ok(lg.success && lg.token && lg.user.vaiTro === 'Admin' && lg.companyName.includes('PHƯƠNG LINH'), 'đăng nhập bằng mật khẩu băm kiểu cũ của GAS', lg);
const token1 = lg.token;
lg = await goi({ action: 'login', tenDangNhap: 'admin', password: 'phuonglinh2026' });
ok(lg.success, 'đăng nhập lại lần 2 (sau khi hash đã nâng cấp PBKDF2)');
TOKEN = token1;
ok(await apiLoi('pingPhien') === 'AUTH_FAILED', 'phiên cũ bị đá ra khi đăng nhập nơi khác (đơn phiên)');
TOKEN = lg.token;
ok((await api('pingPhien')).ok, 'phiên mới hoạt động');
for (let i = 0; i < 5; i++) lg = await goi({ action: 'login', tenDangNhap: 'banhang', password: 'sai' + i });
ok(lg.error === 'TAM_KHOA_DO_SAI_NHIEU_LAN', 'sai 5 lần -> tạm khoá', lg);
lg = await goi({ action: 'login', tenDangNhap: 'banhang', password: 'matkhau1' });
ok(lg.error === 'TAM_KHOA_DO_SAI_NHIEU_LAN', 'đang tạm khoá thì mật khẩu đúng cũng bị chặn', lg);

console.log('3. Nhập kho theo CUỘN -> tồn quy đổi ra MÉT, giá vốn/mét');
const nk = await api('saveNhapKho', { data: { Ngay: '2026-09-01', MaNCC: 'NCC1', TenNCC: 'Công ty Ngôi Sao Lớn', SoHDMuaVao: '00123', items: [
  { MaHH: 'CAP', TenHH: 'Dây cáp mạng Cat5E', SoLuong: 1, DonGia: 1500000, ThueSuat: '8', DonViDaChon: 'nhap', DVT: 'Cuộn' },
  { MaHH: 'CHUOT', TenHH: 'Chuột Logitech', SoLuong: 10, DonGia: 100000, ThueSuat: '10', DonViDaChon: 'goc', DVT: 'Cái' }] } });
ok(nk.tongTienTruocThue === 2500000 && nk.tongTienThue === 120000 + 100000 && nk.tongTien === 2720000, 'tổng tiền/thuế phiếu nhập', nk);
ok(nk.tonKhoCapNhat.CAP.TonKho === 300 && nk.tonKhoCapNhat.CAP.GiaVonTB === 5000, '1 Cuộn -> tồn 300 Mét, giá vốn 5.000đ/Mét', nk.tonKhoCapNhat);
ok(nk.tonKhoCapNhat.CHUOT.TonKho === 10 && nk.tonKhoCapNhat.CHUOT.GiaVonTB === 100000, 'chuột tồn 10, giá vốn 100.000', nk.tonKhoCapNhat);
ok(nk.phieu.IDPhieu.startsWith('NK') && nk.phieu.DaTra === 0 && nk.phieu.SoHDMuaVao === '00123', 'phiếu trả về giữ số 0 đầu số HĐ');
const ctNk = await api('getNhapKhoDetail', { idPhieu: nk.idPhieu });
ok(ctNk.items.length === 2 && ctNk.items[0].HeSoQuyDoi === 300 && ctNk.items[0].SoLuongQuyDoi === 300 && ctNk.items[0].ThueSuat === '8', 'chi tiết lưu hệ số 300 + SL quy đổi, thuế suất dạng chữ "8"', ctNk.items[0]);

console.log('4. Xuất bán theo MÉT, chặn bán quá tồn, giá vốn chụp đúng');
let e = await apiLoi('saveXuatBan', { data: { Ngay: '2026-09-02', items: [{ MaHH: 'CAP', SoLuong: 1, DonGia: 3000000, ThueSuat: '8', DonViDaChon: 'nhap', DVT: 'Cuộn' }, { MaHH: 'CAP', SoLuong: 10, DonGia: 10000, ThueSuat: '8', DonViDaChon: 'goc', DVT: 'Mét' }] } });
ok(e && e.startsWith('KHONG_DU_TON_KHO'), '1 Cuộn + 10 Mét trên 2 dòng (310 > 300) bị chặn (bản GAS kiểm từng dòng nên lọt)', e);
const xb = await api('saveXuatBan', { data: { Ngay: '2026-09-02', MaKH: 'KH1', TenKH: 'Trạm Y tế Linh Xuân', MSTKhachHang: '0312345678', items: [
  { MaHH: 'CAP', TenHH: 'Dây cáp mạng Cat5E', SoLuong: 50, DonGia: 10000, ThueSuat: '8', DonViDaChon: 'goc', DVT: 'Mét' },
  { MaHH: 'CHUOT', SoLuong: 2, DonGia: 150000, ThueSuat: '10', DVT: 'Cái' },
  { MaHH: 'DV1', SoLuong: 1, DonGia: 200000, ThueSuat: 'KCT', DVT: 'lần' }] } });
ok(xb.tongTienTruocThue === 1000000 && xb.tongTienThue === 40000 + 30000 && xb.tongTien === 1070000, 'tổng phiếu xuất (dịch vụ KCT thuế 0)', xb);
ok(xb.tonKhoCapNhat.CAP.TonKho === 250 && xb.tonKhoCapNhat.CHUOT.TonKho === 8 && !xb.tonKhoCapNhat.DV1, 'tồn sau bán: cáp 250, chuột 8, dịch vụ không có tồn', xb.tonKhoCapNhat);
ok(xb.phieu.TrangThaiHD === 'ChuaXuat' && xb.phieu.MSTKhachHang === '0312345678', 'trạng thái HĐ + MST giữ số 0 đầu');
const xb2 = await api('saveXuatBan', { data: { Ngay: '2026-09-03', items: [{ MaHH: 'CAP', SoLuong: 0.5, DonGia: 2800000, ThueSuat: '8', DonViDaChon: 'nhap', DVT: 'Cuộn' }] } });
ok(xb2.tonKhoCapNhat.CAP.TonKho === 100, 'bán 0,5 Cuộn = 150 Mét -> còn 100', xb2.tonKhoCapNhat);

console.log('5. Báo cáo: giá vốn dùng số lượng quy đổi (sửa lỗi GAS)');
const bc = await api('getBaoCaoDoanhThu', { tuNgay: '2026-09-01', denNgay: '2026-09-30' });
// GAS cũ: 0,5 Cuộn x 5.000 = 2.500đ (sai). Đúng: 150 Mét x 5.000 = 750.000đ
const giaVonDung = 50 * 5000 + 2 * 100000 + 150 * 5000;
ok(gan(bc.giaVonBanHang, giaVonDung), `giá vốn bán hàng = ${giaVonDung}`, bc.giaVonBanHang);
ok(gan(bc.doanhThuBanHang, 1000000 + 1400000) && gan(bc.doanhThu, 2400000) && bc.soPhieuXuat === 2 && bc.soPhieuNhap === 1, 'doanh thu + số phiếu', bc);
ok(gan(bc.thueDauRa, 70000 + 112000) && gan(bc.thueDauVao, 220000), 'thuế đầu ra/đầu vào', { ra: bc.thueDauRa, vao: bc.thueDauVao });
const topCap = bc.topBanChay.find(t => t.ten === 'Dây cáp mạng Cat5E');
ok(topCap && topCap.soLuong === 200 && topCap.dvt === 'Mét', 'top bán chạy cộng số Mét quy đổi (50 + 150)', bc.topBanChay);
ok(bc.topKhachHang.length === 2 && bc.topKhachHang.some(k => k.ten === 'Khách lẻ'), 'top khách hàng gộp khách lẻ', bc.topKhachHang);

console.log('6. Xoá phiếu -> tồn tính lại từ sổ (bản GAS hoàn 1 thay vì 300 khi phiếu theo Cuộn)');
await api('xoaPhieuXuat', { idPhieu: xb2.idPhieu });
let hh = await api('getHangHoaList');
ok(hh.find(h => h.MaHH === 'CAP').TonKho === 250, 'xoá phiếu bán 0,5 Cuộn -> tồn cáp về 250', hh.find(h => h.MaHH === 'CAP'));
const tl = await api('tinhLaiTonKho', { maHH: 'CAP' });
ok(tl.tonKhoMoi === 250 && tl.giaVonMoi === 5000 && tl.soSuKien === 2, 'nút "Tính lại tồn kho" trả đúng', tl);

console.log('7. Thanh toán + Sổ quỹ trong 1 giao dịch');
const tt = await api('capNhatDaThuKH', { idPhieu: xb.idPhieu, soTien: 500000, phuongThuc: 'ChuyenKhoan' });
ok(tt.banGhiQuy && tt.banGhiQuy.Loai === 'Thu' && tt.banGhiQuy.NhomMuc === 'BanHang' && tt.banGhiQuy.NguonGoc === 'XuatBan:' + xb.idPhieu, 'ghi thu vào Sổ quỹ đúng nguồn gốc', tt);
ok(await apiLoi('capNhatDaThuKH', { idPhieu: 'KHONGCO', soTien: 1 }) === 'KHONG_TIM_THAY_PHIEU', 'phiếu không tồn tại -> lỗi, không ghi quỹ');
await api('capNhatDaTraNCC', { idPhieu: nk.idPhieu, soTien: 2720000, phuongThuc: 'TienMat' });
let soDu = await api('getSoDuQuy');
ok(soDu.chuyenKhoan.thu === 500000 && soDu.tienMat.chi === 2720000 && soDu.tienMat.soDu === 1000000 - 2720000, 'số dư quỹ theo phương thức + số dư đầu kỳ', soDu);

console.log('8. Webhook SePay: khớp mã phiếu, chống ghi trùng');
const wh = { id: 987654, gateway: 'MSB', transactionDate: '2026-09-02 10:00:00', content: `CK THANH TOAN ${xb.idPhieu.toLowerCase()} CAM ON`, transferType: 'in', transferAmount: 570000, referenceCode: 'FT123' };
let w = await goi(wh, '/webhook/sepay?secret=sai');
ok(w.success === false && w.error === 'SAI_MA_BI_MAT_WEBHOOK', 'sai secret bị chặn');
w = await goi(wh, '/webhook/sepay?secret=bi-mat-sepay-abc');
ok(w.success && w.ketQua.khop && w.ketQua.idPhieu === xb.idPhieu, 'khớp đúng phiếu xuất (không phân biệt hoa thường)', w);
w = await goi(wh, '/webhook/sepay?secret=bi-mat-sepay-abc');
ok(w.success && /trước đó/.test(w.ghiChu || ''), 'SePay gửi lại cùng giao dịch -> bỏ qua', w);
w = await fetch(API + '/webhook/sepay', { method: 'POST', body: JSON.stringify(wh), headers: { Authorization: 'Apikey bi-mat-sepay-abc' } }).then(r => r.json());
ok(w.success && /trước đó/.test(w.ghiChu || ''), 'xác thực bằng header Apikey cũng chạy, vẫn chặn trùng', w);
const dsXb = await api('getXuatBanList', { gioiHan: 200 });
ok(dsXb.find(x => x.IDPhieu === xb.idPhieu).DaThu === 1070000, 'đã thu cộng đúng 1 lần = 500.000 + 570.000', dsXb.find(x => x.IDPhieu === xb.idPhieu));
w = await goi({ id: 111, content: 'chuyen tien linh tinh', transferType: 'in', transferAmount: 99000 }, '/?secret=bi-mat-sepay-abc');
ok(w.success && w.ketQua && w.ketQua.khop === false, 'POST vào gốc kiểu GAS cũ vẫn nhận, không khớp -> ghi Thu khác', w);
w = await goi({ id: 112, content: 'x', transferType: 'out', transferAmount: 5000 }, '/webhook/sepay?secret=bi-mat-sepay-abc');
ok(w.success && /tiền ra/.test(w.ghiChu), 'giao dịch tiền ra bị bỏ qua');
soDu = await api('getSoDuQuy');
ok(soDu.chuyenKhoan.thu === 500000 + 570000 + 99000, 'Sổ quỹ chuyển khoản chỉ cộng 1 lần mỗi giao dịch', soDu.chuyenKhoan);

console.log('9. Sửa chữa + Gia công');
const sc = await api('saveSuaChua', { data: { Ngay: '2026-09-04', TenKH: 'Khách lẻ A', SDT: '0908000111', ThietBi: 'Laptop Dell', TienCong: 300000, TienCongThueSuat: '8', BaoHanhNgay: 30, TrangThai: 'TiepNhan',
  items: [{ MaHH: 'CHUOT', SoLuong: 1, DonGia: 150000, ThueSuat: '10', DVT: 'Cái' }] } });
ok(sc.tongTienTruocThue === 450000 && sc.tongTienThue === 24000 + 15000 && sc.tonKhoCapNhat.CHUOT.TonKho === 7 && sc.phieu.SDT === '0908000111', 'phiếu sửa chữa + trừ linh kiện', sc);
await api('capNhatTrangThaiSuaChua', { idPhieu: sc.idPhieu, trangThai: 'DaGiaoTra', ngayHoanThanh: '2026-09-05' });
await api('capNhatHoaDonSuaChua', { idPhieu: sc.idPhieu, soHDDT: '0000456', kyHieuHD: '1C26TPL' });
await api('capNhatDaThuSuaChua', { idPhieu: sc.idPhieu, soTien: 489000, phuongThuc: 'TienMat' });
const dsSc = await api('getSuaChuaList', { gioiHan: 200 });
const scDong = dsSc.find(x => x.IDPhieu === sc.idPhieu);
ok(scDong.TrangThai === 'DaGiaoTra' && scDong.NgayHoanThanh === '2026-09-05' && scDong.SoHDDT === '0000456' && scDong.TrangThaiHD === 'DaXuat' && scDong.DaThu === 489000, 'cập nhật trạng thái/HĐ/thu tiền sửa chữa', scDong);
const gc = await api('saveGiaCong', { data: { Loai: 'ThueNgoaiGiaCong', Ngay: '2026-09-05', TenDoiTac: 'Xưởng in', MoTaCongViec: 'In 500 tờ rơi', SoLuongSanPham: 500, ChiPhiGiaCong: 1000000, ThueSuatGiaCong: '8', items: [] } });
ok(gc.chiPhiSauThue === 1080000 && gc.phieu.DaTra === 0, 'phiếu gia công thuê ngoài');
const gcTT = await api('capNhatThanhToanGiaCong', { idPhieu: gc.idPhieu, loaiTien: 'DaTra', soTien: 1080000, phuongThuc: 'ChuyenKhoan' });
ok(gcTT.banGhiQuy.Loai === 'Chi' && gcTT.banGhiQuy.NhomMuc === 'GiaCong', 'trả tiền gia công -> Chi, nhóm GiaCong');
ok(await apiLoi('capNhatThanhToanGiaCong', { idPhieu: gc.idPhieu, loaiTien: 'TongTien); DROP TABLE x; --', soTien: 1 }) === 'LOAI_TIEN_KHONG_HOP_LE', 'loaiTien lạ bị chặn (không ghép thẳng vào SQL)');
const gc2 = await api('saveGiaCong', { data: { Loai: 'NhanGiaCongChoKhach', Ngay: '2026-09-05', TenDoiTac: 'Khách B', MoTaCongViec: 'Bấm cáp', ChiPhiGiaCong: 200000, ThueSuatGiaCong: '10',
  items: [{ MaHH: 'CAP', SoLuong: 20, DonGia: 0, ThueSuat: '0', DVT: 'Mét' }] } });
ok(gc2.tonKhoCapNhat.CAP.TonKho === 230, 'gia công dùng 20 Mét cáp -> tồn 230');
await api('xoaPhieuGiaCong', { idPhieu: gc2.idPhieu });
hh = await api('getHangHoaList');
ok(hh.find(h => h.MaHH === 'CAP').TonKho === 250, 'xoá phiếu gia công -> tồn về 250');

console.log('10. Công nợ, dashboard, danh sách dang dở');
const cn = await api('getCongNo');
ok(cn.phaiThu.length === 0 && cn.phaiTra.length === 0, 'mọi phiếu đã thanh toán đủ -> không còn công nợ', cn);
const xb3 = await api('saveXuatBan', { data: { Ngay: '2026-08-15', TenKH: '', items: [{ MaHH: 'CHUOT', SoLuong: 1, DonGia: 150000, ThueSuat: '10' }] } });
const cn2 = await api('getCongNo');
ok(cn2.phaiThu.length === 1 && cn2.phaiThu[0].doiTac === 'Khách lẻ' && cn2.phaiThu[0].conNo === 165000, 'công nợ phiếu còn nợ', cn2.phaiThu);
const cntd = await api('getCongNoTheoDoiTac');
ok(cntd.phaiThuTheoKH[0].ten === 'Khách lẻ' && cntd.phaiThuTheoKH[0].tongNo === 165000, 'công nợ gộp theo đối tác');
const db = await api('getDashboard');
ok(typeof db.doanhThuThangNay === 'number' && db.congNoPhaiThu === 165000 && db.soLuongHangHoa === 2 && db.soLuongDichVu === 1 && db.suaChuaDangXuLy === 0, 'dashboard', db);
ok(db.hangSapHet.length === 0, 'không có hàng dưới mức tối thiểu');
const init = await api('getInitData');
ok(init.hangHoaList.length === 3 && init.xuatBanList.length === 2 && init.nhapKhoList.length === 1 && init.suaChuaList.length === 1 && init.giaCongList.length === 1, 'getInitData', Object.fromEntries(Object.entries(init).map(([k, v]) => [k, v.length])));
ok(init.xuatBanList.every(x => x.GhiChu === '' || typeof x.GhiChu === 'string'), 'ô trống trả về chuỗi rỗng như Google Sheet (không phải null)');
const ss = await api('getSoSanhThangHienTai');
ok(ss.thangNay && ss.thangTruoc && typeof ss.phanTramDoanhThu === 'number', 'so sánh tháng');
ok((await api('getBaoCaoTonKho')).length === 2, 'báo cáo tồn kho chỉ hàng hoá');

console.log('11. Hoá đơn hàng loạt + nhập bảng kê');
const bulk = await api('bulkCapNhatHoaDon', { items: [
  { sheetType: 'xuat', idPhieu: xb.idPhieu, soHDDT: '0000789', kyHieuHD: '1C26TPL' }, { sheetType: 'nhap', idPhieu: nk.idPhieu, soHDDT: '0000999' },
  { sheetType: 'xuat', idPhieu: 'KHONGCO', soHDDT: '1' }, { sheetType: 'abc', idPhieu: 'x' }] });
ok(bulk.thanhCong === 2 && bulk.loi.length === 2, 'bulkCapNhatHoaDon: 2 đúng, 2 lỗi báo rõ', bulk);
const xbSau = (await api('getXuatBanList', { gioiHan: 0 })).find(x => x.IDPhieu === xb.idPhieu);
ok(xbSau.SoHDDT === '0000789' && xbSau.TrangThaiHD === 'DaXuat', 'số HĐ giữ số 0 đầu, trạng thái Đã xuất');
const invs = [
  { loai: 'nhap', ngay: '2026-07-01', soHD: '555', kyHieu: 'K1', mst: '301234567', tenDoiTac: 'Công ty Ngôi Sao Lớn', daThanhToanDu: true,
    items: [{ tenHang: 'Ổ cứng SSD 256GB', dvt: 'Cái', soLuong: 5, donGia: 600000, thueSuat: '10', loaiHangHoa: 'HangHoa' }] },
  { loai: 'xuat', ngay: '2026-07-10', soHD: '777', kyHieu: 'C1', mst: '0399999999', tenDoiTac: 'Công ty ABC', daThanhToanDu: false,
    items: [{ tenHang: 'ổ cứng  SSD 256GB', dvt: 'Cái', soLuong: 2, donGia: 900000, thueSuat: '10' }, { tenHang: 'Phí lắp đặt', dvt: '', soLuong: 1, donGia: 100000, thueSuat: '8', loaiHangHoa: 'DichVu' }] },
  { loai: 'xuat', ngay: '2026-07-11', soHD: '778', mst: MST(), tenDoiTac: 'Nhầm', items: [{ tenHang: 'x', soLuong: 1, donGia: 1 }] }
];
function MST() { return '0317838601'; }
const imp = await api('importChiTietBKMVBR', { invoices: invs });
ok(imp.thanhCong === 2 && imp.daTonTai === 0 && imp.loi.length === 1 && /MST_TRUNG/.test(imp.loi[0].error), 'nhập BKMV/BKBR: 2 tạo, 1 bị chặn MST công ty', imp);
hh = await api('getHangHoaList');
const ssd = hh.find(h => h.TenHH === 'Ổ cứng SSD 256GB');
ok(ssd && ssd.TonKho === 3 && ssd.GiaVonTB === 600000, 'SSD: nhập 5 bán 2 (tên khác hoa thường/khoảng trắng vẫn khớp 1 mặt hàng), giá vốn 600k', ssd);
ok(hh.filter(h => chuan(h.TenHH) === 'ổ cứng ssd 256gb').length === 1, 'không tạo trùng mặt hàng');
function chuan(s) { return String(s).trim().toLowerCase().replace(/\s+/g, ' '); }
const ncc = await api('getNhaCungCapList');
ok(ncc.length === 1, 'NCC khớp theo MST dù file mất số 0 đầu (301234567 -> 0301234567)', ncc);
const imp2 = await api('importChiTietBKMVBR', { invoices: invs.slice(0, 2) });
ok(imp2.thanhCong === 0 && imp2.daTonTai === 2, 'nhập lại cùng file -> bỏ qua hoá đơn đã có', imp2);
const xbSSD = (await api('getXuatBanList', { gioiHan: 0 })).find(x => x.SoHDDT === '777');
const ctSSD = await api('getXuatBanDetail', { idPhieu: xbSSD.IDPhieu });
ok(ctSSD.items.find(i => i.TenHH.includes('SSD')).GiaVon === 600000, 'dòng bán SSD chụp giá vốn 600k (nhập trước trong cùng lô)', ctSSD.items);
const ls = await api('importLichSuTuBangKe', { items: [
  { loai: 'xuat', Ngay: '2025-05-20', TenDoiTac: 'Công ty ABC', MST: '0399999999', SoHDDT: '11', KyHieuHD: 'C23', TongTien: 5000000, daThanhToanDu: true },
  { loai: 'nhap', Ngay: '2025-05-21', TenDoiTac: 'NCC Mới', MST: '0388888888', SoHDDT: '12', TongTien: 3000000, daThanhToanDu: false }] });
ok(ls.thanhCong === 2 && ls.loi.length === 0, 'nhập lịch sử bảng kê', ls);
hh = await api('getHangHoaList');
ok(hh.filter(h => h.MaHH === 'HH-LICHSU').length === 1 && hh.find(h => h.MaHH === 'HH-LICHSU').Loai === 'DichVu', 'tạo đúng 1 mặt hàng giữ chỗ HH-LICHSU');

console.log('12. Sổ quỹ tự do, người dùng, phân quyền, xuất Excel');
const tc = await api('saveThuChi', { data: { Loai: 'Chi', Ngay: '2026-09-06', NhomMuc: 'Luong', SoTien: 5000000, PhuongThuc: 'TienMat', MoTa: 'Lương T8' } });
ok(tc.phieu.NhomMuc === 'Luong', 'ghi chi lương');
ok(await apiLoi('xoaThuChi', { idPhieu: tt.banGhiQuy.IDPhieu }) === 'CHI_XOA_DUOC_KHOAN_TU_DO', 'không xoá được khoản tự sinh từ phiếu');
await api('xoaThuChi', { idPhieu: tc.idPhieu });
const lq = await api('getSoQuyList', { tuNgay: '2026-09-01', denNgay: '2026-09-30', loai: 'Thu', phuongThuc: '' });
ok(lq.every(r => r.Loai === 'Thu') && lq.length >= 3, 'lọc sổ quỹ', lq.length);
const nd = await api('saveNguoiDung', { data: { HoTen: 'Kế toán', TenDangNhap: 'ketoan', VaiTro: 'KeToan', MatKhauMoi: 'ketoan123' } });
ok(nd.created, 'tạo người dùng');
ok(await apiLoi('saveNguoiDung', { data: { HoTen: 'X', TenDangNhap: 'ketoan', MatKhauMoi: 'abcdef' } }) === 'TEN_DANG_NHAP_DA_TON_TAI', 'trùng tên đăng nhập bị chặn');
ok((await api('getNguoiDungList')).every(u => !('MatKhauHash' in u)), 'danh sách người dùng không lộ mật khẩu băm');
const adminToken = TOKEN;
lg = await goi({ action: 'login', tenDangNhap: 'ketoan', password: 'ketoan123' });
TOKEN = lg.token;
ok(await apiLoi('xoaPhieuXuat', { idPhieu: xb.idPhieu }) === 'KHONG_CO_QUYEN', 'kế toán không được xoá phiếu');
ok(await apiLoi('exportTable', { table: 'HangHoa' }) === 'KHONG_CO_QUYEN', 'kế toán không được xuất toàn bộ dữ liệu');
ok(await apiLoi('apDungDonViDongCu', { maHH: 'X', dong: [] }) === 'KHONG_CO_QUYEN', 'kế toán không được sửa đơn vị dòng phiếu cũ');
ok(Array.isArray(await api('getCongNo').then(r => r.phaiThu)), 'kế toán xem được công nợ');
await api('doiMatKhau', { matKhauCu: 'ketoan123', matKhauMoi: 'moi12345' });
ok(await apiLoi('doiMatKhau', { matKhauCu: 'sai', matKhauMoi: 'moi12345' }) === 'SAI_MAT_KHAU_CU', 'đổi mật khẩu sai mật khẩu cũ');
TOKEN = adminToken;
await api('khoaMoNguoiDung', { maNV: nd.maNV, trangThai: 'Locked' });
lg = await goi({ action: 'login', tenDangNhap: 'ketoan', password: 'moi12345' });
ok(lg.error === 'TAI_KHOAN_BI_KHOA', 'khoá tài khoản -> không đăng nhập được');
const ex = await api('exportTable', { table: 'XuatBanCT', offset: 0 });
ok(ex.cols.includes('SoLuongQuyDoi') && ex.rows.length >= 4 && ex.conTiep === false, 'xuất bảng ra Excel (có cột quy đổi)', ex.cols);
const exND = await api('exportTable', { table: 'NguoiDung' });
ok(!exND.cols.includes('MatKhauHash'), 'xuất NguoiDung không kèm mật khẩu băm');
ok(await apiLoi('exportTable', { table: 'Phien' }) === 'BANG_KHONG_HOP_LE', 'không xuất được bảng phiên đăng nhập');
const cfg = await api('getCauHinhThanhToan');
ok(cfg.webhookUrl.endsWith('/webhook/sepay?secret=bi-mat-sepay-abc') && cfg.bankBin === '970426', 'URL webhook mới trỏ thẳng Worker', cfg.webhookUrl);
const nk2 = (await api('getNhatKy'));
ok(nk2.length > 5 && !nk2.some(l => /phuonglinh2026|moi12345|"token"/.test(l.ChiTiet)), 'nhật ký không lưu mật khẩu/token', nk2.slice(0, 3));
ok(await apiLoi('actionKhongCo') && (await apiLoi('actionKhongCo')).startsWith('UNKNOWN_ACTION'), 'action lạ báo UNKNOWN_ACTION');

console.log('12b. Đơn vị lớn (Cuộn) nhập từ bảng kê trước khi khai hệ số -> sửa lại dòng cũ');
{
  const invCap = [{ loai: 'nhap', ngay: '2026-08-01', soHD: '4412', mst: '0311111111', tenDoiTac: 'NCC Cáp', daThanhToanDu: false,
    items: [{ tenHang: 'Cáp mạng Cat5E 100m/cuộn', dvt: 'Cuộn', soLuong: 1, donGia: 1000000, thueSuat: '10', loaiHangHoa: 'HangHoa' }] }];
  await api('importChiTietBKMVBR', { invoices: invCap });
  let cap = (await api('getHangHoaList')).find(h => h.TenHH === 'Cáp mạng Cat5E 100m/cuộn');
  ok(cap && cap.TonKho === 1 && cap.GiaVonTB === 1000000, 'tái hiện lỗi cũ: chưa khai hệ số -> kho 1, giá 1tr', cap);
  await api('saveHangHoa', { data: { ...cap, DVT: 'Mét', DVTNhap: 'Cuộn', HeSoQuyDoi: 100 } });
  const ds = await api('getDongTheoDonVi', { maHH: cap.MaHH });
  ok(ds.dong.length === 1 && ds.dong[0].Bang === 'NhapKhoCT' && ds.dong[0].DVT === 'Cuộn' && ds.dong[0].SoLuongQuyDoi === 1, 'liệt kê dòng cũ (có lưu ĐVT hoá đơn)', ds.dong);
  ok(/BANG_KHONG_HOP_LE/.test(await apiLoi('apDungDonViDongCu', { maHH: cap.MaHH, dong: [{ Bang: 'NguoiDung', ID: 1, DonVi: 'nhap' }] })), 'chặn tên bảng lạ');
  const ap = await api('apDungDonViDongCu', { maHH: cap.MaHH, dong: [{ Bang: 'NhapKhoCT', ID: ds.dong[0].ID, DonVi: 'nhap' }] });
  ok(ap.soDongCapNhat === 1 && ap.tonKhoMoi === 100 && ap.giaVonMoi === 10000, 'áp hệ số: 1 Cuộn -> 100 Mét, giá vốn 10.000đ/Mét', ap);
  const ban = await api('saveXuatBan', { data: { Ngay: '2026-08-05', items: [{ MaHH: cap.MaHH, SoLuong: 50, DonGia: 12000, ThueSuat: '10', DonViDaChon: 'goc', DVT: 'Mét' }] } });
  ok(ban.tonKhoCapNhat[cap.MaHH].TonKho === 50, 'bán 50 Mét -> còn 50 Mét', ban.tonKhoCapNhat);
  const ctBan = await api('getXuatBanDetail', { idPhieu: ban.idPhieu });
  ok(ctBan.items[0].GiaVon === 10000 && ctBan.items[0].SoLuongQuyDoi * ctBan.items[0].GiaVon === 500000, 'giá vốn xuất 500.000đ, lãi 100.000đ', ctBan.items);
  ok(/KHONG_DU_TON_KHO/.test(await apiLoi('saveXuatBan', { data: { Ngay: '2026-08-06', items: [{ MaHH: cap.MaHH, SoLuong: 1, DonGia: 1000000, DonViDaChon: 'nhap' }] } })), 'bán 1 Cuộn (=100 Mét) khi còn 50 Mét bị chặn');
  // Hoá đơn mới ghi "cuộn" (khác hoa/thường) -> tự nhân hệ số
  const imp3 = await api('importChiTietBKMVBR', { invoices: [{ ...invCap[0], soHD: '4413', ngay: '2026-08-10', items: [{ ...invCap[0].items[0], dvt: 'cuộn', soLuong: 2, donGia: 1200000 }] }] });
  cap = (await api('getHangHoaList')).find(h => h.MaHH === cap.MaHH);
  ok(imp3.thanhCong === 1 && cap.TonKho === 250 && cap.GiaVonTB === Math.round((50 * 10000 + 200 * 12000) / 250), 'bảng kê mới ghi "cuộn" tự quy ra 200 Mét, bình quân lại giá', cap);
  const imp4 = await api('importChiTietBKMVBR', { invoices: [{ ...invCap[0], soHD: '4414', ngay: '2026-08-11', items: [{ ...invCap[0].items[0], dvt: 'Thùng', soLuong: 1, donGia: 1 }] }] });
  ok(imp4.canhBaoDonVi.length === 1 && imp4.canhBaoDonVi[0].dvtHoaDon === 'Thùng', 'ĐVT lạ trên hoá đơn -> cảnh báo', imp4.canhBaoDonVi);
  // Đổi ngược dòng về đơn vị chính: tồn + giá vốn dòng bán tính lại theo đúng thứ tự thời gian
  const ds2 = await api('getDongTheoDonVi', { maHH: cap.MaHH });
  const back = await api('apDungDonViDongCu', { maHH: cap.MaHH, dong: [{ Bang: 'NhapKhoCT', ID: ds2.dong[0].ID, DonVi: 'goc' }] });
  ok(back.tonKhoMoi === 1 - 50 + 200 + 1, 'đổi ngược về đơn vị chính -> tồn tính lại', back);
  const ctBan2 = await api('getXuatBanDetail', { idPhieu: ban.idPhieu });
  ok(ctBan2.items[0].GiaVon === 1000000, 'giá vốn dòng bán cũ được ghi lại theo sổ', ctBan2.items);
  await api('apDungDonViDongCu', { maHH: cap.MaHH, dong: [{ Bang: 'NhapKhoCT', ID: ds2.dong[0].ID, DonVi: 'nhap' }] });
  const ctBan3 = await api('getXuatBanDetail', { idPhieu: ban.idPhieu });
  ok(ctBan3.items[0].GiaVon === 10000, 'áp lại hệ số -> giá vốn dòng bán về 10.000đ/Mét', ctBan3.items);
}

console.log('13. Đổi loại Hàng hoá -> Dịch vụ tính lại tồn, sửa danh mục');
const sv = await api('saveHangHoa', { data: { MaHH: 'CHUOT', TenHH: 'Chuột Logitech', Loai: 'DichVu', DVT: 'Cái', GiaBan: 150000, TonKhoToiThieu: 1 } });
ok(sv.hangHoa.TonKho === 0, 'đổi sang Dịch vụ -> tồn 0', sv.hangHoa);
const sv2 = await api('saveHangHoa', { data: { MaHH: 'CHUOT', TenHH: 'Chuột Logitech', Loai: 'HangHoa', DVT: 'Cái', GiaBan: 150000, TonKhoToiThieu: 1 } });
ok(sv2.hangHoa.TonKho === 6, 'đổi lại Hàng hoá -> tồn tính lại từ sổ = 10 - 2 - 1 - 1 = 6', sv2.hangHoa);
const moi = await api('saveHangHoa', { data: { TenHH: 'Bàn phím', Loai: 'HangHoa', DVT: 'Cái', GiaBan: 300000 } });
ok(moi.created && moi.hangHoa.TonKho === 0 && moi.hangHoa.MaHH.startsWith('HH'), 'thêm hàng mới');
const cors = await fetch(API + '/', { method: 'POST', body: JSON.stringify({ action: 'pingPhien', token: TOKEN }), headers: { Origin: 'https://trang-la.com' } });
ok(!cors.headers.get('access-control-allow-origin'), 'trang web lạ không được phép gọi API (CORS)');
const cors2 = await fetch(API + '/', { method: 'POST', body: '{}', headers: { Origin: 'http://localhost:8000' } });
ok(cors2.headers.get('access-control-allow-origin') === 'http://localhost:8000', 'đúng tên miền được phép');

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
