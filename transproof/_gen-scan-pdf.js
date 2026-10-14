// 生成「扫描件」型 PDF：单页、无文字层（触发 OCR 路径）
const fs = require('fs');
const objs = [];
objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>';
// 页面只画一张图（8x8 纯色 JPEG 需要额外生成；这里用空内容流 + 无字体 = 无文字层）
const stream = 'q 612 0 0 792 0 0 cm /Im1 Do Q';
objs[4] = '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream';
// 1x1 灰色 JPEG（最小可用字节序列）
const jpg = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
objs[5] = '<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n' + jpg.toString('latin1') + '\nendstream';

let out = '%PDF-1.4\n';
const offsets = [];
for (let i = 1; i <= 5; i++) {
  offsets[i] = out.length;
  out += i + ' 0 obj ' + objs[i] + ' endobj\n';
}
const xrefPos = out.length;
out += 'xref\n0 6\n0000000000 65535 f \n';
for (let i = 1; i <= 5; i++) out += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
out += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n';
fs.writeFileSync(__dirname + '/_sample-scan.pdf', Buffer.from(out, 'latin1'));
console.log('written _sample-scan.pdf');
