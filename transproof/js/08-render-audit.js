/* ═══════════ 校对阶段切换（v4.9.0：一校/二校双阶段）═══════════ */
function applyStageUI(){
  document.querySelectorAll('#stage-seg .stage-btn').forEach(b => b.classList.toggle('on', b.dataset.stage === STAGE));
  const hint = { full:'', pass1:'先清硬伤（漏译/误译/术语），不改文风', pass2:'硬伤已清，只做文风润色' }[STAGE] || '';
  $('#stage-hint').textContent = hint;
}
document.querySelectorAll('#stage-seg .stage-btn').forEach(b => {
  b.onclick = () => { STAGE = b.dataset.stage; save('tp.stage', STAGE); applyStageUI(); };
});
applyStageUI();

/* ═══════════ 错误分类统计 + 筛选（v4.9.0）═══════════ */
function parseErrorCategories(text){
  const counts = {};
  const re = /[\[【]([^\]】]{2,8})[\]】]/g;
  let m;
  while((m = re.exec(String(text || ''))) !== null){
    const k = m[1].trim();
    if(ERR_TYPES.includes(k)) counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}
function markErrorLines(){
  /* 单字类型标签：危=高风险（误译漏译增译）/ 术=术语 / 检=逻辑歧义 / 议=文风建议 */
  const TAG = {'误译':'危','漏译':'危','增译':'危','术语不一致':'术','逻辑关系':'检','歧义':'检',
               '标点格式':'检','中式英语':'议','语体不当':'议'};
  document.querySelectorAll('#out li').forEach(li => {
    const m = li.textContent.match(/^\s*[\[【]([^\]】]{2,8})[\]】]/);
    const k = m && ERR_TYPES.includes(m[1].trim()) ? m[1].trim() : '';
    li.dataset.err = k;
    if(k) li.dataset.tag = TAG[k] || '检';
  });
}
function renderErrorFilter(text){
  const cats = parseErrorCategories(text || LAST_OUT);
  const keys = Object.keys(cats);
  const seg = $('#err-filter');
  if(!keys.length){ seg.innerHTML = ''; return false; }
  const total = keys.reduce((a,k) => a + cats[k], 0);
  const fpLis = [...document.querySelectorAll('#out li[data-fp]')].filter(li => li.dataset.err);
  const doneN = fpLis.filter(li => AUDIT_FIX[li.dataset.fp]).length;
  seg.innerHTML = '<span style="font-size:12px;color:var(--tx3)">错误分类：</span>' +
    '<button class="ef-chip on" data-ef="all">全部 ' + total + '</button>' +
    keys.map(k => '<button class="ef-chip" data-ef="' + esc(k) + '">' + esc(k) + ' ' + cats[k] + '</button>').join('') +
    (fpLis.length ? '<button class="ef-chip" data-ef="unfixed">未修 ' + (fpLis.length - doneN) + '</button><span class="ef-progress">已修 ' + doneN + '/' + fpLis.length + '</span>' : '');
  seg.querySelectorAll('.ef-chip').forEach(ch => ch.onclick = () => {
    seg.querySelectorAll('.ef-chip').forEach(x => x.classList.remove('on'));
    ch.classList.add('on');
    const v = ch.dataset.ef;
    document.querySelectorAll('#out li').forEach(li => {
      const hit = (v === 'all') || (v === 'unfixed' ? !!(li.dataset.err && !AUDIT_FIX[li.dataset.fp]) : (li.dataset.err === v));
      li.style.opacity = hit ? '1' : '0.3';
      li.style.background = (hit && v !== 'all') ? 'rgba(79,140,255,.08)' : 'transparent';
      if(hit && v !== 'all'){ const d = li.closest('details'); if(d) d.open = true; }
    });
  });
  return true;
}
function renderStageNext(){
  const seg = $('#stage-next');
  if(STAGE === 'pass1'){
    if($('#c-autopass2') && $('#c-autopass2').checked){
      // 自动接力：一校完成 → 自动切二校并重跑
      seg.innerHTML = '<span style="font-size:12px;color:var(--tx3)">⚡ 已自动进入二校（文风润色）…</span>';
      STAGE = 'pass2'; save('tp.stage', STAGE); applyStageUI();
      setTimeout(() => run(), 300);
      return true;
    }
    seg.innerHTML = '<span style="font-size:12px;color:var(--tx2)">一校完成，硬伤已清 →</span><button class="btn sm" id="btn-pass2">▶ 一键进入二校（文风润色）</button>';
    $('#btn-pass2').onclick = () => { STAGE = 'pass2'; save('tp.stage', STAGE); applyStageUI(); run(); };
    return true;
  }
  seg.innerHTML = '';
  return false;
}
function renderPostBar(){
  const bar = $('#post-bar');
  if(!bar) return;
  const hasEf = $('#err-filter').innerHTML !== '';
  const hasSn = $('#stage-next').innerHTML !== '';
  bar.style.display = (hasEf || hasSn) ? 'flex' : 'none';
}

/* ═══════════ 同步到项目进度看板（v4.9.0 · 信息共享）═══════════ */
function currentTask(){
  if(PROJECT.currentId){ const t = PROJECT.tasks.find(x => x.id === PROJECT.currentId); if(t) return t; }
  return PROJECT.tasks.filter(t => t.status === 'proofreading').sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0))[0] || null;
}
function syncToProject(text, dst){
  const t = currentTask();
  if(!t) return;
  const cats = parseErrorCategories(text);
  const audit = termAudit(extractProofText(text) || dst || '', $('#src').value);
  t.proof = Object.assign({}, t.proof, {
    stage: STAGE,
    lastRun: Date.now(),
    errors: cats,
    termAudit: { conflict: audit.conflict.length, multi: audit.multi.length, used: audit.used.length },
  });
  t.updatedAt = Date.now();
  if(t.status === 'todo') t.status = 'proofreading';
  saveProject();
  renderProject();
}

