// Tạo file .xlsx GIẢ LẬP đúng kiểu Google Sheet của bản GAS xuất ra (ngày là ô ngày thật, MST bị mất số 0 đầu,
// dòng chi tiết mồ côi, tồn kho bị sửa tay, phiếu nhập tự động bị lùi 1 ngày, mật khẩu băm SHA-256 kiểu cũ...)
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire('/tmp/claude-0/-home-claude/2c28eb33-5af1-55c1-9ee2-5fa2e7bcef5e/scratchpad/tools/package.json');
const XLSX = require('xlsx');

const serial = (y, m, d, hh = 0, mi = 0) => (Date.UTC(y, m - 1, d, hh, mi) / 86400000) + 25569; // giờ "đồng hồ tường" của Sheet
const sha = s => createHash('sha256').update(s, 'utf8').digest('base64');
const wb = XLSX.utils.book_new();
function sheet(ten, header, rows, oNgay = []) {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  // đánh dấu các cột ngày là ô ngày (như Google Sheet tự đổi chuỗi yyyy-mm-dd thành ngày)
  oNgay.forEach(c => { const j = header.indexOf(c); rows.forEach((r, i) => { const cell = ws[XLSX.utils.encode_cell({ r: i + 1, c: j })]; if (cell && typeof cell.v === 'number') { cell.t = 'n'; cell.z = 'dd/mm/yyyy hh:mm'; } }); });
  XLSX.utils.book_append_sheet(wb, ws, ten);
}
sheet('Config', ['Key', 'Value'], [
  ['CompanyName', 'CÔNG TY TNHH DỊCH VỤ CÔNG NGHỆ PHƯƠNG LINH'], ['MST', 317838601], ['ApiToken', 'abc'],
  ['SoDuTienMatDauKy', 2000000], ['SoDuChuyenKhoanDauKy', 50000000], ['SoDuTheDauKy', 0],
  ['BankBin', 970426], ['BankAccountNumber', '0123456789'], ['BankAccountName', 'CONG TY PHUONG LINH'], ['SePayWebhookSecret', 'secret-cu-cua-anh']]);
sheet('NguoiDung', ['MaNV', 'HoTen', 'TenDangNhap', 'MatKhauHash', 'VaiTro', 'TrangThai', 'NgayTao'], [
  ['NV001', 'Vũ Mạnh Hưng', 'admin', sha('matkhau-cu-2026'), 'Admin', 'Active', serial(2025, 5, 18)],
  ['NV2508101234567891', 'Kỹ thuật A', 'kythuat', sha('kt123456'), 'KyThuat', 'Locked', serial(2025, 8, 10)]], ['NgayTao']);
sheet('Sessions', ['Token', 'MaNV', 'HoTen', 'TenDangNhap', 'VaiTro', 'CreatedAt'], [['tok-cu', 'NV001', 'x', 'admin', 'Admin', serial(2026, 9, 1)]]);
sheet('HangHoa', ['MaHH', 'TenHH', 'Loai', 'DVT', 'GiaVonTB', 'GiaBan', 'TonKho', 'TonKhoToiThieu', 'GhiChu', 'NgayTao', 'DVTNhap', 'HeSoQuyDoi'], [
  ['HH2608010211330024', 'Dây cáp mạng Golden Link Platinum UTP Cat5E TAIWAN 100m/cuộn (Cam) - TW1101-100', 'HangHoa', 'Mét', 508333, 1000000, 1, 0, 'Tạo tự động khi nhập chi tiết bảng kê BKMV/BKBR', serial(2026, 8, 1), 'Cuộn', 300],
  ['HH2608102243525271', 'DÂY ĐEO THẺ POLYESTER 1.5CM IN LOGO', 'HangHoa', 'Dây', 16700, 20000, 118, 10, '', serial(2026, 8, 10), '', ''],
  ['HH-CHUOT', 'Chuột Logitech M331', 'HangHoa', 'Cái', 180000, 250000, 9, 2, 'Kiểm kê sửa tay', serial(2026, 1, 5), '', 0],
  ['HH-LICHSU', 'Hàng hoá/dịch vụ theo hoá đơn (dữ liệu lịch sử, chưa tách chi tiết)', 'DichVu', 'lần', 0, 0, 0, 0, '', serial(2025, 1, 1)],
  ['HH-DV', 'Phí cài đặt phần mềm', 'DichVu', 'lần', 0, 300000, '', '', '', serial(2025, 1, 1), '', '']], ['NgayTao']);
sheet('NhaCungCap', ['MaNCC', 'TenNCC', 'MST', 'DiaChi', 'SDT', 'Email', 'GhiChu'], [
  ['NCC1', 'CÔNG TY TRÁCH NHIỆM HỮU HẠN TIN HỌC NGÔI SAO LỚN', 301234567, 'Q.1', 903123456, '', ''],
  ['NCC2', 'CÔNG TY TNHH NHÀ SÁCH THUỶ TIÊN', '0312222333', '', '', '', '']]);
