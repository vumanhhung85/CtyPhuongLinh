/* ================= BỘ THÀNH PHẦN GIAO DIỆN DÙNG CHUNG =================
   Nạp ngay sau core.js (trước mọi file nghiệp vụ). Gồm:
   1. thoat()            — escape HTML cho chuỗi lấy từ dữ liệu người dùng
   2. showToast()        — thông báo nhỏ, có thể kèm nút (VD "Hoàn tác")
   3. xacNhan()          — hộp xác nhận của app (thay confirm()/alert() của trình duyệt), trả về Promise<boolean>
   4. baoLoiForm()       — báo lỗi ngay dưới từng ô + khung tóm tắt lỗi đầu form, đưa con trỏ về khung lỗi
   5. trangThaiRong()/hienDangTai() — màn "chưa có dữ liệu" có nút hành động, khung xám khi đang tải
   6. veChipLoc()        — chip lọc nhanh có số đếm, đồng bộ với <select> lọc cũ (ẩn đi)
   7. nhayDong()         — dòng vừa lưu nháy nền xanh nhạt
   8. canCotDauDinh()    — bảng rộng hơn khung: cố định 2 cột đầu khi kéo ngang
   9. Mật độ bảng (gọn/thoải mái) + giao diện sáng/tối
   10. Tìm nhanh Ctrl+K, phím tắt (Alt+N, Ctrl+S, Esc), Enter/mũi tên trong dòng hàng của phiếu
   Mọi hiệu ứng chuyển động tắt khi máy bật "giảm chuyển động" (xem app.css). */

