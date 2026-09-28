/**
 * ============================================================
 * PHẦN MỀM QUẢN LÝ BÁN HÀNG - SỬA CHỮA - GIA CÔNG (bản Cloudflare)
 * Công ty TNHH Dịch vụ Công nghệ Phương Linh - MST: 0317838601
 * Stack: Cloudflare Workers + D1 (SQLite). Giao diện: GitHub Pages (index.html).
 * Thay thế hoàn toàn Code.gs + Google Sheet (bản GAS cũ đổi tên thành indexGAS.html).
 * ============================================================
 *
 * NGUYÊN TẮC THIẾT KẾ (đọc trước khi sửa):
 * 1. TÊN BẢNG / TÊN CỘT GIỮ Y HỆT TÊN SHEET / TÊN CỘT CỦA BẢN GAS (HangHoa, XuatBan, TongTien, DaThu...)
 *    -> giao diện nhận đúng dữ liệu như cũ, công cụ chuyển dữ liệu khớp 1-1, xuất Excel ra đúng tên sheet cũ.
 * 2. TÊN ACTION GIỮ NGUYÊN 61 action của Code.gs, dạng trả về giữ nguyên { success, data, error }.
 * 3. MỖI LẦN LƯU/XOÁ PHIẾU = 1 GIAO DỊCH (env.DB.batch): hoặc ghi đủ đầu phiếu + chi tiết + tồn kho,
 *    hoặc không ghi gì. Bản GAS ghi 3-4 chỗ rời rạc, lỗi giữa chừng là lệch kho/quỹ.
 * 4. TỒN KHO KHÔNG BAO GIỜ CỘNG/TRỪ TAY. Mỗi dòng chi tiết phiếu lưu sẵn HeSoQuyDoi + SoLuongQuyDoi
 *    (số lượng đã quy về đơn vị chính, VD 1 Cuộn -> 300 Mét) NGAY LÚC GHI. Cột HangHoa.TonKho chỉ là
 *    bản tính sẵn, luôn được TÍNH LẠI từ sổ (tổng SoLuongQuyDoi của mọi phiếu) cho đúng các mặt hàng
 *    bị ảnh hưởng, trong cùng giao dịch. -> hết hẳn loại lỗi "quên quy đổi" (tinhLaiTonKho, xoá phiếu
 *    hoàn kho sai, giá vốn báo cáo sai khi bán theo Cuộn) của bản GAS.
 * 5. GIAO DỊCH SEPAY LƯU MÃ GIAO DỊCH VỚI KHOÁ CHÍNH (UNIQUE) -> SePay gửi lại lần 2 bị chặn, không ghi thu 2 lần.
 * 6. GÓI FREE: tối đa 50 lệnh D1/request, 10ms CPU/request, 100 tham số/câu SQL. Mọi hàm ở đây giữ số
 *    lệnh ít (dùng json_each(?1) thay vì IN (?,?,?...), gộp nhiều dòng/câu INSERT), không tải cả bảng
 *    về lặp trong JS khi SQL làm được.
 */

const MST_CONG_TY = '0317838601';
const PBKDF2_VONG = 50000; // 100.000 vòng mất ~15ms CPU, vượt 10ms của gói Free -> dùng 50.000 (~7ms). Số vòng lưu trong chuỗi băm, nâng sau được.
const SO_LAN_SAI_TOI_DA = 5;
const PHUT_KHOA_KHI_SAI = 10;

const ROLES = { ADMIN: 'Admin', BANHANG: 'BanHang', KYTHUAT: 'KyThuat', KETOAN: 'KeToan' };

const ADMIN_ONLY_ACTIONS = new Set([
  'getNguoiDungList', 'saveNguoiDung', 'deleteNguoiDung', 'khoaMoNguoiDung',
  'deleteHangHoa', 'deleteNhaCungCap', 'deleteKhachHang',
  'xoaPhieuNhap', 'xoaPhieuXuat', 'xoaPhieuSuaChua', 'xoaPhieuGiaCong',
  'suaPhieuXuat', 'suaPhieuSuaChua', 'suaPhieuGiaCong',
  'xoaThuChi', 'capNhatSoDuDauKy', 'getCauHinhThanhToan', 'capNhatCauHinhThanhToan',
  'exportTable', 'apDungDonViDongCu'
]);

const WRITE_ACTIONS = new Set([
  'saveHangHoa', 'deleteHangHoa', 'tinhLaiTonKho', 'apDungDonViDongCu',
  'saveNhaCungCap', 'deleteNhaCungCap',
  'saveKhachHang', 'deleteKhachHang',
  'saveNhapKho', 'capNhatDaTraNCC', 'xoaPhieuNhap',
  'saveXuatBan', 'suaPhieuXuat', 'capNhatHoaDonXuatBan', 'capNhatDaThuKH', 'xoaPhieuXuat',
  'saveSuaChua', 'suaPhieuSuaChua', 'capNhatTrangThaiSuaChua', 'capNhatHoaDonSuaChua', 'capNhatDaThuSuaChua', 'xoaPhieuSuaChua',
  'saveGiaCong', 'suaPhieuGiaCong', 'capNhatTrangThaiGiaCong', 'capNhatHoaDonGiaCong', 'capNhatThanhToanGiaCong', 'xoaPhieuGiaCong',
  'saveNguoiDung', 'deleteNguoiDung', 'khoaMoNguoiDung',
  'bulkCapNhatHoaDon', 'importLichSuTuBangKe', 'importChiTietBKMVBR',
  'saveThuChi', 'xoaThuChi', 'capNhatSoDuDauKy', 'capNhatCauHinhThanhToan'
]);

// ================== CẤU TRÚC DỮ LIỆU (NGUỒN DUY NHẤT — schema.sql sinh ra từ đây) ==================
const T = 'TEXT', R = 'REAL';
const CT_COLS = { IDPhieu: T, MaHH: T, TenHH: T, SoLuong: R, DonGia: R, ThanhTien: R, ThueSuat: T, TienThue: R, ThanhTienSauThue: R, DVT: T, HeSoQuyDoi: R, SoLuongQuyDoi: R };
const SCHEMA = {
  Config: { pk: 'Key', cols: { Key: T, Value: T } },
  NguoiDung: { pk: 'MaNV', cols: { MaNV: T, HoTen: T, TenDangNhap: T, MatKhauHash: T, VaiTro: T, TrangThai: T, NgayTao: T, SoLanSai: R, KhoaDenLuc: T } },
  Phien: { pk: 'TokenHash', cols: { TokenHash: T, MaNV: T, CreatedAt: T } },
  HangHoa: { pk: 'MaHH', cols: { MaHH: T, TenHH: T, Loai: T, DVT: T, GiaVonTB: R, GiaBan: R, TonKho: R, TonKhoToiThieu: R, GhiChu: T, NgayTao: T, DVTNhap: T, HeSoQuyDoi: R } },
  NhaCungCap: { pk: 'MaNCC', cols: { MaNCC: T, TenNCC: T, MST: T, DiaChi: T, SDT: T, Email: T, GhiChu: T } },
  KhachHang: { pk: 'MaKH', cols: { MaKH: T, TenKH: T, MST: T, DiaChi: T, SDT: T, Email: T, GhiChu: T } },
  NhapKho: { pk: 'IDPhieu', cols: { IDPhieu: T, Ngay: T, MaNCC: T, TenNCC: T, SoHDMuaVao: T, GhiChu: T, TongTienTruocThue: R, TongTienThue: R, TongTien: R, DaTra: R, NguoiTao: T, Timestamp: T } },
  NhapKhoCT: { auto: 'ID', cols: CT_COLS },
  XuatBan: { pk: 'IDPhieu', cols: { IDPhieu: T, Ngay: T, MaKH: T, TenKH: T, MSTKhachHang: T, SoHDDT: T, KyHieuHD: T, GhiChu: T, TongTienTruocThue: R, TongTienThue: R, TongTien: R, DaThu: R, TrangThaiHD: T, NguoiTao: T, Timestamp: T } },
  XuatBanCT: { auto: 'ID', cols: { ...CT_COLS, GiaVon: R } },
  SuaChua: {
    pk: 'IDPhieu', cols: {
      IDPhieu: T, Ngay: T, MaKH: T, TenKH: T, SDT: T, ThietBi: T, TinhTrangTiepNhan: T, PhuKienKemTheo: T,
      NguoiPhuTrach: T, TrangThai: T, NgayHenTra: T, NgayHoanThanh: T,
      TienCong: R, TienCongThueSuat: T, TienCongThue: R, TongTienLinhKien: R, TongTienLinhKienThue: R,
      TongTienTruocThue: R, TongTienThue: R, TongTien: R, DaThu: R,
      SoHDDT: T, KyHieuHD: T, TrangThaiHD: T, BaoHanhNgay: R, GhiChu: T, NguoiTao: T, Timestamp: T
    }
  },
  SuaChuaCT: { auto: 'ID', cols: CT_COLS },
  GiaCong: {
    pk: 'IDPhieu', cols: {
      IDPhieu: T, Loai: T, Ngay: T, MaDoiTac: T, TenDoiTac: T, MoTaCongViec: T, SoLuongSanPham: R, DonViTinh: T,
      ChiPhiGiaCongTruocThue: R, ThueSuatGiaCong: T, TienThueGiaCong: R, ChiPhiGiaCong: R,
      TrangThai: T, NgayHenTra: T, NgayHoanThanh: T, DaThu: R, DaTra: R,
      SoHDDT: T, KyHieuHD: T, TrangThaiHD: T, GhiChu: T, NguoiTao: T, Timestamp: T
    }
  },
  GiaCongCT: { auto: 'ID', cols: CT_COLS },
  SoQuy: { pk: 'IDPhieu', cols: { IDPhieu: T, Ngay: T, Loai: T, NhomMuc: T, SoTien: R, PhuongThuc: T, NguonGoc: T, MoTa: T, NguoiTao: T, Timestamp: T } },
  NhatKyHoatDong: { auto: 'ID', cols: { Timestamp: T, NguoiDung: T, HanhDong: T, ChiTiet: T } },
  // Mới: dòng điều chỉnh tồn (hiện chỉ sinh khi chuyển dữ liệu, để giữ đúng số tồn thực tế trên Sheet cũ).
  // Được cộng vào sổ kho như mọi phiếu khác. DonGiaQuyDoi (nếu có) là giá vốn/đơn vị chính của phần tăng thêm.
  DieuChinhKho: { auto: 'ID', cols: { MaHH: T, Ngay: T, SoLuongQuyDoi: R, DonGiaQuyDoi: R, LyDo: T, NguoiTao: T, Timestamp: T } },
  // Mới: mỗi giao dịch SePay đã xử lý 1 dòng, MaGiaoDich là khoá chính -> chặn xử lý trùng.
  SePayGiaoDich: { pk: 'MaGiaoDich', cols: { MaGiaoDich: T, ThoiGian: T, SoTien: R, NoiDung: T, IDPhieu: T, KetQua: T, Timestamp: T } }
};
const INDEXES = [
  ['ix_nguoidung_tendangnhap', 'NguoiDung', ['TenDangNhap'], true],
  ['ix_phien_manv', 'Phien', ['MaNV']],
  ['ix_hanghoa_loai', 'HangHoa', ['Loai']],
  ['ix_ncc_mst', 'NhaCungCap', ['MST']],
  ['ix_kh_mst', 'KhachHang', ['MST']],
  ['ix_nhapkho_ngay', 'NhapKho', ['Ngay']], ['ix_nhapkho_ts', 'NhapKho', ['Timestamp']], ['ix_nhapkho_sohd', 'NhapKho', ['SoHDMuaVao']],
  ['ix_nhapkhoct_phieu', 'NhapKhoCT', ['IDPhieu']], ['ix_nhapkhoct_mahh', 'NhapKhoCT', ['MaHH']],
  ['ix_xuatban_ngay', 'XuatBan', ['Ngay']], ['ix_xuatban_ts', 'XuatBan', ['Timestamp']], ['ix_xuatban_sohd', 'XuatBan', ['SoHDDT']],
  ['ix_xuatbanct_phieu', 'XuatBanCT', ['IDPhieu']], ['ix_xuatbanct_mahh', 'XuatBanCT', ['MaHH']],
  ['ix_suachua_ngay', 'SuaChua', ['Ngay']], ['ix_suachua_ts', 'SuaChua', ['Timestamp']],
  ['ix_suachuact_phieu', 'SuaChuaCT', ['IDPhieu']], ['ix_suachuact_mahh', 'SuaChuaCT', ['MaHH']],
  ['ix_giacong_ngay', 'GiaCong', ['Ngay']], ['ix_giacong_ts', 'GiaCong', ['Timestamp']],
  ['ix_giacongct_phieu', 'GiaCongCT', ['IDPhieu']], ['ix_giacongct_mahh', 'GiaCongCT', ['MaHH']],
  ['ix_soquy_ngay', 'SoQuy', ['Ngay']], ['ix_soquy_nguongoc', 'SoQuy', ['NguonGoc']], ['ix_soquy_ts', 'SoQuy', ['Timestamp']],
  ['ix_nhatky_ts', 'NhatKyHoatDong', ['Timestamp']],
  ['ix_dieuchinh_mahh', 'DieuChinhKho', ['MaHH']]
];

function schemaStatements() {
  const out = [];
  for (const [ten, def] of Object.entries(SCHEMA)) {
    const cot = [];
    if (def.auto) cot.push(`"${def.auto}" INTEGER PRIMARY KEY`);
    for (const [c, kieu] of Object.entries(def.cols)) cot.push(`"${c}" ${kieu}${def.pk === c ? ' PRIMARY KEY' : ''}`);
    out.push(`CREATE TABLE IF NOT EXISTS "${ten}" (${cot.join(', ')})`);
  }
  for (const [ten, bang, cols, unique] of INDEXES) {
    out.push(`CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${ten}" ON "${bang}" (${cols.map(c => `"${c}"`).join(', ')})`);
  }
  return out;
}

const CT_TABLE = { NhapKho: 'NhapKhoCT', XuatBan: 'XuatBanCT', SuaChua: 'SuaChuaCT', GiaCong: 'GiaCongCT' };
const colsOf = bang => Object.keys(SCHEMA[bang].cols);

// ================== TIỆN ÍCH ==================
class LoiNghiepVu extends Error {}
const loi = msg => new LoiNghiepVu(msg);

function vnParts(d = new Date()) {
  const t = new Date(d.getTime() + 7 * 3600 * 1000);
  return { y: t.getUTCFullYear(), M: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), m: t.getUTCMinutes(), s: t.getUTCSeconds(), ms: t.getUTCMilliseconds() };
}
const p2 = n => String(n).padStart(2, '0');
function homNayVN() { const p = vnParts(); return `${p.y}-${p2(p.M)}-${p2(p.d)}`; }
function thangVN(lech = 0) { const p = vnParts(); let y = p.y, M = p.M + lech; while (M < 1) { M += 12; y--; } while (M > 12) { M -= 12; y++; } return `${y}-${p2(M)}`; }
const bayGio = () => new Date().toISOString();

let _idCounter = 0;
function taoId(prefix) {
  _idCounter++;
  const p = vnParts();
  const stamp = `${String(p.y).slice(2)}${p2(p.M)}${p2(p.d)}${p2(p.h)}${p2(p.m)}${p2(p.s)}${String(p.ms).padStart(3, '0')}`;
  return `${prefix}${stamp}${_idCounter}`;
}

// Thuế suất hợp lệ: '0', '5', '8', '10', 'KCT' — giống hệt tinhTienThue() của Code.gs
function tinhTienThue(soTienTruocThue, thueSuat) {
  if (!thueSuat || thueSuat === 'KCT') return 0;
  const rate = parseFloat(String(thueSuat).replace('%', '').trim());
  if (isNaN(rate)) return 0;
  return Math.round((Number(soTienTruocThue) || 0) * rate / 100);
}

function chuanHoaMST(mst) {
  let s = String(mst || '').replace(/\D/g, '');
  if (s.length === 9) s = '0' + s;
  if (s.length === 12) s = '0' + s;
  return s;
}
// Số hoá đơn dùng để SO TRÙNG (không đổi giá trị lưu): bảng kê Excel mới ghi "00001794", XML/nhập tay ghi "1794"
// -> trước đây coi là 2 hoá đơn khác nhau nên nhập trùng (tồn kho x2). Bỏ khoảng trắng + số 0 đầu, không phân biệt hoa/thường.
const chuanHoaSoHD = so => String(so || '').replace(/\s+/g, '').toUpperCase().replace(/^0+(?=.)/, '');
// Số HĐ đánh lại từ 1 mỗi năm (theo ký hiệu) -> khoá trùng gồm cả NĂM, tránh bỏ nhầm hoá đơn năm sau cùng số.
const khoaHoaDon = (so, mst, ngay) => chuanHoaSoHD(so) + '|' + chuanHoaMST(mst) + '|' + String(ngay || '').slice(0, 4);
const SQL_SO_HD_CHUAN = cot => `ltrim(upper(replace(replace(replace(${cot},' ',''),char(9),''),char(10),'')),'0')`;
const chuanHoaTen = ten => String(ten || '').trim().toLowerCase().replace(/\s+/g, ' ');
const tong = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const duyNhat = arr => [...new Set(arr.filter(Boolean))];

