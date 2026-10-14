// 生成带脚注+尾注的 2 页文字型 PDF（v4.22.0 注释提取测试样本）
// P1：正文（含上标小字 1 与字面 [2]）+ 页底分隔线 + 小字号脚注条目（1 带续行、2）
// P2：正文一句 + Notes 标题（尾注区）+ 小字号尾注条目 1、2
const fs = require('fs');
const objs = [];
objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
objs[2] = '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>';
objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>';
objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
objs[6] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 5 0 R >> >> >>';

// 页面 1：正文 72-700 区，脚注 255-300 区
const s1 = [
  'BT /F1 14 Tf 72 730 Td (Chapter One) Tj ET',
  'BT /F1 12 Tf 72 700 Td (The city lay along the river and the bridges) Tj ET',
  'BT /F1 9 Tf 338 700 Td (1) Tj ET',
  'BT /F1 12 Tf 345 700 Td ( connected both banks.) Tj ET',
  'BT /F1 12 Tf 72 675 Td (A second line carries a bracket marker[2] here.) Tj ET',
  // 页底脚注：分隔线（30 个短横）+ 小字号（9pt < 12*0.78）条目
  'BT /F1 9 Tf 72 300 Td (------------------------------) Tj ET',
  'BT /F1 9 Tf 72 285 Td (1. First note about the river crossing.) Tj ET',
  'BT /F1 9 Tf 72 270 Td (It was built in 1884.) Tj ET',
  'BT /F1 9 Tf 72 255 Td (2. Second note: see the atlas, p. 12.) Tj ET'
].join('\n');
objs[4] = '<< /Length ' + s1.length + ' >>\nstream\n' + s1 + '\nendstream';

// 页面 2：一句正文 + Notes 尾注区（小字号条目）
const s2 = [
  'BT /F1 12 Tf 72 730 Td (The translator assembled these notes after the manuscript.) Tj ET',
  'BT /F1 14 Tf 72 700 Td (Notes) Tj ET',
  'BT /F1 9 Tf 72 675 Td (1. Translator\'s note on terminology.) Tj ET',
  'BT /F1 9 Tf 72 660 Td (2. See the atlas, p. 12.) Tj ET'
].join('\n');
objs[7] = '<< /Length ' + s2.length + ' >>\nstream\n' + s2 + '\nendstream';

let out = '%PDF-1.4\n';
const offsets = [];
const order = [1, 2, 3, 4, 5, 6, 7];
for (const i of order) {
  offsets[i] = out.length;
  out += i + ' 0 obj ' + objs[i] + ' endobj\n';
}
const xrefPos = out.length;
out += 'xref\n0 8\n0000000000 65535 f \n';
for (const i of order) out += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
out += 'trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n';
fs.writeFileSync(__dirname + '/_sample-note.pdf', out, 'latin1');
console.log('written _sample-note.pdf', out.length, 'bytes');
