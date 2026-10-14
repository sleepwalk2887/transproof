// 生成一个最小合法文字型 PDF（带 xref），供解析测试用
const fs = require('fs');
const objs = [];
objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>';
const stream = 'BT /F1 24 Tf 72 720 Td (TransProof PDF parse test sample line one) Tj 0 -36 Td (line two - keeps source line breaks for paste test) Tj ET';
objs[4] = '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream';
objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

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
fs.writeFileSync(__dirname + '/_sample.pdf', out, 'latin1');
console.log('written _sample.pdf', out.length, 'bytes');
