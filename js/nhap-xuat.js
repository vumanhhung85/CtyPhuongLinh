/* ================= NHẬP KHO ================= */
const STATE_DA_TAI_HET = {}; // đánh dấu tab nào đã bấm "Xem toàn bộ lịch sử" rồi (khỏi giới hạn lại)
const GIOI_HAN_MAC_DINH = 200; // tải 200 giao dịch gần đây nhất theo mặc định, đủ dùng đa số ngày làm việc

function renderNhapKhoTable() {
  hienDangTai('nhapTableWrap');
  apiCall('getNhapKhoList', { gioiHan: STATE_DA_TAI_HET.nhap ? null : GIOI_HAN_MAC_DINH }).then(list => {
    STATE.nhapKhoList = list.sort((a, b) => (b.Timestamp || '').localeCompare(a.Timestamp || ''));
    drawNhapKhoTable();
  }).catch(err => showToast('Lỗi: ' + err.message));
}
function xemToanBoLichSu(loai) {
  STATE_DA_TAI_HET[loai] = true;
  showToast('Đang tải toàn bộ lịch sử...');
  ({ nhap: renderNhapKhoTable, xuat: renderXuatBanTable, suachua: renderSuaChuaTable, giacong: renderGiaCongTable })[loai]();
}
// Thẻ số liệu đầu trang Nhập kho. "Còn phải trả" chính xác vì danh sách luôn kèm mọi phiếu còn nợ dù cũ.
function veKpiNhap() {
  const list = STATE.nhapKhoList || [];
  const thangNay = list.filter(n => laThangNay(n.Ngay));
  const conNo = list.filter(n => (Number(n.TongTien) || 0) - (Number(n.DaTra) || 0) > 0);
  veKpi('kpiNhap', [
    { label: 'Nhập kho tháng này (sau thuế)', val: fmtMoney(tongTien(thangNay, n => n.TongTien)), mau: 'blue', phu: thangNay.length + ' phiếu' },
    { label: 'Còn phải trả nhà cung cấp', val: fmtMoney(tongTien(conNo, n => (Number(n.TongTien) || 0) - (Number(n.DaTra) || 0))), mau: 'orange', phu: conNo.length + ' phiếu' },
    { label: 'Đã trả tháng này', val: fmtMoney(tongTien(thangNay, n => n.DaTra)), mau: 'green' },
    { label: 'Chưa có số HĐ mua vào', val: list.filter(n => !n.SoHDMuaVao).length + ' phiếu', mau: 'gray' }
  ]);
}
function locDanhSach(list, oTim, oLoc, fnChu, fnLoc) {
  const q = boDau(document.getElementById(oTim).value.trim());
  const loc = document.getElementById(oLoc).value;
  return list.filter(x => (!q || boDau(fnChu(x)).includes(q)) && (!loc || fnLoc(x, loc)));
}
function drawNhapKhoTable() {
    veKpiNhap();
    const wrap = document.getElementById('nhapTableWrap');
    veChipLoc('locNhap', STATE.nhapKhoList, { conNo: n => (Number(n.TongTien) || 0) - (Number(n.DaTra) || 0) > 0, chuaHD: n => !n.SoHDMuaVao });
    if (STATE.nhapKhoList.length === 0) { wrap.innerHTML = trangThaiRong({ bieuTuong: 'hop', tieuDe: 'Chưa có phiếu nhập kho nào', moTa: 'Nhập kho khi mua hàng về — tồn kho và giá vốn bình quân tự cập nhật.', nhan: '+ Tạo phiếu nhập', hanhDong: "document.getElementById('btnAddNhap').click()" }); return; }
    const hienThi = locDanhSach(STATE.nhapKhoList, 'timNhap', 'locNhap', n => [n.TenNCC, n.SoHDMuaVao, n.IDPhieu, n.GhiChu].join(' '),
      (n, loc) => loc === 'conNo' ? (Number(n.TongTien) || 0) - (Number(n.DaTra) || 0) > 0 : !n.SoHDMuaVao);
    if (hienThi.length === 0) { wrap.innerHTML = trangThaiKhongKhop('timNhap', 'locNhap'); return; }
    const goiYXemThem = !STATE_DA_TAI_HET.nhap ? `<p class="muted" style="margin:8px 0;">Đang hiện ${STATE.nhapKhoList.length} phiếu gần đây (+ các phiếu còn nợ dù cũ). <a href="#" onclick="xemToanBoLichSu('nhap');return false;">Xem toàn bộ lịch sử</a></p>` : '';
    wrap.innerHTML = `${goiYXemThem}<table><thead><tr><th>Ngày</th><th>Nhà cung cấp</th><th>Số HĐ mua vào</th><th>Tổng thanh toán</th><th>Đã trả</th><th>Còn nợ</th><th>Người tạo</th><th></th></tr></thead><tbody>
      ${hienThi.map(n => { const conNo = (Number(n.TongTien) || 0) - (Number(n.DaTra) || 0); return `<tr>
        <td>${fmtDate(n.Ngay)}</td><td>${n.TenNCC || '—'}</td><td>${n.SoHDMuaVao || '—'}</td>
        <td>${fmtMoney(n.TongTien)}</td><td>${fmtMoney(n.DaTra)}</td>
        <td>${conNo > 0 ? `<span class="tag warn">${fmtMoney(conNo)}</span>` : '<span class="tag good">Đã trả đủ</span>'}</td>
        <td class="muted">${n.NguoiTao || ''}</td>
        <td class="rowActions"><button class="iconBtn" title="In phiếu nhập kho" onclick="inPhieuNhapKho('${n.IDPhieu}')">${ICON_IN}</button><button class="iconBtn" title="Xem" onclick="viewPhieuNhapXuat('nhap','${n.IDPhieu}')">${ICON_XEM}</button><button class="iconBtn iconDanger" title="Xoá" onclick="xoaPhieuUI('nhap','${n.IDPhieu}')">${ICON_XOA}</button></td>
      </tr>`; }).join('')}
    </tbody></table>`;
}
document.getElementById('btnAddNhap').addEventListener('click', openPhieuNhapForm);

