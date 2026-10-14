"""Download licensed Wikimedia Commons component-family references.
Keeps originals unedited and attribution alongside each asset. Restart-safe cache.
"""
import concurrent.futures, hashlib, html, json, re, time, threading, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
CACHE=ROOT/'tools/parts-catalogue/commons-images.json'
OUT=ROOT/'public/devices/parts/references'
OUT.mkdir(parents=True,exist_ok=True)
queries=json.loads((ROOT/'tools/parts-catalogue/image-queries.json').read_text())
saved=json.loads(CACHE.read_text(encoding='utf-8')) if CACHE.exists() else {}
manifest_path=ROOT/'src/studios/how-devices-work/part-images.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
illustrated={p.get('family') for p in manifest.get('byId',{}).values() if p.get('kind')=='illustration' and (ROOT/'public'/p['src'].lstrip('/')).exists()}
UA='DigitalLogicComponentLibrary/1.0 (educational reference image download; Wikimedia Commons attribution retained)'
request_lock=threading.Lock()
last_request=0.0
def clean(value):return html.unescape(re.sub('<[^>]+>','',value or '')).strip()
def request(url):
 global last_request
 for attempt in range(1):
  try:
   with request_lock:
    time.sleep(max(0,1.8-(time.monotonic()-last_request)))
    last_request=time.monotonic()
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=12) as r:return r.read()
  except Exception:
   if attempt==0:raise
   time.sleep(2+attempt*3)
def fetch(family):
 if saved.get(family,{}).get('src') and (ROOT/'public'/saved[family]['src'].lstrip('/')).exists():return family,saved[family]
 if family in illustrated:return family,saved.get(family,{'error':'Generated illustration already available'})
 query=queries[family]
 params={'action':'query','generator':'search','gsrsearch':query+' -filetype:pdf -filetype:djvu','gsrnamespace':6,'gsrlimit':8,'prop':'imageinfo','iiprop':'url|size|extmetadata','iiurlwidth':960,'format':'json'}
 try:
  result=json.loads(request('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)))
  pages=sorted(result.get('query',{}).get('pages',{}).values(),key=lambda p:p.get('index',100))
  candidates=[]
  for page in pages:
   info=(page.get('imageinfo') or [{}])[0];meta=info.get('extmetadata',{})
   lic=clean(meta.get('LicenseShortName',{}).get('value',''));title=page.get('title','')
   if re.search(r'\.pdf|\.djvu|\.tif|point.cloud|footprint|\bila 2018\b',title,re.I):continue
   if not re.search(r'CC BY|CC0|Public domain',lic,re.I):continue
   url=info.get('url','') if info.get('size',9999999)<3000000 else info.get('thumburl') or info.get('url','')
   if not url:continue
   if not re.search(r'\.(png|jpe?g|webp)(?:\?|$)',url,re.I):continue
   words=set(re.findall(r'[a-z]{3,}',family.lower()))-{'and','circuit','board','module','mechanical','electronic'}
   desc=clean(meta.get('ImageDescription',{}).get('value',''))
   hay=(title+' '+desc).lower()
   score=sum(w in hay for w in words)*4-page.get('index',8)
   if re.search(r'flag|map of|coat of arms|portrait|statue|logo|timeline|conference|politician|building exterior',hay):score-=30
   candidates.append((score,page,info,lic,meta))
  for _,page,info,lic,meta in sorted(candidates,key=lambda x:x[0],reverse=True)[:2]:
   url=info['url'] if info.get('size',9999999)<3000000 else info.get('thumburl') or info['url']
   ext='.png' if re.search(r'\.png(?:\?|$)',url,re.I) else '.webp' if '.webp' in url else '.jpg'
   name=hashlib.sha256(family.encode()).hexdigest()[:16]+ext
   try:
    raw=request(url)
    if not (raw.startswith(b'\x89PNG') or raw.startswith(b'\xff\xd8') or raw[:4]==b'RIFF'):continue
    (OUT/name).write_bytes(raw)
    return family,{'src':'/devices/parts/references/'+name,'caption':'Component-family reference: '+family,'family':family,'kind':'reference','sourceTitle':page['title'],'sourceUrl':info.get('descriptionurl','https://commons.wikimedia.org/wiki/'+urllib.parse.quote(page['title'])),'attribution':clean(meta.get('Artist',{}).get('value','Unknown author')),'license':lic,'licenseUrl':clean(meta.get('LicenseUrl',{}).get('value','')),'retrievedAt':'2026-10-09'}
   except Exception:continue
  return family,{'error':'No downloadable appropriately licensed match','query':query}
 except Exception as e:return family,{'error':str(e),'query':query}

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 futures={pool.submit(fetch,family):family for family in queries}
 for i,future in enumerate(concurrent.futures.as_completed(futures),1):
  family,entry=future.result();saved[family]=entry
  CACHE.write_text(json.dumps(saved,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  print(f'{i}/{len(queries)} {family}: {entry.get("sourceTitle",entry.get("error"))}',flush=True)
print('Downloaded',sum(bool(v.get('src')) for v in saved.values()),'of',len(queries),'families',flush=True)
