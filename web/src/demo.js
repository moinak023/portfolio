// Preview mode only (VITE_DEMO=1): answers the public API from the starting content, with no server.
// The normal build never includes this file.
import { content } from '../../seed/content.mjs';

export async function demoApi(path) {
  if (path === '/api/site') return { blocks: JSON.parse(JSON.stringify(content)), updatedAt: Date.now() };
  if (path === '/api/auth/me') return { me: null, idleMinutes: 30 };
  throw Object.assign(new Error('The admin console works on the live site, not in this preview.'), { status: 400 });
}
