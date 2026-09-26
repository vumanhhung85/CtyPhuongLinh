/* ================= DANH MỤC HÀNG HOÁ ================= */
function renderHangHoaTable() {
  apiCall('getHangHoaList').then(list => { STATE.hangHoaList = list; drawHangHoaTable(); }).catch(err => showToast('Lỗi: ' + err.message));
}
function drawHangHoaTable() {
  const search = (document.getElementById('searchHH').value || '').toLowerCase();
  const filterLoai = document.getElementById('filterLoaiHH').value;
  const anHetTon = document.getElementById('filterAnHetTon').checked;
  const anDichVu = document.getElementById('filterAnDichVu').checked;
  const anCotMa = document.getElementById('filterAnCotMa').checked;
  let list = STATE.hangHoaList.filter(h =>
    (!search || (h.TenHH || '').toLowerCase().includes(search) || (h.MaHH || '').toLowerCase().includes(search)) &&
    (!filterLoai || h.Loai === filterLoai) &&
    (!anHetTon || h.Loai !== 'HangHoa' || Number(h.TonKho) > 0) &&
    (!anDichVu || h.Loai !== 'DichVu')
  );
  const wrap = document.getElementById('hhTableWrap');
  if (list.length === 0) { wrap.innerHTML = '<div class="empty">Không có hàng hoá / dịch vụ nào phù hợp.</div>'; return; }
  wrap.innerHTML = `<table><thead><tr>${anCotMa ? '' : '<th style="width:1%;">Mã</th>'}<th>Tên</th><th>Loại</th><th>ĐVT</th><th>Giá vốn TB</th><th>Giá bán</th><th>Tồn kho</th><th></th></tr></thead><tbody>
    ${list.map(h => {
      const ton = Number(h.TonKho);
      const tonHtml = h.Loai === 'HangHoa' ? (ton <= 0 ? `<span class="tag bad">${ton}</span>` : ton) : '—';
      return `<tr>
      ${anCotMa ? '' : `<td class="muted" style="font-size:11px;white-space:nowrap;">${h.MaHH}</td>`}
      <td>${h.TenHH}${h.DVTNhap && Number(h.HeSoQuyDoi) > 1 ? `<div class="muted" style="font-size:11.5px;">1 ${h.DVTNhap} = ${h.HeSoQuyDoi} ${h.DVT}</div>` : ''}</td>
      <td>${h.Loai === 'HangHoa' ? '<span class="tag hh">Hàng hoá</span>' : '<span class="tag dv">Dịch vụ</span>'}</td>
      <td>${h.DVT || ''}</td><td>${fmtMoney(h.GiaVonTB)}</td><td>${fmtMoney(h.GiaBan)}</td>
      <td>${tonHtml}</td>
      <td class="rowActions"><button class="iconBtn" title="Sửa" onclick="openEditHH('${h.MaHH}')">${ICON_SUA}</button><button class="iconBtn iconDanger" title="Xoá" onclick="deleteHH('${h.MaHH}')">${ICON_XOA}</button></td>
    </tr>`;
    }).join('')}
  </tbody></table>`;
}
document.getElementById('searchHH').addEventListener('input', drawHangHoaTable);
document.getElementById('filterLoaiHH').addEventListener('change', drawHangHoaTable);
document.getElementById('filterAnHetTon').addEventListener('change', drawHangHoaTable);
document.getElementById('filterAnDichVu').addEventListener('change', drawHangHoaTable);
document.getElementById('filterAnCotMa').addEventListener('change', drawHangHoaTable);
document.getElementById('btnAddHH').addEventListener('click', () => openEditHH(null));

