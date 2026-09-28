/* ================= LOGIN FLOW ================= */
document.getElementById('btnLogin').addEventListener('click', doLogin);
document.getElementById('pwInput').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('userInput').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

let _dangDangNhap = false; // chặn gọi doLogin() chồng lặp (VD: bấm Enter rồi lại bấm chuột trước khi phản hồi về) — nếu không chặn, 2 lượt đăng nhập chạy song song sẽ tạo 2 phiên cùng lúc, phiên này tự đá phiên kia ra ngay khi vừa đăng nhập xong
function doLogin() {
  if (_dangDangNhap) return;
  const tenDangNhap = document.getElementById('userInput').value.trim();
  const pw = document.getElementById('pwInput').value;
  if (!CONFIG.DA_CAU_HINH) { document.getElementById('loginErr').textContent = 'Chưa cấu hình địa chỉ máy chủ: sửa dòng API_URL trong file js/config.js.'; return; }
  if (!tenDangNhap || !pw) { document.getElementById('loginErr').textContent = 'Nhập đủ tài khoản và mật khẩu.'; return; }
  _dangDangNhap = true;
  document.getElementById('btnLogin').disabled = true;
  document.getElementById('loginErr').textContent = 'Đang kiểm tra...';
  apiLogin(tenDangNhap, pw).then(res => {
    if (res.success) {
      STATE.token = res.token; STATE.user = res.user;
      ghiLS(LS.TOKEN, res.token);
      ghiLS(LS.USER, JSON.stringify(res.user));
      document.getElementById('companyNameLabel').textContent = res.companyName || 'CÔNG TY TNHH DVCN PHƯƠNG LINH';
      document.getElementById('loginErr').textContent = '';
      enterApp(false);
    } else {
      const msgMap = {
        SAI_TAI_KHOAN: 'Tài khoản không tồn tại.', SAI_MAT_KHAU: 'Sai mật khẩu.', TAI_KHOAN_BI_KHOA: 'Tài khoản đã bị khoá.',
        TAM_KHOA_DO_SAI_NHIEU_LAN: 'Nhập sai mật khẩu quá nhiều lần — tài khoản tạm khoá 10 phút, thử lại sau.'
      };
      const loi = String(res.error || '');
      document.getElementById('loginErr').textContent = msgMap[loi] || (loi.startsWith('CHUA_KHOI_TAO_CSDL') ? 'Cơ sở dữ liệu chưa được khởi tạo — mở trang migrate.html để khởi tạo và chuyển dữ liệu.' : 'Lỗi: ' + loi);
    }
  }).catch(err => { document.getElementById('loginErr').textContent = 'Lỗi kết nối: ' + err.message; })
    .finally(() => { _dangDangNhap = false; document.getElementById('btnLogin').disabled = false; });
}

function thucHienDangXuat(lyDo) {
  const tokenCu = STATE.token;
  STATE.token = ''; STATE.user = null;
  ghiLS(LS.TOKEN, null); ghiLS(LS.USER, null);
  if (tokenCu && CONFIG.DA_CAU_HINH) goiApiTho({ action: 'logout', token: tokenCu }).catch(() => {});
  dungGiamSatPhien();
  closeModal();
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginErr').textContent = lyDo || '';
}
document.getElementById('btnLogout').addEventListener('click', () => thucHienDangXuat(''));

/* ---- Tự đăng xuất do không thao tác: ĐÃ TẮT theo yêu cầu anh Hưng (13/8/2026) — không thêm lại. Chỉ đăng
   xuất khi bấm nút, hoặc khi tài khoản đăng nhập ở nơi khác (đơn phiên, kiểm tra bên dưới). ---- */

/* ---- Kiểm tra định kỳ phiên còn hiệu lực (bị đăng nhập ở máy khác thì tự đá ra) ---- */
const CHU_KY_KIEM_TRA_PHIEN_MS = 30 * 1000;
let _henGioKiemTraPhien = null;
function batDauGiamSatPhien() {
  dungGiamSatPhien();
  _henGioKiemTraPhien = setInterval(() => {
    if (!STATE.token || !CONFIG.DA_CAU_HINH || document.hidden) return;
    apiCall('pingPhien').catch(() => { /* AUTH_FAILED đã được apiCall() xử lý tập trung */ });
  }, CHU_KY_KIEM_TRA_PHIEN_MS);
}
function dungGiamSatPhien() {
  clearInterval(_henGioKiemTraPhien);
}