/* ---------- 1. Tiện ích ---------- */
function thoat(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const GIAM_CHUYEN_DONG = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICON_RONG = {
  hop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  giay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>',
  nguoi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/></svg>',
  cle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.6-.6-.6-2.6z"/></svg>',
  vi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M16 15h2M6 6V4h12v2"/></svg>',
  kinh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.7 2.7L16 9.5"/></svg>',
  canhbao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>'
};

/* ---------- 2. Thông báo nhỏ (toast) ---------- */
// tuyChon: { nhan: 'Hoàn tác', fn: () => {...}, ms: 8000, loai: 'ok'|'loi'|'tin' }
function showToast(msg, tuyChon) {
  const tc = tuyChon || {};
  const t = document.getElementById('toast'); if (!t) return;
  msg = String(msg == null ? '' : msg);
  const loai = tc.loai || (/^(Lỗi|Không thể|Không tải|Không kết nối)/.test(msg) ? 'loi' : /^(Đã |Xong)/.test(msg) ? 'ok' : 'tin');
  t.className = 'toast toast-' + loai;
  t.textContent = '';
  const s = document.createElement('span'); s.className = 'tMsg'; s.textContent = msg; t.appendChild(s);
  clearTimeout(window._toastTimer);
  const an = () => { t.classList.remove('hien'); t.style.display = 'none'; };
  if (tc.nhan && typeof tc.fn === 'function') {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tNut'; b.textContent = tc.nhan;
    b.addEventListener('click', () => { clearTimeout(window._toastTimer); an(); tc.fn(); });
    t.appendChild(b);
  }
  t.style.display = 'flex';
  void t.offsetWidth; t.classList.add('hien');
  window._toastTimer = setTimeout(an, tc.ms || (tc.nhan ? 8000 : loai === 'loi' ? 5200 : 3200));
  // Tải dữ liệu thất bại: khung xám "đang tải" không được kẹt mãi
  if (loai === 'loi') {
    document.querySelectorAll('.khungXam').forEach(k => {
      k.outerHTML = trangThaiRong({ bieuTuong: 'canhbao', tieuDe: 'Không tải được dữ liệu', moTa: 'Kiểm tra kết nối mạng rồi tải lại trang.', nhan: 'Tải lại trang', hanhDong: 'location.reload()' });
    });
  }
}

/* ---------- 3. Hộp xác nhận ---------- */
// xacNhan({ tieuDe, noiDung (chữ thường, \n\n = đoạn mới), danhSach: [..], nhanDongY, nhanHuy, kieu: 'nguyHiem'|'canhBao'|'thuong', chiMotNut })
// -> Promise<boolean>. Hộp nằm TRÊN popup đang mở (không thay popup), Esc = Huỷ, mặc định focus nút an toàn.
let _xnDangMo = null;
function xacNhan(o) {
  o = o || {};
  return new Promise(resolve => {
    if (_xnDangMo) _xnDangMo.dong(false);
    const truoc = document.activeElement;
    const kieu = o.kieu || 'thuong';
    const bg = document.createElement('div'); bg.className = 'xnBg';
    const doan = String(o.noiDung || '').split(/\n\s*\n/).filter(Boolean).map(p => `<p>${thoat(p).replace(/\n/g, '<br>')}</p>`).join('');
    const ds = (o.danhSach && o.danhSach.length) ? `<ul>${o.danhSach.map(x => `<li>${thoat(x)}</li>`).join('')}</ul>` : '';
    const nhanY = o.nhanDongY || (kieu === 'nguyHiem' ? 'Xoá' : 'Đồng ý');
    bg.innerHTML = `<div class="xnCard xn-${kieu}" role="alertdialog" aria-modal="true" aria-labelledby="xnTieuDe" aria-describedby="xnNoiDung">
        <div class="xnDau"><span class="xnIcon">${kieu === 'thuong' ? ICON_RONG.tick : ICON_RONG.canhbao}</span><h3 id="xnTieuDe">${thoat(o.tieuDe || 'Xác nhận')}</h3></div>
        <div class="xnThan" id="xnNoiDung">${doan}${ds}</div>
        <div class="xnNut">${o.chiMotNut ? '' : `<button type="button" class="btn secondary" data-xn="huy">${thoat(o.nhanHuy || 'Huỷ')}</button>`}<button type="button" class="btn${kieu === 'nguyHiem' ? ' nguyHiem' : ''}" data-xn="ok">${thoat(o.chiMotNut ? (o.nhanDongY || 'Đã hiểu') : nhanY)}</button></div>
      </div>`;
    document.body.appendChild(bg);
    const nutOk = bg.querySelector('[data-xn="ok"]'), nutHuy = bg.querySelector('[data-xn="huy"]');
    const dong = kq => {
      document.removeEventListener('keydown', phim, true);
      bg.remove(); _xnDangMo = null;
      try { if (truoc && truoc.focus && document.contains(truoc)) truoc.focus(); } catch (e) { /* bỏ qua */ }
      resolve(kq);
    };
    const phim = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); dong(false); }
      else if (e.key === 'Tab') {
        const ds2 = [nutHuy, nutOk].filter(Boolean);
        const i = ds2.indexOf(document.activeElement);
        e.preventDefault(); ds2[(i + (e.shiftKey ? -1 : 1) + ds2.length) % ds2.length].focus();
      }
    };
    document.addEventListener('keydown', phim, true);
    bg.addEventListener('mousedown', e => { if (e.target === bg) dong(false); });
    nutOk.addEventListener('click', () => dong(true));
    if (nutHuy) nutHuy.addEventListener('click', () => dong(false));
    _xnDangMo = { dong };
    (kieu === 'thuong' || !nutHuy ? nutOk : nutHuy).focus(); // thao tác nguy hiểm: mặc định đứng ở nút Huỷ, Enter không xoá nhầm
  });
}
function thongBaoHop(tieuDe, noiDung) { return xacNhan({ tieuDe, noiDung, kieu: 'canhBao', chiMotNut: true }); }

