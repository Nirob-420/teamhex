import { getStore } from '@netlify/blobs';

const KEY = 'team-hex-visits-v2';
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
  'X-Visitor-API': 'hex-v2',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const safeCount = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

/** Strong reads + atomic compare-and-swap writes prevent lost concurrent visits. */
export function createVisitorHandler(store) {
  return async request => {
    if (!['GET', 'POST'].includes(request.method)) {
      return json({ error: 'Method not allowed' }, 405);
    }
    if (request.headers.get('sec-fetch-site') === 'cross-site') {
      return json({ error: 'Same-origin requests only' }, 403);
    }
    try {
      if (request.method === 'GET') {
        const current = await store.get(KEY, { type: 'json' });
        return json({ count: safeCount(current?.count), mode: 'live' });
      }
      for (let attempt = 0; attempt < 12; attempt++) {
        const current = await store.getWithMetadata(KEY, { type: 'json' });
        const count = safeCount(current?.data?.count) + 1;
        const condition = current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true };
        const result = await store.setJSON(KEY, { count, updatedAt: new Date().toISOString() }, condition);
        if (result.modified) return json({ count, mode: 'live' });
        await new Promise(resolve => setTimeout(resolve, 15 * (attempt + 1) + Math.random() * 25));
      }
      return json({ error: 'Counter is busy. Please retry.' }, 503);
    } catch (error) {
      console.error('TEAM HEX visitor counter:', error.message);
      return json({ error: 'Counter temporarily unavailable' }, 503);
    }
  };
}

export default async request => {
  const store = getStore({ name: 'team-hex-public', consistency: 'strong' });
  return createVisitorHandler(store)(request);
};

export const config = { path: '/api/visits', method: ['GET', 'POST'] };
