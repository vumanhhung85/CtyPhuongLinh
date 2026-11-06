/* ================= TỔNG QUAN: thẻ số liệu có so sánh, biểu đồ 12 tháng, mốc doanh thu năm, việc cần xử lý =================
   Dữ liệu lấy từ action getDashboard (worker): chuoi12Thang, doanhThuNam, tienChuaXuatHD, noQuaHan, baoGiaCho...
   Biểu đồ vẽ bằng SVG thuần (không thư viện): cột = doanh thu, đường = lợi nhuận gộp; có nhãn trực tiếp, tooltip
   (rê chuột hoặc Tab tới từng tháng) và bảng số liệu thay thế. */

// Mốc tham chiếu doanh thu năm (trước thuế). Thuế TNDN 15% áp dụng cho doanh nghiệp có doanh thu năm không quá 3 tỷ
// theo quy định hiện hành — chỉ là mốc để theo dõi, anh xác nhận lại với kế toán thuế. Đổi mốc: sửa số dưới đây.
const MOC_DOANH_THU_NAM = 3000000000;

function nhanTienGon(v) {
  v = Number(v) || 0; const a = Math.abs(v), dau = v < 0 ? '−' : '';
  const f = (x, d) => x.toLocaleString('vi-VN', { maximumFractionDigits: d });
  if (a >= 1e9) return dau + f(a / 1e9, 2) + ' tỷ';
  if (a >= 1e6) return dau + f(a / 1e6, a >= 1e8 ? 0 : 1) + ' tr';
  if (a >= 1e3) return dau + f(a / 1e3, 0) + ' k';
  return dau + f(a, 0);
}
function buocDep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
function phanTramDoi(hienTai, truoc) { return truoc ? Math.round((hienTai - truoc) / Math.abs(truoc) * 100) : null; }
const tenThang = t => `T${Number(String(t).slice(5))}/${String(t).slice(0, 4)}`;

/* ---------- thẻ số liệu ---------- */
function veTheTongQuan(d) {
  const c = d.chuoi12Thang || [], nay = c[c.length - 1] || {}, truoc = c[c.length - 2] || {};
  const nhan = truoc.thang ? 'so với ' + tenThang(truoc.thang) : '';
  veKpi('dashCards', [
    { label: 'Doanh thu tháng này (trước thuế)', val: fmtMoney(d.doanhThuThangNay), mau: 'blue',
      delta: { pct: phanTramDoi(nay.doanhThu, truoc.doanhThu), nhan }, spark: c.map(m => m.doanhThu) },
    { label: 'Nhập kho tháng này (trước thuế)', val: fmtMoney(d.nhapKhoThangNay), mau: 'navy',
      delta: { pct: phanTramDoi(nay.nhapKho, truoc.nhapKho), nhan, trungTinh: true }, spark: c.map(m => m.nhapKho) },
    { label: 'Công nợ phải thu', val: fmtMoney(d.congNoPhaiThu), mau: 'orange', phu: d.noQuaHan && d.noQuaHan.so ? `${d.noQuaHan.so} khoản quá ${d.noQuaHan.soNgay} ngày` : '' },
    { label: 'Công nợ phải trả', val: fmtMoney(d.congNoPhaiTra), mau: 'gray' }
  ]);
}

