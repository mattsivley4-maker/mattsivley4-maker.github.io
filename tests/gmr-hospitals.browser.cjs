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
  await page.waitForSelector('.hospital-flag');
  const rings=await page.locator('.radius').evaluateAll(ns=>ns.map(n=>n.getAttribute('d')));
  assert.equal(await page.locator('.hospital-flag').count(),348);
  assert.equal(await page.locator('#hospital-records tr').count(),348);
  assert.equal(await page.locator('#hospital-results .hospital-record').count(),348);
  for(const [level,count] of [['1',22],['2',31],['3',62],['4',174],['none',59]])assert.equal(await page.locator(`.hospital-flag[data-level="${level}"]`).count(),count);
  assert.equal(await page.locator('.county').count(),254);
  assert.equal(await page.locator('.highlighted-county').count(),12);
  await page.locator('#hospital-levels input[value="none"]').uncheck();
  assert.equal(await page.locator('.hospital-flag').count(),289);
  await page.locator('#hospitals-visible').uncheck();
  assert.equal(await page.locator('.hospital-flag').count(),0);
  await page.locator('#hospitals-visible').check();
  await page.locator('#hospital-levels input[value="none"]').check();
  // Statewide facilities must be searchable, selectable and correctly colored.
  for(const [query,level] of [['William Beaumont','3'],['Parkland','1'],['Clements','4'],['OakBend','4']]){
   await page.locator('#hospital-search').fill(query);
   const found=page.locator('.hospital-flag');
   assert.equal(await found.count(),query==='OakBend'?2:1);
   assert.equal(await found.first().getAttribute('data-level'),level);
   await found.first().focus();await page.keyboard.press('Enter');
   assert.match(await page.locator('#hospital-detail h2').innerText(),new RegExp(query,'i'));
  }
  // Each trauma tier independently hides and restores its flags.
  for(const [level,count] of [['1',22],['2',31],['3',62],['4',174]]){
   await page.locator(`#hospital-levels input[value="${level}"]`).uncheck();
   assert.equal(await page.locator('.hospital-flag').count(),348-count);
   await page.locator(`#hospital-levels input[value="${level}"]`).check();
  }
  await page.locator('#hospital-search').fill('Cuero');
  assert.equal(await page.locator('.hospital-flag').count(),1);
  const flag=page.locator('.hospital-flag');
  await flag.hover();assert.match(await page.locator('#hospital-tooltip').innerText(),/Cuero/);
  await flag.click();assert.match(await page.locator('#hospital-detail').innerText(),/DeWitt/);
  await page.locator('#hospital-search').fill('Cuero');
  await flag.focus();assert.match(await page.locator('#hospital-tooltip').innerText(),/Contingent/);
  await page.keyboard.press('Enter');assert.match(await page.locator('#hospital-detail').innerText(),/DeWitt/);
  assert.equal(await page.locator('#hospital-detail .sources a').count(),3);
  // Identical coordinates must not hide the other facility's record.
  await page.locator('#hospital-search').fill('Shoreline');
  await page.locator('.hospital-flag').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#hospital-detail .hospital-peers button').count(),2);
  await page.locator('#hospital-detail .hospital-peers button').filter({hasText:'Oceans'}).click();
  assert.match(await page.locator('#hospital-detail h2').innerText(),/Oceans/);
  assert.match(await page.locator('#hospital-detail .hospital-badge').innerText(),/No trauma designation/);
  await page.waitForTimeout(400);
  // Base records remain selectable with all hospital flags enabled.
  await page.locator('#reset').click();await page.waitForTimeout(400);
  await page.locator('.shared-marker[aria-label^="Uvalde:"]').click();
  assert.match(await page.locator('#detail h2').innerText(),/Garner Field/);
  assert.deepEqual(await page.locator('.radius').evaluateAll(ns=>ns.map(n=>n.getAttribute('d'))),rings);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1100});
   await page.locator('#hospital-search').fill('Brooke Army');
   await page.locator('.hospital-controls details summary').click();
   await page.locator('#hospital-results .hospital-record').click();await page.waitForTimeout(450);
   assert.match(await page.locator('#hospital-detail h2').innerText(),/Brooke Army/);
   assert.equal(await page.locator('#hospital-detail .hospital-badge').innerText(),'Level I');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
   await page.locator('.hospital-controls details summary').click();
  }
  await page.setViewportSize({width:1440,height:1100});
  await page.locator('#hospital-detail .hospital-close').click();
  await page.locator('#hospital-fit').click();await page.waitForTimeout(450);
  await page.mouse.move(0,0);await page.keyboard.press('Escape');
  if(process.env.SCREENSHOT_PATH)await page.locator('.map-column').screenshot({path:process.env.SCREENSHOT_PATH});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,hospitals:348,trauma:289,gray:59,filters:true,search:true,coLocatedRecordsAccessible:true,baseAccess:true,mobile:true,ringsUnchanged:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
