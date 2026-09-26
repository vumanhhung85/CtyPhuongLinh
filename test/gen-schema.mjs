// Sinh worker/schema.sql từ đúng định nghĩa SCHEMA trong worker/src/index.js (1 nguồn duy nhất).
import { writeFileSync } from 'node:fs';
import { _test } from '../worker/src/index.js';

const lenh = _test.schemaStatements();
const noiDung = [
  '-- Cấu trúc CSDL D1 cho app Phương Linh — SINH TỰ ĐỘNG từ worker/src/index.js (đừng sửa tay).',
  '-- Không cần chạy file này bằng tay: trang migrate.html có nút "Kiểm tra & khởi tạo cấu trúc" gọi Worker tự tạo.',
  '-- Chỉ để đọc tham khảo, hoặc dùng: npx wrangler d1 execute phuonglinh_erp --remote --file=schema.sql',
  ...lenh.map(s => s + ';')
].join('\n') + '\n';
writeFileSync(new URL('../worker/schema.sql', import.meta.url), noiDung);
console.log('Đã sinh schema.sql:', lenh.length, 'lệnh');
