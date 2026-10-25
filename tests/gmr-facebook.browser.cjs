const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const directory=JSON.parse(fs.readFileSync(path.join(root,'assets/gmr-map/facebook-pages.json'),'utf8'));
assert.equal(directory.rows.length,66);
assert.equal(new Set(directory.rows.map(r=>r.id)).size,66);
assert.equal(directory.rows.filter(r=>r.scope==='Base page').length,49);
assert.equal(directory.rows.filter(r=>r.url).length,65);
assert.equal(new Set(directory.rows.filter(r=>r.url).map(r=>r.url)).size,58);
assert(directory.rows.every(r=>!r.url||new URL(r.url).hostname==='www.facebook.com'));
assert(!directory.rows.find(r=>r.id==='mt-alpine').url);
assert(directory.rows.find(r=>r.id==='guardian-dfb183a4').mapStatus.includes('Unconfirmed'));
assert.equal(directory.rows.find(r=>r.id==='airevac-4fa61cc2').scope,'Company page');
const url=process.argv[2]||pathToFileURL(path.join(root,'texas-gmr-air-medical-map.html')).href;
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1100}});
    // Repeatable navigation check without contacting Facebook.
    await context.route('https://www.facebook.com/**',route=>route.fulfill({contentType:'text/html',body:'Facebook navigation test'}));
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.waitForSelector('.base-marker');
    await page.locator('#candidates').check();
    const bases=await page.evaluate(()=>window.GMR_MAP_DATA.bases);
    for(const b of bases){
      const row=directory.rows.find(r=>r.id===b.id);
      await page.locator('#search').fill(b.name);
      await page.locator('.base-marker').hover();
      const links=page.locator('#tooltip a');
      assert.equal(await links.count(),row.url?1:0,b.name);
      if(row.url){assert.equal(await links.getAttribute('href'),row.url);assert((await page.locator('#tooltip').innerText()).includes(row.scope));}
      else assert((await page.locator('#tooltip').innerText()).includes('no matching base page confirmed'));
      await page.locator('.base-marker').focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('#detail .social-link a').count(),row.url?1:0);
      if(row.url)assert.equal(await page.locator('#detail .social-link a').getAttribute('href'),row.url);
    }
    await page.locator('#search').fill('San Antonio');await page.locator('.shared-marker').hover();
    assert.equal(await page.locator('#tooltip a').count(),2);
    const link=page.locator('#tooltip a').first();
    await link.hover();await page.waitForTimeout(450);
    assert(await page.locator('#tooltip').isVisible(),'Tooltip disappeared while moving to its link');
    const popupPromise=context.waitForEvent('page');await link.click();const popup=await popupPromise;
    await popup.waitForLoadState();assert.equal(popup.url(),'https://www.facebook.com/MethodistAirCare1/');await popup.close();
    await page.locator('#tooltip a').last().focus();await page.waitForTimeout(450);
    assert(await page.locator('#tooltip').isVisible());await page.keyboard.press('Escape');
    assert.equal(await page.locator('#tooltip').isVisible(),false);
    const out=process.env.SCREENSHOT_DIR;if(out)fs.mkdirSync(out,{recursive:true});
    for(const width of [390,768,1440]){
      await page.setViewportSize({width,height:1100});
      await page.locator('#search').fill('San Antonio');await page.locator('.shared-marker').focus();
      assert.equal(await page.locator('#tooltip a').count(),2);
      const tip=await page.locator('#tooltip').boundingBox(),shell=await page.locator('.map-shell').boundingBox();
      assert(tip.x>=shell.x&&tip.x+tip.width<=shell.x+shell.width+1);
      assert(tip.y>=shell.y&&tip.y+tip.height<=shell.y+shell.height+1);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      if(out)await page.locator('.map-shell').screenshot({path:path.join(out,`facebook-hover-${width}.png`)});
      await page.keyboard.press('Enter');assert.equal(await page.locator('#detail .social-link a').count(),2);
    }
    await page.goto(new URL('texas-gmr-facebook-directory.html',url).href);
    await page.waitForSelector('tr[data-base-id]');assert.equal(await page.locator('tr[data-base-id]').count(),66);
    assert.equal(await page.locator('#directory-rows a').count(),65);
    assert.equal(await page.locator('.group-row').first().innerText(),'San Antonio + southwest Texas');
    await page.locator('#directory-search').fill('San Antonio');assert.equal(await page.locator('tr[data-base-id]').count(),9);
    await page.locator('#directory-search').fill('');await page.locator('#directory-scope').selectOption('Not confirmed');
    assert.equal(await page.locator('tr[data-base-id]').count(),1);
    assert((await page.locator('#directory-rows').innerText()).includes('Alpine'));
    await page.locator('#directory-scope').selectOption('');
    for(const width of [390,1440]){await page.setViewportSize({width,height:1100});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(out)await page.screenshot({path:path.join(out,`facebook-directory-${width}.png`)});}
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,records:66,linkedRecords:65,uniquePages:58,baseSpecific:49,hoverLinksClickable:true,keyboard:true,sharedSAT:true,mobile:true}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
