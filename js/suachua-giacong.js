/* ================= SỬA CHỮA ================= */
function renderSuaChuaTable() {
  apiCall('getSuaChuaList', { gioiHan: STATE_DA_TAI_HET.suachua ? null : GIOI_HAN_MAC_DINH }).then(list => {
    STATE.suaChuaList = list.sort((a, b) => (b.Timestamp || '').localeCompare(a.Timestamp || ''));
    drawSuaChuaTable();
  }).catch(err => showToast('Lỗi: ' + err.message));
}
function veKpiSuaChua() {
  const list = STATE.suaChuaList || [];
  const dem = tt => list.filter(x => tt.includes(x.TrangThai)).length;
  const conNo = list.filter(x => (Number(x.TongTien) || 0) - (Number(x.DaThu) || 0) > 0);
  veKpi('kpiSuaChua', [
    { label: 'Đang xử lý', val: dem(['TiepNhan', 'DangSua']) + ' máy', mau: 'blue' },
    { label: 'Chờ linh kiện', val: dem(['ChoLinhKien']) + ' máy', mau: 'orange' },
    { label: 'Xong, chờ giao khách', val: dem(['HoanThanh']) + ' máy', mau: 'green' },
    { label: 'Khách còn nợ', val: fmtMoney(tongTien(conNo, x => (Number(x.TongTien) || 0) - (Number(x.DaThu) || 0))), mau: 'gray', phu: conNo.length + ' phiếu' }
  ]);
}
function drawSuaChuaTable() {
    veKpiSuaChua();
    const filterTT = document.getElementById('filterTrangThaiSC').value;
    const filtered = filterTT ? STATE.suaChuaList.filter(x => x.TrangThai === filterTT) : STATE.suaChuaList;
    const wrap = document.getElementById('suaChuaTableWrap');
    if (filtered.length === 0) { wrap.innerHTML = '<div class="empty">Chưa có phiếu sửa chữa nào.</div>'; return; }
    const goiYXemThem = !STATE_DA_TAI_HET.suachua ? `<p class="muted" style="margin:8px 0;">Đang hiện ${STATE.suaChuaList.length} phiếu gần đây (+ các phiếu chưa xong dù cũ). <a href="#" onclick="xemToanBoLichSu('suachua');return false;">Xem toàn bộ lịch sử</a></p>` : '';
    wrap.innerHTML = `${goiYXemThem}<table><thead><tr><th>Ngày</th><th>Khách hàng</th><th>Thiết bị</th><th>Trạng thái</th><th>Tổng thanh toán</th><th>Còn nợ</th><th>Kỹ thuật viên</th><th></th></tr></thead><tbody>
      ${filtered.map(s => { const conNo = (Number(s.TongTien) || 0) - (Number(s.DaThu) || 0); return `<tr>
        <td>${fmtDate(s.Ngay)}</td><td>${s.TenKH || '—'}<div class="muted">${s.SDT || ''}</div></td>
        <td>${s.ThietBi || ''}</td><td>${trangThaiSCTag(s.TrangThai)}</td>
        <td>${fmtMoney(s.TongTien)}</td>
        <td>${conNo > 0 ? `<span class="tag warn">${fmtMoney(conNo)}</span>` : '<span class="tag good">Đã thu đủ</span>'}</td>
        <td>${s.NguoiPhuTrach || ''}</td>
        <td class="rowActions">
          <button class="iconBtn" title="Xem" onclick="viewPhieuSuaChua('${s.IDPhieu}')">${ICON_XEM}</button>
          <button class="iconBtn" title="Cập nhật trạng thái" onclick="openCapNhatTrangThaiSC('${s.IDPhieu}')">${ICON_TRANGTHAI}</button>
          <button class="iconBtn iconPrimary" title="Cập nhật hoá đơn" onclick="openCapNhatHD('suachua','${s.IDPhieu}')">${ICON_HD}</button>
          <button class="iconBtn iconDanger" title="Xoá" onclick="xoaPhieuGeneric('xoaPhieuSuaChua','${s.IDPhieu}',renderSuaChuaTable)">${ICON_XOA}</button>
        </td>
      </tr>`; }).join('')}
    </tbody></table>`;
}
document.getElementById('filterTrangThaiSC').addEventListener('change', drawSuaChuaTable);
document.getElementById('btnAddSuaChua').addEventListener('click', openPhieuSuaChuaForm);

