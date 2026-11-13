import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {onCall, HttpsError} from 'firebase-functions/v2/https';
import {createHash, randomBytes} from 'node:crypto';
import {DomainError, requireThat as check, id, text, number, email, localDate, program, sessionUpdate, totals, validateInvitation} from './domain.mjs';

initializeApp();
const db=getFirestore();
const hash=v=>createHash('sha256').update(v).digest('hex');
const options={region:'us-central1', enforceAppCheck:process.env.FUNCTIONS_EMULATOR !== 'true', maxInstances:10};

// Single idempotency boundary: every accepted command and its result commit together.
export const coaching=onCall(options, async request=>{
  if(!request.auth) throw new HttpsError('unauthenticated','Sign in first.');
  const uid=request.auth.uid;
  try {
    const {action,requestId,data={}}=request.data || {};
    id(requestId); text(action,50);
    check(JSON.stringify(data).length<250000,'Request too large.');
    const ledger=db.doc(`coachingUsers/${uid}/operations/${requestId}`);
    const bucket=db.doc(`coachingUsers/${uid}/rateLimits/${Math.floor(Date.now()/60000)}`);
    const token=action==='createInvitation'?randomBytes(32).toString('base64url'):null;
    let fresh=false;
    const result=await db.runTransaction(async tx=>{
      fresh=false;
      const done=await tx.get(ledger);
      if(done.exists) {
        check(done.data().action===action && done.data().payloadHash===hash(JSON.stringify(data)), 'Operation ID reused with different content.');
        return {...done.data().result,...(action==='createInvitation'?{tokenUnavailable:true}:{})};
      }
      const rate=await tx.get(bucket);
      check((rate.data()?.count || 0)<120,'Too many requests. Try again shortly.','resource-exhausted');
      const writes=[];
      const get=async path=>(await tx.get(db.doc(path))).data();
      const put=(path,value)=>writes.push([path,value]);
      const activeCoach=async()=>{
        const c=await get(`coachAccounts/${uid}`);
        check(c?.status==='active','Coach access must be activated by an administrator.','permission-denied');
      };
      const relation=async(rid,scope,asCoach=false)=>{
        id(rid); const r=await get(`relationships/${rid}`);
        check(r?.status==='active' && (asCoach?r.coachId===uid:(r.coachId===uid || r.athleteId===uid)), 'Coaching connection is not active.','permission-denied');
        if(scope) check(r.consent?.[scope]===true,'Athlete has not shared this data.','permission-denied');
        return r;
      };
      let out={ok:true};
      if(action==='onboard') {
        const previous=await get(`coachingUsers/${uid}`);
        const timezone=text(data.timezone || 'UTC',100);
        try {new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{check(false,'Invalid timezone.');}
        put(`coachingUsers/${uid}`,{...previous,displayName:text(data.displayName,80),timezone,updatedAt:Date.now(),schemaVersion:1});
        if(data.coach===true) {
          check(request.auth.token.coach===true || request.auth.token.admin===true || process.env.FUNCTIONS_EMULATOR==='true','Coach activation requires administrator approval.','permission-denied');
          put(`coachAccounts/${uid}`,{status:'active',updatedAt:Date.now(),schemaVersion:1});
        }
      } else if(action==='createInvitation') {
        await activeCoach();
        const coach=await get(`coachingUsers/${uid}`);
        const inviteId=hash(token);
        put(`invitations/${inviteId}`,{coachId:uid,coachName:coach?.displayName || 'Your coach',email:email(data.email),status:'pending',expiresAt:Date.now()+7*86400000,createdAt:Date.now(),schemaVersion:1});
        out={inviteId,expiresAt:Date.now()+7*86400000}; fresh=true;
      } else if(action==='previewInvitation') {
        check(typeof data.token==='string' && /^[A-Za-z0-9_-]{43}$/.test(data.token),'Invalid invitation token.');
        const inv=await get(`invitations/${hash(data.token)}`);
        validateInvitation(inv,{...request.auth.token,uid},Date.now());
        out={coachName:inv.coachName,email:inv.email,expiresAt:inv.expiresAt};
      } else if(action==='acceptInvitation') {
        check(typeof data.token==='string' && /^[A-Za-z0-9_-]{43}$/.test(data.token),'Invalid invitation token.');
        const inviteId=hash(data.token), inv=await get(`invitations/${inviteId}`);
        validateInvitation(inv,{...request.auth.token,uid},Date.now());
        const pointer=await get(`athleteCoaching/${uid}`);
        const rid=hash(`${inv.coachId}:${uid}:${inviteId}`);
        if(inv.status==='accepted') out={relationshipId:rid};
        else {
          const coachAccount=await get(`coachAccounts/${inv.coachId}`);
          const profile=await get(`coachingUsers/${uid}`);
          check(coachAccount?.status==='active','Coach account is unavailable.','failed-precondition');
          check(!pointer?.relationshipId,'End your current coaching connection first.','failed-precondition');
          check(data.consent?.workouts===true,'Workout sharing is required for coaching.');
          const consent={workouts:true,nutrition:data.consent?.nutrition===true,checkIns:data.consent?.checkIns===true};
          put(`relationships/${rid}`,{coachId:inv.coachId,coachName:inv.coachName,athleteId:uid,athleteName:profile?.displayName || 'Athlete',status:'active',consent,startedAt:Date.now(),endedAt:null,schemaVersion:1});
          put(`athleteCoaching/${uid}`,{relationshipId:rid});
          put(`invitations/${inviteId}`,{...inv,status:'accepted',athleteId:uid,acceptedAt:Date.now()});
          out={relationshipId:rid};
        }
      } else if(action==='revokeInvitation') {
        const inviteId=id(data.inviteId), inv=await get(`invitations/${inviteId}`);
        check(inv?.coachId===uid && inv.status==='pending','Invitation cannot be revoked.','permission-denied');
        put(`invitations/${inviteId}`,{...inv,status:'revoked'});
      } else if(action==='endRelationship') {
        const r=await relation(data.relationshipId);
        put(`relationships/${data.relationshipId}`,{...r,status:'ended',endedAt:Date.now()});
        put(`athleteCoaching/${r.athleteId}`,{relationshipId:null});
      } else if(action==='saveProgram' || action==='publishProgram') {
        await activeCoach();
        const pid=id(data.id), previous=await get(`programs/${pid}`);
        check(!previous || previous.coachId===uid,'Program belongs to another coach.','permission-denied');
        check((previous?.revision || 0)===data.expectedRevision,'Program changed. Reload before saving.','aborted');
        const clean=program(data), revision=(previous?.revision || 0)+1;
        const next={...clean,id:pid,coachId:uid,revision,status:action==='publishProgram'?'published':'draft',publishedVersionId:previous?.publishedVersionId || null,updatedAt:Date.now(),schemaVersion:1};
        if(action==='publishProgram') {
          next.publishedVersionId=`v${revision}`;
          put(`programs/${pid}/versions/v${revision}`,{...clean,coachId:uid,versionId:`v${revision}`,publishedAt:Date.now(),schemaVersion:1});
        }
        put(`programs/${pid}`,next); out=next;
      } else if(action==='assignProgram') {
        await activeCoach(); const r=await relation(data.relationshipId,'workouts',true);
        const pid=id(data.programId), p=await get(`programs/${pid}`);
        check(p?.coachId===uid && p.publishedVersionId,'Publish the program first.','failed-precondition');
        const version=await get(`programs/${pid}/versions/${p.publishedVersionId}`);
        const start=localDate(data.startDate), assignmentId=requestId;
        // Deliberately a finite one-week block. Each occurrence owns its prescription.
        version.workouts.forEach((w,i)=>{
          const date=new Date(`${start}T00:00:00Z`); date.setUTCDate(date.getUTCDate()+i*2);
          put(`athletes/${r.athleteId}/scheduledWorkouts/${assignmentId}_${i}`,{id:`${assignmentId}_${i}`,assignmentId,relationshipId:data.relationshipId,programId:pid,programVersionId:p.publishedVersionId,workout:w,scheduledLocalDate:date.toISOString().slice(0,10),status:'planned',prescriptionRevision:1,createdAt:Date.now(),schemaVersion:1});
        });
        out={assignmentId};
      } else if(action==='saveSession') {
        const sid=id(data.id), previous=await get(`athletes/${uid}/sessions/${sid}`);
        const clean=sessionUpdate(previous,data,data.expectedRevision);
        let pinned=previous?.prescription || null, relationshipId=previous?.relationshipId || null, scheduledId=previous?.scheduledId || null;
        if(!previous && data.scheduledId) {
          scheduledId=id(data.scheduledId);
          const scheduled=await get(`athletes/${uid}/scheduledWorkouts/${scheduledId}`);
          check(scheduled,'Assigned workout not found.','not-found');
          pinned=scheduled.workout; relationshipId=scheduled.relationshipId;
        }
        if(previous) check(previous.localDate===clean.localDate,'Session date cannot change.');
        const session={...clean,id:sid,athleteId:uid,relationshipId,scheduledId,prescription:pinned,startedAt:previous?.startedAt || Date.now(),updatedAt:Date.now(),completedAt:clean.status==='completed'?Date.now():null,schemaVersion:1};
        if(clean.status==='completed') {
          const statsPath=`athletes/${uid}/dailyStats/${clean.localDate}`, stats=await get(statsPath);
          const t=totals(clean);
          put(statsPath,{sessions:(stats?.sessions || 0)+1,sets:(stats?.sets || 0)+t.sets,volumeKg:(stats?.volumeKg || 0)+t.volumeKg,updatedAt:Date.now(),schemaVersion:1});
          if(scheduledId) {
            const occurrence=await get(`athletes/${uid}/scheduledWorkouts/${scheduledId}`);
            if(occurrence && occurrence.status==='planned') put(`athletes/${uid}/scheduledWorkouts/${scheduledId}`,{...occurrence,status:'completed'});
          }
        }
        put(`athletes/${uid}/sessions/${sid}`,session); out=session;
      } else if(action==='sendMessage') {
        await relation(data.relationshipId);
        const mid=id(data.id);
        check(!(await get(`relationships/${data.relationshipId}/messages/${mid}`)),'Message already exists.','already-exists');
        put(`relationships/${data.relationshipId}/messages/${mid}`,{id:mid,senderId:uid,text:text(data.text,4000),createdAt:Date.now(),schemaVersion:1});
      } else if(action==='saveNutrition') {
        const date=localDate(data.date), path=`athletes/${uid}/nutritionDays/${date}`, previous=await get(path);
        check((previous?.revision || 0)===data.expectedRevision,'Nutrition log changed. Reload first.','aborted');
        check(Array.isArray(data.entries) && data.entries.length<=100,'Too many food entries.');
        const entries=data.entries.map(e=>({id:id(e.id),name:text(e.name,100),calories:number(e.calories,0,10000),protein:number(e.protein,0,1000),carbs:number(e.carbs,0,1000),fat:number(e.fat,0,1000)}));
        out={date,entries,revision:(previous?.revision || 0)+1,updatedAt:Date.now(),schemaVersion:1}; put(path,out);
      } else if(action==='submitCheckIn') {
        const r=await relation(data.relationshipId,'checkIns');
        check(r.athleteId===uid,'Only the athlete can submit.','permission-denied');
        const cid=id(data.id), path=`relationships/${data.relationshipId}/checkIns/${cid}`;
        check(!(await get(path)),'Check-in already submitted.','already-exists');
        put(path,{id:cid,athleteId:uid,status:'submitted',weightKg:number(data.weightKg,20,400),energy:number(data.energy,1,5),notes:text(data.notes || '',4000,true),createdAt:Date.now(),schemaVersion:1});
      } else if(action==='reviewCheckIn') {
        await relation(data.relationshipId,'checkIns',true);
        const path=`relationships/${data.relationshipId}/checkIns/${id(data.id)}`, c=await get(path);
        check(c,'Check-in not found.','not-found'); put(path,{...c,status:'reviewed',feedback:text(data.feedback,4000),reviewedAt:Date.now()});
      } else check(false,'Unknown operation.');
      writes.forEach(([path,value])=>tx.set(db.doc(path),value));
      tx.set(bucket,{count:(rate.data()?.count || 0)+1,expiresAt:new Date(Date.now()+86400000)});
      tx.set(ledger,{action,payloadHash:hash(JSON.stringify(data)),result:out,createdAt:Date.now()});
      // Audit contains identifiers, never tokens, chat contents, or health values.
      tx.set(db.doc(`auditEvents/${uid}_${requestId}`),{actorId:uid,action,createdAt:Date.now()});
      return out;
    });
    return token && fresh?{...result,token}:result;
  } catch(e) {
    if(e instanceof DomainError) throw new HttpsError(e.code,e.message);
    console.error('Coaching operation failed', {code:e.code || 'internal'});
    throw new HttpsError('internal','Unable to save. Your local copy is retained.');
  }
});
