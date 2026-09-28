/* ================= TẢI THƯ VIỆN NẶNG THEO NHU CẦU (LAZY LOAD) =================
   xlsx.js / pdf.js / tesseract.js không còn nhét sẵn ở <head> nữa. Gọi await caiThuVien('xlsx') (hoặc
   'pdfjs' / 'tesseract') NGAY TRƯỚC đoạn code cần dùng thư viện đó — lần đầu sẽ tải qua mạng (có hiện
   toast báo đang tải), các lần gọi sau dùng lại luôn vì đã có sẵn trong trang, không tải lại. */
const _thuVienDaTai = {};
function caiThuVien(ten) {
  const nguon = {
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    tesseract: 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js'
  };
  if (_thuVienDaTai[ten]) return _thuVienDaTai[ten];
  _thuVienDaTai[ten] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = nguon[ten];
    s.onload = () => resolve();
    s.onerror = () => { delete _thuVienDaTai[ten]; reject(new Error('Không tải được thư viện ' + ten + ' — kiểm tra kết nối mạng.')); };
    document.body.appendChild(s);
  });
  return _thuVienDaTai[ten];
}

/* ================= CONFIG ================= */
// Địa chỉ API (Cloudflare Worker) đặt DUY NHẤT trong js/config.js. Bản mới cố ý KHÔNG còn ô "lưu địa chỉ
// vào trình duyệt" ở tab Cài đặt: bản GAS từng bị lỗi vì địa chỉ cũ lưu trong trình duyệt ghi đè địa chỉ mới.
const CONFIG = {
  API_URL: String((window.PL_CONFIG && window.PL_CONFIG.API_URL) || '').trim().replace(/\/+$/, '')
};
CONFIG.DA_CAU_HINH = /^https?:\/\//.test(CONFIG.API_URL) && !/DIEN|<|>/.test(CONFIG.API_URL);

// Khoá lưu trong trình duyệt dùng tiền tố "pl_" riêng — bản cũ indexGAS.html (cùng tên miền, dùng "qlbh_")
// chạy song song không đè lên phiên đăng nhập / bộ nhớ đệm của bản mới và ngược lại.
// Lưu bằng localStorage (không phải sessionStorage): mở nhiều tab cùng máy không tự đá nhau ra.
const LS = { TOKEN: 'pl_token', USER: 'pl_user', DANHMUC: 'pl_danhmuc_cache_v1' };
function docLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function ghiLS(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* trình duyệt chặn bộ nhớ -> bỏ qua */ } }

let STATE = {
  token: docLS(LS.TOKEN) || '',
  user: (() => { try { return JSON.parse(docLS(LS.USER) || 'null'); } catch (e) { return null; } })(),
  hangHoaList: [], khachHangList: [], nhaCungCapList: [],
  nhapKhoList: [], xuatBanList: [], suaChuaList: [], giaCongList: []
};

