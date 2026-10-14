// Run with Playwright installed; optional first argument is the deployed page URL.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs');

(async()=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1100}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.argv[2] || pathToFileURL(path.resolve(__dirname,'../texas-gmr-air-medical-map.html')).href);
    await page.waitForSelector('.base-marker');
    const preview=page.locator('.aircraft-hover-icon');
    const geometry=await page.locator('.radius').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d')));
    const screenshotDir=process.env.SCREENSHOT_DIR;
    if(screenshotDir) fs.mkdirSync(screenshotDir,{recursive:true});
    const cases=[['rotor','Uvalde'],['fixed','AirMed International - Dallas'],['mixed','AeroCare I + III'],['unknown','AeroCare - Alpine'],['mixed','San Antonio']];
    for(const [kind,query] of cases){
      await page.locator('#search').fill(query);
      const marker=page.locator('.base-marker');
      assert.equal(await marker.count(),1,query);
      assert.equal(await marker.getAttribute('data-aircraft'),kind);
      await marker.hover();
      assert.match(await page.locator('#tooltip').innerText(),kind==='unknown'?/aircraft type unconfirmed/:/Rotor|Fixed|fixed/);
      if(kind==='unknown'){
        assert.equal(await preview.isVisible(),false);
        assert.equal(await marker.evaluate(n=>getComputedStyle(n).opacity),'1');
      }else{
        assert(await preview.isVisible());
        assert.equal(await preview.getAttribute('data-aircraft'),kind);
        assert.equal(await preview.locator('use').first().getAttribute('href'),`#aircraft-${kind}`);
        assert.equal(await marker.evaluate(n=>getComputedStyle(n).opacity),'0');
        const box=await preview.boundingBox();
        const center=await marker.evaluate(n=>{
          const p=n.ownerSVGElement.createSVGPoint();
          if(n.tagName==='circle'){p.x=+n.getAttribute('cx');p.y=+n.getAttribute('cy');}
          const q=p.matrixTransform(n.getScreenCTM());return {x:q.x,y:q.y};
        });
        assert(Math.abs(box.x+box.width/2-center.x)<2);
        assert(Math.abs(box.y+box.height/2-center.y)<2);
        assert(box.width>10 && box.width<30 && box.height>10 && box.height<30);
        // Wings remain inside the expanded hit target, without flickering back to a pin.
        await page.mouse.move(center.x+5,center.y);
        assert(await preview.isVisible());
        if(screenshotDir)await page.locator('.map-shell').screenshot({path:path.join(screenshotDir,`${query.replace(/[^a-z0-9]+/gi,'-')}.png`)});
      }
      await page.mouse.move(10,10);
      assert.equal(await preview.isVisible(),false);
      await marker.focus();
      assert.equal(await preview.isVisible(),kind!=='unknown');
      await page.keyboard.press('Enter');
      assert((await page.locator('#detail').innerText()).length>100);
      await page.locator('#search').focus();
      assert.equal(await preview.isVisible(),false);
    }
    await page.locator('#search').fill('San Antonio');
    await page.locator('.shared-marker').hover();
    assert(await preview.locator('.aircraft-secondary').isVisible());
    await page.locator('#operators input[value="airmed"]').uncheck();
    assert.equal(await preview.isVisible(),false);
    await page.locator('.base-marker').hover();
    assert.equal(await preview.getAttribute('data-aircraft'),'rotor');
    await page.locator('#operators input[value="airmed"]').check();
    await page.locator('#search').fill('Uvalde');
    await page.locator('.base-marker').focus();
    const before=await preview.boundingBox();
    await page.locator('#zoom-in').evaluate(n=>n.click());
    await page.waitForTimeout(300);
    const after=await preview.boundingBox();
    assert(Math.abs(before.width-after.width)<0.1,'Icon grows with zoom');
    assert(Math.abs(before.height-after.height)<0.1,'Icon grows with zoom');
    await page.locator('#search').fill('');
    assert.deepEqual(await page.locator('.radius').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d'))),geometry,'Ring geometry changed');
    await page.locator('#reset').click();
    await page.waitForTimeout(350);
    for(const width of [390,768,1440]){
      await page.setViewportSize({width,height:1000});
      await page.locator('#search').fill('San Antonio');
      await page.locator('.shared-marker').focus();
      assert(await preview.isVisible());
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,aircraftCases:cases,zoomSizeStable:true,ringGeometryUnchanged:true,keyboard:true,viewports:[390,768,1440]}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
