/* ================= HÀM DÙNG CHUNG: FORM ITEMS (danh sách hàng hoá trong phiếu) ================= */
const THUE_SUAT_OPTIONS = ['0', '5', '8', '10', 'KCT'];
function thueSuatLabel(v) { return v === 'KCT' ? 'KCT' : v + '%'; }
function thueSuatOptionsHtml(selected) {
  return THUE_SUAT_OPTIONS.map(v => `<option value="${v}" ${String(selected) === v ? 'selected' : ''}>${thueSuatLabel(v)}</option>`).join('');
}
function tinhTienThueJS(soTien, thueSuat) {
  if (!thueSuat || thueSuat === 'KCT') return 0;
  const rate = parseFloat(String(thueSuat).replace('%', '')) || 0;
  return Math.round(soTien * rate / 100);
}

function renderItemsTableInto(containerId, mode) {
  document.getElementById(containerId).innerHTML = `
    <div class="itemsWrap" id="${containerId}_list"></div>
    <button class="btn secondary small" type="button" onclick="addItemRowInto('${containerId}','${mode}')">+ Thêm dòng hàng</button>
    <div class="grandTotal" style="font-size:13px;font-weight:400;text-align:right;line-height:1.8;">
      Tạm tính (trước thuế): <b id="${containerId}_grandTruoc">0 đ</b><br>
      Tiền thuế GTGT: <b id="${containerId}_grandThue">0 đ</b><br>
      <span style="font-size:16px;font-weight:800;color:var(--brand-deep);">Tổng thanh toán: <span id="${containerId}_grand">0 đ</span></span>
    </div>
  `;
  window['_itemsMode_' + containerId] = mode;
}
function addItemRowInto(containerId, mode) {
  const list = document.getElementById(containerId + '_list');
  const row = document.createElement('div');
  row.className = 'itemRow';
  row.innerHTML = `
    <div class="itemRowSearch">
      <input type="text" class="itemHHSearch" placeholder="🔍 Gõ tên hoặc mã hàng để tìm..." autocomplete="off"
        data-container="${containerId}" data-mode="${mode}"
        oninput="hhComboFilter(this)" onfocus="hhComboFilter(this)" onblur="hhComboBlur(this)">
      <input type="hidden" class="itemHH">
      <div class="hhComboList"></div>
    </div>
    <div class="itemRowInfo">Chưa chọn hàng hoá / dịch vụ</div>
    <div class="itemRowDonVi" style="display:none;margin-bottom:8px;">
      <label style="display:block;font-size:11px;color:var(--ink-soft);font-weight:600;margin-bottom:4px;">Nhập theo đơn vị</label>
      <select class="itemDonViChon" onchange="doiDonViNhap(this)" style="width:100%;padding:9px;border:1.5px solid var(--line);border-radius:8px;"></select>
    </div>
    <div class="itemRowGrid">
      <div class="field"><label>Số lượng</label>
        <div class="itemSLWrap">
          <button type="button" class="itemSLBtn itemSLMinus" tabindex="-1" aria-label="Giảm 1" onclick="buocSoLuong(this,-1,'${containerId}')">−</button>
          <input type="number" class="itemSL" value="1" min="0.01" step="0.01" oninput="updateLineTotalGeneric(this,'${containerId}')">
          <button type="button" class="itemSLBtn itemSLPlus" tabindex="-1" aria-label="Tăng 1" onclick="buocSoLuong(this,1,'${containerId}')">+</button>
        </div>
      </div>
      <div class="field"><label>Đơn giá</label><input type="text" inputmode="numeric" class="itemGia moneyInput" value="0" oninput="updateLineTotalGeneric(this,'${containerId}')"></div>
      <div class="field"><label>Thuế</label><select class="itemThueSuat" onchange="updateLineTotalGeneric(this,'${containerId}')">${thueSuatOptionsHtml('8')}</select></div>
      <div class="field itemRowTotal"><label>Thành tiền</label><div class="lineTotal">0 đ</div></div>
      <button class="itemRowDel" type="button" title="Xoá dòng" onclick="this.closest('.itemRow').remove(); recalcGrandTotalGeneric('${containerId}');">✕</button>
    </div>
  `;
  list.appendChild(row);
}

