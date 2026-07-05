import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export const migrateJobToActivity = async (uid: string, jobId: string) => {
  if (!uid || !jobId) return;
  try {
    const taskRef = doc(db, `users/${uid}/tasks`, jobId);
    const taskSnap = await getDoc(taskRef);
    
    if (taskSnap.exists()) {
      const taskData = taskSnap.data();
      
      const activityRef = doc(db, `users/${uid}/activities`, jobId);
      const activitySnap = await getDoc(activityRef);
      
      if (!activitySnap.exists()) {
        await setDoc(activityRef, {
          ...taskData,
          type: "meter_test",
          date: taskData.createdAt || new Date().toISOString(),
          details: {
            ...taskData,
          }
        });
        
        await deleteDoc(taskRef);
        console.log(`Successfully migrated ${jobId} to activities`);
      }
    }
  } catch (error) {
    console.error("Migration failed:", error);
  }
};
