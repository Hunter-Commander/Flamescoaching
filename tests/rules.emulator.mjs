import {before,after,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,collection,getDocs,query,where} from 'firebase/firestore';
let env;
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-flames-coaching',firestore:{rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();for(const [path,data] of Object.entries({
  'users/athlete':{displayName:'Athlete'},'coachAccounts/coach':{status:'active'},
  'relationships/active':{coachId:'coach',athleteId:'athlete',status:'active',consent:{workouts:true,checkIns:false}},
  'relationships/ended':{coachId:'former',athleteId:'athlete',status:'ended',consent:{workouts:true,checkIns:true}},
  'athletes/athlete/sessions/session':{relationshipId:'active'},'athletes/athlete/sessions/old':{relationshipId:'ended'},
  'invitations/hash':{email:'private@example.com'},'programs/private':{coachId:'coach'},
  'relationships/active/checkIns/private':{notes:'private'},'relationships/active/messages/msg':{text:'hello'}
 }))await setDoc(doc(db,path),data);});
});
after(async()=>{await env?.cleanup();});
const db=uid=>uid?env.authenticatedContext(uid).firestore():env.unauthenticatedContext().firestore();
test('athlete reads own session, strangers and unauthenticated callers cannot',async()=>{
 await assertSucceeds(getDoc(doc(db('athlete'),'athletes/athlete/sessions/session')));
 await assertFails(getDoc(doc(db('stranger'),'athletes/athlete/sessions/session')));
 await assertFails(getDoc(doc(db(),'athletes/athlete/sessions/session')));
});
test('active coach access is scoped to relationship and consent',async()=>{
 await assertSucceeds(getDoc(doc(db('coach'),'athletes/athlete/sessions/session')));
 await assertFails(getDoc(doc(db('former'),'athletes/athlete/sessions/old')));
 await assertFails(getDoc(doc(db('coach'),'relationships/active/checkIns/private')));
});
test('coaches cannot read private athlete profiles or invitations',async()=>{
 await assertFails(getDoc(doc(db('coach'),'users/athlete')));
 await assertFails(getDoc(doc(db('coach'),'invitations/hash')));
});
test('clients cannot promote themselves, forge relations, or overwrite workouts',async()=>{
 for(const path of ['coachAccounts/stranger','relationships/forged','athletes/athlete/sessions/session','users/stranger/operations/forged'])await assertFails(setDoc(doc(db('stranger'),path),{status:'active'}));
 await assertFails(setDoc(doc(db('athlete'),'athletes/athlete/sessions/session'),{status:'completed'}));
});
test('coach session query must include relationship constraint',async()=>{
 await assertSucceeds(getDocs(query(collection(db('coach'),'athletes/athlete/sessions'),where('relationshipId','==','active'))));
 await assertFails(getDocs(collection(db('coach'),'athletes/athlete/sessions')));
});
test('athletes cannot read coach source programs',async()=>await assertFails(getDoc(doc(db('athlete'),'programs/private'))));