function openEditHH(maHH) {
  const item = maHH ? STATE.hangHoaList.find(h => h.MaHH === maHH) : null;
  openModal(`
    <button class="modalClose" onclick="closeModal()">&times;</button>
    <h3>${item ? 'Sửa hàng hoá / dịch vụ' : 'Thêm hàng hoá / dịch vụ'}</h3>
    <div class="formGrid">
      <div class="field span2"><label>Tên</label><input id="fTenHH" value="${item ? item.TenHH : ''}"></div>
      <div class="field"><label>Loại</label><select id="fLoai">
        <option value="HangHoa" ${item && item.Loai === 'HangHoa' ? 'selected' : ''}>Hàng hoá (có tồn kho)</option>
        <option value="DichVu" ${item && item.Loai === 'DichVu' ? 'selected' : ''}>Dịch vụ (không tồn kho)</option>
      </select></div>
      <div class="field"><label>Đơn vị tính (bán lẻ — dùng để theo dõi tồn kho)</label><input id="fDVT" value="${item ? item.DVT : ''}" placeholder="VD: Mét, Cái, Kg..."></div>
      <div class="field"><label>Giá bán</label><input id="fGiaBan" type="text" inputmode="numeric" class="moneyInput" value="${item ? Number(item.GiaBan).toLocaleString('vi-VN') : ''}"></div>
      <div class="field"><label>Tồn kho tối thiểu (cảnh báo)</label><input id="fTonToiThieu" type="number" value="${item ? item.TonKhoToiThieu : 0}"></div>
      <div class="field"><label>Đơn vị nhập lớn (nếu có — VD: Cuộn)</label><input id="fDVTNhap" value="${item ? item.DVTNhap || '' : ''}" placeholder="Để trống nếu không có"></div>
      <div class="field span2"><label>1 [Đơn vị nhập lớn] = ? [Đơn vị tính bán lẻ] <span class="muted">(VD: 1 Cuộn = 300 Mét — để trống hoặc 0 nếu không dùng đơn vị nhập lớn)</span></label><input id="fHeSoQuyDoi" type="number" min="0" step="0.01" value="${item ? item.HeSoQuyDoi || '' : ''}"></div>
      <div class="field span2"><label>Ghi chú</label><input id="fGhiChu" value="${item ? item.GhiChu || '' : ''}"></div>
    </div>
    ${item ? `
    <div class="panel" style="margin:14px 0 0;background:#f4f7ff;border-color:var(--brand-soft);">
      <p class="muted" style="margin:0 0 8px;">Nếu vừa đổi Loại (Hàng hoá ↔ Dịch vụ) hoặc nghi ngờ tồn kho sai — bấm nút này để quét lại toàn bộ lịch sử phiếu Nhập/Xuất/Sửa chữa/Gia công và tính lại đúng tồn kho + giá vốn từ đầu.</p>
      <button class="btn secondary small" type="button" onclick="tinhLaiTonKhoUI('${item.MaHH}')">🔄 Tính lại tồn kho từ lịch sử</button>
      <div id="ketQuaTinhLaiTon" style="margin-top:8px;font-size:13px;"></div>
    </div>` : ''}
    <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="saveHH('${item ? item.MaHH : ''}')">Lưu</button></div>
  `);
}
function saveHH(maHH) {
  const data = {
    MaHH: maHH || undefined, TenHH: document.getElementById('fTenHH').value.trim(),
    Loai: document.getElementById('fLoai').value, DVT: document.getElementById('fDVT').value.trim(),
    GiaBan: parseSoTien(document.getElementById('fGiaBan').value),
    TonKhoToiThieu: Number(document.getElementById('fTonToiThieu').value) || 0,
    GhiChu: document.getElementById('fGhiChu').value.trim(),
    DVTNhap: document.getElementById('fDVTNhap').value.trim(),
    HeSoQuyDoi: Number(document.getElementById('fHeSoQuyDoi').value) || 0
  };
  if (!data.TenHH) { showToast('Vui lòng nhập tên.'); return; }
  apiCall('saveHangHoa', { data }).then(res => {
    closeModal(); showToast('Đã lưu.');
    // Gộp trực tiếp bản ghi vừa lưu vào STATE và vẽ lại bảng ngay — khỏi gọi mạng lại getHangHoaList.
    if (res && res.hangHoa) {
      const idx = STATE.hangHoaList.findIndex(h => h.MaHH === res.hangHoa.MaHH);
      if (idx >= 0) STATE.hangHoaList[idx] = res.hangHoa; else STATE.hangHoaList.unshift(res.hangHoa);
      drawHangHoaTable();
    } else {
      renderHangHoaTable();
    }
  }).catch(err => showToast('Lỗi: ' + err.message));
}
function deleteHH(maHH) {
  if (!confirm('Xoá mục này khỏi danh mục?')) return;
  apiCall('deleteHangHoa', { maHH }).then(() => { showToast('Đã xoá.'); renderHangHoaTable(); }).catch(err => showToast('Lỗi: ' + err.message));
}
function tinhLaiTonKhoUI(maHH) {
  const box = document.getElementById('ketQuaTinhLaiTon');
  box.textContent = 'Đang quét lịch sử phiếu...';
  apiCall('tinhLaiTonKho', { maHH }).then(res => {
    box.innerHTML = `Đã quét ${res.soSuKien} phiếu liên quan. <b>Tồn kho mới: ${res.tonKhoMoi}</b> · <b>Giá vốn mới: ${fmtMoney(res.giaVonMoi)}</b>`;
    showToast('Đã tính lại tồn kho.');
    renderHangHoaTable();
  }).catch(err => { box.textContent = ''; showToast('Lỗi: ' + err.message); });
}
