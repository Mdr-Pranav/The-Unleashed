// Shared helpers for the series functions. Files starting with "_" are not routes on Vercel.
import { createHash, timingSafeEqual } from 'node:crypto';

// Vercel lets you add a custom prefix when connecting a store (e.g. ART_READ_WRITE_TOKEN);
// the Blob library only reads BLOB_READ_WRITE_TOKEN, so map a prefixed one onto it.
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  const key = Object.keys(process.env).find((k) => /READ_WRITE_TOKEN$/.test(k) && /^vercel_blob_rw_/.test(process.env[k] || ''));
  if (key) process.env.BLOB_READ_WRITE_TOKEN = process.env[key];
}

// story-01 … story-99, scroll-01 … scroll-99
export const SLUG = /^(story|scroll)-(\d{2})$/;

export function isAdmin(req) {
  const expected = process.env.STUDIO_PASSWORD || '';
  const given = String(req.headers['x-studio-password'] || '');
  if (expected.length < 8 || !given) return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function send(res, status, body, cache = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(JSON.stringify(body));
}

// Turns a storage error into a message the studio can act on.
export function explain(err) {
  const msg = String((err && err.message) || err);
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    return 'No Blob store is connected to this project. Vercel → Storage → connect the Blob store to this project, then redeploy.';
  }
  if (/private/i.test(msg) && /public/i.test(msg)) {
    return 'The Blob store is set to Private. Create a new Blob store with Public access, connect it, and redeploy.';
  }
  if (/not.?found|does not exist|suspended/i.test(msg)) {
    return `The Blob store can't be reached (${msg}). Reconnect it in Vercel → Storage and redeploy.`;
  }
  return `Storage error: ${msg}`;
}

export async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('File too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
