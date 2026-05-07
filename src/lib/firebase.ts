import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, setPersistence, browserLocalPersistence, type User } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
setPersistence(auth, browserLocalPersistence).catch(err => console.error('Persistence error:', err));
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithGoogle(useRedirect = false) {
  try {
    if (useRedirect) {
      console.log('Initiating Google Sign-In with redirect...');
      await signInWithRedirect(auth, googleProvider);
      return;
    }

    console.log('Initiating Google Sign-In with popup...');
    const result = await signInWithPopup(auth, googleProvider);
    console.log('Login successful:', result.user.email);
    return result;
  } catch (error: any) {
    console.error('Detailed login error message:', error.message);
    
    let message = `Login failed (${error.code || 'unknown'}): ${error.message || 'Unknown error'}`;
    
    if (error.code === 'auth/popup-blocked') {
      message = 'The sign-in popup was blocked. Please allow popups for this site, or try the "Redirect" option.';
    } else if (error.code === 'auth/network-request-failed' || error.code === 'auth/internal-error') {
      message = 'Connection failed. If you are in Incognito mode, third-party cookies might be blocked. Try allowing them or signing in from a standard window.';
    } else if (error.code === 'auth/operation-not-allowed') {
      message = 'Google Sign-In is not enabled in Firebase Console.';
    } else if (error.code === 'auth/unauthorized-domain') {
       message = `Domain ${window.location.hostname} is not authorized in Firebase Console. Please add it to your authorized domains.`;
    }
    
    throw new Error(message);
  }
}

export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      console.log('Redirect login successful:', result.user.email);
    }
    return result;
  } catch (error: any) {
    console.error('Redirect result error message:', error.message);
    return null;
  }
}

export async function logout() {
  try {
    await auth.signOut();
  } catch (error) {
    console.error('Logout failed message:', error instanceof Error ? error.message : String(error));
  }
}

export async function syncUserProfile(user: User) {
  const userRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userRef);
  
  const userData = {
    email: user.email,
    displayName: user.displayName || 'Anonymous User',
    photoURL: user.photoURL || '',
    lastLogin: serverTimestamp(),
    isAdmin: user.email === 'sagarmailstop@gmail.com'
  };

  if (!userDoc.exists()) {
    await setDoc(userRef, {
      ...userData,
      createdAt: serverTimestamp()
    });
  } else {
    await setDoc(userRef, userData, { merge: true });
  }
}

export async function isUserAdmin(user: User): Promise<boolean> {
  return user.email === 'sagarmailstop@gmail.com';
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
