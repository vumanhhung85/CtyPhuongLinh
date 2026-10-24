/* ================= IN CHỨNG TỪ (A4) =================
   Mọi mẫu in vẽ thành 1 trang HTML riêng (font Times New Roman, khổ A4), hiện XEM TRƯỚC trong khung bên trong popup,
   bấm "In / Lưu PDF" để in hoặc lưu PDF (chọn "Lưu thành PDF" ở hộp thoại in) gửi khách qua Zalo/email.
   Thông tin công ty (tên, địa chỉ, MST, người đại diện...) lấy từ Cài đặt > Thông tin công ty — sửa 1 chỗ, mọi mẫu đổi theo.
   Mẫu phiếu nhập kho / phiếu thu / phiếu chi / biên bản kiểm kê theo mẫu chứng từ kế toán của Thông tư 133/2016/TT-BTC
   (chế độ kế toán doanh nghiệp nhỏ và vừa). */

const ICON_IN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';

let _ttCongTyPromise = null;
function layThongTinCongTy(lamMoi) {
  if (!_ttCongTyPromise || lamMoi) _ttCongTyPromise = apiCall('getThongTinCongTy').catch(e => { _ttCongTyPromise = null; throw e; });
  return _ttCongTyPromise;
}

/* ---- Tiện ích định dạng cho bản in ---- */
const escIn = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tienIn = n => Math.round(Number(n) || 0).toLocaleString('vi-VN');
const slIn = n => fmtSoLuong(n);
function tachNgay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (m) return { y: m[1], m: m[2], d: m[3] };
  const t = new Date(iso || Date.now());
  if (isNaN(t)) return null;
  return { y: String(t.getFullYear()), m: String(t.getMonth() + 1).padStart(2, '0'), d: String(t.getDate()).padStart(2, '0') };
}
function ngayChu(iso) { const p = tachNgay(iso); return p ? `ngày ${p.d} tháng ${p.m} năm ${p.y}` : 'ngày ..... tháng ..... năm ........'; }
function ngaySo(iso) { const p = tachNgay(iso); return p ? `${p.d}/${p.m}/${p.y}` : ''; }
function nhanThueSuat(ts) { return ts === 'KCT' ? 'Không chịu thuế' : (String(ts || '0') + '%'); }

// Đọc số tiền thành chữ tiếng Việt: 1.603.800 -> "Một triệu sáu trăm lẻ ba nghìn tám trăm đồng"
const _CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
function _doc3So(n, du) {
  const tr = Math.floor(n / 100), ch = Math.floor(n / 10) % 10, dv = n % 10, out = [];
  if (du || tr) out.push(_CHU_SO[tr], 'trăm');
  if (ch === 0) { if (dv) { if (du || tr) out.push('lẻ'); out.push(_CHU_SO[dv]); } }
  else if (ch === 1) { out.push('mười'); if (dv === 5) out.push('lăm'); else if (dv) out.push(_CHU_SO[dv]); }
  else { out.push(_CHU_SO[ch], 'mươi'); if (dv === 1) out.push('mốt'); else if (dv === 5) out.push('lăm'); else if (dv) out.push(_CHU_SO[dv]); }
  return out;
}
function docSoThanhChu(soTien) {
  let n = Math.round(Math.abs(Number(soTien) || 0));
  if (!n) return 'Không đồng';
  const donVi = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const nhom = [];
  while (n) { nhom.push(n % 1000); n = Math.floor(n / 1000); }
  const tu = [];
  for (let i = nhom.length - 1; i >= 0; i--) {
    if (!nhom[i]) continue;
    tu.push(..._doc3So(nhom[i], i !== nhom.length - 1));
    if (donVi[i]) tu.push(donVi[i]);
  }
  const s = tu.join(' ');
  return (Number(soTien) < 0 ? 'Âm ' + s : s.charAt(0).toUpperCase() + s.slice(1)) + ' đồng';
}

/* ---- Khối dùng chung trong các mẫu ---- */
const LOGO_IN = () => new URL('Logo_PhuongLinh_KoVien.png', location.href).href;
function khoiDauCongTy(ct) {
  const lienHe = [ct.SDT ? 'Điện thoại: ' + escIn(ct.SDT) : '', ct.Email ? 'Email: ' + escIn(ct.Email) : '', ct.Website ? escIn(ct.Website) : ''].filter(Boolean).join(' &nbsp;·&nbsp; ');
  return `<div class="dauCT">
    <img class="logo" src="${LOGO_IN()}" alt="" onerror="this.remove()">
    <div class="ttCT">
      <div class="tenCT">${escIn(ct.Ten)}</div>
      <div>Địa chỉ: ${escIn(ct.DiaChi)}</div>
      <div>Mã số thuế: <b>${escIn(ct.MST)}</b></div>
      ${lienHe ? `<div>${lienHe}</div>` : ''}
    </div>
  </div>`;
}
function khoiQuocHieu() {
  return `<div class="quocHieu"><div class="b">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</div><div class="b gach">Độc lập – Tự do – Hạnh phúc</div></div>`;
}
// Góc trên của mẫu chứng từ kế toán: trái "Đơn vị / Địa chỉ", phải "Mẫu số ... (Thông tư 133)"
function khoiDauMauKeToan(ct, mauSo) {
  return `<div class="dauMau">
    <div><div class="b">Đơn vị: ${escIn(ct.Ten)}</div><div>Địa chỉ: ${escIn(ct.DiaChi)}</div><div>MST: ${escIn(ct.MST)}</div></div>
    <div class="c mauSo"><div class="b">Mẫu số ${escIn(mauSo)}</div><div class="i nho">(Ban hành theo Thông tư số 133/2016/TT-BTC<br>ngày 26/08/2016 của Bộ Tài chính)</div></div>
  </div>`;
}
// cot: [{ chuc: 'NGƯỜI LẬP PHIẾU', ghi: '(Ký, họ tên)', ten: 'Nguyễn Văn A' }]
function khoiKyTen(cot, dongNgay) {
  return `<div class="kyTenWrap">
    ${dongNgay ? `<div class="ngayKy i">${dongNgay}</div>` : ''}
    <div class="kyTen" style="grid-template-columns:repeat(${cot.length},1fr)">
      ${cot.map(c => `<div><div class="b">${c.chuc}</div><div class="i nho">${c.ghi || '(Ký, ghi rõ họ tên)'}</div><div class="choKy"></div><div class="b">${escIn(c.ten || '')}</div></div>`).join('')}
    </div>
  </div>`;
}
const CHAM = n => '<span class="cham">' + '.'.repeat(n || 40) + '</span>';
// Thuế suất chung của các dòng (nếu mọi dòng cùng 1 mức) — để ghi "Thuế GTGT (8%)"; khác nhau thì null (in cột thuế suất).
function thueSuatChung(items) { const ds = [...new Set(items.map(i => String(i.ThueSuat || '0')))]; return ds.length === 1 ? ds[0] : null; }

