/* ================= ĐỒNG BỘ HOÁ ĐƠN TỪ EXCEL ================= */
let DONGBO_STATE = { headers: [], dataRows: [], matches: [] };

function normalizeVN(str) {
  return (str || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim();
}
function guessColumn(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeVN(headers[i]);
    if (keywords.some(k => h.includes(k))) return i;
  }
  return -1;
}
function dongboLoaiIsXuat() { return document.getElementById('dongboLoai').value === 'xuat'; }
function parseVNDate(val) {
  if (!val && val !== 0) return null;
  val = String(val).trim();
  let m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const num = Number(val);
  if (!isNaN(num) && num > 20000 && num < 80000) return new Date(Math.round((num - 25569) * 86400 * 1000));
  const d = new Date(val);
  return isNaN(d) ? null : d;
}
function parseMoney(val) {
  if (val === undefined || val === null || val === '') return NaN;
  const digits = String(val).replace(/[^\d]/g, '');
  return digits ? Number(digits) : NaN;
}

document.getElementById('btnDocFile').addEventListener('click', async () => {
  const fileInput = document.getElementById('dongboFile');
  if (!fileInput.files.length) { showToast('Chọn file trước.'); return; }
  const file = fileInput.files[0];
  showToast('Đang tải thư viện đọc Excel...');
  await caiThuVien('xlsx');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(15, aoa.length); i++) {
        const rowText = normalizeVN((aoa[i] || []).join(' '));
        if (rowText.includes('so hoa don') || rowText.includes('ky hieu') || rowText.includes('ngay lap')) { headerRowIdx = i; break; }
      }
      const headers = (aoa[headerRowIdx] || []).map(h => String(h || '').trim());
      const dataRows = aoa.slice(headerRowIdx + 1).filter(r => r.some(c => String(c || '').trim() !== ''));
      if (!headers.length || !dataRows.length) { showToast('Không đọc được dữ liệu từ file. Kiểm tra lại file Excel.'); return; }
      DONGBO_STATE.headers = headers; DONGBO_STATE.dataRows = dataRows;
      showColumnMapping();
    } catch (err) { showToast('Lỗi đọc file: ' + err.message); }
  };
  reader.readAsArrayBuffer(file);
});

