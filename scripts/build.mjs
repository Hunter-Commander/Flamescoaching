import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
await mkdir(resolve(root,'dist/functions'),{recursive:true});
for(const file of ['index.html','coaching.html','coaching.css','app.mjs','config.js','firebase-client.mjs','persistence.mjs','sample.mjs','sw.js','manifest.webmanifest'])await copyFile(resolve(root,file),resolve(root,'dist',file));
await copyFile(resolve(root,'functions/domain.mjs'),resolve(root,'dist/functions/domain.mjs'));
console.log('Built original tracker + coaching workspace in dist/.');