/* ---------- 4. Báo lỗi form ---------- */
// loi: [{ el: Element | id, msg }]. Trả về true nếu CÓ lỗi (đã hiển thị, caller `return`).
let _loiDem = 0;
function layGocForm(el) { return (el && el.closest && (el.closest('.modalCard') || el.closest('.panel') || el.closest('.khung'))) || document.body; }
function xoaLoiForm(goc) {
  goc = goc || document;
  goc.querySelectorAll('.coLoi').forEach(f => { f.classList.remove('coLoi'); });
  goc.querySelectorAll('[aria-invalid="true"]').forEach(i => { i.removeAttribute('aria-invalid'); });
  goc.querySelectorAll('.loiO').forEach(x => x.remove());
  goc.querySelectorAll('.tomTatLoi').forEach(x => x.remove());
}
function baoLoiForm(loi) {
  loi = (loi || []).map(l => ({ el: typeof l.el === 'string' ? document.getElementById(l.el) : l.el, msg: l.msg })).filter(l => l.el);
  if (!loi.length) return false;
  const goc = layGocForm(loi[0].el);
  xoaLoiForm(goc);
  const muc = [];
  loi.forEach(l => {
    if (!l.el.id) l.el.id = 'loiEl' + (++_loiDem);
    const f = l.el.closest('.field') || l.el.parentElement;
    f.classList.add('coLoi');
    l.el.setAttribute('aria-invalid', 'true');
    const msgId = 'loi_' + l.el.id;
    const d = document.createElement('div'); d.className = 'loiO'; d.id = msgId; d.textContent = l.msg;
    f.appendChild(d);
    l.el.setAttribute('aria-describedby', msgId);
    muc.push(`<li><a href="#" data-lien="${thoat(l.el.id)}">${thoat(l.msg)}</a></li>`);
  });
  const ts = document.createElement('div'); ts.className = 'tomTatLoi'; ts.setAttribute('role', 'alert'); ts.tabIndex = -1;
  ts.innerHTML = `<b>Cần sửa ${loi.length} mục trước khi lưu</b><ul>${muc.join('')}</ul>`;
  const h = goc.querySelector('h3');
  if (h && h.parentElement === goc) h.after(ts); else goc.prepend(ts);
  ts.scrollIntoView({ block: 'nearest' });
  ts.focus({ preventScroll: true });
  return true;
}
// Bấm mục trong khung tóm tắt -> nhảy tới đúng ô lỗi
document.addEventListener('click', e => {
  const a = e.target.closest('.tomTatLoi a[data-lien]'); if (!a) return;
  e.preventDefault();
  const el = document.getElementById(a.dataset.lien);
  if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
});
// Gõ/chọn lại ô đang lỗi -> bỏ báo lỗi ô đó (và bỏ mục tương ứng trong khung tóm tắt)
function boLoiO(el) {
  const f = el.closest('.field') || el.parentElement;
  if (!f || !f.classList.contains('coLoi')) return;
  f.classList.remove('coLoi'); el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby');
  f.querySelectorAll(':scope > .loiO').forEach(x => x.remove());
  const ts = layGocForm(el).querySelector('.tomTatLoi');
  if (ts) { const li = ts.querySelector(`a[data-lien="${el.id}"]`); if (li) li.parentElement.remove(); const con = ts.querySelectorAll('li').length; if (!con) ts.remove(); else ts.querySelector('b').textContent = `Cần sửa ${con} mục trước khi lưu`; }
}
document.addEventListener('input', e => { if (e.target.closest && e.target.closest('.coLoi')) boLoiO(e.target); });
document.addEventListener('change', e => { if (e.target.closest && e.target.closest('.coLoi')) boLoiO(e.target); });
// Kiểm tra khi rời ô (chỉ hiện dưới ô, chưa hiện khung tóm tắt): ô có data-bat-buoc="Thông báo" hoặc data-so-duong="Thông báo"
document.addEventListener('focusout', e => {
  const el = e.target; if (!el || !el.matches || !el.matches('[data-bat-buoc],[data-so-duong]')) return;
  if (el.closest('.coLoi')) return;
  const v = String(el.value || '').trim();
  let msg = '';
  if (el.hasAttribute('data-bat-buoc') && !v) msg = el.getAttribute('data-bat-buoc');
  else if (el.hasAttribute('data-so-duong') && !(parseSoTien(v) > 0)) msg = el.getAttribute('data-so-duong');
  if (!msg) return;
  if (!el.id) el.id = 'loiEl' + (++_loiDem);
  const f = el.closest('.field') || el.parentElement; f.classList.add('coLoi'); el.setAttribute('aria-invalid', 'true');
  const d = document.createElement('div'); d.className = 'loiO'; d.id = 'loi_' + el.id; d.textContent = msg; f.appendChild(d); el.setAttribute('aria-describedby', d.id);
});
// Kiểm tra các dòng hàng của phiếu. Trả về mảng lỗi cho baoLoiForm (rỗng = ổn). Dòng trống hoàn toàn bị bỏ qua như trước.
function loiDongHang(containerId, khongBatBuoc) {
  const loi = [];
  const rows = [...document.querySelectorAll('#' + containerId + '_list .itemRow')];
  let coHopLe = false;
  rows.forEach((row, i) => {
    const hidden = row.querySelector('.itemHH'), tim = row.querySelector('.itemHHSearch'), sl = row.querySelector('.itemSL');
    const daChon = !!(hidden && hidden.value), daGo = !!(tim && tim.value.trim());
    if (!daChon && !daGo) return;
    if (!daChon) { loi.push({ el: tim, msg: `Dòng ${i + 1}: chọn hàng trong danh sách gợi ý` }); return; }
    if (!(Number(sl.value) > 0)) { loi.push({ el: sl, msg: `Dòng ${i + 1}: số lượng phải lớn hơn 0` }); return; }
    coHopLe = true;
  });
  if (!coHopLe && !loi.length && !khongBatBuoc) {
    const tim = document.querySelector('#' + containerId + '_list .itemHHSearch');
    loi.push({ el: tim || document.getElementById(containerId), msg: 'Thêm ít nhất 1 dòng hàng (gõ tên hoặc mã hàng để tìm)' });
  }
  return loi;
}