// Giá trị ghi xuống D1 theo đúng kiểu cột: cột TEXT luôn ghi chuỗi (tránh 8 -> '8.0', mất số 0 đầu MST/SĐT),
// cột REAL luôn ghi số hoặc NULL.
function giaTriCot(bang, cot, v) {
  const kieu = SCHEMA[bang].cols[cot];
  if (kieu === R) {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (v === null || v === undefined) return null;
  return typeof v === 'string' ? v : String(v);
}

// Dòng đọc từ D1: NULL -> '' (giống ô trống của Google Sheet, để giao diện cũ hiển thị y như trước).
function chuanHoaDong(row) {
  const o = {};
  for (const k in row) o[k] = row[k] === null ? '' : row[k];
  return o;
}

function lenhThem(db, bang, rows, cols, cheDo = 'INSERT') {
  cols = cols || colsOf(bang);
  const soDongMoiLenh = Math.max(1, Math.floor(100 / cols.length));
  const lenh = [];
  for (let i = 0; i < rows.length; i += soDongMoiLenh) {
    const nhom = rows.slice(i, i + soDongMoiLenh);
    const params = [];
    nhom.forEach(r => cols.forEach(c => params.push(giaTriCot(bang, c, r[c]))));
    const values = nhom.map(() => '(' + cols.map(() => '?').join(',') + ')').join(',');
    lenh.push(db.prepare(`${cheDo} INTO "${bang}" (${cols.map(c => `"${c}"`).join(',')}) VALUES ${values}`).bind(...params));
  }
  return lenh;
}

async function all(env, sql, ...params) { const r = await env.DB.prepare(sql).bind(...params).all(); return r.results.map(chuanHoaDong); }
async function allRaw(env, sql, ...params) { const r = await env.DB.prepare(sql).bind(...params).all(); return r.results; }
async function first(env, sql, ...params) { return env.DB.prepare(sql).bind(...params).first(); }
async function run(env, sql, ...params) { return env.DB.prepare(sql).bind(...params).run(); }

async function docConfig(env) {
  const rows = await allRaw(env, `SELECT "Key", "Value" FROM "Config"`);
  const m = {}; rows.forEach(r => { m[r.Key] = r.Value; }); return m;
}
const lenhGhiConfig = (env, key, value) => env.DB.prepare(`INSERT INTO "Config" ("Key","Value") VALUES (?1, ?2) ON CONFLICT("Key") DO UPDATE SET "Value" = excluded."Value"`).bind(key, value == null ? '' : String(value));

function lenhNhatKy(env, nguoiDung, hanhDong, chiTiet) {
  return env.DB.prepare(`INSERT INTO "NhatKyHoatDong" ("Timestamp","NguoiDung","HanhDong","ChiTiet") VALUES (?1,?2,?3,?4)`)
    .bind(bayGio(), nguoiDung || '', hanhDong || '', String(chiTiet || '').substring(0, 300));
}

// ================== MẬT KHẨU & PHIÊN ==================
const te = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function sha256Hex(s) { const h = await crypto.subtle.digest('SHA-256', te.encode(s)); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function sha256B64(s) { return b64(await crypto.subtle.digest('SHA-256', te.encode(s))); }
function soSanhDeu(a, b) { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }

async function pbkdf2(pw, salt, vong) {
  const key = await crypto.subtle.importKey('raw', te.encode(pw || ''), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: vong }, key, 256));
}
async function bamMatKhau(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_VONG}$${b64(salt)}$${await pbkdf2(pw, salt, PBKDF2_VONG)}`;
}
// Trả về { dung, canNangCap }. Mật khẩu chuyển từ bản GAS (SHA-256 không salt, dạng base64) vẫn đăng nhập
// được như cũ, và được TỰ ĐỘNG băm lại bằng PBKDF2 ngay lần đăng nhập đúng đầu tiên.
async function kiemMatKhau(pw, luu) {
  luu = String(luu || '');
  if (luu.startsWith('pbkdf2$')) {
    const [, vong, salt, hash] = luu.split('$');
    const tinh = await pbkdf2(pw, unb64(salt), Number(vong));
    return { dung: soSanhDeu(tinh, hash), canNangCap: Number(vong) < PBKDF2_VONG };
  }
  if (!luu) return { dung: false, canNangCap: false };
  return { dung: soSanhDeu(await sha256B64(pw || ''), luu), canNangCap: true };
}
function taoToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function handleLogin(env, tenDangNhap, password) {
  const user = await first(env, `SELECT * FROM "NguoiDung" WHERE "TenDangNhap" = ?1`, String(tenDangNhap || ''));
  if (!user) return { success: false, error: 'SAI_TAI_KHOAN' };
  if (user.TrangThai !== 'Active') return { success: false, error: 'TAI_KHOAN_BI_KHOA' };
  if (user.KhoaDenLuc && user.KhoaDenLuc > bayGio()) return { success: false, error: 'TAM_KHOA_DO_SAI_NHIEU_LAN' };
  const kq = await kiemMatKhau(password, user.MatKhauHash);
  if (!kq.dung) {
    const soLan = (Number(user.SoLanSai) || 0) + 1;
    if (soLan >= SO_LAN_SAI_TOI_DA) {
      await run(env, `UPDATE "NguoiDung" SET "SoLanSai" = 0, "KhoaDenLuc" = ?2 WHERE "MaNV" = ?1`, user.MaNV, new Date(Date.now() + PHUT_KHOA_KHI_SAI * 60000).toISOString());
      return { success: false, error: 'TAM_KHOA_DO_SAI_NHIEU_LAN' };
    }
    await run(env, `UPDATE "NguoiDung" SET "SoLanSai" = ?2 WHERE "MaNV" = ?1`, user.MaNV, soLan);
    return { success: false, error: 'SAI_MAT_KHAU' };
  }
  const token = taoToken();
  const lenh = [
    // Đơn phiên đăng nhập (giữ đúng hành vi bản GAS): đăng nhập nơi mới -> phiên cũ bị đá ra.
    env.DB.prepare(`DELETE FROM "Phien" WHERE "MaNV" = ?1`).bind(user.MaNV),
    env.DB.prepare(`INSERT INTO "Phien" ("TokenHash","MaNV","CreatedAt") VALUES (?1,?2,?3)`).bind(await sha256Hex(token), user.MaNV, bayGio()),
    env.DB.prepare(`UPDATE "NguoiDung" SET "SoLanSai" = 0, "KhoaDenLuc" = NULL WHERE "MaNV" = ?1`).bind(user.MaNV),
    lenhNhatKy(env, user.TenDangNhap, 'login', '')
  ];
  if (kq.canNangCap) lenh.push(env.DB.prepare(`UPDATE "NguoiDung" SET "MatKhauHash" = ?2 WHERE "MaNV" = ?1`).bind(user.MaNV, await bamMatKhau(password)));
  await env.DB.batch(lenh);
  const cfg = await docConfig(env);
  return {
    success: true, token,
    user: { maNV: user.MaNV, hoTen: user.HoTen, tenDangNhap: user.TenDangNhap, vaiTro: user.VaiTro },
    companyName: cfg.CompanyName || ''
  };
}

async function getSessionUser(env, token) {
  if (!token || typeof token !== 'string') throw loi('AUTH_FAILED');
  const u = await first(env, `SELECT n.* FROM "Phien" p JOIN "NguoiDung" n ON n."MaNV" = p."MaNV" WHERE p."TokenHash" = ?1`, await sha256Hex(token));
  if (!u || u.TrangThai !== 'Active') throw loi('AUTH_FAILED');
  return u;
}

async function handleLogout(env, token) {
  if (token) await run(env, `DELETE FROM "Phien" WHERE "TokenHash" = ?1`, await sha256Hex(token));
  return { loggedOut: true };
}

async function doiMatKhau(env, user, matKhauCu, matKhauMoi) {
  const found = await first(env, `SELECT * FROM "NguoiDung" WHERE "MaNV" = ?1`, user.MaNV);
  if (!found) throw loi('KHONG_TIM_THAY_NGUOI_DUNG');
  if (!(await kiemMatKhau(matKhauCu, found.MatKhauHash)).dung) throw loi('SAI_MAT_KHAU_CU');
  if (!matKhauMoi || matKhauMoi.length < 6) throw loi('MAT_KHAU_MOI_QUA_NGAN');
  await run(env, `UPDATE "NguoiDung" SET "MatKhauHash" = ?2 WHERE "MaNV" = ?1`, user.MaNV, await bamMatKhau(matKhauMoi));
  return { updated: true };
}

// ================== NGƯỜI DÙNG (ADMIN) ==================
async function getNguoiDungList(env) {
  return all(env, `SELECT "MaNV","HoTen","TenDangNhap","VaiTro","TrangThai","NgayTao" FROM "NguoiDung" ORDER BY rowid`);
}
async function saveNguoiDung(env, data) {
  data = data || {};
  if (data.MaNV) {
    const existing = await first(env, `SELECT * FROM "NguoiDung" WHERE "MaNV" = ?1`, data.MaNV);
    if (existing) {
      const tenDN = data.TenDangNhap || existing.TenDangNhap;
      if (tenDN !== existing.TenDangNhap && await first(env, `SELECT 1 FROM "NguoiDung" WHERE "TenDangNhap" = ?1`, tenDN)) throw loi('TEN_DANG_NHAP_DA_TON_TAI');
      if (data.MatKhauMoi && data.MatKhauMoi.length < 6) throw loi('Mật khẩu tối thiểu 6 ký tự');
      const hash = data.MatKhauMoi ? await bamMatKhau(data.MatKhauMoi) : existing.MatKhauHash;
      const lenh = [env.DB.prepare(`UPDATE "NguoiDung" SET "HoTen"=?2, "TenDangNhap"=?3, "MatKhauHash"=?4, "VaiTro"=?5 WHERE "MaNV"=?1`)
        .bind(data.MaNV, data.HoTen || existing.HoTen, tenDN, hash, data.VaiTro || existing.VaiTro)];
      if (data.MatKhauMoi) lenh.push(env.DB.prepare(`DELETE FROM "Phien" WHERE "MaNV" = ?1`).bind(data.MaNV)); // đặt lại mật khẩu -> đăng xuất phiên đang mở
      await env.DB.batch(lenh);
      return { updated: true };
    }
  }
  if (!data.TenDangNhap) throw loi('THIEU_TEN_DANG_NHAP');
  if (await first(env, `SELECT 1 FROM "NguoiDung" WHERE "TenDangNhap" = ?1`, data.TenDangNhap)) throw loi('TEN_DANG_NHAP_DA_TON_TAI');
  if (!data.MatKhauMoi || data.MatKhauMoi.length < 6) throw loi('Mật khẩu ban đầu tối thiểu 6 ký tự');
  const maNV = taoId('NV');
  await env.DB.batch(lenhThem(env.DB, 'NguoiDung', [{
    MaNV: maNV, HoTen: data.HoTen, TenDangNhap: data.TenDangNhap, MatKhauHash: await bamMatKhau(data.MatKhauMoi),
    VaiTro: data.VaiTro || ROLES.BANHANG, TrangThai: 'Active', NgayTao: homNayVN(), SoLanSai: 0
  }]));
  return { created: true, maNV };
}
async function khoaMoNguoiDung(env, maNV, trangThai) {
  if (!['Active', 'Locked'].includes(trangThai)) throw loi('TRANG_THAI_KHONG_HOP_LE');
  const lenh = [env.DB.prepare(`UPDATE "NguoiDung" SET "TrangThai" = ?2 WHERE "MaNV" = ?1`).bind(maNV, trangThai)];
  if (trangThai !== 'Active') lenh.push(env.DB.prepare(`DELETE FROM "Phien" WHERE "MaNV" = ?1`).bind(maNV));
  const kq = await env.DB.batch(lenh);
  if (!kq[0].meta.changes) throw loi('KHONG_TIM_THAY');
  return { updated: true };
}
async function deleteNguoiDung(env, maNV) {
  const kq = await env.DB.batch([
    env.DB.prepare(`DELETE FROM "NguoiDung" WHERE "MaNV" = ?1`).bind(maNV),
    env.DB.prepare(`DELETE FROM "Phien" WHERE "MaNV" = ?1`).bind(maNV)
  ]);
  if (!kq[0].meta.changes) throw loi('KHONG_TIM_THAY');
  return { deleted: true };
}

// ================== SỔ KHO: TỒN KHO & GIÁ VỐN TÍNH TỪ SỔ ==================
// Tồn kho = tổng SoLuongQuyDoi nhập - xuất - sửa chữa - gia công + điều chỉnh. Chỉ tính cho Loai='HangHoa'.
const SQL_TON_THEO_SO = `ROUND(
    COALESCE((SELECT SUM(c."SoLuongQuyDoi") FROM "NhapKhoCT" c WHERE c."MaHH" = "HangHoa"."MaHH"), 0)
  - COALESCE((SELECT SUM(c."SoLuongQuyDoi") FROM "XuatBanCT" c WHERE c."MaHH" = "HangHoa"."MaHH"), 0)
  - COALESCE((SELECT SUM(c."SoLuongQuyDoi") FROM "SuaChuaCT" c WHERE c."MaHH" = "HangHoa"."MaHH"), 0)
  - COALESCE((SELECT SUM(c."SoLuongQuyDoi") FROM "GiaCongCT" c WHERE c."MaHH" = "HangHoa"."MaHH"), 0)
  + COALESCE((SELECT SUM(d."SoLuongQuyDoi") FROM "DieuChinhKho" d WHERE d."MaHH" = "HangHoa"."MaHH"), 0), 4)`;

function lenhTinhLaiTon(db, maHHs) {
  return db.prepare(`UPDATE "HangHoa" SET "TonKho" = CASE WHEN "Loai" = 'HangHoa' THEN ${SQL_TON_THEO_SO} ELSE 0 END
    WHERE "MaHH" IN (SELECT value FROM json_each(?1))`).bind(JSON.stringify(maHHs));
}

// Giá vốn bình quân gia quyền liên hoàn, đi lần lượt theo thời gian (Ngay, Timestamp) qua mọi phiếu của mặt hàng.
// Không làm được bằng 1 câu SQL nên tính trong JS, chỉ cho đúng các mặt hàng vừa bị ảnh hưởng.
// opts.ghiGiaVonXuat = true: ghi lại luôn GiaVon (giá vốn/đơn vị chính tại thời điểm bán) trên từng dòng XuatBanCT
// theo đúng thứ tự thời gian — dùng khi sửa lại lịch sử (áp hệ số quy đổi cho dòng cũ, nút "Tính lại tồn kho").
// Lưu phiếu thường KHÔNG bật để không làm đổi giá vốn của các kỳ báo cáo trước.
async function tinhLaiGiaVon(env, maHHs, opts) {
  maHHs = duyNhat(maHHs);
  if (!maHHs.length) return { soSuKien: {} };
  const j = JSON.stringify(maHHs);
  const loaiRows = await allRaw(env, `SELECT "MaHH","Loai" FROM "HangHoa" WHERE "MaHH" IN (SELECT value FROM json_each(?1))`, j);
  const trangThai = {};
  loaiRows.forEach(h => { if (h.Loai === 'HangHoa') trangThai[h.MaHH] = { ton: 0, gia: 0, n: 0 }; });
  const dsHH = Object.keys(trangThai);
  if (!dsHH.length) return { soSuKien: {} };
  const jh = JSON.stringify(dsHH);
  const suKien = await allRaw(env, `
    SELECT c."MaHH" AS MaHH, h."Ngay" AS Ngay, h."Timestamp" AS TS, 1 AS K, c."ID" AS ID, c."SoLuongQuyDoi" AS Q, c."ThanhTien" AS TT
      FROM "NhapKhoCT" c JOIN "NhapKho" h ON h."IDPhieu" = c."IDPhieu" WHERE c."MaHH" IN (SELECT value FROM json_each(?1))
    UNION ALL SELECT c."MaHH", h."Ngay", h."Timestamp", 2, c."ID", -c."SoLuongQuyDoi", NULL
      FROM "XuatBanCT" c JOIN "XuatBan" h ON h."IDPhieu" = c."IDPhieu" WHERE c."MaHH" IN (SELECT value FROM json_each(?1))
    UNION ALL SELECT c."MaHH", h."Ngay", h."Timestamp", 3, c."ID", -c."SoLuongQuyDoi", NULL
      FROM "SuaChuaCT" c JOIN "SuaChua" h ON h."IDPhieu" = c."IDPhieu" WHERE c."MaHH" IN (SELECT value FROM json_each(?1))
    UNION ALL SELECT c."MaHH", h."Ngay", h."Timestamp", 4, c."ID", -c."SoLuongQuyDoi", NULL
      FROM "GiaCongCT" c JOIN "GiaCong" h ON h."IDPhieu" = c."IDPhieu" WHERE c."MaHH" IN (SELECT value FROM json_each(?1))
    UNION ALL SELECT d."MaHH", d."Ngay", d."Timestamp", 5, d."ID", d."SoLuongQuyDoi", d."DonGiaQuyDoi"
      FROM "DieuChinhKho" d WHERE d."MaHH" IN (SELECT value FROM json_each(?1))
    ORDER BY MaHH, Ngay, TS, K, ID`, jh);
  const giaVonXuat = {};
  for (const e of suKien) {
    const s = trangThai[e.MaHH]; if (!s) continue;
    s.n++;
    if (e.K === 2) giaVonXuat[String(e.ID)] = Math.round(s.gia);
    const q = Number(e.Q) || 0;
    const laNhapCoGia = (e.K === 1 && q > 0) || (e.K === 5 && q > 0 && e.TT !== null && e.TT !== '');
    if (laNhapCoGia) {
      const donGia = e.K === 1 ? (Number(e.TT) || 0) / q : Number(e.TT) || 0;
      const tonMoi = s.ton + q;
      // Tồn trước đó <= 0 (bán trước khi có phiếu nhập) -> lấy luôn giá nhập mới, tránh công thức bình quân
      // với số âm cho ra giá vốn vô lý (lỗi có ở bản GAS).
      s.gia = s.ton > 0 ? (s.ton * s.gia + q * donGia) / tonMoi : donGia;
      s.ton = tonMoi;
    } else {
      s.ton += q;
    }
  }
  const giaMoi = {}; const soSuKien = {};
  for (const ma of dsHH) { giaMoi[ma] = Math.round(trangThai[ma].gia); soSuKien[ma] = trangThai[ma].n; }
  await run(env, `UPDATE "HangHoa" SET "GiaVonTB" = (SELECT value FROM json_each(?1) WHERE key = "HangHoa"."MaHH")
    WHERE "MaHH" IN (SELECT key FROM json_each(?1))`, JSON.stringify(giaMoi));
  if (opts && opts.ghiGiaVonXuat && Object.keys(giaVonXuat).length) {
    await run(env, `UPDATE "XuatBanCT" SET "GiaVon" = (SELECT value FROM json_each(?1) WHERE key = CAST("XuatBanCT"."ID" AS TEXT))
      WHERE "ID" IN (SELECT CAST(key AS INTEGER) FROM json_each(?1))`, JSON.stringify(giaVonXuat));
  }
  return { giaMoi, soSuKien };
}

async function docTonKho(env, maHHs) {
  maHHs = duyNhat(maHHs);
  if (!maHHs.length) return {};
  const rows = await allRaw(env, `SELECT "MaHH","TonKho","GiaVonTB" FROM "HangHoa" WHERE "Loai" = 'HangHoa' AND "MaHH" IN (SELECT value FROM json_each(?1))`, JSON.stringify(maHHs));
  const out = {}; rows.forEach(r => { out[r.MaHH] = { TonKho: Number(r.TonKho) || 0, GiaVonTB: Number(r.GiaVonTB) || 0 }; });
  return out;
}

async function layHangHoaMap(env, maHHs) {
  maHHs = duyNhat(maHHs);
  if (!maHHs.length) return {};
  const rows = await allRaw(env, `SELECT * FROM "HangHoa" WHERE "MaHH" IN (SELECT value FROM json_each(?1))`, JSON.stringify(maHHs));
  const m = {}; rows.forEach(h => { m[h.MaHH] = h; }); return m;
}

// 1 dòng chi tiết phiếu, kèm hệ số quy đổi CHỤP LẠI tại thời điểm ghi (đổi hệ số trong danh mục sau này
// không làm sai lịch sử). Nhập theo đơn vị lớn (DonViDaChon='nhap', VD Cuộn) -> SoLuongQuyDoi = SL x hệ số.
function lapDongCT(it, hh) {
  const heSo = (it.DonViDaChon === 'nhap' && hh && Number(hh.HeSoQuyDoi) > 0) ? Number(hh.HeSoQuyDoi) : 1;
  const soLuong = Number(it.SoLuong) || 0;
  const donGia = Number(it.DonGia) || 0;
  const thanhTien = soLuong * donGia;
  const tienThue = tinhTienThue(thanhTien, it.ThueSuat);
  return {
    MaHH: it.MaHH || '', TenHH: it.TenHH || (hh ? hh.TenHH : '') || '', SoLuong: soLuong, DonGia: donGia,
    ThanhTien: thanhTien, ThueSuat: it.ThueSuat ? String(it.ThueSuat) : '0', TienThue: tienThue,
    ThanhTienSauThue: thanhTien + tienThue, DVT: it.DVT || '', HeSoQuyDoi: heSo, SoLuongQuyDoi: soLuong * heSo
  };
}

function kiemTraTon(dong, hhMap, choPhepAm) {
  if (choPhepAm) return;
  const can = {};
  dong.forEach(d => { const hh = hhMap[d.MaHH]; if (hh && hh.Loai === 'HangHoa') can[d.MaHH] = (can[d.MaHH] || 0) + d.SoLuongQuyDoi; });
  for (const ma of Object.keys(can)) {
    const hh = hhMap[ma];
    if ((Number(hh.TonKho) || 0) < can[ma] - 1e-9) throw loi(`KHONG_DU_TON_KHO: ${hh.TenHH} chỉ còn ${Number(hh.TonKho) || 0} ${hh.DVT || ''}`);
  }
}

// Sau khi batch ghi xong: tính lại giá vốn + đọc tồn mới cho giao diện gộp tại chỗ (tonKhoCapNhat)
async function sauKhiGhiKho(env, maHHs) {
  await tinhLaiGiaVon(env, maHHs);
  return docTonKho(env, maHHs);
}

// ================== DANH MỤC ==================
const getHangHoaList = env => all(env, `SELECT * FROM "HangHoa" ORDER BY rowid`);
const getNhaCungCapList = env => all(env, `SELECT * FROM "NhaCungCap" ORDER BY rowid`);
const getKhachHangList = env => all(env, `SELECT * FROM "KhachHang" ORDER BY rowid`);

async function saveHangHoa(env, data) {
  data = data || {};
  if (data.MaHH) {
    const existing = await first(env, `SELECT * FROM "HangHoa" WHERE "MaHH" = ?1`, data.MaHH);
    if (existing) {
      const hangHoa = {
        ...existing, TenHH: data.TenHH, Loai: data.Loai, DVT: data.DVT, GiaBan: Number(data.GiaBan) || 0,
        TonKhoToiThieu: Number(data.TonKhoToiThieu) || 0, GhiChu: data.GhiChu || '', DVTNhap: data.DVTNhap || '',
        HeSoQuyDoi: Number(data.HeSoQuyDoi) || 0
      };
      const lenh = [env.DB.prepare(`UPDATE "HangHoa" SET "TenHH"=?2,"Loai"=?3,"DVT"=?4,"GiaBan"=?5,"TonKhoToiThieu"=?6,"GhiChu"=?7,"DVTNhap"=?8,"HeSoQuyDoi"=?9 WHERE "MaHH"=?1`)
        .bind(data.MaHH, giaTriCot('HangHoa', 'TenHH', hangHoa.TenHH), giaTriCot('HangHoa', 'Loai', hangHoa.Loai), giaTriCot('HangHoa', 'DVT', hangHoa.DVT),
          hangHoa.GiaBan, hangHoa.TonKhoToiThieu, hangHoa.GhiChu, hangHoa.DVTNhap, hangHoa.HeSoQuyDoi)];
      const doiLoai = existing.Loai !== data.Loai;
      if (doiLoai) lenh.push(lenhTinhLaiTon(env.DB, [data.MaHH])); // đổi Hàng hoá <-> Dịch vụ -> tồn tính lại ngay theo sổ
      await env.DB.batch(lenh);
      if (doiLoai) await tinhLaiGiaVon(env, [data.MaHH]);
      const moi = await first(env, `SELECT * FROM "HangHoa" WHERE "MaHH" = ?1`, data.MaHH);
      return { updated: true, maHH: data.MaHH, hangHoa: chuanHoaDong(moi) };
    }
  }
  const maHH = data.MaHH || taoId('HH');
  const hangHoa = {
    MaHH: maHH, TenHH: data.TenHH, Loai: data.Loai, DVT: data.DVT, GiaVonTB: 0, GiaBan: Number(data.GiaBan) || 0, TonKho: 0,
    TonKhoToiThieu: Number(data.TonKhoToiThieu) || 0, GhiChu: data.GhiChu || '', NgayTao: homNayVN(),
    DVTNhap: data.DVTNhap || '', HeSoQuyDoi: Number(data.HeSoQuyDoi) || 0
  };
  await env.DB.batch(lenhThem(env.DB, 'HangHoa', [hangHoa]));
  return { created: true, maHH, hangHoa: chuanHoaDong(hangHoa) };
}

async function tinhLaiTonKho(env, maHH) {
  const hh = await first(env, `SELECT "MaHH" FROM "HangHoa" WHERE "MaHH" = ?1`, maHH);
  if (!hh) throw loi('KHONG_TIM_THAY_HANG_HOA');
  await env.DB.batch([lenhTinhLaiTon(env.DB, [maHH])]);
  const { giaMoi, soSuKien } = await tinhLaiGiaVon(env, [maHH], { ghiGiaVonXuat: true });
  const moi = await first(env, `SELECT "TonKho","GiaVonTB" FROM "HangHoa" WHERE "MaHH" = ?1`, maHH);
  return { maHH, tonKhoMoi: Number(moi.TonKho) || 0, giaVonMoi: Number(moi.GiaVonTB) || 0, soSuKien: (soSuKien && soSuKien[maHH]) || 0, _giaMoi: giaMoi };
}

// ===== ÁP ĐƠN VỊ / HỆ SỐ QUY ĐỔI CHO DÒNG PHIẾU CŨ =====
// Dòng phiếu chụp hệ số tại lúc ghi. Nếu lúc đó mặt hàng chưa khai "Đơn vị nhập lớn" (VD nhập BKMV 1 Cuộn khi
// danh mục chưa có hệ số) thì dòng bị lưu 1 Cuộn = 1 đơn vị chính. Công cụ này cho admin chọn lại đơn vị từng dòng.
const BANG_CT = {
  NhapKhoCT: { h: 'NhapKho', so: 'SoHDMuaVao', ten: 'Nhập kho' },
  XuatBanCT: { h: 'XuatBan', so: 'SoHDDT', ten: 'Xuất bán' },
  SuaChuaCT: { h: 'SuaChua', so: 'SoHDDT', ten: 'Sửa chữa' },
  GiaCongCT: { h: 'GiaCong', so: 'SoHDDT', ten: 'Gia công' }
};
async function getDongTheoDonVi(env, maHH) {
  const hh = await first(env, `SELECT * FROM "HangHoa" WHERE "MaHH" = ?1`, maHH);
  if (!hh) throw loi('KHONG_TIM_THAY_HANG_HOA');
  const sql = Object.entries(BANG_CT).map(([ct, b]) =>
    `SELECT '${ct}' AS Bang, c."ID" AS ID, c."IDPhieu" AS IDPhieu, h."Ngay" AS Ngay, h."${b.so}" AS SoHD, c."SoLuong" AS SoLuong,
       c."DonGia" AS DonGia, c."ThanhTien" AS ThanhTien, c."DVT" AS DVT, c."HeSoQuyDoi" AS HeSoQuyDoi, c."SoLuongQuyDoi" AS SoLuongQuyDoi
     FROM "${ct}" c JOIN "${b.h}" h ON h."IDPhieu" = c."IDPhieu" WHERE c."MaHH" = ?1`).join(' UNION ALL ') + ' ORDER BY Ngay, ID';
  const rows = await allRaw(env, sql, maHH);
  return { hangHoa: chuanHoaDong(hh), dong: rows.map(r => ({ ...chuanHoaDong(r), TenBang: BANG_CT[r.Bang].ten })) };
}
async function apDungDonViDongCu(env, maHH, dong) {
  const hh = await first(env, `SELECT * FROM "HangHoa" WHERE "MaHH" = ?1`, maHH);
  if (!hh) throw loi('KHONG_TIM_THAY_HANG_HOA');
  const heSo = Number(hh.HeSoQuyDoi) || 0;
  if (!hh.DVTNhap || !(heSo > 0)) throw loi('CHUA_KHAI_HE_SO: mặt hàng chưa có "Đơn vị nhập lớn" và hệ số quy đổi — khai trong danh mục rồi lưu trước');
  if (!Array.isArray(dong) || !dong.length) throw loi('KHONG_CO_DU_LIEU');
  const nhom = {};
  for (const d of dong) {
    if (!BANG_CT[d.Bang]) throw loi('BANG_KHONG_HOP_LE');
    const id = Number(d.ID); if (!Number.isInteger(id)) throw loi('ID_KHONG_HOP_LE');
    const k = d.Bang + '|' + (d.DonVi === 'nhap' ? 'nhap' : 'goc');
    (nhom[k] = nhom[k] || []).push(id);
  }
  const lenh = Object.entries(nhom).map(([k, ids]) => {
    const [bang, dv] = k.split('|');
    const hs = dv === 'nhap' ? heSo : 1, dvt = dv === 'nhap' ? hh.DVTNhap : (hh.DVT || '');
    return env.DB.prepare(`UPDATE "${bang}" SET "HeSoQuyDoi" = ?2, "SoLuongQuyDoi" = "SoLuong" * ?2, "DVT" = ?3
      WHERE "MaHH" = ?1 AND "ID" IN (SELECT value FROM json_each(?4))`).bind(maHH, hs, dvt, JSON.stringify(ids));
  });
  lenh.push(lenhTinhLaiTon(env.DB, [maHH]));
  const kq = await env.DB.batch(lenh);
  const soDong = kq.slice(0, -1).reduce((t, r) => t + (r.meta.changes || 0), 0);
  await tinhLaiGiaVon(env, [maHH], { ghiGiaVonXuat: true });
  const moi = await first(env, `SELECT * FROM "HangHoa" WHERE "MaHH" = ?1`, maHH);
  return { soDongCapNhat: soDong, hangHoa: chuanHoaDong(moi), tonKhoMoi: Number(moi.TonKho) || 0, giaVonMoi: Number(moi.GiaVonTB) || 0 };
}

// Không cho xoá mặt hàng / đối tác khỏi danh mục khi còn phiếu trỏ tới — trước đây xoá được, phiếu vẫn còn nên
// hàng "biến mất" khỏi kho nhưng vẫn nằm trong sổ (VD Dây đeo thẻ 28/09/2026). Muốn xoá phải xoá hết phiếu trước.
const NOI_DUNG_THAM_CHIEU = {
  HangHoa: [['NhapKhoCT', 'MaHH', 'phiếu nhập'], ['XuatBanCT', 'MaHH', 'phiếu bán'], ['SuaChuaCT', 'MaHH', 'phiếu sửa chữa'],
    ['GiaCongCT', 'MaHH', 'phiếu gia công'], ['DieuChinhKho', 'MaHH', 'lần điều chỉnh kho']],
  NhaCungCap: [['NhapKho', 'MaNCC', 'phiếu nhập'], ['GiaCong', 'MaDoiTac', 'phiếu gia công']],
  KhachHang: [['XuatBan', 'MaKH', 'phiếu bán'], ['SuaChua', 'MaKH', 'phiếu sửa chữa'], ['GiaCong', 'MaDoiTac', 'phiếu gia công']]
};
async function xoaDanhMucAnToan(env, bang, field, value) {
  if (!value) throw loi('KHONG_TIM_THAY');
  const ds = NOI_DUNG_THAM_CHIEU[bang];
  const r = await env.DB.batch(ds.map(([b, cot]) => env.DB.prepare(`SELECT COUNT(*) n FROM "${b}" WHERE "${cot}" = ?1`).bind(value)));
  const conDung = ds.map(([, , ten], i) => ({ ten, n: Number(r[i].results[0].n) || 0 })).filter(x => x.n > 0);
  if (conDung.length) {
    const tong = conDung.reduce((s, x) => s + x.n, 0);
    throw loi(`DANG_DUOC_SU_DUNG: Không xoá được — mục này còn ${tong} ${bang === 'HangHoa' ? 'dòng phiếu' : 'phiếu'} (${conDung.map(x => x.n + ' ' + x.ten).join(', ')}). Xoá hoặc sửa các phiếu đó trước.`);
  }
  return deleteRowByField(env, bang, field, value);
}

async function deleteRowByField(env, bang, field, value) {
  const kq = await run(env, `DELETE FROM "${bang}" WHERE "${field}" = ?1`, value);
  if (!kq.meta.changes) throw loi('KHONG_TIM_THAY');
  return { deleted: true };
}

async function saveDoiTac(env, bang, idField, prefix, data) {
  data = data || {};
  const tenField = bang === 'KhachHang' ? 'TenKH' : 'TenNCC';
  const ten = data.TenNCC || data.TenKH;
  if (data[idField]) {
    const kq = await run(env, `UPDATE "${bang}" SET "${tenField}"=?2,"MST"=?3,"DiaChi"=?4,"SDT"=?5,"Email"=?6,"GhiChu"=?7 WHERE "${idField}"=?1`,
      data[idField], ten || '', String(data.MST || ''), data.DiaChi || '', String(data.SDT || ''), data.Email || '', data.GhiChu || '');
    if (kq.meta.changes) return { updated: true };
  }
  const id = taoId(prefix);
  await env.DB.batch(lenhThem(env.DB, bang, [{ [idField]: id, [tenField]: ten, MST: data.MST || '', DiaChi: data.DiaChi || '', SDT: data.SDT || '', Email: data.Email || '', GhiChu: data.GhiChu || '' }]));
  return { created: true, id };
}

// ================== DANH SÁCH PHIẾU (200 gần nhất + phiếu còn dang dở) ==================
const DIEU_KIEN_DANG_DO = {
  NhapKho: `COALESCE("TongTien",0) > COALESCE("DaTra",0)`,
  XuatBan: `COALESCE("TrangThaiHD",'') <> 'DaXuat' OR COALESCE("TongTien",0) > COALESCE("DaThu",0)`,
  SuaChua: `COALESCE("TrangThai",'') NOT IN ('HoanThanh','DaGiaoTra','Huy') OR COALESCE("TrangThaiHD",'') <> 'DaXuat' OR COALESCE("TongTien",0) > COALESCE("DaThu",0)`,
  GiaCong: `COALESCE("TrangThai",'') <> 'HoanThanh' OR COALESCE("TrangThaiHD",'') <> 'DaXuat' OR COALESCE("ChiPhiGiaCong",0) > COALESCE("DaThu",0) OR COALESCE("ChiPhiGiaCong",0) > COALESCE("DaTra",0)`
};
async function layDanhSachGanDay(env, bang, gioiHan) {
  const n = Number(gioiHan) || 0;
  if (!n) return all(env, `SELECT * FROM "${bang}" ORDER BY "Timestamp" DESC, rowid DESC`);
  return all(env, `SELECT * FROM "${bang}" WHERE "IDPhieu" IN (SELECT "IDPhieu" FROM "${bang}" ORDER BY "Timestamp" DESC, rowid DESC LIMIT ?1)
    OR (${DIEU_KIEN_DANG_DO[bang]}) ORDER BY "Timestamp" DESC, rowid DESC`, n);
}
async function getPhieuDetail(env, bangCT, idPhieu) {
  return { items: await all(env, `SELECT * FROM "${bangCT}" WHERE "IDPhieu" = ?1 ORDER BY "ID"`, idPhieu) };
}

// Phiếu nhập tay ghi Số HĐ mua vào đã có phiếu khác của cùng nhà cung cấp, cùng năm (VD đã nhập từ bảng kê BKMV)
// -> báo lỗi HOA_DON_DA_NHAP để người dùng xác nhận; gửi lại kèm choPhepTrungSoHD nếu chắc chắn là hoá đơn khác.
async function kiemTraTrungHoaDonNhap(env, data) {
  const so = chuanHoaSoHD(data.SoHDMuaVao);
  if (!so || !data.MaNCC) return;
  const ncc = await first(env, `SELECT "MST" FROM "NhaCungCap" WHERE "MaNCC" = ?1`, data.MaNCC);
  const mst = ncc ? chuanHoaMST(ncc.MST) : '';
  const nam = String(data.Ngay || homNayVN()).slice(0, 4);
  const ds = await all(env, `SELECT n."IDPhieu", n."Ngay", n."SoHDMuaVao", n."MaNCC", c."MST" FROM "NhapKho" n LEFT JOIN "NhaCungCap" c ON c."MaNCC" = n."MaNCC"
    WHERE ${SQL_SO_HD_CHUAN('n."SoHDMuaVao"')} = ?1 AND substr(n."Ngay",1,4) = ?2`, so.replace(/^0+/, ''), nam);
  const trung = ds.find(r => chuanHoaSoHD(r.SoHDMuaVao) === so && (r.MaNCC === data.MaNCC || (mst && chuanHoaMST(r.MST) === mst)));
  if (trung) throw loi(`HOA_DON_DA_NHAP: Hoá đơn số ${data.SoHDMuaVao} của nhà cung cấp này đã có phiếu nhập ${trung.IDPhieu} (ngày ${trung.Ngay}, ghi số HĐ "${trung.SoHDMuaVao}"). Nhập thêm sẽ cộng tồn kho 2 lần.`);
}

// ================== LƯU PHIẾU (mỗi phiếu = 1 giao dịch) ==================
async function luuPhieuNhap(env, data, user) {
  data = data || {};
  const items = data.items || [];
  if (!items.length) throw loi('KHONG_CO_HANG_HOA');
  if (!data.choPhepTrungSoHD) await kiemTraTrungHoaDonNhap(env, data);
  const hhMap = await layHangHoaMap(env, items.map(i => i.MaHH));
  const dong = items.map(it => lapDongCT(it, hhMap[it.MaHH]));
  const tongTienTruocThue = tong(dong, d => d.ThanhTien), tongTienThue = tong(dong, d => d.TienThue);
  const tongTien = tongTienTruocThue + tongTienThue;
  const idPhieu = taoId('NK');
  const phieu = {
    IDPhieu: idPhieu, Ngay: data.Ngay || homNayVN(), MaNCC: data.MaNCC || '', TenNCC: data.TenNCC || '',
    SoHDMuaVao: data.SoHDMuaVao || '', GhiChu: data.GhiChu || '',
    TongTienTruocThue: tongTienTruocThue, TongTienThue: tongTienThue, TongTien: tongTien,
    DaTra: 0, NguoiTao: user.TenDangNhap, Timestamp: bayGio()
  };
  const maHHs = duyNhat(dong.map(d => d.MaHH));
  await env.DB.batch([
    ...lenhThem(env.DB, 'NhapKho', [phieu]),
    ...lenhThem(env.DB, 'NhapKhoCT', dong.map(d => ({ ...d, IDPhieu: idPhieu }))),
    lenhTinhLaiTon(env.DB, maHHs)
  ]);
  const tonKhoCapNhat = await sauKhiGhiKho(env, maHHs);
  return { idPhieu, tongTien, tongTienTruocThue, tongTienThue, phieu, tonKhoCapNhat };
}

async function luuPhieuXuat(env, data, user) {
  data = data || {};
  const items = data.items || [];
  if (!items.length) throw loi('KHONG_CO_HANG_HOA');
  const hhMap = await layHangHoaMap(env, items.map(i => i.MaHH));
  const dong = items.map(it => ({ ...lapDongCT(it, hhMap[it.MaHH]), GiaVon: hhMap[it.MaHH] ? Number(hhMap[it.MaHH].GiaVonTB) || 0 : 0 }));
  kiemTraTon(dong, hhMap, !!data.choPhepTonKhoAm);
  const tongTienTruocThue = tong(dong, d => d.ThanhTien), tongTienThue = tong(dong, d => d.TienThue);
  const tongTien = tongTienTruocThue + tongTienThue;
  const idPhieu = taoId('XB');
  const phieu = {
    IDPhieu: idPhieu, Ngay: data.Ngay || homNayVN(), MaKH: data.MaKH || '', TenKH: data.TenKH || '',
    MSTKhachHang: data.MSTKhachHang || '', SoHDDT: data.SoHDDT || '', KyHieuHD: data.KyHieuHD || '', GhiChu: data.GhiChu || '',
    TongTienTruocThue: tongTienTruocThue, TongTienThue: tongTienThue, TongTien: tongTien,
    DaThu: 0, TrangThaiHD: data.SoHDDT ? 'DaXuat' : 'ChuaXuat', NguoiTao: user.TenDangNhap, Timestamp: bayGio()
  };
  const maHHs = duyNhat(dong.map(d => d.MaHH));
  await env.DB.batch([
    ...lenhThem(env.DB, 'XuatBan', [phieu]),
    ...lenhThem(env.DB, 'XuatBanCT', dong.map(d => ({ ...d, IDPhieu: idPhieu }))),
    lenhTinhLaiTon(env.DB, maHHs)
  ]);
  const tonKhoCapNhat = await sauKhiGhiKho(env, maHHs);
  return { idPhieu, tongTien, tongTienTruocThue, tongTienThue, phieu, tonKhoCapNhat };
}

async function luuPhieuSuaChua(env, data, user) {
  data = data || {};
  const items = data.items || [];
  const hhMap = await layHangHoaMap(env, items.map(i => i.MaHH));
  const dong = items.map(it => lapDongCT(it, hhMap[it.MaHH]));
  kiemTraTon(dong, hhMap, !!data.choPhepTonKhoAm);
  const tongTienLinhKien = tong(dong, d => d.ThanhTien), tongTienLinhKienThue = tong(dong, d => d.TienThue);
  const tienCong = Number(data.TienCong) || 0;
  const tienCongThue = tinhTienThue(tienCong, data.TienCongThueSuat);
  const tongTienTruocThue = tienCong + tongTienLinhKien;
  const tongTienThue = tienCongThue + tongTienLinhKienThue;
  const tongTien = tongTienTruocThue + tongTienThue;
  const idPhieu = taoId('SC');
  const phieu = {
    IDPhieu: idPhieu, Ngay: data.Ngay || homNayVN(), MaKH: data.MaKH || '', TenKH: data.TenKH || '', SDT: data.SDT || '',
    ThietBi: data.ThietBi || '', TinhTrangTiepNhan: data.TinhTrangTiepNhan || '', PhuKienKemTheo: data.PhuKienKemTheo || '',
    NguoiPhuTrach: data.NguoiPhuTrach || '', TrangThai: data.TrangThai || 'TiepNhan',
    NgayHenTra: data.NgayHenTra || '', NgayHoanThanh: '',
    TienCong: tienCong, TienCongThueSuat: data.TienCongThueSuat || '0', TienCongThue: tienCongThue,
    TongTienLinhKien: tongTienLinhKien, TongTienLinhKienThue: tongTienLinhKienThue,
    TongTienTruocThue: tongTienTruocThue, TongTienThue: tongTienThue, TongTien: tongTien, DaThu: 0,
    SoHDDT: '', KyHieuHD: '', TrangThaiHD: 'ChuaXuat', BaoHanhNgay: Number(data.BaoHanhNgay) || 0,
    GhiChu: data.GhiChu || '', NguoiTao: user.TenDangNhap, Timestamp: bayGio()
  };
  const maHHs = duyNhat(dong.map(d => d.MaHH));
  const lenh = [...lenhThem(env.DB, 'SuaChua', [phieu])];
  if (dong.length) lenh.push(...lenhThem(env.DB, 'SuaChuaCT', dong.map(d => ({ ...d, IDPhieu: idPhieu }))), lenhTinhLaiTon(env.DB, maHHs));
  await env.DB.batch(lenh);
  const tonKhoCapNhat = dong.length ? await sauKhiGhiKho(env, maHHs) : {};
  return { idPhieu, tongTien, tongTienTruocThue, tongTienThue, phieu, tonKhoCapNhat };
}

async function luuPhieuGiaCong(env, data, user) {
  data = data || {};
  if (!['NhanGiaCongChoKhach', 'ThueNgoaiGiaCong'].includes(data.Loai)) throw loi('LOAI_GIA_CONG_KHONG_HOP_LE');
  const items = data.items || [];
  const hhMap = await layHangHoaMap(env, items.map(i => i.MaHH));
  const dong = items.map(it => lapDongCT(it, hhMap[it.MaHH]));
  kiemTraTon(dong, hhMap, !!data.choPhepTonKhoAm);
  const chiPhiTruocThue = Number(data.ChiPhiGiaCong) || 0;
  const tienThueGiaCong = tinhTienThue(chiPhiTruocThue, data.ThueSuatGiaCong);
  const chiPhiSauThue = chiPhiTruocThue + tienThueGiaCong;
  const idPhieu = taoId('GC');
  const phieu = {
    IDPhieu: idPhieu, Loai: data.Loai, Ngay: data.Ngay || homNayVN(), MaDoiTac: data.MaDoiTac || '', TenDoiTac: data.TenDoiTac || '',
    MoTaCongViec: data.MoTaCongViec || '', SoLuongSanPham: Number(data.SoLuongSanPham) || 0, DonViTinh: data.DonViTinh || '',
    ChiPhiGiaCongTruocThue: chiPhiTruocThue, ThueSuatGiaCong: data.ThueSuatGiaCong || '0', TienThueGiaCong: tienThueGiaCong,
    ChiPhiGiaCong: chiPhiSauThue, TrangThai: data.TrangThai || 'TiepNhan', NgayHenTra: data.NgayHenTra || '', NgayHoanThanh: '',
    DaThu: 0, DaTra: 0, SoHDDT: '', KyHieuHD: '', TrangThaiHD: 'ChuaXuat', GhiChu: data.GhiChu || '',
    NguoiTao: user.TenDangNhap, Timestamp: bayGio()
  };
  const maHHs = duyNhat(dong.map(d => d.MaHH));
  const lenh = [...lenhThem(env.DB, 'GiaCong', [phieu])];
  if (dong.length) lenh.push(...lenhThem(env.DB, 'GiaCongCT', dong.map(d => ({ ...d, IDPhieu: idPhieu }))), lenhTinhLaiTon(env.DB, maHHs));
  await env.DB.batch(lenh);
  const tonKhoCapNhat = dong.length ? await sauKhiGhiKho(env, maHHs) : {};
  return { idPhieu, chiPhiSauThue, phieu, tonKhoCapNhat };
}

async function capNhatTrangThai(env, bang, idPhieu, trangThai, ngayHoanThanh) {
  const kq = ngayHoanThanh
    ? await run(env, `UPDATE "${bang}" SET "TrangThai" = ?2, "NgayHoanThanh" = ?3 WHERE "IDPhieu" = ?1`, idPhieu, trangThai || '', ngayHoanThanh)
    : await run(env, `UPDATE "${bang}" SET "TrangThai" = ?2 WHERE "IDPhieu" = ?1`, idPhieu, trangThai || '');
  if (!kq.meta.changes) throw loi('KHONG_TIM_THAY_PHIEU');
  return { updated: true };
}

// ================== HOÁ ĐƠN & THANH TOÁN ==================
async function capNhatHoaDon(env, bang, idPhieu, soHDDT, kyHieuHD) {
  const kq = await run(env, `UPDATE "${bang}" SET "SoHDDT" = ?2, "KyHieuHD" = ?3, "TrangThaiHD" = 'DaXuat' WHERE "IDPhieu" = ?1`, idPhieu, String(soHDDT || ''), String(kyHieuHD || ''));
  if (!kq.meta.changes) throw loi('KHONG_TIM_THAY_PHIEU');
  return { updated: true };
}

function banGhiSoQuy(loai, nhomMuc, soTien, phuongThuc, nguonGoc, moTa, nguoiTao, ngayTuyChon) {
  if (!soTien || Number(soTien) <= 0) return null;
  return {
    IDPhieu: taoId('QUY'), Ngay: ngayTuyChon || homNayVN(), Loai: loai, NhomMuc: nhomMuc, SoTien: Number(soTien),
    PhuongThuc: ['TienMat', 'ChuyenKhoan', 'The'].includes(phuongThuc) ? phuongThuc : 'TienMat',
    NguonGoc: nguonGoc || 'TuDo', MoTa: moTa || '', NguoiTao: nguoiTao || '', Timestamp: bayGio()
  };
}

const NHOM_MUC_THEO_BANG = { XuatBan: 'BanHang', NhapKho: 'MuaHang', SuaChua: 'SuaChua', GiaCong: 'GiaCong' };
// Cộng tiền đã thu/đã trả + ghi Sổ quỹ trong CÙNG 1 giao dịch (bản GAS là 2 bước rời, có thể lệch nhau).
async function capNhatThanhToan(env, bang, cot, idPhieu, soTien, phuongThuc, tenNguoiDung, lenhThemVao = []) {
  if (!['DaThu', 'DaTra'].includes(cot)) throw loi('LOAI_TIEN_KHONG_HOP_LE');
  const found = await first(env, `SELECT "IDPhieu" FROM "${bang}" WHERE "IDPhieu" = ?1`, idPhieu);
  if (!found) throw loi('KHONG_TIM_THAY_PHIEU');
  const so = Number(soTien) || 0;
  const banGhiQuy = banGhiSoQuy(cot === 'DaThu' ? 'Thu' : 'Chi', NHOM_MUC_THEO_BANG[bang] || 'ChiKhac', so, phuongThuc, `${bang}:${idPhieu}`, '', tenNguoiDung);
  const lenh = [...lenhThemVao, env.DB.prepare(`UPDATE "${bang}" SET "${cot}" = COALESCE("${cot}",0) + ?2 WHERE "IDPhieu" = ?1`).bind(idPhieu, so)];
  if (banGhiQuy) lenh.push(...lenhThem(env.DB, 'SoQuy', [banGhiQuy]));
  await env.DB.batch(lenh);
  return { updated: true, banGhiQuy };
}

async function bulkCapNhatHoaDon(env, items) {
  if (!items || !items.length) throw loi('KHONG_CO_DU_LIEU');
  const bangTheoLoai = { xuat: 'XuatBan', nhap: 'NhapKho', suachua: 'SuaChua', giacong: 'GiaCong' };
  const loiDs = []; let thanhCong = 0;
  const nhom = {};
  for (const it of items) {
    const bang = bangTheoLoai[it.sheetType];
    if (!bang) { loiDs.push({ idPhieu: it.idPhieu, error: 'LOAI_KHONG_HOP_LE' }); continue; }
    (nhom[bang] = nhom[bang] || []).push(it);
  }
  const lenh = [];
  for (const bang of Object.keys(nhom)) {
    const ds = nhom[bang];
    const tonTai = new Set((await allRaw(env, `SELECT "IDPhieu" FROM "${bang}" WHERE "IDPhieu" IN (SELECT value FROM json_each(?1))`, JSON.stringify(ds.map(i => i.idPhieu)))).map(r => r.IDPhieu));
    const hopLe = ds.filter(i => { if (!tonTai.has(i.idPhieu)) { loiDs.push({ idPhieu: i.idPhieu, error: 'KHONG_TIM_THAY_PHIEU' }); return false; } return true; });
    if (!hopLe.length) continue;
    const du = JSON.stringify(hopLe.map(i => ({ id: i.idPhieu, so: String(i.soHDDT || ''), kh: String(i.kyHieuHD || '') })));
    // 1 câu cho cả danh sách (json_each), thay vì mỗi phiếu 1 câu — giữ số lệnh D1 thấp dù đồng bộ hàng trăm hoá đơn.
    if (bang === 'NhapKho') {
      lenh.push(env.DB.prepare(`UPDATE "NhapKho" SET "SoHDMuaVao" = (SELECT json_extract(value,'$.so') FROM json_each(?1) WHERE json_extract(value,'$.id') = "NhapKho"."IDPhieu")
        WHERE "IDPhieu" IN (SELECT json_extract(value,'$.id') FROM json_each(?1))`).bind(du));
    } else {
      lenh.push(env.DB.prepare(`UPDATE "${bang}" SET
          "SoHDDT" = (SELECT json_extract(value,'$.so') FROM json_each(?1) WHERE json_extract(value,'$.id') = "${bang}"."IDPhieu"),
          "KyHieuHD" = (SELECT json_extract(value,'$.kh') FROM json_each(?1) WHERE json_extract(value,'$.id') = "${bang}"."IDPhieu"),
          "TrangThaiHD" = 'DaXuat'
        WHERE "IDPhieu" IN (SELECT json_extract(value,'$.id') FROM json_each(?1))`).bind(du));
    }
    thanhCong += hopLe.length;
  }
  if (lenh.length) await env.DB.batch(lenh);
  return { thanhCong, tongSo: items.length, loi: loiDs };
}

// ================== XOÁ PHIẾU (hoàn kho = tính lại từ sổ sau khi xoá, không cộng/trừ tay) ==================
async function xoaPhieu(env, bang, idPhieu) {
  const bangCT = CT_TABLE[bang];
  const found = await first(env, `SELECT "IDPhieu" FROM "${bang}" WHERE "IDPhieu" = ?1`, idPhieu);
  if (!found) throw loi('KHONG_TIM_THAY_PHIEU');
  const ct = await allRaw(env, `SELECT "MaHH" FROM "${bangCT}" WHERE "IDPhieu" = ?1`, idPhieu);
  const maHHs = duyNhat(ct.map(r => r.MaHH));
  const lenh = [
    env.DB.prepare(`DELETE FROM "${bangCT}" WHERE "IDPhieu" = ?1`).bind(idPhieu),
    env.DB.prepare(`DELETE FROM "${bang}" WHERE "IDPhieu" = ?1`).bind(idPhieu)
  ];
  if (maHHs.length) lenh.push(lenhTinhLaiTon(env.DB, maHHs));
  await env.DB.batch(lenh);
  if (maHHs.length) await tinhLaiGiaVon(env, maHHs);
  return { deleted: true, soDongHoanTon: ct.length };
}

// ================== SỬA PHIẾU (Xuất bán / Sửa chữa / Gia công) KHI CHƯA XUẤT HOÁ ĐƠN ĐIỆN TỬ ==================
// Chỉ cho sửa khi TrangThaiHD chưa là 'DaXuat' — hoá đơn đã xuất thì số liệu đã gửi cơ quan thuế, sửa ở đây
// sẽ lệch với hoá đơn thật. Toàn bộ việc xoá dòng cũ + ghi dòng mới + cập nhật phiếu + tính lại tồn phải nằm
// trong ĐÚNG 1 lệnh batch (1 giao dịch D1) — nếu kiểm tra tồn kho cho dòng mới thất bại thì KHÔNG được xoá
// dòng cũ trước đó (tách thành 2 batch sẽ có nguy cơ: batch 1 lỡ xoá xong, batch 2 mới báo lỗi tồn kho ->
// phiếu mất dòng chi tiết mà không sửa được gì, dữ liệu kẹt giữa chừng). Vì vậy kiểm tra tồn kho ở đây làm
// hoàn toàn trong JS (không đụng DB): coi như đã "hoàn" lại các dòng cũ vào tồn hiện tại rồi mới kiểm tra
// dòng mới có đủ tồn hay không — chỉ khi qua được bước này mới phát 1 batch duy nhất để ghi thật.
async function chanNeuDaXuatHD(phieuCu, idPhieu) {
  if (!phieuCu) throw loi('KHONG_TIM_THAY_PHIEU');
  if (phieuCu.TrangThaiHD === 'DaXuat') throw loi(`DA_XUAT_HOA_DON: Phiếu ${idPhieu} đã xuất hoá đơn điện tử (số ${phieuCu.SoHDDT || ''}), không thể sửa trực tiếp. Nếu hoá đơn ghi sai, cần huỷ/điều chỉnh hoá đơn điện tử trước, rồi xoá số HĐĐT ở đây mới sửa được phiếu.`);
}
async function chuanBiSuaPhieu(env, bangCT, idPhieu, items, choPhepTonKhoAm) {
  const ctCu = await allRaw(env, `SELECT "MaHH","SoLuongQuyDoi" FROM "${bangCT}" WHERE "IDPhieu" = ?1`, idPhieu);
  const maHHCu = duyNhat(ctCu.map(r => r.MaHH));
  const hoanTon = {};
  ctCu.forEach(r => { hoanTon[r.MaHH] = (hoanTon[r.MaHH] || 0) + (Number(r.SoLuongQuyDoi) || 0); });
  const hhMap = await layHangHoaMap(env, duyNhat([...maHHCu, ...items.map(i => i.MaHH)]));
  // Tồn "ảo" = tồn hiện tại (đã bị trừ bởi dòng cũ) + phần vừa hoàn của dòng cũ — CHƯA ghi gì xuống DB.
  Object.keys(hoanTon).forEach(ma => { if (hhMap[ma]) hhMap[ma] = { ...hhMap[ma], TonKho: (Number(hhMap[ma].TonKho) || 0) + hoanTon[ma] }; });
  const dong = items.map(it => lapDongCT(it, hhMap[it.MaHH]));
  kiemTraTon(dong, hhMap, !!choPhepTonKhoAm);
  return { dong, hhMap, maHHCu };
}

async function suaPhieuXuat(env, idPhieu, data) {
  data = data || {};
  const items = data.items || [];
  if (!items.length) throw loi('KHONG_CO_HANG_HOA');
  const phieuCu = await first(env, `SELECT * FROM "XuatBan" WHERE "IDPhieu" = ?1`, idPhieu);
  await chanNeuDaXuatHD(phieuCu, idPhieu);
  const { dong: dongTho, hhMap, maHHCu } = await chuanBiSuaPhieu(env, 'XuatBanCT', idPhieu, items, data.choPhepTonKhoAm);
  const dong = dongTho.map(d => ({ ...d, GiaVon: hhMap[d.MaHH] ? Number(hhMap[d.MaHH].GiaVonTB) || 0 : 0 }));
  const tongTienTruocThue = tong(dong, d => d.ThanhTien), tongTienThue = tong(dong, d => d.TienThue);
  const tongTien = tongTienTruocThue + tongTienThue;
  const maHHHopNhat = duyNhat([...maHHCu, ...dong.map(d => d.MaHH)]);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM "XuatBanCT" WHERE "IDPhieu" = ?1`).bind(idPhieu),
    env.DB.prepare(`UPDATE "XuatBan" SET "Ngay"=?2,"MaKH"=?3,"TenKH"=?4,"MSTKhachHang"=?5,"GhiChu"=?6,"TongTienTruocThue"=?7,"TongTienThue"=?8,"TongTien"=?9 WHERE "IDPhieu"=?1`)
      .bind(idPhieu, data.Ngay || phieuCu.Ngay, data.MaKH || '', data.TenKH || '', data.MSTKhachHang || '', data.GhiChu || '', tongTienTruocThue, tongTienThue, tongTien),
    ...lenhThem(env.DB, 'XuatBanCT', dong.map(d => ({ ...d, IDPhieu: idPhieu }))),
    lenhTinhLaiTon(env.DB, maHHHopNhat)
  ]);
  const tonKhoCapNhat = await sauKhiGhiKho(env, maHHHopNhat);
  const phieu = await first(env, `SELECT * FROM "XuatBan" WHERE "IDPhieu" = ?1`, idPhieu);
  return { idPhieu, phieu, tonKhoCapNhat };
}