function openPhieuSuaChuaForm() {
  const doiTacOptions = STATE.khachHangList.map(d => `<option value="${d.MaKH}" data-ten="${d.TenKH}" data-sdt="${d.SDT || ''}">${d.TenKH}</option>`).join('');
  openModal(`
    <button class="modalClose" onclick="closeModal()">&times;</button>
    <h3>Tiếp nhận sửa chữa</h3>
    <div class="formGrid">
      <div class="field"><label>Ngày tiếp nhận</label><input type="date" id="fNgay" value="${todayISO()}"></div>
      <div class="field"><label>Khách hàng</label><select id="fDoiTac" onchange="autoFillSDT()"><option value="">-- Chọn hoặc nhập tay --</option>${doiTacOptions}</select></div>
      <div class="field"><label>Tên khách (nếu không có trong danh sách)</label><input id="fTenKhachTay" placeholder="Có thể để trống nếu đã chọn ở trên"></div>
      <div class="field"><label>Số điện thoại</label><input id="fSDT"></div>
      <div class="field span2"><label>Thiết bị</label><input id="fThietBi" placeholder="VD: Laptop Dell Inspiron, máy in Canon..."></div>
      <div class="field span2"><label>Tình trạng khi tiếp nhận / mô tả lỗi</label><textarea id="fTinhTrang"></textarea></div>
      <div class="field span2"><label>Phụ kiện kèm theo</label><input id="fPhuKien" placeholder="VD: sạc, túi đựng..."></div>
      <div class="field"><label>Kỹ thuật viên phụ trách</label><input id="fNguoiPhuTrach"></div>
      <div class="field"><label>Ngày hẹn trả</label><input type="date" id="fNgayHenTra"></div>
      <div class="field"><label>Bảo hành (số ngày)</label><input type="number" id="fBaoHanh" value="0"></div>
      <div class="field"><label>Tiền công sửa chữa (trước thuế)</label><input type="text" inputmode="numeric" class="moneyInput" id="fTienCong" value="0"></div>
      <div class="field"><label>Thuế suất tiền công</label><select id="fTienCongThueSuat">${thueSuatOptionsHtml('8')}</select></div>
      <div class="field span2"><label>Ghi chú</label><input id="fGhiChuPhieu"></div>
    </div>
    <p class="muted" style="margin:12px 0 4px;">Linh kiện thay thế (nếu có — sẽ tự động trừ tồn kho):</p>
    <div id="scItemsContainer"></div>
    <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="submitPhieuSuaChua()">Lưu phiếu tiếp nhận</button></div>
  `);
  renderItemsTableInto('scItemsContainer', 'gia_ban');
}
function autoFillSDT() {
  const sel = document.getElementById('fDoiTac'); const opt = sel.selectedOptions[0];
  if (opt && opt.dataset.sdt) document.getElementById('fSDT').value = opt.dataset.sdt;
}
function submitPhieuSuaChua() {
  const items = readItemsFrom('scItemsContainer');
  const doiTacSel = document.getElementById('fDoiTac'); const doiTacOpt = doiTacSel.selectedOptions[0];
  const tenKhachTay = document.getElementById('fTenKhachTay').value.trim();
  const data = {
    Ngay: document.getElementById('fNgay').value,
    MaKH: doiTacSel.value, TenKH: tenKhachTay || (doiTacOpt ? doiTacOpt.dataset.ten : ''),
    SDT: document.getElementById('fSDT').value.trim(),
    ThietBi: document.getElementById('fThietBi').value.trim(),
    TinhTrangTiepNhan: document.getElementById('fTinhTrang').value.trim(),
    PhuKienKemTheo: document.getElementById('fPhuKien').value.trim(),
    NguoiPhuTrach: document.getElementById('fNguoiPhuTrach').value.trim(),
    NgayHenTra: document.getElementById('fNgayHenTra').value,
    BaoHanhNgay: Number(document.getElementById('fBaoHanh').value) || 0,
    TienCong: parseSoTien(document.getElementById('fTienCong').value),
    TienCongThueSuat: document.getElementById('fTienCongThueSuat').value,
    GhiChu: document.getElementById('fGhiChuPhieu').value.trim(),
    TrangThai: 'TiepNhan', items
  };
  if (!data.ThietBi) { showToast('Vui lòng nhập tên thiết bị.'); return; }
  apiCall('saveSuaChua', { data }).then(res => {
    closeModal(); showToast('Đã lưu phiếu tiếp nhận sửa chữa.');
    if (res && res.phieu) {
      STATE.suaChuaList.unshift(res.phieu);
      mergeTonKhoVaoState(res.tonKhoCapNhat);
      drawSuaChuaTable();
      drawHangHoaTable();
    } else {
      renderSuaChuaTable(); renderHangHoaTable();
    }
  }).catch(err => showToast('Lỗi: ' + err.message));
}