// Bảng hàng hoá chuẩn: STT | Tên | ĐVT | SL | Đơn giá | Thành tiền (+ cột Thuế suất khi các dòng khác mức thuế)
function bangHangHoa(items, tong, opts) {
  opts = opts || {};
  const coGia = opts.coGia !== false;
  const tsChung = thueSuatChung(items);
  const cotThue = coGia && !tsChung;
  const soCot = 4 + (coGia ? 2 : 0) + (cotThue ? 1 : 0);
  const dong = items.map((it, i) => `<tr>
      <td class="c">${i + 1}</td><td>${escIn(it.TenHH)}</td><td class="c">${escIn(it.DVT || '')}</td><td class="r">${slIn(it.SoLuong)}</td>
      ${coGia ? `<td class="r">${tienIn(it.DonGia)}</td>${cotThue ? `<td class="c">${nhanThueSuat(it.ThueSuat)}</td>` : ''}<td class="r">${tienIn(it.ThanhTien != null && it.ThanhTien !== '' ? it.ThanhTien : Number(it.SoLuong) * Number(it.DonGia))}</td>` : ''}
    </tr>`).join('');
  const nhanCong = soCot - 1;
  const chan = coGia ? `
      <tr><td colspan="${nhanCong}" class="r b">Cộng tiền hàng</td><td class="r b">${tienIn(tong.truoc)}</td></tr>
      <tr><td colspan="${nhanCong}" class="r">Thuế GTGT${tsChung ? ' (' + nhanThueSuat(tsChung) + ')' : ''}</td><td class="r">${tienIn(tong.thue)}</td></tr>
      <tr><td colspan="${nhanCong}" class="r b">Tổng cộng thanh toán</td><td class="r b">${tienIn(tong.tong)}</td></tr>` : '';
  return `<table class="bang">
    <thead><tr><th style="width:7%">STT</th><th>Tên hàng hoá, dịch vụ</th><th style="width:9%">ĐVT</th><th style="width:9%">Số lượng</th>
      ${coGia ? `<th style="width:14%">Đơn giá (đồng)</th>${cotThue ? '<th style="width:10%">Thuế suất</th>' : ''}<th style="width:17%">Thành tiền (đồng)</th>` : ''}</tr></thead>
    <tbody>${dong}${chan}</tbody>
  </table>
  ${coGia ? `<p class="bangChu"><span class="i">Số tiền viết bằng chữ:</span> <b class="i">${docSoThanhChu(tong.tong)}./.</b></p>` : ''}`;
}

