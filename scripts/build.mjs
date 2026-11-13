import {mkdir,copyFile,writeFile,rm,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {config as sample} from '../config.js';
import {config as firebase} from '../config.firebase.js';
import {resolveBuildConfig} from './build-config.mjs';
const root=resolve(import.meta.dirname,'..');
// Validate before modifying the previous output. Never deploy a sample fallback.
const {config,mode,production}=resolveBuildConfig({env:process.env,args:process.argv.slice(2),sample,firebase});
const output=resolve(root,'dist');
if(output!==root+'\\dist' && output!==root+'/dist')throw new Error('Unexpected build-output path.');
await rm(output,{recursive:true,force:true});
await mkdir(resolve(output,'functions'),{recursive:true});
for(const file of ['index.html','coaching.html','coaching.css','app.mjs','config.js','firebase-client.mjs','persistence.mjs','sample.mjs','sw.js','manifest.webmanifest'])await copyFile(resolve(root,file),resolve(root,'dist',file));
await copyFile(resolve(root,'functions/domain.mjs'),resolve(root,'dist/functions/domain.mjs'));
await writeFile(resolve(output,'config.js'),`export const config = ${JSON.stringify(config,null,2)};\n`);
if(production){
  await copyFile(resolve(output,'index.html'),resolve(output,'tracker.html'));
  await copyFile(resolve(output,'coaching.html'),resolve(output,'index.html'));
  const app=await readFile(resolve(output,'app.mjs'),'utf8');
  await writeFile(resolve(output,'app.mjs'),app.replace('href="index.html">Open tracker','href="tracker.html">Open tracker'));
}
const files={};
for(const file of ['index.html','coaching.html','coaching.css','app.mjs','config.js','firebase-client.mjs','persistence.mjs','functions/domain.mjs',...(production?['tracker.html']:[])])files[file]=createHash('sha256').update(await readFile(resolve(output,file))).digest('hex');
await writeFile(resolve(output,'release.json'),JSON.stringify({schemaVersion:1,mode,production,entrypoint:production?'coaching':'tracker',projectId:config.firebase?.projectId || null,appCheckConfigured:!!config.appCheckSiteKey,files},null,2));
console.log(`Built ${mode} workspace in dist/${production?' (production)':''}.`);
