const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1200}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.argv[2]||pathToFileURL(path.resolve(__dirname,'../texas-gmr-air-medical-map.html')).href);
  await page.waitForSelector('.trauma-zone');
  const rings=await page.locator('.radius').evaluateAll(ns=>ns.map(n=>n.getAttribute('d')));
  const zones=await page.locator('.trauma-zone').evaluateAll(ns=>ns.map(n=>n.getAttribute('d')));
  assert.equal(zones.length,2);assert(zones.every(d=>d&&d.length>100&&!d.includes('NaN')));
  assert.equal(await page.locator('#catchment-centers li').count(),19);
  assert.equal(await page.locator('.hospital-flag').count(),348);
  assert.equal(await page.locator('.county').count(),254);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1200});
   const a=page.locator('#bexar-nearest-visible'),b=page.locator('#bexar-near-tie-visible');
   for(const [core,tie] of [[true,true],[false,true],[true,false],[false,false]]){
    await a.setChecked(core);await b.setChecked(tie);
    assert.equal(await page.locator('.bexar-nearest').isVisible(),core);
    assert.equal(await page.locator('.bexar-near-tie').isVisible(),tie);
   }
   await page.locator('#catchment-fit').click();assert((await page.locator('#catchment-status').innerText()).includes('Select'));
   await a.check();await b.check();await page.locator('#catchment-fit').click();await page.waitForTimeout(400);
   await page.locator('#hospitals-visible').uncheck();
   assert(await page.locator('.bexar-nearest').isVisible());assert(await page.locator('.bexar-near-tie').isVisible());
   await page.locator('#hospitals-visible').check();
   assert.deepEqual(await page.locator('.radius').evaluateAll(ns=>ns.map(n=>n.getAttribute('d'))),rings);
   assert.deepEqual(await page.locator('.trauma-zone').evaluateAll(ns=>ns.map(n=>n.getAttribute('d'))),zones);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.setViewportSize({width:1440,height:1200});
  if(process.env.SCREENSHOT_DIR){const fs=require('node:fs');fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.locator('.map-shell').screenshot({path:path.join(process.env.SCREENSHOT_DIR,'bexar-distance-zones.png')});}
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,independentToggles:true,adultCenters:19,mobile:true,hospitals:348,baseRingsUnchanged:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
