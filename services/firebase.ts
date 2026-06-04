
import { initializeApp } from "firebase/app";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDKTAC7YKD-Dg1mSTO173my3Hd-afpsetk",
  authDomain: "wikimovil3-96f31.firebaseapp.com",
  projectId: "wikimovil3-96f31",
  storageBucket: "wikimovil3-96f31.firebasestorage.app",
  messagingSenderId: "582171460280",
  appId: "1:582171460280:web:0910da43072f90bd5c2a4d"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);

export const loginWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const registerWithEmail = async (email: string, password: string, displayName?: string) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return cred;
};

export const logout = () => signOut(auth);


export const resetPassword = (email: string) =>
  sendPasswordResetEmail(auth, email);


