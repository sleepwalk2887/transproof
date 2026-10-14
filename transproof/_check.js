// 语法校验：抽出 index.html 内联 script 用 new Function 检查
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];
let bad = 0;
scripts.forEach((m, i) => {
  try { new Function(m[1]); } catch (e) { bad++; console.log('script#' + i + ' SYNTAX ERROR:', e.message); }
});
console.log('scripts=' + scripts.length, 'bad=' + bad);
process.exit(bad ? 1 : 0);