/* ================= API HELPER ================= */
// Đọc phản hồi dạng chữ rồi mới đổi sang JSON, để khi máy chủ/mạng trả về thứ khác JSON thì báo rõ ràng
// thay vì lỗi khó hiểu "not valid JSON". Tự thử lại 1 lần sau 1,5s — CHỈ cho lệnh ĐỌC (get*/pingPhien/login),
// không bao giờ tự gửi lại lệnh LƯU/XOÁ (tránh tạo trùng phiếu, ghi trùng tiền).
function goiApiTho(payload, laLanThuLai) {
  const action = payload.action || '';
  const coTheThuLai = !laLanThuLai && (action === 'login' || action === 'pingPhien' || action.indexOf('get') === 0);
  return fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(r => r.text().then(text => {
      try { return JSON.parse(text); } catch (e) {
        console.error('[API] Phản hồi không phải JSON, action=' + action + ', HTTP ' + r.status + ':', text.slice(0, 500));
        const goiY = /exceeded|1102|resource limit/i.test(text) ? 'Máy chủ vượt giới hạn xử lý của gói miễn phí — thử lại sau ít phút.'
          : 'Máy chủ trả về dữ liệu không hợp lệ (HTTP ' + r.status + ') — có thể mạng/VPN/trình chặn quảng cáo đang chặn, hoặc Worker chưa deploy xong.';
        throw new Error(goiY + ' (Chi tiết: "' + text.slice(0, 120).replace(/\s+/g, ' ').trim() + '")');
      }
    }))
    .catch(err => {
      if (coTheThuLai) return new Promise(res => setTimeout(res, 1500)).then(() => goiApiTho(payload, true));
      if (err instanceof TypeError) throw new Error('Không kết nối được máy chủ (' + err.message + ') — kiểm tra mạng.');
      throw err;
    });
}
function apiCall(action, extra) {
  extra = extra || {};
  const payload = Object.assign({ action, token: STATE.token }, extra);
  if (!CONFIG.DA_CAU_HINH) { showToast('Chưa cấu hình địa chỉ máy chủ (API_URL) trong file js/config.js.'); return Promise.reject(new Error('CHUA_CAU_HINH_API_URL')); }
  return goiApiTho(payload).then(res => {
    if (!res.success) {
      // Phiên hết hiệu lực (đăng nhập ở nơi khác / tài khoản bị khoá): xử lý TẬP TRUNG cho mọi lệnh,
      // đưa về màn đăng nhập kèm lời giải thích, thay vì hiện dòng lỗi thô "AUTH_FAILED".
      if (action !== 'login' && res.error === 'AUTH_FAILED' && STATE.token) {
        thucHienDangXuat('Phiên đăng nhập đã hết hiệu lực (tài khoản vừa đăng nhập ở nơi khác, hoặc bị khoá) — vui lòng đăng nhập lại.');
      }
      throw new Error(res.error || 'LOI_KHONG_XAC_DINH');
    }
    return res.data;
  });
}
function apiLogin(tenDangNhap, password) {
  if (!CONFIG.DA_CAU_HINH) return Promise.reject(new Error('Chưa cấu hình địa chỉ máy chủ (API_URL) trong file js/config.js.'));
  return goiApiTho({ action: 'login', tenDangNhap, password });
}

/* ================= UTIL ================= */
/* ================= BỘ ICON DÙNG CHUNG (SVG nhẹ, không cần thư viện ngoài) ================= */
const ICON_XEM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICON_SUA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
const ICON_XOA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
const ICON_HD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>';
const ICON_TRANGTHAI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
const ICON_KHOA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
const ICON_MOKHOA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';

