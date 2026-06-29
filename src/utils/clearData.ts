import { db } from "../lib/firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";

export async function clearAllCalendarEvents(uid: string) {
  const snapshot = await getDocs(collection(db, `users/${uid}/CalendarEvents`));
  let count = 0;
  for (const document of snapshot.docs) {
    await deleteDoc(doc(db, `users/${uid}/CalendarEvents`, document.id));
    count++;
  }
  console.log(`Deleted ${count} calendar events.`);
}