function showColumnMapping() {
  const headers = DONGBO_STATE.headers;
  const isXuat = dongboLoaiIsXuat();
  const guess = {
    soHD: guessColumn(headers, ['so hoa don', 'so hddt', 'so ct', 'so ct/hd']),
    kyHieu: guessColumn(headers, ['ky hieu']),
    ngay: guessColumn(headers, ['ngay lap', 'ngay hoa don', 'ngay ct']),
    mst: guessColumn(headers, isXuat ? ['ma so thue nguoi mua', 'mst nguoi mua', 'mst ben mua'] : ['ma so thue nguoi ban', 'mst nguoi ban', 'mst ben ban']),
    tongTien: guessColumn(headers, ['tong tien thanh toan', 'tong cong tien thanh toan', 'tong tien'])
  };
  const optionsHtml = sel => '<option value="-1">-- không có --</option>' + headers.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${h || ('(cột ' + (i + 1) + ')')}</option>`).join('');
  document.getElementById('dongboResultPanel').style.display = 'block';
  document.getElementById('dongboTableWrap').innerHTML = `
    <p class="muted">App đã đoán các cột bên dưới dựa theo tiêu đề trong file — anh kiểm tra lại và sửa nếu chưa đúng, rồi bấm "Khớp dữ liệu".</p>
    <div class="formGrid" style="margin-bottom:10px;">
      <div class="field"><label>Cột: Số hoá đơn *</label><select id="mapSoHD">${optionsHtml(guess.soHD)}</select></div>
      <div class="field"><label>Cột: Ký hiệu hoá đơn</label><select id="mapKyHieu">${optionsHtml(guess.kyHieu)}</select></div>
      <div class="field"><label>Cột: Ngày lập</label><select id="mapNgay">${optionsHtml(guess.ngay)}</select></div>
      <div class="field"><label>Cột: Mã số thuế đối tác *</label><select id="mapMST">${optionsHtml(guess.mst)}</select></div>
      <div class="field span2"><label>Cột: Tổng tiền thanh toán *</label><select id="mapTongTien">${optionsHtml(guess.tongTien)}</select></div>
    </div>
    <button class="btn small" onclick="thucHienKhop()">Khớp dữ liệu (${DONGBO_STATE.dataRows.length} dòng)</button>
    <div id="dongboMatchResult" style="margin-top:14px;"></div>
  `;
}

function buildCandidates(loai) {
  if (loai === 'xuat') {
    return STATE.xuatBanList.map(x => ({ idPhieu: x.IDPhieu, mst: (x.MSTKhachHang || '').trim(), tongTien: Number(x.TongTien) || 0, ngay: new Date(x.Ngay), ten: x.TenKH, hienTaiSoHD: x.SoHDDT }));
  } else if (loai === 'nhap') {
    return STATE.nhapKhoList.map(n => {
      const ncc = STATE.nhaCungCapList.find(c => c.MaNCC === n.MaNCC);
      return { idPhieu: n.IDPhieu, mst: ((ncc && ncc.MST) || '').trim(), tongTien: Number(n.TongTien) || 0, ngay: new Date(n.Ngay), ten: n.TenNCC, hienTaiSoHD: n.SoHDMuaVao };
    });
  }
  return [];
}
function khopMotDong(row) {
  const candidates = buildCandidates(row.loai);
  const ngay = row.ngay ? (row.ngay instanceof Date ? row.ngay : parseVNDate(row.ngay)) : null;
  const found = candidates.filter(c => {
    if (!row.mst || c.mst !== row.mst) return false;
    if (!isNaN(row.tongTien) && Math.abs(c.tongTien - row.tongTien) > 1000) return false;
    if (ngay && c.ngay && !isNaN(c.ngay) && Math.abs(c.ngay - ngay) > 5 * 86400 * 1000) return false;
    return true;
  }).map(c => {
    let trangThai = 'moi';
    if (c.hienTaiSoHD) trangThai = (String(c.hienTaiSoHD).trim() === row.soHD) ? 'daDongBo' : 'khacHD';
    return { ...c, trangThai };
  });
  return { ...row, ungVien: found };
}

function thucHienKhop() {
  const loai = document.getElementById('dongboLoai').value;
  const idxSoHD = Number(document.getElementById('mapSoHD').value);
  const idxKyHieu = Number(document.getElementById('mapKyHieu').value);
  const idxNgay = Number(document.getElementById('mapNgay').value);
  const idxMST = Number(document.getElementById('mapMST').value);
  const idxTongTien = Number(document.getElementById('mapTongTien').value);
  if (idxSoHD < 0 || idxTongTien < 0 || idxMST < 0) { showToast('Cần chọn ít nhất cột Số hoá đơn, MST đối tác, Tổng tiền.'); return; }

  const rows = DONGBO_STATE.dataRows.map(row => {
    const soHD = String(row[idxSoHD] || '').trim();
    if (!soHD) return null;
    return {
      soHD, kyHieu: idxKyHieu >= 0 ? String(row[idxKyHieu] || '').trim() : '',
      ngay: idxNgay >= 0 ? parseVNDate(row[idxNgay]) : null,
      mst: String(row[idxMST] || '').trim(),
      tongTien: parseVNNumber(row[idxTongTien]), loai
    };
  }).filter(Boolean);

  DONGBO_STATE.matches = rows.map(khopMotDong);
  renderMatchResult();
}

function renderMatchResult() {
  const wrap = document.getElementById('dongboMatchResult');
  renderMatchTable(wrap, DONGBO_STATE.matches, true);
}

function renderMatchTable(wrap, matches, showLoaiFixed) {
  if (!matches.length) { wrap.innerHTML = '<div class="empty">Không đọc được dòng dữ liệu nào hợp lệ.</div>'; return; }
  const soKhopDuoc = matches.filter(m => m.ungVien.length > 0).length;
  const soDaDongBo = matches.filter(m => m.ungVien.some(c => c.trangThai === 'daDongBo')).length;
  wrap.innerHTML = `<p class="muted">Khớp được ${soKhopDuoc}/${matches.length} dòng · ${soDaDongBo} dòng đã đồng bộ từ trước (tự động bỏ qua). Nhãn <span class="tag bad">HĐ khác</span> nghĩa là phiếu đã có số hoá đơn khác — chỉ ghi đè nếu chọn thủ công.</p>
    <table><thead><tr>${showLoaiFixed ? '' : '<th>Loại</th>'}<th>Số HĐ</th><th>Ký hiệu</th><th>MST</th><th>Tổng tiền</th><th>Khớp với phiếu</th></tr></thead><tbody>
    ${matches.map((m, idx) => {
      const daDongBo = m.ungVien.find(c => c.trangThai === 'daDongBo');
      let selectHtml;
      if (m.ungVien.length === 0) selectHtml = '<span class="tag bad">Không tìm thấy phiếu phù hợp</span>';
      else if (daDongBo && m.ungVien.length === 1) selectHtml = `<span class="tag good">Đã đồng bộ trước đó — ${daDongBo.idPhieu}</span>`;
      else {
        selectHtml = `<select data-idx="${idx}" class="matchSelectGeneric">
          <option value="-1">-- Bỏ qua --</option>
          ${m.ungVien.map(c => {
            if (c.trangThai === 'daDongBo') return `<option value="${c.idPhieu}" data-trangthai="daDongBo">${c.idPhieu} — ${c.ten || ''} — ${fmtMoney(c.tongTien)} (đã đồng bộ đúng HĐ này)</option>`;
            if (c.trangThai === 'khacHD') return `<option value="${c.idPhieu}" data-trangthai="khacHD">⚠ ${c.idPhieu} — ${c.ten || ''} — ${fmtMoney(c.tongTien)} (đang có HĐ khác: ${c.hienTaiSoHD} — chọn = GHI ĐÈ)</option>`;
            return `<option value="${c.idPhieu}" data-trangthai="moi" selected>${c.idPhieu} — ${c.ten || ''} — ${fmtMoney(c.tongTien)}</option>`;
          }).join('')}
        </select>`;
      }
      const tagTrangThai = daDongBo ? '' : (m.ungVien.some(c => c.trangThai === 'khacHD') ? '<span class="tag bad" style="margin-left:6px;">HĐ khác</span>' : (m.ungVien.length ? '<span class="tag good" style="margin-left:6px;">Mới</span>' : ''));
      return `<tr>${showLoaiFixed ? '' : `<td>${m.loai === 'xuat' ? 'Bán ra' : (m.loai === 'nhap' ? 'Mua vào' : '<span class="tag bad">Không rõ</span>')}</td>`}<td>${m.soHD}</td><td>${m.kyHieu}</td><td>${m.mst}</td><td>${fmtMoney(m.tongTien)}</td><td>${selectHtml}${tagTrangThai}</td></tr>`;
    }).join('')}
  </tbody></table>`;
}

function apDungKhop(matches, selectClass, rerenderFns) {
  const selects = document.querySelectorAll('.' + selectClass);
  const items = []; let soGhiDe = 0;
  selects.forEach(sel => {
    const idx = Number(sel.dataset.idx);
    const idPhieu = sel.value;
    if (idPhieu && idPhieu !== '-1') {
      const m = matches[idx];
      const opt = sel.selectedOptions[0];
      if (opt && opt.dataset.trangthai === 'khacHD') soGhiDe++;
      if (opt && opt.dataset.trangthai === 'daDongBo') return;
      items.push({ sheetType: m.loai, idPhieu, soHDDT: m.soHD, kyHieuHD: m.kyHieu });
    }
  });
  if (!items.length) { showToast('Không có dòng nào cần ghi (có thể đã đồng bộ từ trước hoặc chưa chọn).'); return; }
  if (soGhiDe > 0 && !confirm(`Có ${soGhiDe} phiếu đang GHI ĐÈ số hoá đơn khác đã có sẵn. Anh chắc chắn muốn tiếp tục?`)) return;
  apiCall('bulkCapNhatHoaDon', { items }).then(res => {
    showToast(`Đã ghi ${res.thanhCong}/${res.tongSo} hoá đơn.`);
    rerenderFns.forEach(fn => fn());
  }).catch(err => showToast('Lỗi: ' + err.message));
}

document.getElementById('btnApDungDongBo').addEventListener('click', () => {
  apDungKhop(DONGBO_STATE.matches, 'matchSelectGeneric', [renderXuatBanTable, renderNhapKhoTable]);
});

/* ---- Nhập từ XML ---- */
const COMPANY_MST = '0317838601';
// Chuẩn hoá MST để so sánh chắc chắn (bỏ khoảng trắng/ký tự lạ, bù số 0 đầu nếu bị mất) —
// tránh trường hợp hoá đơn không liên quan tới công ty vẫn bị lọt qua do định dạng MST khác nhau.
function chuanHoaMSTClient(mst) {
  let s = String(mst || '').replace(/\D/g, '');
  if (s.length === 9) s = '0' + s;
  return s;
}

function findByTagNames(root, names) {
  const all = root.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const ln = (el.localName || el.tagName.split(':').pop()).toLowerCase();
    if (names.includes(ln)) return el;
  }
  return null;
}
function textOfTag(root, names) { const el = findByTagNames(root, names); return el ? el.textContent.trim() : ''; }

// Trích xuất TOÀN BỘ hoá đơn từ XML gốc — bao gồm cả chi tiết từng mặt hàng (DSHHDVu/HHDVu),
// đủ để tự tạo phiếu hoàn chỉnh (không chỉ gắn số HĐ vào phiếu có sẵn như trước).
function trichXuatHoaDonXML(xmlDoc, fileName) {
  const nBanEl = findByTagNames(xmlDoc, ['nban', 'sellerinfo']);
  const nMuaEl = findByTagNames(xmlDoc, ['nmua', 'buyerinfo']);
  const mstBan = nBanEl ? textOfTag(nBanEl, ['mst']) : '';
  const mstMua = nMuaEl ? textOfTag(nMuaEl, ['mst']) : '';
  const tenBan = nBanEl ? textOfTag(nBanEl, ['ten']) : '';
  const tenMua = nMuaEl ? textOfTag(nMuaEl, ['ten']) : '';
  const diaChiBan = nBanEl ? textOfTag(nBanEl, ['dchi']) : '';
  const diaChiMua = nMuaEl ? textOfTag(nMuaEl, ['dchi']) : '';
  const sdtBan = nBanEl ? textOfTag(nBanEl, ['sdthoai']) : '';
  const sdtMua = nMuaEl ? textOfTag(nMuaEl, ['sdthoai']) : '';
  const emailBan = nBanEl ? textOfTag(nBanEl, ['dctdtu']) : '';
  const emailMua = nMuaEl ? textOfTag(nMuaEl, ['dctdtu']) : '';
  const soHD = textOfTag(xmlDoc, ['shdon', 'sohoadon']);
  const kyHieu = textOfTag(xmlDoc, ['khhdon', 'kyhieuhoadon']);
  const ngayRaw = textOfTag(xmlDoc, ['nlap', 'ngaylap']);

  let loai = '';
  const mstBanChuan = chuanHoaMSTClient(mstBan);
  const mstMuaChuan = chuanHoaMSTClient(mstMua);
  const mstCongTyChuan = chuanHoaMSTClient(COMPANY_MST);
  if (mstBanChuan === mstCongTyChuan) loai = 'xuat';
  else if (mstMuaChuan === mstCongTyChuan) loai = 'nhap';
  if (!loai) return { loi: `${fileName}: KHÔNG PHẢI hoá đơn của công ty (MST ${COMPANY_MST}) — người bán là MST ${mstBan || '(trống)'}, người mua là MST ${mstMua || '(trống)'}, không khớp bên nào. Đã bỏ qua, không import.` };

  const mst = (loai === 'xuat' ? mstMua : mstBan).trim();
  const tenDoiTac = loai === 'xuat' ? tenMua : tenBan;
  const diaChiDoiTac = loai === 'xuat' ? diaChiMua : diaChiBan;
  const sdtDoiTac = loai === 'xuat' ? sdtMua : sdtBan;
  const emailDoiTac = loai === 'xuat' ? emailMua : emailBan;
  const ngay = parseVNDate(ngayRaw);
  if (!soHD || !mst || !ngay) return { loi: `${fileName}: thiếu thông tin bắt buộc (số hoá đơn / MST / ngày lập)` };

  const hhdvuList = xmlDoc.getElementsByTagName('HHDVu');
  const items = [];
  for (let i = 0; i < hhdvuList.length; i++) {
    const hh = hhdvuList[i];
    const tenHang = textOfTag(hh, ['thhdvu']);
    if (!tenHang) continue;
    const dvt = textOfTag(hh, ['dvtinh']);
    const soLuong = parseVNNumber(textOfTag(hh, ['sluong'])) || 1;
    const donGia = parseVNNumber(textOfTag(hh, ['dgia'])) || 0;
    const thueSuatRaw = textOfTag(hh, ['tsuat']);
    let thueSuat = '0';
    const tsNorm = normalizeVN(thueSuatRaw);
    if (tsNorm.includes('kct') || tsNorm.includes('khong chiu')) thueSuat = 'KCT';
    else { const num = parseFloat(String(thueSuatRaw).replace('%', '')); if (!isNaN(num)) thueSuat = String(Math.round(num)); }
    items.push({ tenHang, dvt, soLuong, donGia, thueSuat, loaiHangHoa: timHangHoaLoai(tenHang, dvt) });
  }
  if (!items.length) return { loi: `${fileName}: không tìm thấy danh sách mặt hàng (DSHHDVu/HHDVu) trong file — có thể định dạng XML khác chuẩn thông thường` };

  return {
    loai, soHD, kyHieu, ngay: ngayISO(ngay),
    mst, tenDoiTac, diaChiDoiTac, sdtDoiTac, emailDoiTac, tenFile: fileName, items
  };
}

document.getElementById('btnDocXml').addEventListener('click', () => {
  const files = document.getElementById('dongboXmlFiles').files;
  if (!files.length) { showToast('Chọn ít nhất 1 file XML.'); return; }
  const readers = [...files].map(file => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(e.target.result, 'application/xml');
        if (xmlDoc.querySelector('parsererror')) { resolve({ loi: `${file.name}: không đọc được XML (file lỗi hoặc không đúng định dạng)` }); return; }
        resolve(trichXuatHoaDonXML(xmlDoc, file.name));
      } catch (err) { resolve({ loi: `${file.name}: ${err.message}` }); }
    };
    reader.readAsText(file);
  }));
  Promise.all(readers).then(results => {
    const loi = results.filter(r => r.loi).map(r => r.loi);
    const hopLe = results.filter(r => !r.loi);
    const soBiTuChoiDoMST = loi.filter(l => l.includes('KHÔNG PHẢI hoá đơn của công ty')).length;
    BK_INVOICES = BK_INVOICES.concat(hopLe);
    BK_INVOICES.sort((a, b) => new Date(a.ngay) - new Date(b.ngay));
    BK_PARSE_ERRORS = BK_PARSE_ERRORS.concat(loi);
    document.getElementById('bkParseStatus').textContent =
      `[Từ XML] Đọc ${files.length} file — thêm ${hopLe.length} hoá đơn hợp lệ vào danh sách chờ nhập (tổng hiện có: ${BK_INVOICES.length}).` +
      (soBiTuChoiDoMST > 0 ? ` ⚠️ ${soBiTuChoiDoMST} file bị TỪ CHỐI vì không liên quan đến MST công ty 0317838601 (không phải người mua hoặc người bán).` : '') +
      (loi.length > soBiTuChoiDoMST ? ` ${loi.length - soBiTuChoiDoMST} file lỗi khác (xem chi tiết ở bước Tổng kết).` : '');
    if (hopLe.length) {
      xayDungDanhSachTenHang();
      renderBkClassifyTable();
      document.getElementById('bkClassifyPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (loi.length) {
      showToast(loi[0]);
    }
  });
});

/* ================= ĐỌC HOÁ ĐƠN TỪ PDF / ẢNH CHỤP (thử nghiệm) ================= */
let PDFANH_ROWS = [];

// Đọc PDF: ưu tiên lấy chữ có sẵn trong file (PDF ký số là văn bản thật, không phải ảnh) — chính xác cao.
// Nếu trang không có chữ (PDF thực chất là ảnh scan chèn vào) thì mới chuyển sang chụp ảnh trang & chạy OCR.
async function docChuTuPDF(file) {
  await caiThuVien('pdfjs');
  const buf = await file.arrayBuffer();
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let toanBoChu = '';
  let coChuThat = false;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // Ghép chữ theo ĐÚNG cấu trúc dòng (nhóm theo toạ độ Y) thay vì nối phẳng tất cả bằng dấu cách —
    // nếu không giữ xuống dòng, các nhãn (Số HĐ, Ký hiệu...) trên các dòng khác nhau sẽ bị dính liền,
    // khiến việc dò nhãn phía sau đọc sai lẫn lộn giữa các trường.
    const dong = [];
    textContent.items.forEach(it => {
      const y = Math.round(it.transform[5]);
      let hangHienCo = dong.find(d => Math.abs(d.y - y) < 3);
      if (!hangHienCo) { hangHienCo = { y, x: it.transform[4], chu: [] }; dong.push(hangHienCo); }
      hangHienCo.chu.push({ x: it.transform[4], str: it.str });
    });
    dong.sort((a, b) => b.y - a.y); // từ trên xuống dưới
    const chuTrang = dong.map(d => d.chu.sort((a, b) => a.x - b.x).map(c => c.str).join(' ')).join('\n');
    if (chuTrang.replace(/\s/g, '').length > 20) coChuThat = true;
    toanBoChu += chuTrang + '\n';
  }
  if (coChuThat) return { text: toanBoChu, nguon: 'pdf-text' };

  // PDF không có lớp chữ (khả năng là ảnh scan) -> chụp ảnh từng trang rồi OCR
  await caiThuVien('tesseract');
  let chuOCR = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const ket = await Tesseract.recognize(canvas, 'vie+eng');
    chuOCR += ket.data.text + '\n';
  }
  return { text: chuOCR, nguon: 'ocr-pdf-scan' };
}

async function docChuTuAnh(file) {
  await caiThuVien('tesseract');
  const ket = await Tesseract.recognize(file, 'vie+eng');
  return { text: ket.data.text, nguon: 'ocr-anh' };
}

/* ---- Chuẩn hoá bỏ dấu nhưng GIỮ NGUYÊN độ dài chuỗi (1 ký tự -> 1 ký tự) để vị trí khớp regex
   trên bản không dấu vẫn trỏ đúng vào bản gốc có dấu — dùng để dò nhãn không phân biệt dấu (phòng
   trường hợp OCR đọc ảnh mờ bị mất dấu tiếng Việt, hay gặp khi chụp hoá đơn giấy). ---- */
const BANG_BO_DAU = { à:'a',á:'a',ả:'a',ã:'a',ạ:'a',ă:'a',ằ:'a',ắ:'a',ẳ:'a',ẵ:'a',ặ:'a',â:'a',ầ:'a',ấ:'a',ẩ:'a',ẫ:'a',ậ:'a',
  è:'e',é:'e',ẻ:'e',ẽ:'e',ẹ:'e',ê:'e',ề:'e',ế:'e',ể:'e',ễ:'e',ệ:'e', ì:'i',í:'i',ỉ:'i',ĩ:'i',ị:'i',
  ò:'o',ó:'o',ỏ:'o',õ:'o',ọ:'o',ô:'o',ồ:'o',ố:'o',ổ:'o',ỗ:'o',ộ:'o',ơ:'o',ờ:'o',ớ:'o',ở:'o',ỡ:'o',ợ:'o',
  ù:'u',ú:'u',ủ:'u',ũ:'u',ụ:'u',ư:'u',ừ:'u',ứ:'u',ử:'u',ữ:'u',ự:'u', ỳ:'y',ý:'y',ỷ:'y',ỹ:'y',ỵ:'y', đ:'d' };
function chuanHoaChoDoiSanh(text) {
  let ra = '';
  for (const ch of text) {
    const l = ch.toLowerCase();
    ra += BANG_BO_DAU[l] !== undefined ? BANG_BO_DAU[l] : l;
  }
  return ra;
}

/* ---- Tách chữ thô thành dữ liệu hoá đơn có cấu trúc (dò theo nhãn thường gặp, không phân biệt dấu) ---- */
function timTheoNhan(textGoc, nhanKhongDauArr) {
  const textChuan = chuanHoaChoDoiSanh(textGoc);
  for (const nhan of nhanKhongDauArr) {
    const re = new RegExp(nhan + '\\s*[:\\.]?\\s*([^\\n\\r]{1,80})', 'i');
    const m = textChuan.match(re);
    if (m && m.index !== undefined) {
      const batDau = m.index + m[0].length - m[1].length;
      const goc = textGoc.substring(batDau, batDau + m[1].length).trim();
      if (goc) return goc.split(/\s{2,}|\t/)[0].trim(); // cắt nếu dính sang cột/nhãn kế bên (cách nhau ≥2 khoảng trắng)
    }
  }
  return '';
}
function timMSTGanNhan(textGoc, nhanKhongDauArr) {
  const textChuan = chuanHoaChoDoiSanh(textGoc);
  for (const nhan of nhanKhongDauArr) {
    const re = new RegExp(nhan + '[^0-9]{0,60}(\\d{10}(-\\d{3})?)', 'i');
    const m = textChuan.match(re);
    if (m) return m[1];
  }
  const m2 = textChuan.match(/\b(\d{10}(-\d{3})?)\b/);
  return m2 ? m2[1] : '';
}
function timNgayTrongText(textGoc) {
  const t = chuanHoaChoDoiSanh(textGoc);
  // Dạng chữ "ngày 08 tháng 08 năm 2026" (cho phép có chữ chen giữa "ngay" và số, VD "ngay lap hoa don:")
  let m = t.match(/(\d{1,2})\s*thang\s*(\d{1,2})\s*nam\s*(\d{4})/i);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  // Dạng số dd/mm/yyyy hoặc dd-mm-yyyy
  m = t.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}
function timTongTienTrongText(textGoc) {
  const t = chuanHoaChoDoiSanh(textGoc);
  const nhan = ['tong cong tien thanh toan', 'tong tien thanh toan', 'tong thanh toan'];
  for (const n of nhan) {
    const re = new RegExp(n + '[^0-9]{0,20}([\\d.,]{4,})', 'i');
    const m = t.match(re);
    if (m) return Number(m[1].replace(/[^\d]/g, '')) || 0; // tiền VND trên hoá đơn luôn số nguyên -> bỏ hết dấu phân cách
  }
  return 0;
}

function trichXuatTuVanBanHoaDon(rawText, tenFile, nguon) {
  const text = rawText.replace(/\r/g, ' ').replace(/[ \t]+/g, ' ');
  const textChuan = chuanHoaChoDoiSanh(text);

  const soHD = timTheoNhan(text, ['so\\s*\\(no', 'so hoa don', 'so hd\\b', '\\bso\\s*:']);
  const kyHieu = timTheoNhan(text, ['ky hieu\\s*\\(serial', 'ky hieu hoa don', 'ky hieu']);
  const ngay = timNgayTrongText(text);
  const tongTien = timTongTienTrongText(text);

  // Tìm khối "người bán" và "người mua" (lấy đoạn văn bản quanh nhãn để dò MST + tên trong đúng phạm vi)
  // — dò trên bản KHÔNG DẤU để không bị ảnh hưởng nếu OCR đọc mất dấu, nhưng cắt đoạn trên bản GỐC (giữ dấu).
  const idxBan = textChuan.search(/don vi ban|nguoi ban|ben ban/i);
  const idxMua = textChuan.search(/don vi mua|nguoi mua|ho ten nguoi mua|ben mua/i);
  const doanBan = idxBan >= 0 ? text.slice(idxBan, idxMua > idxBan ? idxMua : idxBan + 300) : '';
  const doanMua = idxMua >= 0 ? text.slice(idxMua, idxMua + 300) : '';

  const mstBan = timMSTGanNhan(doanBan || text, ['ma so thue', 'mst']);
  const mstMua = timMSTGanNhan(doanMua || text, ['ma so thue', 'mst']);
  const tenBan = timTheoNhan(doanBan, ['(?:don vi ban|nguoi ban|ben ban)(?: hang)?']);
  const tenMua = timTheoNhan(doanMua, ['(?:don vi mua|ho ten nguoi mua|nguoi mua|ben mua)(?: hang)?']);

  let loai = '';
  if (chuanHoaMSTClient(mstBan) === COMPANY_MST) loai = 'xuat';
  else if (chuanHoaMSTClient(mstMua) === COMPANY_MST) loai = 'nhap';

  return {
    tenFile, nguon, loai,
    soHD, kyHieu,
    ngay: ngay ? ngayISO(ngay) : '',
    mst: loai === 'xuat' ? mstMua : (loai === 'nhap' ? mstBan : (mstMua || mstBan)),
    tenDoiTac: loai === 'xuat' ? tenMua : tenBan,
    tongTien,
    // Chưa tách được chi tiết mặt hàng đáng tin cậy từ PDF/OCR -> tạo 1 dòng gộp, anh có thể tách tay nếu cần
    items: [{ tenHang: `Hàng hoá/dịch vụ theo hoá đơn (đọc từ ${nguon === 'pdf-text' ? 'PDF' : 'OCR'})`, dvt: 'lần', soLuong: 1, donGia: tongTien, thueSuat: '0', loaiHangHoa: 'DichVu' }]
  };
}
function chuanHoaMSTClient(mst) {
  let s = String(mst || '').replace(/\D/g, '');
  if (s.length === 9) s = '0' + s;
  if (s.length === 12) s = '0' + s;
  return s;
}

document.getElementById('btnDocPdfAnh').addEventListener('click', async () => {
  const files = document.getElementById('pdfAnhFiles').files;
  if (!files.length) { showToast('Chọn ít nhất 1 file PDF hoặc ảnh.'); return; }
  const statusEl = document.getElementById('pdfAnhStatus');
  const ketQua = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    statusEl.textContent = `Đang đọc file ${i + 1}/${files.length}: ${file.name} (có thể mất vài giây nếu phải OCR)...`;
    try {
      let doc;
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) doc = await docChuTuPDF(file);
      else doc = await docChuTuAnh(file);
      const trich = trichXuatTuVanBanHoaDon(doc.text, file.name, doc.nguon);
      ketQua.push(trich);
    } catch (err) {
      ketQua.push({ tenFile: file.name, loi: `Lỗi đọc file: ${err.message}` });
    }
  }
  statusEl.textContent = `Đã đọc xong ${files.length} file — kiểm tra kỹ bên dưới trước khi xác nhận (đặc biệt là chi tiết mặt hàng, vì PDF/ảnh chỉ tạo được 1 dòng gộp, không tách được từng mặt hàng như XML).`;
  PDFANH_ROWS = ketQua;
  renderPdfAnhPreview();
});

function renderPdfAnhPreview() {
  document.getElementById('pdfAnhPreviewPanel').style.display = 'block';
  const wrap = document.getElementById('pdfAnhPreviewList');
  wrap.innerHTML = PDFANH_ROWS.map((r, idx) => {
    if (r.loi) return `<div class="itemRow"><b>${r.tenFile}</b><div class="itemRowInfo" style="color:var(--bad);">${r.loi}</div></div>`;
    return `<div class="itemRow" data-idx="${idx}">
      <div style="font-weight:700;font-size:13.5px;margin-bottom:8px;">${r.tenFile} <span class="muted">(nguồn: ${r.nguon === 'pdf-text' ? 'chữ trong PDF' : 'OCR — kiểm tra kỹ hơn'})</span></div>
      <div class="itemRowGrid" style="grid-template-columns:repeat(2,1fr);">
        <div class="field"><label>Loại</label><select class="pdfEdit" data-field="loai">
          <option value="xuat" ${r.loai === 'xuat' ? 'selected' : ''}>Bán ra</option>
          <option value="nhap" ${r.loai === 'nhap' ? 'selected' : ''}>Mua vào</option>
          <option value="" ${!r.loai ? 'selected' : ''}>Không rõ — chọn tay</option>
        </select></div>
        <div class="field"><label>Ngày lập</label><input class="pdfEdit" data-field="ngay" type="date" value="${r.ngay}"></div>
        <div class="field"><label>Số hoá đơn</label><input class="pdfEdit" data-field="soHD" value="${r.soHD || ''}"></div>
        <div class="field"><label>Ký hiệu</label><input class="pdfEdit" data-field="kyHieu" value="${r.kyHieu || ''}"></div>
        <div class="field"><label>MST đối tác</label><input class="pdfEdit" data-field="mst" value="${r.mst || ''}"></div>
        <div class="field"><label>Tên đối tác</label><input class="pdfEdit" data-field="tenDoiTac" value="${r.tenDoiTac || ''}"></div>
        <div class="field" style="grid-column:1/-1;"><label>Tổng tiền thanh toán</label><input class="pdfEdit moneyInput" data-field="tongTien" type="text" inputmode="numeric" value="${(r.tongTien || 0).toLocaleString('vi-VN')}"></div>
      </div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.pdfEdit').forEach(el => {
    el.addEventListener('input', () => capNhatPdfAnhTuInput(el));
    el.addEventListener('change', () => capNhatPdfAnhTuInput(el));
  });
}
function capNhatPdfAnhTuInput(el) {
  const row = el.closest('.itemRow');
  const idx = Number(row.dataset.idx);
  const field = el.dataset.field;
  PDFANH_ROWS[idx][field] = field === 'tongTien' ? parseSoTien(el.value) : el.value;
  if (field === 'tongTien') PDFANH_ROWS[idx].items[0].donGia = PDFANH_ROWS[idx].tongTien;
}