/* ═══════════ Markdown 渲染（轻量） ═══════════ */
function md(s){
  if(!s) return '';
  const blocks = [];
  let t = s.replace(/```[\s\S]*?```/g, m => { blocks.push(m); return '\u0000B' + (blocks.length-1) + '\u0000'; });
  t = esc(t);
  const lines = t.split('\n');
  const o = [];
  let list = null;
  const inline = x => x
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const closeList = () => { if(list){ o.push('</' + list + '>'); list = null; } };
  for(let ln of lines){
    const s0 = ln.trim();
    if(!s0){ closeList(); continue; }
    if(/^\u0000B\d+\u0000$/.test(s0)){ closeList(); o.push('<pre style="background:var(--bg3);padding:10px;border-radius:5px;overflow-x:auto;font-size:12.5px">' + s0 + '</pre>'); continue; }
    if(/^####\s/.test(s0)){ closeList(); o.push('<h4 style="font-size:12.5px;color:var(--tx2);margin:10px 0 4px">' + inline(s0.slice(5)) + '</h4>'); continue; }
    if(/^###\s/.test(s0)){ closeList(); o.push('<h4>' + inline(s0.slice(4)) + '</h4>'); continue; }
    if(/^##\s/.test(s0)){ closeList(); o.push('<h4>' + inline(s0.slice(3)) + '</h4>'); continue; }
    if(/^#\s/.test(s0)){ closeList(); o.push('<h4>' + inline(s0.slice(2)) + '</h4>'); continue; }
    if(/^&gt;\s?/.test(s0)){ closeList(); o.push('<div class="note">' + inline(s0.replace(/^&gt;\s?/,'')) + '</div>'); continue; }
    if(/^[-*—]\s+/.test(s0)){ if(list !== 'ul'){ closeList(); o.push('<ul style="margin:4px 0 4px 20px">'); list='ul'; } o.push('<li>' + inline(s0.replace(/^[-*—]\s+/,'')) + '</li>'); continue; }
    if(/^\d+[.、]\s*/.test(s0)){ if(list !== 'ol'){ closeList(); o.push('<ol style="margin:4px 0 4px 20px">'); list='ol'; } o.push('<li>' + inline(s0.replace(/^\d+[.、]\s*/,'')) + '</li>'); continue; }
    if(/^\|.*\|$/.test(s0)){
      closeList();
      const cells = s0.slice(1,-1).split('|').map(c => c.trim());
      if(cells.every(c => /^:?-{2,}:?$/.test(c))){ continue; }
      o.push('<div class="seg">' + cells.map(inline).join(' <span style="color:var(--bd2)">│</span> ') + '</div>');
      continue;
    }
    closeList();
    o.push('<p style="margin:5px 0">' + inline(s0) + '</p>');
  }
  closeList();
  let html = o.join('');
  html = html.replace(/\u0000B(\d+)\u0000/g, (m, i) => blocks[+i]);
  return html;
}

/* ═══════════ 流式渲染节流（v4.11.0 · 防崩溃）═══════════
   原实现每个 token 都全文 md()+innerHTML，长文时 O(n²) 卡死。
   改为 120ms 节流 + 超长文本降级纯文本，结束再一次性渲染。 */
function makeStreamRenderer(el){
  let last = 0, pending = null, latest = '';
  el.style.whiteSpace = 'pre-wrap'; // 纯文本流式：保留换行
  const render = () => {
    pending = null;
    last = Date.now();
    // 纯文本 textContent：零 Markdown 解析、零 DOM 重建、零强制布局，
    // 火狐/Chrome 都扛得住长文与高频流式。结束后由调用方 md() 渲染。
    el.textContent = latest;
  };
  return (full) => {
    latest = full;
    const now = Date.now();
    if(now - last >= 150) render();
    else if(!pending) pending = setTimeout(render, 150);
  };
}

/* ═══════════ 次要区块折叠（v4.11.0 · 默认收起不占版面）═══════════
   逐条批注 / 注释建议 / 术语争议 / 待确认 → <details> 默认折叠，
   「一、修订后译文」始终主动显示。 */
function collapseSections(){
  const out = $('#out');
  if(!out) return;
  const collapsible = /(逐条批注|注释建议|术语与争议|争议点|待确认)/;
  const frag = document.createDocumentFragment();
  let details = null;
  const flush = () => { if(details){ frag.appendChild(details); details = null; } };
  [...out.childNodes].forEach(node => {
    if(node.nodeType === 1 && node.tagName === 'H4' && collapsible.test(node.textContent)){
      flush();
      details = document.createElement('details');
      details.className = 'sec-fold';
      const sum = document.createElement('summary');
      sum.textContent = node.textContent;
      details.appendChild(sum);
    } else if(details){
      details.appendChild(node);
    } else {
      frag.appendChild(node);
    }
  });
  flush();
  out.innerHTML = '';
  out.appendChild(frag);
}

/* ═══════════ 校对决策面板（v4.2.1）══════════
   解析校对/延伸输出里的"术语与争议点"词条 → 可点选译法 chips
   → 一键"应用决策并重新校对"（写入本次特别指令 + 自动重跑）═══ */
function parseDecisionPoints(text){
  const t = String(text || '');
  const pts = [];
  // 词条块：### 词条：XXX 或 **词条**：XXX，直到下一个 ### / **
  const entryRe = /(?:^|\n)#{2,4}\s*词条[：:]\s*([^\n]+)|(?:^|\n)\*\*词条[：:]\s*([^*\n]+)\*\*/g;
  let m;
  while((m = entryRe.exec(t)) !== null){
    const term = (m[1] || m[2] || '').trim();
    if(!term) continue;
    // 词条块正文：从匹配位置往后到下一个 "### 词条" 或 "## " 或文末
    const rest = t.slice(entryRe.lastIndex);
    const stop = rest.search(/\n(?:#{2,4}\s*词条|\*\*词条|#{1,2}\s)/);
    const block = stop > 0 ? rest.slice(0, stop) : rest;
    // 抓通行译法列表（在 **通行译法**： 之后）
    const cf = block.match(/\*\*?通行译法\*?\*?[：:]?\s*\n([\s\S]*?)(?=\n\*\*|\n#{2,4}|\n*$)/);
    const cands = [];
    if(cf){
      for(const line of cf[1].split('\n')){
        const lm = line.match(/^\s*[-*·]\s+(.+)/);
        if(!lm) continue;
        let c = lm[1].split(/[（(:：;]/)[0].trim().replace(/\*\*/g,'');
        if(c && c.length >= 1 && c.length <= 24 && !/^(译法|其一|其二)/.test(c)) cands.push(c);
      }
    }
    if(cands.length < 2) continue;
    // 模型推荐（默认选中）
    const rec = (block.match(/\*\*?本语境推荐\*?\*?[：:]\s*([^\n（(，,。;；]+)/) || [])[1];
    pts.push({ term, cands: [...new Set(cands)], rec: (rec||'').trim() });
  }
  return pts;
}
function renderDecisionPanel(text){
  const panel = $('#decision-panel');
  const pts = parseDecisionPoints(text);
  if(!pts.length){ panel.style.display = 'none'; return; }
  panel.style.display = '';
  panel.innerHTML =
    '<div class="dp-wrap">' +
      '<div class="dp-head"><span class="step-num">⚖</span>待定夺译法（' + pts.length + ' 组）— 点选你要的译法，然后一键应用重校对</div>' +
      pts.map((p, i) =>
        '<div class="dp-item" data-orig="' + esc(p.term) + '" data-idx="' + i + '">' +
          '<div class="dp-term"><span class="orig">' + esc(p.term) + '</span></div>' +
          '<div class="dp-chips">' +
            p.cands.map(c =>
              '<span class="dp-chip' + (c === p.rec ? ' rec' : '') + (c === p.rec ? ' sel' : '') + '" data-val="' + esc(c) + '">' + esc(c) + '</span>'
            ).join('') +
          '</div>' +
        '</div>'
      ).join('') +
      '<div class="dp-foot">' +
        '<button class="btn pri sm" id="dp-apply">▶ 应用所选并重新校对</button>' +
        '<button class="btn sm" id="dp-verify" title="AI 逐词核查当前选中的译法是否正确，坏译法标出并可一键换成建议值（v4.26.0）">🤖 核查选项</button>' +
        '<button class="btn sm" id="dp-importall" title="点选过的用点选译法，没点选的用推荐译法，全部写入术语库">📥 一键全部入术语库</button>' +
        '<label style="display:flex;gap:6px;align-items:center;font-size:12.5px;color:var(--tx2);cursor:pointer"><input type="checkbox" id="dp-tolib" checked style="width:auto">选中的同时入术语库</label>' +
        '<span class="dp-hint">未选的组保持现状不改动</span>' +
      '</div>' +
    '</div>';
  // chip 点选（单选语义，可再点取消）
  panel.querySelectorAll('.dp-chip').forEach(ch => ch.onclick = () => {
    const item = ch.closest('.dp-item');
    const was = ch.classList.contains('sel');
    item.querySelectorAll('.dp-chip').forEach(x => x.classList.remove('sel'));
    if(!was) ch.classList.add('sel');
    updateDpCount();
  });
  const updateDpCount = () => {
    const n = panel.querySelectorAll('.dp-chip.sel').length;
    $('#dp-apply').textContent = n ? '▶ 应用所选（' + n + ' 项）并重新校对' : '▶ 应用所选并重新校对';
  };
  updateDpCount();
  // P1 收录核查（v4.26.0）：逐词核查当前选中（或推荐）译法，坏译法可一键换成建议值
  $('#dp-verify').onclick = async () => {
    const items = pts.map((p, i) => {
      const item = panel.querySelectorAll('.dp-item')[i];
      const sel = item && item.querySelector('.dp-chip.sel');
      return { src: p.term, dst: sel ? sel.dataset.val : (p.rec || '') };
    }).filter(x => x.dst);
    if(!items.length){ toast('没有可核查的译法', 'w'); return; }
    const vs = await verifyEntries(items, $('#dp-verify'));
    if(!vs) return;
    showVerifyResults(items, vs, {
      note: '采用后该词自动换成建议译法并选中，再点「应用所选并重新校对」生效。',
      onAdopt: (k, v) => {
        if(!v.suggest) return false;
        const item = panel.querySelectorAll('.dp-item')[k];
        if(!item) return false;
        const holder = item.querySelector('.dp-chip') ? item.querySelector('.dp-chip').parentElement : item;
        const chip = document.createElement('span');
        chip.className = 'dp-chip sel'; chip.dataset.val = v.suggest; chip.textContent = v.suggest;
        item.querySelectorAll('.dp-chip').forEach(x => x.classList.remove('sel'));
        chip.onclick = () => {
          const was = chip.classList.contains('sel');
          item.querySelectorAll('.dp-chip').forEach(x => x.classList.remove('sel'));
          if(!was) chip.classList.add('sel');
        };
        holder.appendChild(chip);
        updateDpCount();
        toast('已换成建议译法：' + v.suggest);
        return true;
      }
    });
  };
  // 一键全部入术语库：点选过的用点选译法，未点选的用推荐译法
  $('#dp-importall').onclick = () => {
    const recMap = {}; pts.forEach(p => recMap[p.term] = p.rec || '');
    let added = 0, updated = 0;
    panel.querySelectorAll('.dp-item').forEach(item => {
      const orig = item.dataset.orig;
      const selChip = item.querySelector('.dp-chip.sel');
      const val = selChip ? selChip.dataset.val : recMap[orig];
      if(!val) return;
      const ex = TERMS.find(t => t.src.toLowerCase() === orig.toLowerCase());
      if(ex){ if(ex.dst !== val){ ex.dst = val; updated++; } }
      else { TERMS.push({ src: orig, dst: val, cat: '校对决策', note: '' }); added++; }
    });
    if(!added && !updated){ toast('没有可入库的词条', 'w'); return; }
    save(LS.terms, TERMS); renderTerms();
    toast('✓ 术语库：新增 ' + added + ' 条' + (updated ? '，更新 ' + updated + ' 条' : ''));
  };
  $('#dp-apply').onclick = () => {
    const picks = [...panel.querySelectorAll('.dp-item')].map(item => {
      const sel = item.querySelector('.dp-chip.sel');
      return sel ? { orig: item.dataset.orig, val: sel.dataset.val } : null;
    }).filter(Boolean);
    if(!picks.length){ toast('还没选择任何译法', 'w'); return; }
    // 1) 写入"本次特别指示"（保留已有内容）
    const inst = '【译者终审——以下译法按此统一，优先级最高】\n' + picks.map(p => '- ' + p.orig + ' → ' + p.val).join('\n');
    const cur = $('#extra').value.trim();
    $('#extra').value = cur ? cur + '\n\n' + inst : inst;
    // 2) 同时入术语库（若勾选）
    if($('#dp-tolib').checked){
      let added = 0;
      picks.forEach(p => {
        if(!TERMS.some(t => t.src.toLowerCase() === p.orig.toLowerCase())){
          TERMS.push({ src: p.orig, dst: p.val, cat: '校对决策', note: '' });
          added++;
        }
      });
      if(added){ save(LS.terms, TERMS); renderTerms(); toast('已入术语库 ' + added + ' 条'); }
    }
    panel.style.display = 'none';
    // 3) 自动重跑校对
    run();
  };
}

/* ═══════════ 导出 ═══════════ */
// 按 ## 标题把校对结果切成若干段，供选择性复制
function splitSections(md){
  const titles = [];
  const re = /^#{2,3}\s+[^\n]+/gm;
  let m;
  while((m = re.exec(md)) !== null){ titles.push({ title: m[0].replace(/^#{2,3}\s+/, '').trim(), pos: m.index }); }
  if(!titles.length) return [{ title: '全文', content: md.trim() }];
  return titles.map((t, i) => {
    const end = (i + 1 < titles.length) ? titles[i + 1].pos : md.length;
    return { title: t.title, content: md.slice(t.pos, end).trim() };
  });
}
function showCopyOptions(md){
  const sections = splitSections(md);
  const checks = sections.map((s, i) =>
    '<label style="display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-bottom:1px solid var(--bd);cursor:pointer;font-size:13px">' +
      '<input type="checkbox" class="copy-sec" data-i="' + i + '" checked style="width:auto;margin-top:3px">' +
      '<span><b>' + esc(s.title) + '</b> <span style="color:var(--tx3);font-size:11px">（' + s.content.length + ' 字）</span></span>' +
    '</label>'
  ).join('');
  modal('复制结果（勾选要复制的段落）', [
    '<div style="font-size:13px;color:var(--tx2);margin-bottom:10px">默认全选。取消勾选不需要的段落（如逐条批注、注释建议）即可只复制你想要的部分。</div>',
    '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap"><button class="btn sm gray" id="copy-all">全选</button><button class="btn sm gray" id="copy-none">全不选</button><button class="btn sm gray" id="copy-core">仅修订后译文</button></div>',
    '<div style="max-height:46vh;overflow:auto;border:1px solid var(--bd);border-radius:8px">' + checks + '</div>',
    '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" id="copy-do">📋 复制所选</button><button class="btn gray" id="copy-cancel">取消</button></div>'
  ].join(''));
  const box = i => document.querySelector('.copy-sec[data-i="' + i + '"]');
  $('#copy-cancel').onclick = closeModal;
  $('#copy-all').onclick = () => sections.forEach((s, i) => { box(i).checked = true; });
  $('#copy-none').onclick = () => sections.forEach((s, i) => { box(i).checked = false; });
  $('#copy-core').onclick = () => sections.forEach((s, i) => { box(i).checked = /修订后译文|终稿|定稿/.test(s.title); });
  $('#copy-do').onclick = async () => {
    const picked = sections.filter((s, i) => box(i).checked);
    if(!picked.length){ toast('请至少勾选一段', 'w'); return; }
    const text = picked.map(s => s.content).join('\n\n');
    try{ await navigator.clipboard.writeText(text); closeModal(); toast('已复制 ' + picked.length + ' 段（' + text.length + ' 字）'); }
    catch(e){ toast('复制失败，请手动选中文本', 'e'); }
  };
}
$('#btn-copy').onclick = () => {
  if(!LAST_OUT){ toast('还没有结果可复制'); return; }
  showCopyOptions(LAST_OUT);
};

/* ═══════════ v4.22.0 注释（脚注/尾注）：提取 → 翻译 → 按需贴入 ═══════════ */
const NOTE_SYS = '你是书籍译注翻译专家。输入是 JSON 数组：[{"i":0,"n":"1","t":"注释原文"}]。逐条把 t 翻译：原文以中文为主则译成英文，否则译成简体中文，输出 JSON 数组：[{"i":0,"tr":"注释译文"}]。要求：i 与数量原样对应，不增不减；译文忠实简洁，保持学术注释口吻；其中的 [n] 标号、页码引用（p.34）、人名、书名、引文指示词保留，书名套《》（外文书名可用引号）。只输出 JSON 数组本身，不要解释、不要代码围栏。';

/* 当前章节相关的注释：脚注按章节页码范围过滤，尾注按标号交集过滤。
   list 元素是 f.notes 的引用，翻译结果写回即保留在内存与任务快照里。 */
function currentNotes(){
  const f = __TP_FILES.src || __TP_FILES.dst;
  if(!f || !f.notes || !f.notes.length) return { f:f, list:[], marks:new Set() };
  const ch = (f._chapterIdx >= 0 && f.chapters && f.chapters[f._chapterIdx]) ? f.chapters[f._chapterIdx] : null;
  const text = ch ? ch.text : [$('#src').value, $('#dst').value, LAST_OUT, TS_LAST_OUT].filter(Boolean).join('\n');
  const marks = markersIn(text);
  const hasRange = !!(ch && ch.pageStart > 0 && ch.pageEnd >= ch.pageStart);
  const list = f.notes.filter(n => {
    if(hasRange && n.kind === 'foot') return n.page >= ch.pageStart && n.page <= ch.pageEnd;
    return marks.has(String(n.n));
  });
  return { f, list, marks };
}
function notesBlock(list, fmt){
  const rows = list.map(n => {
    const num = '[' + String(n.n) + ']';
    if(fmt === 'src') return num + ' ' + n.text;
    if(fmt === 'tr') return num + ' ' + (n.tr || n.text);
    return num + ' ' + (n.tr ? n.tr + (n.tr !== n.text ? '\n  原文：' + n.text : '') : n.text);
  });
  return '### 注释\n\n' + rows.join('\n\n');
}
/* 贴入结果末尾（先剥掉旧注释段防重复）。返回生成文本；无输出目标返回 ''。 */
function pasteNotes(list, fmt){
  if(!list || !list.length){ toast('没有可贴入的注释', 'w'); return ''; }
  const block = notesBlock(list, fmt);
  const strip = t => String(t || '').replace(/\n*\n?###\s*注释\s*\n[\s\S]*$/, '');
  if(LAST_OUT){ LAST_OUT = strip(LAST_OUT) + '\n\n' + block; $('#out').innerHTML = md(LAST_OUT); $('#outHint').textContent = '已贴入 ' + list.length + ' 条注释'; }
  else if(TS_LAST_OUT){ TS_LAST_OUT = strip(TS_LAST_OUT) + '\n\n' + block; $('#ts-out').innerHTML = md(TS_LAST_OUT); $('#ts-outHint').textContent = '已贴入 ' + list.length + ' 条注释'; }
  else { toast('先跑一次校对/翻译，再贴入注释', 'w'); return ''; }
  saveTask();
  return block;
}
function removePastedNotes(){
  const strip = t => String(t || '').replace(/\n*\n?###\s*注释\s*\n[\s\S]*$/, '');
  let ok = false;
  if(LAST_OUT && /###\s*注释\s*\n/.test(LAST_OUT)){ LAST_OUT = strip(LAST_OUT); $('#out').innerHTML = md(LAST_OUT); ok = true; }
  if(TS_LAST_OUT && /###\s*注释\s*\n/.test(TS_LAST_OUT)){ TS_LAST_OUT = strip(TS_LAST_OUT); $('#ts-out').innerHTML = md(TS_LAST_OUT); ok = true; }
  if(ok) saveTask();
  return ok;
}
function showNotesModal(){
  const { f, list, marks } = currentNotes();
  if(!f){ toast('先上传带注释的 PDF，再用本功能', 'w'); return; }
  if(!list.length){ toast('当前内容里没发现注释（标号或页底脚注区）', 'w'); return; }
  const rows = list.map((n, i) => {
    const on = marks.has(String(n.n)) ? ' checked' : '';
    return '<label style="display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-bottom:1px solid var(--bd);cursor:pointer;font-size:13px">' +
      '<input type="checkbox" class="fn-chk" data-i="' + i + '"' + on + ' style="width:auto;margin-top:3px">' +
      '<span style="flex:1;min-width:0"><b>[' + esc(String(n.n)) + ']</b> <span class="fn-tr" data-i="' + i + '" style="color:var(--ok)">' + esc(n.tr || '') + '</span>' +
      '<div style="color:var(--tx3);font-size:11px;margin-top:2px">' + esc(n.text.slice(0, 140)) + (n.text.length > 140 ? '…' : '') + ' · P' + n.page + (n.kind === 'end' ? ' · 尾注' : ' · 脚注') + '</div></span>' +
      '</label>';
  }).join('');
  modal('本章注释 · 共 ' + list.length + ' 条（勾选要贴入的）', [
    '<div style="font-size:13px;color:var(--tx2);margin-bottom:10px">按当前章节自动筛选（脚注按页码、尾注按标号）。先「翻译所选」，再选贴入格式追加到结果末尾。</div>',
    '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">' +
      '<button class="btn sm gray" id="fn-all">全选</button>' +
      '<button class="btn sm gray" id="fn-none">全不选</button>' +
      '<button class="btn sm pri" id="fn-tr">🌐 翻译所选</button>' +
      '<span style="font-size:12px;color:var(--tx3);margin-left:4px">贴入格式：</span>' +
      '<label style="font-size:12px"><input type="radio" name="fnfmt" value="both" checked> 译文+原文</label>' +
      '<label style="font-size:12px"><input type="radio" name="fnfmt" value="tr"> 仅译文</label>' +
      '<label style="font-size:12px"><input type="radio" name="fnfmt" value="src"> 仅原文</label>' +
    '</div>',
    '<div style="max-height:46vh;overflow:auto;border:1px solid var(--bd);border-radius:8px">' + rows + '</div>',
    '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" id="fn-paste">📋 贴入结果末尾</button><button class="btn gray" id="fn-unpaste">移除已贴注释</button><button class="btn gray" id="fn-cancel">关闭</button></div>'
  ].join(''));
  const box = i => document.querySelector('.fn-chk[data-i="' + i + '"]');
  $('#fn-cancel').onclick = closeModal;
  $('#fn-all').onclick = () => list.forEach((n, i) => { box(i).checked = true; });
  $('#fn-none').onclick = () => list.forEach((n, i) => { box(i).checked = false; });
  $('#fn-tr').onclick = async () => {
    const picked = list.filter((n, i) => box(i).checked);
    if(!picked.length){ toast('请至少勾选一条再翻译', 'w'); return; }
    const pending = picked.filter(n => !n.tr);
    if(!pending.length){ toast('所选注释都已有译文'); return; }
    const b = $('#fn-tr'); b.disabled = true; b.textContent = '翻译中…';
    try{
      const payload = pending.map((n, i) => ({ i:i, n:String(n.n), t:n.text }));
      const r = await callModel(NOTE_SYS, JSON.stringify(payload), null, 'gloss');
      const arr = extractJsonArray(r.text || '');
      let hit = 0;
      arr.forEach(o => { const p = pending[o.i]; if(p && o.tr){ p.tr = String(o.tr); hit++; } });
      pending.forEach(n => { const el = document.querySelector('.fn-tr[data-i="' + list.indexOf(n) + '"]'); if(el) el.textContent = n.tr || ''; });
      toast(hit ? ('已翻译 ' + hit + '/' + pending.length + ' 条') : '翻译未返回有效 JSON，可重试', hit ? '' : 'e');
    }catch(e){ toast('翻译失败：' + errMsg(e), 'e'); }
    finally{ b.disabled = false; b.textContent = '🌐 翻译所选'; }
  };
  $('#fn-paste').onclick = () => {
    const picked = list.filter((n, i) => box(i).checked);
    if(!picked.length){ toast('请至少勾选一条', 'w'); return; }
    const fmt = (document.querySelector('input[name="fnfmt"]:checked') || {}).value || 'both';
    const block = pasteNotes(picked, fmt);
    if(block){ closeModal(); toast('已贴入 ' + picked.length + ' 条注释'); }
  };
  $('#fn-unpaste').onclick = () => { removePastedNotes() ? toast('已移除贴入的注释段') : toast('结果里没有已贴入的注释段', 'w'); };
}
$('#btn-notes').onclick = showNotesModal;

/* ═══════════ 术语一致性自动体检（v4.8.0 · 本地零成本）═══════════
   借鉴 translate5 的 QA check / OpenTranslator 的 Validator：
   ① 术语库覆盖：原文中出现的术语，定稿是否用了术语库锁定译法；
   ② 一词多译：扫描定稿中「中文（外文）/ 外文（中文）」标注，
      揪出同一个外文词被译成多种中文的情况。
   纯本地字符串比对，不调用 AI，不花 token。 */
function termAudit(text, srcText){
  const t = String(text || '');
  const s = String(srcText || '').toLowerCase();
  const used = [], conflict = [], multi = [];
  TERMS.forEach(term => {
    const src = (term.src || '').trim(), dst = (term.dst || '').trim();
    if(!dst) return;
    if(t.indexOf(dst) >= 0){ used.push(term); return; }          // 已按术语库统一
    const inSrc = src && s && s.indexOf(src.toLowerCase()) >= 0;
    if(inSrc) conflict.push(term);                                // 原文用了、定稿没用术语库译法
  });
  // 一词多译：抓「中文（外文）」与「外文（中文）」对照
  const zh = '[\\u4e00-\\u9fff][\\u4e00-\\u9fff·]{0,11}';
  const en = '[A-Za-z][A-Za-z0-9\\u2019\'’\\-· ]{0,40}';
  const map = {};
  const collect = (re, ei, zi) => {
    let m;
    while((m = re.exec(t)) !== null){
      const w = m[ei].trim().replace(/[\s·]+/g,'').toLowerCase();
      const c = m[zi].trim();
      if(!w || w.length < 2 || !c) continue;
      (map[w] = map[w] || { word: m[ei].trim(), cn: new Set() }).cn.add(c);
    }
  };
  collect(new RegExp('(' + zh + ')[（(]\\s*(' + en + ')\\s*[)）]', 'g'), 2, 1);
  collect(new RegExp('(' + en + ')[（(]\\s*(' + zh + ')\\s*[)）]', 'g'), 1, 2);
  Object.values(map).forEach(v => { if(v.cn.size >= 2) multi.push({ word: v.word, cn: [...v.cn] }); });
  return { used, conflict, multi, termTotal: TERMS.length };
}

function showTermAudit(){
  const text = extractProofText(LAST_OUT) || $('#dst').value.trim();
  if(!text){ toast('请先校对，或粘贴待校对译文，再做术语体检', 'e'); return; }
  const r = termAudit(text, $('#src').value);
  const nConflict = r.conflict.length, nMulti = r.multi.length;
  const clean = !nConflict && !nMulti;
  const parts = [];
  parts.push('<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--tx2);margin-bottom:14px">' +
    '<span>术语库 <b>' + r.termTotal + '</b> 条</span>' +
    '<span>已统一使用 <b style="color:var(--ok)">' + r.used.length + '</b></span>' +
    '<span>疑似未统一 <b style="color:var(--err)">' + nConflict + '</b></span>' +
    '<span>一词多译 <b style="color:var(--err)">' + nMulti + '</b></span></div>');
  if(clean){
    parts.push('<div class="alert ok">✓ 未发现术语不一致：定稿中出现的术语均已按术语库统一，且未发现同一外文词有多种译法。</div>');
  }else{
    if(nConflict){
      parts.push('<h4 style="margin:12px 0 6px;color:var(--err)">⚠ 疑似未按术语库统一</h4>');
      parts.push('<div style="font-size:12px;color:var(--tx3);margin-bottom:6px">原文中出现了下列术语，但定稿里没用到术语库锁定译法，请人工确认是否用了其他译法。</div>');
      parts.push(r.conflict.map(t => '<div class="seg" style="font-size:13px">' + esc(t.src) + ' → 术语库译法 <b>' + esc(t.dst) + '</b></div>').join(''));
    }
    if(nMulti){
      parts.push('<h4 style="margin:12px 0 6px;color:var(--err)">⚠ 同一外文词多种译法（点选一个作为正名）</h4>');
      parts.push(r.multi.map((v,i) =>
        '<div class="seg" data-audit-idx="' + i + '" style="font-size:13px">' +
          '<div style="margin-bottom:4px"><b>' + esc(v.word) + '</b></div>' +
          '<div class="audit-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px">' +
            v.cn.map((c,j) => '<span class="dp-chip' + (j===0?' sel':'') + '" data-val="' + esc(c) + '">' + esc(c) + '</span>').join('') +
          '</div>' +
        '</div>').join(''));
    }
  }
  parts.push('<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;align-items:center">' +
    (nConflict ? '<button class="btn pri sm" id="audit-unify">⚡ 一键按术语库统一并重校</button>' : '') +
    (nMulti ? '<button class="btn pri sm" id="audit-import">📥 把选定译法入术语库</button>' : '') +
    '<button class="btn gray sm" id="audit-close">关闭</button>' +
    '<span style="font-size:12px;color:var(--tx3)">本地比对 · 不调 AI · 不花 token</span></div>');
  modal('🩺 术语一致性体检', parts.join(''));
  $('#audit-close').onclick = closeModal;
  if(nConflict){
    $('#audit-unify').onclick = () => {
      const inst = '【术语统一——以下术语强制按术语库译法，优先级最高】\n' +
        r.conflict.map(t => '- ' + t.src + ' → ' + t.dst).join('\n');
      const cur = $('#extra').value.trim();
      $('#extra').value = cur ? cur + '\n\n' + inst : inst;
      closeModal();
      toast('已写入统一指令，正在重新校对…');
      run();
    };
  }
  if(nMulti){
    document.querySelectorAll('.audit-chips').forEach(wrap => {
      wrap.querySelectorAll('.dp-chip').forEach(ch => ch.onclick = () => {
        wrap.querySelectorAll('.dp-chip').forEach(x => x.classList.remove('sel'));
        ch.classList.add('sel');
      });
    });
    $('#audit-import').onclick = () => {
      let added = 0;
      r.multi.forEach((v,i) => {
        const item = document.querySelector('[data-audit-idx="' + i + '"]');
        const sel = item.querySelector('.dp-chip.sel');
        const val = sel ? sel.dataset.val : v.cn[0];
        if(!TERMS.some(t => t.src.toLowerCase() === v.word.toLowerCase())){
          TERMS.push({ src: v.word, dst: val, cat: '术语体检', note: '' });
          added++;
        }
      });
      if(!added){ toast('这些词已在术语库中', 'w'); closeModal(); return; }
      save(LS.terms, TERMS); renderTerms();
      toast('✓ 已把 ' + added + ' 个多译词条按选定译法入术语库');
      closeModal();
    };
  }
}

/* ═══════════ 智能配图助手（v4.4 关键词标签 · 图片来源待接）═══════════ */
function parseImageTags(text){
  let s = String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
  const m = s.match(/\{[\s\S]*\}/);
  if(m) s = m[0];
  try{
    const j = JSON.parse(s);
    const tags = Array.isArray(j.tags) ? j.tags : [];
    return tags.map(t => ({ zh: (t.zh||t.cn||'').trim(), en: (t.en||t.english||'').trim() })).filter(t => t.zh || t.en);
  }catch(e){
    return String(text||'').split(/[\n,，、]/).map(x=>x.trim()).filter(x=>x && x.length<=24).slice(0,12).map(x=>({zh:x,en:''}));
  }
}
async function extractImageTags(text){
  const sys = '你是一位内容分析助手。请从下面的文本中提取适合用于图片检索的关键词/主题。要求：① 5-12 个；② 覆盖核心主题、关键概念、专名、意象、场景等；③ 具体、可检索（适合作为图片搜索词）；④ 中英文对照。输出严格按 JSON：{"tags":[{"zh":"中文","en":"English"}]}。只输出 JSON，不解释。';
  const user = '【文本】\n' + String(text||'').slice(0, 4000);
  const r = await callModelSimple(sys, user, 1200);
  return parseImageTags(r.text);
}
async function openImageAssistant(text){
  if(!text || !text.trim()){ toast('还没有内容可提取关键词', 'e'); return; }
  modal('🔍 智能配图助手', '<div style="font-size:13px;color:var(--tx2)">⏳ AI 正在分析文本、提取关键词…</div>');
  try{
    const tags = await extractImageTags(text);
    showImageTags(tags);
  }catch(e){
    modal('🔍 智能配图助手', ['<div class="alert e">提取失败：' + esc(e.message) + '</div>','<div style="margin-top:12px"><button class="btn gray" id="img-cancel-err">关闭</button></div>'].join(''));
    $('#img-cancel-err').onclick = closeModal;
  }
}
function showImageTags(tags){
  const chips = tags.map((t, i) => {
    const label = (t.zh && t.en) ? (t.zh + ' / ' + t.en) : (t.zh || t.en);
    return '<span class="img-tag" data-zh="' + esc(t.zh) + '" data-en="' + esc(t.en) + '">' + esc(label) + '</span>';
  }).join('');
  modal('🔍 智能配图助手', [
    '<div style="font-size:13px;color:var(--tx2);margin-bottom:10px">AI 已提取 <b>' + tags.length + '</b> 个关键词。点击标签勾选要用于配图检索的词（可多选）。</div>',
    '<div id="img-tags-wrap" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">' + chips + '</div>',
    '<div style="margin-top:12px"><label class="f">手动补充关键词（用逗号分隔，可选）</label><input id="img-tag-add" placeholder="例如：古希腊、大理石雕像、雨夜街头"></div>',
    '<div style="font-size:12px;color:var(--tx3);margin-top:10px">已选 <b id="img-tag-count">0</b> 个关键词</div>',
    '<div style="display:flex;gap:8px;margin-top:12px;align-items:center;flex-wrap:wrap"><span style="font-size:11px;color:var(--tx3)">一键跳转搜索：</span><button class="btn sm" id="img-baidu">🔍 百度图片</button><button class="btn sm" id="img-bing">🔍 必应图片</button><button class="btn sm" id="img-pixabay">🔍 Pixabay</button><button class="btn gray" id="img-cancel">关闭</button></div>'
  ].join(''));
  const update = () => {
    const n = document.querySelectorAll('#img-tags-wrap .img-tag.on').length;
    $('#img-tag-count').textContent = n;
  };
  // 一键跳转搜索：勾选词 → 新标签页打开搜索引擎/图库
  const searchProvider = (p) => {
    const tags = [...document.querySelectorAll('#img-tags-wrap .img-tag.on')];
    if(!tags.length){ toast('请先勾选关键词', 'w'); return; }
    const words = tags.map(ch => (p === 'pixabay' ? (ch.dataset.en || ch.dataset.zh) : (ch.dataset.zh || ch.dataset.en))).filter(Boolean).slice(0, 3);
    if(!words.length){ toast('所选关键词缺少可用文字', 'w'); return; }
    const kw = words.join(' ');
    const urls = {
      baidu: 'https://image.baidu.com/search/index?tn=baiduimage&word=' + encodeURIComponent(kw),
      bing: 'https://www.bing.com/images/search?q=' + encodeURIComponent(kw),
      pixabay: 'https://pixabay.com/zh/images/search/' + encodeURIComponent(words.join(' ')) + '/',
    };
    window.open(urls[p], '_blank');
  };
  document.querySelectorAll('#img-tags-wrap .img-tag').forEach(ch => {
    ch.onclick = () => { ch.classList.toggle('on'); update(); };
  });
  $('#img-tag-add').onchange = () => {
    const v = $('#img-tag-add').value.trim();
    if(!v) return;
    v.split(/[,，、]/).map(s=>s.trim()).filter(Boolean).forEach(s => {
      const span = document.createElement('span');
      span.className = 'img-tag on'; span.textContent = s;
      span.dataset.zh = s;
      span.onclick = () => { span.classList.toggle('on'); update(); };
      $('#img-tags-wrap').appendChild(span);
    });
    $('#img-tag-add').value = '';
    update();
  };
  $('#img-cancel').onclick = closeModal;
  $('#img-baidu').onclick = () => searchProvider('baidu');
  $('#img-bing').onclick = () => searchProvider('bing');
  $('#img-pixabay').onclick = () => searchProvider('pixabay');
  update();
}

$('#btn-md').onclick = () => {
  if(!LAST_OUT){ toast('还没有结果可导出'); return; }
  dl('校对结果_' + today() + '.md', LAST_OUT, 'text/markdown');
};
// 智能配图助手入口
$('#btn-img').onclick = () => {
  if(!LAST_OUT){ toast('先跑一次校对，再提取配图关键词'); return; }
  openImageAssistant(extractProofText(LAST_OUT) || LAST_OUT);
};
// 术语一致性体检入口（本地零成本）
$('#btn-audit').onclick = () => showTermAudit();

/* ═══════════ 改动对照视图（v4.12.0 · P1 · 零 token）═══════════
   把「二、逐条批注」的每一条 [类型] 原文 → 改为「新译」：理由
   解析成可视化对照表：红色删除线 = 原译，绿色高亮 = 修订，逐条可复制。 */
function parseEdits(text){
  const t = String(text || '');
  const edits = [];
  let inAnn = false;
  for(const raw of t.split('\n')){
    if(/^#{2,3}\s*.*逐条批注/.test(raw)){ inAnn = true; continue; }
    if(inAnn && /^#{1,3}\s*/.test(raw) && !/逐条批注/.test(raw)){ break; } // 离开批注区
    if(!inAnn) continue;
    const s = raw.trim();
    if(!/^[-*·]\s*/.test(s)) continue;
    const body = s.replace(/^[-*·]\s*/, '');
    const tm = body.match(/^[\[【]([^\]】]{2,8})[\]】]\s*([\s\S]*)$/);
    if(!tm) continue;
    const type = tm[1].trim();
    let rest = tm[2];
    const arrow = rest.indexOf('→');
    if(arrow < 0) continue;
    let left = rest.slice(0, arrow).replace(/[*`]/g, '').trim();
    let right = rest.slice(arrow + 1).trim().replace(/^改为\s*/, '');
    let newTxt = '', reason = '';
    const qm = right.match(/[「『"']([^」』"']*)[」』"']\s*[：:]?\s*([\s\S]*)$/);
    if(qm){ newTxt = qm[1].trim(); reason = qm[2].trim(); }
    else{
      const ci = right.indexOf('：');
      if(ci >= 0){ newTxt = right.slice(0, ci).trim(); reason = right.slice(ci + 1).trim(); }
      else newTxt = right.trim();
    }
    if(left && newTxt) edits.push({ type, from: left, to: newTxt, reason: reason.replace(/[：:]\s*$/, '') });
  }
  return edits;
}
function showEditDiff(){
  const edits = parseEdits(LAST_OUT);
  if(!edits.length){ toast('没解析到改动条目。批注需含「原文 → 改为「新译」」格式', 'w'); return; }
  const rows = edits.map((e, i) =>
    '<div class="diff-row">' +
      '<span class="diff-type">' + esc(e.type) + '</span>' +
      '<span class="diff-from">' + esc(e.from) + '</span>' +
      '<span class="diff-arrow">→</span>' +
      '<span class="diff-to">' + esc(e.to) + '</span>' +
      '<button class="btn x diff-copy" data-i="' + i + '" title="复制修订结果">⧉</button>' +
      (e.reason ? '<div class="diff-reason">' + esc(e.reason) + '</div>' : '') +
    '</div>'
  ).join('');
  modal('改动对照（' + edits.length + ' 处）', [
    '<div style="font-size:12px;color:var(--tx3);margin-bottom:10px">红色删除线 = 原译，绿色高亮 = 修订。点 ⧉ 复制修订结果，可直接粘贴进文档。</div>',
    '<div style="max-height:58vh;overflow:auto;border:1px solid var(--bd);border-radius:8px">' + rows + '</div>',
    '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn sm" id="diff-copyall">📋 复制全部修订清单</button><button class="btn gray sm" id="diff-close">关闭</button></div>'
  ].join(''));
  $('#diff-close').onclick = closeModal;
  document.querySelectorAll('.diff-copy').forEach(b => b.onclick = () => {
    const e = edits[+b.dataset.i];
    navigator.clipboard.writeText(e.to).then(() => toast('已复制：' + e.to)).catch(() => toast('复制失败，请手动选中', 'e'));
  });
  $('#diff-copyall').onclick = () => {
    const txt = edits.map((e, i) => (i + 1) + '. ' + e.from + ' → ' + e.to).join('\n');
    navigator.clipboard.writeText(txt).then(() => toast('已复制 ' + edits.length + ' 条修订清单')).catch(() => toast('复制失败', 'e'));
  };
}
$('#btn-diff').onclick = () => {
  if(!LAST_OUT){ toast('先跑一次校对，再看改动对照'); return; }
  showEditDiff();
};
$('#ts-btn-img').onclick = () => {
  const t = extractTransText(TS_LAST_OUT) || $('#ts-src').value.trim();
  if(!t){ toast('先翻译，或输入原文，再提取配图关键词'); return; }
  openImageAssistant(t);
};
$('#btn-wx').onclick = () => {
  if(!LAST_OUT){ toast('还没有结果可导出'); return; }
  const html = wxHtml(LAST_OUT);
  copyRich(html);
  modal('公众号格式已生成', [
    '<p>已把校对结果转换为公众号编辑器兼容的富文本，并<b>复制到剪贴板</b>。现在直接到公众号编辑器里 <kbd>Ctrl</kbd>+<kbd>V</kbd> 粘贴即可，标题、加粗、列表、引用会保留。</p>',
    '<p style="color:var(--tx3);font-size:12px">注意事项：微信编辑器对表格支持有限，表格内容已转为段落形式；如需插图请在粘贴后手动添加。粘贴后建议用「清除格式」再套用一次公众号模板以保证字号统一。</p>',
    '<h3>效果预览</h3>',
    '<div style="background:#fff;color:#333;padding:20px;border-radius:6px;max-height:340px;overflow-y:auto;font-size:14px;line-height:1.8">' + html + '</div>'
  ].join(''));
};
function wxHtml(mdText){
  const body = md(mdText)
    .replace(/style="[^"]*"/g,'')
    .replace(/<h4>/g, '<h4 style="font-size:16px;font-weight:600;margin:22px 0 10px;padding-bottom:6px;border-bottom:1px solid #e5e5e5;color:#222">')
    .replace(/<p>/g, '<p style="margin:12px 0;line-height:1.8;color:#333;font-size:15px">')
    .replace(/<div class="seg">/g, '<p style="margin:12px 0;line-height:1.8;color:#333;font-size:15px">')
    .replace(/<div class="note">/g, '<blockquote style="margin:14px 0;padding:8px 14px;border-left:3px solid #d0d0d0;color:#666;font-size:14px">')
    .replace(/<ul[^>]*>/g, '<ul style="margin:12px 0;padding-left:22px;color:#333;font-size:15px">')
    .replace(/<ol[^>]*>/g, '<ol style="margin:12px 0;padding-left:22px;color:#333;font-size:15px">')
    .replace(/<li>/g, '<li style="margin:6px 0;line-height:1.8">')
    .replace(/<strong>/g, '<strong style="font-weight:600;color:#111">')
    .replace(/<code>/g, '<code style="background:#f5f5f5;padding:1px 5px;border-radius:3px;font-size:14px;color:#c7254e">');
  return '<section style="font-family:\'IBM Plex Serif\',Georgia,\'Source Han Serif SC\',\'Noto Serif SC\',\'Songti SC\',SimSun,serif;font-size:16px;line-height:1.8;letter-spacing:.02em;color:#333">' + body + '</section>';
}
function copyRich(html){
  try{
    const div = document.createElement('div');
    div.contentEditable = 'true';
    div.style.cssText = 'position:fixed;left:-9999px;top:0';
    div.innerHTML = html;
    document.body.appendChild(div);
    const r = document.createRange(); r.selectNodeContents(div);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.execCommand('copy');
    s.removeAllRanges();
    div.remove();
  }catch(e){ toast('富文本复制失败，可改用「导出 Markdown」', 'e'); }
}

/* ═══════════ 历史与弹层 ═══════════ */
function pushHistory(user, out, ext){
  let h = load(LS.history, []);
  h.unshift({ t:Date.now(), title:(user.replace(/^【[^】]*】\s*/,'').slice(0,40)||'未命名'), ext, out });
  if(h.length > 20) h = h.slice(0,20);
  save(LS.history, h);
}
function modal(title, html){
  $('#mTitle').textContent = title;
  $('#mBody').innerHTML = html;
  $('#modal').classList.add('on');
}
function closeModal(){ $('#modal').classList.remove('on'); }
$('#mClose').onclick = () => $('#modal').classList.remove('on');
$('#modal').onclick = e => { if(e.target.id === 'modal') $('#modal').classList.remove('on'); };

/* ═══════════ P1 收录正确性核查（v4.26.0 · AI 查询审核）═══════════
   三问题之一：自动收录会把错误选项也拾取入库。此模块给三处入口
   （术语库行 / 词库行 / 决策面板），AI 判 正确/存疑/错误 + 给建议译法，
   采纳与否由你拍板——AI 只报告不动手。判定依据来源：(待补充：判定依据来源) */
const VERIFY_SYS = '你是术语收录核查员。给定一组「原文词 → 已收录译法」，逐条判定这条收录是否正确。' +
  '判定标准：译法是否为该词在此类别/语境下通行、准确的中文对应；宁可存疑，不硬判；绝不编造出处。' +
  '只输出 JSON 数组，每项：{"i":序号,"verdict":"ok|doubt|bad","reason":"≤40字依据","suggest":"更通行的译法，没有就空字符串","conf":"high|mid|low"}。';
async function verifyEntries(items, btn){
  if(!CFG.apiKey){ toast('先去「设置」填好模型 Key 再核查', 'w'); return null; }
  const old = btn ? btn.innerHTML : '';
  if(btn) btn.innerHTML = '<span class="spin"></span>核查中…';
  try{
    const user = '【待核查收录】\n' + items.map((x, i) =>
      '[' + i + '] ' + (x.src || '—') + ' → ' + (x.dst || '—') + (x.extra ? '（' + x.extra + '）' : '')).join('\n');
    const r = await callModelSimple(VERIFY_SYS, user, 1400);
    const arr = extractJsonArray(r && r.text ? r.text : '');
    if(!arr.length){ toast('模型没返回结构化结果，稍后再试', 'w'); return null; }
    return arr;
  }catch(e){ toast('核查失败：' + errMsg(e), 'w'); return null; }
  finally{ if(btn) btn.innerHTML = old; }
}
function showVerifyResults(items, verdicts, opts){
  const VMAP = { ok:{cls:'ok',t:'✓ 正确'}, doubt:{cls:'doubt',t:'? 存疑'}, bad:{cls:'bad',t:'✗ 错误'} };
  const rows = items.map((it, i) => {
    const v = verdicts.find(x => +x.i === i) || {};
    const m = VMAP[v.verdict] || { cls:'doubt', t:'? 未判定' };
    const sug = String(v.suggest || '').trim();
    return '<div class="vf-row" data-i="' + i + '">' +
      '<span class="vf-badge ' + m.cls + '">' + m.t + '</span>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:13px"><b>' + esc(it.src || '—') + '</b> → ' + esc(it.dst || '—') + '</div>' +
        '<div style="font-size:12.5px;color:var(--tx2);margin-top:2px">' + esc(v.reason || '（模型没给依据）') + '</div>' +
        (sug && v.verdict !== 'ok' ? '<div style="font-size:12.5px;margin-top:2px">建议改为：<b style="color:var(--ac)">' + esc(sug) + '</b>' +
          ((opts && opts.onAdopt) ? ' <button class="btn sm" data-adopt style="vertical-align:middle">✓ 采用</button>' : '') + '</div>' : '') +
      '</div>' +
      '<span style="font-size:11px;color:var(--tx3)">置信 ' + esc(v.conf || '?') + '</span>' +
    '</div>';
  }).join('');
  modal('🤖 收录核查结果',
    '<div style="font-size:12.5px;color:var(--tx2);margin-bottom:6px">AI 判定仅供参考，采纳前自己再过目一眼。' + (opts && opts.note ? esc(opts.note) : '') + '</div>' + rows);
  if(opts && opts.onAdopt){
    $$('#mBody [data-adopt]').forEach(b => b.onclick = () => {
      const i = +b.closest('.vf-row').dataset.i;
      const v = verdicts.find(x => +x.i === i) || {};
      if(!opts.onAdopt(i, v)) return;
      b.textContent = '✓ 已采用'; b.disabled = true;
    });
  }
}

/* ═══════════ P2+P3 批注「已修/未修」流转 + 译文标红内联修正（v4.26.0）═══════════
   三问题之二/三：误译提醒只报告不闭环 →
   P2：每条批注带「标记已修」按钮，状态随任务持久化，筛选条出现「未修 N」与「已修 x/N」；
   P3：批注里的「改为『新译』」定位到修订后译文段标红，点击直接改，改完自动写回结果并标已修。 */
function auditParseLi(li){
  const txt = (li.textContent || '').replace(/\s+/g, ' ').trim();
  const m = txt.match(/^\s*[\[【]([^\]】]{2,8})[\]】]\s*(.*)$/);
  const type = m && ERR_TYPES.includes(m[1].trim()) ? m[1].trim() : (li.dataset.err || '');
  const body = m ? m[2] : txt;
  const fm = body.match(/\*\*([^*]+?)\*\*\s*→/) || body.match(/^(.+?)\s*→/);
  const xm = body.match(/改为\s*[「"'](.+?)[」"']/);
  const frag = ((fm && fm[1]) || '').trim();
  const fix = ((xm && xm[1]) || '').trim();
  return { type: type, frag: frag, fix: fix, fp: type + '|' + frag + '|' + fix };
}
function renderAuditControls(){
  const out = $('#out'); if(!out) return;
  out.querySelectorAll('li[data-err]').forEach(li => {
    if(!li.dataset.err) return;
    const a = auditParseLi(li);
    if(!a.fp || a.fp === '|' || a.fp === '||') return;
    li.dataset.fp = a.fp;
    let btn = li.querySelector('.ef-fix-btn');
    if(!btn){
      btn = document.createElement('button');
      btn.className = 'ef-fix-btn';
      btn.type = 'button';
      li.appendChild(btn);
    }
    const done = !!AUDIT_FIX[a.fp];
    btn.textContent = done ? '✓ 已修' : '标记已修';
    btn.classList.toggle('on', done);
    li.classList.toggle('ef-done', done);
    btn.onclick = (ev) => { ev.stopPropagation(); toggleAuditFix(a.fp, li, btn); };
  });
  updateFixProgress();
}
function toggleAuditFix(fp, li, btn){
  if(AUDIT_FIX[fp]) delete AUDIT_FIX[fp]; else AUDIT_FIX[fp] = 1;
  const done = !!AUDIT_FIX[fp];
  btn.textContent = done ? '✓ 已修' : '标记已修';
  btn.classList.toggle('on', done);
  li.classList.toggle('ef-done', done);
  saveTask();
  updateFixProgress();
}
function updateFixProgress(){
  const seg = $('#err-filter'); if(!seg) return;
  const lis = [...document.querySelectorAll('#out li[data-fp]')].filter(li => li.dataset.err);
  const done = lis.filter(li => AUDIT_FIX[li.dataset.fp]).length;
  let p = seg.querySelector('.ef-progress');
  if(!lis.length){ if(p) p.remove(); const c = seg.querySelector('[data-ef="unfixed"]'); if(c) c.remove(); return; }
  if(!p){ p = document.createElement('span'); p.className = 'ef-progress'; seg.appendChild(p); }
  p.textContent = '已修 ' + done + '/' + lis.length;
  const chip = seg.querySelector('[data-ef="unfixed"]');
  if(chip) chip.textContent = '未修 ' + (lis.length - done);
}
function paintErrFixSpans(){
  const out = $('#out'); if(!out) return;
  // 1) 清旧痕（把 span 还原成文本节点，内容原样）
  out.querySelectorAll('.err-fix').forEach(s => {
    s.replaceWith(document.createTextNode(s.textContent));
  });
  // 2) 定位「修订后译文」区间（md() 把所有标题渲染为 h4）
  const h4s = [...out.children].filter(n => n.tagName === 'H4');
  const start = h4s.find(h => /(修订后译文|修订稿|终稿|定稿)/.test(h.textContent));
  if(!start) return;
  const nodes = [];
  let el = start.nextElementSibling;
  while(el && el.tagName !== 'H4'){ nodes.push(el); el = el.nextElementSibling; }
  if(!nodes.length) return;
  // 3) 每条带「改为『新译』」的批注 → 在区间里定位并标红（只包第一处）
  const seen = {};
  out.querySelectorAll('li[data-err]').forEach(li => {
    if(!li.dataset.err) return;
    const a = auditParseLi(li);
    if(!a.fix || a.fix.length < 2) return;
    if(seen[a.fp]) return;
    seen[a.fp] = 1;
    wrapFixSpan(nodes, a.fix, a.fp, a.frag);
  });
}
function wrapFixSpan(nodes, text, fp, frag){
  const cands = [text, text.slice(0, 16)].filter(x => x && x.length >= 2);
  for(const root of nodes){
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while((n = walker.nextNode())){
      for(const c of cands){
        const i = n.nodeValue.indexOf(c);
        if(i >= 0){
          const after = n.splitText(i);
          after.splitText(c.length);
          const span = document.createElement('span');
          span.className = 'err-fix';
          span.dataset.fp = fp;
          span.dataset.frag = frag || '';
          span.textContent = c;
          span.title = 'AI 建议的新译：点击可直接修改';
          after.parentNode.insertBefore(span, after);
          after.remove();
          return true;
        }
      }
    }
  }
  return false;
}
function applyProofEdit(fp, oldTxt, newTxt){
  if(!newTxt){ toast('译文不能为空，已还原', 'w'); paintErrFixSpans(); return; }
  // 在 LAST_OUT 的「修订后译文」段里替换第一处旧译
  const re = /(?:^|\n)(#{1,4}\s*[^\n]*(?:修订后译文|修订稿|终稿|定稿)[^\n]*\n)([\s\S]*?)(?=\n#{1,4}\s|$)/;
  const m = LAST_OUT.match(re);
  let ok = false;
  if(m && m[0].indexOf(oldTxt) >= 0){
    LAST_OUT = LAST_OUT.slice(0, m.index) + m[0].replace(oldTxt, newTxt) + LAST_OUT.slice(m.index + m[0].length);
    ok = true;
  }
  if(!ok) toast('结果文本里没找到原句，已按显示更新（重跑校对会以模型输出为准）', 'w');
  AUDIT_FIX[fp] = 1;
  saveTask();
  const out = $('#out');
  out.innerHTML = md(LAST_OUT);
  collapseSections();
  renderDecisionPanel(LAST_OUT);
  markErrorLines();
  renderAuditControls();
  renderErrorFilter(LAST_OUT);
  renderPostBar();
  paintErrFixSpans();
  toast('已修正 ✓ 该条批注自动标为「已修」');
}
(function bindErrFixEdit(){
  const out = $('#out');
  if(!out) return;
  out.addEventListener('click', e => {
    const sp = e.target.closest('.err-fix');
    if(!sp || sp.classList.contains('editing')) return;
    sp.classList.add('editing');
    sp.dataset.orig = sp.textContent;
    sp.contentEditable = 'plaintext-only';
    sp.focus();
    const r = document.createRange(); r.selectNodeContents(sp);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  out.addEventListener('keydown', e => {
    const sp = e.target.closest && e.target.closest('.err-fix.editing');
    if(!sp) return;
    if(e.key === 'Enter'){ e.preventDefault(); sp.blur(); }
    if(e.key === 'Escape'){ sp.dataset.cancel = '1'; sp.blur(); }
  });
  out.addEventListener('focusout', e => {
    const sp = e.target.closest && e.target.closest('.err-fix.editing');
    if(!sp) return;
    sp.classList.remove('editing');
    sp.contentEditable = 'false';
    const cancel = sp.dataset.cancel === '1';
    delete sp.dataset.cancel;
    const orig = sp.dataset.orig || '';
    const nv = (sp.textContent || '').trim();
    if(cancel || nv === orig || !nv){ paintErrFixSpans(); return; }
    applyProofEdit(sp.dataset.fp, orig, nv);
  });
})();
