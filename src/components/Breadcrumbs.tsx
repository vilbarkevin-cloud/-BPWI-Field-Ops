import React, { useEffect, useState } from 'react';
import { ChevronRight, Home, Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { useSyncQueue } from '../utils/useSyncQueue';
import { auth } from '../lib/firebase';
import { useNetworkInfo } from '../utils/useNetworkInfo';

const titleMap: Record<string, string> = {
  dashboard: "Dashboard",
  activity: "Field Activities",
  tasks: "Jobs / Tasks",
  pms: "Preventive Maintenance",
  manpower: "Manpower / Deployment",
  attendance: "Attendance",
  kpi: "KPIs / Reports",
  analytics: "Performance Analytics",
  "trip-ticket": "Trip Tickets",
  chlorination: "Chlorination",
  facility: "Facilities",
  incidents: "Incidents",
  staff: "Staff Management",
  inventory: "Inventory",
  map: "Live Map",
  settings: "Settings",
  customers: "Customers",
  meter_qa_logs: "Meter QA Logs",
};

export function Breadcrumbs() {
  const { currentView, setCurrentView, activeJobId, setActiveJobId } = useNavigation();
  const { isOnline } = useNetworkInfo();
  
  // We need currentUid to use useSyncQueue
  const [currentUid, setCurrentUid] = useState<string | null>(auth.currentUser?.uid || null);
  
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUid(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  const { isSyncing, queueCount } = useSyncQueue(currentUid);
  const [showSaved, setShowSaved] = useState(false);
  
  // Flash "Saved!" briefly after sync finishes
  useEffect(() => {
    if (!isSyncing && queueCount === 0 && isOnline) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSyncing, queueCount, isOnline]);

  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-outline-variant/30 bg-surface">
      <nav className="flex items-center space-x-2 text-sm text-on-surface-variant">
        <button 
          onClick={() => {
            setCurrentView("dashboard");
            setActiveJobId(null);
          }}
          className="flex items-center hover:text-primary transition-colors focus:outline-none"
        >
          <Home className="w-4 h-4 mr-1" />
        </button>
        
        {currentView !== "dashboard" && (
          <>
            <ChevronRight className="w-4 h-4 opacity-50" />
            <button 
              className="hover:text-primary transition-colors font-medium focus:outline-none"
              onClick={() => setActiveJobId(null)}
            >
              {titleMap[currentView] || currentView}
            </button>
          </>
        )}

        {activeJobId && (
          <>
            <ChevronRight className="w-4 h-4 opacity-50" />
            <span className="font-semibold text-primary truncate max-w-[200px]">
              {activeJobId}
            </span>
          </>
        )}
      </nav>

      {/* Sync Status Indicator */}
      <div className="flex items-center text-xs font-medium">
        {!isOnline ? (
          <div className="flex items-center text-warning gap-1.5" title="Offline">
            <CloudOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Offline ({queueCount} pending)</span>
          </div>
        ) : isSyncing ? (
          <div className="flex items-center text-primary gap-1.5" title="Syncing...">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="hidden sm:inline">Syncing...</span>
          </div>
        ) : showSaved ? (
          <div className="flex items-center text-success gap-1.5 animate-in fade-in" title="Synced">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Saved</span>
          </div>
        ) : (
          <div className="flex items-center text-on-surface-variant/50 gap-1.5" title="Cloud Sync Active">
            <Cloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Synced</span>
          </div>
        )}
      </div>
    </div>
  );
}
