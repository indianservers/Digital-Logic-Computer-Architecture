from pathlib import Path
from html.parser import HTMLParser
from collections import Counter
import json,re

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.text=[];self.images=[];self.tags=Counter();self.tab='';self.mapping={};self.headings=[];self.heading=False;self.paragraphs=[];self.in_paragraph=False;self.paragraph='';self.controls=[];self.svg=[];self.svg_depth=0;self.svg_text=''
    def handle_starttag(self,tag,attrs):
        a=dict(attrs);self.tags[tag]+=1
        if tag=='img':self.images.append(a.get('src'))
        if a.get('role')=='tabpanel' and a.get('id','').startswith('course-'):self.tab=a['id']
        if 'data-course-section' in a:self.mapping[a['data-course-section']]=self.tab
        if tag in ['h1','h2','h3','summary']:self.heading=True
        if tag=='p':self.in_paragraph=True;self.paragraph=''
        if tag in ['input','select']:self.controls.append({k:v for k,v in a.items() if k not in ['id']})
        if tag=='svg':self.svg_depth+=1
        if self.svg_depth:self.svg_text+=self.get_starttag_text()
    def handle_endtag(self,tag):
        if tag in ['h1','h2','h3','summary']:self.heading=False
        if tag=='p':self.in_paragraph=False;self.paragraphs.append(self.paragraph.strip())
        if self.svg_depth:self.svg_text+='</'+tag+'>'
        if tag=='svg':
            self.svg_depth-=1
            if not self.svg_depth:self.svg.append(self.svg_text);self.svg_text=''
    def handle_data(self,data):
        if self.svg_depth:self.svg_text+=data
        if self.in_paragraph:self.paragraph+=data
        if data.strip():
            self.text.append(data.strip())
            if self.heading:self.headings.append(data.strip())

p=Path(__file__).parent
records=json.loads((p/'before/pages.json').read_text())
for r in records:
    before=(p/f"before/{r['number']}.html").read_text()
    # This replaced bar contains navigation labels only, no educational material.
    before=re.sub(r'<nav class="dl-section-tabs">.*?</nav>','',before)
    raw_before=Page();raw_before.feed(before)
    r['removed_duplicates']=[]
    if r['number']==85:
        copies=re.findall(r'<details><summary>Quick Quiz</summary><div class="sy-quiz-content">.*?</div></details>',before)
        assert len(copies)==2 and copies[0]==copies[1], 'Only an exact duplicate quiz may be removed'
        before=before.replace(copies[0],'',1)
        r['removed_duplicates']=['One exact duplicate quiz; original question and retry control retained in Applications & Quiz']
    b=Page();b.feed(before);a=Page();a.feed((p/f"after/{r['number']}.html").read_text())
    r['before']={'sections':raw_before.tags['section'],'images':len(raw_before.images),'diagrams':len(raw_before.svg),'paragraphs':len(raw_before.paragraphs),'inputs':raw_before.tags['input'],'selects':raw_before.tags['select'],'buttons':raw_before.tags['button'],'headings':raw_before.headings}
    r['after']={'sections':a.tags['section'],'images':len(a.images),'diagrams':len(a.svg),'paragraphs':len(a.paragraphs),'inputs':a.tags['input'],'selects':a.tags['select'],'buttons':a.tags['button'],'headings':a.headings,'mapping':a.mapping}
    normalize=lambda text:re.sub(r'Question (\d+) / \d+',r'Question \1 / total',text)
    r['missing_text']=list((Counter(map(normalize,b.text))-Counter(map(normalize,a.text))).elements())
    r['missing_images']=list((Counter(b.images)-Counter(a.images)).elements())
    r['missing_paragraphs']=list((Counter(map(normalize,b.paragraphs))-Counter(map(normalize,a.paragraphs))).elements())
    r['missing_svg']=list((Counter(b.svg)-Counter(a.svg)).elements())
    r['missing_controls']=list((Counter(json.dumps(c,sort_keys=True) for c in b.controls)-Counter(json.dumps(c,sort_keys=True) for c in a.controls)).elements())
    r['quiz_before']=3 if r['number']<=54 or 56<=r['number']<=64 or r['number'] in [66,71,73,74] else 5 if r['number']==65 else 1
    r['quiz_after']=5 if r['number']==65 else 3
    r['metadata_changes']=['Quiz total increased; original question preserved'] if r['quiz_after']>r['quiz_before'] else []
    r['status']='PASS' if not any(r[k] for k in ['missing_text','missing_images','missing_paragraphs','missing_svg','missing_controls']) else 'FAIL'
(p/'comparison.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
print(f"{sum(r['status']=='PASS' for r in records)}/{len(records)} pages preserve all text, paragraphs, image paths, exact SVG diagrams and input controls.")
for r in records:
    if r['status']=='FAIL':print(r['number'],{k:len(r[k]) if k=='missing_svg' else r[k] for k in ['missing_text','missing_images','missing_paragraphs','missing_svg','missing_controls']})
