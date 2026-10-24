/* ================= KIỂM KÊ KHO / NHẬP TỒN ĐẦU KỲ =================
   - Kiểm kê: đếm hàng thực tế, gõ SỐ THỰC TẾ — app tự tính thừa/thiếu so với sổ và điều chỉnh tồn (ghi theo giá vốn hiện
     tại nên không làm đổi giá vốn). Ô để trống = chưa đếm, không đụng tới.
   - Nhập tồn đầu kỳ: hàng có sẵn trước khi dùng app, hoặc hàng mua ngoài không có hoá đơn — gõ SỐ LƯỢNG CỘNG THÊM + GIÁ VỐN.
     (Hàng mua CÓ hoá đơn, cần theo dõi nợ nhà cung cấp -> dùng phiếu Nhập kho.)
   Số lượng tính theo ĐƠN VỊ CHÍNH (đơn vị bán lẻ) của mặt hàng. Lập / xoá phiếu chỉ Admin. */
const GIOI_HAN_DONG_KK = 150;
const LOAI_KK = { KiemKe: ['Kiểm kê', 'info'], TonDauKy: ['Tồn đầu kỳ', 'hh'] };

function renderKiemKeTable() {
  apiCall('getKiemKeList').then(list => { STATE.kiemKeList = list; drawKiemKeTable(); }).catch(err => showToast('Lỗi: ' + err.message));
}
function drawKiemKeTable() {
  const wrap = document.getElementById('kiemKeTableWrap');
  const list = STATE.kiemKeList || [];
  if (!list.length) { wrap.innerHTML = '<div class="empty">Chưa có phiếu kiểm kê / tồn đầu kỳ nào.</div>'; return; }
  wrap.innerHTML = `<table><thead><tr><th>Ngày</th><th>Loại</th><th>Số mặt hàng</th><th>Giá trị chênh lệch</th><th>Ghi chú</th><th>Người lập</th><th></th></tr></thead><tbody>
    ${list.map(p => `<tr>
      <td>${fmtDate(p.Ngay)}</td><td><span class="tag ${(LOAI_KK[p.Loai] || ['', 'info'])[1]}">${(LOAI_KK[p.Loai] || [p.Loai])[0]}</span></td>
      <td>${fmtSoLuong(p.SoMatHang)}</td><td>${fmtMoney(p.GiaTriChenhLech)}</td><td class="muted">${escIn(p.GhiChu || '')}</td><td class="muted">${escIn(p.NguoiTao || '')}</td>
      <td class="rowActions">
        <button class="iconBtn" title="In biên bản" onclick="inBienBanKiemKe('${p.IDPhieu}')">${ICON_IN}</button>
        <button class="iconBtn" title="Xem" onclick="xemPhieuKiemKe('${p.IDPhieu}')">${ICON_XEM}</button>
        <button class="iconBtn iconDanger" title="Xoá" onclick="xoaKiemKeUI('${p.IDPhieu}')">${ICON_XOA}</button>
      </td></tr>`).join('')}
  </tbody></table>`;
}
document.getElementById('btnKiemKe').addEventListener('click', () => openKiemKeForm('KiemKe'));
document.getElementById('btnTonDauKy').addEventListener('click', () => openKiemKeForm('TonDauKy'));