/* ---- Khung xem trước + in ---- */
const CSS_BAN_IN = `
@page { size: A4; margin: 14mm 13mm 14mm 18mm; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.38; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media screen {
  html { background: #dfe2e7; }
  body { padding: 14px 0; zoom: var(--z, 1); }
  .trang { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 14mm 13mm 14mm 18mm; box-shadow: 0 2px 14px rgba(0,0,0,.2); }
}
p { margin: 4px 0; }
.b { font-weight: bold; } .i { font-style: italic; } .c { text-align: center; } .r { text-align: right; } .nho { font-size: 11pt; }
.dauCT { display: flex; gap: 12px; align-items: center; border-bottom: 1.5px solid #000; padding-bottom: 7px; margin-bottom: 8px; }
.dauCT .logo { width: 64px; height: 64px; object-fit: contain; flex: 0 0 auto; }
.tenCT { font-weight: bold; font-size: 14pt; text-transform: uppercase; }
.ttCT { font-size: 12pt; line-height: 1.35; }
.quocHieu { text-align: center; margin-bottom: 6px; }
.quocHieu .gach { display: inline-block; border-bottom: 1px solid #000; padding-bottom: 1px; }
.dauMau { display: flex; justify-content: space-between; gap: 16px; font-size: 12pt; margin-bottom: 4px; }
.dauMau .mauSo { min-width: 230px; }
.tieuDe { text-align: center; font-size: 17pt; font-weight: bold; text-transform: uppercase; margin: 12px 0 2px; }
.phuDe { text-align: center; margin: 0 0 10px; }
.soNgay { display: flex; justify-content: space-between; font-size: 12pt; margin: 2px 0 8px; }
table.bang { width: 100%; border-collapse: collapse; margin: 8px 0 4px; font-size: 12pt; }
table.bang th, table.bang td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
table.bang th { background: #efefef; text-align: center; font-weight: bold; }
table.bang tr { page-break-inside: avoid; }
table.bang thead { display: table-header-group; }
table.thongTin { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 12.5pt; }
table.thongTin td { padding: 3px 4px; vertical-align: top; }
table.thongTin td:first-child { width: 31%; }
.ben { margin: 6px 0 4px; }
.ben .tenBen { font-weight: bold; text-transform: uppercase; }
.dongDoi { display: flex; gap: 18px; } .dongDoi > div { flex: 1; }
.cham { color: #555; letter-spacing: 1px; }
.bangChu { margin: 2px 0 8px; }
.dieuKhoan { margin: 8px 0; } .dieuKhoan div { margin: 2px 0; }
.kyTenWrap { margin-top: 16px; page-break-inside: avoid; }
.ngayKy { text-align: right; margin-bottom: 4px; }
.kyTen { display: grid; gap: 8px; text-align: center; font-size: 12pt; }
.choKy { height: 74px; }
.maPhieu { margin-top: 18px; font-size: 9.5pt; color: #666; }
`;
let _banIn = null; // { tieuDe, tenFile, ve, tuyChon, giaTri }
function moBanIn(cauHinh) {
  _banIn = { ...cauHinh, giaTri: {} };
  (cauHinh.tuyChon || []).forEach(t => { _banIn.giaTri[t.k] = t.mac !== false; });
  openModal(`
    <button class="modalClose" onclick="closeModal()">&times;</button>
    <h3>Xem trước: ${escIn(cauHinh.tieuDe)}</h3>
    <div class="inThanh">
      <button class="btn" type="button" id="btnInChungTu" onclick="inChungTu()">${ICON_IN}<span>In / Lưu PDF</span></button>
      ${(cauHinh.tuyChon || []).map(t => `<label class="chkPill"><input type="checkbox" data-k="${t.k}" ${_banIn.giaTri[t.k] ? 'checked' : ''} onchange="doiTuyChonIn(this)"> ${t.nhan}</label>`).join('')}
      <span class="muted inGoiY">Muốn gửi file cho khách: bấm In rồi chọn máy in "Lưu thành PDF".</span>
    </div>
    <iframe class="khungIn" id="khungIn" title="Xem trước bản in"></iframe>
    <div class="modalActions"><button class="btn secondary" onclick="closeModal()">Đóng</button><button class="btn" onclick="inChungTu()">In / Lưu PDF</button></div>
  `);
  document.getElementById('modalCard').classList.add('modalIn');
  veLaiBanIn();
}
function htmlBanIn() {
  const noiDung = _banIn.ve(_banIn.giaTri);
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escIn(_banIn.tenFile || _banIn.tieuDe)}</title><style>${CSS_BAN_IN}</style></head>
<body><div class="trang">${noiDung}</div>
<script>(function(){function z(){var w=document.documentElement.clientWidth,f=210*96/25.4+24;document.documentElement.style.setProperty('--z',Math.min(1,w/f));}z();addEventListener('resize',z);})();<\/script>
</body></html>`;
}
function veLaiBanIn() {
  const f = document.getElementById('khungIn');
  if (f && _banIn) f.srcdoc = htmlBanIn();
}
function doiTuyChonIn(chk) { _banIn.giaTri[chk.dataset.k] = chk.checked; veLaiBanIn(); }
const LA_IOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function inChungTu() {
  if (!_banIn) return;
  // iPhone/iPad: lệnh in trong khung iframe thường in nhầm cả trang ngoài -> mở bản in ở tab riêng rồi in.
  if (LA_IOS()) {
    const w = window.open('', '_blank');
    if (!w) { showToast('Trình duyệt chặn mở tab mới — cho phép cửa sổ bật lên rồi bấm lại.'); return; }
    w.document.open(); w.document.write(htmlBanIn()); w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* người dùng tự bấm in ở tab mới */ } }, 600);
    return;
  }
  const f = document.getElementById('khungIn');
  if (!f || !f.contentWindow) return;
  const tieuDeCu = document.title;
  document.title = _banIn.tenFile || _banIn.tieuDe; // gợi ý tên file khi "Lưu thành PDF"
  try { f.contentWindow.focus(); f.contentWindow.print(); } finally { setTimeout(() => { document.title = tieuDeCu; }, 1500); }
}
// Tải dữ liệu cần cho 1 bản in (thông tin công ty + chi tiết phiếu) rồi mở xem trước; báo lỗi gọn nếu mạng lỗi.
function chuanBiIn(taiChiTiet, taoCauHinh) {
  showToast('Đang chuẩn bị bản in...');
  Promise.all([layThongTinCongTy(), taiChiTiet ? taiChiTiet() : Promise.resolve(null)])
    .then(([ct, chiTiet]) => moBanIn(taoCauHinh(ct, chiTiet)))
    .catch(err => showToast('Lỗi chuẩn bị bản in: ' + err.message));
}
function timKhachHang(maKH) { return (STATE.khachHangList || []).find(k => k.MaKH === maKH) || null; }
function timNCC(maNCC) { return (STATE.nhaCungCapList || []).find(k => k.MaNCC === maNCC) || null; }
const tenFileAn = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_').slice(0, 60);

/* ================= CÁC MẪU IN ================= */

// 1) BẢNG BÁO GIÁ
function inBaoGia(idPhieu) {
  const p = (STATE.baoGiaList || []).find(x => x.IDPhieu === idPhieu);
  if (!p) return;
  chuanBiIn(() => apiCall('getBaoGiaDetail', { idPhieu }), (ct, res) => ({
    tieuDe: 'Báo giá ' + (p.SoBaoGia || ''), tenFile: `BaoGia_${p.SoBaoGia}_${tenFileAn(p.TenKH)}`,
    ve: () => {
      const items = res.items || [];
      const kh = timKhachHang(p.MaKH);
      const diaChi = p.DiaChiKH || (kh && kh.DiaChi) || '';
      const mst = p.MSTKhachHang || (kh && kh.MST) || '';
      const dieuKhoan = String(p.DieuKhoan || '').split('\n').map(s => s.trim()).filter(Boolean);
      const nh = ct.NganHang || {};
      return `${khoiDauCongTy(ct)}
        <div class="soNgay"><span>Số: <b>${escIn(p.SoBaoGia)}</b></span><span class="i">${escIn(ct.NoiLap)}, ${ngayChu(p.Ngay)}</span></div>
        <div class="tieuDe">Bảng báo giá</div>
        ${p.TieuDe ? `<div class="phuDe i">V/v: ${escIn(p.TieuDe)}</div>` : '<div class="phuDe"></div>'}
        <p><b>Kính gửi: ${escIn(p.TenKH || 'Quý khách hàng')}</b></p>
        ${diaChi ? `<p>Địa chỉ: ${escIn(diaChi)}</p>` : ''}
        ${mst ? `<p>Mã số thuế: ${escIn(mst)}</p>` : ''}
        ${p.NguoiLienHe ? `<p>Người liên hệ: ${escIn(p.NguoiLienHe)}</p>` : ''}
        <p>${escIn(ct.Ten)} trân trọng gửi Quý khách bảng báo giá hàng hoá, dịch vụ như sau:</p>
        ${bangHangHoa(items, { truoc: p.TongTienTruocThue, thue: p.TongTienThue, tong: p.TongTien })}
        <div class="dieuKhoan"><div class="b">Điều khoản:</div>
          ${dieuKhoan.map(d => `<div>${escIn(d)}</div>`).join('')}
          ${p.HieuLucDen ? `<div>- Báo giá có hiệu lực đến hết ngày ${ngaySo(p.HieuLucDen)}.</div>` : ''}
          ${nh.bankAccountNumber ? `<div>- Thông tin chuyển khoản: STK <b>${escIn(nh.bankAccountNumber)}</b>${nh.tenNganHang ? ' – Ngân hàng ' + escIn(nh.tenNganHang) : ''}${nh.bankAccountName ? ' – Chủ tài khoản: ' + escIn(nh.bankAccountName) : ''}.</div>` : ''}
          ${p.GhiChu ? `<div>- ${escIn(p.GhiChu)}</div>` : ''}
        </div>
        <p class="i">Rất mong nhận được sự hợp tác của Quý khách.</p>
        ${khoiKyTen([
          { chuc: 'XÁC NHẬN CỦA KHÁCH HÀNG', ghi: '(Ký, ghi rõ họ tên)' },
          { chuc: 'ĐẠI DIỆN CÔNG TY', ghi: '(Ký, ghi rõ họ tên, đóng dấu)', ten: ct.DaiDien }
        ])}`;
    }
  }));
}

// 2) BIÊN BẢN GIAO NHẬN HÀNG HOÁ (phiếu xuất bán)
function inBienBanGiaoNhan(idPhieu) {
  const p = (STATE.xuatBanList || []).find(x => x.IDPhieu === idPhieu);
  if (!p) return;
  chuanBiIn(() => apiCall('getXuatBanDetail', { idPhieu }), (ct, res) => ({
    tieuDe: 'Biên bản giao nhận hàng hoá', tenFile: `BienBanGiaoNhan_${ngaySo(p.Ngay).replace(/\//g, '')}_${tenFileAn(p.TenKH || 'KhachLe')}`,
    tuyChon: [{ k: 'gia', nhan: 'Hiện đơn giá, thành tiền', mac: true }],
    ve: o => {
      const kh = timKhachHang(p.MaKH);
      return `${khoiQuocHieu()}
        <div class="tieuDe">Biên bản giao nhận hàng hoá</div>
        <div class="phuDe"></div>
        <p>Hôm nay, ${ngayChu(p.Ngay)}, chúng tôi gồm:</p>
        <div class="ben"><div class="tenBen">Bên giao (Bên A): ${escIn(ct.Ten)}</div>
          <div>Địa chỉ: ${escIn(ct.DiaChi)}</div><div>Mã số thuế: ${escIn(ct.MST)}${ct.SDT ? ' &nbsp;·&nbsp; Điện thoại: ' + escIn(ct.SDT) : ''}</div>
          <div class="dongDoi"><div>Đại diện: ${ct.DaiDien ? '<b>' + escIn(ct.DaiDien) + '</b>' : CHAM(45)}</div><div>Chức vụ: ${ct.ChucVu ? escIn(ct.ChucVu) : CHAM(30)}</div></div>
        </div>
        <div class="ben"><div class="tenBen">Bên nhận (Bên B): ${escIn(p.TenKH || '') || CHAM(70)}</div>
          <div>Địa chỉ: ${kh && kh.DiaChi ? escIn(kh.DiaChi) : CHAM(90)}</div>
          <div>Mã số thuế: ${escIn(p.MSTKhachHang || (kh && kh.MST) || '') || CHAM(30)}${kh && kh.SDT ? ' &nbsp;·&nbsp; Điện thoại: ' + escIn(kh.SDT) : ''}</div>
          <div class="dongDoi"><div>Đại diện: ${CHAM(45)}</div><div>Chức vụ: ${CHAM(30)}</div></div>
        </div>
        <p>Hai bên cùng tiến hành giao nhận hàng hoá với chi tiết như sau:</p>
        ${bangHangHoa(res.items || [], { truoc: p.TongTienTruocThue, thue: p.TongTienThue, tong: p.TongTien }, { coGia: o.gia })}
        ${p.SoHDDT ? `<p>Kèm theo hoá đơn GTGT số <b>${escIn(p.SoHDDT)}</b>${p.KyHieuHD ? ', ký hiệu ' + escIn(p.KyHieuHD) : ''}.</p>` : ''}
        <p>Bên B đã kiểm tra và xác nhận nhận đủ số lượng, đúng chủng loại và chất lượng hàng hoá như trên.</p>
        <p>Biên bản được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (một) bản.</p>
        ${khoiKyTen([{ chuc: 'ĐẠI DIỆN BÊN GIAO', ten: ct.DaiDien }, { chuc: 'ĐẠI DIỆN BÊN NHẬN' }])}
        <div class="maPhieu">Mã phiếu: ${escIn(p.IDPhieu)}</div>`;
    }
  }));
}

