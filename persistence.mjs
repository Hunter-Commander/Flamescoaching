// One atomic account-scoped snapshot contains the local projection AND its outbox.
let connection;
export async function database() {
  if(connection) return connection;
  connection=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('flames-coaching-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('accounts');
    request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
  }); return connection;
}
export async function loadAccount(key) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const request=db.transaction('accounts').objectStore('accounts').get(key);
    request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
  });
}
export async function saveAccount(key,value) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('accounts','readwrite');
    tx.objectStore('accounts').put(structuredClone(value),key);
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error || new Error('Device storage write failed.'));
  });
}
export async function deleteAccount(key) {
  const db=await database();
  return new Promise((resolve,reject)=>{const tx=db.transaction('accounts','readwrite');tx.objectStore('accounts').delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
