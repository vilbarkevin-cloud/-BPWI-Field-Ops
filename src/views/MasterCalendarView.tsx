import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  X,
  CloudUpload,
  Loader2,
  Camera,
  QrCode,
  FileBox,
  PenTool,
} from "lucide-react";
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
} from "../lib/workspaceAuth";
import { syncToGoogleCalendar } from "../lib/gcalSync";
import { facilityEquipment, facilitiesList } from "../lib/facilityData";
import { pmsCsvData } from "../lib/pmsData";
import Papa from "papaparse";
import type { User } from "firebase/auth";

import { useNetworkInfo } from "../utils/useNetworkInfo";
import { useToast } from "../utils/ToastContext";

import { db } from "../lib/firebase";
import { collection, query, getDocs, where, doc, updateDoc, setDoc, addDoc, serverTimestamp, writeBatch } from "firebase/firestore";

interface CalendarEvent {
  id: string;
  type: "PMS" | "SHIFT";
  title: string;
  location: string;
  startTime: Date | null;
  endTime: Date | null;
  assignedTo: string | null;
  status?: string;
  // Legacy / PMS specifics
  pumpStation?: string;
  wellCode?: string;
  activity?: string;
  remarks?: string;
  actualDate?: Date | null;
  linkedActivity?: any;
}

interface MasterCalendarViewProps {
  setActiveTab?: any;
  currentUid?: string | null;
}

import { clearAllCalendarEvents } from "../utils/clearData";