async function suaPhieuSuaChua(env, idPhieu, data) {
  data = data || {};
  const items = data.items || [];
  const phieuCu = await first(env, `SELECT * FROM "SuaChua" WHERE "IDPhieu" = ?1`, idPhieu);
  await chanNeuDaXuatHD(phieuCu, idPhieu);
  const { dong, maHHCu } = await chuanBiSuaPhieu(env, 'SuaChuaCT', idPhieu, items, data.choPhepTonKhoAm);
  const tongTienLinhKien = tong(dong, d => d.ThanhTien), tongTienLinhKienThue = tong(dong, d => d.TienThue);
  const tienCong = Number(data.TienCong) || 0;
  const tienCongThue = tinhTienThue(tienCong, data.TienCongThueSuat);
  const tongTienTruocThue = tienCong + tongTienLinhKien;
  const tongTienThue = tienCongThue + tongTienLinhKienThue;
  const tongTien = tongTienTruocThue + tongTienThue;
  const maHHHopNhat = duyNhat([...maHHCu, ...dong.map(d => d.MaHH)]);
  const lenh = [
    env.DB.prepare(`DELETE FROM "SuaChuaCT" WHERE "IDPhieu" = ?1`).bind(idPhieu),
    env.DB.prepare(`UPDATE "SuaChua" SET "Ngay"=?2,"MaKH"=?3,"TenKH"=?4,"SDT"=?5,"ThietBi"=?6,"TinhTrangTiepNhan"=?7,"PhuKienKemTheo"=?8,
        "NguoiPhuTrach"=?9,"NgayHenTra"=?10,"BaoHanhNgay"=?11,"TienCong"=?12,"TienCongThueSuat"=?13,"TienCongThue"=?14,
        "TongTienLinhKien"=?15,"TongTienLinhKienThue"=?16,"TongTienTruocThue"=?17,"TongTienThue"=?18,"TongTien"=?19,"GhiChu"=?20
      WHERE "IDPhieu"=?1`)
      .bind(idPhieu, data.Ngay || phieuCu.Ngay, data.MaKH || '', data.TenKH || '', data.SDT || '', data.ThietBi || '',
        data.TinhTrangTiepNhan || '', data.PhuKienKemTheo || '', data.NguoiPhuTrach || '', data.NgayHenTra || '',
        Number(data.BaoHanhNgay) || 0, tienCong, data.TienCongThueSuat || '0', tienCongThue,
        tongTienLinhKien, tongTienLinhKienThue, tongTienTruocThue, tongTienThue, tongTien, data.GhiChu || '')
  ];
  if (dong.length) lenh.push(...lenhThem(env.DB, 'SuaChuaCT', dong.map(d => ({ ...d, IDPhieu: idPhieu }))));
  if (maHHHopNhat.length) lenh.push(lenhTinhLaiTon(env.DB, maHHHopNhat));
  await env.DB.batch(lenh);
  const tonKhoCapNhat = maHHHopNhat.length ? await sauKhiGhiKho(env, maHHHopNhat) : {};
  const phieu = await first(env, `SELECT * FROM "SuaChua" WHERE "IDPhieu" = ?1`, idPhieu);
  return { idPhieu, phieu, tonKhoCapNhat };
}

