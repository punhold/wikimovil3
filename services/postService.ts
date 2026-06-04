import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { Post } from "../types";

const postsRef = collection(db, "posts");

// Traer todos los posts desde Firestore
export const fetchPosts = async (): Promise<Post[]> => {
  const snap = await getDocs(postsRef);

  const posts: Post[] = [];

  for (const d of snap.docs) {
    const data = d.data();

    // Leer COMENTARIOS reales desde la subcolección
    const commentsSnap = await getDocs(collection(db, "posts", d.id, "comments"));
    const comments = commentsSnap.docs.map((c) => ({
      id: c.id,
      ...c.data()
    })) as any[]; // ← evita errores de TS

    posts.push({
      id: d.id,
      title: data.title || "",
      authorId: data.authorId || "",
      authorName: data.authorName || "",
      authorInitials: data.authorInitials || "",
      authorColor: data.authorColor || "",
      authorBadges: data.authorBadges || [],
      content: data.content || "",
      imageUrl: data.imageUrl || null,
      tags: data.tags || [],
      likes: data.likes || 0,
      comments: comments,   // 👈 AHORA SÍ un Comment[]
      timestamp: data.timestamp || Date.now(),
      isVerified: data.isVerified ?? false,
    });
  }

  // Ordenar de más nuevo a más viejo
  return posts.sort((a, b) => b.timestamp - a.timestamp);
};




// Crear un post en Firestore, devuelve el id
export const createPost = async (post: Omit<Post, "id">): Promise<string> => {
  const { ...data } = post;
  const ref = await addDoc(postsRef, data);
  return ref.id;
};

// Opcional: actualizar un post
export const updatePost = async (id: string, data: Partial<Post>) => {
  await updateDoc(doc(db, "posts", id), data);
};

// Opcional: borrar un post
export const deletePostById = async (id: string) => {
  await deleteDoc(doc(db, "posts", id));
};