function fmtMoney(n) { n = Number(n) || 0; return '<span class="num">' + n.toLocaleString('vi-VN') + '\u00a0đ</span>'; } // khoảng trắng không ngắt: số và "đ" luôn cùng 1 dòng
function parseSoTien(val) { return Number(String(val || '').replace(/\D/g, '')) || 0; }
function formatMoneyInputLive(el) {
  const soChuSoTruocConTro = el.value.slice(0, el.selectionStart || 0).replace(/\D/g, '').length;
  const raw = el.value.replace(/\D/g, '');
  const formatted = raw ? Number(raw).toLocaleString('vi-VN') : '';
  el.value = formatted;
  let pos = 0, dem = 0;
  while (pos < formatted.length && dem < soChuSoTruocConTro) { if (/\d/.test(formatted[pos])) dem++; pos++; }
  try { el.setSelectionRange(pos, pos); } catch (e) { /* một số trình duyệt không hỗ trợ trên input type khác */ }
}
document.addEventListener('input', e => { if (e.target.classList && e.target.classList.contains('moneyInput')) formatMoneyInputLive(e.target); });
function fmtDate(d) { if (!d) return ''; const dt = new Date(d); if (isNaN(dt)) return d; return dt.toLocaleDateString('vi-VN'); }
// Đổi 1 ngày (Date theo giờ máy) sang 'YYYY-MM-DD' THEO GIỜ ĐỊA PHƯƠNG. Bản cũ dùng toISOString() (giờ UTC)
// nên trước 7h sáng ra ngày hôm qua, và "ngày 1 đầu tháng" bị lùi thành ngày cuối tháng trước.
function ngayISO(d) { const x = d || new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
function todayISO() { return ngayISO(new Date()); }
function showToast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.style.display = 'block';
  clearTimeout(window._toastTimer); window._toastTimer = setTimeout(() => (t.style.display = 'none'), 3200);
}
// Số lượng gọn: tối đa 2 chữ số thập phân, dấu chấm hàng nghìn kiểu VN.
function fmtSoLuong(n) { n = Number(n) || 0; return (Math.round(n * 100) / 100).toLocaleString('vi-VN'); }
// Tồn kho dạng kép, VD "150 Mét (≈ 1 Cuộn + 50 Mét)". CHỈ để hiển thị/đối chiếu khi đếm kho — tồn thật luôn
// tính theo đơn vị chính (Mét). Phần "≈" là quy đổi số học, ngoài thực tế có thể là 2 cuộn dở.
function tonKhoKep(h, ton) {
  h = h || {};
  ton = ton === undefined ? Number(h.TonKho) || 0 : Number(ton) || 0;
  const dvt = h.DVT || '', heSo = Number(h.HeSoQuyDoi) || 0;
  let s = (fmtSoLuong(ton) + ' ' + dvt).trim();
  if (h.DVTNhap && heSo > 1 && ton >= heSo) {
    const nguyen = Math.floor(ton / heSo + 1e-9);
    const du = Math.round((ton - nguyen * heSo) * 100) / 100;
    s += ` (≈ ${nguyen} ${h.DVTNhap}${du > 0 ? ' + ' + fmtSoLuong(du) + ' ' + dvt : ''})`;
  }
  return s;
}
// Hỏi lại khi phiếu có dòng đơn giá 0 đ (nhập giá 0 làm sai giá vốn; bán giá 0 làm sai doanh thu/thuế).
// Xoá mặt hàng/đối tác còn phiếu -> server báo DANG_DUOC_SU_DUNG kèm lý do; hiện hộp thoại rõ ràng thay vì mã lỗi.
function baoLoiXoaDanhMuc(err) {
  const msg = String((err && err.message) || '');
  if (msg.startsWith('DANG_DUOC_SU_DUNG')) { alert(msg.replace(/^DANG_DUOC_SU_DUNG:\s*/, '')); return; }
  showToast('Lỗi: ' + msg);
}
function xacNhanDonGiaKhong(items) {
  const ds = (items || []).filter(it => !(Number(it.DonGia) > 0));
  if (!ds.length) return true;
  return confirm(`Có ${ds.length} dòng đơn giá = 0 đ:\n- ${ds.slice(0, 5).map(i => i.TenHH || i.MaHH).join('\n- ')}${ds.length > 5 ? '\n...' : ''}\n\nĐơn giá 0 làm sai giá vốn/doanh thu. Vẫn lưu phiếu?`);
}
function openModal(html) { document.getElementById('modalCard').innerHTML = html; document.getElementById('modalBg').classList.add('active'); }
function closeModal() { document.getElementById('modalBg').classList.remove('active'); }
// Chỉ đóng modal khi CẢ mousedown lẫn click đều nhắm đúng vào nền mờ (không phải bôi đen text
// trong ô rồi lỡ thả chuột ra ngoài — trường hợp đó click.target cũng là modalBg nhưng không phải ý định đóng).
let _modalMouseDownOnBg = false;
document.getElementById('modalBg').addEventListener('mousedown', e => { _modalMouseDownOnBg = (e.target.id === 'modalBg'); });
document.getElementById('modalBg').addEventListener('click', e => {
  if (e.target.id === 'modalBg' && _modalMouseDownOnBg) closeModal();
  _modalMouseDownOnBg = false;
});
function vaiTroLabel(v) { return { Admin: 'Quản trị viên', BanHang: 'Bán hàng', KyThuat: 'Kỹ thuật', KeToan: 'Kế toán' }[v] || v; }
function trangThaiSCLabel(v) { return { TiepNhan: 'Tiếp nhận', DangSua: 'Đang sửa', ChoLinhKien: 'Chờ linh kiện', HoanThanh: 'Hoàn thành', DaGiaoTra: 'Đã giao trả', Huy: 'Huỷ' }[v] || v; }
function trangThaiSCTag(v) {
  const map = { TiepNhan: 'info', DangSua: 'warn', ChoLinhKien: 'warn', HoanThanh: 'good', DaGiaoTra: 'good', Huy: 'bad' };
  return `<span class="tag ${map[v] || 'info'}">${trangThaiSCLabel(v)}</span>`;
}