async function suaPhieuGiaCong(env, idPhieu, data) {
  data = data || {};
  const items = data.items || [];
  const phieuCu = await first(env, `SELECT * FROM "GiaCong" WHERE "IDPhieu" = ?1`, idPhieu);
  await chanNeuDaXuatHD(phieuCu, idPhieu);
  const { dong, maHHCu } = await chuanBiSuaPhieu(env, 'GiaCongCT', idPhieu, items, data.choPhepTonKhoAm);
  const chiPhiTruocThue = Number(data.ChiPhiGiaCong) || 0;
  const tienThueGiaCong = tinhTienThue(chiPhiTruocThue, data.ThueSuatGiaCong);
  const chiPhiSauThue = chiPhiTruocThue + tienThueGiaCong;
  const maHHHopNhat = duyNhat([...maHHCu, ...dong.map(d => d.MaHH)]);
  const lenh = [
    env.DB.prepare(`DELETE FROM "GiaCongCT" WHERE "IDPhieu" = ?1`).bind(idPhieu),
    env.DB.prepare(`UPDATE "GiaCong" SET "Ngay"=?2,"MaDoiTac"=?3,"TenDoiTac"=?4,"MoTaCongViec"=?5,"SoLuongSanPham"=?6,"DonViTinh"=?7,
        "ChiPhiGiaCongTruocThue"=?8,"ThueSuatGiaCong"=?9,"TienThueGiaCong"=?10,"ChiPhiGiaCong"=?11,"NgayHenTra"=?12,"GhiChu"=?13
      WHERE "IDPhieu"=?1`)
      .bind(idPhieu, data.Ngay || phieuCu.Ngay, data.MaDoiTac || '', data.TenDoiTac || '', data.MoTaCongViec || '',
        Number(data.SoLuongSanPham) || 0, data.DonViTinh || '', chiPhiTruocThue, data.ThueSuatGiaCong || '0',
        tienThueGiaCong, chiPhiSauThue, data.NgayHenTra || '', data.GhiChu || '')
  ];
  if (dong.length) lenh.push(...lenhThem(env.DB, 'GiaCongCT', dong.map(d => ({ ...d, IDPhieu: idPhieu }))));
  if (maHHHopNhat.length) lenh.push(lenhTinhLaiTon(env.DB, maHHHopNhat));
  await env.DB.batch(lenh);
  const tonKhoCapNhat = maHHHopNhat.length ? await sauKhiGhiKho(env, maHHHopNhat) : {};
  const phieu = await first(env, `SELECT * FROM "GiaCong" WHERE "IDPhieu" = ?1`, idPhieu);
  return { idPhieu, phieu, tonKhoCapNhat };
}

