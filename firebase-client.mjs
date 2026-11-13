import {config} from './config.js';
export async function connectFirebase(onAuth) {
  const base='https://www.gstatic.com/firebasejs/13.3.0/';
  const [appSDK,authSDK,firestore,functions,appCheck]=await Promise.all(['firebase-app.js','firebase-auth.js','firebase-firestore.js','firebase-functions.js','firebase-app-check.js'].map(file=>import(base+file)));
  const app=appSDK.initializeApp(config.firebase);
  if(!config.emulators) {
    if(!config.appCheckSiteKey) throw new Error('Firebase App Check site key is missing.');
    appCheck.initializeAppCheck(app,{provider:new appCheck.ReCaptchaEnterpriseProvider(config.appCheckSiteKey),isTokenAutoRefreshEnabled:true});
  }
  const auth=authSDK.getAuth(app), db=firestore.getFirestore(app), fn=functions.getFunctions(app,config.region);
  // Firestore uses memory cache. The app owns its explicit account-scoped offline data.
  if(config.emulators) {
    if(!['localhost','127.0.0.1'].includes(location.hostname)) throw new Error('Emulators are restricted to localhost.');
    authSDK.connectAuthEmulator(auth,'http://127.0.0.1:9099'); firestore.connectFirestoreEmulator(db,'127.0.0.1',8080);functions.connectFunctionsEmulator(fn,'127.0.0.1',5001);
  }
  const invoke=functions.httpsCallable(fn,'coaching');
  const subscriptions=[];
  const api={
    call:async(action,data,requestId)=>(await invoke({action,data,requestId})).data,
    signIn:()=>authSDK.signInWithPopup(auth,new authSDK.GoogleAuthProvider()),
    signOut:()=>authSDK.signOut(auth),
    stop:()=>{subscriptions.splice(0).forEach(unsub=>unsub());},
    doc:(path,receive,error)=>{const unsub=firestore.onSnapshot(firestore.doc(db,path),snap=>receive(snap.exists()?snap.data():null),error);subscriptions.push(unsub);return unsub;},
    list:(path,filters,receive,error)=>{
      const constraints=filters.map(([field,op,value])=>firestore.where(field,op,value));
      constraints.push(firestore.limit(200));
      const unsub=firestore.onSnapshot(firestore.query(firestore.collection(db,path),...constraints),snap=>receive(snap.docs.map(d=>({...d.data(),id:d.id}))),error);
      subscriptions.push(unsub);return unsub;
    }
  };
  authSDK.onAuthStateChanged(auth,onAuth); return api;
}