/* ================= GIAO DIỆN DÙNG CHUNG ================= */
// Hàng thẻ số liệu màu đặc (đầu mỗi trang). items: [{ label, val, mau: 'blue'|'navy'|'orange'|'gray'|'green'|'red'|'teal', phu }]
// Giữ class "statCard" để các chỗ khác (và bộ test) vẫn nhận ra thẻ số liệu như cũ.
function veKpi(elId, items) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = items.map(k => `<div class="statCard kpi k-${k.mau || 'blue'}"><div class="label">${k.label}</div><div class="val">${k.val}</div>${k.phu ? `<div class="phu">${k.phu}</div>` : ''}</div>`).join('');
}
function laThangNay(ngay) { return String(ngay || '').slice(0, 7) === todayISO().slice(0, 7); }
function tongTien(list, fn) { return list.reduce((s, x) => s + (Number(fn(x)) || 0), 0); }
function boDau(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }

// Tab phụ dạng viên thuốc: <div class="pillTabs" data-nhom="X"><button data-pane="a">…  +  <div class="pane" data-nhom="X" data-pane="a">
document.addEventListener('click', e => {
  const btn = e.target.closest('.pillTabs button[data-pane]');
  if (!btn) return;
  const nhom = btn.parentElement.dataset.nhom;
  btn.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll(`.pane[data-nhom="${nhom}"]`).forEach(p => p.classList.toggle('active', p.dataset.pane === btn.dataset.pane));
});

/* Làm đẹp mọi bảng danh sách SAU KHI vẽ, không phải sửa từng hàm vẽ bảng:
   - cột toàn số tiền/số lượng -> căn phải (cả tiêu đề), giống phần mềm kế toán;
   - cột nút thao tác cuối bảng -> đặt tiêu đề "Chức năng";
   - thêm chân bảng "Tổng số: N bản ghi".
   Chỉ áp dụng cho bảng nằm trực tiếp trong .tableWrap ở trang chính (không đụng bảng trong popup). */
function lamDepBang(table) {
  if (table.dataset.daLamDep) return;
  table.dataset.daLamDep = '1';
  const ths = [...table.querySelectorAll(':scope > thead > tr > th')];
  const rows = [...table.querySelectorAll(':scope > tbody > tr')];
  if (!ths.length) return;
  const laSo = td => {
    const t = td.textContent.replace(/\s+/g, ' ').trim();
    if (!t) return null; // ô trống: không tính
    if (td.querySelector('button,input,select')) return false;
    if (/^-?[\d.,]+( ?đ)?( [\p{L}]{1,8})?$/u.test(t)) return true; // 1.234.000 đ | 9 | 12 Cái
    if (td.children.length === 1 && td.firstElementChild.classList.contains('tag')) return null; // nhãn "Đã thu đủ" trong cột tiền: trung lập
    return false;
  };
  ths.forEach((th, i) => {
    let coSo = false, khongSo = false;
    rows.forEach(tr => { const td = tr.children[i]; if (!td) return; const k = laSo(td); if (k === true) coSo = true; else if (k === false) khongSo = true; });
    if (coSo && !khongSo) { th.classList.add('soCot'); rows.forEach(tr => tr.children[i] && tr.children[i].classList.add('soCot')); }
  });
  const thCuoi = ths[ths.length - 1];
  if (!thCuoi.textContent.trim() && rows.some(tr => tr.lastElementChild && tr.lastElementChild.classList.contains('rowActions'))) thCuoi.textContent = 'Chức năng';
  const wrap = table.parentElement;
  if (wrap && wrap.classList.contains('tableWrap') && !wrap.querySelector(':scope > .chanBang')) {
    const chan = document.createElement('div');
    chan.className = 'chanBang';
    chan.innerHTML = `<span>Tổng số: <b>${rows.length.toLocaleString('vi-VN')}</b> bản ghi</span>`;
    table.after(chan);
  }
}
(function theoDoiBang() {
  const main = document.querySelector('main');
  if (!main || !window.MutationObserver) return;
  let hen = null;
  new MutationObserver(() => {
    if (hen) return;
    hen = requestAnimationFrame(() => { hen = null; main.querySelectorAll('.tableWrap > table:not([data-da-lam-dep])').forEach(lamDepBang); });
  }).observe(main, { childList: true, subtree: true });
})();