sheet('KhachHang', ['MaKH', 'TenKH', 'MST', 'DiaChi', 'SDT', 'Email', 'GhiChu'], [
  ['KH1', 'CÔNG TY CỔ PHẦN DỊCH VỤ MẠNG VÀ VIỄN THÔNG', 312345678, '', '0909123456', '', ''],
  ['KH2', 'TRẠM Y TẾ PHƯỜNG THỦ ĐỨC', '0319999999', '', 2838123456, '', '']]);
const TS = (d, h = 9) => serial(2026, 8, d, h, 30);
sheet('NhapKho', ['IDPhieu', 'Ngay', 'MaNCC', 'TenNCC', 'SoHDMuaVao', 'GhiChu', 'TongTienTruocThue', 'TongTienThue', 'TongTien', 'DaTra', 'NguoiTao', 'Timestamp'], [
  ['NK1', serial(2026, 7, 16), 'NCC1', 'CÔNG TY TRÁCH NHIỆM HỮU HẠN TIN HỌC NGÔI SAO LỚN', '38542', 'Nhập chi tiết từ bảng kê BKMV', 1952777.77, 156222, 2108999.77, 2108999.77, 'admin', TS(1)],
  ['NK2', serial(2026, 8, 9), 'NCC1', 'CÔNG TY TRÁCH NHIỆM HỮU HẠN TIN HỌC NGÔI SAO LỚN', '01794', '', 1525000, 122000, 1647000, 1000000, 'admin', TS(9)],
  ['NK3', serial(2026, 8, 12), 'NCC2', 'CÔNG TY TNHH NHÀ SÁCH THUỶ TIÊN', 182, '', 2004000, 0, 2004000, 2004000, 'admin', TS(12)]], ['Ngay', 'Timestamp']);
sheet('NhapKhoCT', ['IDPhieu', 'MaHH', 'TenHH', 'SoLuong', 'DonGia', 'ThanhTien', 'ThueSuat', 'TienThue', 'ThanhTienSauThue', 'DVT'], [
  ['NK1', 'HH-CHUOT', 'Chuột Logitech M331', 1, 212037.03, 212037.03, 8, 16963, 229000.03, 'Cái'],
  ['NK1', 'HH-DV', 'Phí cài đặt phần mềm', 1, 1740740.74, 1740740.74, 8, 139259, 1879999.74, 'lần'],
  ['NK2', 'HH2608010211330024', 'Dây cáp mạng Golden Link Platinum UTP Cat5E TAIWAN 100m/cuộn (Cam) - TW1101-100', 1, 1525000, 1525000, 8, 122000, 1647000, 'Cuộn'],
  ['NK3', 'HH2608102243525271', 'DÂY ĐEO THẺ POLYESTER 1.5CM IN LOGO', 120, 16700, 2004000, 'KCT', 0, 2004000, 'Dây'],
  ['NK3', 'HH-CHUOT', 'Chuột Logitech M331', 10, 180000, 1800000, 0, 0, 1800000, 'Cái'],
  ['NK-DA-XOA', 'HH-CHUOT', 'Chuột Logitech M331', 5, 180000, 900000, 0, 0, 900000, 'Cái']]);  // mồ côi
sheet('XuatBan', ['IDPhieu', 'Ngay', 'MaKH', 'TenKH', 'MSTKhachHang', 'SoHDDT', 'KyHieuHD', 'GhiChu', 'TongTienTruocThue', 'TongTienThue', 'TongTien', 'DaThu', 'TrangThaiHD', 'NguoiTao', 'Timestamp'], [
  ['XB1', serial(2026, 7, 5), 'KH1', 'CÔNG TY CỔ PHẦN DỊCH VỤ MẠNG VÀ VIỄN THÔNG', 312345678, 6, '1C26TPL', 'Nhập chi tiết từ bảng kê BKBR', 152000000, 12160000, 164160000, 164160000, 'DaXuat', 'admin', TS(2)],
  ['XB2', serial(2026, 8, 13), 'KH2', 'TRẠM Y TẾ PHƯỜNG THỦ ĐỨC', '0319999999', '', '', '', 3000000, 240000, 3240000, 1000000, 'ChuaXuat', 'admin', TS(13, 21)],
  ['XB3', serial(2026, 8, 14), '', '', '', '', '', '', '', '', 500000, 0, '', 'admin', '']], ['Ngay', 'Timestamp']);
sheet('XuatBanCT', ['IDPhieu', 'MaHH', 'TenHH', 'SoLuong', 'DonGia', 'ThanhTien', 'ThueSuat', 'TienThue', 'ThanhTienSauThue', 'GiaVon', 'DVT'], [
  ['XB1', 'HH-LICHSU', 'Hàng hoá/dịch vụ theo hoá đơn (dữ liệu lịch sử)', 1, 152000000, 152000000, 8, 12160000, 164160000, 0, ''],
  ['XB2', 'HH2608010211330024', 'Dây cáp mạng Golden Link Platinum UTP Cat5E TAIWAN 100m/cuộn (Cam) - TW1101-100', 299, 10000, 2990000, 8, 239200, 3229200, 5083, 'Mét'],
  ['XB2', 'HH-CHUOT', 'Chuột Logitech M331', 1, 10000, 10000, 8, 800, 10800, 180000, 'Cái'],
  ['XB3', 'HH-CHUOT', 'Chuột Logitech M331', 2, 250000, 500000, 'KCT', 0, 500000, 180000, 'Cái']]);
