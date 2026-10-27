import {test} from 'node:test';
import assert from 'node:assert/strict';
import resolvePage from '../../api/resolve.js';
function run(url){const result={};resolvePage({url},{writeHead(status,headers){result.status=status;result.headers=headers;},end(body){result.body=body;}});return result;}
test('fallback resolves legacy lab/theory paths and keeps simulator settings',()=>{
  const result=run('/api/resolve?__path=studios/number-systems&tab=hamming&view=theory&bits=8');
  assert.equal(result.status,308);
  assert.equal(result.headers.Location,'/studios/number-systems/hamming-code/theory?bits=8');
  assert.equal(run('/api/resolve?__path=architecture/mobile/cores').headers.Location,'/architecture/mobile/cpu-cores');
});
test('unknown pages and missing static canonical files never masquerade as the homepage',()=>{
  for(const path of ['/studios/no-such-lab','/architecture/builder/builder','/api/resolve?__path=missing']){
    const result=run(path);assert.equal(result.status,404);assert.match(result.headers['X-Robots-Tag'],/noindex/);assert.match(result.body,/Page not found/);
  }
});
