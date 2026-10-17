/* ═══════════ 三段流水线（翻译 → 批评 → 精修）· T-002 + T-009/T-010 ═══════════
   一次操作串三次 callModel：①出初稿 ②批评者挑毛病 ③按批评精修。
   工序纪律（伊里因科夫三权分立单人版）：
     · Owner=你（人），Operator=AI；每段产物停下给你过目，不自动跳段（T-009/T-013）。
     · 批评段输入白名单 = 原文 + 译稿 + 术语表，禁带任何翻译段的「自辩/理由」（T-010）。
     · 批评段只产问题清单，不直接改译文；改译永远在第三段精修。
     · 任一段失败给可读提示，不静默吞。 */
const PL = { stage: 0, draft: '', critique: '', final: '', running: false, cancel: false };

/* 术语表（白名单要件，供批评/精修段锁定一致） */
function plTerms(){
  const a = [];
  if(TERMS.length) a.push(TERMS.slice(0,80).map(t => t.src + ' → ' + t.dst + (t.note?'（'+t.note+'）':'')).join('\n'));
  if(GLOSS && GLOSS.terms && GLOSS.terms.length){
    const g = GLOSS.terms.filter(t => t.status === 'confirmed' && t.foreign && t.zh).slice(0,60)
      .map(t => t.foreign + ' → ' + t.zh).join('\n');
    if(g) a.push(g);
  }
  return a.filter(Boolean).join('\n') || '（未设术语库）';
}
function plSrc(){ return ($('#ts-src').value || '').trim(); }
function plLang(){ const l = $('#ts-lang').value; return l === 'auto' ? '外文' : l; }

/* ── 第 1 段：翻译初稿（复用现有翻译提示词装配） ── */
function plSysDraft(){
  try{ return buildTransSystem(); }
  catch(e){ return '你是专业学术翻译家，把【' + plLang() + '原文】译成【中文】。译文通顺忠实，术语首次出现附原文括注。'; }
}

/* ── 第 2 段：批评（只产清单，不改译文；输入白名单=原文+译稿+术语表） ── */
function plSysCritique(){
  return [
    '你是一位极其挑剔的资深译审，任务是**只找出问题、列出清单**，**绝对不要重写或修改译文**。',
    '你只依据下方【外文原文】【译稿】【术语表】三样来判断；不要臆测译者的意图或理由，不要替译者辩解。',
    '',
    '【输出格式 — 只输出一个问题清单，每条一行，不要写总结、不要写客套话】',
    '- 每条格式：[类型] 原文片段 → 译稿片段：问题说明 + 建议改法',
    '- 类型只能是：误译 / 漏译 / 增译 / 术语不一致 / 歧义 / 逻辑关系 / 中式英语 / 标点格式 / 语体不当',
    '- 优先抓硬伤（漏译、误译、术语不一致、数字日期错误），再谈文风。',
    '- 专有名词（人名、地名、历史事件、学派、书名）必须与术语表一致；不一致要点名。',
    '- 若整体无明显问题，只输出一行：未发现明显问题。',
    '- 不要输出与问题无关的评论。'
  ].join('\n');
}
function plUserCritique(){
  const s = plSrc().slice(0,12000);
  return '【外文原文】\n' + s + '\n\n【译稿】\n' + PL.draft.slice(0,16000) + '\n\n【术语表】\n' + plTerms();
}

/* ── 第 3 段：精修（输入=原文+译稿+批评清单+术语表，产出最终译文） ── */
function plSysRefine(){
  return [
    '你是一位资深翻译家，正在按审稿意见精修一份译稿。',
    '【任务】依据下面的「批评清单」逐条修正译稿中的问题，产出**完整、可直接使用的最终译文**。',
    '',
    '【硬性要求】',
    '- 只输出最终译文本身，不要输出修订说明、不要加前言后语、不要用 markdown 代码块包裹。',
    '- 逐条落实批评清单；清单里没提到的地方保持原译稿不动（不要顺手改写）。',
    '- 专有名词严格遵循术语表；清单指出的术语不一致必须统一。',
    '- 保持原译稿的段落划分；中文通顺，不加机器腔填充语。'
  ].join('\n');
}
function plUserRefine(){
  return '【外文原文】\n' + plSrc().slice(0,12000) +
         '\n\n【原译稿】\n' + PL.draft.slice(0,14000) +
         '\n\n【批评清单（须逐条落实）】\n' + (PL.critique || '（无，按原译稿直接输出）') +
         '\n\n【术语表】\n' + plTerms();
}

/* ── 弹窗骨架 ── */
function plHtml(){
  return [
    '<div class="pl-steps" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">',
    '  <span class="ef-chip" data-pls="1">① 翻译初稿</span>',
    '  <span class="ef-chip" data-pls="2">② 批评清单</span>',
    '  <span class="ef-chip" data-pls="3">③ 精修译文</span>',
    '</div>',
    '<div id="pl-status" style="font-size:12px;color:var(--tx3);margin-bottom:8px">准备就绪：点「开始第 1 段」出初稿。</div>',
    '<div id="pl-box" style="min-height:120px;max-height:46vh;overflow:auto;padding:12px;background:var(--bg2);border:1px solid var(--bd);border-radius:6px;font-size:14px;line-height:1.8;white-space:pre-wrap"></div>',
    '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">',
    '  <button class="btn pri sm" id="pl-next">▶ 开始第 1 段（翻译初稿）</button>',
    '  <button class="btn gray sm" id="pl-copy" disabled>📋 复制当前产物</button>',
    '  <button class="btn pri sm" id="pl-send" disabled style="background:rgba(63,185,80,.12);border-color:var(--ok)">→ 把精修译文送去校对</button>',
    '  <button class="btn gray sm" id="pl-stop" disabled>■ 中断</button>',
    '  <button class="btn gray sm" id="pl-close">关闭</button>',
    '</div>',
    '<div class="alert" style="margin-top:10px">工序说明：每段产物都停下给你过目，你点了下一段才继续（AI 不自动跳段）。批评段只挑毛病、不改译文；改译永远在第 3 段。最后采纳哪一版，由你拍板。</div>'
  ].join('');
}
function plStep(n){
  document.querySelectorAll('#mBody .pl-steps .ef-chip').forEach(c => {
    const i = +c.dataset.pls;
    c.classList.toggle('on', i === n);
  });
}
function plCur(){
  if(PL.stage === 3) return PL.final;
  if(PL.stage === 2) return PL.critique;
  if(PL.stage === 1) return PL.draft;
  return '';
}
function plSetBox(t){ $('#pl-box').textContent = t; }
function plStatus(t){ $('#pl-status').textContent = t; }