sheet('SuaChua', ['IDPhieu', 'Ngay', 'MaKH', 'TenKH', 'SDT', 'ThietBi', 'TinhTrangTiepNhan', 'PhuKienKemTheo', 'NguoiPhuTrach', 'TrangThai', 'NgayHenTra', 'NgayHoanThanh',
  'TienCong', 'TienCongThueSuat', 'TienCongThue', 'TongTienLinhKien', 'TongTienLinhKienThue', 'TongTienTruocThue', 'TongTienThue', 'TongTien', 'DaThu', 'SoHDDT', 'KyHieuHD', 'TrangThaiHD', 'BaoHanhNgay', 'GhiChu', 'NguoiTao', 'Timestamp'], [
  ['SC1', serial(2026, 8, 20), '', 'Anh Nam', 908111222, 'Laptop Dell', 'Không lên nguồn', 'Sạc', 'Kỹ thuật A', 'DangSua', serial(2026, 8, 25), '', 300000, 8, 24000, 250000, 20000, 550000, 44000, 594000, 0, '', '', 'ChuaXuat', 30, '', 'admin', TS(20)]],
  ['Ngay', 'NgayHenTra', 'Timestamp']);
sheet('SuaChuaCT', ['IDPhieu', 'MaHH', 'TenHH', 'SoLuong', 'DonGia', 'ThanhTien', 'ThueSuat', 'TienThue', 'ThanhTienSauThue', 'DVT'], [
  ['SC1', 'HH-CHUOT', 'Chuột Logitech M331', 1, 250000, 250000, 8, 20000, 270000, 'Cái']]);
sheet('GiaCong', ['IDPhieu', 'Loai', 'Ngay', 'MaDoiTac', 'TenDoiTac', 'MoTaCongViec', 'SoLuongSanPham', 'DonViTinh', 'ChiPhiGiaCongTruocThue', 'ThueSuatGiaCong', 'TienThueGiaCong', 'ChiPhiGiaCong',
  'TrangThai', 'NgayHenTra', 'NgayHoanThanh', 'DaThu', 'DaTra', 'SoHDDT', 'KyHieuHD', 'TrangThaiHD', 'GhiChu', 'NguoiTao', 'Timestamp'], [
  ['GC1', 'ThueNgoaiGiaCong', serial(2026, 8, 21), 'NCC2', 'Xưởng in', 'In 500 thẻ', 500, 'cái', 1000000, 8, 80000, 1080000, 'HoanThanh', '', serial(2026, 8, 23), 0, 500000, '', '', 'ChuaXuat', '', 'admin', TS(21)],
  ['GC2', 'NhanGiaCongChoKhach', serial(2026, 8, 22), 'KH1', 'CÔNG TY CỔ PHẦN DỊCH VỤ MẠNG VÀ VIỄN THÔNG', 'Bấm đầu cáp', 100, 'đầu', 200000, 10, 20000, 220000, 'DangGiaCong', '', '', 100000, 0, '', '', 'ChuaXuat', '', 'admin', TS(22)]],
  ['Ngay', 'NgayHoanThanh', 'Timestamp']);
sheet('GiaCongCT', ['IDPhieu', 'MaHH', 'TenHH', 'SoLuong', 'DonGia', 'ThanhTien', 'ThueSuat', 'TienThue', 'ThanhTienSauThue', 'DVT'], []);
sheet('SoQuy', ['IDPhieu', 'Ngay', 'Loai', 'NhomMuc', 'SoTien', 'PhuongThuc', 'NguonGoc', 'MoTa', 'NguoiTao', 'Timestamp'], [
  ['QUY1', serial(2026, 8, 13), 'Thu', 'BanHang', 1000000, 'ChuyenKhoan', 'XuatBan:XB2', '', 'admin', TS(13)],
  ['QUY2', serial(2026, 8, 9), 'Chi', 'MuaHang', 1000000, 'TienMat', 'NhapKho:NK2', '', 'admin', TS(9)],
  ['QUY3', serial(2026, 8, 30), 'Chi', 'Luong', 8000000, 'ChuyenKhoan', 'TuDo', 'Lương T8', 'admin', TS(30)]], ['Ngay', 'Timestamp']);
sheet('NhatKyHoatDong', ['Timestamp', 'NguoiDung', 'HanhDong', 'ChiTiet'], [[TS(1), 'admin', 'login', ''], [TS(9), 'admin', 'saveNhapKho', '{}']], ['Timestamp']);
const ra = process.argv[2] || '/tmp/claude-0/-home-claude/2c28eb33-5af1-55c1-9ee2-5fa2e7bcef5e/scratchpad/QLBanHangPhuongLinh.xlsx';
XLSX.writeFile(wb, ra);
console.log('Đã tạo', ra);
