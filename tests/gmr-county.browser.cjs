const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.argv[2]||pathToFileURL(path.join(root,'texas-gmr-air-medical-map-only.html')).href);
    await page.waitForSelector('.base-marker');
    const rows=await page.evaluate(()=>window.GMR_COUNTY_COVERAGE.counties);
    const excluded=new Set(['ami-dallas','ami-sat','medtrans-6cd167c1','medtrans-6faee751','medtrans-46bff629','mt-airmed2']);
    for(const row of rows)row.matches=row.matches.filter(m=>!excluded.has(m.id));
    const bexar=page.locator('[data-county="Bexar"]');
    const hit=await bexar.evaluate(el=>{const box=el.getBoundingClientRect();for(let y=box.top+3;y<box.bottom;y+=3)for(let x=box.left+3;x<box.right;x+=3)if(document.elementFromPoint(x,y)===el)return {x,y};});
    assert(hit,'County must have a clickable area outside base markers');
    await page.mouse.move(hit.x,hit.y);assert.equal(await page.locator('#selection').isVisible(),false);
    // Real pointer click, not hover, opens the panel.
    await page.mouse.click(hit.x,hit.y);assert((await page.locator('#selection h2').innerText()).includes('Bexar'));
    await page.keyboard.press('Escape');
    for(const row of rows){
      await page.locator(`[data-county="${row.name}"]`).dispatchEvent('click');
      assert.equal(await page.locator('.county-selected').getAttribute('data-county'),row.name);
      assert.equal(await page.locator('.radius.active').count(),row.matches.length,row.name);
      assert.equal(await page.locator('.radius.county-muted').count(),63-row.matches.length);
      const list=await page.locator('.county-base-list li').evaluateAll(items=>items.map(el=>el.dataset.baseId));
      assert.deepEqual(list,row.matches.map(m=>m.id),row.name);
      assert.equal(await page.locator('.county-base-list a').count(),row.matches.length);
      assert.equal(await page.locator('.radius.active').evaluateAll(nodes=>nodes.filter(el=>el.__data__.operator==='airmed'||/fixed/i.test(el.__data__.mode)).length),0);
      if(!row.matches.length)assert((await page.locator('#selection').innerText()).includes('No eligible base radius'));
    }
    // Border-state rotor bases remain; SAT's county list contains only AEL 148.
    const bases=await page.evaluate(()=>window.GMR_MAP_ONLY_DATA.bases);
    assert(rows.some(r=>r.matches.some(m=>bases.find(b=>b.id===m.id).state!=='TX')));
    await bexar.focus();await page.keyboard.press('Enter');
    for(const b of bases.filter(b=>b.siteGroup==='san-antonio-international'))assert.equal(await page.locator(`.county-base-list [data-base-id="${b.id}"]`).count(),b.operator==='airmed'?0:1);
    const muted=await page.locator('.radius.county-muted').first().evaluate(el=>getComputedStyle(el).stroke);
    assert.equal(muted,'rgb(170, 182, 188)');
    await page.locator('#close-selection').click();
    assert.equal(await page.locator('.county-selected,.county-muted,.radius.active').count(),0);
    await page.locator('#search').fill('Uvalde');
    await page.locator('#rings').uncheck();
    await bexar.focus();await page.keyboard.press('Space');
    assert.equal(await page.locator('#search').inputValue(),'');
    assert(await page.locator('#rings').isChecked());
    assert.equal(await page.locator('.radius').count(),63);
    await page.locator('#labels').check();
    assert.equal(await page.locator('.county-selected').count(),1);
    await page.locator('#search').fill('San Antonio');
    assert.equal(await page.locator('.county-selected').count(),0);
    await page.locator('#search').fill('');
    await page.locator('#labels').uncheck();
    const out=process.env.SCREENSHOT_DIR;if(out)fs.mkdirSync(out,{recursive:true});
    for(const [width,height] of [[390,844],[768,1024],[1440,900]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(180);
      await bexar.focus();await page.keyboard.press('Enter');
      const panel=await page.locator('#selection').boundingBox();
      assert(panel.x>=0&&panel.x+panel.width<=width&&panel.y>=0&&panel.y+panel.height<=height);
      if(width<=700){const countyBox=await bexar.boundingBox();assert(countyBox.y+countyBox.height<panel.y,'Selected county must remain above mobile panel');}
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert(await page.locator('#selection').evaluate(el=>el.scrollHeight>el.clientHeight));
      const lastLink=page.locator('.county-base-list a').last();await lastLink.scrollIntoViewIfNeeded();
      assert(await lastLink.isVisible());
      await page.locator('#selection').evaluate(el=>el.scrollTop=0);
      if(out)await page.screenshot({path:path.join(out,`county-bexar-${width}.png`)});
    }
    await page.locator('#zoom-in').click();await page.waitForTimeout(250);
    assert.equal(await page.locator('.county-selected').count(),1);
    await page.locator('#reset').click();
    assert.equal(await page.locator('#selection').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,counties:rows.length,allListsAndRings:true,clickOnly:true,keyboard:true,borderBases:true,sharedSAT:true,mobile:true}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
