// TransProof 报错反馈收集器（独立 Worker + KV）
// POST /submit {desc,time,func,where,path,contact,ver,page,ua,lastErr} -> {ok,id}
// GET  /list -> {ok,list:[...]}（最近 500 条，新的在前）
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (url.pathname === '/list') {
      const list = (await env.FB_KV.get('list', 'json')) || [];
      return json({ ok: true, list }, cors);
    }

    if (url.pathname === '/submit' && req.method === 'POST') {
      let body;
      try { body = await req.json(); } catch (e) { return json({ ok: false, err: 'bad json' }, cors, 400); }
      for (const k of ['desc', 'time', 'where']) {
        if (!body[k] || !String(body[k]).trim()) return json({ ok: false, err: 'missing ' + k }, cors, 400);
      }
      const rec = {
        id: 'FB-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 46656).toString(36).toUpperCase(),
        ts: Date.now(),
        desc: String(body.desc).slice(0, 1000),
        time: String(body.time).slice(0, 40),
        func: String(body.func || '').slice(0, 60),
        where: String(body.where).slice(0, 60),
        path: String(body.path || '').slice(0, 200),
        contact: String(body.contact || '').slice(0, 100),
        ver: String(body.ver || '').slice(0, 20),
        page: String(body.page || '').slice(0, 40),
        ua: String(body.ua || '').slice(0, 200),
        lastErr: String(body.lastErr || '').slice(0, 300),
      };
      const list = (await env.FB_KV.get('list', 'json')) || [];
      list.unshift(rec);
      if (list.length > 500) list.length = 500;
      await env.FB_KV.put('list', JSON.stringify(list));
      return json({ ok: true, id: rec.id }, cors);
    }

    return new Response('transproof feedback worker', { status: 404, headers: cors });
  },
};
function json(o, cors, s) {
  return new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json', ...cors } });
}
