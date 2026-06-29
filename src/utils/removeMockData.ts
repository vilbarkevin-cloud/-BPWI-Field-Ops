import { collection, query, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const removeMockDataFromFirestore = async (uid: string) => {
  if (!uid) return;

  const mockTasks = [
    "Emergency Generator Repair",
    "Cooling System Critical Alert",
    "Routine Firewall Update",
    "Inventory Audit: Spare Parts Rack",
    "Routine Generator Inspection",
    "Water Quality Sampling",
    "Chlorine Check"
  ];

  try {
    // 1. Remove Mock Tasks
    const tasksRef = collection(db, `users/${uid}/tasks`);
    const qTasks = query(tasksRef);
    const tasksSnap = await getDocs(qTasks);
    
    let deletedTasks = 0;
    tasksSnap.forEach((d) => {
      const data = d.data();
      if (mockTasks.includes(data.title) || data.id?.startsWith("TSK-") || d.id.startsWith("TSK-") || data.title?.includes("Audit") || data.title?.includes("Routine") || data.title?.includes("Repair")) {
        deleteDoc(doc(db, `users/${uid}/tasks`, d.id));
        deletedTasks++;
      }
    });
    
    if (deletedTasks > 0) {
      console.log(`Deleted ${deletedTasks} mock tasks`);
    }

    // 2. Remove Mock Inventory
    const invRef = collection(db, `users/${uid}/inventory`);
    const qInv = query(invRef);
    const invSnap = await getDocs(qInv);
    
    let deletedInv = 0;
    invSnap.forEach((d) => {
      const data = d.data();
      if (data.id?.startsWith("INV-") || d.id.startsWith("INV-")) {
        deleteDoc(doc(db, `users/${uid}/inventory`, d.id));
        deletedInv++;
      }
    });

    if (deletedInv > 0) {
      console.log(`Deleted ${deletedInv} mock inventory items`);
    }

    // 3. Remove Mock Activities
    const actRef = collection(db, `users/${uid}/activities`);
    const qAct = query(actRef);
    const actSnap = await getDocs(qAct);
    
    let deletedAct = 0;
    actSnap.forEach((d) => {
      deleteDoc(doc(db, `users/${uid}/activities`, d.id));
      deletedAct++;
    });

    if (deletedAct > 0) {
      console.log(`Deleted ${deletedAct} mock activities`);
    }
    
    // 4. Remove Mock PMS Schedules
    const pmsRef = collection(db, `users/${uid}/pmsSchedules`);
    const qPms = query(pmsRef);
    const pmsSnap = await getDocs(qPms);
    
    let deletedPms = 0;
    pmsSnap.forEach((d) => {
      deleteDoc(doc(db, `users/${uid}/pmsSchedules`, d.id));
      deletedPms++;
    });

    if (deletedPms > 0) {
      console.log(`Deleted ${deletedPms} mock PMS schedules`);
    }

    localStorage.setItem("mockDataCleanedUp3", "true");

  } catch (err) {
    console.error("Error removing mock data:", err);
  }
};
