const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const privateCopy=process.env.EXPECT_BASE_PHONES==='1';
 assert(!privateCopy||process.argv[2],'Admin check requires an explicit local admin URL');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.argv[2]||pathToFileURL(path.resolve(__dirname,'../texas-gmr-air-medical-map.html')).href);
  await page.waitForSelector('.base-marker');
  await page.locator('#candidates').check();
  const bases=await page.evaluate(()=>window.GMR_MAP_DATA.bases);
  const rings=await page.locator('.radius').evaluateAll(ns=>ns.map(n=>n.getAttribute('d')));
  assert.equal(bases.filter(b=>b.phone).length,privateCopy?56:0);
  if(!privateCopy){
   const leaks=await page.evaluate(()=>{
    const walk=v=>v&&typeof v==='object'&&Object.entries(v).some(([k,x])=>/phone/i.test(k)||walk(x));
    return walk(window.GMR_MAP_DATA)||walk(window.GMR_REGIONAL_DATA);
   });assert.equal(leaks,false,'No base phone fields in public payloads');
  }
  for(const b of bases){
   await page.locator('#search').fill(b.name);
   const marker=page.locator('.base-marker');assert.equal(await marker.count(),1,b.name);
   await marker.focus();
   const tip=await page.locator('#tooltip').innerText();
   if(privateCopy)assert(tip.includes(b.phone||(b.rosterEvidence?'Not listed (roster N/A)':'Not supplied')),b.name);
   else assert(!/Base phone:|roster N\/A|Not supplied/.test(tip),b.name);
   await page.keyboard.press('Enter');
   assert.equal(await page.locator('#detail a[href^="tel:"]').count(),privateCopy&&b.phone?1:0,b.name);
   assert.equal(await page.locator('#detail .base-phone').count(),privateCopy?1:0,b.name);
  }
  await page.locator('#search').fill('');
  assert.deepEqual(await page.locator('.radius').evaluateAll(ns=>ns.map(n=>n.getAttribute('d'))),rings);
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:1100});
   await page.locator('#search').fill('San Antonio');
   const marker=page.locator('.shared-marker');await marker.focus();
   const tip=await page.locator('#tooltip').innerText();
   const sat=bases.find(b=>b.siteGroup==='san-antonio-international'&&b.phone);
   if(privateCopy)assert(tip.includes(sat.phone));else assert(!/Base phone:|roster N\/A|Not supplied/.test(tip));
   await page.keyboard.press('Enter');
   assert.equal(await page.locator('#detail a[href^="tel:"]').count(),privateCopy?1:0);
   assert.equal(await page.locator('#detail .base-phone').count(),privateCopy?2:0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  assert.equal(await page.locator('.hospital-flag').count(),348);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,view:privateCopy?'local admin':'public',basesChecked:bases.length,phoneRecords:privateCopy?56:0,sharedAirport:true,keyboard:true,mobile:true,ringsUnchanged:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