function openPhieuNhapForm() {
  const doiTacOptions = STATE.nhaCungCapList.map(d => `<option value="${d.MaNCC}" data-ten="${d.TenNCC}">${d.TenNCC}</option>`).join('');
  openModal(`
    <button class="modalClose" onclick="closeModal()">&times;</button>
    <h3>Tạo phiếu nhập kho</h3>
    <div class="formGrid">
      <div class="field"><label>Ngày</label><input type="date" id="fNgay" value="${todayISO()}"></div>
      <div class="field"><label>Nhà cung cấp</label><select id="fDoiTac"><option value="">-- Chọn hoặc để trống --</option>${doiTacOptions}</select></div>
      <div class="field span2"><label>Số hoá đơn mua vào (đầu vào)</label><input id="fSoHD" placeholder="Số hoá đơn từ nhà cung cấp"></div>
      <div class="field span2"><label>Ghi chú</label><input id="fGhiChuPhieu"></div>
    </div>
    <div id="nhapItemsContainer"></div>
    <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="submitPhieuNhap()">Lưu phiếu</button></div>
  `);
  renderItemsTableInto('nhapItemsContainer', 'gia_von');
  addItemRowInto('nhapItemsContainer', 'gia_von');
}
async function submitPhieuNhap() {
  const loi = loiDongHang('nhapItemsContainer');
  if (!document.getElementById('fNgay').value) loi.unshift({ el: 'fNgay', msg: 'Chọn ngày lập phiếu' });
  if (baoLoiForm(loi)) return;
  const items = readItemsFrom('nhapItemsContainer');
  if (!(await xacNhanDonGiaKhong(items))) return;
  const doiTacSel = document.getElementById('fDoiTac'); const doiTacOpt = doiTacSel.selectedOptions[0];
  const data = {
    Ngay: document.getElementById('fNgay').value, GhiChu: document.getElementById('fGhiChuPhieu').value,
    MaNCC: doiTacSel.value, TenNCC: doiTacOpt ? doiTacOpt.dataset.ten : '',
    SoHDMuaVao: document.getElementById('fSoHD').value, items
  };
  guiPhieuNhap(data);
}
function guiPhieuNhap(data) {
  apiCall('saveNhapKho', { data }).then(res => {
    closeModal(); showToast('Đã lưu phiếu nhập kho.', thamSoHoanTac('nhap', res && res.phieu ? res.phieu.IDPhieu : res && res.idPhieu));
    // Gộp thẳng phiếu + tồn kho mới vào STATE và vẽ lại — khỏi phải gọi mạng lại 2 lần (getNhapKhoList + getHangHoaList).
    if (res && res.phieu) {
      STATE.nhapKhoList.unshift(res.phieu);
      mergeTonKhoVaoState(res.tonKhoCapNhat);
      drawNhapKhoTable();
      drawHangHoaTable();
      nhayDong(res.phieu.IDPhieu);
    } else {
      renderNhapKhoTable(); renderHangHoaTable();
    }
  }).catch(async err => {
    // Số HĐ mua vào đã có phiếu nhập của cùng nhà cung cấp (VD đã nhập từ bảng kê) -> hỏi trước, tránh cộng tồn 2 lần
    const msg = String(err.message || '');
    if (msg.startsWith('HOA_DON_DA_NHAP')) {
      const lyDo = msg.replace(/^HOA_DON_DA_NHAP:\s*/, '');
      if (await xacNhan({ tieuDe: 'Số hoá đơn này đã có phiếu nhập', noiDung: lyDo + '\n\nChỉ lưu tiếp khi chắc chắn đây là hoá đơn KHÁC (ví dụ khác ký hiệu). Nếu không, tồn kho sẽ bị cộng 2 lần.', kieu: 'canhBao', nhanDongY: 'Đây là hoá đơn khác — vẫn lưu', nhanHuy: 'Không lưu' })) {
        guiPhieuNhap({ ...data, choPhepTrungSoHD: true });
      }
      return;
    }
    showToast('Lỗi: ' + msg);
  });
}

