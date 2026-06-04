import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface FirestoreComment {
  id?: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  content: string;
  timestamp: number;
}

export const addComment = async (postId: string, comment: FirestoreComment) => {
  const ref = collection(db, "posts", postId, "comments");
  const doc = await addDoc(ref, {
    ...comment,
    timestamp: Date.now()   // no usar serverTimestamp porque usas timestamp number
  });
  return doc.id;
};

export const getComments = async (postId: string): Promise<FirestoreComment[]> => {
  const ref = collection(db, "posts", postId, "comments");
  const snap = await getDocs(ref);
  
  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as FirestoreComment[];
};
