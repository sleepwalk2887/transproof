// transproof.pages.dev 边缘入口（Pages Advanced Mode）
// 职责：① /api/feedback/* 在 CF 边缘内网回源到 workers.dev 反馈 Worker（不经用户网络，
//       规避 workers.dev 在部分网络下 DNS 污染）② 其余请求原样交给静态资源。
const UP = 'https://transproof-feedback.transproof-tasks.workers.dev';
const API = '/api/feedback';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-TP-App,X-TP-Ver,X-TP-Url,X-TP-UA,X-TP-Err'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === API || url.pathname.startsWith(API + '/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS });
      }
      // /api/feedback/submit -> UP/submit；/api/feedback/list -> UP/list
      const tail = url.pathname.slice(API.length) || '/';
      const resp = await fetch(UP + tail, request).catch(e => e);
      if (resp instanceof Error) {
        return new Response(JSON.stringify({ error: 'upstream-unreachable', msg: String(resp.message) }), {
          status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS }
        });
      }
      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS }
      });
    }
    return env.ASSETS.fetch(request);
  }
};