let _kk = null; // { loai, nhap: { MaHH: { sl, gia, lyDo } } }
// timSan: tên/mã điền sẵn vào ô tìm (mở từ form sửa hàng hoá để nhập tồn cho đúng 1 mặt hàng)
function openKiemKeForm(loai, timSan) {
  _kk = { loai, nhap: {} };
  const laKK = loai === 'KiemKe';
  openModal(`
    <button class="modalClose" onclick="closeModal()">&times;</button>
    <h3>${laKK ? 'Kiểm kê kho' : 'Nhập tồn đầu kỳ'}</h3>
    <p class="muted" style="margin-top:0;">${laKK
      ? 'Gõ <b>số đếm thực tế</b> cho mặt hàng đã đếm (theo đơn vị bán lẻ). Ô để trống = chưa đếm, giữ nguyên tồn. App tự tính thừa/thiếu và điều chỉnh tồn kho theo giá vốn hiện tại.'
      : 'Dùng cho hàng <b>đã có sẵn trong kho</b> trước khi dùng app, hoặc hàng mua ngoài <b>không có hoá đơn</b>. Gõ số lượng <b>cộng thêm</b> và giá vốn mỗi đơn vị. Hàng mua có hoá đơn, cần theo dõi nợ nhà cung cấp thì dùng phiếu <b>Nhập kho</b>.'}</p>
    <div class="formGrid">
      <div class="field"><label>Ngày ${laKK ? 'kiểm kê' : 'ghi nhận'}</label><input type="date" id="fNgayKK" value="${todayISO()}"></div>
      <div class="field"><label>Ghi chú</label><input id="fGhiChuKK" placeholder="${laKK ? 'VD: Kiểm kê cuối tháng 10' : 'VD: Hàng tồn trước khi dùng app'}"></div>
    </div>
    <div class="toolbar" style="margin:12px 0 8px;">
      <input type="text" id="timKK" class="oTim" placeholder="Tìm mặt hàng..." value="${_escAttr(timSan || '')}" oninput="this.dataset.daSua='1';veBangKiemKe()">
      ${laKK ? `<label class="chkPill"><input type="checkbox" id="chiConTonKK" onchange="veBangKiemKe()"> Chỉ hàng đang có tồn</label>
      <button class="btn secondary small" type="button" onclick="dienSoSachKiemKe()" title="Điền số sổ sách vào các ô đang trống (của danh sách đang hiện) — rồi chỉ cần sửa dòng lệch">Điền = sổ sách cho ô trống</button>` : ''}
    </div>
    <div class="kkKhung" id="kkKhung"><p class="muted" style="padding:10px;">Đang tải tồn kho mới nhất...</p></div>
    <div class="kkTomTat" id="kkTomTat"></div>
    <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Huỷ</button><button class="btn" onclick="submitKiemKe()">${laKK ? 'Lưu phiếu kiểm kê' : 'Lưu tồn đầu kỳ'}</button></div>
  `);
  // Lấy tồn kho mới nhất trước khi cho nhập (số sổ sách phải đúng lúc kiểm kê)
  apiCall('getHangHoaList').then(list => { STATE.hangHoaList = list; veBangKiemKe(); })
    .catch(err => { showToast('Lỗi tải tồn kho: ' + err.message); veBangKiemKe(); });
}
// Mở từ form "Sửa hàng hoá": lọc sẵn đúng mặt hàng đó, con trỏ đặt vào ô số lượng.
function moTonDauKyChoHang(maHH) {
  const h = (STATE.hangHoaList || []).find(x => x.MaHH === maHH);
  openKiemKeForm('TonDauKy', h ? h.TenHH : '');
  _kk.chiMa = maHH;
}
function dsHangKiemKe() {
  const q = boDau((document.getElementById('timKK') || {}).value || '');
  const chiConTon = !!(document.getElementById('chiConTonKK') || {}).checked;
  const chiMa = _kk && _kk.chiMa && !document.getElementById('timKK').dataset.daSua ? _kk.chiMa : '';
  return (STATE.hangHoaList || []).filter(h => h.Loai === 'HangHoa'
    && (!chiMa || h.MaHH === chiMa)
    && (!q || boDau(h.TenHH).includes(q) || boDau(h.MaHH).includes(q))
    && (!chiConTon || Number(h.TonKho) > 0));
}
function veBangKiemKe() {
  const khung = document.getElementById('kkKhung');
  if (!khung || !_kk) return;
  const laKK = _kk.loai === 'KiemKe';
  const ds = dsHangKiemKe();
  if (!ds.length) { khung.innerHTML = '<p class="muted" style="padding:10px;">Không có mặt hàng (loại Hàng hoá) nào khớp.</p>'; capNhatTomTatKK(); return; }
  khung.innerHTML = `<table class="kkBang"><thead><tr>
      <th style="width:34%">Mặt hàng</th><th style="width:9%">ĐVT</th><th class="num" style="width:13%">${laKK ? 'Sổ sách' : 'Tồn hiện tại'}</th>
      <th class="num" style="width:14%">${laKK ? 'Thực tế' : 'SL thêm'}</th><th class="num" style="width:${laKK ? 12 : 15}%">${laKK ? 'Chênh lệch' : 'Giá vốn / ĐV'}</th><th>${laKK ? 'Lý do' : 'Ghi chú'}</th>
    </tr></thead><tbody>
    ${ds.map(h => {
      const v = _kk.nhap[h.MaHH] || {};
      return `<tr data-mahh="${h.MaHH}" class="${v.sl !== undefined && v.sl !== '' ? 'coNhap' : ''}">
        <td>${escIn(h.TenHH)}</td><td data-label="ĐVT">${escIn(h.DVT || '')}</td><td class="num" data-label="${laKK ? 'Sổ sách' : 'Tồn hiện tại'}">${fmtSoLuong(h.TonKho)}</td>
        <td data-label="${laKK ? 'Thực tế' : 'SL thêm'}"><input class="num kkSL" type="number" min="0" step="0.01" inputmode="decimal" value="${v.sl !== undefined ? v.sl : ''}" oninput="nhapKiemKe(this)"></td>
        ${laKK ? `<td class="num kkCL" data-label="Chênh lệch">${veChenhLechKK(h, v.sl)}</td>`
          : `<td data-label="Giá vốn / ĐV"><input class="num kkGia moneyInput" type="text" inputmode="numeric" value="${v.gia !== undefined ? v.gia : (Number(h.GiaVonTB) > 0 ? Math.round(h.GiaVonTB).toLocaleString('vi-VN') : '')}" oninput="nhapKiemKe(this)"></td>`}
        <td data-label="${laKK ? 'Lý do' : 'Ghi chú'}"><input class="kkLyDo" value="${_escAttr(v.lyDo || '')}" oninput="nhapKiemKe(this)" placeholder="${laKK ? 'VD: hỏng, mất...' : ''}"></td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
  capNhatTomTatKK();
  if (_kk.chiMa && ds.length === 1 && !_kk.daFocus) { _kk.daFocus = true; const o = khung.querySelector('.kkSL'); if (o) o.focus(); }
}
function veChenhLechKK(h, sl) {
  if (sl === undefined || sl === '') return '';
  const cl = Math.round((Number(sl) - (Number(h.TonKho) || 0)) * 10000) / 10000;
  if (!cl) return '<span class="muted">Khớp</span>';
  return `<span class="${cl > 0 ? 'clDuong' : 'clAm'}">${cl > 0 ? '+' : ''}${fmtSoLuong(cl)}</span>`;
}
function nhapKiemKe(input) {
  const tr = input.closest('tr');
  const ma = tr.dataset.mahh;
  const sl = tr.querySelector('.kkSL').value;
  const gia = tr.querySelector('.kkGia');
  const lyDo = tr.querySelector('.kkLyDo').value;
  _kk.nhap[ma] = { sl: sl.trim(), lyDo };
  if (gia) _kk.nhap[ma].gia = gia.value; // giữ cả giá/lý do đã gõ để lọc danh sách không bị mất
  tr.classList.toggle('coNhap', _kk.nhap[ma].sl !== '');
  const cl = tr.querySelector('.kkCL');
  if (cl) cl.innerHTML = veChenhLechKK(STATE.hangHoaList.find(h => h.MaHH === ma) || {}, _kk.nhap[ma].sl);
  capNhatTomTatKK();
}
function dongKiemKeDaNhap() {
  const laKK = _kk.loai === 'KiemKe';
  return Object.keys(_kk.nhap).map(ma => ({ ma, v: _kk.nhap[ma], h: STATE.hangHoaList.find(h => h.MaHH === ma) }))
    .filter(x => x.h && x.v.sl !== '' && x.v.sl !== undefined && (laKK || Number(x.v.sl) > 0));
}
function capNhatTomTatKK() {
  const el = document.getElementById('kkTomTat');
  if (!el || !_kk) return;
  const ds = dongKiemKeDaNhap();
  if (_kk.loai === 'KiemKe') {
    let thua = 0, thieu = 0, giaThua = 0, giaThieu = 0;
    ds.forEach(x => {
      const cl = Number(x.v.sl) - (Number(x.h.TonKho) || 0);
      if (cl > 1e-9) { thua++; giaThua += cl * (Number(x.h.GiaVonTB) || 0); } else if (cl < -1e-9) { thieu++; giaThieu += -cl * (Number(x.h.GiaVonTB) || 0); }
    });
    el.innerHTML = `Đã nhập <b>${ds.length}</b> mặt hàng · Thừa: <b class="okGia">${thua}</b> (${fmtMoney(giaThua)}) · Thiếu: <b class="warnGia">${thieu}</b> (${fmtMoney(giaThieu)}) · Khớp: <b>${ds.length - thua - thieu}</b>${ds.length > GIOI_HAN_DONG_KK ? ` <span class="warnGia">— quá ${GIOI_HAN_DONG_KK} mặt hàng/phiếu, chia làm nhiều phiếu (lọc theo tên)</span>` : ''}`;
  } else {
    const tong = ds.reduce((s, x) => s + Number(x.v.sl) * parseSoTien(x.v.gia), 0);
    el.innerHTML = `Đã nhập <b>${ds.length}</b> mặt hàng · Tổng giá trị: <b>${fmtMoney(tong)}</b>${ds.length > GIOI_HAN_DONG_KK ? ` <span class="warnGia">— quá ${GIOI_HAN_DONG_KK} mặt hàng/phiếu, chia làm nhiều phiếu</span>` : ''}`;
  }
}
function dienSoSachKiemKe() {
  let n = 0;
  dsHangKiemKe().forEach(h => {
    const v = _kk.nhap[h.MaHH];
    if (!v || v.sl === '' || v.sl === undefined) { _kk.nhap[h.MaHH] = { sl: String(Math.round((Number(h.TonKho) || 0) * 10000) / 10000), lyDo: v ? v.lyDo || '' : '' }; n++; }
  });
  veBangKiemKe();
  showToast(`Đã điền số sổ sách cho ${n} mặt hàng — sửa lại dòng nào đếm ra khác.`);
}
function submitKiemKe() {
  const laKK = _kk.loai === 'KiemKe';
  const ds = dongKiemKeDaNhap();
  if (!ds.length) { showToast(laKK ? 'Chưa nhập số thực tế cho mặt hàng nào.' : 'Chưa nhập số lượng cho mặt hàng nào.'); return; }
  if (ds.length > GIOI_HAN_DONG_KK) { showToast(`Tối đa ${GIOI_HAN_DONG_KK} mặt hàng/phiếu — lọc theo tên để chia làm nhiều phiếu.`); return; }
  const loi = ds.find(x => !(Number(x.v.sl) >= 0));
  if (loi) { showToast('Số lượng không hợp lệ: ' + loi.h.TenHH); return; }
  if (!laKK) {
    const giaKhong = ds.filter(x => !(parseSoTien(x.v.gia) > 0));
    if (giaKhong.length && !confirm(`Có ${giaKhong.length} dòng giá vốn = 0 đ:\n- ${giaKhong.slice(0, 5).map(x => x.h.TenHH).join('\n- ')}\n\nGiá vốn 0 làm báo cáo lãi lỗ sai khi bán ra. Vẫn lưu?`)) return;
  }
  const items = ds.map(x => ({ MaHH: x.ma, TenHH: x.h.TenHH, SoLuong: Number(x.v.sl), DonGia: laKK ? undefined : parseSoTien(x.v.gia), LyDo: x.v.lyDo || '' }));
  const lech = laKK ? ds.filter(x => Math.abs(Number(x.v.sl) - (Number(x.h.TonKho) || 0)) > 1e-9).length : ds.length;
  if (!confirm(laKK ? `Lưu phiếu kiểm kê ${ds.length} mặt hàng — ${lech} mặt hàng lệch sẽ được điều chỉnh tồn kho. Tiếp tục?` : `Cộng tồn đầu kỳ cho ${ds.length} mặt hàng. Tiếp tục?`)) return;
  const data = { Loai: _kk.loai, Ngay: document.getElementById('fNgayKK').value, GhiChu: document.getElementById('fGhiChuKK').value.trim(), items };
  apiCall('saveKiemKe', { data }).then(res => {
    closeModal();
    showToast(laKK ? `Đã lưu phiếu kiểm kê — điều chỉnh ${res.soDongDieuChinh} mặt hàng.` : 'Đã cộng tồn đầu kỳ.');
    mergeTonKhoVaoState(res.tonKhoCapNhat);
    drawHangHoaTable();
    STATE.kiemKeList = [res.phieu, ...(STATE.kiemKeList || [])];
    if (document.getElementById('view-kiemke').classList.contains('active')) drawKiemKeTable();
  }).catch(err => {
    const m = String(err.message || '');
    showToast(m === 'KHONG_CO_QUYEN' ? 'Chỉ Admin được lập phiếu kiểm kê / tồn đầu kỳ.' : 'Lỗi: ' + m);
  });
}
function xemPhieuKiemKe(idPhieu) {
  const p = (STATE.kiemKeList || []).find(x => x.IDPhieu === idPhieu);
  if (!p) return;
  const laKK = p.Loai === 'KiemKe';
  apiCall('getKiemKeDetail', { idPhieu }).then(res => {
    const items = res.items || [];
    openModal(`
      <button class="modalClose" onclick="closeModal()">&times;</button>
      <h3>${laKK ? 'Phiếu kiểm kê' : 'Phiếu tồn đầu kỳ'} ${fmtDate(p.Ngay)}</h3>
      <p class="muted">${escIn(p.GhiChu || '')} · Người lập: ${escIn(p.NguoiTao || '')} · Mã: ${p.IDPhieu}</p>
      <div class="tableWrap"><table class="kkBang"><thead><tr><th style="width:36%">Mặt hàng</th><th>ĐVT</th><th class="num">${laKK ? 'Sổ sách' : 'Tồn trước'}</th><th class="num">${laKK ? 'Thực tế' : 'Tồn sau'}</th><th class="num">Chênh lệch</th><th class="num">Đơn giá</th><th>Lý do</th></tr></thead>
      <tbody>${items.map(it => `<tr><td>${escIn(it.TenHH)}</td><td data-label="ĐVT">${escIn(it.DVT || '')}</td><td class="num" data-label="${laKK ? 'Sổ sách' : 'Tồn trước'}">${fmtSoLuong(it.TonSo)}</td><td class="num" data-label="${laKK ? 'Thực tế' : 'Tồn sau'}">${fmtSoLuong(it.ThucTe)}</td>
        <td class="num" data-label="Chênh lệch">${Number(it.ChenhLech) ? `<span class="${it.ChenhLech > 0 ? 'clDuong' : 'clAm'}">${it.ChenhLech > 0 ? '+' : ''}${fmtSoLuong(it.ChenhLech)}</span>` : '<span class="muted">Khớp</span>'}</td>
        <td class="num" data-label="Đơn giá">${fmtMoney(it.DonGia)}</td><td data-label="Lý do">${escIn(it.LyDo || '')}</td></tr>`).join('')}</tbody></table></div>
      <p style="text-align:right;">Giá trị chênh lệch: <b>${fmtMoney(p.GiaTriChenhLech)}</b></p>
      <div class="modalActions"><button class="btn secondary" onclick="inBienBanKiemKe('${idPhieu}')">${ICON_IN} In biên bản</button><button class="btn secondary" onclick="closeModal()">Đóng</button></div>
    `);
  }).catch(err => showToast('Lỗi: ' + err.message));
}
function xoaKiemKeUI(idPhieu) {
  if (!confirm('Xoá phiếu này? Các điều chỉnh tồn kho của phiếu sẽ được gỡ bỏ, tồn kho và giá vốn tính lại như trước khi lập phiếu.')) return;
  apiCall('xoaKiemKe', { idPhieu }).then(res => {
    showToast('Đã xoá phiếu.');
    mergeTonKhoVaoState(res.tonKhoCapNhat);
    drawHangHoaTable();
    STATE.kiemKeList = (STATE.kiemKeList || []).filter(x => x.IDPhieu !== idPhieu);
    drawKiemKeTable();
  }).catch(err => showToast(String(err.message) === 'KHONG_CO_QUYEN' ? 'Chỉ Admin được xoá phiếu kiểm kê.' : 'Lỗi: ' + err.message));
}
