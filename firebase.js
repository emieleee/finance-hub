import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {initializeAppCheck, ReCaptchaEnterpriseProvider} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, setDoc, collection, onSnapshot, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {FH_CONFIG} from './app/config.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCRoXtNcpO7znbHp08Bf8cZjktObdz6RwM',
  authDomain: 'finance-hub-5373a.firebaseapp.com',
  projectId: 'finance-hub-5373a',
  storageBucket: 'finance-hub-5373a.firebasestorage.app',
  messagingSenderId: '1021154150665',
  appId: '1:1021154150665:web:d5c448472f9d23f0d66bd8'
};

const KINDS = ['income', 'expenses', 'savings', 'goals', 'allocs', 'transfers', 'bills', 'adjustments', 'debts', 'debtInstallments'];

export function startFirebase(callbacks) {
  const {
    onData, onMeta, onSignedIn, onSignedOut, onAdjustmentPermissionDenied, onDebtPermissionDenied,
    setSync, showAuthError, toast
  } = callbacks;
  const app = initializeApp(firebaseConfig);
  if (FH_CONFIG.recaptchaSiteKey) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(FH_CONFIG.recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true
      });
    } catch (error) {
      console.warn('App Check could not start', error);
    }
  }
  const auth = getAuth(app);
  let db;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
    });
  } catch (error) {
    console.warn('Offline cache unavailable, using memory only', error);
    db = getFirestore(app);
  }

  let uid = null;
  let unsubscribers = [];
  let pending = {};
  let denied = false;
  let adjustmentsDenied = false;
  let debtCollectionsDenied = false;
  const fail = error => {
    console.error(error);
    toast('Sync error: ' + (error.code || error.message));
  };
  const ref = (kind, id) => kind === 'meta'
    ? doc(db, 'users', uid, 'meta', 'state')
    : doc(db, 'users', uid, kind, id);
  function updateSync() {
    setSync(!navigator.onLine ? 'offline' : Object.values(pending).some(Boolean) ? 'saving' : 'synced');
  }
  const onOnline = () => updateSync();
  addEventListener('online', onOnline);
  addEventListener('offline', onOnline);

  getRedirectResult(auth).catch(showAuthError);
  onAuthStateChanged(auth, user => {
    unsubscribers.forEach(unsubscribe => unsubscribe());
    unsubscribers = [];
    pending = {};
    if (!user) {
      uid = null;
      onSignedOut();
      return;
    }
    uid = user.uid;
    denied = false;
    adjustmentsDenied = false;
    debtCollectionsDenied = false;
    onSignedIn(user);
    const listenerFailure = (error, kind) => {
      if (error.code === 'permission-denied' && kind === 'adjustments') {
        if (adjustmentsDenied) return;
        adjustmentsDenied = true;
        console.warn('Wallet reconciliation is unavailable because Firestore rules do not allow the adjustments collection.');
        onData('adjustments', []);
        onAdjustmentPermissionDenied();
      } else if (error.code === 'permission-denied' && ['debts', 'debtInstallments'].includes(kind)) {
        if (!debtCollectionsDenied) {
          debtCollectionsDenied = true;
          console.warn('Debt tracking is unavailable because Firestore rules do not allow the debt collections.');
          onDebtPermissionDenied();
        }
        onData(kind, []);
      } else if (error.code === 'permission-denied') {
        if (denied) return;
        denied = true;
        showAuthError({message: `${user.email} doesn't have access to this Finance Hub. Sign in with the owner's Google account.`});
        signOut(auth);
      } else {
        fail(error);
      }
    };
    KINDS.forEach(kind => unsubscribers.push(onSnapshot(
      collection(db, 'users', uid, kind),
      {includeMetadataChanges: true},
      snapshot => {
        pending[kind] = snapshot.metadata.hasPendingWrites;
        onData(kind, snapshot.docs.map(item => ({id: item.id, ...item.data()})));
        updateSync();
      },
      error => listenerFailure(error, kind)
    )));
    unsubscribers.push(onSnapshot(
      ref('meta'),
      {includeMetadataChanges: true},
      snapshot => {
        pending.meta = snapshot.metadata.hasPendingWrites;
        onMeta(snapshot.exists() ? snapshot.data() : null);
        updateSync();
      },
      error => listenerFailure(error, 'meta')
    ));
  });

  return {
    uid: () => uid,
    put: (kind, id, data) => setDoc(ref(kind, id), data).catch(fail),
    putMeta: data => setDoc(ref('meta'), data).catch(fail),
    bulk: operations => {
      for (let index = 0; index < operations.length; index += 400) {
        const batch = writeBatch(db);
        operations.slice(index, index + 400).forEach(operation => {
          if (operation.del) batch.delete(ref(operation.k, operation.id));
          else batch.set(ref(operation.k, operation.id), operation.d);
        });
        batch.commit().catch(fail);
      }
    },
    signIn: async () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({prompt: 'select_account'});
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-environment', 'auth/web-storage-unsupported'].includes(error.code)) {
          await signInWithRedirect(auth, provider);
        } else if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error.code)) {
          showAuthError(error);
        }
      }
    },
    signOut: () => signOut(auth)
  };
}