// 3) PHIẾU NHẬP KHO — Mẫu 01-VT
function inPhieuNhapKho(idPhieu) {
  const p = (STATE.nhapKhoList || []).find(x => x.IDPhieu === idPhieu);
  if (!p) return;
  chuanBiIn(() => apiCall('getNhapKhoDetail', { idPhieu }), (ct, res) => ({
    tieuDe: 'Phiếu nhập kho', tenFile: `PhieuNhapKho_${ngaySo(p.Ngay).replace(/\//g, '')}_${tenFileAn(p.TenNCC)}`,
    ve: () => {
      const items = res.items || [];
      const truoc = Number(p.TongTienTruocThue != null && p.TongTienTruocThue !== '' ? p.TongTienTruocThue : p.TongTien) || 0;
      return `${khoiDauMauKeToan(ct, '01 - VT')}
        <div class="tieuDe">Phiếu nhập kho</div>
        <div class="phuDe i">${ngayChu(p.Ngay)}</div>
        <div class="soNgay"><span>Số: ${escIn(p.IDPhieu)}</span><span>Nợ: ${CHAM(14)} &nbsp; Có: ${CHAM(14)}</span></div>
        <p>- Họ và tên người giao: ${CHAM(70)}</p>
        <p>- Theo hoá đơn số ${p.SoHDMuaVao ? '<b>' + escIn(p.SoHDMuaVao) + '</b>' : CHAM(18)} ngày ${ngaySo(p.Ngay)} của ${escIn(p.TenNCC || '') || CHAM(50)}</p>
        <p>- Nhập tại kho: ${CHAM(36)} Địa điểm: ${escIn(ct.DiaChi)}</p>
        <table class="bang">
          <thead>
            <tr><th rowspan="2" style="width:6%">STT</th><th rowspan="2">Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ, sản phẩm, hàng hoá</th><th rowspan="2" style="width:9%">Mã số</th><th rowspan="2" style="width:8%">Đơn vị tính</th><th colspan="2">Số lượng</th><th rowspan="2" style="width:13%">Đơn giá</th><th rowspan="2" style="width:15%">Thành tiền</th></tr>
            <tr><th style="width:9%">Theo chứng từ</th><th style="width:9%">Thực nhập</th></tr>
            <tr class="nho"><th>A</th><th>B</th><th>C</th><th>D</th><th>1</th><th>2</th><th>3</th><th>4</th></tr>
          </thead>
          <tbody>
            ${items.map((it, i) => `<tr><td class="c">${i + 1}</td><td>${escIn(it.TenHH)}</td><td class="c nho">${escIn(it.MaHH || '')}</td><td class="c">${escIn(it.DVT || '')}</td><td class="r">${slIn(it.SoLuong)}</td><td class="r">${slIn(it.SoLuong)}</td><td class="r">${tienIn(it.DonGia)}</td><td class="r">${tienIn(it.ThanhTien)}</td></tr>`).join('')}
            <tr><td></td><td class="c b">Cộng</td><td class="c">x</td><td class="c">x</td><td class="c">x</td><td class="c">x</td><td class="c">x</td><td class="r b">${tienIn(truoc)}</td></tr>
          </tbody>
        </table>
        <p>- Tổng số tiền (viết bằng chữ): <b class="i">${docSoThanhChu(truoc)}./.</b></p>
        ${Number(p.TongTienThue) ? `<p class="nho i">(Thuế GTGT đầu vào theo hoá đơn: ${tienIn(p.TongTienThue)} đồng — tổng thanh toán cho nhà cung cấp: ${tienIn(p.TongTien)} đồng)</p>` : ''}
        <p>- Số chứng từ gốc kèm theo: ${CHAM(40)}</p>
        ${khoiKyTen([
          { chuc: 'Người lập phiếu', ghi: '(Ký, họ tên)' }, { chuc: 'Người giao hàng', ghi: '(Ký, họ tên)' },
          { chuc: 'Thủ kho', ghi: '(Ký, họ tên)' }, { chuc: 'Kế toán trưởng', ghi: '(Hoặc bộ phận có nhu cầu nhập)<br>(Ký, họ tên)' }
        ], ngayChu(p.Ngay))}`;
    }
  }));
}

