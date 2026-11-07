import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {initializeAppCheck,ReCaptchaEnterpriseProvider} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {initializeFirestore,getFirestore,persistentLocalCache,persistentMultipleTabManager,doc,setDoc,deleteDoc,collection,onSnapshot,writeBatch} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCRoXtNcpO7znbHp08Bf8cZjktObdz6RwM",
  authDomain: "finance-hub-5373a.firebaseapp.com",
  projectId: "finance-hub-5373a",
  storageBucket: "finance-hub-5373a.firebasestorage.app",
  messagingSenderId: "1021154150665",
  appId: "1:1021154150665:web:d5c448472f9d23f0d66bd8"
};

const app=initializeApp(firebaseConfig);
// App Check: proves requests come from this site (reCAPTCHA Enterprise; enabled once a key is set in FH_CONFIG)
const SITE_KEY=(window.FH_CONFIG||{}).recaptchaSiteKey;
if(SITE_KEY){try{initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(SITE_KEY),isTokenAutoRefreshEnabled:true});}catch(e){console.warn('App Check could not start',e);}}
const auth=getAuth(app);
let db;
try{db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});}
catch(e){console.warn('Offline cache unavailable, using memory only',e);db=getFirestore(app);}

const KINDS=['income','expenses','savings','goals','allocs','transfers','bills','adjustments'];
let uid=null,unsubs=[],pending={},denied=false,adjustmentsDenied=false;
const fail=e=>{console.error(e);window.toast('Sync error: '+(e.code||e.message));};
const ref=(k,id)=>k==='meta'?doc(db,'users',uid,'meta','state'):doc(db,'users',uid,k,id);
function updSync(){window.setSync(!navigator.onLine?'offline':Object.values(pending).some(Boolean)?'saving':'synced');}
addEventListener('online',updSync);addEventListener('offline',updSync);

window.FB={
  uid:()=>uid,
  put:(k,id,d)=>{setDoc(ref(k,id),d).catch(fail);},
  putMeta:m=>{setDoc(ref('meta'),m).catch(fail);},
  bulk:ops=>{for(let i=0;i<ops.length;i+=400){const b=writeBatch(db);ops.slice(i,i+400).forEach(o=>o.del?b.delete(ref(o.k,o.id)):b.set(ref(o.k,o.id),o.d));b.commit().catch(fail);}},
  signIn:async()=>{const p=new GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});
    try{await signInWithPopup(auth,p);}
    catch(e){if(['auth/popup-blocked','auth/operation-not-supported-in-environment','auth/web-storage-unsupported'].includes(e.code)) signInWithRedirect(auth,p);
      else if(!['auth/popup-closed-by-user','auth/cancelled-popup-request'].includes(e.code)) window.showAuthError(e);}},
  signOut:()=>signOut(auth)
};
getRedirectResult(auth).catch(e=>window.showAuthError(e));

onAuthStateChanged(auth,user=>{
  unsubs.forEach(u=>u());unsubs=[];pending={};
  if(!user){uid=null;window.onSignedOut();return;}
  uid=user.uid;denied=false;adjustmentsDenied=false;window.onSignedIn(user);
  const lfail=(e,kind)=>{if(e.code==='permission-denied'&&kind==='adjustments'){
      if(adjustmentsDenied) return;adjustmentsDenied=true;
      console.warn('Wallet reconciliation is unavailable because Firestore rules do not allow the adjustments collection.');
      window.onData('adjustments',[]);
      window.onAdjustmentPermissionDenied();
    }else if(e.code==='permission-denied'){if(denied) return;denied=true;
      window.showAuthError({message:`${user.email} doesn't have access to this Finance Hub. Sign in with the owner's Google account.`});signOut(auth);}
    else fail(e);};
  KINDS.forEach(k=>unsubs.push(onSnapshot(collection(db,'users',uid,k),{includeMetadataChanges:true},snap=>{
    pending[k]=snap.metadata.hasPendingWrites;window.onData(k,snap.docs.map(d=>({id:d.id,...d.data()})));updSync();},e=>lfail(e,k))));
  unsubs.push(onSnapshot(ref('meta'),{includeMetadataChanges:true},snap=>{
    pending.meta=snap.metadata.hasPendingWrites;window.onMeta(snap.exists()?snap.data():null);updSync();},e=>lfail(e,'meta')));
});
