/* ================= BÁO CÁO ================= */
(function initBaoCaoDates() {
  const now = new Date();
  document.getElementById('baocaoTuNgay').value = ngayISO(new Date(now.getFullYear(), now.getMonth(), 1));
  document.getElementById('baocaoDenNgay').value = todayISO();
})();
document.getElementById('btnXemBaoCao').addEventListener('click', renderBaoCao);
function renderBaoCao() {
  const tuNgay = document.getElementById('baocaoTuNgay').value;
  const denNgay = document.getElementById('baocaoDenNgay').value;
  apiCall('getBaoCaoDoanhThu', { tuNgay, denNgay }).then(d => {
    veKpi('baocaoCards', [
      { label: 'Tổng doanh thu (trước thuế)', val: fmtMoney(d.doanhThu), mau: 'blue' },
      { label: 'Lợi nhuận gộp', val: fmtMoney(d.loiNhuanGop), mau: d.loiNhuanGop >= 0 ? 'green' : 'red' },
      { label: 'Tổng nhập kho (trước thuế)', val: fmtMoney(d.tongNhap), mau: 'navy' },
      { label: 'Thuế GTGT đầu ra − đầu vào', val: fmtMoney((Number(d.thueDauRa) || 0) - (Number(d.thueDauVao) || 0)), mau: 'orange' }
    ]);
    const cards = [
      { label: '— Doanh thu bán hàng', val: fmtMoney(d.doanhThuBanHang), cls: '' },
      { label: '— Doanh thu sửa chữa', val: fmtMoney(d.doanhThuSuaChua), cls: '' },
      { label: '— Doanh thu nhận gia công', val: fmtMoney(d.doanhThuGiaCongThu), cls: '' },
      { label: 'Thuế GTGT đầu ra (thu hộ)', val: fmtMoney(d.thueDauRa), cls: 'warn' },
      { label: 'Thuế GTGT đầu vào (được khấu trừ)', val: fmtMoney(d.thueDauVao), cls: 'warn' },
      { label: 'Số phiếu xuất bán', val: d.soPhieuXuat, cls: '' },
      { label: 'Số phiếu sửa chữa', val: d.soPhieuSuaChua, cls: '' },
      { label: 'Số phiếu gia công', val: d.soPhieuGiaCong, cls: '' }
    ];
    document.getElementById('baocaoCards').insertAdjacentHTML('beforeend', cards.map(c => `<div class="statCard ${c.cls}"><div class="label">${c.label}</div><div class="val">${c.val}</div></div>`).join(''));
    const topWrap = document.getElementById('baocaoTopWrap');
    if (!d.topBanChay.length) { topWrap.innerHTML = '<div class="empty">Chưa có dữ liệu trong khoảng thời gian này.</div>'; }
    else { topWrap.innerHTML = `<table><thead><tr><th>Hàng hoá</th><th class="num">SL bán</th><th class="num">Doanh thu</th></tr></thead><tbody>${d.topBanChay.map(t => `<tr><td>${t.ten}</td><td>${t.soLuong}${t.dvt ? ' ' + t.dvt : ''}</td><td>${fmtMoney(t.doanhThu)}</td></tr>`).join('')}</tbody></table>`; }

    const topKHWrap = document.getElementById('baocaoTopKHWrap');
    if (!d.topKhachHang || !d.topKhachHang.length) { topKHWrap.innerHTML = '<div class="empty">Chưa có dữ liệu trong khoảng thời gian này.</div>'; }
    else { topKHWrap.innerHTML = `<table><thead><tr><th>Khách hàng</th><th class="num">Số lần mua</th><th class="num">Doanh thu</th></tr></thead><tbody>${d.topKhachHang.map(k => `<tr><td>${k.ten}</td><td>${k.soLanMua}</td><td>${fmtMoney(k.doanhThu)}</td></tr>`).join('')}</tbody></table>`; }
  }).catch(err => showToast('Lỗi: ' + err.message));
}

/* ---- So sánh tháng này với tháng trước (luôn theo tháng thực tế, độc lập với khoảng ngày chọn ở trên) ---- */
function renderSoSanhThang() {
  apiCall('getSoSanhThangHienTai').then(d => {
    const wrap = document.getElementById('baocaoSoSanhWrap');
    const tenThang = (nhan) => { const [y, m] = nhan.split('-'); return `Tháng ${Number(m)}/${y}`; };
    const mauDoanhThu = d.phanTramDoanhThu >= 0 ? 'good' : 'bad';
    const mauLoiNhuan = d.phanTramLoiNhuan >= 0 ? 'good' : 'bad';
    const dauDoanhThu = d.phanTramDoanhThu >= 0 ? '▲' : '▼';
    const dauLoiNhuan = d.phanTramLoiNhuan >= 0 ? '▲' : '▼';
    wrap.innerHTML = `
      <div class="cardGrid">
        <div class="statCard">
          <div class="label">Doanh thu ${tenThang(d.thangNay.nhan)}</div>
          <div class="val">${fmtMoney(d.thangNay.doanhThu)}</div>
          <div class="muted" style="margin-top:4px;">So với ${tenThang(d.thangTruoc.nhan)} (${fmtMoney(d.thangTruoc.doanhThu)}): <span class="tag ${mauDoanhThu}">${dauDoanhThu} ${Math.abs(d.phanTramDoanhThu)}%</span></div>
        </div>
        <div class="statCard">
          <div class="label">Lợi nhuận gộp ${tenThang(d.thangNay.nhan)}</div>
          <div class="val">${fmtMoney(d.thangNay.loiNhuan)}</div>
          <div class="muted" style="margin-top:4px;">So với ${tenThang(d.thangTruoc.nhan)} (${fmtMoney(d.thangTruoc.loiNhuan)}): <span class="tag ${mauLoiNhuan}">${dauLoiNhuan} ${Math.abs(d.phanTramLoiNhuan)}%</span></div>
        </div>
      </div>`;
  }).catch(err => showToast('Lỗi: ' + err.message));
}

/* ---- Công nợ gộp theo từng đối tác — biết ngay ai đang nợ nhiều nhất ---- */
function renderCongNoTheoDoiTac() {
  apiCall('getCongNoTheoDoiTac').then(d => {
    const wrapThu = document.getElementById('baocaoCongNoKHWrap');
    if (!d.phaiThuTheoKH.length) { wrapThu.innerHTML = '<div class="empty">Không có công nợ phải thu.</div>'; }
    else { wrapThu.innerHTML = `<table><thead><tr><th>Khách hàng</th><th class="num">Số lần còn nợ</th><th class="num">Tổng còn nợ</th></tr></thead><tbody>${d.phaiThuTheoKH.map(k => `<tr><td>${k.ten}</td><td>${k.soLanNo}</td><td><span class="tag warn">${fmtMoney(k.tongNo)}</span></td></tr>`).join('')}</tbody></table>`; }

    const wrapTra = document.getElementById('baocaoCongNoNCCWrap');
    if (!d.phaiTraTheoNCC.length) { wrapTra.innerHTML = '<div class="empty">Không có công nợ phải trả.</div>'; }
    else { wrapTra.innerHTML = `<table><thead><tr><th>Nhà cung cấp</th><th class="num">Số lần còn nợ</th><th class="num">Tổng còn nợ</th></tr></thead><tbody>${d.phaiTraTheoNCC.map(n => `<tr><td>${n.ten}</td><td>${n.soLanNo}</td><td><span class="tag bad">${fmtMoney(n.tongNo)}</span></td></tr>`).join('')}</tbody></table>`; }
  }).catch(err => showToast('Lỗi: ' + err.message));
}