/* ================= XUẤT BÁN ================= */
function renderXuatBanTable() {
  hienDangTai('xuatTableWrap');
  apiCall('getXuatBanList', { gioiHan: STATE_DA_TAI_HET.xuat ? null : GIOI_HAN_MAC_DINH }).then(list => {
    STATE.xuatBanList = list.sort((a, b) => (b.Timestamp || '').localeCompare(a.Timestamp || ''));
    drawXuatBanTable();
  }).catch(err => showToast('Lỗi: ' + err.message));
}
// Thẻ số liệu đầu trang Bán hàng. "Còn phải thu" và "Chưa xuất HĐ" chính xác vì danh sách luôn kèm mọi phiếu
// còn nợ / chưa xuất HĐ dù cũ.
function veKpiXuat() {
  const list = STATE.xuatBanList || [];
  const thangNay = list.filter(x => laThangNay(x.Ngay));
  const conNo = list.filter(x => (Number(x.TongTien) || 0) - (Number(x.DaThu) || 0) > 0);
  const chuaHD = list.filter(x => x.TrangThaiHD !== 'DaXuat');
  veKpi('kpiXuat', [
    { label: 'Bán hàng tháng này (sau thuế)', val: fmtMoney(tongTien(thangNay, x => x.TongTien)), mau: 'blue', phu: thangNay.length + ' phiếu' },
    { label: 'Chưa xuất hoá đơn', val: fmtMoney(tongTien(chuaHD, x => x.TongTien)), mau: 'navy', phu: chuaHD.length + ' phiếu' },
    { label: 'Khách còn nợ', val: fmtMoney(tongTien(conNo, x => (Number(x.TongTien) || 0) - (Number(x.DaThu) || 0))), mau: 'orange', phu: conNo.length + ' phiếu' },
    { label: 'Đã thu tháng này', val: fmtMoney(tongTien(thangNay, x => x.DaThu)), mau: 'green' }
  ]);
}
function drawXuatBanTable() {
    veKpiXuat();
    const wrap = document.getElementById('xuatTableWrap');
    veChipLoc('locXuat', STATE.xuatBanList, { conNo: x => (Number(x.TongTien) || 0) - (Number(x.DaThu) || 0) > 0, chuaHD: x => x.TrangThaiHD !== 'DaXuat' });
    if (STATE.xuatBanList.length === 0) { wrap.innerHTML = trangThaiRong({ bieuTuong: 'giay', tieuDe: 'Chưa có phiếu bán hàng nào', moTa: 'Lập phiếu xuất bán hoặc chốt từ một báo giá — tồn kho tự trừ.', nhan: '+ Tạo phiếu xuất', hanhDong: "document.getElementById('btnAddXuat').click()" }); return; }
    const hienThi = locDanhSach(STATE.xuatBanList, 'timXuat', 'locXuat', x => [x.TenKH || 'Khách lẻ', x.SoHDDT, x.IDPhieu, x.MSTKhachHang, x.GhiChu].join(' '),
      (x, loc) => loc === 'conNo' ? (Number(x.TongTien) || 0) - (Number(x.DaThu) || 0) > 0 : x.TrangThaiHD !== 'DaXuat');
    if (hienThi.length === 0) { wrap.innerHTML = trangThaiKhongKhop('timXuat', 'locXuat'); return; }
    const goiYXemThem = !STATE_DA_TAI_HET.xuat ? `<p class="muted" style="margin:8px 0;">Đang hiện ${STATE.xuatBanList.length} phiếu gần đây (+ các phiếu còn nợ/chưa xuất HĐ dù cũ). <a href="#" onclick="xemToanBoLichSu('xuat');return false;">Xem toàn bộ lịch sử</a></p>` : '';
    wrap.innerHTML = `${goiYXemThem}<table><thead><tr><th>Ngày</th><th>Khách hàng</th><th>Số HĐĐT</th><th>Tổng thanh toán</th><th>Đã thu</th><th>Còn nợ</th><th>Trạng thái HĐ</th><th>Người tạo</th><th></th></tr></thead><tbody>
      ${hienThi.map(x => { const conNo = (Number(x.TongTien) || 0) - (Number(x.DaThu) || 0); return `<tr>
        <td>${fmtDate(x.Ngay)}</td><td>${x.TenKH || 'Khách lẻ'}</td><td>${x.SoHDDT || '—'}</td>
        <td>${fmtMoney(x.TongTien)}</td><td>${fmtMoney(x.DaThu)}</td>
        <td>${conNo > 0 ? `<span class="tag warn">${fmtMoney(conNo)}</span>` : '<span class="tag good">Đã thu đủ</span>'}</td>
        <td>${x.TrangThaiHD === 'DaXuat' ? '<span class="tag good">Đã xuất HĐ</span>' : '<span class="tag bad">Chưa xuất HĐ</span>'}</td>
        <td class="muted">${x.NguoiTao || ''}</td>
        <td class="rowActions">${x.TrangThaiHD !== 'DaXuat' ? `<button class="iconBtn" title="Sửa phiếu" onclick="openSuaPhieuXuatForm('${x.IDPhieu}')">${ICON_SUA}</button>` : ''}<button class="iconBtn iconPrimary" title="Cập nhật hoá đơn" onclick="openCapNhatHD('xuat','${x.IDPhieu}')">${ICON_HD}</button><button class="iconBtn" title="In biên bản giao nhận" onclick="inBienBanGiaoNhan('${x.IDPhieu}')">${ICON_IN}</button><button class="iconBtn" title="Xem" onclick="viewPhieuNhapXuat('xuat','${x.IDPhieu}')">${ICON_XEM}</button><button class="iconBtn iconDanger" title="Xoá" onclick="xoaPhieuUI('xuat','${x.IDPhieu}')">${ICON_XOA}</button></td>
      </tr>`; }).join('')}
    </tbody></table>`;
}
document.getElementById('btnAddXuat').addEventListener('click', openPhieuXuatForm);
document.getElementById('timXuat').addEventListener('input', drawXuatBanTable);
document.getElementById('locXuat').addEventListener('change', drawXuatBanTable);
document.getElementById('timNhap').addEventListener('input', drawNhapKhoTable);
document.getElementById('locNhap').addEventListener('change', drawNhapKhoTable);

