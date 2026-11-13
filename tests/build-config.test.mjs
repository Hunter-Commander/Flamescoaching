import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveBuildConfig} from '../scripts/build-config.mjs';
const sample={firebase:null,appCheckSiteKey:'',emulators:false};
const firebase={firebase:{apiKey:'public-web-key',appId:'web-id',authDomain:'flamescoaching-21cdf.firebaseapp.com',projectId:'flamescoaching-21cdf'},appCheckSiteKey:'',emulators:false};
const key='6L'+'a'.repeat(38); // Test fixture only; never a deployable provider key.
const build=(env={},args=[],override=firebase)=>resolveBuildConfig({env,args,sample,firebase:override});
test('local and preview builds remain explicit sample workspaces',()=>{assert.equal(build().mode,'demo');assert.equal(build({VERCEL_ENV:'preview'}).mode,'demo');});
test('Vercel production automatically requires a real Firebase configuration',()=>{assert.throws(()=>build({VERCEL_ENV:'production'}),/FLAMES_APPCHECK_SITE_KEY/);});
test('production rejects an explicit sample override',()=>assert.throws(()=>build({VERCEL_ENV:'production',FLAMES_DATA_MODE:'demo'}),/cannot use sample/));
test('manual production build also requires App Check',()=>assert.throws(()=>build({},['--production']),/FLAMES_APPCHECK_SITE_KEY/));
test('configured production builds pin the supplied project and disable emulators',()=>{const r=build({FLAMES_APPCHECK_SITE_KEY:key},['--production']);assert.equal(r.mode,'firebase');assert.equal(r.config.firebase.projectId,'flamescoaching-21cdf');assert.equal(r.config.emulators,false);assert.equal(r.production,true);});
test('wrong projects, incomplete settings and emulator leakage are rejected',()=>{
 for(const override of [{...firebase,firebase:{...firebase.firebase,projectId:'wrong-project'}},{...firebase,firebase:{...firebase.firebase,appId:''}},{...firebase,emulators:true}])assert.throws(()=>build({FLAMES_APPCHECK_SITE_KEY:key},['--production'],override));
});
test('placeholder App Check values cannot ship',()=>assert.throws(()=>build({FLAMES_APPCHECK_SITE_KEY:'YOUR_REPLACE_ME_SITE_KEY_12345'},['--production']),/FLAMES_APPCHECK_SITE_KEY/));
test('build configuration does not mutate source configuration',()=>{build({FLAMES_APPCHECK_SITE_KEY:key},['--production']);assert.equal(firebase.appCheckSiteKey,'');});