// ================== NHẬP HÀNG LOẠT TỪ BẢNG KÊ / XML ==================
// Giữ đúng hành vi Code.gs (tự tìm/tạo đối tác + hàng hoá, bỏ qua hoá đơn đã có, đánh dấu đã thanh toán),
// nhưng cả 1 lô ghi trong 1 giao dịch, gộp nhiều dòng/câu INSERT để không vượt 50 lệnh D1/request.
const MAX_HOA_DON_MOI_LO = 30;

async function napDoiTac(env) {
  const [kh, ncc, hh] = await env.DB.batch([
    env.DB.prepare(`SELECT "MaKH","TenKH","MST" FROM "KhachHang"`),
    env.DB.prepare(`SELECT "MaNCC","TenNCC","MST" FROM "NhaCungCap"`),
    env.DB.prepare(`SELECT * FROM "HangHoa"`)
  ]);
  return { kh: kh.results, ncc: ncc.results, hh: hh.results };
}

function taoBoTimHoacTao(nap) {
  const khMoi = [], nccMoi = [], hhMoi = [];
  const timDoiTac = (ds, moi, idField, tenField, prefix, mst, ten, them) => {
    const mstChuan = chuanHoaMST(mst), tenChuan = chuanHoaTen(ten);
    let f = mstChuan ? ds.find(r => chuanHoaMST(r.MST) === mstChuan) : null;
    if (!f && tenChuan) f = ds.find(r => chuanHoaTen(r[tenField]) === tenChuan);
    if (f) return f[idField];
    const id = taoId(prefix);
    const row = { [idField]: id, [tenField]: ten || mst || (prefix === 'KH' ? 'Khách hàng chưa rõ tên' : 'Đối tác chưa rõ tên'), MST: mst || '',
      DiaChi: (them && them.diaChi) || '', SDT: (them && them.sdt) || '', Email: (them && them.email) || '', GhiChu: 'Tạo tự động khi nhập dữ liệu lịch sử' };
    ds.push(row); moi.push(row);
    return id;
  };
  const hhTheoTen = {};
  nap.hh.forEach(h => { const k = chuanHoaTen(h.TenHH); if (!(k in hhTheoTen)) hhTheoTen[k] = h; });
  return {
    khMoi, nccMoi, hhMoi,
    kh: (mst, ten, them) => timDoiTac(nap.kh, khMoi, 'MaKH', 'TenKH', 'KH', mst, ten, them),
    ncc: (mst, ten, them) => timDoiTac(nap.ncc, nccMoi, 'MaNCC', 'TenNCC', 'NCC', mst, ten, them),
    hangHoa: (tenHang, dvt, loai, giaBanGoiY, ghiChu) => {
      const k = chuanHoaTen(tenHang);
      if (hhTheoTen[k]) return hhTheoTen[k];
      const h = { MaHH: taoId('HH'), TenHH: tenHang, Loai: loai === 'DichVu' ? 'DichVu' : 'HangHoa', DVT: dvt || '', GiaVonTB: 0,
        GiaBan: Number(giaBanGoiY) || 0, TonKho: 0, TonKhoToiThieu: 0, GhiChu: ghiChu, NgayTao: homNayVN(), DVTNhap: '', HeSoQuyDoi: 0 };
      hhTheoTen[k] = h; nap.hh.push(h); hhMoi.push(h);
      return h;
    },
    hhTheoMa: ma => nap.hh.find(h => h.MaHH === ma)
  };
}

// Dựng dữ liệu 1 phiếu nhập/xuất trong bộ nhớ, đồng thời mô phỏng tồn + giá vốn chạy dần (giống Code.gs xử
// lý tuần tự từng hoá đơn) để giá vốn chụp trên dòng xuất đúng thời điểm, dù cả lô ghi trong 1 giao dịch.
function dungPhieuLo(loai, inv, dongVao, user, moPhong) {
  const idPhieu = taoId(loai === 'xuat' ? 'XB' : 'NK');
  const dong = dongVao.map(({ item, hh }) => {
    const d = lapDongCT(item, hh);
    if (hh && hh.Loai === 'HangHoa') {
      const s = moPhong[hh.MaHH] = moPhong[hh.MaHH] || { ton: Number(hh.TonKho) || 0, gia: Number(hh.GiaVonTB) || 0 };
      if (loai === 'nhap') {
        const donGia = d.SoLuongQuyDoi ? d.ThanhTien / d.SoLuongQuyDoi : 0;
        const tonMoi = s.ton + d.SoLuongQuyDoi;
        s.gia = s.ton > 0 && tonMoi > 0 ? (s.ton * s.gia + d.SoLuongQuyDoi * donGia) / tonMoi : donGia;
        s.ton = tonMoi;
      } else {
        d.GiaVon = Math.round(s.gia);
        s.ton -= d.SoLuongQuyDoi;
      }
    } else if (loai === 'xuat') {
      d.GiaVon = hh ? Number(hh.GiaVonTB) || 0 : 0;
    }
    return { ...d, IDPhieu: idPhieu };
  });
  const tongTienTruocThue = tong(dong, d => d.ThanhTien), tongTienThue = tong(dong, d => d.TienThue);
  const tongTien = tongTienTruocThue + tongTienThue;
  const daTT = inv.daThanhToanDu ? tongTien : 0;
  const ts = bayGio();
  const phieu = loai === 'xuat'
    ? { IDPhieu: idPhieu, Ngay: inv.Ngay, MaKH: inv.MaKH, TenKH: inv.TenKH || '', MSTKhachHang: inv.MST || '', SoHDDT: inv.SoHD || '', KyHieuHD: inv.KyHieu || '',
      GhiChu: inv.GhiChu, TongTienTruocThue: tongTienTruocThue, TongTienThue: tongTienThue, TongTien: tongTien, DaThu: daTT,
      TrangThaiHD: inv.SoHD ? 'DaXuat' : 'ChuaXuat', NguoiTao: user.TenDangNhap, Timestamp: ts }
    : { IDPhieu: idPhieu, Ngay: inv.Ngay, MaNCC: inv.MaNCC, TenNCC: inv.TenNCC || '', SoHDMuaVao: inv.SoHD || '', GhiChu: inv.GhiChu,
      TongTienTruocThue: tongTienTruocThue, TongTienThue: tongTienThue, TongTien: tongTien, DaTra: daTT, NguoiTao: user.TenDangNhap, Timestamp: ts };
  const quy = inv.daThanhToanDu
    ? banGhiSoQuy(loai === 'xuat' ? 'Thu' : 'Chi', loai === 'xuat' ? 'BanHang' : 'MuaHang', tongTien, 'TienMat', `${loai === 'xuat' ? 'XuatBan' : 'NhapKho'}:${idPhieu}`, '', user.TenDangNhap)
    : null;
  return { loai, phieu, dong, quy };
}

async function ghiLo(env, bo, cacPhieu) {
  const xb = cacPhieu.filter(p => p.loai === 'xuat'), nk = cacPhieu.filter(p => p.loai === 'nhap');
  const maHHs = duyNhat(cacPhieu.flatMap(p => p.dong.map(d => d.MaHH)));
  const lenh = [
    ...lenhThem(env.DB, 'KhachHang', bo.khMoi), ...lenhThem(env.DB, 'NhaCungCap', bo.nccMoi), ...lenhThem(env.DB, 'HangHoa', bo.hhMoi),
    ...lenhThem(env.DB, 'XuatBan', xb.map(p => p.phieu)), ...lenhThem(env.DB, 'XuatBanCT', xb.flatMap(p => p.dong)),
    ...lenhThem(env.DB, 'NhapKho', nk.map(p => p.phieu)), ...lenhThem(env.DB, 'NhapKhoCT', nk.flatMap(p => p.dong)),
    ...lenhThem(env.DB, 'SoQuy', cacPhieu.map(p => p.quy).filter(Boolean))
  ];
  if (maHHs.length) lenh.push(lenhTinhLaiTon(env.DB, maHHs));
  if (lenh.length) await env.DB.batch(lenh);
  if (maHHs.length) await tinhLaiGiaVon(env, maHHs);
  return maHHs;
}