/* ---------- 5. Trạng thái rỗng / đang tải ---------- */
// o: { bieuTuong, tieuDe, moTa, nhan, hanhDong (chuỗi JS chạy khi bấm nút) }
function trangThaiRong(o) {
  return `<div class="empty rong"><div class="rongIcon">${ICON_RONG[o.bieuTuong] || ICON_RONG.hop}</div><h4>${thoat(o.tieuDe || '')}</h4>${o.moTa ? `<p>${thoat(o.moTa)}</p>` : ''}${o.nhan ? `<button type="button" class="btn small" onclick="${thoat(o.hanhDong || '')}">${thoat(o.nhan)}</button>` : ''}</div>`;
}
// Màn "không có kết quả khớp bộ lọc" kèm nút xoá bộ lọc (tìm kiếm + chọn lọc)
function trangThaiKhongKhop(idTim, idLoc) {
  return trangThaiRong({ bieuTuong: 'kinh', tieuDe: 'Không có kết quả khớp', moTa: 'Thử đổi từ khoá hoặc bỏ bộ lọc.', nhan: 'Xoá bộ lọc', hanhDong: `datLaiLoc('${idTim || ''}','${idLoc || ''}')` });
}
function datLaiLoc(idTim, idLoc) {
  const t = idTim && document.getElementById(idTim), l = idLoc && document.getElementById(idLoc);
  if (t) { t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); }
  if (l) { l.value = ''; l.dispatchEvent(new Event('change', { bubbles: true })); }
}
function khungXam(n) {
  n = n || 6;
  return `<div class="khungXam" aria-busy="true" aria-label="Đang tải dữ liệu">${Array.from({ length: n }, (_, i) => `<div class="xamDong"><i style="width:${10 + (i * 7) % 12}%"></i><i style="width:${28 + (i * 11) % 22}%"></i><i style="width:${12 + (i * 5) % 10}%"></i><i style="width:${10 + (i * 3) % 8}%"></i></div>`).join('')}</div>`;
}
// Gọi ngay trước khi tải danh sách: chỉ hiện khung xám khi CHƯA có bảng (tránh nháy mỗi lần đổi tab)
function hienDangTai(idWrap, n) {
  const w = document.getElementById(idWrap);
  if (!w || w.querySelector('table')) return;
  w.innerHTML = khungXam(n);
}

