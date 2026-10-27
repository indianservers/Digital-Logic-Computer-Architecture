import {describe,it,expect} from 'vitest';
import proxy from './proxy';
import {SEO_ROUTES} from './urls';
import aliases from './aliases.json';
const origin='https://digital.aimersociety.com';
describe('production canonical redirects',()=>{
  it('redirects every legacy lab and theory bookmark without loops',()=>{
    for(const record of SEO_ROUTES){
      if(record.route!==record.url){const response=proxy(new Request(origin+record.route));expect(response.status,record.route).toBe(308);expect(response.headers.get('Location')).toBe(record.url);}
      const old=record.route+(record.route.includes('?')?'&':'?')+'view=theory';
      const response=proxy(new Request(origin+old));
      expect(response.status,old).toBe(308);expect(response.headers.get('Location')).toBe(record.url+'/theory');
      expect(proxy(new Request(origin+record.url)).status).toBe(200);
    }
  });
  it('preserves simulation settings and migrates renamed curriculum paths',()=>{
    const response=proxy(new Request(origin+'/studios/number-systems?tab=hamming&view=theory&bits=8'));
    expect(response.headers.get('Location')).toBe('/studios/number-systems/hamming-code/theory?bits=8');
    for(const [old,path] of Object.entries(aliases)){
      expect(proxy(new Request(origin+old)).headers.get('Location')).toBe(path);
      expect(proxy(new Request(origin+old+'/theory')).headers.get('Location')).toBe(path+'/theory');
    }
  });
});