async function canhBaoTonAm(env, maHHs) {
  if (!maHHs.length) return [];
  const rows = await allRaw(env, `SELECT "TenHH","TonKho" FROM "HangHoa" WHERE "Loai"='HangHoa' AND "TonKho" < 0 AND "MaHH" IN (SELECT value FROM json_each(?1))`, JSON.stringify(maHHs));
  return rows.map(h => ({ tenHH: h.TenHH, tonKho: Number(h.TonKho) }));
}

async function importChiTietBKMVBR(env, invoices, user) {
  if (!invoices || !invoices.length) throw loi('KHONG_CO_DU_LIEU');
  if (invoices.length > MAX_HOA_DON_MOI_LO) throw loi(`LO_QUA_LON: tối đa ${MAX_HOA_DON_MOI_LO} hoá đơn mỗi lần gửi`);
  const sorted = invoices.slice().sort((a, b) => String(a.ngay || '').localeCompare(String(b.ngay || '')));
  // So trùng theo số HĐ đã chuẩn hoá (bỏ số 0 đầu) — tìm cả phiếu nhập tay trước đó ghi "1794" khi bảng kê ghi "00001794"
  const soHDs = duyNhat(sorted.map(i => chuanHoaSoHD(i.soHD).replace(/^0+/, '')));
  const [xbCo, nkCo] = await env.DB.batch([
    env.DB.prepare(`SELECT "SoHDDT","MSTKhachHang","Ngay" FROM "XuatBan" WHERE ${SQL_SO_HD_CHUAN('"SoHDDT"')} IN (SELECT value FROM json_each(?1))`).bind(JSON.stringify(soHDs)),
    env.DB.prepare(`SELECT n."SoHDMuaVao", n."Ngay", c."MST" FROM "NhapKho" n LEFT JOIN "NhaCungCap" c ON c."MaNCC" = n."MaNCC" WHERE ${SQL_SO_HD_CHUAN('n."SoHDMuaVao"')} IN (SELECT value FROM json_each(?1))`).bind(JSON.stringify(soHDs))
  ]);
  const keyXuat = new Set(xbCo.results.map(r => khoaHoaDon(r.SoHDDT, r.MSTKhachHang, r.Ngay)));
  const keyNhap = new Set(nkCo.results.map(r => khoaHoaDon(r.SoHDMuaVao, r.MST, r.Ngay)));
  const nap = await napDoiTac(env);
  const bo = taoBoTimHoacTao(nap);
  const moPhong = {};
  const cacPhieu = [];
  let daTonTai = 0; const loiDs = []; const canhBaoDonVi = []; const dsDaTonTai = [];
  for (const inv of sorted) {
    if (inv.loai !== 'xuat' && inv.loai !== 'nhap') { loiDs.push({ soHD: inv.soHD, error: 'LOAI_KHONG_HOP_LE: hoá đơn không xác định được là mua vào hay bán ra, đã bỏ qua' }); continue; }
    if (chuanHoaMST(inv.mst) === chuanHoaMST(MST_CONG_TY)) { loiDs.push({ soHD: inv.soHD, error: `MST_TRUNG_CONG_TY: MST đối tác trùng với MST công ty (${MST_CONG_TY}) - dữ liệu có vấn đề, đã bỏ qua` }); continue; }
    const key = khoaHoaDon(inv.soHD, inv.mst, inv.ngay);
    if ((inv.loai === 'xuat' ? keyXuat : keyNhap).has(key)) { daTonTai++; dsDaTonTai.push({ soHD: inv.soHD, ngay: inv.ngay, doiTac: inv.tenDoiTac || '' }); continue; }
    if (!inv.items || !inv.items.length) { loiDs.push({ soHD: inv.soHD, error: 'KHONG_CO_MAT_HANG' }); continue; }
    const them = { diaChi: inv.diaChiDoiTac, sdt: inv.sdtDoiTac, email: inv.emailDoiTac };
    const dongVao = inv.items.map(it => {
      const hh = bo.hangHoa(it.tenHang, it.dvt, it.loaiHangHoa, inv.loai === 'xuat' ? it.donGia : undefined, 'Tạo tự động khi nhập chi tiết bảng kê BKMV/BKBR');
      // ĐVT trên hoá đơn trùng "Đơn vị nhập lớn" của mặt hàng (VD hoá đơn ghi Cuộn, danh mục 1 Cuộn = 100 Mét)
      // -> tự nhân hệ số. Trước đây bỏ qua ĐVT hoá đơn nên 1 Cuộn bị ghi thành 1 Mét.
      const dvtHD = String(it.dvt || '').trim();
      const coDonViLon = hh.Loai === 'HangHoa' && hh.DVTNhap && Number(hh.HeSoQuyDoi) > 0;
      const laDonViLon = !!(coDonViLon && dvtHD && chuanHoaTen(dvtHD) === chuanHoaTen(hh.DVTNhap));
      if (coDonViLon && dvtHD && !laDonViLon && chuanHoaTen(dvtHD) !== chuanHoaTen(hh.DVT)) {
        canhBaoDonVi.push({ soHD: inv.soHD, tenHH: hh.TenHH, dvtHoaDon: dvtHD, dvt: hh.DVT, dvtNhap: hh.DVTNhap });
      }
      return { item: { MaHH: hh.MaHH, TenHH: it.tenHang, SoLuong: it.soLuong, DonGia: it.donGia, ThueSuat: it.thueSuat,
        DVT: dvtHD, DonViDaChon: laDonViLon ? 'nhap' : 'goc' }, hh };
    });
    const chung = { Ngay: inv.ngay, SoHD: inv.soHD, KyHieu: inv.kyHieu || '', MST: inv.mst, daThanhToanDu: !!inv.daThanhToanDu };
    if (inv.loai === 'xuat') {
      cacPhieu.push(dungPhieuLo('xuat', { ...chung, MaKH: bo.kh(inv.mst, inv.tenDoiTac, them), TenKH: inv.tenDoiTac, GhiChu: 'Nhập chi tiết từ bảng kê BKBR' }, dongVao, user, moPhong));
      keyXuat.add(key);
    } else {
      cacPhieu.push(dungPhieuLo('nhap', { ...chung, MaNCC: bo.ncc(inv.mst, inv.tenDoiTac, them), TenNCC: inv.tenDoiTac, GhiChu: 'Nhập chi tiết từ bảng kê BKMV' }, dongVao, user, moPhong));
      keyNhap.add(key);
    }
  }
  const maHHs = await ghiLo(env, bo, cacPhieu);
  return { thanhCong: cacPhieu.length, daTonTai, dsDaTonTai, tongSo: invoices.length, loi: loiDs, canhBaoTonKhoAm: await canhBaoTonAm(env, maHHs), canhBaoDonVi };
}

async function importLichSuTuBangKe(env, items, user) {
  if (!items || !items.length) throw loi('KHONG_CO_DU_LIEU');
  if (items.length > MAX_HOA_DON_MOI_LO) throw loi(`LO_QUA_LON: tối đa ${MAX_HOA_DON_MOI_LO} hoá đơn mỗi lần gửi`);
  const nap = await napDoiTac(env);
  const bo = taoBoTimHoacTao(nap);
  // Hàng hoá giữ chỗ cho dữ liệu lịch sử chưa tách chi tiết (giống ensurePlaceholderHangHoa của Code.gs)
  let placeholder = bo.hhTheoMa('HH-LICHSU');
  if (!placeholder) {
    placeholder = { MaHH: 'HH-LICHSU', TenHH: 'Hàng hoá/dịch vụ theo hoá đơn (dữ liệu lịch sử, chưa tách chi tiết)', Loai: 'DichVu', DVT: 'lần',
      GiaVonTB: 0, GiaBan: 0, TonKho: 0, TonKhoToiThieu: 0, GhiChu: 'Tạo tự động khi nhập dữ liệu lịch sử từ bảng kê Excel — bổ sung chi tiết thật sau bằng XML nếu cần',
      NgayTao: homNayVN(), DVTNhap: '', HeSoQuyDoi: 0 };
    nap.hh.push(placeholder); bo.hhMoi.push(placeholder);
  }
  const moPhong = {}; const cacPhieu = []; const loiDs = [];
  for (const it of items) {
    try {
      const dongVao = [{ item: { MaHH: 'HH-LICHSU', TenHH: 'Hàng hoá/dịch vụ theo hoá đơn (dữ liệu lịch sử)', SoLuong: 1, DonGia: Number(it.TongTien) || 0 }, hh: placeholder }];
      const chung = { Ngay: it.Ngay, SoHD: it.SoHDDT, KyHieu: it.KyHieuHD, MST: it.MST, daThanhToanDu: !!it.daThanhToanDu, GhiChu: 'Nhập từ dữ liệu lịch sử (bảng kê Excel)' };
      if (it.loai === 'xuat') cacPhieu.push(dungPhieuLo('xuat', { ...chung, MaKH: bo.kh(it.MST, it.TenDoiTac), TenKH: it.TenDoiTac }, dongVao, user, moPhong));
      else cacPhieu.push(dungPhieuLo('nhap', { ...chung, MaNCC: bo.ncc(it.MST, it.TenDoiTac), TenNCC: it.TenDoiTac }, dongVao, user, moPhong));
    } catch (e) { loiDs.push({ soHD: it.SoHDDT, doiTac: it.TenDoiTac, error: e.message }); }
  }
  await ghiLo(env, bo, cacPhieu);
  return { thanhCong: cacPhieu.length, tongSo: items.length, loi: loiDs };
}

// ================== DASHBOARD & BÁO CÁO ==================
const TRUOC_THUE = `COALESCE("TongTienTruocThue","TongTien",0)`;
const GC_TRUOC_THUE = `COALESCE("ChiPhiGiaCongTruocThue","ChiPhiGiaCong",0)`;

async function getDashboard(env) {
  const thang = thangVN();
  const db = env.DB;
  const r = await db.batch([
    db.prepare(`SELECT COALESCE(SUM(${TRUOC_THUE}),0) v, COUNT(*) n FROM "XuatBan" WHERE substr("Ngay",1,7) = ?1`).bind(thang),
    db.prepare(`SELECT COALESCE(SUM(${TRUOC_THUE}),0) v FROM "SuaChua" WHERE substr("Ngay",1,7) = ?1`).bind(thang),
    db.prepare(`SELECT COALESCE(SUM(${TRUOC_THUE}),0) v FROM "NhapKho" WHERE substr("Ngay",1,7) = ?1`).bind(thang),
    // Phải thu gồm cả "Nhận gia công cho khách" (bản GAS quên phần này nên số Tổng quan lệch với tab Công nợ)
    db.prepare(`SELECT (SELECT COALESCE(SUM(COALESCE("TongTien",0) - COALESCE("DaThu",0)),0) FROM "XuatBan")
                     + (SELECT COALESCE(SUM(COALESCE("TongTien",0) - COALESCE("DaThu",0)),0) FROM "SuaChua")
                     + (SELECT COALESCE(SUM(COALESCE("ChiPhiGiaCong",0) - COALESCE("DaThu",0)),0) FROM "GiaCong" WHERE "Loai" = 'NhanGiaCongChoKhach') v`),
    db.prepare(`SELECT (SELECT COALESCE(SUM(COALESCE("TongTien",0) - COALESCE("DaTra",0)),0) FROM "NhapKho")
                     + (SELECT COALESCE(SUM(COALESCE("ChiPhiGiaCong",0) - COALESCE("DaTra",0)),0) FROM "GiaCong" WHERE "Loai" = 'ThueNgoaiGiaCong') v`),
    db.prepare(`SELECT * FROM "HangHoa" WHERE "Loai" = 'HangHoa' AND COALESCE("TonKho",0) <= COALESCE("TonKhoToiThieu",0) ORDER BY rowid`),
    db.prepare(`SELECT COALESCE(SUM("Loai" = 'HangHoa'),0) hh, COALESCE(SUM("Loai" = 'DichVu'),0) dv FROM "HangHoa"`),
    db.prepare(`SELECT (SELECT COUNT(*) FROM "XuatBan" WHERE COALESCE("TrangThaiHD",'') <> 'DaXuat')
                     + (SELECT COUNT(*) FROM "SuaChua" WHERE COALESCE("TrangThaiHD",'') <> 'DaXuat' AND "TrangThai" = 'DaGiaoTra') v`),
    db.prepare(`SELECT COUNT(*) v FROM "SuaChua" WHERE "TrangThai" IN ('TiepNhan','DangSua','ChoLinhKien')`),
    db.prepare(`SELECT COUNT(*) v FROM "GiaCong" WHERE "TrangThai" IN ('TiepNhan','DangGiaCong')`)
  ]);
  const v = i => Number(r[i].results[0].v) || 0;
  return {
    doanhThuThangNay: v(0) + v(1), nhapKhoThangNay: v(2), congNoPhaiThu: v(3), congNoPhaiTra: v(4),
    soLuongHangHoa: Number(r[6].results[0].hh) || 0, soLuongDichVu: Number(r[6].results[0].dv) || 0,
    hangSapHet: r[5].results.map(chuanHoaDong), soHoaDonChuaXuat: v(7),
    soPhieuXuatThangNay: Number(r[0].results[0].n) || 0, suaChuaDangXuLy: v(8), giaCongDangXuLy: v(9)
  };
}

async function getBaoCaoDoanhThu(env, tuNgay, denNgay) {
  tuNgay = tuNgay || ''; denNgay = denNgay || '9999-12-31';
  const db = env.DB;
  const trongKy = `"Ngay" >= ?1 AND "Ngay" <= ?2`;
  const r = await db.batch([
    db.prepare(`SELECT COALESCE(SUM(${TRUOC_THUE}),0) dt, COALESCE(SUM("TongTienThue"),0) thue, COUNT(*) n FROM "XuatBan" WHERE ${trongKy}`).bind(tuNgay, denNgay),
    // Giá vốn = số lượng ĐÃ QUY ĐỔI x giá vốn/đơn vị chính (bản GAS nhân SoLuong gốc -> sai khi bán theo Cuộn)
    db.prepare(`SELECT COALESCE(SUM(COALESCE(c."SoLuongQuyDoi", c."SoLuong", 0) * COALESCE(c."GiaVon",0)),0) v
                FROM "XuatBanCT" c JOIN "XuatBan" h ON h."IDPhieu" = c."IDPhieu" WHERE h."Ngay" >= ?1 AND h."Ngay" <= ?2`).bind(tuNgay, denNgay),
    db.prepare(`SELECT COALESCE(SUM(${TRUOC_THUE}),0) dt, COALESCE(SUM("TongTienThue"),0) thue, COUNT(*) n FROM "SuaChua" WHERE ${trongKy}`).bind(tuNgay, denNgay),
    db.prepare(`SELECT COALESCE(SUM(CASE WHEN "Loai"='NhanGiaCongChoKhach' THEN ${GC_TRUOC_THUE} END),0) thu,
                       COALESCE(SUM(CASE WHEN "Loai"='ThueNgoaiGiaCong' THEN ${GC_TRUOC_THUE} END),0) tra,
                       COALESCE(SUM(CASE WHEN "Loai"='NhanGiaCongChoKhach' THEN COALESCE("TienThueGiaCong",0) END),0) thueRa,
                       COALESCE(SUM(CASE WHEN "Loai"='ThueNgoaiGiaCong' THEN COALESCE("TienThueGiaCong",0) END),0) thueVao,
                       COUNT(*) n FROM "GiaCong" WHERE ${trongKy}`).bind(tuNgay, denNgay),
    db.prepare(`SELECT COALESCE(SUM(${TRUOC_THUE}),0) v, COALESCE(SUM("TongTienThue"),0) thue, COUNT(*) n FROM "NhapKho" WHERE ${trongKy}`).bind(tuNgay, denNgay),
    db.prepare(`SELECT c."TenHH" ten, SUM(COALESCE(c."SoLuongQuyDoi", c."SoLuong", 0)) soLuong, SUM(COALESCE(c."ThanhTien",0)) doanhThu,
                       COALESCE(MAX(NULLIF(hh."DVT",'')), MAX(NULLIF(c."DVT",'')), '') dvt
                FROM "XuatBanCT" c JOIN "XuatBan" h ON h."IDPhieu" = c."IDPhieu" LEFT JOIN "HangHoa" hh ON hh."MaHH" = c."MaHH"
                WHERE h."Ngay" >= ?1 AND h."Ngay" <= ?2 GROUP BY c."TenHH" ORDER BY doanhThu DESC LIMIT 10`).bind(tuNgay, denNgay),
    db.prepare(`SELECT ten, SUM(tien) doanhThu, COUNT(*) soLanMua FROM (
                  SELECT COALESCE(NULLIF("TenKH",''),'Khách lẻ') ten, ${TRUOC_THUE} tien FROM "XuatBan" WHERE ${trongKy}
                  UNION ALL SELECT COALESCE(NULLIF("TenKH",''),'Khách lẻ'), ${TRUOC_THUE} FROM "SuaChua" WHERE ${trongKy}
                  UNION ALL SELECT COALESCE(NULLIF("TenDoiTac",''),'Khách lẻ'), ${GC_TRUOC_THUE} FROM "GiaCong" WHERE "Loai"='NhanGiaCongChoKhach' AND ${trongKy}
                ) GROUP BY ten ORDER BY doanhThu DESC LIMIT 10`).bind(tuNgay, denNgay)
  ]);
  const g = (i, k) => Number(r[i].results[0][k]) || 0;
  const doanhThuBanHang = g(0, 'dt'), giaVonBanHang = g(1, 'v'), doanhThuSuaChua = g(2, 'dt');
  const doanhThuGiaCongThu = g(3, 'thu'), chiPhiGiaCongTra = g(3, 'tra');
  const doanhThu = doanhThuBanHang + doanhThuSuaChua + doanhThuGiaCongThu;
  const loiNhuanGop = doanhThu - (giaVonBanHang + chiPhiGiaCongTra);
  return {
    doanhThu, doanhThuBanHang, doanhThuSuaChua, doanhThuGiaCongThu,
    giaVonBanHang, chiPhiGiaCongTra, loiNhuanGop, tongNhap: g(4, 'v'),
    thueDauRa: g(0, 'thue') + g(2, 'thue') + g(3, 'thueRa'),
    thueDauVao: g(4, 'thue') + g(3, 'thueVao'),
    soPhieuXuat: g(0, 'n'), soPhieuNhap: g(4, 'n'), soPhieuSuaChua: g(2, 'n'), soPhieuGiaCong: g(3, 'n'),
    topBanChay: r[5].results.map(x => ({ ten: x.ten == null ? '' : x.ten, soLuong: Math.round((Number(x.soLuong) || 0) * 10000) / 10000, doanhThu: Number(x.doanhThu) || 0, dvt: x.dvt || '' })),
    topKhachHang: r[6].results.map(x => ({ ten: x.ten, doanhThu: Number(x.doanhThu) || 0, soLanMua: Number(x.soLanMua) || 0 }))
  };
}

