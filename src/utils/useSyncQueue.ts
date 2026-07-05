import { useState, useEffect, useCallback, useRef } from "react";
import { db, auth } from "../lib/firebase";
import { doc, setDoc, getDoc, writeBatch, serverTimestamp, collection, getDocs } from "firebase/firestore";
import { sanitizePayload } from "./dataSanitizer";
import { get, set, update, keys, del } from "idb-keyval";

export interface PendingItem {
  id: string;
  type: "Activity" | "Task" | "Incident";
  title: string;
  autoRetry: boolean;
  status: "pending" | "syncing" | "completed" | "error";
}

export interface SyncProgress {
  current: number;
  total: number;
  message: string;
}

export interface SyncConflict {
  id: string;
  type: "Activity" | "Task" | "Incident";
  title: string;
  localData: any;
  remoteData: any;
}

export function useSyncQueue(tenantUid?: string | null) {
  const [queueCount, setQueueCount] = useState(0);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const backoffDelayRef = useRef(2000);

  const namespaceKey = (key: string) => {
    const u = tenantUid || auth.currentUser?.uid;
    return u ? `${key}_${u}` : key;
  };

  const getStoreData = async (key: string) => {
    try {
      const data = await get(namespaceKey(key));
      return data || [];
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const calculateQueue = useCallback(async () => {
    try {
      const parsedActivities = await getStoreData("watsanActivities");
      const parsedTasks = await getStoreData(`watsanTasks_${tenantUid || auth.currentUser?.uid}`);
      const parsedIncidents = await getStoreData("watsanIncidents");
      
      let count = 0;
      let items: PendingItem[] = [];

      if (parsedActivities.length > 0) {
        const pending = parsedActivities.filter((a: any) => !a.isSynced || a.justSynced);
        count += pending.filter((a: any) => !a.isSynced).length;
        items.push(
          ...pending.map((a: any) => ({
            id: a.id || Date.now().toString(),
            type: "Activity" as const,
            title: a.type || "Activity Record",
            autoRetry: a.autoRetry !== false,
            status: a.isSynced ? "completed" : "pending",
          })),
        );
      }
      if (parsedTasks.length > 0) {
        const pending = parsedTasks.filter(
          (t: any) => (!t.isSynced || t.justSynced),
        );
        count += pending.filter((t: any) => !t.isSynced).length;
        items.push(
          ...pending.map((t: any) => ({
            id: t.id || Date.now().toString(),
            type: "Task" as const,
            title: t.title || "Task Record",
            autoRetry: t.autoRetry !== false,
            status: t.isSynced ? "completed" : "pending",
          })),
        );
      }
      if (parsedIncidents.length > 0) {
        const pending = parsedIncidents.filter((i: any) => !i.isSynced || i.justSynced);
        count += pending.filter((i: any) => !i.isSynced).length;
        items.push(
          ...pending.map((i: any) => ({
            id: i.id || Date.now().toString(),
            type: "Incident" as const,
            title: i.type || "Incident Report",
            autoRetry: i.autoRetry !== false,
            status: i.isSynced ? "completed" : "pending",
          })),
        );
      }
      setQueueCount(count);
      setPendingItems(items);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleItemRetry = useCallback(
    async (id: string, type: "Activity" | "Task" | "Incident") => {
      try {
        let storageKey = "";
        if (type === "Activity") storageKey = "watsanActivities";
        else if (type === "Task") storageKey = `watsanTasks_${tenantUid || auth.currentUser?.uid}`;
        else if (type === "Incident") storageKey = "watsanIncidents";

        if (!storageKey) return;

        await update(storageKey, (val: any) => {
          if (!val) return val;
          return val.map((item: any) => {
            if (item.id === id) {
              return {
                ...item,
                autoRetry: item.autoRetry === false ? true : false,
              };
            }
            return item;
          });
        });
        calculateQueue();
      } catch (e) {
        console.error(e);
      }
    },
    [calculateQueue],
  );

  const resolveConflict = useCallback(async (id: string, action: 'mine' | 'theirs' | 'merge', mergedData?: any) => {
    const currentUid = tenantUid || auth.currentUser?.uid;
    if (!currentUid) return;

    const conflictIndex = syncConflicts.findIndex(c => c.id === id);
    if (conflictIndex === -1) return;
    const conflict = syncConflicts[conflictIndex];

    let finalData = conflict.localData;
    if (action === 'theirs') {
      finalData = conflict.remoteData;
    } else if (action === 'merge' && mergedData) {
      finalData = mergedData;
    }

    try {
      let path = "";
      if (conflict.type === "Activity") path = `users/${currentUid}/activities`;
      else if (conflict.type === "Task") path = `users/${currentUid}/tasks`;
      else if (conflict.type === "Incident") path = `users/${currentUid}/incidents`;

      finalData.isSynced = true;
      if (conflict.type === "Incident") {
        const payload = { ...finalData };
        delete payload.isSynced;
        await setDoc(doc(db, path, id), sanitizePayload(payload), { merge: true });
      } else {
        await setDoc(doc(db, path, id), sanitizePayload(finalData), { merge: true });
      }

      // Update local storage
      let storageKey = "";
      if (conflict.type === "Activity") storageKey = "watsanActivities";
      else if (conflict.type === "Task") storageKey = `watsanTasks_${tenantUid || auth.currentUser?.uid}`;
      else if (conflict.type === "Incident") storageKey = "watsanIncidents";

      if (storageKey) {
        await update(storageKey, (val: any) => {
           if (!val) return val;
           return val.map((item: any) => item.id === id ? finalData : item);
        });
      }

      setSyncConflicts(prev => prev.filter(c => c.id !== id));
      calculateQueue();
    } catch (e) {
      console.error("Error resolving conflict", e);
    }
  }, [syncConflicts, calculateQueue, tenantUid]);

  const clearCompleted = useCallback(async () => {
    for (const key of ["watsanActivities", `watsanTasks_${tenantUid || auth.currentUser?.uid}`, "watsanIncidents"]) {
       await update(key, (val: any) => {
          if (!val) return val;
          return val.map((item: any) => {
             if (item.justSynced) {
               const { justSynced, ...rest } = item;
               return rest;
             }
             return item;
          });
       });
    }
    calculateQueue();
  }, [calculateQueue]);

  const syncData = useCallback(async () => {
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: queueCount, message: "Preparing sync..." });
    await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate network wait
    let updated = false;
    let hasError = false;
    let newConflicts: SyncConflict[] = [];

    const currentUid = tenantUid || auth.currentUser?.uid;
    if (!currentUid) {
      setIsSyncing(false);
      setSyncProgress(null);
      return;
    }

    const batch = writeBatch(db);
    let batchHasOperations = false;
    let processed = 0;

    // Process Tasks
    const parsedTasks = await getStoreData(`watsanTasks_${tenantUid || auth.currentUser?.uid}`);
    if (parsedTasks.length > 0) {
      const toSync = parsedTasks.filter(
        (t: any) => !t.isSynced && t.autoRetry !== false,
      );

      for (let t of toSync) {
        setSyncProgress({ current: processed, total: queueCount, message: `Syncing task: ${t.title || "Task"}` });
        try {
          const docRef = doc(db, `users/${currentUid}/tasks`, t.id);
          const snap = await getDoc(docRef);
          
          if (snap.exists() && snap.data().status === 'completed' && snap.data().completedAt && t.completedAt && snap.data().completedAt !== t.completedAt) {
             newConflicts.push({ id: t.id, type: "Task", title: t.title, localData: t, remoteData: snap.data() });
          } else {
            const deltaPayload: any = {
              status: t.status,
              isSynced: true,
              updatedAt: serverTimestamp(),
            };
            if (t.completedAt) deltaPayload.completedAt = t.completedAt;
            if (t.photoUrl) deltaPayload.photoUrl = t.photoUrl;
            if (t.notes) deltaPayload.notes = t.notes;
            if (t.usedParts) deltaPayload.consumedParts = t.usedParts;
            if (t.usedParts) deltaPayload.usedParts = t.usedParts;
            // Also merge any core fields in case it's a new task
            if (t.title) deltaPayload.title = t.title;
            if (t.area) deltaPayload.area = t.area;
            if (t.location) deltaPayload.location = t.location;
            if (t.priority) deltaPayload.priority = t.priority;
            if (t.deadline) deltaPayload.deadline = t.deadline;
            if (t.description) deltaPayload.description = t.description;
            if (t.assignedTo) deltaPayload.assignedTo = t.assignedTo;
            if (t.linkedActivity) deltaPayload.linkedActivity = t.linkedActivity;
            if (t.joNumber) deltaPayload.joNumber = t.joNumber;
            if (t.accountNumber) deltaPayload.accountNumber = t.accountNumber;
            if (t.accountName) deltaPayload.accountName = t.accountName;
            if (!snap.exists()) {
               deltaPayload.createdAt = serverTimestamp();
               deltaPayload.userId = currentUid;
               deltaPayload.type = "task";
            }

            batch.set(docRef, sanitizePayload(deltaPayload), { merge: true });
            batchHasOperations = true;
            t.isSynced = true;
            t.justSynced = true;
          }
        } catch (e) {
          console.error("Failed to sync task", e);
          hasError = true;
        }
        processed++;
      }

      const synced = parsedTasks.map((t: any) => {
        const corresponding = toSync.find((syncTask: any) => syncTask.id === t.id);
        if (corresponding && corresponding.isSynced) {
          return { ...t, isSynced: true, justSynced: true };
        }
        return t;
      });

      if (toSync.length > 0) {
        await set(`watsanTasks_${tenantUid || auth.currentUser?.uid}`, synced);
        updated = true;
      }
    }

    // Process Activities
    const parsedActivities = await getStoreData("watsanActivities");
    if (parsedActivities.length > 0) {
      const toSync = parsedActivities.filter(
        (a: any) => !a.isSynced && a.autoRetry !== false,
      );
      
      for (let a of toSync) {
        setSyncProgress({ current: processed, total: queueCount, message: `Syncing activity: ${a.type || "Activity"}` });
        try {
          const docRef = doc(db, `users/${currentUid}/activities`, a.id);
          const snap = await getDoc(docRef);

          if (snap.exists() && snap.data().date !== a.date) {
            newConflicts.push({ id: a.id, type: "Activity", title: a.type || "Activity", localData: a, remoteData: snap.data() });
          } else {
            const { createdAt, updatedAt, ...rest } = a;
            batch.set(docRef, sanitizePayload({
              ...rest,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }), { merge: true });
            batchHasOperations = true;
            a.isSynced = true;
            a.justSynced = true;
          }
        } catch (e) {
          console.error("Failed to sync activity", e);
          hasError = true;
        }
        processed++;
      }

      const synced = parsedActivities.map((a: any) => {
         const corresponding = toSync.find((syncAct: any) => syncAct.id === a.id);
         if (corresponding && corresponding.isSynced) {
           return { ...a, isSynced: true, justSynced: true };
         }
         return a;
      });

      if (toSync.length > 0) {
        await set(namespaceKey("watsanActivities"), synced);
        updated = true;
      }
    }

    // Process Incidents
    const parsedIncidents = await getStoreData("watsanIncidents");
    if (parsedIncidents.length > 0) {
      const toSync = parsedIncidents.filter(
        (i: any) => !i.isSynced && i.autoRetry !== false,
      );

      for (let i of toSync) {
        setSyncProgress({ current: processed, total: queueCount, message: `Syncing incident: ${i.type || "Incident"}` });
        try {
          const docRef = doc(db, `users/${currentUid}/incidents`, i.id);
          const snap = await getDoc(docRef);

          if (snap.exists() && snap.data().status !== i.status) {
            newConflicts.push({ id: i.id, type: "Incident", title: i.type || "Incident", localData: i, remoteData: snap.data() });
          } else {
            const { createdAt, updatedAt, isSynced, ...rest } = i;
            batch.set(docRef, sanitizePayload({
              ...rest,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }), { merge: true });
            batchHasOperations = true;
            i.isSynced = true;
            i.justSynced = true;
          }
        } catch (e) {
          console.error("Failed to sync incident", e);
          hasError = true;
        }
        processed++;
      }

      const synced = parsedIncidents.map((i: any) => {
         const corresponding = toSync.find((syncInc: any) => syncInc.id === i.id);
         if (corresponding && corresponding.isSynced) {
           return { ...i, isSynced: true, justSynced: true };
         }
         return i;
      });

      if (toSync.length > 0) {
        await set(namespaceKey("watsanIncidents"), synced);
        updated = true;
      }
    }

    if (batchHasOperations) {
      setSyncProgress({ current: processed, total: queueCount, message: "Committing changes..." });
      try {
        await batch.commit();
      } catch (err) {
        console.error("Batch commit failed", err);
        hasError = true;
      }
    }

    if (newConflicts.length > 0) {
      setSyncConflicts((prev) => {
        const map = new Map();
        prev.forEach(c => map.set(c.id, c));
        newConflicts.forEach(c => map.set(c.id, c));
        return Array.from(map.values());
      });
    }

    if (updated) calculateQueue();
    setIsSyncing(false);
    setTimeout(() => setSyncProgress(null), 1000);
    return !hasError;
  }, [calculateQueue, queueCount, tenantUid]);

  const validateCache = useCallback(async () => {
     // Validate against Firestore to clean up orphaned entries
     const currentUid = tenantUid || auth.currentUser?.uid;
     if (!currentUid || !navigator.onLine) return;
     
     try {
        const parsedTasks = await getStoreData(`watsanTasks_${tenantUid || auth.currentUser?.uid}`);
        if (parsedTasks.length > 0) {
           // We only want to clean up tasks that are marked synced but no longer exist remotely,
           // or we can just drop any task that we try to sync but it throws a specific error.
           // Since the request asks to "compare locally cached pending items against the Firestore collection schema to detect and clean up orphaned entries", we can just fetch and remove orphans.
           const snapshot = await getDocs(collection(db, `users/${currentUid}/tasks`));
           const remoteIds = new Set(snapshot.docs.map(d => d.id));
           const validTasks = parsedTasks.filter((t: any) => !t.isSynced || remoteIds.has(t.id));
           if (validTasks.length !== parsedTasks.length) {
              await set(`watsanTasks_${tenantUid || auth.currentUser?.uid}`, validTasks);
           }
        }
     } catch(e) {
       console.error("Error validating cache:", e);
     }
  }, [tenantUid]);

  useEffect(() => {
    calculateQueue();
    // Validate cache on load
    validateCache();

    // Re-check periodically or on storage event
    const interval = setInterval(calculateQueue, 30000);
    
    // We can't rely on 'storage' event for IndexedDB the same way we do for localStorage.
    // We should poll or use BroadcastChannel for multi-tab sync if strictly needed.
    
    // Auto-sync when coming online
    const handleOnline = () => {
      backoffDelayRef.current = 2000;
      if (!isSyncing) syncData();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
    };
  }, [calculateQueue, syncData, isSyncing, validateCache]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const runSyncLoop = async () => {
      if (queueCount > 0 && navigator.onLine && !isSyncing) {
        const success = await syncData();
        if (success) {
          backoffDelayRef.current = 2000; // Reset on success
        } else {
          backoffDelayRef.current = Math.min(backoffDelayRef.current * 2, 60000); // Exponential backoff up to 1 min
        }
      }
      
      // Schedule next attempt only if not currently syncing to avoid multiple triggers
      if (!isSyncing) {
         timeoutId = setTimeout(runSyncLoop, backoffDelayRef.current);
      }
    };

    if (queueCount > 0 && !isSyncing) {
      timeoutId = setTimeout(runSyncLoop, backoffDelayRef.current);
    } else if (queueCount === 0) {
      backoffDelayRef.current = 2000; // Reset when queue is empty
    }

    return () => clearTimeout(timeoutId);
  }, [queueCount, isSyncing, syncData]);

  // Expose a helper to add to queue from any component
  const enqueueAction = useCallback(async (store: string, item: any) => {
     await update(namespaceKey(store), (val: any) => {
        const items = val || [];
        // replace if exists
        const idx = items.findIndex((i: any) => i.id === item.id);
        if (idx >= 0) {
          items[idx] = item;
        } else {
          items.push(item);
        }
        return items;
     });
     calculateQueue();
  }, [calculateQueue, tenantUid]);

  return {
    queueCount,
    pendingItems,
    syncConflicts,
    setSyncConflicts,
    refreshQueue: calculateQueue,
    syncData,
    resolveConflict,
    toggleItemRetry,
    isSyncing,
    clearCompleted,
    syncProgress,
    enqueueAction,
  };
}


