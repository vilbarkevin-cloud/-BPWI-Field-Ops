import { useState, useCallback } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

// Global cache to persist across component unmounts
const globalCache: Record<string, any> = {};
const queryCache: Record<string, any[]> = {};

export function useResource() {
  const [cache, setCache] = useState<Record<string, any>>(globalCache);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const getJobDetails = useCallback(async (jobId: string, collectionName: string = 'activities') => {
    if (!jobId) return null;
    const cacheKey = `${collectionName}_${jobId}`;
    
    // Return cached if exists
    if (globalCache[cacheKey]) {
      return globalCache[cacheKey];
    }
    
    // Prevent duplicate fetches
    if (loading[cacheKey]) {
      return null;
    }
    
    const uid = auth.currentUser?.uid;
    if (!uid) return null;

    setLoading(prev => ({ ...prev, [cacheKey]: true }));
    
    try {
      const docRef = doc(db, `users/${uid}/${collectionName}`, jobId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        globalCache[cacheKey] = data; // update global
        setCache(prev => ({ ...prev, [cacheKey]: data })); // update local state to trigger re-render
        return data;
      }
    } catch (err) {
      console.error("Error fetching resource:", err);
    } finally {
      setLoading(prev => ({ ...prev, [cacheKey]: false }));
    }
    
    return null;
  }, [loading]);
  
  // Pre-populate cache (useful for lists of items that might be viewed individually)
  const populateCache = useCallback((items: any[], collectionName: string = 'activities') => {
    let updated = false;
    const newCache = { ...cache };
    
    items.forEach(item => {
      if (item && item.id) {
        const cacheKey = `${collectionName}_${item.id}`;
        if (!newCache[cacheKey]) {
          newCache[cacheKey] = item;
          globalCache[cacheKey] = item;
          updated = true;
        }
      }
    });
    
    if (updated) {
      setCache(newCache);
    }
  }, [cache]);

  return {
    getJobDetails,
    populateCache,
    cache,
    loading
  };
}
