import { useState, useEffect } from "react";
import { Sidebar, Tab } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { DashboardView } from "./views/DashboardView";
import { LoginView } from "./views/LoginView";
import { ActivityView } from "./views/ActivityView";
import { TasksView } from "./views/TasksView";
import { IncidentsView } from "./views/IncidentsView";
import { MapView } from "./views/MapView";
import { MasterCalendarView } from "./views/MasterCalendarView";
import { AttendanceView } from "./views/AttendanceView";
import { InventoryView } from "./views/InventoryView";
import { CustomersView } from "./views/CustomersView";
import { StaffView } from "./views/StaffView";
import { KpiView } from "./views/KpiView";
import { PerformanceAnalyticsView } from "./views/PerformanceAnalyticsView";
import { TripTicketView } from "./views/TripTicketView";
import { ChlorinationView } from "./views/ChlorinationView";
import { FacilityView } from "./views/FacilityView";
import { SettingsView } from "./views/SettingsView";
import { MeterQALogsView } from "./views/MeterQALogsView";

export default function App() {
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab | "live-map">("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!currentUid) {
    return <LoginView onLogin={(user, uid) => {
      setCurrentUser(user);
      setCurrentUid(uid);
    }} />;
  }

  return (
    <div className={`flex h-screen bg-surface overflow-hidden ${isDarkMode ? "dark" : ""}`}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsMobileMenuOpen(false);
        }}
        currentUser={currentUser || ""}
        currentUid={currentUid}
        onLogout={() => {
          setCurrentUid(null);
          setCurrentUser(null);
        }}
        isMobileOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <TopBar
          onMenuClick={() => setIsMobileMenuOpen(true)}
          isOnline={isOnline}
        />
        
        <main className="flex-1 overflow-y-auto">
          {activeTab === "dashboard" && <DashboardView setActiveTab={setActiveTab} />}
          {activeTab === "activity" && <ActivityView currentUid={currentUid} currentUser={currentUser} />}
          {activeTab === "tasks" && <TasksView currentUid={currentUid} currentUser={currentUser} />}
          {activeTab === "incidents" && <IncidentsView currentUid={currentUid} currentUser={currentUser} />}
          {activeTab === "live-map" && <MapView />}
          {activeTab === "attendance" && <AttendanceView currentUser={currentUser || ""} currentUid={currentUid} />}
          {activeTab === "inventory" && <InventoryView />}
          {activeTab === "customers" && <CustomersView currentUid={currentUid} />}
          {activeTab === "staff" && <StaffView currentUser={currentUser || ""} currentUid={currentUid} />}
          {activeTab === "kpi" && <KpiView />}
          {activeTab === "analytics" && <PerformanceAnalyticsView currentUid={currentUid} />}
          {activeTab === "trip-tickets" && <TripTicketView currentUid={currentUid} currentUser={currentUser} />}
          {activeTab === "chlorination" && <ChlorinationView />}
          {activeTab === "facilities" && <FacilityView currentUid={currentUid} setActiveTab={setActiveTab} />}
          {activeTab === "settings" && <SettingsView userEmail={currentUser} isDarkMode={isDarkMode} toggleTheme={() => setIsDarkMode(!isDarkMode)} />}
          {activeTab === "meter_qa_logs" && <MeterQALogsView currentUid={currentUid} />}
          {activeTab === "pms" && <MasterCalendarView currentUid={currentUid} setActiveTab={setActiveTab} />}
        </main>
      </div>
    </div>
  );
}
