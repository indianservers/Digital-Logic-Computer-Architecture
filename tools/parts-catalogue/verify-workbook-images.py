import json, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
root=Path(__file__).resolve().parents[2]
data=json.loads((root/'src/studios/how-devices-work/parts-registry.json').read_text(encoding='utf-8'))
file=root/'outputs/01a11cc4-c71e-7d32-8be9-5a124f85c861/How-Devices-Work-Parts-Catalogue.xlsx'
ns={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(file) as z:
 strings=[]
 if 'xl/sharedStrings.xml' in z.namelist():
  strings=[''.join(si.itertext()) for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('x:si',ns)]
 def values(sheet):
  rows=[]
  for row in ET.fromstring(z.read(f'xl/worksheets/sheet{sheet}.xml')).findall('.//x:sheetData/x:row',ns):
   if int(row.attrib['r'])<6:continue
   cells={}
   for cell in row.findall('x:c',ns):
    v=cell.find('x:v',ns); text=v.text if v is not None else ''
    if cell.get('t')=='s':text=strings[int(text)]
    elif cell.get('t')=='inlineStr':text=''.join(cell.find('x:is',ns).itertext())
    cells[''.join(c for c in cell.attrib['r'] if c.isalpha())]=text
   if cells.get('A'):rows.append(cells)
  return rows
 usages=values(1);parts=values(2);devices=values(3)
 assert len(usages)==len(data['usages'])==2348
 assert len(parts)==len(data['parts'])==1002
 assert len(devices)==140
 for row,usage in zip(usages,data['usages']):
  assert row['D']==usage['partId'] and row['M']==usage['anatomyImage']
 for row,part in zip(parts,data['parts']):
  assert row['A']==part['id'] and row['F']==part['imagePath']
  assert row['G']!='Not generated' and row['J']
  assert (root/'public'/row['F'].lstrip('/')).is_file()
 assert not any(c.get('t')=='e' for name in z.namelist() if name.startswith('xl/worksheets/') and name.endswith('.xml') for c in ET.fromstring(z.read(name)).findall('.//x:c',ns))
print('Workbook verified: 2348 image-linked device entries, 1002 reusable IDs, 140 devices; no spreadsheet error cells.')
