const { chromium } = require('C:/Users/saisa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'msedge',args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page = await browser.newPage({viewport:{width:1440,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 for(const slug of ['servo-robotic-arm','dc-motor-speed-controller','line-following-robot','ultrasonic-distance-meter']) {
  await page.goto('http://127.0.0.1:5173/studios/microcontroller/project/'+slug);
  await page.locator('.mcu-three-viewport canvas').waitFor({timeout:60000});
  await page.waitForTimeout(600);
  const panel=page.locator('.mcu-simulation');
  await panel.screenshot({path:'output/three-'+slug+'.png'});
  await page.getByRole('button',{name:'Step',exact:true}).click();
  const before=await page.locator('.mcu-scene-footer').innerText();
  await page.getByRole('button',{name:'▶ Resume',exact:true}).click();
  await page.waitForTimeout(800);
  await page.getByRole('button',{name:'Ⅱ Pause',exact:true}).click();
  const after=await page.locator('.mcu-scene-footer').innerText();
  const paused1=await page.locator('.mcu-three-viewport canvas').screenshot();
  await page.waitForTimeout(300);
  const paused2=await page.locator('.mcu-three-viewport canvas').screenshot();
  await page.getByRole('button',{name:'Top',exact:true}).click();
  await page.getByRole('button',{name:'Front',exact:true}).click();
  await page.getByRole('button',{name:'Perspective',exact:true}).click();
  await page.getByRole('button',{name:'↺ Reset',exact:true}).click();
  console.log(JSON.stringify({slug,before,after,pausedStable:paused1.equals(paused2),reset:await page.locator('.mcu-scene-footer').innerText(),readout:await page.locator('.mcu-three-readout').innerText()}));
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('.mcu-simulation').screenshot({path:'output/three-mobile.png'});
 console.log(JSON.stringify({errors,horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)}));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});