function enterApp(isSetupOnly) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';
  setTimeout(capNhatViTriNeo, 0); // đo lại ngay sau khi appShell hiện ra (trước đó header ẩn nên đo ra 0)
  if (STATE.user) {
    const hoTen = STATE.user.hoTen || STATE.user.tenDangNhap || '';
    const chuCai = (hoTen.trim().split(/\s+/).pop() || '?').charAt(0);
    document.getElementById('userHoTenLabel').textContent = hoTen;
    document.getElementById('userVaiTroLabel').textContent = vaiTroLabel(STATE.user.vaiTro);
    document.getElementById('sbHoTen').textContent = hoTen;
    document.getElementById('sbVaiTro').textContent = vaiTroLabel(STATE.user.vaiTro);
    document.getElementById('sbAvatar').textContent = chuCai;
    document.getElementById('tbAvatar').textContent = chuCai;
    applyRoleVisibility();
  }
  const bayGio = new Date();
  document.querySelector('#tbThang span').textContent = `Tháng ${bayGio.getMonth() + 1}/${bayGio.getFullYear()}`;
  if (!isSetupOnly) { loadAllData(); batDauGiamSatPhien(); }
}

function applyRoleVisibility() {
  const role = STATE.user ? STATE.user.vaiTro : null;
  const isAdmin = role === 'Admin';
  document.querySelectorAll('#tabbar button[data-tab="nguoidung"]').forEach(b => b.style.display = isAdmin ? '' : 'none');
  const panelQuy = document.getElementById('panelSoDuDauKy');
  if (panelQuy) panelQuy.style.display = isAdmin ? '' : 'none';
  const panelQR = document.getElementById('panelQRThanhToan');
  if (panelQR) panelQR.style.display = isAdmin ? '' : 'none';
  const panelExcel = document.getElementById('panelXuatExcel');
  if (panelExcel) panelExcel.style.display = isAdmin ? '' : 'none';
}

window.addEventListener('DOMContentLoaded', () => {
  if (STATE.token && STATE.user && CONFIG.DA_CAU_HINH) enterApp(false);
});

/* ---- Đo chiều cao THẬT của header để thanh tab dính ngay dưới header, không đè lên nhau.
   (Tiêu đề BẢNG không còn dính khi cuộn — đã bỏ hẳn 18/8/2026 vì lỗi chồng/đè tái diễn, KHÔNG thêm lại.) ---- */
function capNhatViTriNeo() {
  const header = document.querySelector('header.topbar');
  const headerH = header ? header.offsetHeight : 53;
  document.documentElement.style.setProperty('--header-h', headerH + 'px');
}
window.addEventListener('load', capNhatViTriNeo);
window.addEventListener('resize', capNhatViTriNeo);
// Font chữ tải từ Google Fonts sau khi trang hiện -> chiều cao header có thể đổi, đo lại khi font xong
if (document.fonts && document.fonts.ready) document.fonts.ready.then(capNhatViTriNeo).catch(() => {});
if (window.ResizeObserver) {
  window.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header.topbar');
    if (header) new ResizeObserver(() => capNhatViTriNeo()).observe(header);
  });
}

/* ---- Đăng ký Service Worker (bắt buộc để Android cho phép "Cài đặt ứng dụng") ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* không chặn app nếu lỗi */ });
  });
}

/* ================= MENU TRÁI ================= */
// Máy tính: nút ☰ thu gọn menu còn biểu tượng (nhớ lựa chọn). Điện thoại (≤900px): menu là ngăn kéo, ☰ mở/đóng.
const LA_MAN_HEP = () => window.matchMedia('(max-width:900px)').matches;
if (docLS('pl_menu_thu_gon') === '1') document.body.classList.add('sbThuGon');
document.getElementById('btnMenu').addEventListener('click', () => {
  if (LA_MAN_HEP()) { document.body.classList.toggle('sbMo'); return; }
  const thuGon = document.body.classList.toggle('sbThuGon');
  ghiLS('pl_menu_thu_gon', thuGon ? '1' : null);
});
document.getElementById('sbBackdrop').addEventListener('click', () => document.body.classList.remove('sbMo'));
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.body.classList.remove('sbMo'); });

