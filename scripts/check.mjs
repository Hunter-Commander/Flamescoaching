import {readdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');let count=0;
async function walk(dir=root){
 for(const item of await readdir(dir,{withFileTypes:true})){
  if(['node_modules','dist','.git','.openai'].includes(item.name))continue;
  const file=join(dir,item.name);
  if(item.isDirectory())await walk(file);
  else if(/\.(mjs|js)$/.test(item.name)){
   const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
   if(r.status!==0)throw new Error(r.stderr||r.error?.message);count++;
  }
 }
}
await walk();
const html=await readFile(join(root,'Flames-Coaching-Preview.html'),'utf8');
const code=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if(!code)throw new Error('Standalone preview module missing.');
const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:code,encoding:'utf8'});
if(result.status!==0)throw new Error(result.stderr);
console.log(`Syntax verified: ${count} source modules and standalone preview.`);
