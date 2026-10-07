"""Extract supplied device artwork; never alter source mockups."""
import json
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'UI Target/howDeviceWorks'
target = root / 'public/device-labs'
target.mkdir(exist_ok=True)
# Normalized source rectangles: hero, external device and labeled internal hardware.
light = [(0.63,.06,1,.24),(.12,.24,.435,.61),(.44,.33,.765,.59)]
classic = [(0.42,.053,1,.318),(.318,.355,.63,.55),(.643,.355,.993,.55)]
modern = [(0.43,.064,1,.264),(.35,.313,.676,.54),(.691,.31,.987,.54)]
rects = {
 3:[(.818,.138,.984,.176),(.148,.205,.663,.493),(.678,.245,.984,.49)],
 10:[(.63,.06,1,.24),(.12,.235,.429,.587),(.445,.305,.73,.583)],
 11:[(.13,.18,.99,.32),(.14,.40,.49,.61),(.14,.40,.49,.61)],
 12:[(.4,.16,.99,.32),(.15,.43,.51,.61),(.15,.35,.51,.61)],
 13:[(.63,.055,1,.245),(.155,.35,.466,.582),(.155,.35,.466,.582)],
 14:[(.16,.225,.995,.445),(.16,.49,.545,.707),(.16,.49,.545,.707)],
 15:[(.66,.055,.98,.3),(.145,.415,.527,.674),(.145,.415,.527,.674)],
 16:[(.292,.192,.484,.775),(.217,.175,.686,.808),(.54,.568,.68,.686)],
 22:[(.42,.053,1,.303),(.318,.344,.607,.538),(.621,.345,.989,.541)],
 25:[(.55,.034,1,.189),(.17,.268,.59,.47),(.609,.244,.99,.47)],
 31:[(.43,.064,1,.264),(.338,.313,.65,.554),(.655,.321,.993,.556)],
 32:[(.43,.064,1,.264),(.345,.31,.661,.556),(.671,.317,.992,.553)],
 33:[(.43,.064,1,.264),(.402,.30,.704,.555),(.71,.317,.99,.555)],
 34:[(.43,.064,1,.264),(.347,.31,.681,.554),(.688,.315,.992,.554)],
 35:[(.177,.16,.695,.484),(.177,.17,.696,.48),(.357,.52,.64,.66)],
 36:[(.44,.05,1,.316),(.113,.393,.376,.67),(.381,.397,.696,.669)],
 37:[(.43,.05,1,.32),(.13,.443,.417,.717),(.435,.447,.753,.719)],
 38:[(.40,.052,1,.38),(.118,.415,.365,.656),(.371,.414,.785,.656)],
 39:[(.42,.057,1,.352),(.12,.39,.373,.68),(.38,.40,.67,.68)],
 40:[(.43,.05,1,.318),(.12,.397,.383,.606),(.40,.40,.993,.61)],
 41:[(.43,.055,1,.322),(.122,.412,.461,.613),(.474,.41,.993,.617)],
 42:[(.43,.053,1,.323),(.11,.363,.385,.65),(.389,.367,.674,.65)],
 43:[(.43,.057,1,.39),(.11,.444,.335,.72),(.343,.447,.666,.715)],
 44:[(.819,.188,.99,.4),(.15,.185,.539,.542),(.15,.55,.663,.691)],
 45:[(.4,.12,.66,.374),(.345,.114,.66,.377),(.008,.592,.564,.714)],
 46:[(.595,.067,.857,.161),(.339,.219,.553,.572),(.562,.219,.832,.573)],
 47:[(.49,.064,.994,.297),(.057,.386,.351,.711),(.357,.389,.673,.691)],
 48:[(.229,.055,.696,.376),(.706,.105,.989,.372),(.01,.42,.322,.742)],
 49:[(.012,.196,.35,.751),(.009,.188,.35,.766),(.357,.192,.746,.562)],
 50:[(.43,.06,1,.289),(.003,.321,.352,.633),(.358,.32,.688,.63)],
 51:[(.39,.064,.861,.345),(.01,.383,.269,.682),(.281,.383,.6,.679)],
 52:[(.40,.045,.999,.29),(.103,.327,.345,.646),(.35,.327,.59,.646)],
 53:[(.43,.054,.79,.295),(.098,.341,.359,.627),(.369,.342,.7,.628)],
 54:[(.39,.056,.851,.3),(.105,.378,.303,.633),(.312,.355,.575,.633)],
}
audit = []
only = {int(n) for n in sys.argv[1].split(",")} if len(sys.argv)>1 else None
for file in sorted(source.glob('*.png')):
 number = int(file.name[:2])
 if only and number not in only: continue
 image = Image.open(file).convert('RGB'); w,h=image.size
 regions = rects.get(number, light if number<=10 else classic if number<=24 else modern)
 for role,rect in zip(['hero','external','internal'],regions):
  x,y,x2,y2=rect
  crop=image.crop((round(x*w),round(y*h),round(x2*w),round(y2*h)))
  crop.thumbnail((1400,800))
  crop.save(target / f'{number:02}-{role}.webp',quality=90,method=6)
 if number in [35,44,45,46,53]:
  extras = {'radiotracer':(.103,.529,.296,.674),'gamma-camera':(.314,.533,.644,.677),'collimator':(.664,.533,.987,.677)} if number==35 else {'types':(.545,.435,.985,.54),'generator':(.819,.188,.99,.4)} if number==44 else {'generator':(.675,.142,.842,.372),'radiograph':(.855,.142,.99,.322)} if number==45 else {'real-world':(.087,.216,.334,.576)} if number==46 else {'audiogram':(.71,.332,.989,.506)}
  for role,rect in extras.items():
   x,y,x2,y2=rect;crop=image.crop((round(x*w),round(y*h),round(x2*w),round(y2*h)));crop.thumbnail((1400,800));crop.save(target / f'{number:02}-{role}.webp',quality=90,method=6)
 if number in [7,37,38]:
  rect=(.122,.66,.244,.798) if number==7 else (.771,.458,.912,.699) if number==37 else (.618,.706,.758,.829)
  x,y,x2,y2=rect
  image.crop((round(x*w),round(y*h),round(x2*w),round(y2*h))).save(target/f'{number:02}-scene.webp',quality=92,method=6)
 audit.append({'number':number,'device':file.stem[5:],'mockup':file.name,'sourceSize':[w,h], 'theme':'light' if number<=16 or number==25 else 'dark', 'composition':'clinical-card-grid' if number<=10 else 'wide-instrument' if number<=15 else 'portrait' if number in [25,35,44,45] else 'technical-dashboard', 'assets':[f'/device-labs/{asset.name}' for asset in sorted(target.glob(f'{number:02}-*.webp'))], 'sourceRegions':regions,'mockupLimitation':'thumbnail-listing screenshot' if number==16 else None})
if only:
 existing=json.loads((root/'.codex-device-audit/mapping.json').read_text());updated={row['number']:row for row in audit};audit=[updated.get(row['number'],row) for row in existing]
(root/'.codex-device-audit/mapping.json').write_text(json.dumps(audit,indent=2))
print('Prepared',len(audit),'mockups and',len(list(target.glob('*.webp'))),'optimized local artwork assets.')