/* ================= TAB SWITCH ================= */
document.getElementById('tabbar').addEventListener('click', e => {
  const btn = e.target.closest('button[data-tab]'); if (!btn) return; switchTab(btn.dataset.tab);
});
function switchTab(tab) {
  document.body.classList.remove('sbMo');
  window.scrollTo(0, 0);
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + tab).classList.add('active');
  const renderers = {
    dashboard: renderDashboard, danhmuc: renderHangHoaTable, nhapkho: renderNhapKhoTable,
    xuatban: renderXuatBanTable, suachua: renderSuaChuaTable, giacong: renderGiaCongTable,
    congno: renderCongNo, doitac: () => { renderKhachHangTable(); renderNhaCungCapTable(); },
    nguoidung: renderNguoiDungTable, soquy: renderSoQuy,
    baocao: () => { renderSoSanhThang(); renderCongNoTheoDoiTac(); }
  };
  if (renderers[tab]) renderers[tab]();
}

/* ================= LOAD DATA ================= */
// Gộp tồn kho/giá vốn mới nhất (trả về ngay từ server sau khi lưu phiếu) vào STATE.hangHoaList tại chỗ —
// khỏi phải gọi getHangHoaList lần nữa chỉ để lấy đúng vài con số vừa đổi.
function mergeTonKhoVaoState(tonKhoCapNhat) {
  if (!tonKhoCapNhat) return;
  Object.keys(tonKhoCapNhat).forEach(maHH => {
    const hh = STATE.hangHoaList.find(h => h.MaHH === maHH);
    if (hh) Object.assign(hh, tonKhoCapNhat[maHH]);
  });
}

// Danh mục Hàng hoá/Khách hàng/NCC ít thay đổi -> lưu tạm vào localStorage của trình duyệt để lần mở
// app SAU hiện ra NGAY LẬP TỨC (0.01s, không cần chờ mạng), trong lúc dữ liệu mới nhất được âm thầm tải
// về phía sau rồi ghi đè lại khi xong. Không cache các danh sách giao dịch (Nhập/Xuất/Sửa chữa/Gia công)
// vì chúng đổi liên tục, cache dễ gây nhầm lẫn.
const LS_KEY_DANHMUC = LS.DANHMUC;
function taiDanhMucTuLocalStorage() {
  try {
    const raw = docLS(LS_KEY_DANHMUC);
    if (!raw) return false;
    const cache = JSON.parse(raw);
    STATE.hangHoaList = cache.hangHoaList || [];
    STATE.khachHangList = cache.khachHangList || [];
    STATE.nhaCungCapList = cache.nhaCungCapList || [];
    return true;
  } catch (e) { return false; }
}
function luuDanhMucVaoLocalStorage() {
  try {
    localStorage.setItem(LS_KEY_DANHMUC, JSON.stringify({
      hangHoaList: STATE.hangHoaList, khachHangList: STATE.khachHangList, nhaCungCapList: STATE.nhaCungCapList
    }));
  } catch (e) { /* localStorage đầy hoặc bị trình duyệt chặn -> bỏ qua, không chặn luồng chính */ }
}

function loadAllData() {
  // 1) Hiện ngay danh mục đã lưu trong máy từ lần trước (nếu có) trong lúc chờ mạng phản hồi.
  if (taiDanhMucTuLocalStorage()) { drawHangHoaTable(); }

  // 2) Gọi ngầm lấy dữ liệu mới nhất từ server (nguồn đúng/đầy đủ), ghi đè lại khi có kết quả.
  apiCall('getInitData').then(data => {
    STATE.hangHoaList = data.hangHoaList; STATE.khachHangList = data.khachHangList; STATE.nhaCungCapList = data.nhaCungCapList;
    STATE.nhapKhoList = data.nhapKhoList; STATE.xuatBanList = data.xuatBanList; STATE.suaChuaList = data.suaChuaList; STATE.giaCongList = data.giaCongList;
    luuDanhMucVaoLocalStorage();
    renderDashboard();
    const viewDanhMuc = document.getElementById('view-danhmuc');
    if (viewDanhMuc && viewDanhMuc.classList.contains('active')) drawHangHoaTable();
  }).catch(err => showToast('Lỗi tải dữ liệu: ' + err.message));
}