export function MasterCalendarView({ currentUid, setActiveTab }: MasterCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 5)); // June 2026 defaults to user's time context
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewMode, setViewMode] = useState<"ALL" | "PMS" | "SHIFT">("ALL");
  const [activeView, setActiveView] = useState<"calendar" | "history">("calendar");
  const [historyFacilityFilter, setHistoryFacilityFilter] = useState<string>("ALL");
  const [taskFilter, setTaskFilter] = useState<"ALL" | "UPCOMING" | "OVERDUE" | "COMPLETED">("ALL");

  // removed automatic clearing on load

  
  useEffect(() => {
    (window as any).pmsViewMounted = true;
    const handleOpenNewPms = () => setShowNewScheduleModal(true);
    window.addEventListener("open-new-pms", handleOpenNewPms);
    return () => {
      (window as any).pmsViewMounted = false;
      window.removeEventListener("open-new-pms", handleOpenNewPms);
    };
  }, []);

  const [showNewScheduleModal, setShowNewScheduleModal] = useState(false);
  const [newScheduleForm, setNewScheduleForm] = useState({
    type: "PMS" as "PMS" | "SHIFT",
    title: "", // used for SHIFT
    pumpStation: "",
    wellCode: "",
    activity: "",
    startTime: "",
    endTime: "",
    assignedTo: "",
  });

  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [scannedAsset, setScannedAsset] = useState<any | null>(null);
  const { showToast } = useToast();
  const { isLowDataMode } = useNetworkInfo();
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [completedActivities, setCompletedActivities] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUid) return;
    const fetchActivities = async () => {
      try {
        const q1 = query(
          collection(db, `users/${currentUid}/activities`),
          where("type", "==", "flushing"),
        );
        const q2 = query(
          collection(db, `users/${currentUid}/activities`),
          where("type", "==", "tank_cleaning"),
        );
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        setCompletedActivities([
          ...snap1.docs.map((d) => ({ ...d.data(), id: d.id })),
          ...snap2.docs.map((d) => ({ ...d.data(), id: d.id })),
        ]);
      } catch (e) {
        console.error("Error fetching activities for PMS:", e);
      }
    };
    fetchActivities();
  }, [currentUid]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (u, t) => {
        setNeedsAuth(false);
        setUser(u);
      },
      () => setNeedsAuth(true),
    );
    return () => unsubscribe();
  }, []);

  // Parse CSV Data (PMS legacy fallback)
  const parsedData = useMemo(() => {
    const { data } = Papa.parse(pmsCsvData.trim(), {
      header: true,
      skipEmptyLines: true,
    });
    return (data as any[])
      .map((row, index) => {
        let sDate = null;
        let aDate = null;
        if (row["SCHED"]) {
          sDate = new Date(row["SCHED"]);
        }
        if (row["ACTUAL PM"]) {
          aDate = new Date(row["ACTUAL PM"]);
        }
        return {
          id: `pms-${index}`,
          type: "PMS",
          title: row["Activity"] || row["FLUSHING SCOPE"] || "PMS Task",
          location: row["PUMP STATION"] || "",
          startTime: sDate,
          endTime: sDate, // Fallback
          assignedTo: null,
          pumpStation: row["PUMP STATION"] || "",
          wellCode: row["WELL CODE"] || "",
          activity: row["Activity"] || row["FLUSHING SCOPE"] || "",
          remarks: row["REMARKS"] || "",
          actualDate: aDate,
        } as CalendarEvent;
      })
      .filter((t) => t.startTime !== null);
  }, []);

  useEffect(() => {
    if (!currentUid) return;
    const q = query(collection(db, `users/${currentUid}/CalendarEvents`));
    getDocs(q).then(snap => {
      if (snap.empty) {
        // If empty, sync the default parsedData CSV to firestore once
        const parseAndUpload = async () => {
          const defaultTasks = parsedData; // using the generic parsedData
          for (const task of defaultTasks) {
            await setDoc(doc(collection(db, `users/${currentUid}/CalendarEvents`)), {
              ...task,
              startTime: task.startTime ? task.startTime.toISOString() : null,
              endTime: task.endTime ? task.endTime.toISOString() : null,
              actualDate: task.actualDate ? task.actualDate.toISOString() : null,
            });
          }
          const resnap = await getDocs(q);
          const loaded = resnap.docs.map(d => {
            const data = d.data();
            return {
              ...data,
              id: d.id,
              startTime: data.startTime ? new Date(data.startTime) : null,
              endTime: data.endTime ? new Date(data.endTime) : null,
              actualDate: data.actualDate ? new Date(data.actualDate) : null,
            } as CalendarEvent;
          });
          setEvents(loaded);
        };
        parseAndUpload();
      } else {
        const loaded = snap.docs.map(d => {
          const data = d.data();
          return {
            ...data,
            id: d.id,
            startTime: data.startTime ? new Date(data.startTime) : null,
            endTime: data.endTime ? new Date(data.endTime) : null,
            actualDate: data.actualDate ? new Date(data.actualDate) : null,
          } as CalendarEvent;
        });
        setEvents(loaded);
      }
    });
  }, [currentUid, parsedData]);

  const displayedEvents = useMemo(() => {
    let filtered = events.filter(e => {
      if (e.type !== "PMS") return false;
      if (taskFilter === "ALL") return true;
      if (taskFilter === "COMPLETED") return e.status === "completed";
      
      // Assume a task is overdue if its start time was before today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      if (taskFilter === "OVERDUE") return e.status !== "completed" && e.startTime && e.startTime.getTime() < todayStart.getTime();
      if (taskFilter === "UPCOMING") return e.status !== "completed" && (!e.startTime || e.startTime.getTime() >= todayStart.getTime());
      return true;
    });

    return filtered.map((t) => {
      let linkedActivity = null;
      if (t.type === "PMS" && t.activity?.toLowerCase().includes("flushing")) {
        linkedActivity = completedActivities.find((act) => {
          if (act.type !== "flushing") return false;
          // check matching location roughly
          const taskLoc = `${t.pumpStation} ${t.remarks}`.toLowerCase();
          const actLoc =
            `${act.area} ${act.siteOrWell} ${act.blockLot}`.toLowerCase();

          const taskWords = taskLoc.split(" ").filter((w) => w.length > 2);
          const hasCommonWord = taskWords.some((w) => actLoc.includes(w));
          const sameMonth =
            t.startTime &&
            act.date &&
            new Date(act.date).getMonth() === t.startTime.getMonth();

          return hasCommonWord && sameMonth;
        });
      }

      if (linkedActivity) {
        // "show only if there's available photo" => check if the activity has photos
        const hasPhotos = linkedActivity.blowOffs?.some(
          (bo: any) => bo.initialPhoto || bo.finalPhoto,
        );
        if (hasPhotos) {
          return {
            ...t,
            actualDate: new Date(linkedActivity.date),
            linkedActivity,
          };
        }
      }
      return t;
    });
  }, [events, completedActivities, viewMode, taskFilter]);

  const handleSync = async () => {
    try {
      if (needsAuth) {
        const result = await googleSignIn();
        if (result) {
          setNeedsAuth(false);
          setUser(result.user);
        } else {
          return;
        }
      }

      setIsSyncing(true);
      setSyncProgress({ current: 0, total: 1 });
      await syncToGoogleCalendar((current, total) => {
        setSyncProgress({ current, total });
      });
      alert("Sync complete!");
    } catch (e: any) {
      alert("Error during sync: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveChecklist = async () => {
    setIsSubmittingTask(true);

    try {
      if (currentUid && selectedEvent) {
        if (selectedEvent.type === "PMS") {
          // Find matching area to automatically update the Facility Profile "Last Serviced"
          const areaQ = query(collection(db, `users/${currentUid}/areas`));
          const areaSnap = await getDocs(areaQ);
          
          const matchingAreaDoc = areaSnap.docs.find(d => {
            const areaData = d.data();
            if (areaData.name && selectedEvent.pumpStation?.toLowerCase().includes(areaData.name.toLowerCase())) return true;
            // also check if any sites match
            if (areaData.sites && areaData.sites.some((s: string) => selectedEvent.pumpStation?.toLowerCase().includes(s.toLowerCase()))) return true;
            return false;
          });

          if (matchingAreaDoc) {
            const areaRef = doc(db, `users/${currentUid}/areas`, matchingAreaDoc.id);
            const updates: Record<string, any> = {
              lastServiced: new Date().toISOString()
            };
            if (selectedEvent.wellCode) {
              updates[`lastServicedByFacility.${selectedEvent.wellCode}`] = new Date().toISOString();
            }
            await updateDoc(areaRef, updates);
          }

          // Persist the activity for dashboard and history
          await addDoc(collection(db, `users/${currentUid}/activities`), {
            userId: currentUid,
            type: 'genset_monitoring', // Approximate for PMS
            title: `PMS: ${selectedEvent.activity}`,
            area: matchingAreaDoc ? matchingAreaDoc.data().name : selectedEvent.pumpStation,
            siteOrWell: selectedEvent.wellCode || '',
            date: new Date().toISOString().split('T')[0],
            status: 'completed',
            details: { pmsActivity: selectedEvent.activity, pumpStation: selectedEvent.pumpStation },
            isSynced: !isLowDataMode,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          const pmsDocRef = doc(db, `users/${currentUid}/CalendarEvents`, selectedEvent.id);
          await updateDoc(pmsDocRef, {
            actualDate: new Date().toISOString(),
            status: 'completed',
            updatedAt: serverTimestamp()
          });
          
          showToast(
            isLowDataMode
              ? "Offline: Task completed. Saved in Sync Queue."
              : "PMS Task completed successfully! Auto-updated Facility Profile.",
            "success",
          );
        } else {
          // It's a SHIFT event, logic to mark complete if needed, or simply close
          showToast("Shift updated successfully.", "success");
        }
      }
      
    } catch (e) {
      console.error(e);
      showToast("Error saving event", "error");
    } finally {
      setIsSubmittingTask(false);
      setSelectedEvent(null);
    }
  };

  const daysInMonth = Array.from({ length: 30 }, (_, i) => i + 1); // Mock 30 days for June 2026

  const monthName = currentMonth.toLocaleString("default", { month: "long" });
  const year = currentMonth.getFullYear();

  const getTasksForDay = (day: number) => {
    return displayedEvents.filter(
      (t) =>
        t.startTime &&
        t.startTime.getDate() === day &&
        t.startTime.getMonth() === currentMonth.getMonth() &&
        t.startTime.getFullYear() === currentMonth.getFullYear(),
    );
  };

  const upcomingTasks = useMemo(() => {
    const today = new Date(2026, 5, 15); // Context date
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    return displayedEvents
      .filter((t) => {
        if (!t.startTime) return false;
        return t.startTime >= today && t.startTime <= nextWeek;
      })
      .sort((a, b) => a.startTime!.getTime() - b.startTime!.getTime());
  }, [displayedEvents]);

  // Monthly Progress Calculation
  const monthlyProgress = useMemo(() => {
    const monthTasks = events.filter(e => 
      e.type === "PMS" && 
      e.startTime && 
      e.startTime.getMonth() === currentMonth.getMonth() && 
      e.startTime.getFullYear() === currentMonth.getFullYear()
    );
    const total = monthTasks.length;
    const completed = monthTasks.filter(e => e.status === "completed").length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  }, [events, currentMonth]);

  return (
    <div className="max-w-5xl mx-auto px-margin-mobile pt-lg md:pt-xl mb-24 relative">
      {/* Header */}
      <section className="mb-lg flex flex-col md:flex-row md:items-end md:justify-between gap-md">
        <div className="flex-1">
          <h2 className="font-headline-lg text-headline-lg text-on-surface">
            Master Calendar
          </h2>
          <p className="text-on-surface-variant mt-1 mb-4">
            Preventive maintenance scheduling.
          </p>
          <div className="max-w-md">
            <div className="flex justify-between items-center text-sm font-medium mb-1">
              <span className="text-on-surface-variant">Monthly Progress</span>
              <span className="text-primary">{monthlyProgress.completed} / {monthlyProgress.total} ({monthlyProgress.percentage}%)</span>
            </div>
            <div className="w-full bg-surface-variant rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${monthlyProgress.percentage}%` }}
              ></div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center md:justify-end">
          <select
            value={taskFilter}
            onChange={(e) => setTaskFilter(e.target.value as any)}
            className="bg-surface border border-outline-variant text-on-surface text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 px-3"
          >
            <option value="ALL">All Tasks</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="OVERDUE">Overdue</option>
            <option value="COMPLETED">Completed</option>
          </select>

          {/* <div className="flex bg-surface-variant p-1 rounded-lg">
            <button
              onClick={() => setViewMode("ALL")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === "ALL" ? "bg-surface shadow-sm text-on-surface" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              All
            </button>
            <button
              onClick={() => setViewMode("PMS")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === "PMS" ? "bg-surface shadow-sm text-on-surface" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              PMS
            </button>
          </div> */}
          <button
            onClick={() => setIsImporting(true)}
            className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 rounded-lg transition-all shadow-sm text-sm font-medium flex items-center gap-2 ml-2"
          >
            <CloudUpload className="w-4 h-4" /> Import
          </button>
          <button
            onClick={async () => {
              if (window.confirm("Are you sure you want to delete all events?")) {
                if (currentUid) {
                  await clearAllCalendarEvents(currentUid);
                  setEvents([]);
                  showToast("All events deleted.", "success");
                }
              }
            }}
            className="bg-error/10 hover:bg-error/20 text-error border border-error/20 px-3 py-1.5 rounded-lg transition-all shadow-sm text-sm font-medium ml-2"
          >
            Clear Data
          </button>
          <button
            onClick={() => setShowNewScheduleModal(true)}
            className="bg-primary hover:bg-primary/90 text-on-primary px-3 py-1.5 rounded-lg transition-all shadow-sm text-sm font-medium"
          >
            + New Event
          </button>
        </div>
      </section>

      {activeView === "calendar" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          {/* Calendar Side */}
          <div className="lg:col-span-2 space-y-lg">
            {/* upcoming notifications logic */}
            {events.filter(e => e.type === "PMS" && e.status !== "completed" && e.startTime && (e.startTime.getTime() - Date.now()) > 0 && (e.startTime.getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000).length > 0 && (
              <div className="bg-warning-container/30 border border-warning/30 rounded-xl p-4 flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                <div>
                  <h4 className="font-semibold text-warning-on-container">Upcoming Maintenance</h4>
                  <p className="text-sm text-on-surface-variant">There are {events.filter(e => e.type === "PMS" && e.status !== "completed" && e.startTime && (e.startTime.getTime() - Date.now()) > 0 && (e.startTime.getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000).length} tasks due in the next 7 days.</p>
                </div>
              </div>
            )}
            
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
                <h3 className="font-headline-md font-semibold text-on-surface flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                  {monthName} {year}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentMonth(new Date(year, currentMonth.getMonth() - 1))
                  }
                  className="p-1 rounded hover:bg-surface-variant"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(2026, 5))}
                  className="px-3 py-1 text-label-sm font-semibold rounded hover:bg-surface-variant"
                >
                  Today
                </button>
                <button
                  onClick={() =>
                    setCurrentMonth(new Date(year, currentMonth.getMonth() + 1))
                  }
                  className="p-1 rounded hover:bg-surface-variant"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div
                      key={day}
                      className="text-label-sm font-semibold text-on-surface-variant"
                    >
                      {day}
                    </div>
                  ),
                )}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {/* Empty spaces for start of month (June starts on Mon) */}
                <div className="p-2 border border-transparent"></div>
                {daysInMonth.map((day) => {
                  const isToday = day === 15 && currentMonth.getMonth() === 5;
                  const dayTasks = getTasksForDay(day);
                  const hasTask = dayTasks.length > 0;
                  const isOverdue = dayTasks.some(
                    (t) =>
                      t.startTime && t.startTime < new Date(2026, 5, 15) && !t.actualDate,
                  );

                  return (
                    <div
                      key={day}
                      onClick={() => {
                        if (hasTask) setSelectedEvent(dayTasks[0]);
                      }}
                      className={`
                        aspect-square md:min-h-[80px] p-1 md:p-2 border rounded-lg flex flex-col items-center md:items-start cursor-pointer hover:bg-surface-container-low transition-colors relative
                        ${isToday ? "border-primary bg-primary/5" : "border-outline-variant/30"}
                      `}
                    >
                      <span
                        className={`text-body-md font-medium ${isToday ? "bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center" : "text-on-surface"}`}
                      >
                        {day}
                      </span>
                      {hasTask && (
                        <div className="mt-1 flex flex-col gap-1 w-full px-1">
                          {dayTasks.map((t) => (
                            <div
                              key={t.id}
                              title={t.title || t.activity}
                              className={`text-[10px] md:text-xs font-semibold truncate px-1 py-0.5 rounded ${t.actualDate ? "bg-success/20 text-success" : (t.startTime && t.startTime < new Date(2026, 5, 15)) ? "bg-error/20 text-error" : "bg-primary/10 text-primary"}`}
                            >
                              {t.title || t.activity}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming List */}
        <div className="lg:col-span-1 space-y-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-lg">
            <h3 className="font-headline-md font-semibold text-on-surface mb-4">
              Upcoming Due (7 Days)
            </h3>

            <div className="space-y-3">
              {upcomingTasks.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedEvent(item)}
                  className="p-3 bg-surface border border-outline-variant/50 rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-label-md text-on-surface truncate pr-2">
                      {item.title || item.activity || "Activity"}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant">
                      {item.startTime?.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-label-sm text-on-surface-variant line-clamp-1">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {item.location || item.pumpStation}{" "}
                      {item.remarks ? `- ${item.remarks}` : ""}
                    </span>
                  </div>
                </div>
              ))}
              {upcomingTasks.length === 0 && (
                <div className="text-label-md text-on-surface-variant italic py-4 text-center">
                  No tasks within 7 days.
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface-container-highest border border-outline-variant rounded-xl p-md flex items-center gap-4">
            <div className="p-3 bg-surface rounded-full">
              <CheckCircle2 className="w-6 h-6 text-[#10b981]" />
            </div>
            <div>
              <p className="font-label-md text-on-surface">Compliance Rate</p>
              <p className="font-display text-2xl text-on-surface">
                94<span className="text-body-md">%</span>
              </p>
            </div>
          </div>
        </div>
      </div>
      ) : (
        <div className="bg-surface rounded-2xl shadow-sm border border-outline-variant p-6">
           <h3 className="text-xl font-bold mb-4">Execution History</h3>
           <div className="mb-4 max-w-sm">
             <label className="text-sm font-medium text-on-surface-variant block mb-1">Filter by Facility</label>
             <select 
               value={historyFacilityFilter}
               onChange={(e) => setHistoryFacilityFilter(e.target.value)}
               className="w-full p-2.5 border border-outline-variant rounded-lg bg-surface text-on-surface focus:ring-2 focus:ring-primary focus:outline-none"
             >
               <option value="ALL">All Facilities</option>
               {Array.from(new Set(events.filter(e => e.type === "PMS").map(e => e.pumpStation))).filter(Boolean).map(ps => (
                 <option key={ps} value={ps}>{ps}</option>
               ))}
             </select>
           </div>
           <div className="space-y-4">
             {events.filter(e => e.type === "PMS" && e.status === "completed" && (historyFacilityFilter === "ALL" || e.pumpStation === historyFacilityFilter))
               .sort((a,b) => new Date(b.actualDate || b.startTime || 0).getTime() - new Date(a.actualDate || a.startTime || 0).getTime())
               .map(e => (
                 <div key={e.id} className="p-4 border border-outline-variant rounded-lg bg-surface-container-lowest">
                   <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                     <div>
                       <h4 className="font-semibold text-lg text-on-surface">{e.title || e.activity}</h4>
                       <p className="text-sm text-on-surface-variant">{e.pumpStation}</p>
                     </div>
                     <span className="text-sm bg-success/20 text-success px-3 py-1.5 rounded-md font-medium whitespace-nowrap self-start sm:self-center flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Completed on {new Date(e.actualDate || e.startTime || "").toLocaleDateString()}
                     </span>
                   </div>
                 </div>
               ))}
             {events.filter(e => e.type === "PMS" && e.status === "completed" && (historyFacilityFilter === "ALL" || e.pumpStation === historyFacilityFilter)).length === 0 && (
               <div className="text-center py-12 text-on-surface-variant bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant">
                 No completed tasks found.
               </div>
             )}
           </div>
        </div>
      )}

      {/* Pop-up Checklist Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-surface w-[95%] sm:w-[90%] max-w-[896px] min-w-[280px] rounded-xl shadow-xl border border-outline-variant overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-surface-container-low border-b border-outline-variant flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-headline-md text-on-surface">
                  {selectedEvent.title || selectedEvent.activity || "Event"}
                </h3>
                <p className="text-label-sm text-on-surface-variant flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" />{" "}
                  {selectedEvent.location || selectedEvent.pumpStation} &bull;{" "}
                  {selectedEvent.startTime?.toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-2 bg-surface hover:bg-surface-variant rounded-full transition-colors border border-outline-variant"
              >
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>

            <div className="p-lg overflow-y-auto space-y-md flex-1">
              <div className="bg-surface-container p-md rounded-lg border border-outline-variant flex justify-between items-center">
                <span className="font-label-md text-on-surface-variant">
                  Scheduled Date
                </span>
                <span className="font-label-md text-on-surface bg-surface-variant px-2 py-1 rounded">
                  {selectedEvent.startTime?.toLocaleDateString()}
                </span>
              </div>

              <h4 className="font-label-md uppercase text-outline tracking-wider mt-lg mb-sm">
                Requirements
              </h4>

              {selectedEvent.type === "PMS" && selectedEvent.activity?.toLowerCase().includes("flushing") ? (
                <div className="space-y-sm">
                  <p className="text-body-md text-on-surface-variant mb-4">
                    Flushing requires Initial and Final photos from an attached
                    Field Activity.
                  </p>
                  {selectedEvent.linkedActivity?.blowOffs?.length > 0 ? (
                    selectedEvent.linkedActivity.blowOffs.map((bo: any) => (
                      <div
                        key={bo.id}
                        className="p-4 border border-outline-variant rounded-lg bg-surface-container-lowest"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-label-md text-on-surface border-b border-dashed border-outline-variant pb-1 w-full max-w-xs">
                            {bo.name}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <span className="block text-label-sm font-semibold text-on-surface-variant mb-2">
                              Initial Water Photo
                            </span>
                            <div className="aspect-[4/3] bg-surface-container-low rounded-lg border border-outline-variant flex items-center justify-center overflow-hidden">
                              {bo.initialPhoto ? (
                                <img
                                  src={bo.initialPhoto}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-label-sm text-outline-variant">
                                  No Photo
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="block text-label-sm font-semibold text-on-surface-variant mb-2">
                              Final Water Photo
                            </span>
                            <div className="aspect-[4/3] bg-surface-container-low rounded-lg border border-outline-variant flex items-center justify-center overflow-hidden">
                              {bo.finalPhoto ? (
                                <img
                                  src={bo.finalPhoto}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-label-sm text-outline-variant">
                                  No Photo
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-error/10 text-error rounded-lg flex gap-2 items-center text-sm font-medium">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                      No attached Field Activity photos found. Please complete
                      the Flushing Field Activity via the Field App to fulfill
                      this schedule.
                    </div>
                  )}
                </div>
              ) : selectedEvent.type === "PMS" && selectedEvent.activity?.toLowerCase().includes("tank") ? (
                <div className="space-y-sm">
                  <p className="text-body-md text-on-surface-variant mb-4">
                    Tank Cleaning requires 3 milestone photos from an attached
                    Field Activity.
                  </p>
                  {selectedEvent.linkedActivity ? (
                    <div className="p-4 border border-outline-variant rounded-lg bg-surface-container-lowest">
                      <p className="text-sm font-medium mb-2 opacity-70">
                        Activity logged on{" "}
                        {new Date(
                          selectedEvent.linkedActivity.date,
                        ).toLocaleDateString()}
                      </p>
                      <p className="text-body-md mb-2">
                        Photos stored in Field Activity Module.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-error/10 text-error rounded-lg flex gap-2 items-center text-sm font-medium">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                      No attached Field Activity photos found. Please complete
                      the Tank Cleaning Field Activity via the Field App.
                    </div>
                  )}

                  <div className="flex flex-col gap-xs mt-4 opacity-50 pointer-events-none">
                    <label className="font-label-md text-label-md text-on-surface-variant text-primary border-l-2 border-primary pl-2">
                      Cleaning Chemical Used (Liters)
                    </label>
                    <input
                      type="number"
                      placeholder="Logged via Field Activity"
                      className="rounded bg-surface-variant text-on-surface focus:outline-none focus:border-transparent border border-outline-variant p-3 font-body-md"
                      disabled
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-sm">
                  {/* Normal Checklist Form */}
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-on-surface-variant text-primary border-l-2 border-primary pl-2">
                      Current Fill Level (%)
                    </label>
                    <input
                      type="number"
                      placeholder="Enter current percentage"
                      className="rounded bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent border border-outline-variant p-3 font-body-md"
                    />
                  </div>

                  <div className="flex flex-col gap-xs mt-4">
                    <label className="font-label-md text-label-md text-on-surface-variant text-primary border-l-2 border-primary pl-2">
                      Remarks
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Any structural integrity issues or notes?"
                      className="rounded bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent border border-outline-variant p-3 font-body-md"
                    ></textarea>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-outline-variant bg-surface-container-low flex justify-end gap-3">
              {selectedEvent.type === "PMS" && (
                <button
                  onClick={() => {
                     const pmsData = {
                       area: selectedEvent.pumpStation,
                       activityType: selectedEvent.activity?.toLowerCase().includes("flushing") ? "flushing" :
                                     selectedEvent.activity?.toLowerCase().includes("tank") ? "tank_cleaning" :
                                     "genset_monitoring",
                       pmsId: selectedEvent.id
                     };
                     localStorage.setItem("pendingPMSActivity", JSON.stringify(pmsData));
                     setSelectedEvent(null);
                     if (setActiveTab) setActiveTab("activity");
                  }}
                  disabled={isSubmittingTask}
                  className="btn-secondary bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 mr-auto"
                >
                  Start Task
                </button>
              )}
              <button
                onClick={() => setSelectedEvent(null)}
                disabled={isSubmittingTask}
                className="btn-secondary bg-surface text-on-surface hover:bg-surface-variant border border-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChecklist}
                disabled={isSubmittingTask}
                className="btn-primary"
              >
                {isSubmittingTask ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                )}
                {isSubmittingTask ? "Saving..." : "Save Checklist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Schedule Modal */}
      {showNewScheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-[448px] rounded-2xl shadow-lg flex flex-col">
            <div className="p-5 border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-headline-sm font-semibold">New Event</h3>
              <button
                onClick={() => setShowNewScheduleModal(false)}
                className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {/* <div className="flex bg-surface-variant p-1 rounded-lg">
                <button
                  onClick={() => setNewScheduleForm({ ...newScheduleForm, type: "PMS" })}
                  className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${newScheduleForm.type === "PMS" ? "bg-surface shadow-sm text-on-surface" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  PMS
                </button>
              </div> */}

              {newScheduleForm.type === "PMS" && (
                <>
                  <div>
                    <label className="text-label-md font-semibold block mb-1">
                      Pump Station / Location
                    </label>
                    <input
                      type="text"
                      value={newScheduleForm.pumpStation}
                      onChange={(e) =>
                        setNewScheduleForm({
                          ...newScheduleForm,
                          pumpStation: e.target.value,
                          wellCode: "", // Reset equipment when station changes
                        })
                      }
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                      placeholder="E.g. Pavia Plant"
                      list="pms-stations"
                    />
                    <datalist id="pms-stations">
                      {facilitiesList.map(f => <option key={f} value={f} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-label-md font-semibold block mb-1">
                      Equipment / Well Code
                    </label>
                    <input
                      type="text"
                      value={newScheduleForm.wellCode}
                      onChange={(e) =>
                        setNewScheduleForm({
                          ...newScheduleForm,
                          wellCode: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                      placeholder="E.g. Clarifier Sub-Tank A"
                      list="pms-equipments"
                    />
                    <datalist id="pms-equipments">
                      {(facilityEquipment[newScheduleForm.pumpStation] || []).map(e => <option key={e} value={e} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-label-md font-semibold block mb-1">
                      Activity
                    </label>
                    <input
                      type="text"
                      value={newScheduleForm.activity}
                      onChange={(e) =>
                        setNewScheduleForm({
                          ...newScheduleForm,
                          activity: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                      placeholder="E.g. Full Preventive Check"
                    />
                  </div>
                </>
              )}
              
              <div>
                <label className="text-label-md font-semibold block mb-1">
                  Schedule Date
                </label>
                <input
                  type="date"
                  value={newScheduleForm.startTime}
                  onChange={(e) =>
                    setNewScheduleForm({
                      ...newScheduleForm,
                      startTime: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-outline-variant bg-surface-container-low flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowNewScheduleModal(false)}
                className="btn-secondary bg-surface text-on-surface hover:bg-surface-variant border border-outline"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (
                    !newScheduleForm.startTime
                  )
                    return;
                  const [y, m, d] = newScheduleForm.startTime.split("-");
                  if (!currentUid) return;

                  const newId = `custom-${Date.now()}`;
                  const taskObj: any = {
                    type: newScheduleForm.type,
                    title: newScheduleForm.type === "SHIFT" ? newScheduleForm.title : `PMS: ${newScheduleForm.activity}`,
                    location: newScheduleForm.pumpStation,
                    startTime: new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString(),
                    endTime: new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString(),
                    assignedTo: newScheduleForm.assignedTo || null,
                  };

                  if (newScheduleForm.type === "PMS") {
                    taskObj.pumpStation = newScheduleForm.pumpStation;
                    taskObj.wellCode = newScheduleForm.wellCode;
                    taskObj.activity = newScheduleForm.activity;
                    taskObj.remarks = "";
                    taskObj.actualDate = null;
                  }

                  try {
                    await setDoc(doc(collection(db, `users/${currentUid}/CalendarEvents`), newId), taskObj);
                    
                    const newTask: CalendarEvent = {
                      id: newId,
                      ...taskObj,
                      startTime: new Date(taskObj.startTime),
                      endTime: new Date(taskObj.endTime),
                      actualDate: null
                    };

                    setEvents([...events, newTask]);
                    
                    setNewScheduleForm({
                      type: "PMS",
                      title: "",
                      pumpStation: "",
                      wellCode: "",
                      activity: "",
                      startTime: "",
                      endTime: "",
                      assignedTo: "",
                    });
                    setShowNewScheduleModal(false);
                    showToast("New event added successfully", "success");
                  } catch (e) {
                    showToast("Failed to add event", "error");
                  }
                }}
                className="btn-primary px-4 py-2"
              >
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Schedule Modal */}
      {isImporting && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface w-[90vw] sm:w-[512px] max-w-[512px] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 flex justify-between items-center border-b border-outline-variant bg-surface-container-low">
              <h3 className="font-headline-sm flex items-center gap-2 text-on-surface">
                <CloudUpload className="w-5 h-5 text-primary" /> Import Preventive Maintenance
              </h3>
              <button
                onClick={() => setIsImporting(false)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-6 h-6 text-on-surface-variant" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <p className="text-body-md text-on-surface-variant mb-6">
                Upload a CSV file to bulk import Preventive Maintenance into the Master Calendar.
              </p>

              <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold mb-2 text-on-surface">
                  Required CSV Format:
                </h4>
                <div className="font-mono text-xs text-on-surface bg-surface-container-lowest p-2 rounded border border-outline-variant overflow-x-auto whitespace-nowrap">
                  PumpStation,Activity,Date (YYYY-MM-DD)
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-8">
                <button
                  onClick={() => {
                    const csvContent =
                      "PumpStation,Activity,Date (YYYY-MM-DD)\nPS-1,Flushing,2026-06-15\n";
                    const blob = new Blob([csvContent], {
                      type: "text/csv;charset=utf-8;",
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", "Preventive_Maintenance_Template.csv");
                    link.style.visibility = "hidden";
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showToast("Template downloaded", "success");
                  }}
                  className="flex justify-center items-center gap-2 py-2 px-4 border border-outline-variant rounded-lg text-primary hover:bg-surface-container font-label-md transition-colors bg-surface"
                >
                  Download Template
                </button>
                <label className="flex justify-center items-center gap-2 py-2 px-4 bg-primary text-white hover:bg-primary/90 cursor-pointer rounded-lg font-label-md transition-colors shadow-sm">
                  Select CSV File to Upload
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const file = e.target.files[0];
                        Papa.parse(file, {
                          header: true,
                          skipEmptyLines: true,
                          complete: async (results) => {
                            if (!currentUid) return;
                            try {
                              const batch = writeBatch(db);
                              const newEvents: CalendarEvent[] = [];
                              results.data.forEach((row: any) => {
                                if (row.PumpStation && row.Date) {
                                  const newId = `pms-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                                  const [y, m, d] = row.Date.split("-");
                                  
                                  const sDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString();
                                  
                                  const taskObj: any = {
                                    type: "PMS",
                                    title: `PMS: ${row.Activity || ""}`,
                                    pumpStation: row.PumpStation,
                                    activity: row.Activity || "",
                                    startTime: sDate,
                                    endTime: sDate,
                                    assignedTo: null,
                                  };
                                  
                                  batch.set(doc(collection(db, `users/${currentUid}/CalendarEvents`), newId), taskObj);
                                  
                                  newEvents.push({
                                    id: newId,
                                    ...taskObj,
                                    startTime: new Date(sDate),
                                    endTime: new Date(sDate),
                                  });
                                }
                              });
                              
                              await batch.commit();
                              setEvents(prev => [...prev, ...newEvents]);
                              
                              showToast(
                                `Successfully imported ${newEvents.length} shifts.`,
                                "success",
                              );
                              setIsImporting(false);
                            } catch (err) {
                              console.error(err);
                              showToast("Error importing shifts.", "error");
                            }
                          }
                        });
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
