// Shared helpers for the series functions. Files starting with "_" are not routes on Vercel.
import { createHash, timingSafeEqual } from 'node:crypto';

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