async function getSoSanhThangHienTai(env) {
  const thangNay = thangVN(0), thangTruoc = thangVN(-1);
  const tinhThang = async thang => {
    const db = env.DB;
    const r = await db.batch([
      db.prepare(`SELECT COALESCE(SUM(${TRUOC_THUE}),0) v, COUNT(*) n FROM "XuatBan" WHERE substr("Ngay",1,7) = ?1`).bind(thang),
      db.prepare(`SELECT COALESCE(SUM(${TRUOC_THUE}),0) v FROM "SuaChua" WHERE substr("Ngay",1,7) = ?1`).bind(thang),
      db.prepare(`SELECT COALESCE(SUM(CASE WHEN "Loai"='NhanGiaCongChoKhach' THEN ${GC_TRUOC_THUE} END),0) thu,
                         COALESCE(SUM(CASE WHEN "Loai"='ThueNgoaiGiaCong' THEN ${GC_TRUOC_THUE} END),0) tra FROM "GiaCong" WHERE substr("Ngay",1,7) = ?1`).bind(thang),
      db.prepare(`SELECT COALESCE(SUM(COALESCE(c."SoLuongQuyDoi", c."SoLuong", 0) * COALESCE(c."GiaVon",0)),0) v
                  FROM "XuatBanCT" c JOIN "XuatBan" h ON h."IDPhieu" = c."IDPhieu" WHERE substr(h."Ngay",1,7) = ?1`).bind(thang)
    ]);
    const doanhThu = (Number(r[0].results[0].v) || 0) + (Number(r[1].results[0].v) || 0) + (Number(r[2].results[0].thu) || 0);
    const giaVon = (Number(r[3].results[0].v) || 0) + (Number(r[2].results[0].tra) || 0);
    return { doanhThu, loiNhuan: doanhThu - giaVon, soPhieuXuat: Number(r[0].results[0].n) || 0 };
  };
  const tinhPhanTram = (hienTai, truoc) => truoc === 0 ? (hienTai > 0 ? 100 : 0) : Math.round(((hienTai - truoc) / Math.abs(truoc)) * 100);
  const [a, b] = await Promise.all([tinhThang(thangNay), tinhThang(thangTruoc)]);
  return {
    thangNay: { nhan: thangNay, ...a }, thangTruoc: { nhan: thangTruoc, ...b },
    phanTramDoanhThu: tinhPhanTram(a.doanhThu, b.doanhThu), phanTramLoiNhuan: tinhPhanTram(a.loiNhuan, b.loiNhuan)
  };
}

async function getCongNo(env) {
  const db = env.DB;
  const [thu, tra] = await db.batch([
    db.prepare(`SELECT "IDPhieu" idPhieu, 'Bán hàng' loai, "Ngay" ngay, COALESCE(NULLIF("TenKH",''),'Khách lẻ') doiTac, COALESCE("TongTien",0) tongTien, COALESCE("DaThu",0) daNhan
                  FROM "XuatBan" WHERE COALESCE("TongTien",0) - COALESCE("DaThu",0) > 0
                UNION ALL SELECT "IDPhieu", 'Sửa chữa', "Ngay", COALESCE(NULLIF("TenKH",''),'Khách lẻ'), COALESCE("TongTien",0), COALESCE("DaThu",0)
                  FROM "SuaChua" WHERE COALESCE("TongTien",0) - COALESCE("DaThu",0) > 0
                UNION ALL SELECT "IDPhieu", 'Gia công', "Ngay", COALESCE("TenDoiTac",''), COALESCE("ChiPhiGiaCong",0), COALESCE("DaThu",0)
                  FROM "GiaCong" WHERE "Loai" = 'NhanGiaCongChoKhach' AND COALESCE("ChiPhiGiaCong",0) - COALESCE("DaThu",0) > 0`),
    db.prepare(`SELECT "IDPhieu" idPhieu, 'Nhập kho' loai, "Ngay" ngay, COALESCE("TenNCC",'') doiTac, COALESCE("TongTien",0) tongTien, COALESCE("DaTra",0) daTra
                  FROM "NhapKho" WHERE COALESCE("TongTien",0) - COALESCE("DaTra",0) > 0
                UNION ALL SELECT "IDPhieu", 'Thuê gia công', "Ngay", COALESCE("TenDoiTac",''), COALESCE("ChiPhiGiaCong",0), COALESCE("DaTra",0)
                  FROM "GiaCong" WHERE "Loai" = 'ThueNgoaiGiaCong' AND COALESCE("ChiPhiGiaCong",0) - COALESCE("DaTra",0) > 0`)
  ]);
  const phaiThu = thu.results.map(x => ({ ...chuanHoaDong(x), conNo: x.tongTien - x.daNhan })).filter(x => x.conNo > 0);
  const phaiTra = tra.results.map(x => ({ ...chuanHoaDong(x), conNo: x.tongTien - x.daTra })).filter(x => x.conNo > 0);
  return { phaiThu, phaiTra };
}

async function getCongNoTheoDoiTac(env) {
  const { phaiThu, phaiTra } = await getCongNo(env);
  const gomNhom = list => {
    const map = {};
    list.forEach(item => {
      const ten = item.doiTac || 'Không rõ';
      if (!map[ten]) map[ten] = { ten, tongNo: 0, soLanNo: 0 };
      map[ten].tongNo += item.conNo; map[ten].soLanNo += 1;
    });
    return Object.values(map).sort((a, b) => b.tongNo - a.tongNo);
  };
  return { phaiThuTheoKH: gomNhom(phaiThu), phaiTraTheoNCC: gomNhom(phaiTra) };
}

// ================== SỔ QUỸ ==================
const NHOM_MUC_THU = ['BanHang', 'SuaChua', 'GiaCong', 'ThuKhac'];
const NHOM_MUC_CHI = ['MuaHang', 'Luong', 'ThueMatBang', 'DienNuoc', 'HoaHong', 'ChiKhac'];

async function getSoQuyList(env, tuNgay, denNgay, loai, phuongThuc) {
  const dk = [], p = [];
  if (tuNgay) { p.push(tuNgay); dk.push(`"Ngay" >= ?${p.length}`); }
  if (denNgay) { p.push(denNgay); dk.push(`"Ngay" <= ?${p.length}`); }
  if (loai) { p.push(loai); dk.push(`"Loai" = ?${p.length}`); }
  if (phuongThuc) { p.push(phuongThuc); dk.push(`"PhuongThuc" = ?${p.length}`); }
  return all(env, `SELECT * FROM "SoQuy" ${dk.length ? 'WHERE ' + dk.join(' AND ') : ''} ORDER BY "Timestamp" DESC, rowid DESC`, ...p);
}
async function saveThuChiTuDo(env, data, user) {
  data = data || {};
  if (!['Thu', 'Chi'].includes(data.Loai)) throw loi('LOAI_KHONG_HOP_LE');
  if (!data.SoTien || Number(data.SoTien) <= 0) throw loi('SO_TIEN_KHONG_HOP_LE');
  const ds = data.Loai === 'Thu' ? NHOM_MUC_THU : NHOM_MUC_CHI;
  const nhomMuc = ds.includes(data.NhomMuc) ? data.NhomMuc : (data.Loai === 'Thu' ? 'ThuKhac' : 'ChiKhac');
  const phieu = banGhiSoQuy(data.Loai, nhomMuc, Number(data.SoTien), data.PhuongThuc, 'TuDo', data.MoTa || '', user.TenDangNhap, data.Ngay);
  await env.DB.batch(lenhThem(env.DB, 'SoQuy', [phieu]));
  return { idPhieu: phieu.IDPhieu, phieu };
}
async function xoaThuChiTuDo(env, idPhieu) {
  const found = await first(env, `SELECT "NguonGoc" FROM "SoQuy" WHERE "IDPhieu" = ?1`, idPhieu);
  if (!found) throw loi('KHONG_TIM_THAY');
  if (found.NguonGoc !== 'TuDo') throw loi('CHI_XOA_DUOC_KHOAN_TU_DO');
  await run(env, `DELETE FROM "SoQuy" WHERE "IDPhieu" = ?1`, idPhieu);
  return { deleted: true };
}
async function getSoDuQuy(env) {
  const rows = await allRaw(env, `SELECT "PhuongThuc" pt, "Loai" loai, COALESCE(SUM("SoTien"),0) tong FROM "SoQuy" GROUP BY "PhuongThuc","Loai"`);
  const cfg = await docConfig(env);
  const gop = (pt, key) => {
    const thu = rows.filter(r => r.pt === pt && r.loai === 'Thu').reduce((s, r) => s + (Number(r.tong) || 0), 0);
    const chi = rows.filter(r => r.pt === pt && r.loai === 'Chi').reduce((s, r) => s + (Number(r.tong) || 0), 0);
    const soDuDauKy = Number(cfg[key]) || 0;
    return { thu, chi, soDuDauKy, soDu: soDuDauKy + thu - chi };
  };
  return { tienMat: gop('TienMat', 'SoDuTienMatDauKy'), chuyenKhoan: gop('ChuyenKhoan', 'SoDuChuyenKhoanDauKy'), the: gop('The', 'SoDuTheDauKy') };
}
async function capNhatSoDuDauKy(env, data) {
  data = data || {};
  const lenh = [];
  if (data.TienMat != null) lenh.push(lenhGhiConfig(env, 'SoDuTienMatDauKy', Number(data.TienMat) || 0));
  if (data.ChuyenKhoan != null) lenh.push(lenhGhiConfig(env, 'SoDuChuyenKhoanDauKy', Number(data.ChuyenKhoan) || 0));
  if (data.The != null) lenh.push(lenhGhiConfig(env, 'SoDuTheDauKy', Number(data.The) || 0));
  if (lenh.length) await env.DB.batch(lenh);
  return { updated: true };
}

// ================== CẤU HÌNH THANH TOÁN / SEPAY ==================
async function getThongTinNganHangCoBan(env) {
  const c = await docConfig(env);
  return { bankBin: c.BankBin || '', bankAccountNumber: c.BankAccountNumber || '', bankAccountName: c.BankAccountName || '' };
}
async function getCauHinhThanhToan(env, origin) {
  const c = await docConfig(env);
  let webhookSecret = c.SePayWebhookSecret;
  if (!webhookSecret) { webhookSecret = crypto.randomUUID(); await lenhGhiConfig(env, 'SePayWebhookSecret', webhookSecret).run(); }
  return {
    bankBin: c.BankBin || '', bankAccountNumber: c.BankAccountNumber || '', bankAccountName: c.BankAccountName || '',
    webhookSecret, webhookUrl: `${origin}/webhook/sepay?secret=${encodeURIComponent(webhookSecret)}`
  };
}
async function capNhatCauHinhThanhToan(env, data) {
  data = data || {};
  const lenh = [];
  if (data.bankBin != null) lenh.push(lenhGhiConfig(env, 'BankBin', data.bankBin));
  if (data.bankAccountNumber != null) lenh.push(lenhGhiConfig(env, 'BankAccountNumber', data.bankAccountNumber));
  if (data.bankAccountName != null) lenh.push(lenhGhiConfig(env, 'BankAccountName', data.bankAccountName));
  if (lenh.length) await env.DB.batch(lenh);
  return { updated: true };
}

// Webhook SePay gọi THẲNG vào Worker (không cần Worker trung gian như bản GAS). Xác thực bằng mã bí mật
// gắn cuối URL (?secret=...) như cũ, hoặc header "Authorization: Apikey <mã>" theo chuẩn SePay.
async function xuLyWebhookSePay(env, request, url, body) {
  const cfg = await docConfig(env);
  const secret = cfg.SePayWebhookSecret || '';
  const auth = request.headers.get('Authorization') || '';
  const gui = url.searchParams.get('secret') || auth.replace(/^Apikey\s+/i, '').trim();
  if (!secret || !gui || !soSanhDeu(gui, secret)) return { status: 401, body: { success: false, error: 'SAI_MA_BI_MAT_WEBHOOK' } };
  if (body.transferType !== 'in') return { status: 200, body: { success: true, ghiChu: 'Bỏ qua vì đây là giao dịch tiền ra, không phải tiền vào.' } };
  const noiDung = String(body.content || body.description || '');
  const soTien = Number(body.transferAmount) || 0;
  if (soTien <= 0) return { status: 200, body: { success: true, ghiChu: 'Số tiền không hợp lệ, bỏ qua.' } };
  const maGD = String(body.id != null ? body.id : (body.referenceCode || '')).trim();
  const noiDungChuan = noiDung.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const nguon = [
    { bang: 'XuatBan', sql: `SELECT "IDPhieu" FROM "XuatBan" WHERE instr(?1, upper("IDPhieu")) > 0 LIMIT 1` },
    { bang: 'SuaChua', sql: `SELECT "IDPhieu" FROM "SuaChua" WHERE instr(?1, upper("IDPhieu")) > 0 LIMIT 1` },
    { bang: 'GiaCong', sql: `SELECT "IDPhieu" FROM "GiaCong" WHERE "Loai" = 'NhanGiaCongChoKhach' AND instr(?1, upper("IDPhieu")) > 0 LIMIT 1` }
  ];
  let khop = null;
  if (noiDungChuan) {
    const kq = await env.DB.batch(nguon.map(n => env.DB.prepare(n.sql).bind(noiDungChuan)));
    for (let i = 0; i < nguon.length; i++) if (kq[i].results.length) { khop = { bang: nguon[i].bang, idPhieu: kq[i].results[0].IDPhieu }; break; }
  }
  const lenhGD = maGD ? lenhThem(env.DB, 'SePayGiaoDich', [{
    MaGiaoDich: maGD, ThoiGian: body.transactionDate || '', SoTien: soTien, NoiDung: noiDung,
    IDPhieu: khop ? khop.idPhieu : '', KetQua: khop ? 'KHOP' : 'CHUA_KHOP', Timestamp: bayGio()
  }]) : [];
  try {
    if (khop) {
      await capNhatThanhToan(env, khop.bang, 'DaThu', khop.idPhieu, soTien, 'ChuyenKhoan', 'SePayWebhook',
        [...lenhGD, lenhNhatKy(env, 'SePayWebhook', 'sepayKhopTuDong', `${khop.bang}:${khop.idPhieu} +${soTien}`)]);
      return { status: 200, body: { success: true, ketQua: { khop: true, idPhieu: khop.idPhieu, sheet: khop.bang } } };
    }
    const quy = banGhiSoQuy('Thu', 'ThuKhac', soTien, 'ChuyenKhoan', 'TuDo', `[Chưa khớp tự động] ${noiDung}`, 'SePayWebhook');
    await env.DB.batch([...lenhGD, ...lenhThem(env.DB, 'SoQuy', [quy])]);
    return { status: 200, body: { success: true, ketQua: { khop: false, ghiChu: 'Không tìm thấy mã phiếu trong nội dung chuyển khoản — đã ghi tạm vào Sổ quỹ để đối chiếu thủ công.' } } };
  } catch (e) {
    // Trùng mã giao dịch -> cả giao dịch bị huỷ (không cộng tiền lần 2), trả thành công để SePay thôi gửi lại.
    if (/UNIQUE/i.test(String(e.message)) && maGD) return { status: 200, body: { success: true, ghiChu: 'Giao dịch đã được xử lý trước đó, bỏ qua (chống ghi trùng).' } };
    throw e;
  }
}

// ================== XUẤT EXCEL (thay cho việc mở Google Sheet xem) ==================
const BANG_XUAT = ['Config', 'NguoiDung', 'HangHoa', 'NhaCungCap', 'KhachHang', 'NhapKho', 'NhapKhoCT', 'XuatBan', 'XuatBanCT',
  'SuaChua', 'SuaChuaCT', 'GiaCong', 'GiaCongCT', 'SoQuy', 'NhatKyHoatDong', 'DieuChinhKho', 'SePayGiaoDich'];
async function exportTable(env, bang, offset) {
  if (!BANG_XUAT.includes(bang)) throw loi('BANG_KHONG_HOP_LE');
  const def = SCHEMA[bang];
  let cols = [...(def.auto ? [def.auto] : []), ...Object.keys(def.cols)];
  if (bang === 'NguoiDung') cols = cols.filter(c => !['MatKhauHash', 'SoLanSai', 'KhoaDenLuc'].includes(c));
  const gioiHan = 1000, tu = Math.max(0, Number(offset) || 0);
  const rows = await all(env, `SELECT ${cols.map(c => `"${c}"`).join(',')} FROM "${bang}" ORDER BY rowid LIMIT ?1 OFFSET ?2`, gioiHan + 1, tu);
  return { cols, rows: rows.slice(0, gioiHan), conTiep: rows.length > gioiHan };
}

// ================== CHUYỂN DỮ LIỆU TỪ GOOGLE SHEET (chỉ bật khi có biến bí mật MIGRATE_KEY) ==================
const BANG_CHUYEN = ['Config', 'NguoiDung', 'HangHoa', 'NhaCungCap', 'KhachHang', 'NhapKho', 'NhapKhoCT', 'XuatBan', 'XuatBanCT',
  'SuaChua', 'SuaChuaCT', 'GiaCong', 'GiaCongCT', 'SoQuy', 'NhatKyHoatDong'];
const BANG_DU_LIEU = [...BANG_CHUYEN, 'DieuChinhKho', 'SePayGiaoDich', 'Phien'];

