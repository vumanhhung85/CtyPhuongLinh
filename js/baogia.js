/* ================= BÁO GIÁ =================
   Báo giá KHÔNG trừ kho. Khách đồng ý -> bấm "Chốt → tạo phiếu xuất": mở form phiếu xuất điền sẵn khách + hàng + giá,
   lưu phiếu xuất xong báo giá tự chuyển "Đã chốt" (ghi cùng 1 giao dịch ở máy chủ, không chốt được 2 lần).
   Xoá phiếu xuất đó thì báo giá mở lại "Đã gửi khách". */
const ICON_CHOT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 11.4a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 7H6"/><path d="M10 9.5l2 2 4-4"/></svg>';
const ICON_SAOCHEP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const TRANG_THAI_BG = { Nhap: ['Mới tạo', 'gray'], DaGui: ['Đã gửi khách', 'info'], DaChot: ['Đã chốt', 'good'], Huy: ['Khách không lấy', 'bad'] };
const tagTrangThaiBG = v => { const t = TRANG_THAI_BG[v] || [v || '—', 'info']; return `<span class="tag ${t[1]}">${t[0]}</span>`; };

function renderBaoGiaTable() {
  apiCall('getBaoGiaList', { gioiHan: STATE_DA_TAI_HET.baogia ? null : GIOI_HAN_MAC_DINH }).then(list => {
    STATE.baoGiaList = list;
    drawBaoGiaTable();
  }).catch(err => showToast('Lỗi: ' + err.message));
}
function veKpiBaoGia() {
  const list = STATE.baoGiaList || [];
  const thangNay = list.filter(x => laThangNay(x.Ngay));
  const dangCho = list.filter(x => ['Nhap', 'DaGui'].includes(x.TrangThai));
  const chotThang = thangNay.filter(x => x.TrangThai === 'DaChot');
  const daKetThucThang = thangNay.filter(x => ['DaChot', 'Huy'].includes(x.TrangThai)).length;
  veKpi('kpiBaoGia', [
    { label: 'Báo giá tháng này', val: fmtMoney(tongTien(thangNay, x => x.TongTien)), mau: 'blue', phu: thangNay.length + ' báo giá' },
    { label: 'Đang chờ khách trả lời', val: fmtMoney(tongTien(dangCho, x => x.TongTien)), mau: 'orange', phu: dangCho.length + ' báo giá' },
    { label: 'Đã chốt tháng này', val: fmtMoney(tongTien(chotThang, x => x.TongTien)), mau: 'green', phu: chotThang.length + ' báo giá' },
    { label: 'Tỉ lệ chốt tháng này', val: daKetThucThang ? Math.round(chotThang.length * 100 / daKetThucThang) + '%' : '—', mau: 'gray', phu: 'trên số báo giá đã có kết quả' }
  ]);
}
function drawBaoGiaTable() {
  veKpiBaoGia();
  const wrap = document.getElementById('baoGiaTableWrap');
  const list = STATE.baoGiaList || [];
  if (!list.length) { wrap.innerHTML = '<div class="empty">Chưa có báo giá nào. Bấm "+ Tạo báo giá" để lập báo giá đầu tiên.</div>'; return; }
  const hienThi = locDanhSach(list, 'timBaoGia', 'locBaoGia', x => [x.SoBaoGia, x.TenKH, x.TieuDe, x.GhiChu].join(' '), (x, loc) => x.TrangThai === loc);
  if (!hienThi.length) { wrap.innerHTML = '<div class="empty">Không có báo giá nào khớp bộ lọc.</div>'; return; }
  const goiY = !STATE_DA_TAI_HET.baogia ? `<p class="muted" style="margin:8px 0;">Đang hiện ${list.length} báo giá gần đây (+ mọi báo giá đang chờ). <a href="#" onclick="STATE_DA_TAI_HET.baogia=true;renderBaoGiaTable();return false;">Xem toàn bộ</a></p>` : '';
  wrap.innerHTML = `${goiY}<table><thead><tr><th>Số báo giá</th><th>Ngày</th><th>Khách hàng</th><th>Nội dung</th><th>Tổng tiền</th><th>Hiệu lực đến</th><th>Trạng thái</th><th></th></tr></thead><tbody>
    ${hienThi.map(x => {
      const chot = x.TrangThai === 'DaChot';
      const hetHan = !chot && x.TrangThai !== 'Huy' && x.HieuLucDen && x.HieuLucDen < todayISO();
      return `<tr>
        <td><b>${x.SoBaoGia || ''}</b></td><td>${fmtDate(x.Ngay)}</td><td>${x.TenKH || '—'}</td><td>${x.TieuDe || ''}</td>
        <td>${fmtMoney(x.TongTien)}</td>
        <td>${x.HieuLucDen ? fmtDate(x.HieuLucDen) : ''}${hetHan ? ' <span class="tag warn">Hết hạn</span>' : ''}</td>
        <td>${tagTrangThaiBG(x.TrangThai)}${chot && x.IDPhieuXuat ? `<div class="muted" style="font-size:11.5px;">${x.IDPhieuXuat}</div>` : ''}</td>
        <td class="rowActions">
          <button class="iconBtn" title="In báo giá" onclick="inBaoGia('${x.IDPhieu}')">${ICON_IN}</button>
          ${!chot ? `<button class="iconBtn" title="Sửa báo giá" onclick="openBaoGiaForm('${x.IDPhieu}')">${ICON_SUA}</button>` : ''}
          ${!chot ? `<button class="iconBtn" title="Đổi trạng thái" onclick="openTrangThaiBaoGia('${x.IDPhieu}')">${ICON_TRANGTHAI}</button>` : ''}
          ${!chot && x.TrangThai !== 'Huy' ? `<button class="iconBtn iconPrimary" title="Chốt → tạo phiếu xuất" onclick="chuyenBaoGiaThanhPhieuXuat('${x.IDPhieu}')">${ICON_CHOT}</button>` : ''}
          <button class="iconBtn" title="Tạo bản sao" onclick="openBaoGiaForm('${x.IDPhieu}', true)">${ICON_SAOCHEP}</button>
          <button class="iconBtn iconDanger" title="Xoá" onclick="xoaBaoGiaUI('${x.IDPhieu}')">${ICON_XOA}</button>
        </td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}
