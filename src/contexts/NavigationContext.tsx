import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';

export type ViewType = 
  | "dashboard" | "activity" | "tasks" | "pms" | "manpower" | "attendance"
  | "kpi" | "analytics" | "trip-ticket" | "chlorination" | "facility"
  | "incidents" | "staff" | "inventory" | "map" | "settings" | "customers"
  | "meter_qa_logs";

export type IntentAction = 'CREATE_INCIDENT' | 'VIEW_TASK' | 'EDIT_ACTIVITY' | 'VIEW_METER_QA';

interface NavigationContextType {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  activeJobId: string | null;
  setActiveJobId: (id: string | null) => void;
  dispatchAction: (action: IntentAction, payload?: any) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  // Initialize state from URL if present
  const [currentView, setCurrentViewState] = useState<ViewType>(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') as ViewType;
    return view || "dashboard";
  });
  
  const [activeJobId, setActiveJobIdState] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('jobId');
  });

  // Sync URL when state changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (currentView === 'dashboard') {
      params.delete('view');
    } else {
      params.set('view', currentView);
    }
    
    if (activeJobId) {
      params.set('jobId', activeJobId);
    } else {
      params.delete('jobId');
    }
    
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [currentView, activeJobId]);

  const setCurrentView = useCallback((view: ViewType) => {
    setCurrentViewState(view);
  }, []);

  const setActiveJobId = useCallback((id: string | null) => {
    setActiveJobIdState(id);
  }, []);

  const dispatchAction = useCallback((action: IntentAction, payload?: any) => {
    switch (action) {
      case 'CREATE_INCIDENT':
        setCurrentView('incidents');
        if (payload?.jobId) setActiveJobId(payload.jobId);
        break;
      case 'VIEW_TASK':
        setCurrentView('tasks');
        if (payload?.jobId) setActiveJobId(payload.jobId);
        break;
      case 'EDIT_ACTIVITY':
        setCurrentView('activity');
        if (payload?.jobId) setActiveJobId(payload.jobId);
        break;
      case 'VIEW_METER_QA':
        setCurrentView('meter_qa_logs');
        if (payload?.jobId) setActiveJobId(payload.jobId);
        break;
      default:
        console.warn('Unknown action:', action);
    }
  }, [setCurrentView, setActiveJobId]);

  return (
    <NavigationContext.Provider value={{ currentView, setCurrentView, activeJobId, setActiveJobId, dispatchAction }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