/* ── 主流程：跑第 n 段（n=1,2,3） ── */
async function plRun(n){
  if(PL.running) return;
  const src = plSrc();
  if(!src){ toast('请先在第 1 步输入或上传原文', 'e'); closeModal(); return; }
  if(n > 1 && !PL.draft){ toast('请先完成第 1 段（翻译初稿）', 'w'); return; }
  if(n > 2 && !PL.critique){ toast('请先完成第 2 段（批评清单）', 'w'); return; }

  PL.running = true; PL.cancel = false;
  const nx = $('#pl-next'); nx.disabled = true;
  const stop = $('#pl-stop'); stop.disabled = false;
  const label = ['','翻译初稿','批评清单','精修译文'][n];
  plStatus('⏳ 第 ' + n + ' 段「' + label + '」生成中…（可随时中断）');
  plSetBox('');
  plStep(n);

  let sys, user, maxTok;
  if(n === 1){ sys = plSysDraft(); user = '【外文原文】\n' + src.slice(0, (CFG.maxInChars||80000)); maxTok = 8000; }
  else if(n === 2){ sys = plSysCritique(); user = plUserCritique(); maxTok = 3000; }
  else { sys = plSysRefine(); user = plUserRefine(); maxTok = 8000; }

  try{
    const r = await callModelSimple(sys, user, maxTok);
    if(PL.cancel){ plStatus('⏹ 已中断第 ' + n + ' 段。'); nx.disabled = false; stop.disabled = true; PL.running = false; return; }
    let t = String((r && r.text) || '').trim();
    t = t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/,'').trim(); // 剥代码围栏
    if(!t){ throw new Error('模型返回为空'); }
    if(n === 1) PL.draft = t;
    else if(n === 2) PL.critique = t;
    else PL.final = t;

    plSetBox(t);
    plStatus('✓ 第 ' + n + ' 段「' + label + '」完成 · ' + new Date().toLocaleTimeString('zh-CN'));
    $('#pl-copy').disabled = false;

    if(n === 1){ nx.textContent = '▶ 下一段：第 2 段（批评挑毛病）'; nx.disabled = false; }
    else if(n === 2){ nx.textContent = '▶ 下一段：第 3 段（按批评精修）'; nx.disabled = false; }
    else { nx.textContent = '✓ 三段全部完成'; nx.disabled = true; $('#pl-send').disabled = false; }
  }catch(err){
    const msg = errMsg(err);
    plStatus('✗ 第 ' + n + ' 段「' + label + '」失败：' + msg);
    plSetBox('【第 ' + n + ' 段失败】' + msg + '\n\n可以点「重试本段」再试一次，或先检查「设置」页的接口地址 / 模型 / API Key。');
    nx.disabled = false; nx.textContent = '↻ 重试第 ' + n + ' 段';
    toast('第 ' + n + ' 段失败：' + msg, 'e');
  }finally{
    PL.running = false; stop.disabled = true;
  }
}

function plOpen(){
  if(PL_RUNNING_GUARD()) return;
  PL.stage = 0; PL.draft = ''; PL.critique = ''; PL.final = '';
  modal('⚙ 三段流水线 · 翻译 → 批评 → 精修', plHtml());
  plStep(0);
  $('#pl-next').onclick = () => {
    PL.stage = (PL.stage || 0) + 1;
    if(PL.stage > 3){ return; }
    plRun(PL.stage).then(() => { /* stage 已在 plRun 内推进 */ });
  };
  $('#pl-copy').onclick = () => { const t = plCur(); if(t){ navigator.clipboard.writeText(t).then(() => toast('已复制当前产物')).catch(() => toast('复制失败，请手动选中', 'e')); } };
  $('#pl-send').onclick = () => {
    if(!PL.final){ toast('还没有精修译文', 'w'); return; }
    $('#dst').value = PL.final; closeModal(); toast('精修译文已填入校对页，可点「开始校对」');
    document.querySelector('nav button[data-page="p-work"]').click();
  };
  $('#pl-stop').onclick = () => { PL.cancel = true; };
  $('#pl-close').onclick = () => closeModal();
}
function PL_RUNNING_GUARD(){ return false; } /* 预留：与主翻译互斥的守卫位 */

/* 绑定入口 */
$('#btn-pipeline') && ($('#btn-pipeline').onclick = () => {
  if(!CFG.apiKey){ toast('请先到「设置」页填写 API Key', 'e'); document.querySelector('nav button[data-page="p-set"]').click(); return; }
  if(TS_RUNNING){ toast('翻译正在进行中，请等它结束再用流水线', 'w'); return; }
  plOpen();
});
window.PL = PL;
