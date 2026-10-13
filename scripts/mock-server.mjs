import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../mock');
const port = parseInt(process.env.PORT || '4173', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') {
    urlPath = '/index.html';
  }
  let filePath = join(root, urlPath);

  if (!filePath.startsWith(root)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  const ext = extname(filePath).toLowerCase();
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  console.log(`Mock server running at http://127.0.0.1:${port}`);
});