let _baoGiaDangChuyen = null; // IDPhieu báo giá đang được chuyển thành phiếu xuất (xem js/baogia.js)
function openPhieuXuatForm() {
  _baoGiaDangChuyen = null;
  const doiTacOptions = STATE.khachHangList.map(d => `<option value="${d.MaKH}" data-ten="${d.TenKH}">${d.TenKH}</option>`).join('');
  openModal(`
    <button class="modalClose" onclick="closeModal()">&times;</button>
    <h3>Tạo phiếu xuất bán</h3>
    <div class="formGrid">
      <div class="field"><label>Ngày</label><input type="date" id="fNgay" value="${todayISO()}"></div>
      <div class="field"><label>Khách hàng</label><select id="fDoiTac"><option value="">-- Chọn hoặc để trống (khách lẻ) --</option>${doiTacOptions}</select></div>
      <div class="field span2"><label>MST khách hàng (nếu xuất hoá đơn)</label><input id="fMSTKhach" placeholder="Có thể để trống nếu bán lẻ"></div>
      <div class="field span2"><label>Ghi chú</label><input id="fGhiChuPhieu"></div>
    </div>
    <div id="xuatItemsContainer"></div>
    <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="submitPhieuXuat()">Lưu phiếu</button></div>
  `);
  renderItemsTableInto('xuatItemsContainer', 'gia_ban');
  addItemRowInto('xuatItemsContainer', 'gia_ban');
}
async function submitPhieuXuat() {
  const loi = loiDongHang('xuatItemsContainer');
  if (!document.getElementById('fNgay').value) loi.unshift({ el: 'fNgay', msg: 'Chọn ngày lập phiếu' });
  if (baoLoiForm(loi)) return;
  const items = readItemsFrom('xuatItemsContainer');
  if (!(await xacNhanDonGiaKhong(items))) return;
  const doiTacSel = document.getElementById('fDoiTac'); const doiTacOpt = doiTacSel.selectedOptions[0];
  const data = {
    Ngay: document.getElementById('fNgay').value, GhiChu: document.getElementById('fGhiChuPhieu').value,
    MaKH: doiTacSel.value, TenKH: doiTacOpt ? doiTacOpt.dataset.ten : '',
    MSTKhachHang: document.getElementById('fMSTKhach').value, items
  };
  if (_baoGiaDangChuyen) data.IDBaoGia = _baoGiaDangChuyen;
  apiCall('saveXuatBan', { data }).then(res => {
    closeModal(); showToast(res && res.idBaoGia ? 'Đã lưu phiếu xuất bán — báo giá chuyển sang "Đã chốt".' : 'Đã lưu phiếu xuất bán.', thamSoHoanTac('xuat', res && (res.idPhieu || (res.phieu && res.phieu.IDPhieu))));
    if (res && res.idBaoGia) daChotBaoGiaTrongState(res.idBaoGia, res.idPhieu);
    _baoGiaDangChuyen = null;
    if (res && res.phieu) {
      STATE.xuatBanList.unshift(res.phieu);
      mergeTonKhoVaoState(res.tonKhoCapNhat);
      drawXuatBanTable();
      drawHangHoaTable();
      nhayDong(res.phieu.IDPhieu);
    } else {
      renderXuatBanTable(); renderHangHoaTable();
    }
  }).catch(err => showToast('Lỗi: ' + err.message));
}

