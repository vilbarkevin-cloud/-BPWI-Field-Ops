import { get, set, keys } from "idb-keyval";

export const cleanUpOldLocalData = async () => {
  const MAX_AGE_DAYS = 45;
  const msInDay = 24 * 60 * 60 * 1000;
  const cutoffDate = Date.now() - (MAX_AGE_DAYS * msInDay);

  try {
    const allKeys = await keys();
    const targetPrefixes = ["watsanActivities", "watsanTasks", "watsanIncidents"];
    const storageKeys = allKeys.filter(k => 
      typeof k === 'string' && targetPrefixes.some(prefix => k.startsWith(prefix))
    ) as string[];

    let removedCount = 0;
    for (const key of storageKeys) {
      const parsed = await get(key);
      if (parsed && Array.isArray(parsed)) {
        const filtered = parsed.filter((item: any) => {
          const itemDate = item.createdAt || item.updatedAt || item.date || item.assignedAt || item.timestamp;
          if (itemDate) {
            const timestamp = typeof itemDate === 'number' ? itemDate : new Date(itemDate).getTime();
            if (!isNaN(timestamp) && timestamp < cutoffDate) {
              removedCount++;
              return false;
            }
          }
          return true;
        });
        if (filtered.length < parsed.length) {
          await set(key, filtered);
        }
      }
    }
    console.log(`Cleanup complete: Removed ${removedCount} items older than 45 days.`);
  } catch (error) {
    console.error("Failed to run local photo cleanup:", error);
  }
};
