"""Repair legacy UTF-8/cp1252 round trips in cached source attribution text."""
import json
from pathlib import Path
path=Path('tools/parts-catalogue/commons-images.json')
data=json.loads(path.read_text(encoding='utf-8'))
for entry in data.values():
 for field in ['attribution','sourceTitle']:
  value=entry.get(field,'')
  for _ in range(3):
   if not any(marker in value for marker in ['Ã','Â','â']):break
   try:value=value.encode('cp1252').decode('utf-8')
   except (UnicodeEncodeError,UnicodeDecodeError):break
  if field in entry:entry[field]=value
path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