async function xuLyChuyenDuLieu(env, action, p) {
  const khoa = env.MIGRATE_KEY || '';
  if (khoa.length < 12) throw loi('CHUC_NANG_CHUYEN_DU_LIEU_DANG_TAT: chưa đặt biến bí mật MIGRATE_KEY (tối thiểu 12 ký tự) cho Worker');
  if (typeof p.key !== 'string' || !soSanhDeu(p.key, khoa)) throw loi('SAI_MA_CHUYEN_DU_LIEU');
  const db = env.DB;
  switch (action) {
    case 'migrate.initSchema': {
      await db.batch(schemaStatements().map(s => db.prepare(s)));
      return { ok: true, soLenh: schemaStatements().length };
    }
    case 'migrate.status': {
      const kq = await db.batch(BANG_DU_LIEU.map(b => db.prepare(`SELECT COUNT(*) n FROM "${b}"`)));
      const dem = {}; BANG_DU_LIEU.forEach((b, i) => { dem[b] = Number(kq[i].results[0].n) || 0; });
      return { dem };
    }
    case 'migrate.reset': {
      if (p.xacNhan !== 'XOA_HET') throw loi('THIEU_XAC_NHAN');
      await db.batch(BANG_DU_LIEU.map(b => db.prepare(`DELETE FROM "${b}"`)));
      return { ok: true };
    }
    case 'migrate.insert': {
      const bang = p.table;
      if (!BANG_CHUYEN.includes(bang)) throw loi('BANG_KHONG_HOP_LE');
      const rows = Array.isArray(p.rows) ? p.rows : [];
      if (!rows.length) return { inserted: 0 };
      const cols = colsOf(bang);
      const lenh = lenhThem(db, bang, rows, cols);
      if (lenh.length > 40) throw loi('LO_QUA_LON');
      await db.batch(lenh);
      return { inserted: rows.length };
    }
    case 'migrate.finalize': {
      // Tính lại tồn kho + giá vốn TỪ SỔ cho 1 lô mặt hàng, sau khi đã chèn thêm các dòng điều chỉnh
      // (chỉ những mặt hàng anh chọn "giữ số tồn trên Sheet").
      const maHHs = duyNhat(p.maHHs || []);
      if (maHHs.length > 300) throw loi('LO_QUA_LON');
      const dc = (p.dieuChinh || []).filter(d => d && d.MaHH && Number(d.SoLuongQuyDoi));
      const lenh = [];
      if (dc.length) lenh.push(...lenhThem(db, 'DieuChinhKho', dc.map(d => ({
        MaHH: d.MaHH, Ngay: p.ngay || homNayVN(), SoLuongQuyDoi: Number(d.SoLuongQuyDoi), DonGiaQuyDoi: d.DonGiaQuyDoi,
        LyDo: 'Điều chỉnh khi chuyển từ Google Sheet: giữ đúng số tồn đang có trên Sheet', NguoiTao: 'ChuyenDuLieu', Timestamp: bayGio()
      }))));
      if (maHHs.length) lenh.push(lenhTinhLaiTon(db, maHHs));
      if (lenh.length) await db.batch(lenh);
      await tinhLaiGiaVon(env, maHHs);
      return { hangHoa: await allRaw(env, `SELECT "MaHH","TonKho","GiaVonTB" FROM "HangHoa" WHERE "MaHH" IN (SELECT value FROM json_each(?1))`, JSON.stringify(maHHs)) };
    }
    case 'migrate.doiSoat': {
      const kq = await db.batch([
        ...BANG_CHUYEN.map(b => db.prepare(`SELECT COUNT(*) n FROM "${b}"`)),
        db.prepare(`SELECT (SELECT COALESCE(SUM(COALESCE("TongTien",0)-COALESCE("DaThu",0)),0) FROM "XuatBan")
                         + (SELECT COALESCE(SUM(COALESCE("TongTien",0)-COALESCE("DaThu",0)),0) FROM "SuaChua")
                         + (SELECT COALESCE(SUM(COALESCE("ChiPhiGiaCong",0)-COALESCE("DaThu",0)),0) FROM "GiaCong" WHERE "Loai"='NhanGiaCongChoKhach') v`),
        db.prepare(`SELECT (SELECT COALESCE(SUM(COALESCE("TongTien",0)-COALESCE("DaTra",0)),0) FROM "NhapKho")
                         + (SELECT COALESCE(SUM(COALESCE("ChiPhiGiaCong",0)-COALESCE("DaTra",0)),0) FROM "GiaCong" WHERE "Loai"='ThueNgoaiGiaCong') v`),
        db.prepare(`SELECT COALESCE(SUM(${TRUOC_THUE}),0) v FROM "XuatBan"`),
        db.prepare(`SELECT COALESCE(SUM(${TRUOC_THUE}),0) v FROM "NhapKho"`),
        db.prepare(`SELECT "MaHH","TonKho" FROM "HangHoa" WHERE "Loai"='HangHoa'`)
      ]);
      const dem = {}; BANG_CHUYEN.forEach((b, i) => { dem[b] = Number(kq[i].results[0].n) || 0; });
      const k = BANG_CHUYEN.length;
      const soDu = await getSoDuQuy(env);
      const ton = {}; kq[k + 4].results.forEach(r => { ton[r.MaHH] = Number(r.TonKho) || 0; });
      return {
        dem, congNoPhaiThu: Number(kq[k].results[0].v) || 0, congNoPhaiTra: Number(kq[k + 1].results[0].v) || 0,
        doanhThuXuatBan: Number(kq[k + 2].results[0].v) || 0, tongNhapKho: Number(kq[k + 3].results[0].v) || 0,
        soDuQuy: { TienMat: soDu.tienMat.soDu, ChuyenKhoan: soDu.chuyenKhoan.soDu, The: soDu.the.soDu }, ton
      };
    }
    case 'migrate.taoAdmin': {
      const co = await first(env, `SELECT COUNT(*) n FROM "NguoiDung"`);
      if (Number(co.n) > 0) throw loi('DA_CO_NGUOI_DUNG: chỉ tạo admin đầu tiên khi bảng NguoiDung còn trống');
      if (!p.matKhau || p.matKhau.length < 6) throw loi('Mật khẩu tối thiểu 6 ký tự');
      await db.batch(lenhThem(db, 'NguoiDung', [{ MaNV: 'NV001', HoTen: p.hoTen || 'Quản trị viên', TenDangNhap: p.tenDangNhap || 'admin',
        MatKhauHash: await bamMatKhau(p.matKhau), VaiTro: ROLES.ADMIN, TrangThai: 'Active', NgayTao: homNayVN(), SoLanSai: 0 }]));
      return { created: true };
    }
    default: throw loi('UNKNOWN_ACTION: ' + action);
  }
}

// ================== ROUTER ==================
function anThongTinNhayCam(params) {
  const o = { ...(params.data || params) };
  ['token', 'password', 'matKhauCu', 'matKhauMoi', 'MatKhauMoi', 'key'].forEach(k => delete o[k]);
  return JSON.stringify(o);
}

async function handleAction(env, params, origin) {
  const action = params.action;
  if (action === 'login') return handleLogin(env, params.tenDangNhap, params.password);

  const user = await getSessionUser(env, params.token);
  if (ADMIN_ONLY_ACTIONS.has(action) && user.VaiTro !== ROLES.ADMIN) throw loi('KHONG_CO_QUYEN');

  let result;
  switch (action) {
    case 'logout': result = await handleLogout(env, params.token); break;
    case 'pingPhien': result = { ok: true, tenDangNhap: user.TenDangNhap }; break;
    case 'doiMatKhau': result = await doiMatKhau(env, user, params.matKhauCu, params.matKhauMoi); break;

    case 'getNguoiDungList': result = await getNguoiDungList(env); break;
    case 'saveNguoiDung': result = await saveNguoiDung(env, params.data); break;
    case 'deleteNguoiDung': result = await deleteNguoiDung(env, params.maNV); break;
    case 'khoaMoNguoiDung': result = await khoaMoNguoiDung(env, params.maNV, params.trangThai); break;

    case 'getDashboard': result = await getDashboard(env); break;
    case 'getInitData': {
      const [hangHoaList, khachHangList, nhaCungCapList, nhapKhoList, xuatBanList, suaChuaList, giaCongList] = await Promise.all([
        getHangHoaList(env), getKhachHangList(env), getNhaCungCapList(env),
        layDanhSachGanDay(env, 'NhapKho', 200), layDanhSachGanDay(env, 'XuatBan', 200),
        layDanhSachGanDay(env, 'SuaChua', 200), layDanhSachGanDay(env, 'GiaCong', 200)
      ]);
      result = { hangHoaList, khachHangList, nhaCungCapList, nhapKhoList, xuatBanList, suaChuaList, giaCongList };
      break;
    }
    case 'getHangHoaList': result = await getHangHoaList(env); break;
    case 'saveHangHoa': result = await saveHangHoa(env, params.data); break;
    case 'deleteHangHoa': result = await xoaDanhMucAnToan(env, 'HangHoa', 'MaHH', params.maHH); break;
    case 'getDongTheoDonVi': result = await getDongTheoDonVi(env, params.maHH); break;
    case 'apDungDonViDongCu': result = await apDungDonViDongCu(env, params.maHH, params.dong); break;
    case 'tinhLaiTonKho': { const r = await tinhLaiTonKho(env, params.maHH); delete r._giaMoi; result = r; break; }

    case 'getNhaCungCapList': result = await getNhaCungCapList(env); break;
    case 'saveNhaCungCap': result = await saveDoiTac(env, 'NhaCungCap', 'MaNCC', 'NCC', params.data); break;
    case 'deleteNhaCungCap': result = await xoaDanhMucAnToan(env, 'NhaCungCap', 'MaNCC', params.maNCC); break;
    case 'getKhachHangList': result = await getKhachHangList(env); break;
    case 'saveKhachHang': result = await saveDoiTac(env, 'KhachHang', 'MaKH', 'KH', params.data); break;
    case 'deleteKhachHang': result = await xoaDanhMucAnToan(env, 'KhachHang', 'MaKH', params.maKH); break;

    case 'getNhapKhoList': result = await layDanhSachGanDay(env, 'NhapKho', params.gioiHan); break;
    case 'getNhapKhoDetail': result = await getPhieuDetail(env, 'NhapKhoCT', params.idPhieu); break;
    case 'saveNhapKho': result = await luuPhieuNhap(env, params.data, user); break;
    case 'capNhatDaTraNCC': result = await capNhatThanhToan(env, 'NhapKho', 'DaTra', params.idPhieu, params.soTien, params.phuongThuc, user.TenDangNhap); break;
    case 'xoaPhieuNhap': result = await xoaPhieu(env, 'NhapKho', params.idPhieu); break;

    case 'getXuatBanList': result = await layDanhSachGanDay(env, 'XuatBan', params.gioiHan); break;
    case 'getXuatBanDetail': result = await getPhieuDetail(env, 'XuatBanCT', params.idPhieu); break;
    case 'saveXuatBan': result = await luuPhieuXuat(env, params.data, user); break;
    case 'suaPhieuXuat': result = await suaPhieuXuat(env, params.idPhieu, params.data); break;
    case 'capNhatHoaDonXuatBan': result = await capNhatHoaDon(env, 'XuatBan', params.idPhieu, params.soHDDT, params.kyHieuHD); break;
    case 'capNhatDaThuKH': result = await capNhatThanhToan(env, 'XuatBan', 'DaThu', params.idPhieu, params.soTien, params.phuongThuc, user.TenDangNhap); break;
    case 'xoaPhieuXuat': result = await xoaPhieu(env, 'XuatBan', params.idPhieu); break;

    case 'getSuaChuaList': result = await layDanhSachGanDay(env, 'SuaChua', params.gioiHan); break;
    case 'getSuaChuaDetail': result = await getPhieuDetail(env, 'SuaChuaCT', params.idPhieu); break;
    case 'saveSuaChua': result = await luuPhieuSuaChua(env, params.data, user); break;
    case 'suaPhieuSuaChua': result = await suaPhieuSuaChua(env, params.idPhieu, params.data); break;
    case 'capNhatTrangThaiSuaChua': result = await capNhatTrangThai(env, 'SuaChua', params.idPhieu, params.trangThai, params.ngayHoanThanh); break;
    case 'capNhatHoaDonSuaChua': result = await capNhatHoaDon(env, 'SuaChua', params.idPhieu, params.soHDDT, params.kyHieuHD); break;
    case 'capNhatDaThuSuaChua': result = await capNhatThanhToan(env, 'SuaChua', 'DaThu', params.idPhieu, params.soTien, params.phuongThuc, user.TenDangNhap); break;
    case 'xoaPhieuSuaChua': result = await xoaPhieu(env, 'SuaChua', params.idPhieu); break;

    case 'getGiaCongList': result = await layDanhSachGanDay(env, 'GiaCong', params.gioiHan); break;
    case 'getGiaCongDetail': result = await getPhieuDetail(env, 'GiaCongCT', params.idPhieu); break;
    case 'saveGiaCong': result = await luuPhieuGiaCong(env, params.data, user); break;
    case 'suaPhieuGiaCong': result = await suaPhieuGiaCong(env, params.idPhieu, params.data); break;
    case 'capNhatTrangThaiGiaCong': result = await capNhatTrangThai(env, 'GiaCong', params.idPhieu, params.trangThai, params.ngayHoanThanh); break;
    case 'capNhatHoaDonGiaCong': result = await capNhatHoaDon(env, 'GiaCong', params.idPhieu, params.soHDDT, params.kyHieuHD); break;
    case 'capNhatThanhToanGiaCong': result = await capNhatThanhToan(env, 'GiaCong', params.loaiTien, params.idPhieu, params.soTien, params.phuongThuc, user.TenDangNhap); break;
    case 'xoaPhieuGiaCong': result = await xoaPhieu(env, 'GiaCong', params.idPhieu); break;

    case 'bulkCapNhatHoaDon': result = await bulkCapNhatHoaDon(env, params.items); break;
    case 'importLichSuTuBangKe': result = await importLichSuTuBangKe(env, params.items, user); break;
    case 'importChiTietBKMVBR': result = await importChiTietBKMVBR(env, params.invoices, user); break;

    case 'getBaoCaoDoanhThu': result = await getBaoCaoDoanhThu(env, params.tuNgay, params.denNgay); break;
    case 'getSoSanhThangHienTai': result = await getSoSanhThangHienTai(env); break;
    case 'getBaoCaoTonKho': result = await all(env, `SELECT * FROM "HangHoa" WHERE "Loai" = 'HangHoa' ORDER BY rowid`); break;
    case 'getCongNo': result = await getCongNo(env); break;
    case 'getCongNoTheoDoiTac': result = await getCongNoTheoDoiTac(env); break;
    case 'getNhatKy': result = await all(env, `SELECT "Timestamp","NguoiDung","HanhDong","ChiTiet" FROM "NhatKyHoatDong" ORDER BY "Timestamp" DESC, "ID" DESC LIMIT 200`); break;

    case 'getSoQuyList': result = await getSoQuyList(env, params.tuNgay, params.denNgay, params.loai, params.phuongThuc); break;
    case 'saveThuChi': result = await saveThuChiTuDo(env, params.data, user); break;
    case 'xoaThuChi': result = await xoaThuChiTuDo(env, params.idPhieu); break;
    case 'getSoDuQuy': result = await getSoDuQuy(env); break;
    case 'capNhatSoDuDauKy': result = await capNhatSoDuDauKy(env, params.data); break;

    case 'getCauHinhThanhToan': result = await getCauHinhThanhToan(env, origin); break;
    case 'capNhatCauHinhThanhToan': result = await capNhatCauHinhThanhToan(env, params.data); break;
    case 'getThongTinNganHang': result = await getThongTinNganHangCoBan(env); break;

    case 'exportTable': result = await exportTable(env, params.table, params.offset); break;

    default: throw loi('UNKNOWN_ACTION: ' + action + ' (có thể Worker đang chạy bản cũ — kiểm tra lại lần deploy gần nhất)');
  }

  if (WRITE_ACTIONS.has(action)) {
    try { await lenhNhatKy(env, user.TenDangNhap, action, anThongTinNhayCam(params)).run(); } catch (e) { /* không chặn luồng chính nếu lỗi ghi nhật ký */ }
  }
  return { success: true, data: result };
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const cho = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const h = { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
  if (!cho.length) h['Access-Control-Allow-Origin'] = '*';
  else if (origin && cho.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
function traJson(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors } });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method === 'GET') return traJson({ ok: true, app: 'phuonglinh-erp-api', time: bayGio() }, 200, cors);
    if (request.method !== 'POST') return traJson({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405, cors);

    let params;
    try { params = JSON.parse(await request.text()); } catch (e) { return traJson({ success: false, error: 'INVALID_PAYLOAD' }, 400, cors); }
    if (!params || typeof params !== 'object') return traJson({ success: false, error: 'INVALID_PAYLOAD' }, 400, cors);

    try {
      // Webhook SePay: đường dẫn riêng /webhook/sepay, hoặc (tương thích bản GAS) POST vào gốc với payload không có "action"
      if (url.pathname === '/webhook/sepay' || (params.action === undefined && params.transferAmount !== undefined)) {
        const r = await xuLyWebhookSePay(env, request, url, params);
        return traJson(r.body, r.status, cors);
      }
      if (typeof params.action === 'string' && params.action.startsWith('migrate.')) {
        return traJson({ success: true, data: await xuLyChuyenDuLieu(env, params.action, params) }, 200, cors);
      }
      return traJson(await handleAction(env, params, url.origin), 200, cors);
    } catch (err) {
      const msg = String((err && err.message) || err);
      if (!(err instanceof LoiNghiepVu)) console.error('[phuonglinh-erp]', params.action, msg);
      if (/no such table/i.test(msg)) return traJson({ success: false, error: 'CHUA_KHOI_TAO_CSDL: chưa tạo bảng dữ liệu — mở migrate.html, bấm "Kiểm tra & khởi tạo cấu trúc"' }, 200, cors);
      return traJson({ success: false, error: msg }, 200, cors);
    }
  }
};

// Dùng cho bộ test và công cụ sinh schema.sql (không ảnh hưởng Worker khi chạy thật)
export const _test = { SCHEMA, schemaStatements, lapDongCT, tinhTienThue, chuanHoaMST, kiemMatKhau, bamMatKhau };