document.getElementById('btnXacNhanPdfAnh').addEventListener('click', () => {
  const hopLe = PDFANH_ROWS.filter(r => !r.loi && r.loai && r.soHD && r.mst && r.ngay);
  const thieu = PDFANH_ROWS.filter(r => !r.loi && (!r.loai || !r.soHD || !r.mst || !r.ngay));
  if (thieu.length) { showToast(`${thieu.length} file còn thiếu Loại/Số HĐ/MST/Ngày — vui lòng điền đủ trước khi xác nhận.`); return; }
  if (!hopLe.length) { showToast('Không có hoá đơn hợp lệ để thêm.'); return; }
  BK_INVOICES = BK_INVOICES.concat(hopLe);
  BK_INVOICES.sort((a, b) => new Date(a.ngay) - new Date(b.ngay));
  xayDungDanhSachTenHang();
  renderBkClassifyTable();
  document.getElementById('bkClassifyPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(`Đã thêm ${hopLe.length} hoá đơn vào danh sách chờ nhập.`);
});
let LICHSU_HEADERS = [];
let LICHSU_ROWS = [];

document.getElementById('btnDocFileLichSu').addEventListener('click', async () => {
  const fileInput = document.getElementById('lichSuFile');
  if (!fileInput.files.length) { showToast('Chọn file trước.'); return; }
  const file = fileInput.files[0];
  showToast('Đang tải thư viện đọc Excel...');
  await caiThuVien('xlsx');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(15, aoa.length); i++) {
        const rowText = normalizeVN((aoa[i] || []).join(' '));
        if (rowText.includes('so hoa don') || rowText.includes('ky hieu') || rowText.includes('ngay lap')) { headerRowIdx = i; break; }
      }
      const headers = (aoa[headerRowIdx] || []).map(h => String(h || '').trim());
      const dataRows = aoa.slice(headerRowIdx + 1).filter(r => r.some(c => String(c || '').trim() !== ''));
      if (!headers.length || !dataRows.length) { showToast('Không đọc được dữ liệu từ file.'); return; }
      LICHSU_HEADERS = headers; LICHSU_ROWS = dataRows;
      showLichSuMapping();
    } catch (err) { showToast('Lỗi đọc file: ' + err.message); }
  };
  reader.readAsArrayBuffer(file);
});

