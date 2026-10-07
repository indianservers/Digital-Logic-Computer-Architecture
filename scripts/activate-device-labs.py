"""Synchronize implemented lab status into the isolated studio catalogue."""
import re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
lab_text=(root/'src/studios/how-devices-work/labs/data.ts').read_text(encoding='utf-8')
names=set(re.findall(r'^ \[\d+,"([^"]+)"',lab_text,re.M))
path=root/'src/studios/how-devices-work/catalogue.ts'
text=path.read_text(encoding='utf-8')
def status(match):
 name=re.search(r'"name": "([^"]+)"',match[0])
 return match[0].replace('"status": "upcoming"','"status": "available"') if name and name[1] in names else match[0]
text=re.sub(r'  \{\n    "id":.*?\n  \}',status,text,flags=re.S)
path.write_text(text,encoding='utf-8')
print('Activated',len(names),'unique device labs.')
