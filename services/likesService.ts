import { db } from "./firebase";
import { doc, setDoc, deleteDoc, getDoc, updateDoc, increment } from "firebase/firestore";

const likeRef = (postId: string, userId: string) =>
  doc(db, "posts", postId, "likes", userId);

export const likePost = async (postId: string, userId: string) => {
  await setDoc(likeRef(postId, userId), { likedAt: Date.now() });
  await updateDoc(doc(db, "posts", postId), { likes: increment(1) });
};

export const unlikePost = async (postId: string, userId: string) => {
  await deleteDoc(likeRef(postId, userId));
  await updateDoc(doc(db, "posts", postId), { likes: increment(-1) });
};

export const hasUserLiked = async (postId: string, userId: string) => {
  const snap = await getDoc(likeRef(postId, userId));
  return snap.exists();
};