/* ---------- biểu đồ 12 tháng ---------- */
function veBieuDo12Thang(c) {
  const box = document.getElementById('dashChart'); if (!box) return;
  if (!c || !c.length) { box.innerHTML = ''; return; }
  const W = 760, H = 290, L = 58, R = 16, T = 26, B = 42, n = c.length;
  const dt = c.map(m => m.doanhThu), ln = c.map(m => m.loiNhuan);
  let max = Math.max(...dt, ...ln, 1), min = Math.min(0, ...ln);
  const buoc = buocDep((max - min) / 5);
  max = Math.ceil(max / buoc) * buoc; min = Math.floor(min / buoc) * buoc;
  const y = v => T + (max - v) / (max - min) * (H - T - B);
  const bw = (W - L - R) / n, barW = Math.min(46, bw * 0.58), cx = i => L + i * bw + bw / 2;
  const luoi = [];
  for (let v = min; v <= max + 1e-6; v += buoc) luoi.push(`<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="${Math.abs(v) < 1e-6 ? 'truc0' : 'luoi'}"/><text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" class="nhanY" text-anchor="end">${nhanTienGon(v)}</text>`);
  const iMax = dt.indexOf(Math.max(...dt));
  const cot = c.map((m, i) => {
    const y0 = y(0), y1 = y(m.doanhThu), top = Math.min(y0, y1), h = Math.max(Math.abs(y0 - y1), m.doanhThu ? 2 : 0);
    const nhanGiaTri = (i === n - 1 || i === iMax) && m.doanhThu ? `<text x="${cx(i).toFixed(1)}" y="${(top - 6).toFixed(1)}" class="nhanCot" text-anchor="middle">${nhanTienGon(m.doanhThu)}</text>` : '';
    return `<rect class="cot${i === n - 1 ? ' hienTai' : ''}" x="${(cx(i) - barW / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" style="--d:${i * 28}ms"/>${nhanGiaTri}`;
  }).join('');
  const diem = c.map((m, i) => [cx(i), y(m.loiNhuan)]);
  const duong = diem.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const chamLn = diem.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === n - 1 ? 4.5 : 3}" class="chamLn"/>`).join('');
  const lc = diem[n - 1];
  const nhanLn = ln[n - 1] ? `<text x="${Math.min(lc[0], W - R - 4).toFixed(1)}" y="${(lc[1] + (ln[n - 1] > 0 ? 18 : -10)).toFixed(1)}" class="nhanLn" text-anchor="middle">LN ${nhanTienGon(ln[n - 1])}</text>` : '';
  const nhanX = c.map((m, i) => `<text x="${cx(i).toFixed(1)}" y="${H - B + 18}" class="nhanX${i === n - 1 ? ' hienTai' : ''}" text-anchor="middle">T${Number(m.thang.slice(5))}</text>${(i === 0 || m.thang.endsWith('-01')) ? `<text x="${cx(i).toFixed(1)}" y="${H - B + 33}" class="nhanNam" text-anchor="middle">${m.thang.slice(0, 4)}</text>` : ''}`).join('');
  const vung = c.map((m, i) => {
    const mota = `${tenThang(m.thang)}: doanh thu ${vnd(m.doanhThu)}, lợi nhuận gộp ${vnd(m.loiNhuan)}, nhập kho ${vnd(m.nhapKho)}`;
    return `<rect class="vungChon" x="${(L + i * bw).toFixed(1)}" y="${T - 10}" width="${bw.toFixed(1)}" height="${H - T - B + 10}" data-i="${i}" tabindex="0" role="img" aria-label="${thoat(mota)}"/>`;
  }).join('');
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="bieuDo" role="group" aria-label="Biểu đồ doanh thu và lợi nhuận gộp 12 tháng gần nhất">
      ${luoi.join('')}${cot}<path d="${duong}" class="duongLn" pathLength="1"/>${chamLn}${nhanLn}${nhanX}${vung}</svg><div class="tipBd" id="dashTip" hidden></div>`;
  const tip = box.querySelector('#dashTip');
  const hien = i => {
    const m = c[i], p = c[i - 1];
    const dd = (a, b) => { const k = phanTramDoi(a, b); return k == null ? '' : `<small class="${k >= 0 ? 'tot' : 'xau'}">${k >= 0 ? '▲' : '▼'} ${Math.abs(k)}%</small>`; };
    tip.innerHTML = `<b>${tenThang(m.thang)}</b><div><i class="sw cotSw"></i>Doanh thu <span>${vnd(m.doanhThu)}</span>${p ? dd(m.doanhThu, p.doanhThu) : ''}</div><div><i class="sw lnSw"></i>Lợi nhuận gộp <span>${vnd(m.loiNhuan)}</span>${p ? dd(m.loiNhuan, p.loiNhuan) : ''}</div><div><i class="sw nkSw"></i>Nhập kho <span>${vnd(m.nhapKho)}</span></div>`;
    tip.hidden = false;
    const sw = box.querySelector('svg').getBoundingClientRect().width, nua = tip.offsetWidth / 2 || 105; // px (khung biểu đồ có thể cuộn ngang trên điện thoại)
    tip.style.left = Math.min(Math.max(cx(i) / W * sw, nua), Math.max(nua, sw - nua)) + 'px';
    box.querySelectorAll('.cot').forEach((r, k) => r.classList.toggle('sang', k === i));
  };
  const an = () => { tip.hidden = true; box.querySelectorAll('.cot.sang').forEach(r => r.classList.remove('sang')); };
  box.querySelectorAll('.vungChon').forEach(r => {
    r.addEventListener('mouseenter', () => hien(Number(r.dataset.i)));
    r.addEventListener('focus', () => hien(Number(r.dataset.i)));
    r.addEventListener('mouseleave', an); r.addEventListener('blur', an);
  });
  // bảng số liệu thay thế (đọc chính xác từng tháng, và cho trình đọc màn hình)
  const bang = document.getElementById('dashChartBang');
  if (bang) bang.innerHTML = `<table><thead><tr><th>Tháng</th><th>Doanh thu (trước thuế)</th><th>Lợi nhuận gộp</th><th>Nhập kho (trước thuế)</th></tr></thead><tbody>${c.slice().reverse().map(m => `<tr><td>${tenThang(m.thang)}</td><td>${fmtMoney(m.doanhThu)}</td><td>${fmtMoney(m.loiNhuan)}</td><td>${fmtMoney(m.nhapKho)}</td></tr>`).join('')}</tbody></table>`;
}

/* ---------- mốc doanh thu năm ---------- */
function veMocDoanhThuNam(d) {
  const el = document.getElementById('dashMoc'); if (!el) return;
  const dt = Number(d.doanhThuNam) || 0, pct = dt / MOC_DOANH_THU_NAM * 100;
  const bay = new Date(), ngayTrongThang = new Date(bay.getFullYear(), bay.getMonth() + 1, 0).getDate();
  const thangDaQua = Math.max(0.2, bay.getMonth() + bay.getDate() / ngayTrongThang); // tháng đã trôi qua (có phần lẻ)
  const duBao = dt / thangDaQua * 12;
  const mau = pct >= 100 ? 'xau' : pct >= 80 ? 'canh' : 'tot';
  const conLai = MOC_DOANH_THU_NAM - dt;
  const duBaoVuot = duBao > MOC_DOANH_THU_NAM;
  el.innerHTML = `<div class="mocDau"><b>Doanh thu năm ${thoat(d.namHienTai || '')}</b> <span class="muted">(trước thuế, đã ghi nhận)</span><span class="mocPct ${mau}">${pct.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</span></div>
    <div class="mocThanh ${mau}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.round(pct))}" aria-label="Doanh thu năm so với mốc ${nhanTienGon(MOC_DOANH_THU_NAM)}"><i style="--w:${Math.min(100, pct).toFixed(1)}%"></i></div>
    <div class="mocChu"><span>${fmtMoney(dt)} / mốc ${nhanTienGon(MOC_DOANH_THU_NAM)}</span><span>${conLai > 0 ? 'Còn ' + fmtMoney(conLai) : '<b class="xau">Đã vượt ' + fmtMoney(-conLai) + '</b>'}</span></div>
    <p class="muted mocGhiChu">Ước tính thô theo nhịp hiện tại: cả năm khoảng <b>${nhanTienGon(duBao)}</b> — ${duBaoVuot ? '<b class="xau">có thể vượt mốc</b>' : 'chưa vượt mốc'}. Mốc 3 tỷ/năm là ngưỡng thuế TNDN 15% theo quy định hiện hành; anh xác nhận lại với kế toán thuế.</p>`;
}

/* ---------- cần xử lý hôm nay ---------- */
function veViecCanXuLy(d) {
  const el = document.getElementById('dashViec'); if (!el) return;
  const m = [];
  const q = d.noQuaHan || {};
  if (q.so > 0) m.push({ muc: 'bad', den: 'congno', tieuDe: `${q.so} khoản phải thu quá ${q.soNgay} ngày`, phu: `Tổng ${vnd(q.tong)}`, ds: q.ds });
  if (d.soHoaDonChuaXuat > 0) m.push({ muc: 'bad', den: 'xuatban', loc: 'locXuat:chuaHD', tieuDe: `${d.soHoaDonChuaXuat} phiếu chưa xuất hoá đơn`, phu: d.tienChuaXuatHD ? `Phiếu bán hàng: ${vnd(d.tienChuaXuatHD)}` : '' });
  const bg = d.baoGiaCho || {};
  if (bg.so > 0) m.push({ muc: 'warn', den: 'baogia', loc: 'locBaoGia:DaGui', tieuDe: `${bg.so} báo giá gửi khách quá ${bg.soNgay} ngày chưa chốt`, phu: `Tổng ${vnd(bg.tong)}` });
  const het = (d.hangSapHet || []).length;
  if (het > 0) m.push({ muc: 'warn', cuon: 'dashLowStock', tieuDe: `${het} mặt hàng dưới mức tồn tối thiểu`, phu: 'Cần nhập thêm' });
  if (d.suaChuaDangXuLy > 0) m.push({ muc: 'info', den: 'suachua', tieuDe: `${d.suaChuaDangXuLy} máy đang sửa chữa`, phu: 'Theo dõi tiến độ' });
  if (d.giaCongDangXuLy > 0) m.push({ muc: 'info', den: 'giacong', tieuDe: `${d.giaCongDangXuLy} phiếu gia công đang xử lý`, phu: '' });
  if (!m.length) { el.innerHTML = trangThaiRong({ bieuTuong: 'tick', tieuDe: 'Không có việc tồn đọng', moTa: 'Không có khoản quá hạn, phiếu chưa xuất hoá đơn hay hàng sắp hết.' }); return; }
  el.innerHTML = m.map((x, i) => `<div class="viec ${x.muc}" style="--i:${i}"><button type="button" class="viecNut" ${x.den ? `data-den="${x.den}"` : ''} ${x.loc ? `data-loc="${x.loc}"` : ''} ${x.cuon ? `data-cuon="${x.cuon}"` : ''}>
      <span class="viecDau"></span><span class="viecChu"><b>${thoat(x.tieuDe)}</b>${x.phu ? `<small>${thoat(x.phu)}</small>` : ''}</span><span class="viecMui" aria-hidden="true">›</span></button>
      ${x.ds && x.ds.length ? `<ul class="viecDs">${x.ds.map(k => { const ngay = Math.max(0, Math.round((Date.now() - new Date(k.ngay + 'T00:00:00').getTime()) / 86400000)); return `<li><span>${thoat(k.doiTac)}</span><span class="muted">${ngay} ngày · ${thoat(k.loai)}</span><b>${vnd(k.conNo)}</b></li>`; }).join('')}</ul>` : ''}</div>`).join('');
}
document.getElementById('dashViec').addEventListener('click', e => {
  const b = e.target.closest('.viecNut'); if (!b) return;
  if (b.dataset.loc) { const [id, v] = b.dataset.loc.split(':'); const s = document.getElementById(id); if (s) s.value = v; }
  if (b.dataset.den) switchTab(b.dataset.den);
  else if (b.dataset.cuon) { const t = document.getElementById(b.dataset.cuon); if (t) t.scrollIntoView({ behavior: GIAM_CHUYEN_DONG() ? 'auto' : 'smooth', block: 'start' }); }
});
document.getElementById('btnBangDoanhThu').addEventListener('click', e => {
  const bang = document.getElementById('dashChartBang'), hienBang = bang.style.display === 'none';
  bang.style.display = hienBang ? '' : 'none';
  document.getElementById('dashChart').style.display = hienBang ? 'none' : '';
  e.currentTarget.textContent = hienBang ? 'Xem dạng biểu đồ' : 'Xem dạng bảng';
  e.currentTarget.setAttribute('aria-pressed', hienBang);
});

function veTongQuan(d) {
  veTheTongQuan(d);
  veBieuDo12Thang(d.chuoi12Thang);
  veMocDoanhThuNam(d);
  veViecCanXuLy(d);
}