/* ---- Ô tìm kiếm hàng hoá có gợi ý kèm tồn kho + giá vốn + giá bán ---- */
function tinhSoLuongDaDungTrongPhieu(containerId, maHH, boQuaRow) {
  let daDung = 0;
  document.querySelectorAll('#' + containerId + '_list .itemRow').forEach(r => {
    if (r === boQuaRow) return;
    // Quy về đơn vị chính: dòng chọn "Cuộn" dùng SL x hệ số (trước đây cộng thẳng SL nên 1 Cuộn chỉ tính 1 Mét)
    if (r.dataset.mahh === maHH) {
      const heSo = r.dataset.donvidachon === 'nhap' ? (Number(r.dataset.hesoquydoi) || 1) : 1;
      daDung += (Number(r.querySelector('.itemSL').value) || 0) * heSo;
    }
  });
  return daDung;
}
function hhComboFilter(input) {
  const mode = input.dataset.mode;
  const containerId = input.dataset.container;
  const wrap = input.closest('.itemRowSearch');
  const currentRow = input.closest('.itemRow');
  const listEl = wrap.querySelector('.hhComboList');
  const q = normalizeVN(input.value);
  let results = STATE.hangHoaList;
  if (q) results = results.filter(h => normalizeVN(h.TenHH).includes(q) || normalizeVN(h.MaHH).includes(q));
  results = results.slice(0, 30);
  if (!results.length) {
    listEl.innerHTML = '<div class="hhComboEmpty">Không tìm thấy hàng hoá/dịch vụ phù hợp</div>';
  } else {
    listEl.innerHTML = results.map(h => {
      const daDungDongKhac = tinhSoLuongDaDungTrongPhieu(containerId, h.MaHH, currentRow);
      const tonThucTe = h.Loai === 'HangHoa' ? (Number(h.TonKho) || 0) - daDungDongKhac : null;
      const tonHet = h.Loai === 'HangHoa' && tonThucTe <= 0;
      const tonThap = h.Loai === 'HangHoa' && !tonHet && tonThucTe <= Number(h.TonKhoToiThieu || 0);
      const tonCls = tonHet ? 'hhComboTonHet' : (tonThap ? 'hhComboTonThap' : '');
      const tonText = h.Loai === 'HangHoa'
        ? (daDungDongKhac > 0 ? `Còn lại: ${tonKhoKep(h, tonThucTe)} (đã dùng ${fmtSoLuong(daDungDongKhac)} ở dòng khác)` : `Tồn: ${tonKhoKep(h)}`)
        : 'Dịch vụ';
      const dongKhacTag = daDungDongKhac > 0 ? `<span class="hhComboBadge hhComboTonThap">Đã có trong phiếu (SL: ${daDungDongKhac})</span>` : '';
      // Chỉ chặn chọn khi ĐANG XUẤT/DÙNG hàng (gia_ban) và hết tồn thực tế — Nhập kho (gia_von) vẫn chọn được vì đang mua thêm
      const khongChoChon = mode === 'gia_ban' && tonHet;
      const disabledAttr = khongChoChon ? 'data-khongchochon="1"' : '';
      const disabledCls = khongChoChon ? 'hhComboDisabled' : '';
      return `<div class="hhComboItem ${disabledCls}" ${disabledAttr} data-mahh="${h.MaHH}" data-ten="${(h.TenHH || '').replace(/"/g, '&quot;')}"
          data-giavon="${h.GiaVonTB || 0}" data-giaban="${h.GiaBan || 0}" data-tonkho="${h.TonKho || 0}" data-dvt="${h.DVT || ''}" data-loai="${h.Loai}" data-daudungdongkhac="${daDungDongKhac}"
          data-dvtnhap="${h.DVTNhap || ''}" data-hesoquydoi="${h.HeSoQuyDoi || ''}"
          onmousedown="hhComboSelect(this)">
        <div class="hhComboItemTen">${h.TenHH}${khongChoChon ? ' <span class="hhComboBadge hhComboTonHet">Hết tồn — không thể chọn</span>' : ''}</div>
        <div class="hhComboItemSub">
          <span>${h.MaHH}</span>
          <span class="hhComboBadge ${tonCls}">${tonText}</span>
          <span>Giá vốn: ${fmtMoney(h.GiaVonTB)}</span>
          <span>Giá bán: ${fmtMoney(h.GiaBan)}</span>
          ${dongKhacTag}
        </div>
      </div>`;
    }).join('');
  }
  listEl.style.display = 'block';
}
function hhComboSelect(el) {
  const wrap = el.closest('.itemRowSearch');
  const row = el.closest('.itemRow');
  const input = wrap.querySelector('.itemHHSearch');
  const containerId = input.dataset.container;
  if (el.dataset.khongchochon === '1') {
    showToast(`"${el.dataset.ten}" đã hết tồn kho (còn ${Number(el.dataset.tonkho) - Number(el.dataset.daudungdongkhac || 0)}) — vui lòng kiểm tra lại kho, không thể chọn để xuất/sử dụng.`);
    return;
  }
  const daDungDongKhac = Number(el.dataset.daudungdongkhac) || 0;
  if (daDungDongKhac > 0) {
    const tiepTuc = confirm(`Mặt hàng "${el.dataset.ten}" đã có trong phiếu này ở dòng khác (số lượng: ${daDungDongKhac}).\n\nNên xoá dòng này và tăng số lượng ở dòng đã có thay vì tách thành 2 dòng riêng.\n\nVẫn muốn thêm dòng riêng cho mặt hàng này?`);
    if (!tiepTuc) {
      wrap.querySelector('.hhComboList').style.display = 'none';
      return;
    }
  }
  const hidden = wrap.querySelector('.itemHH');
  hidden.value = el.dataset.mahh;
  input.value = el.dataset.ten;
  input.dataset.confirmed = el.dataset.ten;
  row.dataset.mahh = el.dataset.mahh;
  row.dataset.giavon = el.dataset.giavon;
  row.dataset.giaban = el.dataset.giaban;
  row.dataset.tonkho = el.dataset.tonkho;
  row.dataset.dvt = el.dataset.dvt;
  row.dataset.loai = el.dataset.loai;
  row.dataset.dvtnhap = el.dataset.dvtnhap || '';
  row.dataset.hesoquydoi = el.dataset.hesoquydoi || '';
  const mode = input.dataset.mode;
  const heSo = Number(el.dataset.hesoquydoi) || 0;
  const donViDiv = row.querySelector('.itemRowDonVi');
  const donViSelect = row.querySelector('.itemDonViChon');
  // Chỉ hiện ô chọn đơn vị khi mặt hàng CÓ khai báo đơn vị nhập lớn (VD Cuộn). Áp dụng cho CẢ Nhập kho
  // lẫn Xuất bán/Sửa chữa/Gia công — trước đây chỉ bật cho Nhập kho, khiến không thể bán theo Cuộn.
  // Mặc định: Nhập kho chọn sẵn đơn vị lớn (thường nhập theo Cuộn); Xuất bán mặc định đơn vị lẻ (bán
  // theo Mét là phổ biến nhất), nhân viên tự đổi sang Cuộn khi cần bán nguyên cuộn.
  if (heSo > 1 && el.dataset.dvtnhap) {
    donViDiv.style.display = 'block';
    donViSelect.innerHTML = `<option value="nhap">${el.dataset.dvtnhap} (1 ${el.dataset.dvtnhap} = ${heSo} ${el.dataset.dvt})</option><option value="goc">${el.dataset.dvt}</option>`;
    const macDinh = mode === 'gia_von' ? 'nhap' : 'goc';
    donViSelect.value = macDinh;
    row.dataset.donvidachon = macDinh;
  } else {
    donViDiv.style.display = 'none';
    row.dataset.donvidachon = 'goc';
  }
  const dangChonDonViLon = row.dataset.donvidachon === 'nhap';
  // Giá gợi ý: nếu chọn đơn vị lớn (Cuộn), tự tính = giá/đơn vị lẻ × hệ số quy đổi — CHỈ LÀ GỢI Ý, nhân
  // viên sửa tay nếu giá bán theo Cuộn thực tế khác với quy đổi tuyến tính (VD có chiết khấu khi mua cả cuộn).
  const giaGoiY = mode === 'gia_von'
    ? (dangChonDonViLon ? (Number(el.dataset.giavon) || 0) * heSo : Number(el.dataset.giavon) || 0)
    : (dangChonDonViLon ? (Number(el.dataset.giaban) || 0) * heSo : Number(el.dataset.giaban) || 0);
  row.querySelector('.itemGia').value = Math.round(giaGoiY).toLocaleString('vi-VN');
  wrap.querySelector('.hhComboList').style.display = 'none';
  updateLineTotalGeneric(input, containerId);
}
function doiDonViNhap(select) {
  const row = select.closest('.itemRow');
  row.dataset.donvidachon = select.value;
  const heSo = Number(row.dataset.hesoquydoi) || 1;
  const mode = row.querySelector('.itemHHSearch').dataset.mode;
  const giaCoSo = mode === 'gia_von' ? (Number(row.dataset.giavon) || 0) : (Number(row.dataset.giaban) || 0);
  const giaGoiY = select.value === 'nhap' ? giaCoSo * heSo : giaCoSo;
  row.querySelector('.itemGia').value = Math.round(giaGoiY).toLocaleString('vi-VN');
  const containerId = row.querySelector('.itemHHSearch').dataset.container;
  updateLineTotalGeneric(row.querySelector('.itemGia'), containerId);
}
function hhComboBlur(input) {
  setTimeout(() => {
    const wrap = input.closest('.itemRowSearch');
    if (!wrap) return;
    const listEl = wrap.querySelector('.hhComboList');
    if (listEl) listEl.style.display = 'none';
    const hidden = wrap.querySelector('.itemHH');
    if (!hidden.value) input.value = '';
    else input.value = input.dataset.confirmed || input.value;
  }, 150);
}
function capNhatThongTinDong(row, mode) {
  const infoEl = row.querySelector('.itemRowInfo');
  if (!row.dataset.mahh) { infoEl.textContent = 'Chưa chọn hàng hoá / dịch vụ'; return; }
  const loai = row.dataset.loai;
  const ton = row.dataset.tonkho;
  const dvt = row.dataset.dvt || '';
  const dangChonDonViLon = row.dataset.donvidachon === 'nhap' && Number(row.dataset.hesoquydoi) > 1;
  const donViHienThi = dangChonDonViLon ? row.dataset.dvtnhap : dvt;
  const giavon = Number(row.dataset.giavon) || 0;
  const giaban = Number(row.dataset.giaban) || 0;
  const giavonTheoDonVi = dangChonDonViLon ? giavon * Number(row.dataset.hesoquydoi) : giavon;
  const giabanTheoDonVi = dangChonDonViLon ? giaban * Number(row.dataset.hesoquydoi) : giaban;
  const donGiaNhap = parseSoTien(row.querySelector('.itemGia').value);
  let html = loai === 'HangHoa' ? `Tồn kho hiện có: <b>${tonKhoKep({ DVT: dvt, DVTNhap: row.dataset.dvtnhap, HeSoQuyDoi: row.dataset.hesoquydoi }, ton)}</b> &nbsp;·&nbsp; ` : '';
  html += `Giá vốn: <b>${fmtMoney(giavonTheoDonVi)}</b>/${donViHienThi} &nbsp;·&nbsp; Giá bán tham khảo: <b>${fmtMoney(giabanTheoDonVi)}</b>/${donViHienThi}`;
  if (dangChonDonViLon) {
    html += ` &nbsp;·&nbsp; <span class="muted">(1 ${row.dataset.dvtnhap} = ${row.dataset.hesoquydoi} ${dvt} — giá gợi ý tự quy đổi tuyến tính, sửa lại nếu giá thực tế theo ${row.dataset.dvtnhap} khác)</span>`;
  }
  if (mode === 'gia_ban' && giavonTheoDonVi > 0 && donGiaNhap > 0) {
    if (donGiaNhap < giavonTheoDonVi) html += ` &nbsp;— <span class="warnGia">⚠ Đang bán thấp hơn giá vốn (lỗ ${fmtMoney(giavonTheoDonVi - donGiaNhap)}/${donViHienThi})!</span>`;
    else html += ` &nbsp;— <span class="okGia">✓ Lãi ${fmtMoney(donGiaNhap - giavonTheoDonVi)}/${donViHienThi}</span>`;
  }
  infoEl.innerHTML = html;
}
function buocSoLuong(btn, delta, containerId) {
  const input = btn.closest('.itemSLWrap').querySelector('.itemSL');
  const min = Number(input.min) || 0;
  let val = Math.round(((Number(input.value) || 0) + delta) * 100) / 100;
  if (val < min) val = min;
  input.value = val;
  updateLineTotalGeneric(input, containerId);
}
function updateLineTotalGeneric(el, containerId) {
  const row = el.closest('.itemRow');
  const sl = Number(row.querySelector('.itemSL').value) || 0;
  const gia = parseSoTien(row.querySelector('.itemGia').value);
  const thueSuat = row.querySelector('.itemThueSuat').value;
  const truocThue = sl * gia;
  const tienThue = tinhTienThueJS(truocThue, thueSuat);
  row.querySelector('.lineTotal').innerHTML = fmtMoney(truocThue + tienThue);
  const mode = row.querySelector('.itemHHSearch').dataset.mode;
  capNhatThongTinDong(row, mode);
  recalcGrandTotalGeneric(containerId);
}
function recalcGrandTotalGeneric(containerId) {
  let truoc = 0, thue = 0;
  document.querySelectorAll('#' + containerId + '_list .itemRow').forEach(row => {
    const sl = Number(row.querySelector('.itemSL').value) || 0;
    const gia = parseSoTien(row.querySelector('.itemGia').value);
    const thueSuat = row.querySelector('.itemThueSuat').value;
    const t = sl * gia;
    truoc += t; thue += tinhTienThueJS(t, thueSuat);
  });
  const grandEl = document.getElementById(containerId + '_grand');
  const grandTruocEl = document.getElementById(containerId + '_grandTruoc');
  const grandThueEl = document.getElementById(containerId + '_grandThue');
  if (grandEl) grandEl.innerHTML = fmtMoney(truoc + thue);
  if (grandTruocEl) grandTruocEl.innerHTML = fmtMoney(truoc);
  if (grandThueEl) grandThueEl.innerHTML = fmtMoney(thue);
  return truoc + thue;
}
function readItemsFrom(containerId) {
  return [...document.querySelectorAll('#' + containerId + '_list .itemRow')].map(row => {
    const hidden = row.querySelector('.itemHH');
    const searchInput = row.querySelector('.itemHHSearch');
    const donViDaChon = row.dataset.donvidachon || 'goc';
    const dvtHienThi = donViDaChon === 'nhap' ? (row.dataset.dvtnhap || '') : (row.dataset.dvt || '');
    return {
      MaHH: hidden ? hidden.value : '', TenHH: searchInput ? searchInput.value : '',
      SoLuong: Number(row.querySelector('.itemSL').value) || 0,
      DonGia: parseSoTien(row.querySelector('.itemGia').value),
      ThueSuat: row.querySelector('.itemThueSuat').value,
      DonViDaChon: donViDaChon, DVT: dvtHienThi
    };
  }).filter(it => it.MaHH && it.SoLuong > 0);
}
