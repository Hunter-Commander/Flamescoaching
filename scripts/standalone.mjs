// A reviewable device-only version that opens without a development server.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFile(resolve(root,p),'utf8');
const css=await read('coaching.css');
const sources=await Promise.all(['functions/domain.mjs','persistence.mjs','sample.mjs','app.mjs'].map(read));
let code=sources.map(s=>s.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
// The sample module has its own uid helper; app defines uuid, so these do not collide.
code="const config={firebase:null};\n"+code;
let html=await read('coaching.html');
html=html.replace('<link rel="stylesheet" href="coaching.css">',`<style>${css}</style>`).replace('<script type="module" src="app.mjs"></script>',`<script type="module">${code.replace(/<\/script/gi,'<\\/script')}</script>`);
await writeFile(resolve(root,'Flames-Coaching-Preview.html'),html);
console.log('Created Flames-Coaching-Preview.html (device-only sample).');
