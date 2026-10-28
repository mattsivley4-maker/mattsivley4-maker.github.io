const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.argv[2]||pathToFileURL(path.resolve(__dirname,'../texas-gmr-air-medical-map.html')).href);
  await page.waitForSelector('.base-marker');
  const geometry=()=>page.locator('.radius').evaluateAll(ns=>ns.map(n=>n.getAttribute('d')));
  const original=await geometry();
  const shared=page.locator('.shared-marker[aria-label^="Uvalde:"]');
  assert.equal(await shared.count(),1);
  assert.deepEqual(await shared.locator('path').evaluateAll(ns=>ns.map(n=>n.getAttribute('fill'))),['#b53942','#81522e']);
  assert(await shared.evaluate(n=>{const a=window.GMR_MAP_DATA.bases.find(b=>b.id==='ael-181');return n.__data__.lat===a.lat&&n.__data__.lng===a.lng;}));
  const highlighted=await page.locator('.highlighted-county').evaluateAll(ns=>ns.map(n=>(n.__data__.properties.NAME||n.__data__.properties.name).replace(/ County$/,'')).sort());
  assert.deepEqual(highlighted,['Bexar','Nueces','McMullen','Live Oak','Karnes','DeWitt','Gonzales','Comal','Guadalupe','Frio','Atascosa','Wilson'].sort());
  assert.equal(await page.locator('.county').count(),254);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1100});
   await page.locator('#reset').click();await page.waitForTimeout(400);
   for(const zoomed of [false,true]){
    if(zoomed){await page.locator('#zoom-in').click();await page.waitForTimeout(300);}
    for(const [id,name] of [['ael-181','Air Evac Lifeteam 181'],['airmethods-uvalde','AirLIFE TEXAS 5']]){
     await page.mouse.move(0,0);
     if(await page.locator('#tooltip').isVisible())await page.locator('#tooltip .tip-close').click();
     await shared.click();
     assert((await page.locator('#detail h2').innerText()).includes('Garner Field'));
     await page.locator(`#detail [data-nearby-base="${id}"]`).click();
     assert((await page.locator('#detail h2').innerText()).includes(name));
    }
    assert.deepEqual(await geometry(),original,'Ring geometry changed');
   }
  }
  await page.locator('#search').fill('Lifeteam 181');
  assert.equal(await page.locator('.base-marker').count(),1);
  await page.locator('.base-marker').click();
  assert((await page.locator('#detail h2').innerText()).includes('181'));
  await page.locator('#search').fill('');
  await page.locator('#operators input[value="airevac"]').uncheck();
  assert.equal(await shared.count(),0);
  assert.equal(await page.locator('.base-marker[aria-label^="AirLIFE TEXAS 5"]').getAttribute('fill'),'#81522e');
  await page.locator('#operators input[value="airevac"]').check();
  assert.equal(await shared.count(),1);
  await page.locator('#reset').click();await page.waitForTimeout(400);
  if(process.env.SCREENSHOT_PATH){
   await page.setViewportSize({width:1440,height:1100});
   await page.mouse.move(0,0);
   await page.locator('#search').focus();
   if(await page.locator('#tooltip').isVisible())await page.locator('#tooltip .tip-close').click();
   await page.locator('.map-shell').screenshot({path:process.env.SCREENSHOT_PATH});
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,sharedUvaldeAtOriginalAELLocation:true,bothRecordsAccessible:true,highlightedCounties:highlighted,zoom:true,mobile:true,ringsUnchanged:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