// 4) PHIẾU THU / PHIẾU CHI — Mẫu 01-TT / 02-TT
function timDoiTacTheoNguonGoc(nguonGoc) {
  const [bang, id] = String(nguonGoc || '').split(':');
  const list = { XuatBan: STATE.xuatBanList, NhapKho: STATE.nhapKhoList, SuaChua: STATE.suaChuaList, GiaCong: STATE.giaCongList }[bang];
  const ph = list && list.find(x => x.IDPhieu === id);
  if (!ph) return null;
  if (bang === 'NhapKho') { const n = timNCC(ph.MaNCC); return { ten: ph.TenNCC, diaChi: n && n.DiaChi, phieu: ph, bang }; }
  if (bang === 'GiaCong') {
    const d = ph.Loai === 'NhanGiaCongChoKhach' ? timKhachHang(ph.MaDoiTac) : timNCC(ph.MaDoiTac);
    return { ten: ph.TenDoiTac, diaChi: d && d.DiaChi, phieu: ph, bang };
  }
  const k = timKhachHang(ph.MaKH);
  return { ten: ph.TenKH, diaChi: k && k.DiaChi, phieu: ph, bang };
}
function inPhieuThuChi(idPhieu) {
  const r = (STATE.soQuyList || []).find(x => x.IDPhieu === idPhieu);
  if (!r) return;
  const laThu = r.Loai === 'Thu';
  chuanBiIn(null, ct => ({
    tieuDe: laThu ? 'Phiếu thu' : 'Phiếu chi', tenFile: `${laThu ? 'PhieuThu' : 'PhieuChi'}_${ngaySo(r.Ngay).replace(/\//g, '')}_${tenFileAn(r.IDPhieu)}`,
    ve: () => {
      const dt = timDoiTacTheoNguonGoc(r.NguonGoc);
      const tenBang = dt ? ({ XuatBan: 'phiếu bán hàng', NhapKho: 'phiếu nhập kho', SuaChua: 'phiếu sửa chữa', GiaCong: 'phiếu gia công' }[dt.bang]) : '';
      const lyDo = r.MoTa || (dt ? `${laThu ? 'Thu tiền' : 'Chi trả tiền'} ${tenBang} ${dt.phieu.IDPhieu}${dt.phieu.SoHDDT ? ' (HĐ số ' + dt.phieu.SoHDDT + ')' : (dt.phieu.SoHDMuaVao ? ' (HĐ số ' + dt.phieu.SoHDMuaVao + ')' : '')}` : nhomMucLabel(r.Loai, r.NhomMuc));
      return `${khoiDauMauKeToan(ct, laThu ? '01 - TT' : '02 - TT')}
        <div class="tieuDe">${laThu ? 'Phiếu thu' : 'Phiếu chi'}</div>
        <div class="phuDe i">${ngayChu(r.Ngay)}</div>
        <div class="soNgay"><span>Quyển số: ${CHAM(10)} &nbsp; Số: ${escIn(r.IDPhieu)}</span><span>Nợ: ${CHAM(12)} &nbsp; Có: ${CHAM(12)}</span></div>
        <p>Họ và tên người ${laThu ? 'nộp' : 'nhận'} tiền: ${dt && dt.ten ? '<b>' + escIn(dt.ten) + '</b>' : CHAM(60)}</p>
        <p>Địa chỉ: ${dt && dt.diaChi ? escIn(dt.diaChi) : CHAM(80)}</p>
        <p>Lý do ${laThu ? 'nộp' : 'chi'}: ${escIn(lyDo)}</p>
        <p>Số tiền: <b>${tienIn(r.SoTien)} đồng</b> ${r.PhuongThuc && r.PhuongThuc !== 'TienMat' ? `<span class="i">(hình thức: ${escIn(phuongThucLabel(r.PhuongThuc))})</span>` : ''}</p>
        <p>(Viết bằng chữ): <b class="i">${docSoThanhChu(r.SoTien)}./.</b></p>
        <p>Kèm theo: ${CHAM(30)} chứng từ gốc.</p>
        ${khoiKyTen([
          { chuc: 'Giám đốc', ghi: '(Ký, họ tên, đóng dấu)', ten: ct.DaiDien }, { chuc: 'Kế toán trưởng', ghi: '(Ký, họ tên)' },
          { chuc: laThu ? 'Người nộp tiền' : 'Người nhận tiền', ghi: '(Ký, họ tên)' }, { chuc: 'Người lập phiếu', ghi: '(Ký, họ tên)' }, { chuc: 'Thủ quỹ', ghi: '(Ký, họ tên)' }
        ], ngayChu(r.Ngay))}
        <p style="margin-top:10px">Đã nhận đủ số tiền (viết bằng chữ): ${CHAM(80)}</p>`;
    }
  }));
}

