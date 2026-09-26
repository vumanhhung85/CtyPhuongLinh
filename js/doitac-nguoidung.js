/* ================= ĐỐI TÁC (KH / NCC) ================= */
function renderKhachHangTable() {
  apiCall('getKhachHangList').then(list => {
    STATE.khachHangList = list;
    const wrap = document.getElementById('khTableWrap');
    if (!list.length) { wrap.innerHTML = '<div class="empty">Chưa có khách hàng nào.</div>'; return; }
    wrap.innerHTML = `<table><thead><tr><th>Tên</th><th>MST</th><th>SĐT</th><th>Địa chỉ</th><th></th></tr></thead><tbody>
      ${list.map(k => `<tr><td>${k.TenKH}</td><td>${k.MST || ''}</td><td>${k.SDT || ''}</td><td>${k.DiaChi || ''}</td><td class="rowActions"><button class="iconBtn iconDanger" title="Xoá" onclick="deleteDoiTac('kh','${k.MaKH}')">${ICON_XOA}</button></td></tr>`).join('')}
    </tbody></table>`;
  }).catch(err => showToast('Lỗi: ' + err.message));
}
function renderNhaCungCapTable() {
  apiCall('getNhaCungCapList').then(list => {
    STATE.nhaCungCapList = list;
    const wrap = document.getElementById('nccTableWrap');
    if (!list.length) { wrap.innerHTML = '<div class="empty">Chưa có nhà cung cấp nào.</div>'; return; }
    wrap.innerHTML = `<table><thead><tr><th>Tên</th><th>MST</th><th>SĐT</th><th>Địa chỉ</th><th></th></tr></thead><tbody>
      ${list.map(n => `<tr><td>${n.TenNCC}</td><td>${n.MST || ''}</td><td>${n.SDT || ''}</td><td>${n.DiaChi || ''}</td><td class="rowActions"><button class="iconBtn iconDanger" title="Xoá" onclick="deleteDoiTac('ncc','${n.MaNCC}')">${ICON_XOA}</button></td></tr>`).join('')}
    </tbody></table>`;
  }).catch(err => showToast('Lỗi: ' + err.message));
}
document.getElementById('btnAddKH').addEventListener('click', () => openDoiTacForm('kh'));
document.getElementById('btnAddNCC').addEventListener('click', () => openDoiTacForm('ncc'));
function openDoiTacForm(loai) {
  const isKH = loai === 'kh';
  openModal(`
    <button class="modalClose" onclick="closeModal()">&times;</button>
    <h3>Thêm ${isKH ? 'khách hàng' : 'nhà cung cấp'}</h3>
    <div class="formGrid">
      <div class="field"><label>Mã số thuế</label><input id="fMSTDT" placeholder="Nhập MST rồi bấm Tra cứu"></div>
      <div class="field" style="align-self:end;"><button class="btn secondary" type="button" style="width:100%;" onclick="traCuuMST()">🔍 Tra cứu theo MST</button></div>
      <div id="traCuuMSTStatus" class="muted span2" style="margin:-6px 0 0;"></div>
      <div class="field span2"><label>Tên ${isKH ? 'khách hàng' : 'nhà cung cấp'}</label><input id="fTenDT"></div>
      <div class="field"><label>Số điện thoại</label><input id="fSDTDT"></div>
      <div class="field span2"><label>Địa chỉ</label><input id="fDiaChiDT"></div>
      <div class="field span2"><label>Ghi chú</label><input id="fGhiChuDT"></div>
    </div>
    <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="saveDoiTacUI('${loai}')">Lưu</button></div>
  `);
}
function traCuuMST() {
  const mst = document.getElementById('fMSTDT').value.trim().replace(/\D/g, '');
  const statusEl = document.getElementById('traCuuMSTStatus');
  if (!mst || mst.length < 9) { statusEl.textContent = 'Nhập đúng mã số thuế (9-13 số) trước khi tra cứu.'; return; }
  statusEl.textContent = 'Đang tra cứu...';
  fetch('https://api.vietqr.io/v2/business/' + mst)
    .then(r => r.json())
    .then(res => {
      if (res.code === '00' && res.data) {
        document.getElementById('fTenDT').value = res.data.name || '';
        document.getElementById('fDiaChiDT').value = res.data.address || '';
        statusEl.textContent = '✓ Đã tự điền tên và địa chỉ theo MST. Anh kiểm tra lại trước khi lưu.';
      } else {
        statusEl.textContent = 'Không tìm thấy doanh nghiệp với MST này — vui lòng nhập tay.';
      }
    })
    .catch(() => { statusEl.textContent = 'Không tra cứu được (lỗi mạng) — vui lòng nhập tay.'; });
}
function saveDoiTacUI(loai) {
  const isKH = loai === 'kh'; const ten = document.getElementById('fTenDT').value.trim();
  if (!ten) { showToast('Vui lòng nhập tên.'); return; }
  const data = { MST: document.getElementById('fMSTDT').value.trim(), SDT: document.getElementById('fSDTDT').value.trim(), DiaChi: document.getElementById('fDiaChiDT').value.trim(), GhiChu: document.getElementById('fGhiChuDT').value.trim() };
  if (isKH) data.TenKH = ten; else data.TenNCC = ten;
  apiCall(isKH ? 'saveKhachHang' : 'saveNhaCungCap', { data }).then(() => { closeModal(); showToast('Đã lưu.'); if (isKH) renderKhachHangTable(); else renderNhaCungCapTable(); }).catch(err => showToast('Lỗi: ' + err.message));
}
function deleteDoiTac(loai, id) {
  if (!confirm('Xoá mục này?')) return;
  const isKH = loai === 'kh';
  apiCall(isKH ? 'deleteKhachHang' : 'deleteNhaCungCap', isKH ? { maKH: id } : { maNCC: id }).then(() => { showToast('Đã xoá.'); if (isKH) renderKhachHangTable(); else renderNhaCungCapTable(); }).catch(err => showToast('Lỗi: ' + err.message));
}