/* ================= DASHBOARD ================= */
function renderDashboard() {
  apiCall('getDashboard').then(d => {
    STATE.dash = d;
    veKpi('dashCards', [
      { label: 'Doanh thu tháng này (trước thuế)', val: fmtMoney(d.doanhThuThangNay), mau: 'blue' },
      { label: 'Nhập kho tháng này (trước thuế)', val: fmtMoney(d.nhapKhoThangNay), mau: 'navy' },
      { label: 'Công nợ phải thu', val: fmtMoney(d.congNoPhaiThu), mau: 'orange' },
      { label: 'Công nợ phải trả', val: fmtMoney(d.congNoPhaiTra), mau: 'gray' }
    ]);
    const demSo = [
      { label: 'Phiếu xuất bán tháng này', val: d.soPhieuXuatThangNay, den: 'xuatban' },
      { label: 'Sửa chữa đang xử lý', val: d.suaChuaDangXuLy, cls: d.suaChuaDangXuLy > 0 ? 'warn' : '', den: 'suachua' },
      { label: 'Gia công đang xử lý', val: d.giaCongDangXuLy, cls: d.giaCongDangXuLy > 0 ? 'warn' : '', den: 'giacong' },
      { label: 'Phiếu chưa xuất hoá đơn', val: d.soHoaDonChuaXuat || 0, cls: d.soHoaDonChuaXuat > 0 ? 'bad' : '', den: 'xuatban' },
      { label: 'Số mặt hàng / dịch vụ', val: d.soLuongHangHoa + ' / ' + d.soLuongDichVu, den: 'danhmuc' },
      { label: 'Hàng dưới mức tồn tối thiểu', val: (d.hangSapHet || []).length, cls: (d.hangSapHet || []).length ? 'bad' : 'good' }
    ];
    document.getElementById('dashDemSo').innerHTML = demSo.map(c => `<div class="miniStat ${c.cls || ''}" ${c.den ? `data-den="${c.den}" title="Mở trang"` : ''}><span class="ms-label">${c.label}</span><span class="ms-val">${c.val}</span></div>`).join('');
    const lowStockWrap = document.getElementById('dashLowStock');
    if (!d.hangSapHet || d.hangSapHet.length === 0) {
      lowStockWrap.innerHTML = '<div class="empty">Không có hàng nào dưới mức tồn tối thiểu.</div>';
    } else {
      lowStockWrap.innerHTML = `<table><thead><tr><th>Mã</th><th>Tên hàng</th><th>Tồn kho</th><th>Tồn tối thiểu</th></tr></thead><tbody>
        ${d.hangSapHet.map(h => `<tr><td>${h.MaHH}</td><td>${h.TenHH}</td><td>${tonKhoKep(h)}</td><td>${h.TonKhoToiThieu}</td></tr>`).join('')}
      </tbody></table>`;
    }
    // Các trang Bán hàng / Nhập kho dùng lại số tháng này của Tổng quan cho thẻ đầu trang
    if (document.getElementById('view-xuatban').classList.contains('active')) veKpiXuat();
    if (document.getElementById('view-nhapkho').classList.contains('active')) veKpiNhap();
  }).catch(err => showToast('Lỗi: ' + err.message));
  // Số dư quỹ hiện tại — gọi riêng (không nằm trong getDashboard).
  apiCall('getSoDuQuy').then(soDu => {
    const wrap = document.getElementById('dashSoDuQuy');
    if (!wrap) return;
    wrap.innerHTML = [
      { label: 'Tiền mặt', val: fmtMoney(soDu.tienMat.soDu), cls: soDu.tienMat.soDu < 0 ? 'bad' : 'good' },
      { label: 'Chuyển khoản / ngân hàng', val: fmtMoney(soDu.chuyenKhoan.soDu), cls: soDu.chuyenKhoan.soDu < 0 ? 'bad' : 'good' },
      { label: 'Thẻ', val: fmtMoney(soDu.the ? soDu.the.soDu : 0), cls: soDu.the && soDu.the.soDu < 0 ? 'bad' : '' },
      { label: 'Tổng số dư', val: fmtMoney(soDu.tienMat.soDu + soDu.chuyenKhoan.soDu + (soDu.the ? soDu.the.soDu : 0)), cls: '' }
    ].map(c => `<div class="miniStat ${c.cls}" data-den="soquy" title="Mở Sổ quỹ"><span class="ms-label">${c.label}</span><span class="ms-val">${c.val}</span></div>`).join('');
  }).catch(() => {});
}
document.getElementById('view-dashboard').addEventListener('click', e => {
  const o = e.target.closest('.miniStat[data-den]'); if (o) switchTab(o.dataset.den);
});