// 5) PHIẾU SỬA CHỮA (tiếp nhận / bàn giao thiết bị)
function inPhieuSuaChua(idPhieu) {
  const p = (STATE.suaChuaList || []).find(x => x.IDPhieu === idPhieu);
  if (!p) return;
  chuanBiIn(() => apiCall('getSuaChuaDetail', { idPhieu }), (ct, res) => ({
    tieuDe: 'Phiếu sửa chữa', tenFile: `PhieuSuaChua_${ngaySo(p.Ngay).replace(/\//g, '')}_${tenFileAn(p.TenKH)}`,
    ve: () => {
      const items = res.items || [];
      const daXong = ['HoanThanh', 'DaGiaoTra'].includes(p.TrangThai);
      const tienCong = Number(p.TienCong) || 0;
      const dongCong = tienCong ? [{ TenHH: 'Tiền công sửa chữa', DVT: 'lần', SoLuong: 1, DonGia: tienCong, ThanhTien: tienCong, ThueSuat: p.TienCongThueSuat || '0' }] : [];
      const tatCa = [...items, ...dongCong];
      return `${khoiDauCongTy(ct)}
        <div class="tieuDe">${daXong ? 'Phiếu sửa chữa – bàn giao thiết bị' : 'Phiếu tiếp nhận sửa chữa'}</div>
        <div class="phuDe">Số phiếu: <b>${escIn(p.IDPhieu)}</b> &nbsp;·&nbsp; Ngày nhận: ${ngaySo(p.Ngay)}</div>
        <table class="thongTin">
          <tr><td>Khách hàng:</td><td><b>${escIn(p.TenKH || '')}</b></td></tr>
          <tr><td>Điện thoại:</td><td>${escIn(p.SDT || '')}</td></tr>
          <tr><td>Thiết bị:</td><td><b>${escIn(p.ThietBi || '')}</b></td></tr>
          <tr><td>Tình trạng khi tiếp nhận:</td><td>${escIn(p.TinhTrangTiepNhan || '')}</td></tr>
          <tr><td>Phụ kiện kèm theo:</td><td>${escIn(p.PhuKienKemTheo || 'Không')}</td></tr>
          <tr><td>Kỹ thuật viên phụ trách:</td><td>${escIn(p.NguoiPhuTrach || '')}</td></tr>
          <tr><td>Ngày hẹn trả:</td><td>${p.NgayHenTra ? ngaySo(p.NgayHenTra) : ''}</td></tr>
          ${daXong ? `<tr><td>Ngày hoàn thành:</td><td>${p.NgayHoanThanh ? ngaySo(p.NgayHoanThanh) : ''}</td></tr>` : ''}
          <tr><td>Bảo hành:</td><td>${Number(p.BaoHanhNgay) ? escIn(p.BaoHanhNgay) + ' ngày kể từ ngày giao trả' : 'Không'}</td></tr>
          ${p.GhiChu ? `<tr><td>Ghi chú:</td><td>${escIn(p.GhiChu)}</td></tr>` : ''}
        </table>
        ${tatCa.length ? `<p class="b">Linh kiện thay thế và chi phí:</p>${bangHangHoa(tatCa, { truoc: p.TongTienTruocThue, thue: p.TongTienThue, tong: p.TongTien })}` : ''}
        <p class="i">Quý khách vui lòng giữ phiếu này và mang theo khi nhận lại thiết bị.</p>
        ${khoiKyTen([{ chuc: 'KHÁCH HÀNG' }, { chuc: daXong ? 'NHÂN VIÊN BÀN GIAO' : 'NHÂN VIÊN TIẾP NHẬN' }])}`;
    }
  }));
}