/* ---------- 6. Chip lọc nhanh ---------- */
// Dựng chip từ chính các <option> của <select>; demMap: { giaTri: (phanTu) => boolean } để đếm; giá trị '' = tất cả.
function veChipLoc(selId, list, demMap) {
  const sel = document.getElementById(selId); if (!sel) return;
  const boxId = 'chip_' + selId;
  let box = document.getElementById(boxId);
  if (!box) {
    box = document.createElement('div'); box.id = boxId; box.className = 'chipLoc'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Lọc nhanh');
    const tb = sel.closest('.toolbar') || sel.parentElement; tb.after(box);
    sel.classList.add('daCoChip');
    box.addEventListener('click', e => {
      const b = e.target.closest('button[data-v]'); if (!b) return;
      sel.value = b.dataset.v; sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  list = list || []; demMap = demMap || {};
  box.innerHTML = [...sel.options].map(o => {
    const f = demMap[o.value];
    const n = o.value === '' ? list.length : (typeof f === 'function' ? list.filter(f).length : null);
    const bat = sel.value === o.value;
    return `<button type="button" class="chip${bat ? ' on' : ''}${n === 0 && o.value !== '' ? ' trong' : ''}" data-v="${thoat(o.value)}" aria-pressed="${bat}">${thoat(o.text)}${n == null ? '' : ` <b>${n.toLocaleString('vi-VN')}</b>`}</button>`;
  }).join('');
}
// Chip theo 1 trường của dòng dữ liệu (VD TrangThai): demMap tự sinh từ các option
function demTheoTruong(selId, truong) {
  const sel = document.getElementById(selId), m = {};
  if (sel) [...sel.options].forEach(o => { if (o.value) m[o.value] = x => x[truong] === o.value; });
  return m;
}

/* ---------- 7. Dòng vừa lưu nháy sáng ---------- */
// Tìm dòng có nút thao tác chứa mã phiếu (các nút onclick="...('<ID>')") rồi nháy nền.
function nhayDong(id) {
  if (!id) return;
  setTimeout(() => {
    const view = document.querySelector('main .view.active'); if (!view) return;
    const khoa = `'${id}'`;
    const tr = [...view.querySelectorAll('tbody tr')].find(r => { const a = r.querySelector('.rowActions'); return a && a.innerHTML.includes(khoa); });
    if (!tr) return;
    tr.classList.remove('vuaLuu'); void tr.offsetWidth; tr.classList.add('vuaLuu');
    try { tr.scrollIntoView({ block: 'nearest' }); } catch (e) { /* bỏ qua */ }
    setTimeout(() => tr.classList.remove('vuaLuu'), 2400);
  }, 90);
}

/* ---------- 8. Cố định 2 cột đầu khi bảng rộng hơn khung ---------- */
function canCotDauDinh(table) {
  const wrap = table.parentElement;
  if (!wrap || !wrap.classList.contains('tableWrap')) return;
  if (table.querySelectorAll(':scope > thead > tr > th').length < 6) return;
  const cap = () => {
    const t = wrap.querySelector(':scope > table'); if (!t) return;
    const tran = wrap.scrollWidth > wrap.clientWidth + 2;
    t.classList.toggle('cotDauDinh', tran);
    if (tran) { const th = t.querySelector('thead th'); if (th) t.style.setProperty('--w-cot1', th.offsetWidth + 'px'); }
  };
  cap();
  if (!wrap._roCot && window.ResizeObserver) { wrap._roCot = new ResizeObserver(() => requestAnimationFrame(cap)); wrap._roCot.observe(wrap); }
}

/* ---------- 9. Mật độ bảng + giao diện sáng/tối ---------- */
const LS_MATDO = 'pl_mat_do', LS_THEME = 'pl_theme';
function ganMatDo() { document.body.classList.toggle('matDoGon', docLS(LS_MATDO) === 'gon'); const b = document.getElementById('btnMatDo'); if (b) { const gon = docLS(LS_MATDO) === 'gon'; b.setAttribute('aria-pressed', gon); b.title = gon ? 'Bảng đang gọn — bấm để giãn rộng' : 'Bảng đang thoải mái — bấm để thu gọn dòng'; } }
function doiMatDo() { ghiLS(LS_MATDO, docLS(LS_MATDO) === 'gon' ? null : 'gon'); ganMatDo(); showToast(docLS(LS_MATDO) === 'gon' ? 'Bảng: dòng gọn' : 'Bảng: dòng thoải mái', { loai: 'tin', ms: 1600 }); }
function themeHienTai() { const m = docLS(LS_THEME); return m === 'sang' || m === 'toi' ? m : 'auto'; }
function ganTheme() {
  const m = themeHienTai();
  const toi = m === 'toi' || (m === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = toi ? 'dark' : 'light';
  const b = document.getElementById('btnTheme');
  if (b) { b.title = toi ? 'Đang dùng giao diện tối — bấm để chuyển sang sáng' : 'Đang dùng giao diện sáng — bấm để chuyển sang tối'; b.setAttribute('aria-pressed', toi ? 'true' : 'false'); }
}
function doiTheme() {
  // Chỉ 2 trạng thái nhìn thấy được: bấm là đảo ngược cái đang hiện (lần đầu mặc định theo máy, sau đó nhớ lựa chọn của anh/chị)
  const tiep = document.documentElement.dataset.theme === 'dark' ? 'sang' : 'toi';
  ghiLS(LS_THEME, tiep); ganTheme();
  showToast('Giao diện: ' + (tiep === 'toi' ? 'tối' : 'sáng'), { loai: 'tin', ms: 1800 });
}
if (window.matchMedia) { try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ganTheme); } catch (e) { /* trình duyệt cũ */ } }
document.addEventListener('DOMContentLoaded', () => {
  ganMatDo(); ganTheme();
  const a = document.getElementById('btnMatDo'); if (a) a.addEventListener('click', doiMatDo);
  const b = document.getElementById('btnTheme'); if (b) b.addEventListener('click', doiTheme);
  const c = document.getElementById('btnTimNhanh'); if (c) c.addEventListener('click', moTimNhanh);
});

/* ---------- 10. Tìm nhanh (Ctrl+K) ---------- */
let _tn = null;
function nhomChucNang() {
  const ds = [];
  document.querySelectorAll('#tabbar button[data-tab]').forEach(b => {
    if (b.style.display === 'none') return;
    const ten = (b.querySelector('span') || b).textContent.trim();
    ds.push({ nhom: 'Đi tới', ten, phu: '', hanhDong: () => switchTab(b.dataset.tab) });
  });
  const them = [
    ['Tạo phiếu bán hàng', 'xuatban', 'btnAddXuat'], ['Tạo phiếu nhập kho', 'nhapkho', 'btnAddNhap'], ['Tạo báo giá', 'baogia', 'btnAddBaoGia']
  ];
  them.forEach(([ten, tab, idNut]) => {
    if (document.getElementById(idNut)) ds.unshift({ nhom: 'Tạo mới', ten, phu: '', hanhDong: () => { switchTab(tab); setTimeout(() => { const n = document.getElementById(idNut); if (n) n.click(); }, 60); } });
  });
  return ds;
}
function timTrongDuLieu(q) {
  const kq = [];
  const tach = boDau(q).split(/\s+/).filter(Boolean);
  const khop = s => { const h = boDau(s); return tach.every(t => h.includes(t)); };
  (STATE.hangHoaList || []).filter(h => khop([h.MaHH, h.TenHH].join(' '))).slice(0, 6).forEach(h =>
    kq.push({ nhom: 'Hàng hoá, dịch vụ', ten: h.TenHH, phu: `${h.MaHH}${h.Loai === 'HangHoa' ? ' · tồn ' + tonKhoKep(h) : ''}`, hanhDong: () => { switchTab('danhmuc'); setTimeout(() => { if (typeof openEditHH === 'function') openEditHH(h.MaHH); }, 80); } }));
  (STATE.khachHangList || []).filter(k => khop([k.TenKH, k.MST, k.SDT].join(' '))).slice(0, 5).forEach(k =>
    kq.push({ nhom: 'Khách hàng', ten: k.TenKH, phu: `${k.MST || ''} · xem phiếu bán`, hanhDong: () => { const o = document.getElementById('timXuat'); if (o) o.value = k.TenKH; switchTab('xuatban'); } }));
  (STATE.nhaCungCapList || []).filter(k => khop([k.TenNCC, k.MST, k.SDT].join(' '))).slice(0, 4).forEach(k =>
    kq.push({ nhom: 'Nhà cung cấp', ten: k.TenNCC, phu: `${k.MST || ''} · xem phiếu nhập`, hanhDong: () => { const o = document.getElementById('timNhap'); if (o) o.value = k.TenNCC; switchTab('nhapkho'); } }));
  (STATE.xuatBanList || []).filter(x => khop([x.TenKH, x.SoHDDT, x.IDPhieu, x.MSTKhachHang].join(' '))).slice(0, 5).forEach(x =>
    kq.push({ nhom: 'Phiếu bán hàng', ten: `${fmtDate(x.Ngay)} — ${x.TenKH || 'Khách lẻ'}`, phu: `${x.SoHDDT ? 'HĐ ' + x.SoHDDT + ' · ' : ''}${(Number(x.TongTien) || 0).toLocaleString('vi-VN')} đ`, hanhDong: () => viewPhieuNhapXuat('xuat', x.IDPhieu) }));
  (STATE.nhapKhoList || []).filter(x => khop([x.TenNCC, x.SoHDMuaVao, x.IDPhieu].join(' '))).slice(0, 4).forEach(x =>
    kq.push({ nhom: 'Phiếu nhập kho', ten: `${fmtDate(x.Ngay)} — ${x.TenNCC || '—'}`, phu: `${x.SoHDMuaVao ? 'HĐ ' + x.SoHDMuaVao + ' · ' : ''}${(Number(x.TongTien) || 0).toLocaleString('vi-VN')} đ`, hanhDong: () => viewPhieuNhapXuat('nhap', x.IDPhieu) }));
  return kq;
}
function moTimNhanh() {
  if (_tn) { _tn.dong(); return; }
  if (!STATE.token) return;
  const truoc = document.activeElement;
  const bg = document.createElement('div'); bg.className = 'tnBg';
  bg.innerHTML = `<div class="tnCard" role="dialog" aria-modal="true" aria-label="Tìm nhanh">
      <div class="tnO"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input type="text" id="tnInput" placeholder="Gõ tên hàng, khách hàng, số hoá đơn hoặc tên chức năng..." autocomplete="off" role="combobox" aria-expanded="true" aria-controls="tnDs" aria-autocomplete="list"><kbd>Esc</kbd></div>
      <div class="tnDs" id="tnDs" role="listbox"></div>
      <div class="tnChan"><span><kbd>↑</kbd><kbd>↓</kbd> chọn</span><span><kbd>Enter</kbd> mở</span><span><kbd>Alt</kbd>+<kbd>N</kbd> tạo mới</span><span><kbd>Ctrl</kbd>+<kbd>S</kbd> lưu phiếu</span></div>
    </div>`;
  document.body.appendChild(bg);
  const o = bg.querySelector('#tnInput'), ds = bg.querySelector('#tnDs');
  let muc = [], chon = 0;
  const ve = () => {
    const q = o.value.trim();
    const cn = nhomChucNang();
    muc = q ? [...timTrongDuLieu(q), ...cn.filter(c => boDau(c.ten).includes(boDau(q)))] : cn.slice(0, 14);
    if (chon >= muc.length) chon = Math.max(0, muc.length - 1);
    if (!muc.length) { ds.innerHTML = `<div class="tnRong">Không tìm thấy “${thoat(q)}”.</div>`; o.removeAttribute('aria-activedescendant'); return; }
    let nhomCu = '';
    ds.innerHTML = muc.map((m, i) => { const dau = m.nhom !== nhomCu ? `<div class="tnNhom">${thoat(m.nhom)}</div>` : ''; nhomCu = m.nhom; return `${dau}<div class="tnMuc${i === chon ? ' on' : ''}" role="option" id="tnm${i}" aria-selected="${i === chon}" data-i="${i}"><span class="tnTen">${thoat(m.ten)}</span><span class="tnPhu">${thoat(m.phu)}</span></div>`; }).join('');
    o.setAttribute('aria-activedescendant', 'tnm' + chon);
    const dang = ds.querySelector('.tnMuc.on'); if (dang) dang.scrollIntoView({ block: 'nearest' });
  };
  const dong = () => { document.removeEventListener('keydown', phim, true); bg.remove(); _tn = null; try { if (truoc && truoc.focus && document.contains(truoc)) truoc.focus(); } catch (e) { /* bỏ qua */ } };
  const mo = i => { const m = muc[i]; if (!m) return; dong(); m.hanhDong(); };
  const phim = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); dong(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (muc.length) { chon = (chon + 1) % muc.length; ve(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (muc.length) { chon = (chon - 1 + muc.length) % muc.length; ve(); } }
    else if (e.key === 'Enter') { e.preventDefault(); mo(chon); }
  };
  document.addEventListener('keydown', phim, true);
  bg.addEventListener('mousedown', e => { if (e.target === bg) dong(); });
  ds.addEventListener('mousemove', e => { const m = e.target.closest('.tnMuc'); if (m && Number(m.dataset.i) !== chon) { chon = Number(m.dataset.i); ds.querySelectorAll('.tnMuc').forEach((x, i) => { x.classList.toggle('on', i === chon); x.setAttribute('aria-selected', i === chon); }); o.setAttribute('aria-activedescendant', 'tnm' + chon); } });
  ds.addEventListener('click', e => { const m = e.target.closest('.tnMuc'); if (m) mo(Number(m.dataset.i)); });
  o.addEventListener('input', () => { chon = 0; ve(); });
  _tn = { dong };
  ve(); o.focus();
}

/* ---------- 11. Phím tắt chung ---------- */
let _modalDaSua = false; // popup đang mở có bị gõ vào chưa (Esc hỏi lại trước khi bỏ)
function danhDauModalSach() { _modalDaSua = false; }
document.addEventListener('input', e => { if (e.target.closest && e.target.closest('#modalCard')) _modalDaSua = true; });
document.addEventListener('keydown', async e => {
  if (!STATE.token || document.getElementById('appShell').style.display === 'none') return;
  const trongO = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
  // Ctrl+K (hoặc Cmd+K): tìm nhanh. Phím "/" khi không đang gõ.
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); moTimNhanh(); return; }
  if (e.key === '/' && !trongO && !e.ctrlKey && !e.metaKey && !e.altKey && !document.getElementById('modalBg').classList.contains('active') && !_xnDangMo) { e.preventDefault(); moTimNhanh(); return; }
  // Alt+N: tạo mới ở tab đang mở
  if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n') {
    if (document.getElementById('modalBg').classList.contains('active') || _xnDangMo || _tn) return;
    const nut = document.querySelector('main .view.active [id^="btnAdd"], main .view.active #btnKiemKe, main .view.active #btnThuTien');
    if (nut) { e.preventDefault(); nut.click(); }
    return;
  }
  // Ctrl+S: lưu popup đang mở (bấm nút chính của popup)
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
    if (!document.getElementById('modalBg').classList.contains('active') || _xnDangMo) return;
    const nut = [...document.querySelectorAll('#modalCard .modalActions .btn:not(.secondary):not(:disabled)')].pop();
    if (nut) { e.preventDefault(); nut.click(); }
    return;
  }
  // Esc: đóng popup (hỏi lại nếu đã gõ dở)
  if (e.key === 'Escape') {
    if (_xnDangMo || _tn) return; // hộp đó tự xử lý Esc (listener bắt ở pha capture)
    if (document.body.classList.contains('sbMo')) return;
    const bg = document.getElementById('modalBg');
    if (bg.classList.contains('active')) {
      e.preventDefault();
      if (_modalDaSua && document.querySelector('#modalCard .modalActions')) {
        if (!(await xacNhan({ tieuDe: 'Đóng và bỏ nội dung đang nhập?', noiDung: 'Phiếu/biểu mẫu này chưa được lưu.', nhanDongY: 'Đóng, bỏ nội dung', nhanHuy: 'Quay lại nhập tiếp', kieu: 'canhBao' }))) return;
      }
      closeModal();
    }
  }
});

