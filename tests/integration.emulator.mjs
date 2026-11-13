import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword} from 'firebase/auth';
import {getFunctions,connectFunctionsEmulator,httpsCallable} from 'firebase/functions';
import {getFirestore,connectFirestoreEmulator,doc,getDoc} from 'firebase/firestore';
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const {initializeApp:initAdmin,deleteApp:deleteAdmin}=require('firebase-admin/app');
const {getAuth:adminAuth}=require('firebase-admin/auth');
const {getFirestore:adminFirestore}=require('firebase-admin/firestore');
const projectId='demo-flames-coaching';
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('This test must run exclusively against Firebase emulators.');
const admin=initAdmin({projectId},'integration-admin'), clients=[];
async function client(name,verified=true){
 const uid=`integration-${name}`,email=`${name}@example.com`,password='EmulatorOnlyPassword1!';
 await adminAuth(admin).createUser({uid,email,password,emailVerified:verified});
 const app=initializeApp({projectId,apiKey:'emulator-only',appId:'emulator-only'},name);clients.push(app);
 const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
 await signInWithEmailAndPassword(auth,email,password);
 const fn=getFunctions(app,'us-central1');connectFunctionsEmulator(fn,'127.0.0.1',5001);
 const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8080);
 return {uid,email,db,call:async(action,data,requestId=crypto.randomUUID())=>(await httpsCallable(fn,'coaching')({action,data,requestId})).data};
}
test('real callable API: invitation → publication → assignment → workout → revocation',async t=>{
 try{
  const coach=await client('coach'),athlete=await client('athlete'),stranger=await client('stranger');
  await coach.call('onboard',{displayName:'Coach',timezone:'UTC',coach:true});
  await athlete.call('onboard',{displayName:'Athlete',timezone:'UTC'});
  let invitation,relationshipId,assignmentId;
  await t.test('verified recipient invitation and transaction-safe repeated acceptance',async()=>{
   invitation=await coach.call('createInvitation',{email:athlete.email});
   assert.equal(invitation.token.length,43);
   const stored=(await adminFirestore(admin).doc(`invitations/${invitation.inviteId}`).get()).data();
   assert.equal(stored.token,undefined);
   await assert.rejects(stranger.call('acceptInvitation',{token:invitation.token,consent:{workouts:true}}),e=>e.code==='functions/permission-denied');
   const preview=await athlete.call('previewInvitation',{token:invitation.token});assert.equal(preview.coachName,'Coach');
   const [a,b]=await Promise.all([1,2].map(()=>athlete.call('acceptInvitation',{token:invitation.token,consent:{workouts:true,checkIns:true}})));
   assert.equal(a.relationshipId,b.relationshipId);relationshipId=a.relationshipId;
  });
  const workout={id:'workout',name:'Strength A',exercises:[{id:'bench',name:'Bench press',sets:[{id:'set1',reps:8,weightKg:60}]}]};
  await t.test('draft changes do not alter the published assignment snapshot',async()=>{
   await coach.call('publishProgram',{id:'integration-program',name:'Strength',description:'',workouts:[workout],expectedRevision:0});
   const edited=structuredClone(workout);edited.exercises[0].sets[0].weightKg=90;
   await coach.call('saveProgram',{id:'integration-program',name:'Strength draft',description:'',workouts:[edited],expectedRevision:1});
   const assigned=await coach.call('assignProgram',{programId:'integration-program',relationshipId,startDate:'2026-11-13'});assignmentId=assigned.assignmentId;
   const scheduled=await getDoc(doc(athlete.db,`athletes/${athlete.uid}/scheduledWorkouts/${assignmentId}_0`));
   assert.equal(scheduled.data().workout.exercises[0].sets[0].weightKg,60);
  });
  let completed;
  await t.test('session revisions, duplicate retry, and transactional daily totals',async()=>{
   const p={...workout,id:'integration-session',scheduledId:`${assignmentId}_0`,status:'inProgress',localDate:'2026-11-13',expectedRevision:0,exercises:workout.exercises.map(e=>({...e,sets:e.sets.map(s=>({...s,done:false}))}))};
   const started=await athlete.call('saveSession',p);assert.equal(started.revision,1);
   completed={...p,status:'completed',expectedRevision:1,exercises:p.exercises.map(e=>({...e,sets:e.sets.map(s=>({...s,done:true}))}))};
   const requestId=crypto.randomUUID();
   const [a,b]=await Promise.all([1,2].map(()=>athlete.call('saveSession',completed,requestId)));
   assert.equal(a.revision,2);assert.equal(b.revision,2);
   const stats=(await adminFirestore(admin).doc(`athletes/${athlete.uid}/dailyStats/2026-11-13`).get()).data();
   assert.equal(stats.sessions,1);assert.equal(stats.volumeKg,480);
   await assert.rejects(athlete.call('saveSession',{...completed,expectedRevision:2}),e=>e.code==='functions/failed-precondition');
   await getDoc(doc(coach.db,`athletes/${athlete.uid}/sessions/integration-session`));
  });
  await t.test('chat, private nutrition and coach-reviewed check-ins',async()=>{
   await athlete.call('sendMessage',{id:'integration-message',relationshipId,text:'Strong session.'});
   await athlete.call('saveNutrition',{date:'2026-11-13',expectedRevision:0,entries:[{id:'meal',name:'Meal',calories:400,protein:30,carbs:40,fat:10}]});
   await assert.rejects(getDoc(doc(coach.db,`athletes/${athlete.uid}/nutritionDays/2026-11-13`)));
   await athlete.call('submitCheckIn',{id:'integration-checkin',relationshipId,weightKg:80,energy:4,notes:'Feeling good.'});
   await coach.call('reviewCheckIn',{id:'integration-checkin',relationshipId,feedback:'Keep the current load.'});
   const c=await getDoc(doc(athlete.db,`relationships/${relationshipId}/checkIns/integration-checkin`));assert.equal(c.data().status,'reviewed');
  });
  await t.test('revocation blocks coach reads and chat but preserves athlete offline uploads',async()=>{
   await athlete.call('endRelationship',{relationshipId});
   await assert.rejects(getDoc(doc(coach.db,`athletes/${athlete.uid}/sessions/integration-session`)));
   await assert.rejects(coach.call('sendMessage',{id:'late-message',relationshipId,text:'Blocked'}),e=>e.code==='functions/permission-denied');
   const late={...completed,id:'late-offline-session',expectedRevision:0};
   await athlete.call('saveSession',late);
   await getDoc(doc(athlete.db,`athletes/${athlete.uid}/sessions/late-offline-session`));
   await assert.rejects(getDoc(doc(coach.db,`athletes/${athlete.uid}/sessions/late-offline-session`)));
  });
 }finally{await Promise.all(clients.map(deleteApp));await deleteAdmin(admin);}
});