// 6) BIÊN BẢN NGHIỆM THU – BÀN GIAO GIA CÔNG
function inBienBanGiaCong(idPhieu) {
  const p = (STATE.giaCongList || []).find(x => x.IDPhieu === idPhieu);
  if (!p) return;
  const laNhan = p.Loai === 'NhanGiaCongChoKhach';
  chuanBiIn(null, ct => ({
    tieuDe: 'Biên bản nghiệm thu – bàn giao gia công', tenFile: `BienBanGiaCong_${ngaySo(p.Ngay).replace(/\//g, '')}_${tenFileAn(p.TenDoiTac)}`,
    tuyChon: [{ k: 'gia', nhan: 'Hiện giá trị gia công', mac: true }],
    ve: o => {
      const dt = laNhan ? timKhachHang(p.MaDoiTac) : timNCC(p.MaDoiTac);
      const congTy = { ten: ct.Ten, diaChi: ct.DiaChi, mst: ct.MST, daiDien: ct.DaiDien, chucVu: ct.ChucVu };
      const doiTac = { ten: p.TenDoiTac, diaChi: dt && dt.DiaChi, mst: dt && dt.MST, daiDien: '', chucVu: '' };
      const benA = laNhan ? doiTac : congTy, benB = laNhan ? congTy : doiTac;
      const khoiBen = (nhan, b) => `<div class="ben"><div class="tenBen">${nhan}: ${escIn(b.ten || '') || CHAM(70)}</div>
        <div>Địa chỉ: ${b.diaChi ? escIn(b.diaChi) : CHAM(90)}</div><div>Mã số thuế: ${b.mst ? escIn(b.mst) : CHAM(30)}</div>
        <div class="dongDoi"><div>Đại diện: ${b.daiDien ? '<b>' + escIn(b.daiDien) + '</b>' : CHAM(45)}</div><div>Chức vụ: ${b.chucVu ? escIn(b.chucVu) : CHAM(30)}</div></div></div>`;
      const sl = Number(p.SoLuongSanPham) || 0;
      const truoc = Number(p.ChiPhiGiaCongTruocThue != null && p.ChiPhiGiaCongTruocThue !== '' ? p.ChiPhiGiaCongTruocThue : p.ChiPhiGiaCong) || 0;
      const dong = [{ TenHH: p.MoTaCongViec, DVT: p.DonViTinh, SoLuong: sl || 1, DonGia: sl ? truoc / sl : truoc, ThanhTien: truoc, ThueSuat: p.ThueSuatGiaCong || '0' }];
      return `${khoiQuocHieu()}
        <div class="tieuDe">Biên bản nghiệm thu và bàn giao<br>sản phẩm gia công</div>
        <div class="phuDe"></div>
        <p>Hôm nay, ${ngayChu(p.NgayHoanThanh || p.Ngay)}, chúng tôi gồm:</p>
        ${khoiBen('Bên A (bên đặt gia công)', benA)}
        ${khoiBen('Bên B (bên nhận gia công)', benB)}
        <p>Hai bên cùng tiến hành nghiệm thu và bàn giao sản phẩm gia công như sau:</p>
        ${bangHangHoa(dong, { truoc, thue: p.TienThueGiaCong, tong: p.ChiPhiGiaCong }, { coGia: o.gia })}
        ${p.SoHDDT ? `<p>Kèm theo hoá đơn GTGT số <b>${escIn(p.SoHDDT)}</b>${p.KyHieuHD ? ', ký hiệu ' + escIn(p.KyHieuHD) : ''}.</p>` : ''}
        <p>Bên A đã kiểm tra và xác nhận sản phẩm đúng số lượng, quy cách và chất lượng theo yêu cầu, đồng ý nghiệm thu và nhận bàn giao.</p>
        <p>Biên bản được lập thành 02 (hai) bản có giá trị pháp lý như nhau, mỗi bên giữ 01 (một) bản.</p>
        ${khoiKyTen([{ chuc: 'ĐẠI DIỆN BÊN A', ten: benA.daiDien }, { chuc: 'ĐẠI DIỆN BÊN B', ten: benB.daiDien }])}
        <div class="maPhieu">Mã phiếu: ${escIn(p.IDPhieu)}</div>`;
    }
  }));
}