function showLichSuMapping() {
  const headers = LICHSU_HEADERS;
  const isXuat = document.getElementById('lichSuLoai').value === 'xuat';
  const guess = {
    soHD: guessColumn(headers, ['so hoa don', 'so hddt', 'so ct']),
    kyHieu: guessColumn(headers, ['ky hieu']),
    ngay: guessColumn(headers, ['ngay lap', 'ngay hoa don', 'ngay ct']),
    ten: guessColumn(headers, isXuat ? ['ten nguoi mua', 'ten khach hang'] : ['ten nguoi ban', 'ten ncc', 'ten nha cung cap']),
    mst: guessColumn(headers, isXuat ? ['ma so thue nguoi mua', 'mst nguoi mua'] : ['ma so thue nguoi ban', 'mst nguoi ban']),
    tongTien: guessColumn(headers, ['tong tien thanh toan', 'tong cong tien thanh toan', 'tong tien'])
  };
  const optionsHtml = sel => '<option value="-1">-- không có --</option>' + headers.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${h || ('(cột ' + (i + 1) + ')')}</option>`).join('');
  document.getElementById('lichSuMapPanel').style.display = 'block';
  document.getElementById('lichSuMapPanel').innerHTML = `
    <h3>Chọn đúng cột trong file</h3>
    <div class="formGrid">
      <div class="field"><label>Cột: Số hoá đơn *</label><select id="lsMapSoHD">${optionsHtml(guess.soHD)}</select></div>
      <div class="field"><label>Cột: Ký hiệu hoá đơn</label><select id="lsMapKyHieu">${optionsHtml(guess.kyHieu)}</select></div>
      <div class="field"><label>Cột: Ngày lập *</label><select id="lsMapNgay">${optionsHtml(guess.ngay)}</select></div>
      <div class="field"><label>Cột: Tên đối tác *</label><select id="lsMapTen">${optionsHtml(guess.ten)}</select></div>
      <div class="field"><label>Cột: Mã số thuế đối tác</label><select id="lsMapMST">${optionsHtml(guess.mst)}</select></div>
      <div class="field"><label>Cột: Tổng tiền thanh toán *</label><select id="lsMapTongTien">${optionsHtml(guess.tongTien)}</select></div>
    </div>
    <button class="btn small" style="margin-top:10px;" onclick="xemTruocLichSu()">Xem trước (${LICHSU_ROWS.length} dòng)</button>
  `;
}

function xemTruocLichSu() {
  const idxSoHD = Number(document.getElementById('lsMapSoHD').value);
  const idxKyHieu = Number(document.getElementById('lsMapKyHieu').value);
  const idxNgay = Number(document.getElementById('lsMapNgay').value);
  const idxTen = Number(document.getElementById('lsMapTen').value);
  const idxMST = Number(document.getElementById('lsMapMST').value);
  const idxTongTien = Number(document.getElementById('lsMapTongTien').value);
  if (idxSoHD < 0 || idxNgay < 0 || idxTen < 0 || idxTongTien < 0) { showToast('Cần chọn ít nhất: Số hoá đơn, Ngày lập, Tên đối tác, Tổng tiền.'); return; }

  const loai = document.getElementById('lichSuLoai').value;
  const daThanhToanDu = document.getElementById('lichSuDaThanhToan').checked;

  const rows = LICHSU_ROWS.map(row => {
    const soHD = String(row[idxSoHD] || '').trim();
    if (!soHD) return null;
    const ngayRaw = parseVNDate(row[idxNgay]);
    return {
      loai, chon: true,
      SoHDDT: soHD,
      KyHieuHD: idxKyHieu >= 0 ? String(row[idxKyHieu] || '').trim() : '',
      Ngay: ngayRaw ? ngayISO(ngayRaw) : '',
      TenDoiTac: String(row[idxTen] || '').trim(),
      MST: idxMST >= 0 ? String(row[idxMST] || '').trim() : '',
      TongTien: parseVNNumber(row[idxTongTien]),
      daThanhToanDu
    };
  }).filter(Boolean);

  LICHSU_ROWS_PARSED = rows;
  renderLichSuPreview();
}
let LICHSU_ROWS_PARSED = [];

function renderLichSuPreview() {
  document.getElementById('lichSuPreviewPanel').style.display = 'block';
  const wrap = document.getElementById('lichSuPreviewWrap');
  const tongTienAll = LICHSU_ROWS_PARSED.reduce((s, r) => s + (Number(r.TongTien) || 0), 0);
  wrap.innerHTML = `<p class="muted">${LICHSU_ROWS_PARSED.length} dòng · Tổng cộng: <b>${fmtMoney(tongTienAll)}</b></p>
    <table><thead><tr><th><input type="checkbox" checked onclick="toggleAllLichSu(this)"></th><th>Ngày</th><th>Đối tác</th><th>MST</th><th>Số HĐ</th><th>Ký hiệu</th><th>Tổng tiền</th></tr></thead><tbody>
    ${LICHSU_ROWS_PARSED.map((r, idx) => `<tr>
      <td><input type="checkbox" ${r.chon ? 'checked' : ''} onchange="LICHSU_ROWS_PARSED[${idx}].chon=this.checked"></td>
      <td>${fmtDate(r.Ngay)}</td><td>${r.TenDoiTac}</td><td>${r.MST}</td><td>${r.SoHDDT}</td><td>${r.KyHieuHD}</td><td>${fmtMoney(r.TongTien)}</td>
    </tr>`).join('')}
  </tbody></table>`;
}
function toggleAllLichSu(cb) {
  LICHSU_ROWS_PARSED.forEach(r => r.chon = cb.checked);
  renderLichSuPreview();
}

document.getElementById('btnTaoPhieuLichSu').addEventListener('click', () => {
  const items = LICHSU_ROWS_PARSED.filter(r => r.chon);
  if (!items.length) { showToast('Chưa chọn dòng nào để tạo.'); return; }
  if (!confirm(`Tạo mới ${items.length} phiếu trong hệ thống? Hành động này không thể tự động huỷ hàng loạt, chỉ xoá được từng phiếu.`)) return;
  // Gửi theo lô 20 hoá đơn/lần (máy chủ gói miễn phí giới hạn số lệnh mỗi lần gọi), cộng dồn kết quả.
  const LO = 20;
  let tongThanhCong = 0, tongLoi = [];
  const guiLo = (i) => {
    if (i >= items.length) {
      showToast(`Đã tạo ${tongThanhCong}/${items.length} phiếu.` + (tongLoi.length ? ` Có ${tongLoi.length} dòng lỗi (xem Console F12).` : ''));
      if (tongLoi.length) console.warn('Lỗi nhập lịch sử:', tongLoi);
      renderXuatBanTable(); renderNhapKhoTable(); renderHangHoaTable();
      return;
    }
    showToast(`Đang tạo phiếu ${i + 1}–${Math.min(i + LO, items.length)}/${items.length}...`);
    apiCall('importLichSuTuBangKe', { items: items.slice(i, i + LO) }).then(res => {
      tongThanhCong += Number(res.thanhCong) || 0; tongLoi = tongLoi.concat(res.loi || []);
      guiLo(i + LO);
    }).catch(err => { tongLoi.push({ soHD: `(lô ${i / LO + 1})`, error: err.message }); guiLo(i + LO); });
  };
  guiLo(0);
});

/* ================= NHẬP CHI TIẾT ĐẦY ĐỦ TỪ BKMV/BKBR (NHIỀU QUÝ) ================= */
let BK_INVOICES = [];      // tất cả hoá đơn đã gộp từ mọi file, đã phân loại xong
let BK_TEN_HANG_MAP = {};  // tenHangChuanHoa -> { tenGoc, dvt, loaiGoiY, loaiDaChon, soLanXuatHien }
let BK_PARSE_ERRORS = [];

function timHangHoaLoai(tenHang, dvt) {
  const t = normalizeVN(tenHang);
  const dvtTrim = (dvt || '').trim();
  const tuKhoaDichVu = ['phi ', 'dich vu', 'gia cong', 'tu van', 'thue ', 'chung thuc', 'ho tro', 'quan tri', 'le phi', 'cuoc phi', 'phi ngan hang', 'bao tri', 'ban quyen', 'tien mang', 'internet', 'hosting', 'ten mien'];
  if (tuKhoaDichVu.some(k => t.includes(k))) return 'DichVu';
  if (!dvtTrim) return 'DichVu';
  return 'HangHoa';
}

function parseVNNumber(val) {
  if (val === undefined || val === null || val === '') return NaN;
  const s = String(val).trim().replace(/,/g, ''); // bỏ dấu phẩy ngăn cách hàng nghìn, giữ dấu chấm thập phân
  const num = parseFloat(s);
  return isNaN(num) ? NaN : num;
}

function findColByKeywords(headerRow, keywords, fromIdx, exact) {
  for (let c = fromIdx; c < headerRow.length; c++) {
    const h = normalizeVN(headerRow[c] || '');
    if (!h) continue;
    if (exact ? keywords.includes(h) : keywords.some(k => h.includes(k))) return c;
  }
  return -1;
}

function parseBangKeSheet(aoa, loai, tenFile) {
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(20, aoa.length); i++) {
    const row = aoa[i] || [];
    const c1 = normalizeVN(row[1] || ''); const c2 = normalizeVN(row[2] || '');
    if (c1 === 'stt' && c2.includes('ma hd')) { headerRowIdx = i; break; }
  }
  if (headerRowIdx < 0) return { invoices: [], error: `Không tìm thấy dòng tiêu đề (STT/Mã HĐ) trong sheet — bỏ qua.` };

  const headerRow = aoa[headerRowIdx];
  // Dò cột Số HĐ/Ngày/MST/Tên theo dòng phụ đề (ngay dưới dòng tiêu đề chính) — một số file có thêm
  // cột "MĐT" chen giữa Ngày và MST khiến vị trí cố định bị lệch, nên phải dò theo tên nhãn.
  const subHeaderRow = aoa[headerRowIdx + 1] || [];
  const colSoHDFound = findColByKeywords(subHeaderRow, ['so'], 3, true);
  const colNgayFound = findColByKeywords(subHeaderRow, ['ngay'], 3, true);
  const colMSTFound = findColByKeywords(subHeaderRow, ['mst'], 3, true);
  const colTenFound = findColByKeywords(subHeaderRow, ['ten'], 3, true);
  const colSoHD = colSoHDFound >= 0 ? colSoHDFound : 5;
  const colNgay = colNgayFound >= 0 ? colNgayFound : 6;
  const colMST = colMSTFound >= 0 ? colMSTFound : 7;
  const colTen = colTenFound >= 0 ? colTenFound : 8;

  const colTenHang = findColByKeywords(headerRow, ['mat hang', 'ten hang hoa'], 9, false);
  const colDvt = findColByKeywords(headerRow, ['dvt'], 9, false);
  const colSoLuong = findColByKeywords(headerRow, ['sg'], 9, true);
  const colDonGia = findColByKeywords(headerRow, ['don gia'], 9, false);
  const colGiaTri = findColByKeywords(headerRow, ['gia tri'], 9, false);
  const colTS = findColByKeywords(headerRow, ['ts'], 9, true);
  const colThueTien = findColByKeywords(headerRow, ['thue gtgt'], 9, false);

  if (colTenHang < 0) return { invoices: [], error: `Không tìm thấy cột "Mặt hàng/Tên hàng hóa" — bỏ qua sheet.` };

  let dataStartIdx = headerRowIdx + 3;
  for (let i = headerRowIdx + 1; i < Math.min(headerRowIdx + 6, aoa.length); i++) {
    const row = aoa[i] || [];
    if (String(row[colSoHD] || '').trim() && String(row[1] || '').trim()) { dataStartIdx = i; break; }
  }

  const invoices = [];
  let current = null;
  for (let i = dataStartIdx; i < aoa.length; i++) {
    const row = aoa[i] || [];
    if (!row.some(c => String(c || '').trim() !== '')) continue;
    const tenHang = String(row[colTenHang] || '').trim();
    if (normalizeVN(tenHang) === 'tong cong') break; // dòng tổng cộng cuối sheet -> hết dữ liệu thật
    if (!tenHang || tenHang === '.') continue;

    const stt = String(row[1] || '').trim();
    const soHD = String(row[colSoHD] || '').trim();
    const ngayRaw = row[colNgay];
    const mst = String(row[colMST] || '').trim();
    const tenDoiTac = String(row[colTen] || '').trim();

    const isNewInvoice = stt && stt !== '0';
    if (isNewInvoice) {
      if (!soHD || !mst || !/\d/.test(soHD) || !/\d/.test(mst)) continue;
      const ngay = parseVNDate(ngayRaw);
      current = {
        loai, soHD, kyHieu: '', ngay: ngay ? ngayISO(ngay) : '',
        mst, tenDoiTac, tenFile, items: []
      };
      invoices.push(current);
    }
    if (!current) continue;

    const giaTri = colGiaTri >= 0 ? parseVNNumber(row[colGiaTri]) : NaN;
    let soLuong = colSoLuong >= 0 ? parseVNNumber(row[colSoLuong]) : NaN;
    let donGia = colDonGia >= 0 ? parseVNNumber(row[colDonGia]) : NaN;
    if (isNaN(soLuong) || isNaN(donGia) || soLuong <= 0) {
      soLuong = 1;
      donGia = !isNaN(giaTri) ? giaTri : 0;
    } else if (!isNaN(giaTri) && Math.abs(soLuong * donGia - giaTri) > 2) {
      // Lệch so với giá trị gốc trong file (làm tròn) -> ưu tiên giá trị gốc, quy về 1 dòng
      soLuong = 1; donGia = giaTri;
    }

    let thueSuat = '0';
    if (colTS >= 0) {
      const raw = String(row[colTS] || '').trim();
      const rawNorm = normalizeVN(raw);
      if (rawNorm.includes('kct') || rawNorm.includes('khong chiu')) thueSuat = 'KCT';
      else if (raw) {
        const num = parseFloat(raw.replace('%', '').replace(',', '.'));
        if (!isNaN(num)) thueSuat = String(Math.round(num));
      }
    }
    // Sửa lỗi gõ thừa số 0 rõ ràng (VD "1000%" thay vì "10%") — áp dụng cả khi dòng có giá trị 0
    if (thueSuat !== 'KCT') {
      const rateNum = parseFloat(thueSuat) || 0;
      if (![0, 5, 8, 10].includes(rateNum) && rateNum > 10) {
        const chiaThu = rateNum / 100;
        if ([0, 5, 8, 10].includes(chiaThu)) thueSuat = String(chiaThu);
      }
    }
    // Đối chiếu với số tiền thuế thực tế đã ghi trong file (nếu có) — sửa các trường hợp ô % bị gõ nhầm
    // (ví dụ "1000%" thay vì "10%") bằng cách suy ngược tỉ lệ từ số tiền thuế ghi sẵn.
    if (colThueTien >= 0 && thueSuat !== 'KCT' && !isNaN(giaTri) && giaTri > 0) {
      const thueTienGhi = parseVNNumber(row[colThueTien]);
      if (!isNaN(thueTienGhi)) {
        const tyLeThucTe = Math.round((thueTienGhi / giaTri) * 100);
        const parsedRate = parseFloat(thueSuat) || 0;
        if (Math.abs(parsedRate - tyLeThucTe) > 1 && [0, 5, 8, 10].includes(tyLeThucTe)) {
          thueSuat = String(tyLeThucTe);
        }
      }
    }

    current.items.push({
      tenHang, dvt: colDvt >= 0 ? String(row[colDvt] || '').trim() : '',
      soLuong, donGia: donGia || 0, thueSuat
    });
  }

  return { invoices };
}

document.getElementById('btnDocFileBK').addEventListener('click', async () => {
  const files = document.getElementById('bkFiles').files;
  if (!files.length) { showToast('Chọn ít nhất 1 file bảng kê.'); return; }
  document.getElementById('bkParseStatus').textContent = `Đang tải thư viện đọc Excel...`;
  await caiThuVien('xlsx');
  document.getElementById('bkParseStatus').textContent = `Đang đọc ${files.length} file...`;

  const readers = [...files].map(file => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const result = { fileName: file.name, invoices: [], errors: [] };
        ['BKBR', 'BKMV'].forEach(sheetName => {
          if (!wb.Sheets[sheetName]) { result.errors.push(`Không có sheet ${sheetName} trong file ${file.name}`); return; }
          const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false, defval: '' });
          const loai = sheetName === 'BKBR' ? 'xuat' : 'nhap';
          const parsed = parseBangKeSheet(aoa, loai, file.name);
          if (parsed.error) result.errors.push(`${file.name} / ${sheetName}: ${parsed.error}`);
          result.invoices.push(...parsed.invoices);
        });
        resolve(result);
      } catch (err) {
        resolve({ fileName: file.name, invoices: [], errors: [`Lỗi đọc file: ${err.message}`] });
      }
    };
    reader.readAsArrayBuffer(file);
  }));

  Promise.all(readers).then(results => {
    BK_INVOICES = [];
    BK_PARSE_ERRORS = [];
    results.forEach(r => { BK_INVOICES.push(...r.invoices); BK_PARSE_ERRORS.push(...r.errors); });
    BK_INVOICES.sort((a, b) => new Date(a.ngay) - new Date(b.ngay));

    document.getElementById('bkParseStatus').textContent =
      `Đã đọc xong ${files.length} file — tìm được ${BK_INVOICES.length} hoá đơn` +
      (BK_PARSE_ERRORS.length ? ` (có ${BK_PARSE_ERRORS.length} cảnh báo, xem bên dưới sau khi xác nhận phân loại).` : '.');

    xayDungDanhSachTenHang();
    renderBkClassifyTable();
  });
});

function xayDungDanhSachTenHang() {
  BK_TEN_HANG_MAP = {};
  BK_INVOICES.forEach(inv => {
    inv.items.forEach(it => {
      const key = normalizeVN(it.tenHang);
      if (!BK_TEN_HANG_MAP[key]) {
        BK_TEN_HANG_MAP[key] = {
          tenGoc: it.tenHang, dvt: it.dvt,
          loaiGoiY: timHangHoaLoai(it.tenHang, it.dvt),
          soLanXuatHien: 0
        };
      }
      BK_TEN_HANG_MAP[key].soLanXuatHien++;
    });
  });
}

function renderBkClassifyTable() {
  document.getElementById('bkClassifyPanel').style.display = 'block';
  const search = (document.getElementById('bkClassifySearch').value || '').toLowerCase();
  const wrap = document.getElementById('bkClassifyWrap');
  const keys = Object.keys(BK_TEN_HANG_MAP)
    .filter(k => !search || BK_TEN_HANG_MAP[k].tenGoc.toLowerCase().includes(search))
    .sort((a, b) => BK_TEN_HANG_MAP[b].soLanXuatHien - BK_TEN_HANG_MAP[a].soLanXuatHien);

  wrap.innerHTML = `<table><thead><tr><th>Tên hàng</th><th>ĐVT</th><th>Số lần xuất hiện</th><th>Phân loại</th></tr></thead><tbody>
    ${keys.map(k => {
      const item = BK_TEN_HANG_MAP[k];
      return `<tr>
        <td>${item.tenGoc}</td><td>${item.dvt || '—'}</td><td>${item.soLanXuatHien}</td>
        <td><select data-key="${k}" onchange="BK_TEN_HANG_MAP['${k}'].loaiGoiY=this.value">
          <option value="HangHoa" ${item.loaiGoiY === 'HangHoa' ? 'selected' : ''}>Hàng hoá (có tồn kho)</option>
          <option value="DichVu" ${item.loaiGoiY === 'DichVu' ? 'selected' : ''}>Dịch vụ (không tồn kho)</option>
        </select></td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}
document.getElementById('bkClassifySearch').addEventListener('input', renderBkClassifyTable);

document.getElementById('btnXacNhanPhanLoai').addEventListener('click', () => {
  // Gán loại đã chọn vào từng dòng hàng trong hoá đơn
  BK_INVOICES.forEach(inv => {
    inv.items.forEach(it => {
      const key = normalizeVN(it.tenHang);
      it.loaiHangHoa = BK_TEN_HANG_MAP[key] ? BK_TEN_HANG_MAP[key].loaiGoiY : 'HangHoa';
    });
  });
  renderBkSummary();
});

function renderBkSummary() {
  document.getElementById('bkSummaryPanel').style.display = 'block';
  const xuat = BK_INVOICES.filter(i => i.loai === 'xuat');
  const nhap = BK_INVOICES.filter(i => i.loai === 'nhap');
  const tongXuat = xuat.reduce((s, i) => s + i.items.reduce((s2, it) => s2 + it.soLuong * it.donGia, 0), 0);
  const tongNhap = nhap.reduce((s, i) => s + i.items.reduce((s2, it) => s2 + it.soLuong * it.donGia, 0), 0);
  const tuNgay = BK_INVOICES.length ? fmtDate(BK_INVOICES[0].ngay) : '—';
  const denNgay = BK_INVOICES.length ? fmtDate(BK_INVOICES[BK_INVOICES.length - 1].ngay) : '—';

  const cards = [
    { label: 'Số hoá đơn bán ra', val: xuat.length },
    { label: 'Số hoá đơn mua vào', val: nhap.length },
    { label: 'Tổng giá trị bán ra (trước thuế)', val: fmtMoney(tongXuat) },
    { label: 'Tổng giá trị mua vào (trước thuế)', val: fmtMoney(tongNhap) },
    { label: 'Từ ngày', val: tuNgay },
    { label: 'Đến ngày', val: denNgay }
  ];
  document.getElementById('bkSummaryCards').innerHTML = cards.map(c => `<div class="statCard"><div class="label">${c.label}</div><div class="val">${c.val}</div></div>`).join('');

  const errWrap = document.getElementById('bkErrorList');
  if (BK_PARSE_ERRORS.length) {
    errWrap.innerHTML = `<p class="muted" style="color:var(--bad);">${BK_PARSE_ERRORS.length} cảnh báo khi đọc file:</p><ul class="muted">${BK_PARSE_ERRORS.map(e => `<li>${e}</li>`).join('')}</ul>`;
  } else {
    errWrap.innerHTML = '';
  }
}

document.getElementById('btnBatDauNhapBK').addEventListener('click', () => {
  if (!BK_INVOICES.length) { showToast('Chưa có dữ liệu để nhập.'); return; }
  if (!confirm(`Sẽ tạo tối đa ${BK_INVOICES.length} phiếu (bỏ qua tự động các hoá đơn đã tồn tại trong hệ thống). Tiếp tục?`)) return;

  const daThanhToanDu = document.getElementById('bkDaThanhToan').checked;
  const invoicesToSend = BK_INVOICES.map(inv => ({ ...inv, daThanhToanDu }));
  // Chia lô theo cả số hoá đơn (tối đa 10) lẫn tổng số dòng hàng (tối đa 60) — máy chủ gói miễn phí giới hạn
  // số lệnh ghi mỗi lần gọi, hoá đơn nhiều dòng hàng cần lô nhỏ hơn.
  const chunks = [];
  let loHienTai = [], soDongLo = 0;
  invoicesToSend.forEach(inv => {
    const soDong = (inv.items || []).length || 1;
    if (loHienTai.length && (loHienTai.length >= 10 || soDongLo + soDong > 60)) { chunks.push(loHienTai); loHienTai = []; soDongLo = 0; }
    loHienTai.push(inv); soDongLo += soDong;
  });
  if (loHienTai.length) chunks.push(loHienTai);

  document.getElementById('bkProgressWrap').style.display = 'block';
  const progressText = document.getElementById('bkProgressText');
  const resultWrap = document.getElementById('bkResultWrap');
  resultWrap.innerHTML = '';
  let tongThanhCong = 0, tongDaTonTai = 0, tongLoi = [], tongCanhBaoTonKhoAm = [];

  function xuLyChunk(idx) {
    if (idx >= chunks.length) {
      progressText.textContent = `Hoàn tất: đã tạo ${tongThanhCong} phiếu, ${tongDaTonTai} hoá đơn đã tồn tại từ trước (bỏ qua), ${tongLoi.length} lỗi.`;
      if (tongThanhCong === 0 && tongDaTonTai === 0 && !tongLoi.length) {
        progressText.textContent += ' ⚠️ Không có phiếu nào được tạo nhưng cũng không báo lỗi — có thể server trả về dữ liệu bất thường. Mở Console trình duyệt (F12) để xem chi tiết đã ghi log.';
      }
      if (tongCanhBaoTonKhoAm.length) {
        const uniqueMap = {};
        tongCanhBaoTonKhoAm.forEach(w => { uniqueMap[w.tenHH] = w.tonKho; });
        resultWrap.innerHTML += `<p class="muted" style="color:var(--warn);margin-top:10px;">⚠️ ${Object.keys(uniqueMap).length} mặt hàng đang bị âm tồn kho sau khi nhập (do bán trước khi có phiếu nhập tương ứng trong dữ liệu) — anh rà lại ở tab Danh mục:</p>
          <ul class="muted">${Object.keys(uniqueMap).map(ten => `<li>${ten}: còn ${uniqueMap[ten]}</li>`).join('')}</ul>`;
      }
      if (tongLoi.length) {
        resultWrap.innerHTML += `<div class="tableWrap"><table><thead><tr><th>Số HĐ</th><th>Ngày</th><th>Đối tác</th><th>Lỗi</th></tr></thead><tbody>
          ${tongLoi.map(l => `<tr><td>${l.soHD}</td><td>${fmtDate(l.ngay)}</td><td>${l.doiTac || ''}</td><td>${l.error}</td></tr>`).join('')}
        </tbody></table></div>`;
      }
      renderXuatBanTable(); renderNhapKhoTable(); renderHangHoaTable(); renderKhachHangTable(); renderNhaCungCapTable();
      showToast('Đã nhập xong dữ liệu chi tiết BKMV/BKBR.');
      return;
    }
    progressText.textContent = `Đang xử lý lô ${idx + 1}/${chunks.length}...`;
    apiCall('importChiTietBKMVBR', { invoices: chunks[idx] }).then(res => {
      console.log(`[Nhập BKMV/BKBR] Kết quả lô ${idx + 1}:`, res);
      if (!res || typeof res.thanhCong !== 'number') {
        tongLoi.push({ soHD: '(lô ' + (idx + 1) + ')', error: 'Phản hồi bất thường từ server: ' + JSON.stringify(res).substring(0, 200) });
      } else {
        tongThanhCong += res.thanhCong;
        tongDaTonTai += Number(res.daTonTai) || 0;
        tongLoi = tongLoi.concat(res.loi || []);
        tongCanhBaoTonKhoAm = tongCanhBaoTonKhoAm.concat(res.canhBaoTonKhoAm || []);
      }
      xuLyChunk(idx + 1);
    }).catch(err => {
      console.error(`[Nhập BKMV/BKBR] Lỗi lô ${idx + 1}:`, err);
      tongLoi.push({ soHD: '(lô ' + (idx + 1) + ')', error: err.message });
      xuLyChunk(idx + 1);
    });
  }
  xuLyChunk(0);
});