/* ---------- 12. Dòng hàng của phiếu: mũi tên/Enter thao tác nhanh bằng bàn phím ---------- */
document.addEventListener('keydown', e => {
  const t = e.target; if (!t || !t.closest || e.isComposing) return;
  const row = t.closest('.itemRow'); if (!row) return;
  if (t.classList.contains('itemHHSearch')) {
    const list = row.querySelector('.hhComboList');
    const dsMuc = list ? [...list.querySelectorAll('.hhComboItem:not(.hhComboDisabled)')] : [];
    const hienList = list && list.style.display !== 'none' && dsMuc.length;
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && hienList) {
      e.preventDefault();
      let i = dsMuc.findIndex(x => x.classList.contains('hhActive'));
      dsMuc.forEach(x => x.classList.remove('hhActive'));
      i = e.key === 'ArrowDown' ? (i + 1) % dsMuc.length : (i - 1 + dsMuc.length) % dsMuc.length;
      dsMuc[i].classList.add('hhActive'); dsMuc[i].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && hienList) {
      e.preventDefault();
      const muc = dsMuc.find(x => x.classList.contains('hhActive')) || dsMuc[0];
      Promise.resolve(hhComboSelect(muc)).then(() => { if (row.dataset.mahh) { const sl = row.querySelector('.itemSL'); sl.focus(); sl.select(); } });
    }
    return;
  }
  if (e.key !== 'Enter') return;
  if (t.classList.contains('itemSL')) { e.preventDefault(); const g = row.querySelector('.itemGia'); g.focus(); g.select(); }
  else if (t.classList.contains('itemGia')) { e.preventDefault(); row.querySelector('.itemThueSuat').focus(); }
  else if (t.classList.contains('itemThueSuat')) {
    e.preventDefault();
    const list = row.parentElement, rows = [...list.querySelectorAll('.itemRow')], i = rows.indexOf(row);
    if (i < rows.length - 1) rows[i + 1].querySelector('.itemHHSearch').focus();
    else { const them = list.nextElementSibling; if (them && them.tagName === 'BUTTON') { them.click(); const moi = list.querySelectorAll('.itemRow'); moi[moi.length - 1].querySelector('.itemHHSearch').focus(); } }
  }
});
