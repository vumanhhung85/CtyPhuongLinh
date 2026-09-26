/* =====================================================================
   CẤU HÌNH DUY NHẤT CẦN SỬA KHI TRIỂN KHAI
   API_URL = địa chỉ Worker trên Cloudflare, dạng:
     https://phuonglinh-erp-api.<ten-tai-khoan>.workers.dev
   Lấy ở Cloudflare Dashboard > Workers & Pages > phuonglinh-erp-api (dòng "Domains & Routes"/"Visit").
   Sửa trực tiếp trên GitHub (bấm biểu tượng bút chì) rồi Commit — không cần sửa file nào khác.
   ===================================================================== */
window.PL_CONFIG = {
  API_URL: 'https://DIEN-DIA-CHI-WORKER.workers.dev'
};
