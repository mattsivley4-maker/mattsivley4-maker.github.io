// Run with Playwright installed; optional URL checks the deployed artifact.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');

(async()=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.argv[2] || pathToFileURL(path.resolve(__dirname,'../texas-gmr-air-medical-map.html')).href);
    await page.waitForSelector('.base-marker');
    await page.locator('#candidates').check();
    const bases=await page.evaluate(()=>window.GMR_MAP_DATA.bases);
    for(const b of bases){
      await page.locator('#search').fill(b.name);
      const marker=page.locator('.base-marker');
      assert.equal(await marker.count(),1,b.name);
      await marker.hover();
      const tooltip=await page.locator('#tooltip').innerText();
      assert(tooltip.includes(b.phone || (b.rosterEvidence?'Not listed (roster N/A)':'Not supplied')),b.name);
      await page.mouse.move(5,5);
      await marker.focus();
      assert(await page.locator('#tooltip').isVisible(),'Keyboard tooltip missing: '+b.name);
      await page.keyboard.press('Enter');
      const links=page.locator('#detail a[href^="tel:"]');
      assert.equal(await links.count(),b.phone?1:0,b.name);
      if(b.phone) assert.equal(await links.getAttribute('href'),`tel:+1${b.phone.replace(/\D/g,'')}`);
    }
    const out=process.env.SCREENSHOT_DIR;
    if(out) fs.mkdirSync(out,{recursive:true});
    for(const width of [390,768,1440]){
      await page.setViewportSize({width,height:1100});
      await page.locator('#search').fill('San Antonio');
      const marker=page.locator('.shared-marker');
      await marker.focus();
      const text=await page.locator('#tooltip').innerText();
      assert(text.includes('210-592-8646') && text.includes('Not supplied'));
      const tip=await page.locator('#tooltip').boundingBox();
      const shell=await page.locator('.map-shell').boundingBox();
      assert(tip.x>=shell.x && tip.x+tip.width<=shell.x+shell.width+1);
      assert(tip.y>=shell.y && tip.y+tip.height<=shell.y+shell.height+1);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#detail a[href^="tel:"]').count(),1);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      if(out){
        await page.locator('.map-shell').screenshot({path:path.join(out,`phones-map-${width}.png`)});
        await page.locator('#detail').screenshot({path:path.join(out,`phones-detail-${width}.png`)});
      }
    }
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,recordsChecked:bases.length,phoneRecords:bases.filter(b=>b.phone).length,keyboard:true,sharedPin:true,telLinks:true,viewports:[390,768,1440]}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
