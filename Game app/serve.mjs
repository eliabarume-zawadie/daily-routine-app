// Minimal static server so the game can be opened in a browser.
//
// ES modules are blocked over file://, so the game needs to be served over
// HTTP. This exists because `python -m http.server` is not available on every
// machine (on Windows `python` is often just a Store alias that isn't a real
// install). No dependencies — only Node's standard library.
//
//   node serve.mjs        then open http://localhost:8000

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.argv[2]) || 8000;
const ROOT = import.meta.dirname;

// Serving the wrong MIME type for .js makes browsers refuse the module outright.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const rel = normalize(path === '/' ? 'index.html' : path).replace(/^([/\\])+/, '');

  // Refuse anything that climbs out of the game folder.
  if (rel.startsWith('..')) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, {
      'Content-Type': TYPES[extname(rel)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',   // always serve the file you just edited
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => {
  console.log(`Zombie Survival Arena → http://localhost:${PORT}`);
});
