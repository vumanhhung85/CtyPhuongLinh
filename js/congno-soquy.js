/* ================= CÔNG NỢ ================= */
function renderCongNo() {
  apiCall('getCongNo').then(res => {
    const tongThu = tongTien(res.phaiThu, x => x.conNo), tongTra = tongTien(res.phaiTra, x => x.conNo);
    veKpi('kpiCongNo', [
      { label: 'Tổng phải thu', val: fmtMoney(tongThu), mau: 'orange', phu: res.phaiThu.length + ' phiếu' },
      { label: 'Tổng phải trả', val: fmtMoney(tongTra), mau: 'gray', phu: res.phaiTra.length + ' phiếu' },
      { label: 'Chênh lệch (thu − trả)', val: fmtMoney(tongThu - tongTra), mau: tongThu - tongTra >= 0 ? 'green' : 'red' }
    ]);
    const thuWrap = document.getElementById('phaiThuWrap');
    if (!res.phaiThu.length) { thuWrap.innerHTML = '<div class="empty">Không có công nợ phải thu.</div>'; }
    else {
      thuWrap.innerHTML = `<table><thead><tr><th>Loại</th><th>Ngày</th><th>Khách hàng</th><th>Tổng tiền</th><th>Đã thu</th><th>Còn nợ</th></tr></thead><tbody>
        ${res.phaiThu.map(x => `<tr><td><span class="tag info">${x.loai}</span></td><td>${fmtDate(x.ngay)}</td><td>${x.doiTac || 'Khách lẻ'}</td><td>${fmtMoney(x.tongTien)}</td><td>${fmtMoney(x.daNhan)}</td><td><span class="tag warn">${fmtMoney(x.conNo)}</span></td></tr>`).join('')}
      </tbody></table>`;
    }
    const traWrap = document.getElementById('phaiTraWrap');
    if (!res.phaiTra.length) { traWrap.innerHTML = '<div class="empty">Không có công nợ phải trả.</div>'; }
    else {
      traWrap.innerHTML = `<table><thead><tr><th>Loại</th><th>Ngày</th><th>Đối tác</th><th>Tổng tiền</th><th>Đã trả</th><th>Còn nợ</th></tr></thead><tbody>
        ${res.phaiTra.map(n => `<tr><td><span class="tag info">${n.loai}</span></td><td>${fmtDate(n.ngay)}</td><td>${n.doiTac || '—'}</td><td>${fmtMoney(n.tongTien)}</td><td>${fmtMoney(n.daTra)}</td><td><span class="tag bad">${fmtMoney(n.conNo)}</span></td></tr>`).join('')}
      </tbody></table>`;
    }
  }).catch(err => showToast('Lỗi: ' + err.message));
}

/* ================= SỔ QUỸ ================= */
const NHOM_MUC_THU_LABEL = { BanHang: 'Bán hàng', SuaChua: 'Sửa chữa', GiaCong: 'Gia công', ThuKhac: 'Thu khác' };
const NHOM_MUC_CHI_LABEL = { MuaHang: 'Mua hàng', Luong: 'Lương nhân viên', ThueMatBang: 'Thuê mặt bằng', DienNuoc: 'Điện nước', HoaHong: 'Hoa hồng', ChiKhac: 'Chi khác' };
function nhomMucLabel(loai, nhomMuc) { return (loai === 'Thu' ? NHOM_MUC_THU_LABEL : NHOM_MUC_CHI_LABEL)[nhomMuc] || nhomMuc; }
function phuongThucLabel(pt) { return { TienMat: 'Tiền mặt', ChuyenKhoan: 'Chuyển khoản', The: 'Thẻ' }[pt] || pt; }
function nguonGocLabel(ng) {
  if (!ng || ng === 'TuDo') return '<span class="muted">Nhập tay</span>';
  const [sheet, id] = ng.split(':');
  const map = { XuatBan: 'Xuất bán', NhapKho: 'Nhập kho', SuaChua: 'Sửa chữa', GiaCong: 'Gia công' };
  return `${map[sheet] || sheet} <span class="muted">${id || ''}</span>`;
}

