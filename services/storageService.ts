import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// 🔥 Versión compatible con handleCreatePost
export const uploadFile = async (file: File, path?: string): Promise<string> => {
  // Si no recibimos path → usamos el que ya usabas: uploads/
  const finalPath = path || `uploads/${Date.now()}_${file.name}`;

  const storageRef = ref(storage, finalPath);
  await uploadBytes(storageRef, file);

  const url = await getDownloadURL(storageRef);
  return url;
};

