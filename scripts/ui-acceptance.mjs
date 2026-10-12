import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.MARP_E2E_URL || 'http://localhost:5173';
await mkdir('artifacts', { recursive: true });
const b=await chromium.launch();
const context=await b.newContext({viewport:{width:1440,height:1000}});
const p=await context.newPage();
const errors=[],results={};p.on('pageerror',e=>errors.push(e.message));
try{
 const r=await context.request.post(base+'/api/v1/presentations',{data:{title:'Formatting acceptance',markdown:'# Formatting\n\nOriginal content'}});expect(r.ok()).toBeTruthy();const deck=await r.json();
 await p.goto(base+'/editor/'+deck.id);await expect(p.locator('.split-editor')).toBeVisible();
 const cm=p.locator('.split-editor .cm-content');
 const controls=['Heading 1','Heading 2','Heading 3','Bold','Italic','Code / Block','Blockquote','Bulleted List','Numbered List','Table','Insert Link','Insert Image','New Slide Separator (---)'];
 for(const name of controls){
  await cm.click();await p.keyboard.press('Control+End');const before=await cm.innerText();
  await p.getByRole('button',{name,exact:true}).click();await expect.poll(()=>cm.innerText()).not.toBe(before);
  const changed=await cm.innerText();await p.keyboard.press('Control+z');await expect.poll(()=>cm.innerText()).toBe(before);
  await p.keyboard.press('Control+y');await expect.poll(()=>cm.innerText()).toBe(changed);
  await p.keyboard.press('Control+z');results[name]=true;
 }
 for(const name of ['Lead Slide (Centered Hero)','Invert Slide (Dark Mode)','Dark Navy Background','Accent Blue Background','Enable Slide Number','Add Slide Header','Add Slide Footer']){
  await cm.click();await p.keyboard.press('Control+End');const before=await cm.innerText();
  await p.getByRole('button',{name:'Directives',exact:true}).click();
  await p.getByRole('button',{name:new RegExp(name.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&'))}).click();
  await expect.poll(()=>cm.innerText()).not.toBe(before);await p.keyboard.press('Control+z');results[name]=true;
 }
 await p.getByLabel('Presentation theme').selectOption('swiss');await expect(p.locator('.split-preview .marp-theme-swiss')).toBeVisible();
 await p.getByRole('button',{name:'Editor',exact:true}).click();await expect(p.locator('.split-design-toolbar')).toHaveCount(0);await expect(p.locator('.cm-content')).toBeVisible();
 await p.getByRole('button',{name:'Split View',exact:true}).click();results.controls=true;
 for(const width of [1440,768,390]){
  await p.setViewportSize({width,height:1000});await p.reload();await expect(p.locator('.split-editor')).toBeVisible();
  expect(await p.locator('body').evaluate(e=>e.scrollWidth<=window.innerWidth)).toBeTruthy();
  await expect(p.getByRole('button',{name:'Export',exact:true})).toBeInViewport();
  await p.locator('#split-agent').scrollIntoViewIfNeeded();await expect(p.getByRole('button',{name:'Single Slide',exact:true})).toBeVisible();
  await p.screenshot({path:'artifacts/workspace-'+width+'.png'});
  await p.goto(base);await p.waitForTimeout(1500);
  await p.locator('.hero-wordmark').scrollIntoViewIfNeeded();
  const geometry=await p.locator('.hero-wordmark-mask').evaluate(e=>{const r=e.getBoundingClientRect(),span=e.firstElementChild;const range=document.createRange();range.selectNodeContents(span);const t=range.getBoundingClientRect();return {left:t.left>=r.left-1,right:t.right<=r.right+1,inside:r.right<=window.innerWidth+1};});
  expect(geometry).toEqual({left:true,right:true,inside:true});
  await p.screenshot({path:'artifacts/hero-'+width+'.png'});
  await p.locator('.system-journey').scrollIntoViewIfNeeded();await p.waitForTimeout(1200);
  const collision=await p.locator('.timeline-step').evaluateAll(nodes=>nodes.some(n=>{const a=n.querySelector('.timeline-icon').getBoundingClientRect();return [...n.querySelectorAll('h3,p')].some(t=>{const r=t.getBoundingClientRect();return a.left<r.right&&a.right>r.left&&a.top<r.bottom&&a.bottom>r.top;});}));
  expect(collision).toBe(false);await p.screenshot({path:'artifacts/timeline-'+width+'.png'});
  results['responsive'+width]=true;
  await p.goto(base+'/editor/'+deck.id);
 }
 await p.goto(base);const video=p.locator('video.tour-video');await video.scrollIntoViewIfNeeded();
 await expect.poll(()=>video.evaluate(e=>e.readyState)).toBeGreaterThan(0);
 expect(await video.evaluate(e=>e.duration)).toBeGreaterThanOrEqual(60);expect(await video.evaluate(e=>e.duration)).toBeLessThanOrEqual(90);
 await video.evaluate(e=>{e.muted=true;return e.play();});await p.waitForTimeout(1100);
 expect(await video.evaluate(e=>e.currentTime)).toBeGreaterThan(0);
 await video.evaluate(e=>e.pause());expect(await video.evaluate(e=>e.paused)).toBe(true);
 await video.evaluate(e=>new Promise(r=>{e.onseeked=r;e.currentTime=35;}));expect(await video.evaluate(e=>e.currentTime)).toBeCloseTo(35,0);
 expect(await video.evaluate(e=>e.controls&&e.muted)).toBe(true);results.video=true;
 expect(errors).toEqual([]);
} catch(e){results.failure=e.message;await p.screenshot({path:'artifacts/ui-failure.png'});throw e;}
finally{await writeFile('artifacts/ui-acceptance.json',JSON.stringify({results,errors},null,2));await b.close();}
console.log(JSON.stringify(results));