// Nút "Hoàn tác" trên thông báo sau khi TẠO phiếu: xoá lại đúng phiếu vừa tạo (server tự hoàn tồn kho, mở lại báo giá nếu có).
// Chỉ có cho thao tác tạo mới; xoá phiếu thì không hoàn tác được (xem xoaPhieuUI).
function thamSoHoanTac(loai, idPhieu) {
  if (!idPhieu) return undefined;
  return { nhan: 'Hoàn tác', ms: 9000, fn: () => hoanTacTaoPhieu(loai, idPhieu) };
}
function hoanTacTaoPhieu(loai, idPhieu) {
  apiCall(loai === 'nhap' ? 'xoaPhieuNhap' : 'xoaPhieuXuat', { idPhieu }).then(() => {
    showToast('Đã hoàn tác: phiếu vừa tạo đã bị xoá, tồn kho trả về như cũ.');
    if (loai === 'nhap') renderNhapKhoTable(); else renderXuatBanTable();
    renderHangHoaTable();
  }).catch(err => showToast('Lỗi: không hoàn tác được — ' + err.message));
}

// Chỉ cho sửa khi CHƯA xuất hoá đơn điện tử (TrangThaiHD !== 'DaXuat') — hoá đơn đã xuất thì số liệu đã
// gửi cơ quan thuế, sửa phiếu ở đây sẽ lệch với hoá đơn thật.
function openSuaPhieuXuatForm(idPhieu) {
  const phieu = STATE.xuatBanList.find(p => p.IDPhieu === idPhieu);
  if (!phieu) return;
  apiCall('getXuatBanDetail', { idPhieu }).then(res => {
    const items = res.items || [];
    const doiTacOptions = STATE.khachHangList.map(d => `<option value="${d.MaKH}" data-ten="${d.TenKH}" ${d.MaKH === phieu.MaKH ? 'selected' : ''}>${d.TenKH}</option>`).join('');
    openModal(`
      <button class="modalClose" onclick="closeModal()">&times;</button>
      <h3>Sửa phiếu xuất bán ${idPhieu}</h3>
      <p class="muted">Chỉ sửa được khi chưa xuất hoá đơn điện tử. Số lượng/giá sửa xong sẽ tính lại tồn kho và giá vốn bình quân theo đúng thứ tự thời gian.</p>
      <div class="formGrid">
        <div class="field"><label>Ngày</label><input type="date" id="fNgay" value="${phieu.Ngay}"></div>
        <div class="field"><label>Khách hàng</label><select id="fDoiTac"><option value="">-- Chọn hoặc để trống (khách lẻ) --</option>${doiTacOptions}</select></div>
        <div class="field span2"><label>MST khách hàng (nếu xuất hoá đơn)</label><input id="fMSTKhach" value="${phieu.MSTKhachHang || ''}" placeholder="Có thể để trống nếu bán lẻ"></div>
        <div class="field span2"><label>Ghi chú</label><input id="fGhiChuPhieu" value="${(phieu.GhiChu || '').replace(/"/g, '&quot;')}"></div>
      </div>
      <div id="xuatItemsContainer"></div>
      <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="submitSuaPhieuXuat('${idPhieu}',${phieu.DaThu || 0})">Lưu thay đổi</button></div>
    `);
    renderItemsTableInto('xuatItemsContainer', 'gia_ban');
    if (items.length) items.forEach(it => addItemRowInto('xuatItemsContainer', 'gia_ban', it));
    else addItemRowInto('xuatItemsContainer', 'gia_ban');
    recalcGrandTotalGeneric('xuatItemsContainer');
  }).catch(err => showToast('Lỗi: ' + err.message));
}
async function submitSuaPhieuXuat(idPhieu, daThuCu) {
  const loi = loiDongHang('xuatItemsContainer');
  if (!document.getElementById('fNgay').value) loi.unshift({ el: 'fNgay', msg: 'Chọn ngày lập phiếu' });
  if (baoLoiForm(loi)) return;
  const items = readItemsFrom('xuatItemsContainer');
  if (!(await xacNhanDonGiaKhong(items))) return;
  const doiTacSel = document.getElementById('fDoiTac'); const doiTacOpt = doiTacSel.selectedOptions[0];
  const data = {
    Ngay: document.getElementById('fNgay').value, GhiChu: document.getElementById('fGhiChuPhieu').value,
    MaKH: doiTacSel.value, TenKH: doiTacOpt ? doiTacOpt.dataset.ten : '',
    MSTKhachHang: document.getElementById('fMSTKhach').value, items
  };
  const tongTienMoi = items.reduce((s, it) => { const t = it.SoLuong * it.DonGia; return s + t + tinhTienThueJS(t, it.ThueSuat); }, 0);
  if (daThuCu > tongTienMoi + 1) {
    if (!(await xacNhan({ tieuDe: 'Số đã thu lớn hơn tổng tiền mới', kieu: 'canhBao',
      noiDung: `Phiếu này đã thu ${vnd(daThuCu)}, nhưng sau khi sửa tổng tiền chỉ còn ${vnd(tongTienMoi)} — dư ${vnd(daThuCu - tongTienMoi)}.\n\nVẫn lưu? Anh tự đối chiếu lại với khách sau.`, nhanDongY: 'Vẫn lưu', nhanHuy: 'Quay lại sửa' }))) return;
  }
  apiCall('suaPhieuXuat', { idPhieu, data }).then(res => {
    closeModal(); showToast('Đã lưu thay đổi phiếu xuất bán.');
    if (res && res.phieu) {
      const i = STATE.xuatBanList.findIndex(p => p.IDPhieu === idPhieu);
      if (i >= 0) STATE.xuatBanList[i] = res.phieu;
      mergeTonKhoVaoState(res.tonKhoCapNhat);
      drawXuatBanTable();
      drawHangHoaTable();
      nhayDong(idPhieu);
    } else {
      renderXuatBanTable(); renderHangHoaTable();
    }
  }).catch(err => {
    const msg = String(err.message || '');
    if (msg.startsWith('DA_XUAT_HOA_DON')) { closeModal(); showToast(msg.replace(/^DA_XUAT_HOA_DON:\s*/, '')); renderXuatBanTable(); return; }
    showToast('Lỗi: ' + msg);
  });
}

