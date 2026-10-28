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
  const red=page.locator('.base-marker[aria-label^="Air Evac Lifeteam 181"]');
  const brown=page.locator('.base-marker[aria-label^="AirLIFE TEXAS 5"]');
  assert.equal(await red.getAttribute('fill'),'#b53942');
  assert.equal(await brown.getAttribute('fill'),'#81522e');
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1100});
   await page.locator('#reset').click();await page.waitForTimeout(400);
   for(const zoomed of [false,true]){
    if(zoomed){await page.locator('#zoom-in').click();await page.waitForTimeout(300);}
    const a=await red.boundingBox(),b=await brown.boundingBox();
    assert(a.x+a.width<b.x,'Red and brown dots overlap');
    for(const [marker,name] of [[red,'Air Evac Lifeteam 181'],[brown,'AirLIFE TEXAS 5']]){
     await page.mouse.move(0,0);
     if(await page.locator('#tooltip').isVisible())await page.locator('#tooltip .tip-close').click();
     await marker.click();
     assert((await page.locator('#detail h2').innerText()).includes(name));
    }
    assert.deepEqual(await geometry(),original,'Ring geometry changed');
   }
  }
  await page.locator('#search').fill('Lifeteam 181');
  assert.equal(await page.locator('.base-marker').count(),1);
  await red.click();
  assert((await page.locator('#detail h2').innerText()).includes('181'));
  await page.locator('#search').fill('');
  await page.locator('#reset').click();await page.waitForTimeout(400);
  if(process.env.SCREENSHOT_PATH){
   await page.setViewportSize({width:1440,height:1100});
   await page.locator('#search').fill('Uvalde');
   await page.locator('#list button').filter({hasText:'AirLIFE TEXAS 5'}).click();
   await page.waitForTimeout(450);await page.mouse.move(0,0);
   await page.locator('#search').focus();
   if(await page.locator('#tooltip').isVisible())await page.locator('#tooltip .tip-close').click();
   await page.locator('.map-shell').screenshot({path:process.env.SCREENSHOT_PATH});
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,bothUvaldeDotsClickable:true,colors:true,zoom:true,mobile:true,ringsUnchanged:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
