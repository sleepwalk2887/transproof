/* ═══════ 发版自检（用户要求 2026-10-31 起）═══════
   每次发版后跑：node _verify-release.js
   检查：六副本版本/文件对齐、tips/交接本镜像、git 干净且已推送、线上与本地一致。
   硬失败 exit 1；网络类问题只 WARN（提醒开代理重跑）。 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Q = "'";

const ROOT = __dirname;
const ORB = path.resolve(ROOT, '..');
let pass = 0, fail = 0, warn = 0;
function T(name, ok, hard){ if(ok){ pass++; console.log('  ok   ' + name); } else if(hard === false){ warn++; console.log('  WARN ' + name); } else { fail++; console.log('  FAIL ' + name); } }
function read(p){ try { return fs.readFileSync(p, 'utf8'); } catch(e){ return null; } }
function appv(dir){
  const s = read(path.join(dir, 'js/01-core.js'));
  if(!s) return null;
  const a = s.indexOf('APP_VERSION = ');
  if(a < 0) return null;
  const b = s.indexOf(Q, a + 14);
  const c = b >= 0 ? s.indexOf(Q, b + 1) : -1;
  return (b >= 0 && c > 0) ? s.slice(b + 1, c) : null;
}
function scriptSrcs(html){
  const out = [];
  if(!html) return out;
  let i = 0;
  while(true){
    const a = html.indexOf('<script src="', i);
    if(a < 0) break;
    const b = html.indexOf('"', a + 13);
    if(b < 0) break;
    out.push(html.slice(a + 13, b));
    i = b + 1;
  }
  return out;
}
function sameSet(x, y){
  if(x.length !== y.length) return false;
  return x.every(v => y.indexOf(v) >= 0);
}

console.log('===== TransProof 发版自检 =====');
const MAIN = ROOT;
const vMain = appv(MAIN);
T('本地主副本版本读取成功', !!vMain);
console.log('本地版本：v' + vMain);

const copies = [
  [MAIN, '主副本 transproof'],
  [path.join(ORB, 'transproof-collab/transproof'), 'collab 镜像'],
  ['C:/Users/Andrew/WorkBuddy/2026-09-24-01-35-19/transproof', 'WorkBuddy 第三副本'],
  [path.join(ORB, 'transproof-plugin/app'), '插件 app（工作区）'],
  [path.join(ORB, 'transproof-collab/transproof-plugin/app'), '插件 app（collab）'],
  ['C:/Users/Andrew/.dsh/profiles/desktop/node_modules/transproof-dsh-plugin/app', 'node_modules 插件 app（DSH 实际加载）']
];
for(const [dir, name] of copies){
  const v = appv(dir);
  T(name + ' 版本一致（v' + v + '）', v === vMain);
}

const jsFiles = fs.readdirSync(path.join(MAIN, 'js')).filter(f => f.endsWith('.js'));
let fileMismatch = 0;
for(const [dir, name] of copies){
  for(const f of jsFiles){
    const a = read(path.join(MAIN, 'js', f));
    const b = read(path.join(dir, 'js', f));
    if(a !== b){ fileMismatch++; console.log('       差异文件：' + name + '/js/' + f); }
  }
  const ia = read(path.join(MAIN, 'index.html'));
  const ib = read(path.join(dir, 'index.html'));
  if(ia !== ib){ fileMismatch++; console.log('       差异文件：' + name + '/index.html'); }
}
T('六副本 js + index.html 逐字节一致（' + jsFiles.length + ' 个 js）', fileMismatch === 0);

T('tips 镜像一致（collab 真源 → 主）', read(path.join(ORB, 'transproof/乱风企划tips.md')) === read(path.join(ORB, 'transproof-collab/transproof/乱风企划tips.md')));
T('交接本镜像一致（root → collab）', read(path.join(ORB, '交接本.md')) === read(path.join(ORB, 'transproof-collab/交接本.md')));

try{
  const dirty = execSync('git status --porcelain', { cwd: path.join(ORB, 'transproof-collab'), encoding: 'utf8' });
  T('git 工作区干净', dirty.trim() === '');
  const head = execSync('git rev-parse HEAD', { cwd: path.join(ORB, 'transproof-collab'), encoding: 'utf8' }).trim();
  const up = execSync('git rev-parse @{u}', { cwd: path.join(ORB, 'transproof-collab'), encoding: 'utf8' }).trim();
  T('git 已推送（HEAD = origin/main）', head === up);
}catch(e){ T('git 检查失败：' + e.message.slice(0, 80), false); }

let onlineHtml = null;
try{ onlineHtml = execSync('curl -sL --max-time 25 https://transproof.pages.dev/index.html', { encoding: 'utf8' }); }catch(e){}
if(!onlineHtml){
  T('线上检查：网络不通（开代理后重跑）', false, false);
}else{
  const vOn = (function(){
    try{
      const js = execSync('curl -sL --max-time 25 https://transproof.pages.dev/js/01-core.js', { encoding: 'utf8' });
      const a = js.indexOf('APP_VERSION = ');
      const b = js.indexOf(Q, a + 14);
      const c = b >= 0 ? js.indexOf(Q, b + 1) : -1;
      return (b >= 0 && c > 0) ? js.slice(b + 1, c) : null;
    }catch(e){ return null; }
  })();
  T('线上版本 = 本地（v' + vOn + '）', vOn === vMain);
  T('线上脚本清单 = 本地', sameSet(scriptSrcs(read(path.join(MAIN, 'index.html'))), scriptSrcs(onlineHtml)));
}


// ── A3 机器闸门（T-036 文档防腐）──
(function(){
  function docVer(t){ const k='版本 **v'; const a=t.indexOf(k); if(a<0) return null; const b=a+k.length; const c=t.indexOf('**', b); return c>0 ? t.slice(b,c) : null; }
  var f1a = ['交接本.md', 'transproof-collab/交接本.md'];
  for (var i=0;i<f1a.length;i++){
    var s1 = read(path.join(ORB, f1a[i])) || '';
    var v1 = docVer(s1);
    T('文档防腐：' + f1a[i] + ' 声明的版本 = 代码（' + v1 + '）', v1 === vMain);
  }
  var f1b = ['transproof-collab/HANDOFF.md', 'transproof-collab/AGENTS.md'];
  for (var j=0;j<f1b.length;j++){
    var s2 = read(path.join(ORB, f1b[j])) || '';
    T('文档防腐：' + f1b[j] + ' 无独立版本声明', s2.indexOf('当前版本：') < 0);
  }
  var dw = read('C:/Users/Andrew/Documents/deepseek-harness/default-workspace/HANDOFF.md') || '';
  T('文档防腐：default-workspace HANDOFF 已停止维护横幅', dw.indexOf('已停止维护') >= 0);
  try{
    var hb = read(path.join(ORB, '交接本.md')) || '';
    var kd = '最后更新：**';
    var da = hb.indexOf(kd);
    var dm = null;
    if(da >= 0){ var db = da + kd.length; var dc = hb.indexOf('**', db); if(dc > db) dm = hb.slice(db, dc); }
    var tipsPath = path.join(ORB, 'transproof-collab', 'transproof', '乱风企划tips.md');
    var tm = fs.statSync(tipsPath).mtime;
    var p2 = function(x){ return String(x).padStart(2, '0'); };
    var tmStr = tm.getFullYear() + '-' + p2(tm.getMonth()+1) + '-' + p2(tm.getDate());
    T('文档防腐：交接本最后更新(' + dm + ') 不早于 tips mtime(' + tmStr + ')', (dm != null) && (dm >= tmStr));
  }catch(e){ T('文档防腐：日期检查失败 ' + String(e.message).slice(0, 60), false); }
})();
console.log('===== 自检结果：通过 ' + pass + ' · 失败 ' + fail + ' · 警告 ' + warn + ' =====');
process.exit(fail ? 1 : 0);
