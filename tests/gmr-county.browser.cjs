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
    const bases=await page.evaluate(()=>window.GMR_MAP_ONLY_DATA.bases);
    const excluded=new Set(bases.filter(b=>/fixed/i.test(b.mode)&&!/rotor/i.test(b.mode)).map(b=>b.id));
    for(const row of rows)row.matches=row.matches.filter(m=>!excluded.has(m.id));
    // Use the state view for an actual pointer hit: regional expansion can make
    // small counties narrower than nearby base markers at the default extent.
    await page.locator('#state-view').selectOption('TX');
    const bexar=page.locator('[data-county="Bexar"]');
    const hit=await bexar.evaluate(el=>{const box=el.getBoundingClientRect();for(let y=box.top+3;y<box.bottom;y+=3)for(let x=box.left+3;x<box.right;x+=3)if(document.elementFromPoint(x,y)===el)return {x,y};});
    assert(hit,'County must have a clickable area outside base markers');
    await page.mouse.move(hit.x,hit.y);assert.equal(await page.locator('#selection').isVisible(),false);
    // Real pointer click, not hover, opens the panel.
    await page.mouse.click(hit.x,hit.y);assert((await page.locator('#selection h2').innerText()).includes('Bexar'));
    await page.keyboard.press('Escape');
    for(const row of rows){
      await page.locator(`[data-geoid="${row.id}"]`).dispatchEvent('click');
      assert.equal(await page.locator('.county-selected').getAttribute('data-geoid'),row.id);
      assert.equal(await page.locator('#selection h2').innerText(),`${row.name} ${row.state==='LA'?'Parish':'County'}, ${row.state}`);
      assert.equal(await page.locator('.radius.active').count(),row.matches.length,row.name);
      assert.equal(await page.locator('.radius.county-muted').count(),bases.length-row.matches.length);
      const list=await page.locator('.county-base-list li').evaluateAll(items=>items.map(el=>el.dataset.baseId));
      assert.deepEqual(list,row.matches.map(m=>m.id),row.name);
      assert((await page.locator('.county-base-list a').count())<=row.matches.length);
      assert.equal(await page.locator('.radius.active').evaluateAll(nodes=>nodes.filter(el=>/fixed/i.test(el.__data__.mode)&&!/rotor/i.test(el.__data__.mode)).length),0);
      if(!row.matches.length)assert((await page.locator('#selection').innerText()).includes('No eligible mapped base radius'));
    }
    // Hospital aviation partnerships qualify even when absent from membership lists.
    await page.locator('[data-geoid="55085"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list li').first().getAttribute('data-base-id'),'mt-wi-aspirus-1');
    assert.equal(await page.locator('.county-base-list [data-base-id="mt-wi-aspirus-2"]').count(),1);
    await page.locator('[data-geoid="55073"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list li').first().getAttribute('data-base-id'),'mt-wi-aspirus-2');
    // Minnesota mixed airport site is eligible through its helicopter program.
    await page.locator('[data-geoid="27061"]').dispatchEvent('click');
    assert((await page.locator('#selection h2').innerText()).includes('Itasca'));
    assert.deepEqual(await page.locator('.county-base-list li').evaluateAll(els=>els.map(e=>e.dataset.baseId)),['gf-mn-grand-rapids']);
    assert.equal(await page.locator('.radius.active').count(),1);
    // ND must not imply the unresolved Williston launch site or future Watford base is mapped.
    await page.locator('[data-geoid="38105"]').dispatchEvent('click');
    assert((await page.locator('#selection').innerText()).includes('Williston fixed-wing launch location unresolved'));
    assert.equal(await page.locator('.county-base-list li').count(),0);
    assert.equal(await page.locator('.radius.active').count(),0);
    // SD is selectable, with incomplete neighboring inventory stated explicitly.
    await page.locator('[data-geoid="46103"]').dispatchEvent('click');
    assert((await page.locator('#selection').innerText()).includes('No current in-state GMR bases verified in South Dakota'));
    assert.equal(await page.locator('.county-base-list [data-base-id="gf-wy-030"]').count(),0);
    // Wyoming includes rotor programs and excludes separate fixed-wing bases.
    await page.locator('[data-geoid="56013"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="gf-wy-204"]').count(),1);
    assert.equal(await page.locator('.county-base-list [data-base-id="gf-wy-029"]').count(),0);
    await page.locator('[data-geoid="56021"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="reach-wy-70"]').count(),1);
    await page.locator('[data-geoid="56025"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="mt-wy-289"]').count(),1);
    await page.locator('[data-geoid="56005"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="gf-wy-030"]').count(),0);
    // Colorado rotor bases qualify; the separate Alamosa fixed-wing site does not.
    await page.locator('[data-geoid="08003"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="gf-co-203"]').count(),1);
    assert.equal(await page.locator('.county-base-list [data-base-id="gf-co-015"]').count(),0);
    await page.locator('[data-geoid="08069"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="reach-co-30"]').count(),1);
    await page.locator('[data-geoid="08005"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="gf-co-071"]').count(),0);
    // Alabama includes the dedicated pediatric helicopter, not AirMed's airport reference.
    await page.locator('[data-geoid="01073"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="ami-birmingham"]').count(),0);
    assert.equal(await page.locator('.county-base-list [data-base-id="mt-al-childrens"]').count(),1);
    await page.locator('[data-geoid="01083"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="ael-177"]').count(),1);
    // Mississippi fixed-wing AirCare 5 stays on the map but not in county helicopter lists.
    await page.locator('[data-geoid="28121"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="gf-ms-292"]').count(),0);
    assert.equal(await page.locator('.county-base-list [data-base-id="mt-ms-175"]').count(),1);
    await page.locator('[data-geoid="28001"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="ael-99"]').count(),1);
    // Both Jackson programs qualify; shared Memphis/Paris facilities are counted once each.
    await page.locator('[data-geoid="47113"]').dispatchEvent('click');
    for(const id of ['ael-7','ael-188'])assert.equal(await page.locator(`.county-base-list [data-base-id="${id}"]`).count(),1);
    await page.locator('[data-geoid="47079"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="ael-159"]').count(),1);
    assert((await page.locator('.county-base-list [data-base-id="ael-159"]').innerText()).includes('123 / 159'));
    await page.locator('[data-geoid="47157"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="mt-tn-257"]').count(),1);
    // Louisiana uses parish labels, including accessible names and result distances.
    await page.locator('[data-geoid="22003"]').dispatchEvent('click');
    assert.equal(await page.locator('#selection h2').innerText(),'Allen Parish, LA');
    assert((await page.locator('[data-geoid="22003"]').getAttribute('aria-label')).startsWith('Allen Parish, LA'));
    assert.equal(await page.locator('.county-base-list [data-base-id="airevac-eb3025e4"]').count(),1);
    assert((await page.locator('.county-base-list [data-base-id="airevac-eb3025e4"] .county-distance').innerText()).includes('Inside parish'));
    assert(!/county/i.test(await page.locator('#selection').innerText()));
    await page.locator('[data-geoid="22097"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="ael-124"]').count(),1);
    // Wichita's shared rotor/fixed site qualifies; Kansas fixed-only sites do not.
    await page.locator('[data-geoid="20173"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="mt-eaglemed-wichita"]').count(),1);
    assert(await page.locator('.radius.active').evaluateAll(nodes=>nodes.some(el=>el.__data__.id==='mt-eaglemed-wichita')));
    // Arkansas's relocated rotor base is represented in its new county.
    await page.locator('[data-geoid="05071"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="ael-22"]').count(),1);
    assert((await page.locator('.county-base-list [data-base-id="ael-22"]').innerText()).includes('Clarksville'));
    // Gallup's mixed site qualifies for NM counties; closed/withheld records do not.
    await page.locator('[data-geoid="35031"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="gfl-gallup-airport"]').count(),1);
    assert(await page.locator('.radius.active').evaluateAll(nodes=>nodes.some(el=>el.__data__.id==='gfl-gallup-airport')));
    // Border-state rotor bases remain; SAT's county list contains only AEL 148.
    await page.locator('[data-county="Lubbock"]').dispatchEvent('click');
    assert.equal(await page.locator('.county-base-list [data-base-id="medtrans-46bff629"]').count(),1,'Mixed AeroCare I + III must remain included');
    assert(await page.locator('.radius.active').evaluateAll(nodes=>nodes.some(el=>el.__data__.id==='medtrans-46bff629')));
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
    assert.equal(await page.locator('.radius').count(),bases.length);
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
