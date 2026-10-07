"""Inventory and verify generated masters without cropping, resizing, or editing images."""
import sys
import re
import csv
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
phase = sys.argv[1] if len(sys.argv)>1 else 'phase-1'
OUT = ROOT / 'output/hdw-image-regeneration' / phase
OUT.mkdir(parents=True, exist_ok=True)
pages = json.loads((ROOT / '.codex-device-audit/tab-migration/comparison.json').read_text())
catalogue = (ROOT / 'src/studios/how-devices-work/catalogue.ts').read_text(encoding='utf-8')
devices = json.loads(catalogue.split('export const DEVICES: Device[] = ')[1].split(';')[0])
assert len(devices) == len(pages) == 140

inventory = []
stats = []
for page in pages:
    n = page['number']
    legacy = sorted((ROOT / 'public/device-labs').glob(f'{n:02}-*.webp')) if n <= 54 else sorted((ROOT / 'public/device-labs/advanced').glob(f'{n:03}-*.webp'))
    folder = ROOT / 'public/device-labs/generated' / f'{n:03}-{page["route"].split("/")[-1]}'
    images = []
    for path in sorted(folder.glob('*.png')):
        with Image.open(path) as im:
            alpha = im.getchannel('A') if im.mode == 'RGBA' else None
            alpha_range = alpha.getextrema() if alpha else None
            assert min(im.size) >= 1024, path
            if path.stem not in ['hero','context']:
                assert alpha_range and alpha_range[0] == 0 and alpha_range[1] > 240, path
            images.append({'role': path.stem, 'path': '/' + path.relative_to(ROOT / 'public').as_posix(), 'width': im.width, 'height': im.height, 'mode': im.mode, 'alpha_range': alpha_range, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'generation': 'individual built-in image_gen call', 'postprocessing': 'none; original generated PNG copied byte-for-byte'})
    part_count = sum(x['role'] not in ['hero','internal','external','context','device'] for x in images)
    complete = part_count == len(page['parts']) and all(any(x['role']==r for x in images) for r in ['external','internal','hero'])
    status = 'core asset set generated' if complete else 'partially generated' if images else 'pending bulk regeneration'
    row = {'lab': n, 'page_name': page['device'], 'route': page['route'], 'categories': next(d['categories'] for d in devices if '/studios/how-devices-work/' + d['id'] == page['route']), 'legacy_files': [p.relative_to(ROOT).as_posix() for p in legacy], 'legacy_roles_to_replace': [p.stem.split('-', 1)[1] for p in legacy], 'named_components': page['parts'], 'minimum_core_images': len(page['parts']) + 3, 'additional_views': 'Replace every useful existing raster role; add detail/state views where warranted, with no fixed image cap.', 'generated_images': images, 'generated_count': len(images), 'generated_component_count': part_count, 'status': status}
    inventory.append(row)
    stats.append({'lab': n, 'page_name': page['device'], 'route': page['route'], 'existing_raster_files': len(legacy), 'named_components': len(page['parts']), 'generated_total': len(images), 'generated_components': part_count, 'minimum_core_images': len(page['parts']) + 3, 'status': row['status']})

(OUT / 'inventory.json').write_text(json.dumps(inventory, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
with (OUT / 'per-lab-stats.csv').open('w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=stats[0].keys())
    writer.writeheader()
    writer.writerows(stats)
summary = {'scope': 'How Devices Work only', 'unique_pages': len(pages), 'source_mockups': len(list((ROOT / 'UI Target/howDeviceWorks').glob('*.png'))), 'existing_raster_files': sum(len(x['legacy_files']) for x in inventory), 'named_components': sum(len(x['named_components']) for x in inventory), 'minimum_core_images_planned': sum(x['minimum_core_images'] for x in inventory), 'generated_images': sum(x['generated_count'] for x in inventory), 'completed_page_sets': sum(x['status']=='core asset set generated' for x in inventory), 'remaining_page_sets': sum(x['status']!='core asset set generated' for x in inventory), 'phases': [{'phase': 1, 'scope': 'Whole-catalogue inventory, asset rules, complete Sonar pilot, integration and quality verification.'}, {'phase': 2, 'scope': 'Generate remaining page sets and every named component, additional useful raster roles and detailed views. Maintain per-lab stats.'}, {'phase': 3, 'scope': 'Integrate and validate all page sets; prepare component composition layouts and animation hooks.'}], 'animation_status': 'Independent transparent components delivered for pilot; no animated frames or actual part animation generated yet.', 'master_policy': 'Keep original native-resolution PNG and alpha, no mockup cropping, no lossy recompression, no embedded page labels. Generic representative hardware illustrations; editable HTML names and explanations.', 'limitations': '2D individually generated component art is not an exact CAD assembly. Perspective and design are guided by the same reference, but exact geometric reconstruction/rotation requires further work.'}
(OUT / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
print(json.dumps(summary, indent=2))
