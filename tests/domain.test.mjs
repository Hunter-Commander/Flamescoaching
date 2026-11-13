import {test} from 'node:test';
import assert from 'node:assert/strict';
import {email,id,localDate,program,sessionUpdate,totals,validateInvitation} from '../functions/domain.mjs';
const workout=()=>({id:'workout',name:'Strength',exercises:[{id:'bench',name:'Bench press',sets:[{id:'set1',reps:8,weightKg:60,done:true},{id:'set2',reps:8,weightKg:60,done:false}]}]});
test('invitation requires the exact verified email',()=>{
 const inv={status:'pending',coachId:'coach',email:'athlete@example.com',expiresAt:200};
 assert.throws(()=>validateInvitation(inv,{uid:'athlete',email:'other@example.com',email_verified:true},100),/invited email/);
 assert.throws(()=>validateInvitation(inv,{uid:'athlete',email:'athlete@example.com',email_verified:false},100),/invited email/);
 assert.doesNotThrow(()=>validateInvitation(inv,{uid:'athlete',email:'ATHLETE@example.com',email_verified:true},100));
});
test('expired and revoked invitations cannot be accepted',()=>{
 const auth={uid:'athlete',email:'athlete@example.com',email_verified:true}, inv={coachId:'coach',email:auth.email,status:'pending',expiresAt:200};
 assert.throws(()=>validateInvitation(inv,auth,200),/expired/);
 assert.throws(()=>validateInvitation({...inv,status:'revoked'},auth,100),/revoked/);
});
test('invitation retries are limited to original accepter',()=>{
 const inv={coachId:'coach',email:'athlete@example.com',status:'accepted',athleteId:'a',expiresAt:200};
 assert.doesNotThrow(()=>validateInvitation(inv,{uid:'a',email:inv.email,email_verified:true},100));
 assert.throws(()=>validateInvitation(inv,{uid:'b',email:inv.email,email_verified:true},100),/already used/);
});
test('self coaching is rejected',()=>assert.throws(()=>validateInvitation({coachId:'coach',email:'c@example.com',status:'pending',expiresAt:200},{uid:'coach',email:'c@example.com',email_verified:true},100),/yourself/));
test('path IDs reject path traversal and slash injection',()=>{for(const value of ['../users/other','a/b','','a.b'])assert.throws(()=>id(value));});
test('invalid calendar dates are rejected',()=>{assert.equal(localDate('2028-02-29'),'2028-02-29');for(const d of ['2026-02-29','2026-13-01','2026-01-32','11/13/2026'])assert.throws(()=>localDate(d));});
test('program publication strips untrusted fields and completion flags',()=>{
 const clean=program({name:'Block',coachId:'attacker',workouts:[workout()]});
 assert.equal(clean.coachId,undefined);assert.equal(clean.workouts[0].exercises[0].sets[0].done,undefined);
});
test('duplicate stable IDs cannot corrupt workout records',()=>{
 const w=workout();w.exercises[0].sets[1].id='set1';assert.throws(()=>program({name:'Block',workouts:[w]}),/Duplicate set/);
});
test('nonfinite and oversized loads are rejected',()=>{
 for(const n of [NaN,Infinity,-1,1001]){const w=workout();w.exercises[0].sets[0].weightKg=n;assert.throws(()=>sessionUpdate(null,{...w,status:'inProgress',localDate:'2026-11-13'},0));}
});
test('optimistic revisions reject simultaneous edits',()=>{
 const s={...workout(),status:'inProgress',localDate:'2026-11-13'};
 const saved=sessionUpdate(null,s,0);assert.equal(saved.revision,1);
 assert.throws(()=>sessionUpdate(saved,s,0),e=>e.code==='aborted');
 assert.equal(sessionUpdate(saved,s,1).revision,2);
});
test('completed workout cannot be silently rewritten',()=>{
 const s={...workout(),status:'completed',localDate:'2026-11-13'}, saved=sessionUpdate(null,s,0);
 assert.throws(()=>sessionUpdate(saved,s,1),/immutable/);
});
test('unchecked sets do not count toward totals',()=>assert.deepEqual(totals(workout()),{sets:1,volumeKg:480}));
test('empty workouts cannot be completed',()=>{
 const w=workout();w.exercises[0].sets.forEach(s=>s.done=false);
 assert.throws(()=>sessionUpdate(null,{...w,status:'completed',localDate:'2026-11-13'},0),/at least one set/);
});
test('publication and accepted sessions are detached from subsequent input mutations',()=>{
 const w=workout(), p=program({name:'Block',workouts:[w]}), s=sessionUpdate(null,{...w,status:'inProgress',localDate:'2026-11-13'},0);
 w.exercises[0].sets[0].weightKg=999;assert.equal(p.workouts[0].exercises[0].sets[0].weightKg,60);assert.equal(s.exercises[0].sets[0].weightKg,60);
});
