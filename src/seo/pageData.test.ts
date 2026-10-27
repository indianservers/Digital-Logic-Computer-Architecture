import {describe,it,expect} from 'vitest';
import {SEO_ROUTES} from './urls';
import {pageData} from './pageData';
import {siteOrigin,SITE_ORIGIN} from './site';

describe('public learning content and AI-search metadata',()=>{
  it('defaults to the actual public origin without deployment secrets',()=>{
    expect(siteOrigin('')).toBe(SITE_ORIGIN);
    expect(siteOrigin('https://example.com/')).toBe('https://example.com');
    expect(()=>siteOrigin('invalid')).toThrow();
  });
  it('provides model-based visible FAQ data for every registered lab and theory page',()=>{
    for(const record of SEO_ROUTES){
      const lab=pageData(record.url,SITE_ORIGIN);
      const theory=pageData(record.url+'/theory',SITE_ORIGIN);
      expect(lab.faqs.length,record.url).toBeGreaterThanOrEqual(4);
      expect(theory.faqs).toEqual(lab.faqs);
      expect(new Set(lab.faqs.map(q=>q.question)).size).toBe(lab.faqs.length);
      for(const faq of lab.faqs){expect(faq.answer.length,record.url).toBeGreaterThan(25);expect(faq.answer).not.toMatch(/\[object Object\]/);}
      expect(theory.schema['@graph'].some(node=>node['@type']==='LearningResource')).toBe(true);
    }
  },30000);
  it('keeps unrelated topics separate and private notes out of FAQ metadata',()=>{
    const hamming=SEO_ROUTES.find(r=>r.route==='/studios/number-systems?tab=hamming')!;
    const dma=SEO_ROUTES.find(r=>r.route==='/studios/interrupts?tab=dma')!;
    expect(JSON.stringify(pageData(hamming.url,SITE_ORIGIN).faqs)).toMatch(/syndrome|parity/i);
    expect(JSON.stringify(pageData(dma.url,SITE_ORIGIN).faqs)).toMatch(/DMA|transfer/);
    expect(pageData('/notes',SITE_ORIGIN).faqs).toEqual([]);
  });
});
