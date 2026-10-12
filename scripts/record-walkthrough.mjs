import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.MARP_E2E_URL || 'http://localhost:5173';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:'artifacts/recording',size:{width:1600,height:900}}});
const page=await context.newPage();
const errors=[],events=[],jobs=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{const e=JSON.parse(String(payload));if(e.event)events.push(e);}catch{}}));
page.on('response',async r=>{if(r.url().endsWith('/ai/jobs')&&r.request().method()==='POST'&&r.status()===202)jobs.push((await r.json()).job_id);});
const caption=async text=>{await page.evaluate(text=>{let c=document.getElementById('walkthrough-caption');if(!c){c=document.createElement('div');c.id='walkthrough-caption';Object.assign(c.style,{position:'fixed',bottom:'24px',left:'50%',transform:'translateX(-50%)',padding:'14px 28px',borderRadius:'12px',background:'#101d32ee',color:'white',font:'500 18px system-ui',zIndex:'9999',boxShadow:'0 8px 30px #0003',pointerEvents:'none',textAlign:'center',maxWidth:'900px'});document.body.append(c);}c.textContent=text;},text);};
const pause=ms=>page.waitForTimeout(ms);
const jobDone=async()=>{const jobId=jobs.at(-1);await expect.poll(async()=>{const r=await context.request.get(base+'/api/v1/ai/jobs/'+jobId);const j=await r.json();if(j.status==='failed')throw Error(j.error?.message);return j.status;},{timeout:240000,intervals:[1000]}).toBe('completed');return jobId;};
let deckId;
try {
await page.goto(base);
await caption('MARP Studio / From an idea to a presentation you can refine.');
await pause(4500);
await page.getByRole('link',{name:'Dashboard',exact:true}).first().click();
await page.getByRole('tab',{name:'Create with AI',exact:true}).click();
await caption('Start with a clear message, an audience, and a useful outcome.');
await page.locator('#ai-slide-count').fill('2');
await page.locator('#create-ai-prompt').pressSequentially('Create a concise two-slide introduction to solar energy for beginners. Explain sunlight, panels and clean electricity. Use no images.',{delay:22});
await pause(2000);
await page.getByRole('button',{name:'Generate presentation',exact:true}).click();
await expect.poll(()=>jobs.length).toBe(1);
await caption('Live AI generation / Progress follows the real worker milestones.');
try { await jobDone(); } catch {
  await expect(page.getByRole('alert')).toBeVisible();
  await caption('If a provider response cannot be used, your prompt stays ready to retry.');
  await pause(2500);
  await page.getByRole('button',{name:'Generate presentation',exact:true}).click();
  await expect.poll(()=>jobs.length).toBe(2);
  await jobDone();
}
await page.waitForURL('**/editor/**',{timeout:20000});
await expect(page.locator('.split-editor')).toBeVisible();
await expect(page.locator('.split-preview')).toBeVisible();
await caption('Split View / Markdown, a live presentation, and your AI agent together.');
await pause(5500);
deckId=page.url().split('/').at(-1);
const before=await (await context.request.get(base+'/api/v1/presentations/'+deckId+'/slides')).json();
await page.screenshot({path:'artifacts/record-edit-before.png'});

await page.getByRole('button',{name:'Single Slide',exact:true}).click();
await page.locator('#studio-prompt').pressSequentially('Make this opening slide more concise and welcoming. Preserve its meaning.',{delay:28});
await caption('Single Slide / Refine the selected slide while the rest of your deck stays intact.');
await pause(2500);
const beforeEditJobs=jobs.length;
await page.getByRole('button',{name:'Run action',exact:true}).click();
await expect.poll(()=>jobs.length).toBe(beforeEditJobs+1);
await jobDone();
await expect(page.locator('#studio-prompt')).toBeEnabled({timeout:15000});
const after=await (await context.request.get(base+'/api/v1/presentations/'+deckId+'/slides')).json();
const rows=x=>Array.isArray(x)?x:x.items;
expect(rows(after).slice(1)).toEqual(rows(before).slice(1));
await caption('Choose a theme / Apply a consistent visual system to the whole presentation.');
await page.getByLabel('Presentation theme').selectOption('executive');
await pause(5000);
await page.getByRole('button',{name:'Hide AI Agent',exact:true}).click();
await caption('Make room for your work / Collapse the agent, then bring it back when needed.');
await pause(3000);
await page.getByRole('button',{name:'Show AI Agent',exact:true}).click();
await page.getByRole('button',{name:'Export',exact:true}).click();
await caption('Export / Share editable PowerPoint, styled HTML, Markdown, or print to PDF.');
await pause(4000);
await page.getByRole('button',{name:/PowerPoint \(\.pptx\)/}).click();
const download=page.waitForEvent('download');
await page.getByRole('button',{name:'Export Now'}).click();
await (await download).saveAs('artifacts/walkthrough.pptx');
await pause(3000);
await caption('Your presentation is saved / Continue editing, presenting, or sharing.');
await pause(4500);
await page.reload();await expect(page.locator('.split-preview')).toBeVisible();
expect((await (await context.request.get(base+'/api/v1/presentations/'+deckId)).json()).markdown).toContain('theme: executive');
} finally {
await writeFile('artifacts/live-recording-results.json',JSON.stringify({deckId,jobs,events,errors},null,2));
await context.close();
await writeFile('artifacts/recording-path.txt',await page.video().path());
await browser.close();
}
console.log(JSON.stringify({deckId,jobs,events:events.length,errors}));