/* ================= HOÁ ĐƠN DÙNG CHUNG (xuất bán / sửa chữa / gia công) ================= */
function openCapNhatHD(loai, idPhieu) {
  const listMap = { xuat: STATE.xuatBanList, suachua: STATE.suaChuaList, giacong: STATE.giaCongList };
  const phieu = listMap[loai].find(x => x.IDPhieu === idPhieu);
  openModal(`
    <button class="modalClose" onclick="closeModal()">&times;</button>
    <h3>Cập nhật hoá đơn điện tử</h3>
    <p class="muted">Nhập số hoá đơn đã xuất từ EasyInvoice cho phiếu này.</p>
    <div class="formGrid">
      <div class="field"><label>Số hoá đơn điện tử</label><input id="fSoHDDT" value="${phieu.SoHDDT || ''}"></div>
      <div class="field"><label>Ký hiệu hoá đơn</label><input id="fKyHieuHD" value="${phieu.KyHieuHD || ''}" placeholder="VD: 1C25TAB"></div>
    </div>
    <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="luuHoaDon('${loai}','${idPhieu}')">Lưu</button></div>
  `);
}
function luuHoaDon(loai, idPhieu) {
  const soHDDT = document.getElementById('fSoHDDT').value.trim();
  const kyHieuHD = document.getElementById('fKyHieuHD').value.trim();
  const actionMap = { xuat: 'capNhatHoaDonXuatBan', suachua: 'capNhatHoaDonSuaChua', giacong: 'capNhatHoaDonGiaCong' };
  const rendererMap = { xuat: renderXuatBanTable, suachua: renderSuaChuaTable, giacong: renderGiaCongTable };
  apiCall(actionMap[loai], { idPhieu, soHDDT, kyHieuHD }).then(() => { closeModal(); showToast('Đã cập nhật hoá đơn.'); rendererMap[loai](); }).catch(err => showToast('Lỗi: ' + err.message));
}

