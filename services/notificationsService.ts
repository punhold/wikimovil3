
import { db } from "./firebase";
import { collection, addDoc, getDocs, orderBy, query } from "firebase/firestore";
import type { Notification } from "../types";
import { doc, updateDoc } from "firebase/firestore";
import { deleteDoc, } from "firebase/firestore";


const getUserNotificationsCollection = (userId: string) =>
  collection(db, "users", userId, "notifications");

/**
 * Crea una notificación en Firestore dentro de:
 * users/{userId}/notifications/{autoId}
 */
export const createUserNotification = async (
  userId: string,
  notification: Omit<Notification, "id" | "userId">
) => {
  const ref = getUserNotificationsCollection(userId);
  await addDoc(ref, {
    ...notification,
    userId,
  });
};

/**
 * Trae todas las notificaciones de un usuario ordenadas por timestamp desc.
 */
export const fetchUserNotifications = async (userId: string): Promise<Notification[]> => {
  const ref = getUserNotificationsCollection(userId);
  const q = query(ref, orderBy("timestamp", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      userId: data.userId,
      type: data.type,
      message: data.message,
      read: !!data.read,
      timestamp: data.timestamp ?? Date.now(),
      postId: data.postId,
      postTitle: data.postTitle,
      triggerUser: data.triggerUser,
    } as Notification;
  });
};

export const markNotificationAsRead = async (
  userId: string,
  notificationId: string
) => {
  const ref = doc(db, "users", userId, "notifications", notificationId);
  await updateDoc(ref, { read: true });
};

export const deleteAllUserNotifications = async (userId: string) => {
  const ref = collection(db, "users", userId, "notifications");
  const snap = await getDocs(ref);

  const promises = snap.docs.map(d =>
    deleteDoc(doc(db, "users", userId, "notifications", d.id))
  );

  await Promise.all(promises);
};