(function initQuyDates() {
  const now = new Date();
  document.getElementById('quyTuNgay').value = ngayISO(new Date(now.getFullYear(), now.getMonth(), 1));
  document.getElementById('quyDenNgay').value = todayISO();
})();
document.getElementById('btnLocQuy').addEventListener('click', renderSoQuy);

/* ================= QR CHUYỂN KHOẢN NHẬN TIỀN ================= */
// Hiện mã QR VietQR (dùng dịch vụ ảnh miễn phí img.vietqr.io — phù hợp vì chỉ tạo 1 mã QR/lần xem
// phiếu, không phải sinh hàng loạt) với số tiền = còn nợ, nội dung = đúng mã phiếu để hệ thống SePay tự
// động khớp và đánh dấu đã thanh toán khi khách chuyển khoản (xem Cài đặt > QR chuyển khoản tự động).
function taoKhungQR(idPhieu, soTien) {
  const el = document.getElementById('qrBox_' + idPhieu);
  if (!el) return;
  apiCall('getThongTinNganHang').then(c => {
    if (!c.bankBin || !c.bankAccountNumber) {
      el.innerHTML = '<p class="muted">Chưa cấu hình tài khoản ngân hàng (Admin vào Cài đặt để bật QR tự động).</p>';
      return;
    }
    const url = `https://img.vietqr.io/image/${encodeURIComponent(c.bankBin)}-${encodeURIComponent(c.bankAccountNumber)}-compact2.png?amount=${Math.round(soTien)}&addInfo=${encodeURIComponent(idPhieu)}&accountName=${encodeURIComponent(c.bankAccountName || '')}`;
    el.innerHTML = `<img src="${url}" alt="QR chuyển khoản" style="width:220px;max-width:100%;border-radius:10px;border:1px solid var(--line);">
      <p class="muted" style="margin-top:6px;">Nội dung CK: <b>${idPhieu}</b> — hệ thống sẽ tự đánh dấu đã thanh toán khi nhận được tiền đúng nội dung này.</p>`;
  }).catch(() => { el.innerHTML = '<p class="muted">Không tải được mã QR.</p>'; });
}
function toggleQR(idPhieu, soTien) {
  const el = document.getElementById('qrBox_' + idPhieu);
  if (!el) return;
  const dangAn = el.style.display === 'none' || !el.innerHTML;
  el.style.display = dangAn ? 'block' : 'none';
  if (dangAn && !el.innerHTML) taoKhungQR(idPhieu, soTien);
}

function renderSoQuy() {
  Promise.all([apiCall('getSoDuQuy'), apiCall('getSoQuyList', {
    tuNgay: document.getElementById('quyTuNgay').value,
    denNgay: document.getElementById('quyDenNgay').value,
    loai: document.getElementById('quyLocLoai').value,
    phuongThuc: document.getElementById('quyLocPT').value
  })]).then(([soDu, list]) => {
    veKpi('soQuyCards', [
      { label: 'Số dư tiền mặt', val: fmtMoney(soDu.tienMat.soDu), mau: soDu.tienMat.soDu < 0 ? 'red' : 'blue' },
      { label: 'Số dư chuyển khoản', val: fmtMoney(soDu.chuyenKhoan.soDu), mau: soDu.chuyenKhoan.soDu < 0 ? 'red' : 'navy' },
      { label: 'Số dư thẻ', val: fmtMoney(soDu.the.soDu), mau: soDu.the.soDu < 0 ? 'red' : 'teal' },
      { label: 'Tổng thu (theo bộ lọc)', val: fmtMoney(list.filter(r => r.Loai === 'Thu').reduce((s, r) => s + Number(r.SoTien), 0)), mau: 'green' },
      { label: 'Tổng chi (theo bộ lọc)', val: fmtMoney(list.filter(r => r.Loai === 'Chi').reduce((s, r) => s + Number(r.SoTien), 0)), mau: 'orange' }
    ]);

    const wrap = document.getElementById('soQuyTableWrap');
    if (!list.length) { wrap.innerHTML = '<div class="empty">Chưa có khoản thu chi nào trong khoảng đã chọn.</div>'; return; }
    wrap.innerHTML = `<table><thead><tr><th>Ngày</th><th>Loại</th><th>Nhóm mục</th><th>Số tiền</th><th>Phương thức</th><th>Nguồn gốc</th><th>Ghi chú</th><th></th></tr></thead><tbody>
      ${list.map(r => `<tr>
        <td>${fmtDate(r.Ngay)}</td>
        <td>${r.Loai === 'Thu' ? '<span class="tag good">Thu</span>' : '<span class="tag bad">Chi</span>'}</td>
        <td>${nhomMucLabel(r.Loai, r.NhomMuc)}</td>
        <td>${fmtMoney(r.SoTien)}</td>
        <td>${phuongThucLabel(r.PhuongThuc)}</td>
        <td>${nguonGocLabel(r.NguonGoc)}</td>
        <td class="muted">${r.MoTa || ''}</td>
        <td class="rowActions">${r.NguonGoc === 'TuDo' ? `<button class="iconBtn iconDanger" title="Xoá" onclick="xoaThuChiUI('${r.IDPhieu}')">${ICON_XOA}</button>` : ''}</td>
      </tr>`).join('')}
    </tbody></table>`;
  }).catch(err => showToast('Lỗi: ' + err.message));
}