// 7) BIÊN BẢN KIỂM KÊ — Mẫu 05-VT / BIÊN BẢN XÁC NHẬN TỒN KHO ĐẦU KỲ
function inBienBanKiemKe(idPhieu) {
  const p = (STATE.kiemKeList || []).find(x => x.IDPhieu === idPhieu);
  if (!p) return;
  const laKiemKe = p.Loai === 'KiemKe';
  chuanBiIn(() => apiCall('getKiemKeDetail', { idPhieu }), (ct, res) => ({
    tieuDe: laKiemKe ? 'Biên bản kiểm kê' : 'Biên bản tồn kho đầu kỳ', tenFile: `${laKiemKe ? 'BienBanKiemKe' : 'TonDauKy'}_${ngaySo(p.Ngay).replace(/\//g, '')}`,
    ve: () => {
      const items = res.items || [];
      if (!laKiemKe) {
        const tong = items.reduce((s, it) => s + Math.round((Number(it.ChenhLech) || 0) * (Number(it.DonGia) || 0)), 0);
        return `${khoiDauCongTy(ct)}
          <div class="tieuDe">Biên bản xác nhận hàng tồn kho đầu kỳ</div>
          <div class="phuDe i">${ngayChu(p.Ngay)}</div>
          ${p.GhiChu ? `<p>Nội dung: ${escIn(p.GhiChu)}</p>` : ''}
          <table class="bang">
            <thead><tr><th style="width:6%">STT</th><th>Tên hàng hoá</th><th style="width:9%">ĐVT</th><th style="width:11%">Số lượng</th><th style="width:15%">Đơn giá vốn</th><th style="width:16%">Thành tiền</th><th style="width:16%">Ghi chú</th></tr></thead>
            <tbody>${items.map((it, i) => `<tr><td class="c">${i + 1}</td><td>${escIn(it.TenHH)}</td><td class="c">${escIn(it.DVT || '')}</td><td class="r">${slIn(it.ChenhLech)}</td><td class="r">${tienIn(it.DonGia)}</td><td class="r">${tienIn((Number(it.ChenhLech) || 0) * (Number(it.DonGia) || 0))}</td><td class="nho">${escIn(it.LyDo || '')}</td></tr>`).join('')}
              <tr><td colspan="5" class="r b">Cộng</td><td class="r b">${tienIn(tong)}</td><td></td></tr></tbody>
          </table>
          <p>Tổng giá trị (viết bằng chữ): <b class="i">${docSoThanhChu(tong)}./.</b></p>
          ${khoiKyTen([{ chuc: 'Người lập', ghi: '(Ký, họ tên)' }, { chuc: 'Thủ kho', ghi: '(Ký, họ tên)' }, { chuc: 'Kế toán', ghi: '(Ký, họ tên)' }, { chuc: 'Giám đốc', ghi: '(Ký, họ tên, đóng dấu)', ten: ct.DaiDien }], ngayChu(p.Ngay))}
          <div class="maPhieu">Mã phiếu: ${escIn(p.IDPhieu)}</div>`;
      }
      let tongThua = 0, tongThieu = 0;
      const dong = items.map((it, i) => {
        const cl = Number(it.ChenhLech) || 0, gia = Number(it.DonGia) || 0;
        if (cl > 0) tongThua += Math.round(cl * gia); else if (cl < 0) tongThieu += Math.round(-cl * gia);
        return `<tr><td class="c">${i + 1}</td><td>${escIn(it.TenHH)}</td><td class="c">${escIn(it.DVT || '')}</td><td class="r">${tienIn(gia)}</td>
          <td class="r">${slIn(it.TonSo)}</td><td class="r">${slIn(it.ThucTe)}</td>
          <td class="r">${cl > 0 ? slIn(cl) : ''}</td><td class="r">${cl < 0 ? slIn(-cl) : ''}</td><td class="r">${cl ? tienIn(cl * gia) : ''}</td><td class="nho">${escIn(it.LyDo || '')}</td></tr>`;
      }).join('');
      return `${khoiDauMauKeToan(ct, '05 - VT')}
        <div class="tieuDe">Biên bản kiểm kê vật tư, công cụ, sản phẩm, hàng hoá</div>
        <div class="phuDe i">Thời điểm kiểm kê: ..... giờ ..... ${ngayChu(p.Ngay)}</div>
        <p>Ban kiểm kê gồm:</p>
        <p>&nbsp;&nbsp;Ông/Bà: ${CHAM(46)} Chức vụ: ${CHAM(24)} Trưởng ban</p>
        <p>&nbsp;&nbsp;Ông/Bà: ${CHAM(46)} Chức vụ: ${CHAM(24)} Uỷ viên</p>
        <p>&nbsp;&nbsp;Ông/Bà: ${CHAM(46)} Chức vụ: ${CHAM(24)} Uỷ viên</p>
        <p>Đã kiểm kê kho có những mặt hàng dưới đây:${p.GhiChu ? ' <span class="i">(' + escIn(p.GhiChu) + ')</span>' : ''}</p>
        <table class="bang" style="font-size:11pt">
          <thead>
            <tr><th rowspan="2" style="width:5%">STT</th><th rowspan="2">Tên hàng hoá</th><th rowspan="2" style="width:7%">ĐVT</th><th rowspan="2" style="width:11%">Đơn giá</th><th colspan="2">Số lượng</th><th colspan="2">Chênh lệch</th><th rowspan="2" style="width:12%">Giá trị chênh lệch</th><th rowspan="2" style="width:12%">Ghi chú</th></tr>
            <tr><th style="width:8%">Sổ sách</th><th style="width:8%">Kiểm kê</th><th style="width:7%">Thừa</th><th style="width:7%">Thiếu</th></tr>
          </thead>
          <tbody>${dong}
            <tr><td colspan="8" class="r b">Tổng giá trị thừa / thiếu</td><td class="r b" colspan="2">${tongThua ? '+' + tienIn(tongThua) : '0'} / ${tongThieu ? '−' + tienIn(tongThieu) : '0'}</td></tr></tbody>
        </table>
        <p>Ý kiến giải quyết số chênh lệch: ${CHAM(70)}</p>
        ${khoiKyTen([{ chuc: 'Giám đốc', ghi: '(Ý kiến giải quyết số chênh lệch)<br>(Ký, họ tên, đóng dấu)', ten: ct.DaiDien }, { chuc: 'Kế toán trưởng', ghi: '(Ký, họ tên)' }, { chuc: 'Thủ kho', ghi: '(Ký, họ tên)' }, { chuc: 'Trưởng ban kiểm kê', ghi: '(Ký, họ tên)' }], ngayChu(p.Ngay))}
        <div class="maPhieu">Mã phiếu: ${escIn(p.IDPhieu)}</div>`;
    }
  }));
}
