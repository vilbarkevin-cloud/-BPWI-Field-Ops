import React from "react";
import {
  LayoutDashboard,
  FileSignature,
  ClipboardList,
  Calendar,
  AlertTriangle,
  Users,
  BarChart3,
  LineChart,
  LogOut,
  Droplet,
  X,
  CalendarDays,
  PackageSearch,
  Car,
  Map as MapIcon,
  Activity,
  Factory,
  Settings,
} from "lucide-react";
import { AppLogo } from "./AppLogo";
import { useAdminRole } from "../hooks/useAdminRole";
import { haptics } from "../utils/haptics";

export type Tab =
  | "dashboard"
  | "activity"
  | "tasks"
  | "pms"
  | "manpower"
  | "incidents"
  | "staff"
  | "kpi"
  | "analytics"
  | "attendance"
  | "inventory"
  | "customers"
  | "meter_qa_logs"
  | "trip-tickets"
  | "live-map"
  | "chlorination"
  | "facilities"
  | "settings";

interface SidebarProps {
  activeTab: Tab | "live-map";
  setActiveTab: (tab: Tab | "live-map") => void;
  currentUser: string;
  currentUid: string;
  onLogout: () => void;
  isMobileOpen: boolean;
  onClose: () => void;
  dashboardMode?: "field_ops" | "management";
  setDashboardMode?: (mode: "field_ops" | "management") => void;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  currentUid,
  onLogout,
  isMobileOpen,
  onClose,
  dashboardMode,
  setDashboardMode,
}: SidebarProps) {
  const isAdmin = useAdminRole(currentUid);

  const tabs: {
    id: Tab | "live-map";
    label: string;
    icon: React.ReactNode;
    hidden?: boolean;
  }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: "activity",
      label: "Work Logs",
      icon: <FileSignature className="w-4 h-4" />,
    },
    { id: "pms", label: "Master Calendar", icon: <Calendar className="w-4 h-4" /> },
    { id: "manpower", label: "Manpower Calendar", icon: <Users className="w-4 h-4" /> },
    {
      id: "facilities",
      label: "Facilities",
      icon: <Factory className="w-4 h-4" />,
    },
    {
      id: "customers",
      label: "Customers",
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "meter_qa_logs",
      label: "Meter QA Logs",
      icon: <ClipboardList className="w-4 h-4" />,
    },
    {
      id: "inventory",
      label: "Inventory (Beta)",
      icon: <PackageSearch className="w-4 h-4" />,
    },
    {
      id: "trip-tickets",
      label: "Trip Tickets",
      icon: <Car className="w-4 h-4" />,
    },
    {
      id: "chlorination",
      label: "Chlorination",
      icon: <Activity className="w-4 h-4" />,
    },
    { id: "kpi", label: "Team KPIs", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "analytics", label: "Performance Analytics", icon: <LineChart className="w-4 h-4" /> },
    {
      id: "staff",
      label: "Team Management",
      icon: <Users className="w-4 h-4" />,
      hidden: !isAdmin,
    },
    {
      id: "live-map",
      label: "Live Map",
      icon: <MapIcon className="w-4 h-4" />,
      hidden: !isAdmin,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen w-64 border-r border-outline-variant flex flex-col z-50 transition-transform duration-300 ease-in-out md:translate-x-0 bg-surface/80 backdrop-blur-md ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-6 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <AppLogo className="w-12 h-12 shrink-0" />
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-[#1F4E5A] leading-tight">
                BPWI
              </h1>
              <p className="text-sm font-medium text-[#6495A3] leading-tight">Field Ops</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1 text-on-surface-variant hover:text-on-surface rounded-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-4 py-2 flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
          <div className="text-label-sm font-semibold text-outline-variant px-2 mb-2 uppercase tracking-wider">
            Menu
          </div>
          {tabs.map((tab) => {
            if (tab.hidden) return null;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  haptics.tap();
                  setActiveTab(tab.id);
                  onClose();
                }}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-left shrink-0 ${
                  isActive
                    ? "bg-primary-container text-primary font-medium"
                    : "text-on-surface hover:bg-surface-container-low font-normal"
                }`}
              >
                {tab.icon}
                <span className="text-sm">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-outline-variant mt-auto shrink-0 bg-surface">
          {isAdmin && setDashboardMode && (
            <div className="mb-3">
              <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">View Mode</div>
              <div className="flex bg-surface-container rounded-lg p-0.5 border border-outline-variant/30">
                <button
                  onClick={() => {
                    haptics.tap();
                    setDashboardMode("field_ops");
                  }}
                  className={`flex-1 text-[11px] font-medium py-1.5 px-2 rounded-md transition-all ${dashboardMode === 'field_ops' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  Field Ops
                </button>
                <button
                  onClick={() => {
                    haptics.tap();
                    setDashboardMode("management");
                  }}
                  className={`flex-1 text-[11px] font-medium py-1.5 px-2 rounded-md transition-all ${dashboardMode === 'management' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  Insights
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/50 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
              {currentUser.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-label-sm text-on-surface truncate" title={currentUser.split(' - ')[0]}>
                {currentUser.split(' - ')[0]}
              </div>
              <div className="text-[10px] text-on-surface-variant truncate" title={currentUser.split(' - ')[1] || (isAdmin ? "Administrator" : "Field Technician")}>
                {currentUser.split(' - ')[1] || (isAdmin
                  ? "Administrator"
                  : "Field Technician")}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              haptics.medium();
              onLogout();
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-colors text-left font-label-md"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