function viewPhieuSuaChua(idPhieu) {
  const phieu = STATE.suaChuaList.find(p => p.IDPhieu === idPhieu);
  apiCall('getSuaChuaDetail', { idPhieu }).then(res => {
    const items = res.items || [];
    const conNo = (Number(phieu.TongTien) || 0) - (Number(phieu.DaThu) || 0);
    openModal(`
      <button class="modalClose" onclick="closeModal()">&times;</button>
      <h3>Chi tiết phiếu sửa chữa ${idPhieu}</h3>
      <p class="muted">Ngày: ${fmtDate(phieu.Ngay)} · Khách: ${phieu.TenKH || '—'} (${phieu.SDT || ''}) · Trạng thái: ${trangThaiSCTag(phieu.TrangThai)}</p>
      <p><b>Thiết bị:</b> ${phieu.ThietBi || ''}</p>
      <p><b>Tình trạng tiếp nhận:</b> ${phieu.TinhTrangTiepNhan || ''}</p>
      <p><b>Phụ kiện kèm theo:</b> ${phieu.PhuKienKemTheo || '—'}</p>
      <p><b>Kỹ thuật viên:</b> ${phieu.NguoiPhuTrach || '—'} &nbsp;|&nbsp; <b>Bảo hành:</b> ${phieu.BaoHanhNgay || 0} ngày</p>
      ${items.length ? `<div class="tableWrap"><table class="itemsTable ctPhieu"><thead><tr><th>Linh kiện</th><th class="num">SL</th><th>ĐVT</th><th class="num">Đơn giá</th><th class="num">Thuế</th><th class="num">Thành tiền</th></tr></thead>
      <tbody>${items.map(it => `<tr><td>${it.TenHH}</td><td class="num" data-label="SL">${fmtSoLuong(it.SoLuong)}</td><td data-label="ĐVT">${it.DVT || ''}</td><td class="num" data-label="Đơn giá">${fmtMoney(it.DonGia)}</td><td class="num" data-label="Thuế">${thueSuatLabel(it.ThueSuat || '0')}</td><td class="num" data-label="Thành tiền">${fmtMoney(it.ThanhTienSauThue != null ? it.ThanhTienSauThue : it.ThanhTien)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Không có linh kiện thay thế.</p>'}
      <p>Tiền công (trước thuế): ${fmtMoney(phieu.TienCong)} — thuế ${thueSuatLabel(phieu.TienCongThueSuat || '0')} &nbsp;|&nbsp; Tiền linh kiện (trước thuế): ${fmtMoney(phieu.TongTienLinhKien)}</p>
      <div class="grandTotal" style="font-size:13px;font-weight:400;text-align:right;line-height:1.8;">
        Tạm tính (trước thuế): <b>${fmtMoney(phieu.TongTienTruocThue != null ? phieu.TongTienTruocThue : phieu.TongTien)}</b><br>
        Tiền thuế GTGT: <b>${fmtMoney(phieu.TongTienThue || 0)}</b><br>
        <span style="font-size:16px;font-weight:800;color:var(--brand-deep);">Tổng thanh toán: ${fmtMoney(phieu.TongTien)}</span>
      </div>
      <p class="muted" style="text-align:right;">Còn nợ: <b>${fmtMoney(conNo)}</b></p>
      ${conNo > 0 ? `<div style="text-align:right;margin-bottom:8px;"><button class="btn secondary small" onclick="toggleQR('${idPhieu}',${conNo})">Hiện mã QR chuyển khoản</button></div><div id="qrBox_${idPhieu}" style="display:none;text-align:right;"></div>` : ''}
      ${conNo > 0 ? `
        <div class="formGrid">
          <div class="field span2"><label>Ghi nhận thu tiền từ khách</label><input type="text" inputmode="numeric" class="moneyInput" id="fSoTienTT" placeholder="Số tiền" value="${Math.round(conNo).toLocaleString('vi-VN')}"></div>
          <div class="field span2"><label>Phương thức</label><select id="fPhuongThucTT"><option value="TienMat">Tiền mặt</option><option value="ChuyenKhoan">Chuyển khoản</option><option value="The">Thẻ</option></select></div>
        </div>
        <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Đóng</button><button class="btn" onclick="ghiNhanThuSuaChua('${idPhieu}')">Ghi nhận thanh toán</button></div>
      ` : `<div class="modalActions"><button class="btn secondary" onclick="closeModal()">Đóng</button></div>`}
    `);
  }).catch(err => showToast('Lỗi: ' + err.message));
}
function ghiNhanThuSuaChua(idPhieu) {
  const soTien = parseSoTien(document.getElementById('fSoTienTT').value);
  if (soTien <= 0) { showToast('Nhập số tiền hợp lệ.'); return; }
  const phuongThuc = document.getElementById('fPhuongThucTT').value;
  apiCall('capNhatDaThuSuaChua', { idPhieu, soTien, phuongThuc }).then(() => { closeModal(); showToast('Đã ghi nhận thanh toán.'); renderSuaChuaTable(); renderCongNo(); }).catch(err => showToast('Lỗi: ' + err.message));
}
function openCapNhatTrangThaiSC(idPhieu) {
  const phieu = STATE.suaChuaList.find(p => p.IDPhieu === idPhieu);
  const options = ['TiepNhan', 'DangSua', 'ChoLinhKien', 'HoanThanh', 'DaGiaoTra', 'Huy'];
  openModal(`
    <button class="modalClose" onclick="closeModal()">&times;</button>
    <h3>Cập nhật trạng thái sửa chữa</h3>
    <div class="formGrid">
      <div class="field span2"><label>Trạng thái</label><select id="fTrangThaiSC">${options.map(o => `<option value="${o}" ${phieu.TrangThai === o ? 'selected' : ''}>${trangThaiSCLabel(o)}</option>`).join('')}</select></div>
      <div class="field span2"><label>Ngày hoàn thành (nếu có)</label><input type="date" id="fNgayHoanThanhSC" value="${phieu.NgayHoanThanh ? formatForInput(phieu.NgayHoanThanh) : ''}"></div>
    </div>
    <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="luuTrangThaiSC('${idPhieu}')">Lưu</button></div>
  `);
}
function formatForInput(d) { if (/^\d{4}-\d{2}-\d{2}/.test(String(d))) return String(d).substring(0, 10); const dt = new Date(d); if (isNaN(dt)) return ''; return ngayISO(dt); }
function luuTrangThaiSC(idPhieu) {
  const trangThai = document.getElementById('fTrangThaiSC').value;
  const ngayHoanThanh = document.getElementById('fNgayHoanThanhSC').value;
  apiCall('capNhatTrangThaiSuaChua', { idPhieu, trangThai, ngayHoanThanh }).then(() => { closeModal(); showToast('Đã cập nhật trạng thái.'); renderSuaChuaTable(); }).catch(err => showToast('Lỗi: ' + err.message));
}

/* ================= GIA CÔNG ================= */
function loaiGCLabel(v) { return v === 'NhanGiaCongChoKhach' ? 'Nhận gia công cho khách' : 'Thuê ngoài gia công'; }
function trangThaiGCLabel(v) { return { TiepNhan: 'Tiếp nhận', DangGiaCong: 'Đang gia công', HoanThanh: 'Hoàn thành', DaGiao: 'Đã giao' }[v] || v; }
function trangThaiGCTag(v) { const map = { TiepNhan: 'info', DangGiaCong: 'warn', HoanThanh: 'good', DaGiao: 'good' }; return `<span class="tag ${map[v] || 'info'}">${trangThaiGCLabel(v)}</span>`; }

function renderGiaCongTable() {
  apiCall('getGiaCongList', { gioiHan: STATE_DA_TAI_HET.giacong ? null : GIOI_HAN_MAC_DINH }).then(list => {
    STATE.giaCongList = list.sort((a, b) => (b.Timestamp || '').localeCompare(a.Timestamp || ''));
    drawGiaCongTable();
  }).catch(err => showToast('Lỗi: ' + err.message));
}
function veKpiGiaCong() {
  const list = STATE.giaCongList || [];
  const thu = list.filter(g => g.Loai === 'NhanGiaCongChoKhach');
  const tra = list.filter(g => g.Loai !== 'NhanGiaCongChoKhach');
  const dangLam = g => ['TiepNhan', 'DangGiaCong'].includes(g.TrangThai);
  const no = (arr, cot) => tongTien(arr, g => Math.max(0, (Number(g.ChiPhiGiaCong) || 0) - (Number(g[cot]) || 0)));
  veKpi('kpiGiaCong', [
    { label: 'Nhận gia công đang làm', val: thu.filter(dangLam).length + ' phiếu', mau: 'blue' },
    { label: 'Thuê ngoài đang làm', val: tra.filter(dangLam).length + ' phiếu', mau: 'navy' },
    { label: 'Khách còn nợ (nhận GC)', val: fmtMoney(no(thu, 'DaThu')), mau: 'orange' },
    { label: 'Còn phải trả (thuê ngoài)', val: fmtMoney(no(tra, 'DaTra')), mau: 'gray' }
  ]);
}
function drawGiaCongTable() {
    veKpiGiaCong();
    const filterLoai = document.getElementById('filterLoaiGC').value;
    const filtered = filterLoai ? STATE.giaCongList.filter(g => g.Loai === filterLoai) : STATE.giaCongList;
    const wrap = document.getElementById('giaCongTableWrap');
    if (filtered.length === 0) { wrap.innerHTML = '<div class="empty">Chưa có phiếu gia công nào.</div>'; return; }
    const goiYXemThem = !STATE_DA_TAI_HET.giacong ? `<p class="muted" style="margin:8px 0;">Đang hiện ${STATE.giaCongList.length} phiếu gần đây (+ các phiếu chưa xong dù cũ). <a href="#" onclick="xemToanBoLichSu('giacong');return false;">Xem toàn bộ lịch sử</a></p>` : '';
    wrap.innerHTML = `${goiYXemThem}<table><thead><tr><th>Ngày</th><th>Loại</th><th>Đối tác</th><th>Công việc</th><th>Trạng thái</th><th>Chi phí (sau thuế)</th><th>Còn nợ</th><th></th></tr></thead><tbody>
      ${filtered.map(g => {
        const isThu = g.Loai === 'NhanGiaCongChoKhach';
        const daXong = isThu ? Number(g.DaThu) || 0 : Number(g.DaTra) || 0;
        const conNo = (Number(g.ChiPhiGiaCong) || 0) - daXong;
        return `<tr>
          <td>${fmtDate(g.Ngay)}</td>
          <td>${isThu ? '<span class="tag hh">Nhận GC</span>' : '<span class="tag dv">Thuê ngoài</span>'}</td>
          <td>${g.TenDoiTac || '—'}</td><td>${g.MoTaCongViec || ''}</td>
          <td>${trangThaiGCTag(g.TrangThai)}</td><td>${fmtMoney(g.ChiPhiGiaCong)}</td>
          <td>${conNo > 0 ? `<span class="tag warn">${fmtMoney(conNo)}</span>` : '<span class="tag good">Đã xong</span>'}</td>
          <td class="rowActions">
            <button class="iconBtn" title="Xem" onclick="viewPhieuGiaCong('${g.IDPhieu}')">${ICON_XEM}</button>
            <button class="iconBtn" title="Cập nhật trạng thái" onclick="openCapNhatTrangThaiGC('${g.IDPhieu}')">${ICON_TRANGTHAI}</button>
            <button class="iconBtn iconPrimary" title="Cập nhật hoá đơn" onclick="openCapNhatHD('giacong','${g.IDPhieu}')">${ICON_HD}</button>
            <button class="iconBtn iconDanger" title="Xoá" onclick="xoaPhieuGeneric('xoaPhieuGiaCong','${g.IDPhieu}',renderGiaCongTable)">${ICON_XOA}</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody></table>`;
}
document.getElementById('filterLoaiGC').addEventListener('change', drawGiaCongTable);
document.getElementById('btnAddGiaCong').addEventListener('click', () => openPhieuGiaCongForm());

function openPhieuGiaCongForm() {
  openModal(`
    <button class="modalClose" onclick="closeModal()">&times;</button>
    <h3>Tạo phiếu gia công</h3>
    <div class="segTabs">
      <button type="button" class="active" id="segNhanGC" onclick="chonLoaiGC('NhanGiaCongChoKhach')">Nhận gia công cho khách</button>
      <button type="button" id="segThueGC" onclick="chonLoaiGC('ThueNgoaiGiaCong')">Thuê ngoài gia công</button>
    </div>
    <input type="hidden" id="fLoaiGC" value="NhanGiaCongChoKhach">
    <div class="formGrid">
      <div class="field"><label>Ngày</label><input type="date" id="fNgay" value="${todayISO()}"></div>
      <div class="field"><label id="fDoiTacLabel">Khách hàng</label><select id="fDoiTac"><option value="">-- Chọn hoặc để trống --</option></select></div>
      <div class="field span2"><label>Mô tả công việc gia công</label><textarea id="fMoTaCongViec" placeholder="VD: Gia công 500 tấm biển quảng cáo, in 1000 tờ rơi..."></textarea></div>
      <div class="field"><label>Số lượng sản phẩm</label><input type="number" id="fSoLuongSP" value="1"></div>
      <div class="field"><label>Đơn vị tính</label><input id="fDonViTinh" placeholder="cái, bộ, tờ..."></div>
      <div class="field"><label id="fChiPhiLabel">Chi phí gia công (trước thuế)</label><input type="text" inputmode="numeric" class="moneyInput" id="fChiPhiGC" value="0"></div>
      <div class="field"><label>Thuế suất</label><select id="fChiPhiGCThueSuat">${thueSuatOptionsHtml('8')}</select></div>
      <div class="field"><label>Ngày hẹn trả</label><input type="date" id="fNgayHenTra"></div>
      <div class="field span2"><label>Ghi chú</label><input id="fGhiChuPhieu"></div>
    </div>
    <p class="muted" style="margin:12px 0 4px;">Vật tư / nguyên liệu xuất từ kho (nếu có — sẽ tự động trừ tồn kho):</p>
    <div id="gcItemsContainer"></div>
    <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="submitPhieuGiaCong()">Lưu phiếu</button></div>
  `);
  renderItemsTableInto('gcItemsContainer', 'gia_ban');
  chonLoaiGC('NhanGiaCongChoKhach');
}
function chonLoaiGC(loai) {
  document.getElementById('fLoaiGC').value = loai;
  document.getElementById('segNhanGC').classList.toggle('active', loai === 'NhanGiaCongChoKhach');
  document.getElementById('segThueGC').classList.toggle('active', loai === 'ThueNgoaiGiaCong');
  document.getElementById('fDoiTacLabel').textContent = loai === 'NhanGiaCongChoKhach' ? 'Khách hàng' : 'Nhà cung cấp gia công';
  document.getElementById('fChiPhiLabel').textContent = (loai === 'NhanGiaCongChoKhach' ? 'Chi phí gia công (thu từ khách, trước thuế)' : 'Chi phí gia công (trả cho bên nhận gia công, trước thuế)');
  const list = loai === 'NhanGiaCongChoKhach' ? STATE.khachHangList : STATE.nhaCungCapList;
  const idField = loai === 'NhanGiaCongChoKhach' ? 'MaKH' : 'MaNCC';
  const tenField = loai === 'NhanGiaCongChoKhach' ? 'TenKH' : 'TenNCC';
  document.getElementById('fDoiTac').innerHTML = '<option value="">-- Chọn hoặc để trống --</option>' + list.map(d => `<option value="${d[idField]}" data-ten="${d[tenField]}">${d[tenField]}</option>`).join('');
}
function submitPhieuGiaCong() {
  const items = readItemsFrom('gcItemsContainer');
  const doiTacSel = document.getElementById('fDoiTac'); const doiTacOpt = doiTacSel.selectedOptions[0];
  const data = {
    Loai: document.getElementById('fLoaiGC').value,
    Ngay: document.getElementById('fNgay').value,
    MaDoiTac: doiTacSel.value, TenDoiTac: doiTacOpt ? doiTacOpt.dataset.ten : '',
    MoTaCongViec: document.getElementById('fMoTaCongViec').value.trim(),
    SoLuongSanPham: Number(document.getElementById('fSoLuongSP').value) || 0,
    DonViTinh: document.getElementById('fDonViTinh').value.trim(),
    ChiPhiGiaCong: parseSoTien(document.getElementById('fChiPhiGC').value),
    ThueSuatGiaCong: document.getElementById('fChiPhiGCThueSuat').value,
    NgayHenTra: document.getElementById('fNgayHenTra').value,
    GhiChu: document.getElementById('fGhiChuPhieu').value.trim(),
    TrangThai: 'TiepNhan', items
  };
  if (!data.MoTaCongViec) { showToast('Vui lòng nhập mô tả công việc.'); return; }
  apiCall('saveGiaCong', { data }).then(res => {
    closeModal(); showToast('Đã lưu phiếu gia công.');
    if (res && res.phieu) {
      STATE.giaCongList.unshift(res.phieu);
      mergeTonKhoVaoState(res.tonKhoCapNhat);
      drawGiaCongTable();
      drawHangHoaTable();
    } else {
      renderGiaCongTable(); renderHangHoaTable();
    }
  }).catch(err => showToast('Lỗi: ' + err.message));
}

function viewPhieuGiaCong(idPhieu) {
  const phieu = STATE.giaCongList.find(p => p.IDPhieu === idPhieu);
  apiCall('getGiaCongDetail', { idPhieu }).then(res => {
    const items = res.items || [];
    const isThu = phieu.Loai === 'NhanGiaCongChoKhach';
    const daXong = isThu ? Number(phieu.DaThu) || 0 : Number(phieu.DaTra) || 0;
    const conNo = (Number(phieu.ChiPhiGiaCong) || 0) - daXong;
    openModal(`
      <button class="modalClose" onclick="closeModal()">&times;</button>
      <h3>Chi tiết phiếu gia công ${idPhieu}</h3>
      <p class="muted">${loaiGCLabel(phieu.Loai)} · Ngày: ${fmtDate(phieu.Ngay)} · Đối tác: ${phieu.TenDoiTac || '—'} · Trạng thái: ${trangThaiGCTag(phieu.TrangThai)}</p>
      <p><b>Mô tả công việc:</b> ${phieu.MoTaCongViec || ''}</p>
      <p><b>Số lượng sản phẩm:</b> ${phieu.SoLuongSanPham || 0} ${phieu.DonViTinh || ''}</p>
      ${items.length ? `<div class="tableWrap"><table class="itemsTable ctPhieu"><thead><tr><th>Vật tư</th><th class="num">SL</th><th>ĐVT</th><th class="num">Đơn giá</th><th class="num">Thuế</th><th class="num">Thành tiền</th></tr></thead>
      <tbody>${items.map(it => `<tr><td>${it.TenHH}</td><td class="num" data-label="SL">${fmtSoLuong(it.SoLuong)}</td><td data-label="ĐVT">${it.DVT || ''}</td><td class="num" data-label="Đơn giá">${fmtMoney(it.DonGia)}</td><td class="num" data-label="Thuế">${thueSuatLabel(it.ThueSuat || '0')}</td><td class="num" data-label="Thành tiền">${fmtMoney(it.ThanhTienSauThue != null ? it.ThanhTienSauThue : it.ThanhTien)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="grandTotal" style="font-size:13px;font-weight:400;text-align:right;line-height:1.8;">
        Chi phí gia công (trước thuế): <b>${fmtMoney(phieu.ChiPhiGiaCongTruocThue != null ? phieu.ChiPhiGiaCongTruocThue : phieu.ChiPhiGiaCong)}</b> — thuế ${thueSuatLabel(phieu.ThueSuatGiaCong || '0')}<br>
        Tiền thuế GTGT: <b>${fmtMoney(phieu.TienThueGiaCong || 0)}</b><br>
        <span style="font-size:16px;font-weight:800;color:var(--brand-deep);">Tổng thanh toán: ${fmtMoney(phieu.ChiPhiGiaCong)}</span>
      </div>
      <p class="muted" style="text-align:right;">Còn nợ: <b>${fmtMoney(conNo)}</b></p>
      ${conNo > 0 && isThu ? `<div style="text-align:right;margin-bottom:8px;"><button class="btn secondary small" onclick="toggleQR('${idPhieu}',${conNo})">Hiện mã QR chuyển khoản</button></div><div id="qrBox_${idPhieu}" style="display:none;text-align:right;"></div>` : ''}
      ${conNo > 0 ? `
        <div class="formGrid">
          <div class="field span2"><label>${isThu ? 'Ghi nhận thu tiền từ khách' : 'Ghi nhận trả tiền cho bên gia công'}</label><input type="text" inputmode="numeric" class="moneyInput" id="fSoTienTT" placeholder="Số tiền" value="${Math.round(conNo).toLocaleString('vi-VN')}"></div>
          <div class="field span2"><label>Phương thức</label><select id="fPhuongThucTT"><option value="TienMat">Tiền mặt</option><option value="ChuyenKhoan">Chuyển khoản</option><option value="The">Thẻ</option></select></div>
        </div>
        <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Đóng</button><button class="btn" onclick="ghiNhanThanhToanGC('${idPhieu}','${isThu ? 'DaThu' : 'DaTra'}')">Ghi nhận</button></div>
      ` : `<div class="modalActions"><button class="btn secondary" onclick="closeModal()">Đóng</button></div>`}
    `);
  }).catch(err => showToast('Lỗi: ' + err.message));
}
function ghiNhanThanhToanGC(idPhieu, loaiTien) {
  const soTien = parseSoTien(document.getElementById('fSoTienTT').value);
  if (soTien <= 0) { showToast('Nhập số tiền hợp lệ.'); return; }
  const phuongThuc = document.getElementById('fPhuongThucTT').value;
  apiCall('capNhatThanhToanGiaCong', { idPhieu, loaiTien, soTien, phuongThuc }).then(() => { closeModal(); showToast('Đã ghi nhận.'); renderGiaCongTable(); renderCongNo(); }).catch(err => showToast('Lỗi: ' + err.message));
}
function openCapNhatTrangThaiGC(idPhieu) {
  const phieu = STATE.giaCongList.find(p => p.IDPhieu === idPhieu);
  const options = ['TiepNhan', 'DangGiaCong', 'HoanThanh', 'DaGiao'];
  openModal(`
    <button class="modalClose" onclick="closeModal()">&times;</button>
    <h3>Cập nhật trạng thái gia công</h3>
    <div class="formGrid">
      <div class="field span2"><label>Trạng thái</label><select id="fTrangThaiGC">${options.map(o => `<option value="${o}" ${phieu.TrangThai === o ? 'selected' : ''}>${trangThaiGCLabel(o)}</option>`).join('')}</select></div>
      <div class="field span2"><label>Ngày hoàn thành (nếu có)</label><input type="date" id="fNgayHoanThanhGC" value="${phieu.NgayHoanThanh ? formatForInput(phieu.NgayHoanThanh) : ''}"></div>
    </div>
    <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="luuTrangThaiGC('${idPhieu}')">Lưu</button></div>
  `);
}
function luuTrangThaiGC(idPhieu) {
  const trangThai = document.getElementById('fTrangThaiGC').value;
  const ngayHoanThanh = document.getElementById('fNgayHoanThanhGC').value;
  apiCall('capNhatTrangThaiGiaCong', { idPhieu, trangThai, ngayHoanThanh }).then(() => { closeModal(); showToast('Đã cập nhật trạng thái.'); renderGiaCongTable(); }).catch(err => showToast('Lỗi: ' + err.message));
}
