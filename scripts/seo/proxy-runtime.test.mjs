import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const config = JSON.parse(await readFile('vercel.json', 'utf8'));
// Import the exact deployment entrypoint in plain Node, with no Vite/TS loader.
const { default: proxy } = await import(pathToFileURL(resolve(config.proxy.entrypoint)));
const origin = 'https://digital.aimersociety.com';
const request = path => proxy(new Request(origin + path));

test('production entrypoint lets the homepage and builder reach static routing', () => {
  for (const path of ['/', '/architecture/builder']) {
    const response = request(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-middleware-next'), '1');
  }
});

test('production entrypoint preserves legacy redirects and simulator settings', async () => {
  const routes = JSON.parse(await readFile('src/seo/routes.json', 'utf8'));
  for (const record of routes) {
    assert.equal(request(record.url).headers.get('x-middleware-next'), '1', record.url);
    const response = request(record.route + (record.route.includes('?') ? '&' : '?') + 'view=theory');
    assert.equal(response.status, 308, record.route);
    assert.equal(response.headers.get('Location'), record.url + '/theory');
  }
  assert.equal(request('/?view=theory').headers.get('Location'), '/textbook');
  assert.equal(
    request('/studios/number-systems?tab=hamming&view=theory&bits=8').headers.get('Location'),
    '/studios/number-systems/hamming-code/theory?bits=8',
  );
});
