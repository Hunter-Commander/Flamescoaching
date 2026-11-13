import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
await mkdir(resolve(root,'dist/functions'),{recursive:true});
for(const file of ['index.html','coaching.html','coaching.css','app.mjs','config.js','firebase-client.mjs','persistence.mjs','sample.mjs','sw.js','manifest.webmanifest'])await copyFile(resolve(root,file),resolve(root,'dist',file));
await copyFile(resolve(root,'functions/domain.mjs'),resolve(root,'dist/functions/domain.mjs'));
if(process.env.FLAMES_DATA_MODE==='firebase'){
  const {config}=await import('../config.firebase.js');
  config.appCheckSiteKey=process.env.FLAMES_APPCHECK_SITE_KEY || config.appCheckSiteKey;
  if(!config.appCheckSiteKey)throw new Error('Firebase builds require FLAMES_APPCHECK_SITE_KEY. The sample is not a production fallback.');
  await writeFile(resolve(root,'dist/config.js'),`export const config = ${JSON.stringify(config,null,2)};\n`);
}
console.log('Built original tracker + coaching workspace in dist/.');
