import { describe, expect, it } from 'vitest';
import { SEO_ROUTES, internalUrl, metadataFor, publicUrl } from './urls';

describe('SEO URL migration',()=>{
  it('gives every catalogue route a unique, reversible lab and textbook path',()=>{
    expect(new Set(SEO_ROUTES.map(r=>r.url)).size).toBe(SEO_ROUTES.length);
    expect(new Set(SEO_ROUTES.map(r=>r.title)).size).toBe(SEO_ROUTES.length);
    for(const record of SEO_ROUTES){
      expect(record.url).toMatch(/^\/[a-z0-9/-]+$/);
      expect(publicUrl(record.route),record.route).toBe(record.url);
      const decoded=new URL(internalUrl(record.url),'https://example.com');
      const original=new URL(record.route,'https://example.com');
      expect(decoded.pathname,record.url).toBe(original.pathname);
      expect(decoded.searchParams.get('tab')).toBe(original.searchParams.get('tab'));
      expect(publicUrl(record.url+'/theory')).toBe(record.url+'/theory');
      expect(new URL(internalUrl(record.url+'/theory'),'https://example.com').searchParams.get('view')).toBe('theory');
      expect(metadataFor(record.url).title).toContain(record.title);
    }
  });
  it('preserves simulation settings, anchors, and clean paths through a round trip',()=>{
    const legacy='/studios/fde?tab=rtl&view=theory&speed=2#textbook-practice';
    const clean='/studios/fetch-decode-execute/register-transfers/theory?speed=2#textbook-practice';
    expect(publicUrl(legacy)).toBe(clean);
    expect(publicUrl(internalUrl(clean))).toBe(clean);
    expect(metadataFor(clean).path).toBe('/studios/fetch-decode-execute/register-transfers/theory');
  });
  it('migrates home and encyclopedia bookmarks to their specific lessons',()=>{
    expect(publicUrl('/?view=theory')).toBe('/textbook');
    const record=SEO_ROUTES.find(r=>r.route==='/studios/number-systems?tab=hamming')!;
    expect(publicUrl('/encyclopedia?article='+encodeURIComponent(record.id))).toBe(record.url+'/theory');
    expect(publicUrl('/studios/aca')).toBe('/studios/advanced-computer-architecture');
    expect(publicUrl('/studios/truth-tables?tab=from-table')).toBe(publicUrl('/studios/truth-tables?tab=from-expr'));
    expect(publicUrl('/encyclopedia?article=studios%2Ftruth-tables%2Ffrom-table')).toBe(publicUrl('/studios/truth-tables?tab=from-expr&view=theory'));
    expect(publicUrl('/encyclopedia?article=studios%2Fhow-devices-work%23hdw-aviation')).toBe('/studios/how-devices-work/theory');
  });
  it('keeps unrecognized settings so the destination lab can validate them',()=>{
    expect(publicUrl('/studios/memory?tab=unknown')).toContain('tab=unknown');
    expect(metadataFor('/notes').noindex).toBe(true);
    expect(metadataFor('/textbook').title).toContain('Textbook');
  });
});