document.getElementById('btnAddBaoGia').addEventListener('click', () => openBaoGiaForm(null));
document.getElementById('timBaoGia').addEventListener('input', drawBaoGiaTable);
document.getElementById('locBaoGia').addEventListener('change', drawBaoGiaTable);

const _escAttr = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function congNgay(iso, soNgay) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + (Number(soNgay) || 0)); return ngayISO(d); }

// idPhieu null = tạo mới; saoChep = true -> mở báo giá cũ làm mẫu, lưu thành báo giá MỚI (số mới, trạng thái "Mới tạo").
function openBaoGiaForm(idPhieu, saoChep) {
  const p = idPhieu ? (STATE.baoGiaList || []).find(x => x.IDPhieu === idPhieu) : null;
  if (idPhieu && !p) return;
  Promise.all([layThongTinCongTy().catch(() => ({})), p ? apiCall('getBaoGiaDetail', { idPhieu }) : Promise.resolve({ items: [] })]).then(([ct, res]) => {
    const homNay = todayISO();
    const ngay = p && !saoChep ? p.Ngay : homNay;
    const hieuLuc = p && !saoChep ? (p.HieuLucDen || '') : congNgay(homNay, ct.HieuLucBaoGiaNgay || 30);
    const coTrongDanhMuc = p && p.MaKH && STATE.khachHangList.some(k => k.MaKH === p.MaKH);
    const doiTacOptions = STATE.khachHangList.map(d => `<option value="${d.MaKH}" ${p && d.MaKH === p.MaKH ? 'selected' : ''}>${_escAttr(d.TenKH)}</option>`).join('');
    const sua = p && !saoChep;
    openModal(`
      <button class="modalClose" onclick="closeModal()">&times;</button>
      <h3>${sua ? 'Sửa báo giá ' + p.SoBaoGia : (saoChep ? 'Tạo báo giá mới từ ' + p.SoBaoGia : 'Tạo báo giá')}</h3>
      <div class="formGrid">
        <div class="field"><label>Ngày báo giá</label><input type="date" id="fNgay" value="${ngay}"></div>
        <div class="field"><label>Hiệu lực đến</label><input type="date" id="fHieuLuc" value="${hieuLuc}"></div>
        <div class="field"><label>Khách hàng</label><select id="fDoiTac" onchange="dienKhachBaoGia()"><option value="">-- Khách chưa có trong danh mục (gõ tên bên cạnh) --</option>${doiTacOptions}</select></div>
        <div class="field"><label>Tên khách (nếu chưa có trong danh mục)</label><input id="fTenKhachTay" value="${p && !coTrongDanhMuc ? _escAttr(p.TenKH) : ''}" placeholder="VD: Công ty ABC"></div>
        <div class="field span2"><label>Địa chỉ khách</label><input id="fDiaChiKH" value="${_escAttr(p ? p.DiaChiKH : '')}"></div>
        <div class="field"><label>Mã số thuế khách</label><input id="fMSTKhach" type="tel" value="${_escAttr(p ? p.MSTKhachHang : '')}"></div>
        <div class="field"><label>Người liên hệ</label><input id="fNguoiLienHe" value="${_escAttr(p ? p.NguoiLienHe : '')}" placeholder="VD: Anh Nam – Phòng HC, 09xx..."></div>
        <div class="field span2"><label>Về việc (tiêu đề báo giá)</label><input id="fTieuDe" value="${_escAttr(p ? p.TieuDe : '')}" placeholder="VD: Báo giá lắp đặt camera giám sát văn phòng"></div>
      </div>
      <p class="muted" style="margin:12px 0 4px;">Hàng hoá / dịch vụ báo giá (giá gợi ý = giá bán trong danh mục, sửa tự do; báo giá không trừ kho — mặt hàng chưa có trong danh mục cần thêm ở trang Hàng hoá, dịch vụ trước):</p>
      <div id="bgItemsContainer"></div>
      <div class="formGrid" style="margin-top:12px;">
        <div class="field span2"><label>Điều khoản (mỗi dòng 1 ý — in dưới bảng giá)</label><textarea id="fDieuKhoan" rows="4">${escIn(p ? p.DieuKhoan : (ct.DieuKhoanBaoGia || ''))}</textarea></div>
        <div class="field span2"><label>Ghi chú thêm (in kèm điều khoản, có thể để trống)</label><input id="fGhiChuPhieu" value="${_escAttr(p ? p.GhiChu : '')}"></div>
      </div>
      <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="submitBaoGia(${sua ? `'${p.IDPhieu}'` : 'null'})">${sua ? 'Lưu thay đổi' : 'Lưu báo giá'}</button></div>
    `);
    renderItemsTableInto('bgItemsContainer', 'bao_gia');
    const items = res.items || [];
    if (items.length) items.forEach(it => addItemRowInto('bgItemsContainer', 'bao_gia', it));
    else addItemRowInto('bgItemsContainer', 'bao_gia');
    recalcGrandTotalGeneric('bgItemsContainer');
  }).catch(err => showToast('Lỗi: ' + err.message));
}
function dienKhachBaoGia() {
  const kh = timKhachHang(document.getElementById('fDoiTac').value);
  if (!kh) return;
  document.getElementById('fTenKhachTay').value = '';
  document.getElementById('fDiaChiKH').value = kh.DiaChi || '';
  document.getElementById('fMSTKhach').value = kh.MST || '';
}
function submitBaoGia(idPhieu) {
  const items = readItemsFrom('bgItemsContainer');
  if (!items.length) { showToast('Vui lòng thêm ít nhất 1 dòng hàng hợp lệ.'); return; }
  if (!xacNhanDonGiaKhong(items)) return;
  const sel = document.getElementById('fDoiTac');
  const kh = timKhachHang(sel.value);
  const tenTay = document.getElementById('fTenKhachTay').value.trim();
  const data = {
    IDPhieu: idPhieu || undefined,
    Ngay: document.getElementById('fNgay').value, HieuLucDen: document.getElementById('fHieuLuc').value,
    MaKH: kh ? kh.MaKH : '', TenKH: kh ? kh.TenKH : tenTay,
    DiaChiKH: document.getElementById('fDiaChiKH').value.trim(), MSTKhachHang: document.getElementById('fMSTKhach').value.trim(),
    NguoiLienHe: document.getElementById('fNguoiLienHe').value.trim(), TieuDe: document.getElementById('fTieuDe').value.trim(),
    DieuKhoan: document.getElementById('fDieuKhoan').value.trim(), GhiChu: document.getElementById('fGhiChuPhieu').value.trim(), items
  };
  if (!data.TenKH) { showToast('Chọn khách hàng hoặc gõ tên khách.'); return; }
  apiCall('saveBaoGia', { data }).then(res => {
    closeModal();
    showToast(idPhieu ? 'Đã lưu thay đổi báo giá.' : `Đã tạo báo giá ${res.phieu.SoBaoGia}.`);
    STATE.baoGiaList = STATE.baoGiaList || [];
    const i = STATE.baoGiaList.findIndex(x => x.IDPhieu === res.idPhieu);
    if (i >= 0) STATE.baoGiaList[i] = res.phieu; else STATE.baoGiaList.unshift(res.phieu);
    drawBaoGiaTable();
    if (!idPhieu) setTimeout(() => inBaoGia(res.idPhieu), 300); // tạo xong mở luôn bản in để gửi khách
  }).catch(err => showToast('Lỗi: ' + err.message));
}
function openTrangThaiBaoGia(idPhieu) {
  const p = (STATE.baoGiaList || []).find(x => x.IDPhieu === idPhieu);
  if (!p) return;
  openModal(`
    <button class="modalClose" onclick="closeModal()">&times;</button>
    <h3>Trạng thái báo giá ${p.SoBaoGia}</h3>
    <div class="formGrid"><div class="field span2"><label>Trạng thái</label><select id="fTrangThaiBG">
      ${['Nhap', 'DaGui', 'Huy'].map(v => `<option value="${v}" ${p.TrangThai === v ? 'selected' : ''}>${TRANG_THAI_BG[v][0]}</option>`).join('')}
    </select></div></div>
    <p class="muted">"Đã chốt" được đặt tự động khi bấm nút <b>Chốt → tạo phiếu xuất</b> và lưu phiếu xuất.</p>
    <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="luuTrangThaiBaoGia('${idPhieu}')">Lưu</button></div>
  `);
}
function luuTrangThaiBaoGia(idPhieu) {
  const trangThai = document.getElementById('fTrangThaiBG').value;
  apiCall('capNhatTrangThaiBaoGia', { idPhieu, trangThai }).then(() => {
    closeModal(); showToast('Đã cập nhật trạng thái.');
    const p = STATE.baoGiaList.find(x => x.IDPhieu === idPhieu); if (p) p.TrangThai = trangThai;
    drawBaoGiaTable();
  }).catch(err => showToast('Lỗi: ' + err.message));
}
function xoaBaoGiaUI(idPhieu) {
  const p = (STATE.baoGiaList || []).find(x => x.IDPhieu === idPhieu);
  if (!confirm(`Xoá báo giá ${p ? p.SoBaoGia : ''}?${p && p.TrangThai === 'DaChot' ? '\n(Phiếu xuất đã tạo từ báo giá này vẫn giữ nguyên.)' : ''}`)) return;
  apiCall('xoaBaoGia', { idPhieu }).then(() => {
    showToast('Đã xoá báo giá.');
    STATE.baoGiaList = STATE.baoGiaList.filter(x => x.IDPhieu !== idPhieu);
    drawBaoGiaTable();
  }).catch(err => showToast('Lỗi: ' + err.message));
}
// Gọi từ submitPhieuXuat (js/nhap-xuat.js) khi lưu phiếu xuất tạo từ báo giá thành công.
function daChotBaoGiaTrongState(idBaoGia, idPhieuXuat) {
  const p = (STATE.baoGiaList || []).find(x => x.IDPhieu === idBaoGia);
  if (p) { p.TrangThai = 'DaChot'; p.IDPhieuXuat = idPhieuXuat; }
  if (document.getElementById('view-baogia').classList.contains('active')) drawBaoGiaTable();
}
function chuyenBaoGiaThanhPhieuXuat(idPhieu) {
  const p = (STATE.baoGiaList || []).find(x => x.IDPhieu === idPhieu);
  if (!p) return;
  if (p.TrangThai === 'DaChot') { showToast('Báo giá đã chốt rồi.'); return; }
  apiCall('getBaoGiaDetail', { idPhieu }).then(res => {
    const items = res.items || [];
    openPhieuXuatForm();
    _baoGiaDangChuyen = idPhieu;
    document.querySelector('#modalCard h3').textContent = `Tạo phiếu xuất từ báo giá ${p.SoBaoGia}`;
    const sel = document.getElementById('fDoiTac');
    if (p.MaKH && [...sel.options].some(o => o.value === p.MaKH)) sel.value = p.MaKH;
    document.getElementById('fMSTKhach').value = p.MSTKhachHang || '';
    document.getElementById('fGhiChuPhieu').value = `Theo báo giá ${p.SoBaoGia}`;
    document.getElementById('xuatItemsContainer_list').innerHTML = '';
    items.forEach(it => addItemRowInto('xuatItemsContainer', 'gia_ban', it));
    recalcGrandTotalGeneric('xuatItemsContainer');
    // Báo trước mặt hàng không đủ tồn (máy chủ vẫn chặn khi lưu) — để anh nhập kho / nhập tồn đầu kỳ trước.
    const can = {};
    items.forEach(it => {
      const h = STATE.hangHoaList.find(x => x.MaHH === it.MaHH);
      if (h && h.Loai === 'HangHoa') can[it.MaHH] = (can[it.MaHH] || 0) + (Number(it.SoLuongQuyDoi) || Number(it.SoLuong) || 0);
    });
    const thieu = Object.keys(can).map(ma => ({ h: STATE.hangHoaList.find(x => x.MaHH === ma), can: can[ma] })).filter(x => (Number(x.h.TonKho) || 0) < x.can - 1e-9);
    const ghiChu = document.createElement('div');
    ghiChu.className = 'hopGhiChu';
    ghiChu.style.margin = '0 0 12px';
    ghiChu.innerHTML = `Khách: <b>${escIn(p.TenKH || '')}</b>${!p.MaKH || !sel.value ? ' — <span style="color:var(--warn)">khách chưa có trong danh mục: chọn lại ở ô Khách hàng hoặc thêm khách ở trang Khách hàng, NCC</span>' : ''}. Lưu phiếu này sẽ trừ kho và chuyển báo giá sang "Đã chốt".`
      + (thieu.length ? `<div style="color:var(--bad);margin-top:6px;"><b>Kho chưa đủ:</b> ${thieu.map(x => `${escIn(x.h.TenHH)} (cần ${fmtSoLuong(x.can)}, còn ${fmtSoLuong(x.h.TonKho)} ${escIn(x.h.DVT || '')})`).join('; ')} — tạo phiếu Nhập kho hoặc "Nhập tồn đầu kỳ" (trang Kiểm kê kho) trước rồi chốt lại.</div>` : '');
    document.querySelector('#modalCard .formGrid').before(ghiChu);
  }).catch(err => showToast('Lỗi: ' + err.message));
}
