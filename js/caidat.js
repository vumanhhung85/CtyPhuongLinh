/* ================= CÀI ĐẶT ================= */
// Kết nối máy chủ: chỉ HIỂN THỊ địa chỉ API đang dùng (đặt trong js/config.js) + nút kiểm tra kết nối.
document.getElementById('settingsApiUrl').value = CONFIG.API_URL || '(chưa cấu hình — sửa file js/config.js)';
document.getElementById('btnKiemTraKetNoi').addEventListener('click', () => {
  const kq = document.getElementById('ketQuaKetNoi');
  kq.textContent = 'Đang kiểm tra...';
  const t0 = performance.now();
  apiCall('pingPhien').then(() => { kq.textContent = `✓ Kết nối tốt — máy chủ phản hồi sau ${Math.round(performance.now() - t0)} ms.`; })
    .catch(err => { kq.textContent = '✗ ' + err.message; });
});

/* ---- Xuất toàn bộ dữ liệu ra 1 file Excel (thay cho việc mở Google Sheet xem như bản cũ) ----
   Mỗi bảng = 1 sheet, đúng tên sheet của Google Sheet cũ. Ô chữ (MST, SĐT, số hoá đơn...) giữ nguyên dạng chữ,
   không mất số 0 đầu. Dùng làm bản sao lưu định kỳ luôn được. */
const BANG_XUAT_EXCEL = ['HangHoa', 'KhachHang', 'NhaCungCap', 'NhapKho', 'NhapKhoCT', 'XuatBan', 'XuatBanCT',
  'SuaChua', 'SuaChuaCT', 'GiaCong', 'GiaCongCT', 'SoQuy', 'NguoiDung', 'Config', 'NhatKyHoatDong', 'DieuChinhKho', 'SePayGiaoDich'];
document.getElementById('btnXuatExcel').addEventListener('click', async () => {
  const btn = document.getElementById('btnXuatExcel');
  const trangThai = document.getElementById('xuatExcelTrangThai');
  btn.disabled = true;
  try {
    trangThai.textContent = 'Đang tải thư viện Excel...';
    await caiThuVien('xlsx');
    const wb = XLSX.utils.book_new();
    let tongDong = 0;
    for (const bang of BANG_XUAT_EXCEL) {
      let offset = 0, cols = [], rows = [];
      for (;;) {
        trangThai.textContent = `Đang tải bảng ${bang}... (${rows.length} dòng)`;
        const kq = await apiCall('exportTable', { table: bang, offset });
        cols = kq.cols; rows = rows.concat(kq.rows);
        if (!kq.conTiep) break;
        offset += kq.rows.length;
      }
      const ws = XLSX.utils.aoa_to_sheet([cols, ...rows.map(r => cols.map(c => (r[c] === null || r[c] === undefined) ? '' : r[c]))]);
      XLSX.utils.book_append_sheet(wb, ws, bang);
      tongDong += rows.length;
    }
    XLSX.writeFile(wb, `PhuongLinh_DuLieu_${todayISO()}.xlsx`);
    trangThai.textContent = `✓ Đã xuất ${BANG_XUAT_EXCEL.length} bảng, ${tongDong.toLocaleString('vi-VN')} dòng.`;
  } catch (err) {
    trangThai.textContent = '✗ Lỗi: ' + err.message;
  } finally { btn.disabled = false; }
});
document.getElementById('btnLuuSoDuDauKy').addEventListener('click', () => {
  const data = {
    TienMat: parseSoTien(document.getElementById('fSoDuTienMat').value),
    ChuyenKhoan: parseSoTien(document.getElementById('fSoDuChuyenKhoan').value),
    The: parseSoTien(document.getElementById('fSoDuThe').value)
  };
  apiCall('capNhatSoDuDauKy', { data }).then(() => showToast('Đã lưu số dư đầu kỳ.')).catch(err => showToast('Lỗi: ' + err.message));
});
document.getElementById('btnLuuCauHinhNganHang').addEventListener('click', () => {
  const data = {
    bankBin: document.getElementById('fBankBin').value.trim(),
    bankAccountNumber: document.getElementById('fBankAccountNumber').value.trim(),
    bankAccountName: document.getElementById('fBankAccountName').value.trim()
  };
  apiCall('capNhatCauHinhThanhToan', { data }).then(() => showToast('Đã lưu thông tin ngân hàng.')).catch(err => showToast('Lỗi: ' + err.message));
});
// Tự điền số dư đầu kỳ + cấu hình ngân hàng hiện tại khi vào tab Cài đặt (chỉ Admin mới thấy các panel này)
document.getElementById('tabbar').addEventListener('click', e => {
  const btn = e.target.closest('button[data-tab="caidat"]'); if (!btn) return;
  if (STATE.user && STATE.user.vaiTro === 'Admin') {
    apiCall('getSoDuQuy').then(d => {
      document.getElementById('fSoDuTienMat').value = Math.round(d.tienMat.soDuDauKy).toLocaleString('vi-VN');
      document.getElementById('fSoDuChuyenKhoan').value = Math.round(d.chuyenKhoan.soDuDauKy).toLocaleString('vi-VN');
      document.getElementById('fSoDuThe').value = Math.round(d.the.soDuDauKy).toLocaleString('vi-VN');
    }).catch(() => {});
    apiCall('getCauHinhThanhToan').then(c => {
      document.getElementById('fBankBin').value = c.bankBin;
      document.getElementById('fBankAccountNumber').value = c.bankAccountNumber;
      document.getElementById('fBankAccountName').value = c.bankAccountName;
      document.getElementById('fWebhookUrl').value = c.webhookUrl;
      STATE.cauHinhThanhToan = c; // dùng lại khi hiển thị QR trên các phiếu, khỏi gọi mạng lại mỗi lần mở 1 phiếu
    }).catch(() => {});
  }
});
document.getElementById('btnXemNhatKy').addEventListener('click', () => {
  apiCall('getNhatKy').then(list => {
    const wrap = document.getElementById('nhatKyWrap');
    if (!list.length) { wrap.innerHTML = '<div class="empty">Chưa có hoạt động nào.</div>'; return; }
    wrap.innerHTML = `<table><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th></tr></thead><tbody>
      ${list.map(l => `<tr><td>${new Date(l.Timestamp).toLocaleString('vi-VN')}</td><td>${l.NguoiDung}</td><td>${l.HanhDong}</td></tr>`).join('')}
    </tbody></table>`;
  }).catch(err => showToast('Lỗi: ' + err.message));
});
