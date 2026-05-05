import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
setPersistence(auth, browserLocalPersistence).catch(err => console.error('Persistence error:', err));
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    console.log('Initiating Google Sign-In with popup...');
    const result = await signInWithPopup(auth, googleProvider);
    console.log('Login successful:', result.user.email);
    return result;
  } catch (error: any) {
    console.error('Detailed login error:', {
      code: error.code,
      message: error.message,
      customData: error.customData,
      email: error.customData?.email
    });
    
    let message = `Login failed (${error.code || 'unknown'}): ${error.message || 'Unknown error'}`;
    if (error.code === 'auth/popup-blocked') {
      message = 'The sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
    } else if (error.code === 'auth/network-request-failed') {
      message = 'Network error. This can happen if third-party cookies are blocked or you are offline.';
    } else if (error.code === 'auth/operation-not-allowed') {
      message = 'Google Sign-In is not enabled in the Firebase console. Please contact the administrator.';
    } else if (error.code === 'auth/unauthorized-domain') {
      message = `This domain is not authorized for OAuth operations. Current domain: ${window.location.hostname}`;
    }
    throw new Error(message);
  }
}

export async function logout() {
  try {
    await auth.signOut();
  } catch (error) {
    console.error('Logout failed', error);
  }
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

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

testConnection();
