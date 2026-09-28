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
      const tonHtml = h.Loai === 'HangHoa' ? (ton <= 0 ? `<span class="tag bad">${fmtSoLuong(ton)}</span>` : tonKhoKep(h)) : '—';
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
    </div>
    ${item.Loai === 'HangHoa' ? `
    <div class="panel" style="margin:10px 0 0;background:#fffaf0;border-color:#f3dfb4;">
      <p class="muted" style="margin:0 0 8px;">Phiếu cũ ghi sai đơn vị (VD hoá đơn nhập <b>1 Cuộn</b> nhưng kho chỉ tăng <b>1 Mét</b> vì lúc đó chưa khai "Đơn vị nhập lớn") — bấm để xem từng dòng và chọn lại đúng đơn vị. Tồn kho, giá vốn và giá vốn các dòng bán sẽ được tính lại.</p>
      <button class="btn secondary small" type="button" onclick="moDongTheoDonVi('${item.MaHH}')">📐 Kiểm tra đơn vị các phiếu đã ghi</button>
      <div id="dsDongDonVi" style="margin-top:8px;"></div>
    </div>` : ''}` : ''}
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
  apiCall('deleteHangHoa', { maHH }).then(() => { showToast('Đã xoá.'); renderHangHoaTable(); }).catch(baoLoiXoaDanhMuc);
}
/* ---- Chọn lại đơn vị cho dòng phiếu cũ (áp hệ số quy đổi) ---- */
let _dongDonVi = null;
function moDongTheoDonVi(maHH, thongBao) {
  const box = document.getElementById('dsDongDonVi');
  const item = STATE.hangHoaList.find(h => h.MaHH === maHH) || {};
  const dvtNhapForm = document.getElementById('fDVTNhap').value.trim();
  const heSoForm = Number(document.getElementById('fHeSoQuyDoi').value) || 0;
  if (dvtNhapForm !== (item.DVTNhap || '') || heSoForm !== (Number(item.HeSoQuyDoi) || 0) || document.getElementById('fDVT').value.trim() !== (item.DVT || '')) {
    box.innerHTML = '<p style="color:var(--warn);margin:0;">Anh vừa đổi đơn vị/hệ số trong form — bấm <b>Lưu</b> trước, rồi mở lại để kiểm tra phiếu cũ.</p>';
    return;
  }
  box.textContent = 'Đang tải các dòng phiếu...';
  apiCall('getDongTheoDonVi', { maHH }).then(res => {
    _dongDonVi = res; veDongTheoDonVi();
    if (thongBao) { const k = document.getElementById('kqDonVi'); if (k) k.innerHTML = thongBao; }
  })
    .catch(err => { box.textContent = ''; showToast('Lỗi: ' + err.message); });
}
function veDongTheoDonVi() {
  const box = document.getElementById('dsDongDonVi');
  const { hangHoa: h, dong } = _dongDonVi;
  const heSo = Number(h.HeSoQuyDoi) || 0;
  const coDonViLon = !!(h.DVTNhap && heSo > 1);
  if (!dong.length) { box.innerHTML = '<p class="muted" style="margin:0;">Chưa có phiếu nào dùng mặt hàng này.</p>'; return; }
  const dvHienTai = d => (Number(d.HeSoQuyDoi) > 1 ? 'nhap' : 'goc');
  box.innerHTML = `
    ${coDonViLon ? `<p class="muted" style="margin:0 0 6px;">1 ${h.DVTNhap} = ${fmtSoLuong(heSo)} ${h.DVT}. Dòng tô vàng: hệ số 1 và không ghi ĐVT — thường là dòng nhập từ bảng kê trước khi khai hệ số.</p>`
      : `<p style="color:var(--warn);margin:0 0 6px;">Mặt hàng chưa khai "Đơn vị nhập lớn" và hệ số (&gt; 1) — khai rồi bấm Lưu trước khi chọn lại đơn vị.</p>`}
    <div class="tableWrap"><table class="itemsTable"><thead><tr><th>Phiếu</th><th>Số lượng ghi</th><th>Đơn vị</th><th class="num">Quy ra ${h.DVT || 'ĐV chính'}</th><th class="num">Thành tiền</th></tr></thead><tbody>
    ${dong.map((d, i) => {
      const nghiVan = coDonViLon && Number(d.HeSoQuyDoi) <= 1 && !d.DVT;
      return `<tr style="${nghiVan ? 'background:#fff4d6;' : ''}">
        <td>${d.TenBang} · ${fmtDate(d.Ngay)}${d.SoHD ? ' · HĐ ' + d.SoHD : ''}</td>
        <td data-label="Số lượng ghi">${fmtSoLuong(d.SoLuong)}${d.DVT ? ' ' + d.DVT : ''}</td>
        <td data-label="Đơn vị"><select data-i="${i}" onchange="capNhatXemTruocDonVi(this)" ${coDonViLon ? '' : 'disabled'} style="width:100%;padding:6px;">
          <option value="goc" ${dvHienTai(d) === 'goc' ? 'selected' : ''}>${h.DVT || 'ĐV chính'}</option>
          ${coDonViLon ? `<option value="nhap" ${dvHienTai(d) === 'nhap' ? 'selected' : ''}>${h.DVTNhap}</option>` : ''}
        </select></td>
        <td class="num" data-label="Quy ra ${h.DVT || ''}" id="xtDV${i}">${fmtSoLuong(d.SoLuongQuyDoi)}</td>
        <td class="num" data-label="Thành tiền">${fmtMoney(d.ThanhTien)}</td>
      </tr>`;
    }).join('')}
    </tbody></table></div>
    ${coDonViLon ? `<div style="text-align:right;margin-top:8px;"><button class="btn small" type="button" onclick="luuDonViDongCu('${h.MaHH}')">Lưu đơn vị các dòng đã đổi</button></div>` : ''}
    <div id="kqDonVi" style="margin-top:6px;font-size:13px;"></div>`;
}
function capNhatXemTruocDonVi(sel) {
  const i = Number(sel.dataset.i), d = _dongDonVi.dong[i], heSo = Number(_dongDonVi.hangHoa.HeSoQuyDoi) || 1;
  const moi = (Number(d.SoLuong) || 0) * (sel.value === 'nhap' ? heSo : 1);
  const doi = Math.abs(moi - Number(d.SoLuongQuyDoi)) > 1e-9;
  document.getElementById('xtDV' + i).innerHTML = doi ? `<span><s class="muted">${fmtSoLuong(d.SoLuongQuyDoi)}</s> → <b>${fmtSoLuong(moi)}</b></span>` : fmtSoLuong(d.SoLuongQuyDoi);
}
function luuDonViDongCu(maHH) {
  const heSo = Number(_dongDonVi.hangHoa.HeSoQuyDoi) || 1;
  const doi = [...document.querySelectorAll('#dsDongDonVi select[data-i]')].map(sel => {
    const d = _dongDonVi.dong[Number(sel.dataset.i)];
    const moi = (Number(d.SoLuong) || 0) * (sel.value === 'nhap' ? heSo : 1);
    return Math.abs(moi - Number(d.SoLuongQuyDoi)) > 1e-9 ? { Bang: d.Bang, ID: d.ID, DonVi: sel.value } : null;
  }).filter(Boolean);
  if (!doi.length) { showToast('Chưa đổi dòng nào.'); return; }
  if (!confirm(`Ghi lại đơn vị cho ${doi.length} dòng phiếu cũ, rồi tính lại tồn kho + giá vốn (kể cả giá vốn các dòng đã bán)?`)) return;
  const kq = document.getElementById('kqDonVi');
  kq.textContent = 'Đang cập nhật...';
  apiCall('apDungDonViDongCu', { maHH, dong: doi }).then(res => {
    const idx = STATE.hangHoaList.findIndex(h => h.MaHH === maHH);
    if (idx >= 0 && res.hangHoa) STATE.hangHoaList[idx] = res.hangHoa;
    drawHangHoaTable();
    showToast(`Đã cập nhật ${res.soDongCapNhat} dòng.`);
    moDongTheoDonVi(maHH, `✅ Đã cập nhật ${res.soDongCapNhat} dòng. <b>Tồn kho mới: ${tonKhoKep(res.hangHoa)}</b> · <b>Giá vốn mới: ${fmtMoney(res.giaVonMoi)}/${res.hangHoa.DVT || ''}</b>`);
  }).catch(err => { kq.textContent = ''; showToast('Lỗi: ' + err.message); });
}
function tinhLaiTonKhoUI(maHH) {
  const box = document.getElementById('ketQuaTinhLaiTon');
  box.textContent = 'Đang quét lịch sử phiếu...';
  apiCall('tinhLaiTonKho', { maHH }).then(res => {
    const hh = STATE.hangHoaList.find(h => h.MaHH === maHH);
    box.innerHTML = `Đã quét ${res.soSuKien} phiếu liên quan. <b>Tồn kho mới: ${hh ? tonKhoKep(hh, res.tonKhoMoi) : res.tonKhoMoi}</b> · <b>Giá vốn mới: ${fmtMoney(res.giaVonMoi)}</b>`;
    showToast('Đã tính lại tồn kho.');
    renderHangHoaTable();
  }).catch(err => { box.textContent = ''; showToast('Lỗi: ' + err.message); });
}