/* ================= XEM / XOÁ PHIẾU NHẬP-XUẤT ================= */
function viewPhieuNhapXuat(loai, idPhieu) {
  const action = loai === 'nhap' ? 'getNhapKhoDetail' : 'getXuatBanDetail';
  const listSrc = loai === 'nhap' ? STATE.nhapKhoList : STATE.xuatBanList;
  const phieu = listSrc.find(p => p.IDPhieu === idPhieu);
  apiCall(action, { idPhieu }).then(res => {
    const items = res.items || [];
    const conNo = (Number(phieu.TongTien) || 0) - (Number(loai === 'nhap' ? phieu.DaTra : phieu.DaThu) || 0);
    const nutIn = loai === 'nhap'
      ? `<button class="btn secondary" onclick="inPhieuNhapKho('${idPhieu}')">${ICON_IN} In phiếu nhập kho</button>`
      : `<button class="btn secondary" onclick="inBienBanGiaoNhan('${idPhieu}')">${ICON_IN} In biên bản giao nhận</button>`;
    openModal(`
      <button class="modalClose" onclick="closeModal()">&times;</button>
      <h3>Chi tiết phiếu ${idPhieu}</h3>
      <p class="muted">Ngày: ${fmtDate(phieu.Ngay)} &nbsp;|&nbsp; ${loai === 'nhap' ? 'NCC: ' + (phieu.TenNCC || '—') : 'Khách: ' + (phieu.TenKH || 'Khách lẻ')}</p>
      <div class="tableWrap"><table class="itemsTable ctPhieu"><thead><tr><th>Hàng hoá/dịch vụ</th><th class="num">SL</th><th>ĐVT</th><th class="num">Đơn giá</th><th class="num">Thuế</th><th class="num">Thành tiền</th></tr></thead>
      <tbody>${items.map(it => `<tr><td>${it.TenHH}</td><td class="num" data-label="SL">${fmtSoLuong(it.SoLuong)}</td><td data-label="ĐVT">${it.DVT || ''}</td><td class="num" data-label="Đơn giá">${fmtMoney(it.DonGia)}</td><td class="num" data-label="Thuế">${thueSuatLabel(it.ThueSuat || '0')}</td><td class="num" data-label="Thành tiền">${fmtMoney(it.ThanhTienSauThue != null ? it.ThanhTienSauThue : it.ThanhTien)}</td></tr>`).join('')}</tbody></table></div>
      <div class="grandTotal" style="font-size:13px;font-weight:400;text-align:right;line-height:1.8;">
        Tạm tính (trước thuế): <b>${fmtMoney(phieu.TongTienTruocThue != null ? phieu.TongTienTruocThue : phieu.TongTien)}</b><br>
        Tiền thuế GTGT: <b>${fmtMoney(phieu.TongTienThue || 0)}</b><br>
        <span style="font-size:16px;font-weight:800;color:var(--brand-deep);">Tổng thanh toán: ${fmtMoney(phieu.TongTien)}</span>
      </div>
      <p class="muted" style="text-align:right;">Còn nợ: <b>${fmtMoney(conNo)}</b></p>
      ${conNo > 0 && loai === 'xuat' ? `<div style="text-align:right;margin-bottom:8px;"><button class="btn secondary small" onclick="toggleQR('${idPhieu}',${conNo})">Hiện mã QR chuyển khoản</button></div><div id="qrBox_${idPhieu}" style="display:none;text-align:right;"></div>` : ''}
      ${conNo > 0 ? `
        <div class="formGrid">
          <div class="field span2"><label>${loai === 'nhap' ? 'Ghi nhận thanh toán cho NCC' : 'Ghi nhận thu tiền từ khách'}</label><input type="text" inputmode="numeric" class="moneyInput" id="fSoTienTT" placeholder="Số tiền" value="${Math.round(conNo).toLocaleString('vi-VN')}"></div>
          <div class="field span2"><label>Phương thức</label><select id="fPhuongThucTT"><option value="TienMat">Tiền mặt</option><option value="ChuyenKhoan">Chuyển khoản</option><option value="The">Thẻ</option></select></div>
        </div>
        <div class="modalActions">${nutIn}<button class="btn secondary" onclick="closeModal()">Đóng</button><button class="btn" onclick="ghiNhanThanhToanNX('${loai}','${idPhieu}')">Ghi nhận thanh toán</button></div>
      ` : `<div class="modalActions">${nutIn}<button class="btn secondary" onclick="closeModal()">Đóng</button></div>`}
    `);
  }).catch(err => showToast('Lỗi: ' + err.message));
}
function ghiNhanThanhToanNX(loai, idPhieu) {
  const soTien = parseSoTien(document.getElementById('fSoTienTT').value);
  if (baoLoiForm(soTien <= 0 ? [{ el: 'fSoTienTT', msg: 'Nhập số tiền lớn hơn 0' }] : [])) return;
  const phuongThuc = document.getElementById('fPhuongThucTT').value;
  const action = loai === 'nhap' ? 'capNhatDaTraNCC' : 'capNhatDaThuKH';
  apiCall(action, { idPhieu, soTien, phuongThuc }).then(() => {
    closeModal(); showToast('Đã ghi nhận thanh toán.');
    if (loai === 'nhap') renderNhapKhoTable(); else renderXuatBanTable();
    renderCongNo();
  }).catch(err => showToast('Lỗi: ' + err.message));
}
function vnd(n) { return (Math.round(Number(n) || 0)).toLocaleString('vi-VN') + ' đ'; } // tiền dạng chữ thường (dùng trong hộp xác nhận, không chèn HTML)
function moTaPhieuNX(loai, idPhieu) {
  const l = (loai === 'nhap' ? STATE.nhapKhoList : STATE.xuatBanList) || [];
  const p = l.find(x => x.IDPhieu === idPhieu);
  return p ? `${fmtDate(p.Ngay)} — ${loai === 'nhap' ? (p.TenNCC || 'chưa chọn NCC') : (p.TenKH || 'Khách lẻ')} — ${vnd(p.TongTien)}` : idPhieu;
}
async function xoaPhieuUI(loai, idPhieu) {
  const ok = await xacNhan({
    tieuDe: loai === 'nhap' ? 'Xoá phiếu nhập kho?' : 'Xoá phiếu bán hàng?', kieu: 'nguyHiem',
    noiDung: `Phiếu: ${moTaPhieuNX(loai, idPhieu)}\n\nTồn kho các mặt hàng trong phiếu được hoàn lại, giá vốn tự tính lại.${loai === 'xuat' ? ' Nếu phiếu được chốt từ một báo giá, báo giá đó được mở lại.' : ''} Phiếu đã xoá không khôi phục được.`,
    nhanDongY: 'Xoá phiếu'
  });
  if (!ok) return;
  const action = loai === 'nhap' ? 'xoaPhieuNhap' : 'xoaPhieuXuat';
  apiCall(action, { idPhieu }).then(() => { showToast('Đã xoá phiếu.'); if (loai === 'nhap') renderNhapKhoTable(); else renderXuatBanTable(); }).catch(err => showToast('Lỗi: ' + err.message));
}
async function xoaPhieuGeneric(action, idPhieu, rerender) {
  const ok = await xacNhan({ tieuDe: 'Xoá phiếu này?', kieu: 'nguyHiem', noiDung: `Phiếu ${idPhieu}\n\nTồn kho các mặt hàng liên quan được hoàn lại đúng chiều. Phiếu đã xoá không khôi phục được.`, nhanDongY: 'Xoá phiếu' });
  if (!ok) return;
  apiCall(action, { idPhieu }).then(() => { showToast('Đã xoá phiếu.'); rerender(); }).catch(err => showToast('Lỗi: ' + err.message));
}
