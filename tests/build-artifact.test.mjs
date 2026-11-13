import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
test('production artifact opens coaching, preserves tracker and verifies every recorded checksum',async()=>{
 const root=resolve(import.meta.dirname,'..');
 const result=spawnSync(process.execPath,['scripts/build.mjs','--production'],{cwd:root,encoding:'utf8',env:{...process.env,FLAMES_DATA_MODE:'firebase'}});
 assert.equal(result.status,0,result.stderr);
 const release=JSON.parse(await readFile(resolve(root,'dist/release.json'),'utf8'));
 assert.equal(release.entrypoint,'coaching');assert.equal(release.projectId,'flamescoaching-21cdf');assert.equal(release.appCheckConfigured,true);
 assert.match(await readFile(resolve(root,'dist/index.html'),'utf8'),/Flames Coaching · Training, connected/);
 assert.match(await readFile(resolve(root,'dist/tracker.html'),'utf8'),/FLAMESCOACHING — Workout Tracker/);
 assert.match(await readFile(resolve(root,'dist/app.mjs'),'utf8'),/href="tracker.html">Open tracker/);
 for(const [file,expected]of Object.entries(release.files))assert.equal(createHash('sha256').update(await readFile(resolve(root,'dist',file))).digest('hex'),expected,file);
});
