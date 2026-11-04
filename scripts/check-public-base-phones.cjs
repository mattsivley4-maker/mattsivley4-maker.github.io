// Public map payloads must never contain base telephone fields.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..','assets','gmr-map');
function check(value,at){
  if(Array.isArray(value))return value.forEach((v,i)=>check(v,`${at}[${i}]`));
  if(value&&typeof value==='object')for(const [key,v] of Object.entries(value)){
    assert(!/phone/i.test(key),`Private base phone field in ${at}.${key}`);
    check(v,`${at}.${key}`);
  }
}
for(const file of ['data.js','map-only-data.js','regional-data.js','base-audit.json','regional-audit.json','regional-sites.json']){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  if(file.endsWith('.js')){
    const context={window:{}};vm.runInNewContext(source,context);check(context.window,file);
  }else check(JSON.parse(source),file);
}
for(const file of ['bases.csv','regional-bases.csv'])assert(!/phone/i.test(fs.readFileSync(path.join(root,file),'utf8').split('\n')[0]),file);
assert(!/tel:|phoneDetail|phoneText|base-phone/.test(fs.readFileSync(path.join(root,'map.js'),'utf8')));
console.log('Public base payloads and map UI contain no phone fields or telephone links.');
