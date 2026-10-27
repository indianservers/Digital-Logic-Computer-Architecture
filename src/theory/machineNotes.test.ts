import {describe,it,expect} from 'vitest';
import {SEO_ROUTES} from '../seo/urls';
import {machineNotes} from './machineNotes';
import {SITE_ORIGIN} from '../seo/site';

describe('text-only lesson retrieval and attribution',()=>{
  it('publishes genuine content and exact source links for every canonical lesson',()=>{
    for(const route of SEO_ROUTES){
      const note=machineNotes(route.id,SITE_ORIGIN);
      expect(note.canonical_url).toBe(SITE_ORIGIN+route.url+'/theory');
      expect(note.markdown_url).toBe(note.canonical_url+'.md');
      expect(note.interactive_url).toBe(SITE_ORIGIN+route.url);
      for(const section of ['## Concepts','## Diagram:','## Solved examples','## Practice questions','## Frequently asked questions','## References','## Citation'])expect(note.text,route.url).toContain(section);
      expect(note.text).toContain(note.canonical_url);
      expect(note.text.length,route.url).toBeGreaterThan(1000);
      expect(note.text).not.toContain('[object Object]');
    }
  });
  it('rejects unknown lesson IDs instead of generating misleading notes',()=>{
    expect(()=>machineNotes('missing',SITE_ORIGIN)).toThrow('No lesson');
  });
});
