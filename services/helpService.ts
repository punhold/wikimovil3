import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";

export interface HelpMessage {
  id: string;
  message: string;
  timestamp: number;
  read: boolean;
}

// 📂 referencia
const helpRef = collection(db, "helpMessages");

// ✉️ crear mensaje
export const createHelpMessage = async (message: string) => {
  await addDoc(helpRef, {
    message,
    timestamp: Date.now(),
    read: false
  });
};

// 📥 traer todos (admin)
export const fetchHelpMessages = async (): Promise<HelpMessage[]> => {
  const q = query(helpRef, orderBy("timestamp", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...(d.data() as Omit<HelpMessage, "id">)
  }));
};

// 👁️ marcar leído
export const markHelpAsRead = async (id: string) => {
  await updateDoc(doc(db, "helpMessages", id), { read: true });
};

// 🗑️ borrar
export const deleteHelpMessage = async (id: string) => {
  await deleteDoc(doc(db, "helpMessages", id));
};
