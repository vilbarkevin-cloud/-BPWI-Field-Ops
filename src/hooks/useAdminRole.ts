import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

// Global cache to prevent multiple reads per session
const adminCache = new Map<string, boolean>();
const pendingRequests = new Map<string, Promise<boolean>>();

export function useAdminRole(uid: string | null) {
  const [isAdmin, setIsAdmin] = useState(() => uid ? !!adminCache.get(uid) : false);

  useEffect(() => {
    if (!uid) {
      setIsAdmin(false);
      return;
    }

    if (adminCache.has(uid)) {
      setIsAdmin(adminCache.get(uid)!);
      return;
    }

    const checkRole = async () => {
      try {
        let promise = pendingRequests.get(uid);
        if (!promise) {
          promise = getDoc(doc(db, "users", uid, "profile", "info")).then(snap => {
            const data = snap.exists() ? snap.data() : null;
            const role = data?.role;
            
            return role === "admin" || role === "operations_manager" || (typeof role === 'string' && role.toLowerCase().includes('head'));
          });
          pendingRequests.set(uid, promise);
        }
        
        const isUserAdmin = await promise;
        adminCache.set(uid, isUserAdmin);
        setIsAdmin(isUserAdmin);
      } catch (err) {
        console.error("Error checking role:", err);
      }
    };

    checkRole();
  }, [uid]);

  return isAdmin;
}