function moFormThuChi(loai) {
  const danhSachNhom = loai === 'Thu' ? NHOM_MUC_THU_LABEL : NHOM_MUC_CHI_LABEL;
  const nhomOptions = Object.keys(danhSachNhom).map(k => `<option value="${k}">${danhSachNhom[k]}</option>`).join('');
  openModal(`
    <button class="modalClose" onclick="closeModal()">&times;</button>
    <h3>${loai === 'Thu' ? '+ Thu tiền' : '+ Chi tiền'}</h3>
    <div class="formGrid">
      <div class="field"><label>Ngày</label><input type="date" id="fNgay" value="${todayISO()}"></div>
      <div class="field"><label>Nhóm mục</label><select id="fNhomMuc">${nhomOptions}</select></div>
      <div class="field"><label>Số tiền</label><input type="text" inputmode="numeric" class="moneyInput" id="fSoTien" placeholder="Số tiền"></div>
      <div class="field"><label>Phương thức</label><select id="fPhuongThuc"><option value="TienMat">Tiền mặt</option><option value="ChuyenKhoan">Chuyển khoản</option><option value="The">Thẻ</option></select></div>
      <div class="field span2"><label>Ghi chú</label><input id="fMoTa" placeholder="VD: Lương tháng 8, tiền điện T8..."></div>
    </div>
    <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="submitThuChi('${loai}')">Lưu</button></div>
  `);
}
document.getElementById('btnThuTien').addEventListener('click', () => moFormThuChi('Thu'));
document.getElementById('btnChiTien').addEventListener('click', () => moFormThuChi('Chi'));

function submitThuChi(loai) {
  const soTien = parseSoTien(document.getElementById('fSoTien').value);
  if (soTien <= 0) { showToast('Nhập số tiền hợp lệ.'); return; }
  const data = {
    Loai: loai, Ngay: document.getElementById('fNgay').value,
    NhomMuc: document.getElementById('fNhomMuc').value, SoTien: soTien,
    PhuongThuc: document.getElementById('fPhuongThuc').value,
    MoTa: document.getElementById('fMoTa').value.trim()
  };
  apiCall('saveThuChi', { data }).then(() => { closeModal(); showToast('Đã ghi nhận.'); renderSoQuy(); }).catch(err => showToast('Lỗi: ' + err.message));
}
function xoaThuChiUI(idPhieu) {
  if (!confirm('Xoá khoản thu chi này?')) return;
  apiCall('xoaThuChi', { idPhieu }).then(() => { showToast('Đã xoá.'); renderSoQuy(); }).catch(err => showToast('Lỗi: ' + err.message));
}
