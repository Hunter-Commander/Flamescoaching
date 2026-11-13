// Run using Application Default Credentials for an administrator of the intended project.
// Never add service-account JSON to this repository or the frontend config.
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
const [projectId,uid]=process.argv.slice(2);
if(!projectId||!uid)throw new Error('Usage: node functions/grant-coach.mjs PROJECT_ID USER_UID');
initializeApp({credential:applicationDefault(),projectId});
const auth=getAuth(),user=await auth.getUser(uid);
await auth.setCustomUserClaims(uid,{...user.customClaims,coach:true});
await getFirestore().doc(`coachAccounts/${uid}`).set({status:'active',updatedAt:Date.now(),schemaVersion:1});
console.log('Coach access granted in the explicitly selected project. Sign out and sign in to refresh claims.');