/* ================= NGƯỜI DÙNG ================= */
function renderNguoiDungTable() {
  apiCall('getNguoiDungList').then(list => {
    const wrap = document.getElementById('nguoiDungTableWrap');
    wrap.innerHTML = `<table><thead><tr><th>Họ tên</th><th>Tên đăng nhập</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${list.map(u => `<tr><td>${u.HoTen}</td><td>${u.TenDangNhap}</td><td>${vaiTroLabel(u.VaiTro)}</td>
        <td>${u.TrangThai === 'Active' ? '<span class="tag good">Hoạt động</span>' : '<span class="tag bad">Đã khoá</span>'}</td>
        <td class="rowActions">
          <button class="iconBtn" title="Sửa" onclick="openEditNguoiDung('${u.MaNV}')">${ICON_SUA}</button>
          ${u.TenDangNhap !== 'admin' ? `<button class="iconBtn${u.TrangThai === 'Active' ? ' iconDanger' : ''}" title="${u.TrangThai === 'Active' ? 'Khoá tài khoản' : 'Mở khoá tài khoản'}" onclick="toggleKhoaNguoiDung('${u.MaNV}','${u.TrangThai === 'Active' ? 'Locked' : 'Active'}')">${u.TrangThai === 'Active' ? ICON_KHOA : ICON_MOKHOA}</button>` : ''}
        </td>
      </tr>`).join('')}
    </tbody></table>`;
  }).catch(err => showToast('Lỗi: ' + err.message));
}
document.getElementById('btnAddNguoiDung').addEventListener('click', () => openEditNguoiDung(null));
function openEditNguoiDung(maNV) {
  apiCall('getNguoiDungList').then(list => {
    const item = maNV ? list.find(u => u.MaNV === maNV) : null;
    openModal(`
      <button class="modalClose" onclick="closeModal()">&times;</button>
      <h3>${item ? 'Sửa người dùng' : 'Thêm người dùng'}</h3>
      <div class="formGrid">
        <div class="field span2"><label>Họ tên</label><input id="fHoTen" value="${item ? item.HoTen : ''}"></div>
        <div class="field"><label>Tên đăng nhập</label><input id="fTenDangNhap" value="${item ? item.TenDangNhap : ''}" ${item ? 'disabled' : ''}></div>
        <div class="field"><label>Vai trò</label><select id="fVaiTro">
          <option value="Admin" ${item && item.VaiTro === 'Admin' ? 'selected' : ''}>Quản trị viên (toàn quyền)</option>
          <option value="BanHang" ${item && item.VaiTro === 'BanHang' ? 'selected' : ''}>Bán hàng</option>
          <option value="KyThuat" ${item && item.VaiTro === 'KyThuat' ? 'selected' : ''}>Kỹ thuật</option>
          <option value="KeToan" ${item && item.VaiTro === 'KeToan' ? 'selected' : ''}>Kế toán</option>
        </select></div>
        <div class="field span2"><label>${item ? 'Đặt lại mật khẩu (để trống nếu không đổi)' : 'Mật khẩu ban đầu'}</label><input type="password" id="fMatKhauMoiND" placeholder="Tối thiểu 6 ký tự"></div>
      </div>
      <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="saveNguoiDungUI('${item ? item.MaNV : ''}')">Lưu</button></div>
    `);
  });
}
function saveNguoiDungUI(maNV) {
  const data = {
    MaNV: maNV || undefined, HoTen: document.getElementById('fHoTen').value.trim(),
    TenDangNhap: document.getElementById('fTenDangNhap').value.trim(), VaiTro: document.getElementById('fVaiTro').value,
    MatKhauMoi: document.getElementById('fMatKhauMoiND').value
  };
  if (!data.HoTen || !data.TenDangNhap) { showToast('Vui lòng nhập đủ họ tên và tên đăng nhập.'); return; }
  apiCall('saveNguoiDung', { data }).then(() => { closeModal(); showToast('Đã lưu.'); renderNguoiDungTable(); }).catch(err => showToast('Lỗi: ' + err.message));
}
function toggleKhoaNguoiDung(maNV, trangThai) {
  apiCall('khoaMoNguoiDung', { maNV, trangThai }).then(() => { showToast('Đã cập nhật trạng thái.'); renderNguoiDungTable(); }).catch(err => showToast('Lỗi: ' + err.message));
}
document.getElementById('btnDoiMatKhau').addEventListener('click', () => {
  const matKhauCu = document.getElementById('fMatKhauCu').value;
  const matKhauMoi = document.getElementById('fMatKhauMoi').value;
  if (!matKhauCu || !matKhauMoi) { showToast('Nhập đủ mật khẩu hiện tại và mật khẩu mới.'); return; }
  apiCall('doiMatKhau', { matKhauCu, matKhauMoi }).then(() => {
    showToast('Đã đổi mật khẩu.'); document.getElementById('fMatKhauCu').value = ''; document.getElementById('fMatKhauMoi').value = '';
  }).catch(err => showToast('Lỗi: ' + err.message));
});
