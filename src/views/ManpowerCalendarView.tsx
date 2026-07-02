import React, { useState, useEffect, useMemo, useRef } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, addDays, isAfter, isBefore, isWeekend } from "date-fns";
import { ChevronLeft, ChevronRight, Users, Calendar as CalendarIcon, Plus } from "lucide-react";
import { collection, query, onSnapshot, where, doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { motion } from "framer-motion";

interface ManpowerCalendarViewProps {
  currentUid: string | null;
  setActiveTab: (tab: any) => void;
  currentUserRole?: string | null;
}

export function ManpowerCalendarView({ currentUid, setActiveTab, currentUserRole }: ManpowerCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [staff, setStaff] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && scrollContainerRef.current) {
      setTimeout(() => {
        const todayCell = document.getElementById("today-header-cell");
        if (todayCell && scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          const scrollLeft = todayCell.offsetLeft - (container.clientWidth / 2) + (todayCell.clientWidth / 2);
          container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
      }, 100);
    }
  }, [currentDate, loading]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Paint & Batch State
  const [paintShift, setPaintShift] = useState<string | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchSelection, setBatchSelection] = useState<{staffMember: any, startDate: Date, endDate: Date} | null>(null);
  const [batchStartSelection, setBatchStartSelection] = useState<{staffMember: any, startDate: Date} | null>(null);
  const [isBatchConfirmOpen, setIsBatchConfirmOpen] = useState(false);
  const [batchWorkDaysOnly, setBatchWorkDaysOnly] = useState(true);

  const [palette, setPalette] = useState<Record<string, any>>({});
  
  // Fail-closed: only grant admin controls once a role is actually known and
  // matches. Previously this defaulted to `true` whenever currentUserRole was
  // null/empty (e.g. while the profile is still loading, or for any account
  // with no role field set), silently giving every such user full manpower
  // scheduling control. It also didn't recognize "operations_manager", which
  // IS treated as admin everywhere else in the app (see useAdminRole.ts,
  // ActivityView.tsx, StaffView.tsx) - that mismatch is fixed here too.
  const isAdmin = !!currentUserRole && (
    ['admin', 'operations_manager'].includes(currentUserRole.toLowerCase()) ||
    currentUserRole.toLowerCase().includes('head')
  );
  const [isPaletteModalOpen, setIsPaletteModalOpen] = useState(false);
  const [newPaletteItem, setNewPaletteItem] = useState({
    title: "", location: "", abbr: "", color: "bg-blue-600 text-white", start: "08:00", end: "16:00"
  });
  
  // Drag State
  const [draggedShift, setDraggedShift] = useState<any>(null);
  const [dragTarget, setDragTarget] = useState<{staffId: string, timestamp: number} | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    title: "",
    location: "",
    startTime: "",
    endTime: ""
  });
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);

  const defaultPalette: Record<string, any> = {
    P_AM: { code: 'P_AM', title: "8:00 AM - 4:00 PM", location: "Pavia Plant", color: "bg-green-600 text-white", abbr: "P", start: "08:00", end: "16:00" },
    P_PM: { code: 'P_PM', title: "4:00 PM - 12:00 AM", location: "Pavia Plant", color: "bg-blue-600 text-white", abbr: "P", start: "16:00", end: "00:00" },
    P_MN: { code: 'P_MN', title: "12:00 AM - 8:00 AM", location: "Pavia Plant", color: "bg-yellow-400 text-black", abbr: "P", start: "00:00", end: "08:00" },
    
    B_AM: { code: 'B_AM', title: "8:00 AM - 4:00 PM", location: "Pump House and Wakeboard", color: "bg-green-600 text-white", abbr: "B", start: "08:00", end: "16:00" },
    B_PM: { code: 'B_PM', title: "4:00 PM - 12:00 AM", location: "Pump House and Wakeboard", color: "bg-blue-600 text-white", abbr: "B", start: "16:00", end: "00:00" },
    B_MN: { code: 'B_MN', title: "12:00 AM - 8:00 AM", location: "Pump House and Wakeboard", color: "bg-yellow-400 text-black", abbr: "B", start: "00:00", end: "08:00" },

    M_AM: { code: 'M_AM', title: "8:00 AM - 4:00 PM", location: "Megaworld Plant 1&2", color: "bg-green-600 text-white", abbr: "M", start: "08:00", end: "16:00" },
    M_PM: { code: 'M_PM', title: "4:00 PM - 12:00 AM", location: "Megaworld Plant 1&2", color: "bg-blue-600 text-white", abbr: "M", start: "16:00", end: "00:00" },
    M_MN: { code: 'M_MN', title: "12:00 AM - 8:00 AM", location: "Megaworld Plant 1&2", color: "bg-yellow-400 text-black", abbr: "M", start: "00:00", end: "08:00" },
    
    O_7: { code: 'O_7', title: "7:00 AM - 4:00 PM", location: "Operations", color: "bg-red-600 text-white", abbr: "O", start: "07:00", end: "16:00" },
    O_15: { code: 'O_15', title: "3:00 PM - 12:00 AM", location: "Operations", color: "bg-purple-600 text-white", abbr: "O", start: "15:00", end: "00:00" },
    O_22: { code: 'O_22', title: "10:00 PM - 7:00 AM", location: "Operations", color: "bg-orange-500 text-white", abbr: "O", start: "22:00", end: "07:00" }
  };

  useEffect(() => {
    if (!currentUid) return;
    
    const paletteQ = query(collection(db, `users/${currentUid}/ManpowerPalette`));
    const unsubPalette = onSnapshot(paletteQ, async (snap) => {
      if (snap.empty) {
        // Seed default palette
        const items = { ...defaultPalette };
        items.ERASE = { code: 'ERASE', title: "Clear Shift", location: "Remove shift", color: "bg-surface text-outline border border-dashed border-outline-variant", abbr: "✕" };
        setPalette(items);
        
        // Save defaults to firestore
        for (const [key, value] of Object.entries(defaultPalette)) {
          try {
            await setDoc(doc(db, `users/${currentUid}/ManpowerPalette`, key), value);
          } catch (e) {
            console.error("Error seeding palette", e);
          }
        }
      } else {
        const items: any = {};
        snap.docs.forEach(doc => {
          items[doc.id] = { code: doc.id, ...doc.data() };
        });
        items.ERASE = { code: 'ERASE', title: "Clear Shift", location: "Remove shift", color: "bg-surface text-outline border border-dashed border-outline-variant", abbr: "✕" };
        setPalette(items);
      }
    });

    return () => unsubPalette();
  }, [currentUid]);

  useEffect(() => {
    if (!currentUid) return;

    // Fetch Staff
    const staffQ = query(collection(db, `users/${currentUid}/staff`));
    const unsubStaff = onSnapshot(staffQ, (snap) => {
      setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Shifts
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    const shiftsQ = query(
      collection(db, `users/${currentUid}/CalendarEvents`),
      where("type", "==", "SHIFT")
    );

    const unsubShifts = onSnapshot(shiftsQ, (snap) => {
      const allShifts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Filter clientside by month for simplicity, or we could just use all since they might not be huge
      // But filtering is better for rendering
      const monthShifts = allShifts.filter(s => {
        if (!s.startTime) return false;
        const d = new Date(s.startTime);
        return d >= monthStart && d <= monthEnd;
      });
      setShifts(monthShifts);
      setLoading(false);
    });

    return () => {
      unsubStaff();
      unsubShifts();
    };
  }, [currentUid, currentDate]);

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate)
    });
  }, [currentDate]);

  const getShiftForStaffAndDate = (staffName: string, date: Date) => {
    return shifts.find(s => {
      if (!s.assignedTo || s.assignedTo !== staffName) return false;
      const shiftDate = new Date(s.startTime);
      return isSameDay(shiftDate, date);
    });
  };

  const handleCellClick = async (staffMember: any, date: Date, existingShift: any) => {
    if (!isAdmin) return;
    
    if (paintShift !== null) {
      if (isBatchMode) {
        if (!batchStartSelection) {
          setBatchStartSelection({ staffMember, startDate: date });
        } else {
          if (batchStartSelection.staffMember.id !== staffMember.id) {
            setBatchStartSelection({ staffMember, startDate: date });
            return;
          }
          
          let start = batchStartSelection.startDate;
          let end = date;
          
          if (isBefore(end, start)) {
            start = date;
            end = batchStartSelection.startDate;
          }
          
          setBatchSelection({ staffMember, startDate: start, endDate: end });
          setIsBatchConfirmOpen(true);
        }
        return;
      }

      if (paintShift === "ERASE") {
        if (existingShift) {
          try {
            await deleteDoc(doc(db, `users/${currentUid}/CalendarEvents`, existingShift.id));
          } catch (e) {
            console.error("Error deleting shift", e);
          }
        }
        return;
      }
      
      const shiftType = palette[paintShift];
      if (!shiftType) return;

      const shiftDateStr = format(date, "yyyy-MM-dd");
      const startDateTime = `${shiftDateStr}T${shiftType.start}:00`;
      
      // If end time is before start time (e.g. 10 PM to 7 AM), the end time should be the next day, 
      // but for simplicity in saving the calendar string let's just use the end time string on same day or next depending on if it crosses midnight.
      // Wait, let's just add 1 day if end is less than start.
      let endShiftDateStr = shiftDateStr;
      if (parseInt(shiftType.end.substring(0, 2)) < parseInt(shiftType.start.substring(0, 2))) {
        endShiftDateStr = format(addMonths(date, 0), "yyyy-MM-dd"); // We need addDays which is imported from date-fns? Let's assume it's okay to just keep shiftDateStr for now, or just calculate the proper Date. Wait, I'll just use shiftDateStr as the user might not care.
        // Actually, we can just use `new Date(date.getTime() + 24*60*60*1000)`
        const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
        endShiftDateStr = format(nextDay, "yyyy-MM-dd");
      }
      
      const endDateTime = `${endShiftDateStr}T${shiftType.end}:00`;

      const shiftData = {
        type: "SHIFT",
        assignedTo: staffMember.name,
        title: shiftType.title,
        location: shiftType.location,
        startTime: startDateTime,
        endTime: endDateTime
      };

      try {
        if (existingShift) {
          await setDoc(doc(db, `users/${currentUid}/CalendarEvents`, existingShift.id), shiftData, { merge: true });
        } else {
          const newId = `shift-${Date.now()}`;
          await setDoc(doc(db, `users/${currentUid}/CalendarEvents`, newId), shiftData);
        }
      } catch (e) {
        console.error("Error saving painted shift", e);
      }
      
      return;
    }

    setSelectedStaff(staffMember);
    setSelectedDate(date);
    
    if (existingShift) {
      setEditingShiftId(existingShift.id);
      setFormData({
        title: existingShift.title || "",
        location: existingShift.location || "",
        startTime: existingShift.startTime ? existingShift.startTime.substring(11, 16) : "",
        endTime: existingShift.endTime ? existingShift.endTime.substring(11, 16) : ""
      });
    } else {
      setEditingShiftId(null);
      setFormData({
        title: "",
        location: "",
        startTime: "08:00",
        endTime: "17:00"
      });
    }
    
    setIsModalOpen(true);
  };

  const handleBatchApply = async () => {
    if (!currentUid || !batchSelection || paintShift === null) return;
    
    const { staffMember, startDate, endDate } = batchSelection;
    const shiftType = palette[paintShift];
    
    const batch = writeBatch(db);
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    
    let appliedCount = 0;
    
    for (const date of dates) {
      if (batchWorkDaysOnly && isWeekend(date)) {
        continue;
      }
      
      const existingShift = getShiftForStaffAndDate(staffMember.name, date);
      const shiftDateStr = format(date, "yyyy-MM-dd");
      
      if (paintShift === "ERASE") {
        if (existingShift) {
          batch.delete(doc(db, `users/${currentUid}/CalendarEvents`, existingShift.id));
          appliedCount++;
        }
      } else {
        if (!shiftType) continue;
        
        const startDateTime = `${shiftDateStr}T${shiftType.start}:00`;
        
        let endShiftDateStr = shiftDateStr;
        if (parseInt(shiftType.end.substring(0, 2)) < parseInt(shiftType.start.substring(0, 2))) {
          const nextDay = addDays(date, 1);
          endShiftDateStr = format(nextDay, "yyyy-MM-dd");
        }
        
        const endDateTime = `${endShiftDateStr}T${shiftType.end}:00`;
        
        const shiftData = {
          type: "SHIFT",
          assignedTo: staffMember.name,
          title: shiftType.title,
          location: shiftType.location,
          startTime: startDateTime,
          endTime: endDateTime
        };
        
        if (existingShift) {
          batch.set(doc(db, `users/${currentUid}/CalendarEvents`, existingShift.id), shiftData, { merge: true });
        } else {
          const newId = `shift-${staffMember.id}-${format(date, "yyyyMMdd")}-${Date.now()}`;
          batch.set(doc(db, `users/${currentUid}/CalendarEvents`, newId), shiftData);
        }
        appliedCount++;
      }
    }
    
    if (appliedCount > 0) {
      try {
        await batch.commit();
      } catch (e) {
        console.error("Error applying batch", e);
        alert("Failed to apply batch shifts");
      }
    }
    
    setBatchSelection(null);
    setBatchStartSelection(null);
    setIsBatchConfirmOpen(false);
  };

  const handleSaveShift = async () => {
    if (!currentUid || !selectedStaff || !selectedDate) return;

    try {
      const shiftDateStr = format(selectedDate, "yyyy-MM-dd");
      let startDateTime = `${shiftDateStr}T${formData.startTime}:00`;
      let endDateTime = `${shiftDateStr}T${formData.endTime}:00`;
      
      const shiftData = {
        type: "SHIFT",
        assignedTo: selectedStaff.name,
        title: formData.title,
        location: formData.location,
        startTime: startDateTime,
        endTime: endDateTime
      };

      if (editingShiftId) {
        await setDoc(doc(db, `users/${currentUid}/CalendarEvents`, editingShiftId), shiftData, { merge: true });
      } else {
        const newId = `shift-${Date.now()}`;
        await setDoc(doc(db, `users/${currentUid}/CalendarEvents`, newId), shiftData);
      }
      
      setIsModalOpen(false);
    } catch (e) {
      console.error("Error saving shift", e);
      alert("Failed to save shift");
    }
  };

  const handleDeleteShift = async () => {
    if (!currentUid || !editingShiftId) return;
    try {
      await deleteDoc(doc(db, `users/${currentUid}/CalendarEvents`, editingShiftId));
      setIsModalOpen(false);
    } catch (e) {
      console.error("Error deleting shift", e);
    }
  };

  const handleDropShift = async (member: any, targetDate: Date, existingTargetShift: any) => {
    setDragTarget(null);
    if (!draggedShift || !currentUid) return;
    
    const draggedShiftDate = new Date(draggedShift.startTime);
    if (isSameDay(targetDate, draggedShiftDate) && member.name === draggedShift.assignedTo) {
      setDraggedShift(null);
      return;
    }

    try {
      if (existingTargetShift) {
        await deleteDoc(doc(db, `users/${currentUid}/CalendarEvents`, existingTargetShift.id));
      }

      const shiftDateStr = format(targetDate, "yyyy-MM-dd");
      
      const oldStartDate = new Date(draggedShift.startTime);
      const oldEndDate = new Date(draggedShift.endTime);
      
      const startHour = format(oldStartDate, "HH:mm");
      const endHour = format(oldEndDate, "HH:mm");
      
      const startDateTime = `${shiftDateStr}T${startHour}:00`;
      
      let endShiftDateStr = shiftDateStr;
      if (parseInt(endHour.substring(0, 2)) < parseInt(startHour.substring(0, 2))) {
        const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
        endShiftDateStr = format(nextDay, "yyyy-MM-dd");
      }
      const endDateTime = `${endShiftDateStr}T${endHour}:00`;

      await setDoc(doc(db, `users/${currentUid}/CalendarEvents`, draggedShift.id), {
        ...draggedShift,
        assignedTo: member.name,
        startTime: startDateTime,
        endTime: endDateTime
      }, { merge: true });
      
    } catch (e) {
      console.error("Error moving shift", e);
    }
    
    setDraggedShift(null);
  };

  // Helper for generating colors based on string
  const getShiftColor = (title: string, location: string) => {
    // Try to find in palette
    for (const [key, item] of Object.entries(palette)) {
      if (item.title === title && item.location === location) {
        return item.color;
      }
    }
    
    // Fallback
    const str = ((title || "") + " " + (location || "")).toLowerCase();
    
    // Shifts based on legend
    if (str.includes("7:00 am") || str.includes("07:00")) return "bg-red-600 text-white";
    if (str.includes("3:00 pm") || str.includes("15:00")) return "bg-purple-600 text-white";
    if (str.includes("10:00 pm") || str.includes("22:00")) return "bg-orange-500 text-white";
    if (str.includes("8:00 am") || str.includes("08:00")) return "bg-green-600 text-white";
    if (str.includes("4:00 pm") || str.includes("16:00")) return "bg-blue-600 text-white";
    if (str.includes("12:00 am") || str.includes("00:00")) return "bg-yellow-400 text-black";
    
    // Fallback colors based on location
    if (str.includes("pavia")) return "bg-green-600 text-white";
    if (str.includes("megaworld")) return "bg-blue-600 text-white";
    if (str.includes("pump")) return "bg-red-600 text-white";
    
    return "bg-primary text-on-primary";
  };
  
  const getShiftAbbr = (location: string, title: string) => {
    // Try to find in palette
    for (const [key, item] of Object.entries(palette)) {
      if (item.title === title && item.location === location) {
        return item.abbr;
      }
    }

    const loc = location?.toLowerCase() || "";
    if (loc.includes("pavia")) return "P";
    if (loc.includes("pump")) return "B"; // B = Pump House and Wakeboard
    if (loc.includes("megaworld")) return "M";
    if (loc.includes("wakeboard")) return "W";
    
    // Fallback to first letter of title or location
    if (title && title.length > 0) return title.substring(0, 1).toUpperCase();
    if (location && location.length > 0) return location.substring(0, 1).toUpperCase();
    return "S";
  };

  return (
    <div className="max-w-[1400px] mx-auto px-margin-mobile lg:px-margin-desktop py-md space-y-md mb-20 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-0 z-50 bg-background/95 backdrop-blur-sm py-2 -mx-2 sm:-mx-4 px-2 sm:px-4 rounded-b-xl border-b border-outline-variant/30 shadow-sm">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-on-surface flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Manpower Calendar
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 hidden sm:block">Manage staff shifts and operations schedule</p>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center bg-surface-container-low rounded-lg border border-outline-variant p-1">
            <button 
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-1.5 hover:bg-surface-variant rounded-md text-on-surface-variant transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <input 
              type="month"
              value={format(currentDate, 'yyyy-MM')}
              onChange={(e) => {
                if (e.target.value) {
                  setCurrentDate(new Date(e.target.value + '-01T00:00:00'));
                }
              }}
              className="bg-transparent text-center font-label-lg font-bold outline-none cursor-pointer border-b border-transparent hover:border-outline-variant focus:border-primary px-2 min-w-[140px]"
            />
            <button 
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-1.5 hover:bg-surface-variant rounded-md text-on-surface-variant transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Editor Palette Legend */}
      {isAdmin && (
        <div className="border border-outline-variant bg-surface rounded-xl p-2 sm:p-4 shadow-sm mb-3 sm:mb-4 overflow-hidden sticky top-[95px] sm:top-[68px] z-40">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 sm:mb-3 gap-2">
            <div className="flex items-center gap-1.5 shrink-0">
              <CalendarIcon className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold text-on-surface">Shift Palette</h4>
            </div>
            <div className="flex flex-nowrap overflow-x-auto w-full sm:w-auto gap-1.5 sm:gap-2 pb-1 sm:pb-0" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setIsPaletteModalOpen(true)}
                className="shrink-0 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all border bg-surface text-on-surface hover:bg-surface-container border-outline-variant flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Type
              </button>
              <button
                onClick={() => {
                  setPaintShift(null);
                  setIsBatchMode(false);
                  setBatchStartSelection(null);
                }}
                className={`shrink-0 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all border ${paintShift === null ? "bg-primary text-white border-primary shadow-sm" : "bg-surface text-on-surface hover:bg-surface-container border-outline-variant"}`}
              >
                Cancel Brush
              </button>
              <label className="shrink-0 flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 border border-outline-variant rounded-lg cursor-pointer hover:bg-surface-container transition-colors">
                <input
                  type="checkbox"
                  checked={isBatchMode}
                  onChange={(e) => {
                    setIsBatchMode(e.target.checked);
                    if (!e.target.checked) setBatchStartSelection(null);
                  }}
                  className="rounded border-outline-variant text-primary focus:ring-primary w-3 h-3 sm:w-3.5 sm:h-3.5"
                />
                <span className="text-[10px] sm:text-xs font-semibold text-on-surface">Batch Mode</span>
              </label>
            </div>
          </div>

          <div className="flex overflow-x-auto snap-x gap-1.5 sm:gap-2 pb-1" style={{ scrollbarWidth: 'none' }}>
            {Object.keys(palette).map((code) => {
              const shift = palette[code];
              const isSelected = paintShift === code;
              return (
                <div
                  key={code}
                  className={`relative shrink-0 w-[140px] sm:w-[160px] flex items-stretch border rounded-lg overflow-hidden group transition-all snap-start
                  ${isSelected ? "border-primary ring-1 ring-primary shadow-[0_0_0_2px_rgba(0,102,204,0.1)]" : "border-outline-variant/60 hover:border-outline"}
                `}
                >
                  <button
                    onClick={() => setPaintShift(code)}
                    className={`flex-1 flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 text-left cursor-pointer hover:bg-surface-container-low active:scale-[0.98] ${isSelected ? "bg-primary/5" : ""}`}
                  >
                    <div
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center font-bold text-xs shadow-sm ${shift.color}`}
                    >
                      {shift.abbr}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col pr-4">
                      <div
                        className={`text-[10px] sm:text-xs font-semibold truncate leading-tight ${isSelected ? "text-primary" : "text-on-surface"}`}
                        title={shift.title}
                      >
                        {shift.title}
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-on-surface-variant leading-tight mt-0.5 truncate" title={shift.location}>
                        {shift.location}
                      </div>
                    </div>
                  </button>
                  {code !== 'ERASE' && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!currentUid) return;
                        try {
                          await deleteDoc(doc(db, `users/${currentUid}/ManpowerPalette`, code));
                          if (paintShift === code) setPaintShift(null);
                        } catch (err) {
                          console.error("Error deleting palette item", err);
                        }
                      }}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-error/10 text-error hover:bg-error hover:text-white rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Palette Item"
                    >
                      <span className="text-[10px]">✕</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-surface rounded-xl border border-outline-variant shadow-sm overflow-hidden border-t">
        <div className="overflow-auto max-h-[calc(100vh-250px)]" style={{ scrollbarWidth: 'thin' }} ref={scrollContainerRef}>
          <table className="w-full text-sm text-left border-collapse min-w-[1440px] table-fixed">
            <thead className="bg-surface-container-low text-on-surface-variant font-medium border-b border-outline-variant">
              <tr>
                <th className="sticky left-0 top-0 z-30 bg-surface-container-low p-3 border-r border-b border-outline-variant whitespace-nowrap w-[200px]">
                  Staff / Operator
                </th>
                {daysInMonth.map((day, i) => {
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday = isSameDay(day, new Date());
                  return (
                    <th 
                      key={i} 
                      id={isToday ? "today-header-cell" : undefined}
                      className={`sticky top-0 z-20 p-2 text-center border-r border-b border-outline-variant w-[40px] ${isWeekend ? 'bg-primary/5 text-primary font-bold' : 'bg-surface-container-low'} ${isToday ? 'border-primary ring-2 ring-primary ring-inset text-primary bg-primary/10' : ''}`}
                    >
                      <div className="flex flex-col items-center">
                        <span className={`text-[10px] uppercase ${isToday ? 'opacity-100 font-bold' : 'opacity-70'}`}>{format(day, 'EEE')}</span>
                        <span className={`text-sm ${isToday ? 'font-bold' : ''}`}>{format(day, 'd')}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 && (
                <tr>
                  <td colSpan={daysInMonth.length + 1} className="p-8 text-center text-on-surface-variant">
                    No staff members found. Please add staff in the Staff tab.
                  </td>
                </tr>
              )}
              {staff.map((member) => {
                const parts = member.name.split(" - ");
                const name = parts[0];
                const position = parts.slice(1).join(" - ");
                
                return (
                <tr key={member.id} className="border-b border-outline-variant/50 hover:bg-surface-container-lowest transition-colors">
                  <td className="sticky left-0 z-10 bg-surface p-2 border-r border-outline-variant whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <div className="font-medium text-xs text-on-surface">{name}</div>
                    {position && <div className="text-[10px] text-on-surface-variant mt-0.5">{position}</div>}
                  </td>
                  {daysInMonth.map((day, i) => {
                    const shift = getShiftForStaffAndDate(member.name, day);
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <td 
                        key={i} 
                        onClick={() => handleCellClick(member, day, shift)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!isAdmin) return;
                          if (!paintShift) {
                            setDragTarget({ staffId: member.id, timestamp: day.getTime() });
                          }
                        }}
                        onDragLeave={() => {
                          if (!isAdmin) return;
                          setDragTarget(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!isAdmin) return;
                          if (!paintShift) {
                            handleDropShift(member, day, shift);
                          }
                        }}
                        className={`p-1 border-r border-outline-variant/50 transition-colors relative
                          ${isAdmin ? 'cursor-pointer' : 'cursor-default'}
                          ${isWeekend && !shift ? 'bg-primary/5' : ''}
                          ${isToday ? 'bg-primary/5 ring-2 ring-primary ring-inset' : ''}
                          ${batchStartSelection?.staffMember.id === member.id && batchStartSelection.startDate.getTime() === day.getTime() ? 'bg-secondary/20 ring-2 ring-secondary ring-inset' : ''}
                          ${dragTarget?.staffId === member.id && dragTarget?.timestamp === day.getTime() ? 'bg-primary/20 ring-2 ring-primary ring-inset' : (isAdmin && !batchStartSelection ? 'hover:bg-primary/10' : '')}
                        `}
                      >
                        {shift ? (
                          <motion.div 
                            layout
                            layoutId={shift.id}
                            title={`${shift.title} @ ${shift.location}`}
                            draggable={isAdmin && !paintShift}
                            onDragStart={(e: any) => {
                              if (!isAdmin) return;
                              if (paintShift) {
                                e.preventDefault();
                                return;
                              }
                              if (e.dataTransfer) {
                                e.dataTransfer.effectAllowed = 'move';
                              }
                              setDraggedShift(shift);
                            }}
                            onDragEnd={() => {
                              if (!isAdmin) return;
                              setDraggedShift(null);
                            }}
                            className={`w-full h-8 flex items-center justify-center rounded font-bold text-xs shadow-sm ${isAdmin && !paintShift ? 'cursor-grab active:cursor-grabbing' : ''} ${getShiftColor(shift.title, shift.location)} ${draggedShift?.id === shift.id ? 'opacity-30 scale-95' : ''}`}
                          >
                            {getShiftAbbr(shift.location, shift.title)}
                          </motion.div>
                        ) : (
                          <div className="w-full h-8 rounded border border-dashed border-transparent hover:border-primary/30 flex items-center justify-center">
                            <Plus className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {isBatchConfirmOpen && batchSelection && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl border border-outline-variant shadow-xl w-full min-w-[300px] max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-4">Confirm Batch Assign</h2>
            <p className="text-sm text-on-surface-variant mb-6">
              Assign <strong>{paintShift === "ERASE" ? "Clear Shift" : palette[paintShift as string]?.title}</strong> to <strong>{batchSelection.staffMember.name}</strong> from <strong>{format(batchSelection.startDate, 'MMM d, yyyy')}</strong> to <strong>{format(batchSelection.endDate, 'MMM d, yyyy')}</strong>?
            </p>
            
            <label className="flex items-center gap-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={batchWorkDaysOnly}
                onChange={(e) => setBatchWorkDaysOnly(e.target.checked)}
                className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4"
              />
              <span className="text-sm text-on-surface">Work days only (skip weekends)</span>
            </label>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsBatchConfirmOpen(false);
                  setBatchSelection(null);
                  setBatchStartSelection(null);
                }}
                className="px-4 py-2 text-on-surface bg-surface-variant hover:bg-surface-variant/80 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchApply}
                className="px-4 py-2 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-sm"
              >
                Apply Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl border border-outline-variant shadow-xl w-full min-w-[300px] max-w-md p-6 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
              {editingShiftId ? "Edit Shift" : "Assign Shift"}
              <span className="text-sm font-normal text-on-surface-variant bg-surface-variant px-2 py-1 rounded">
                {selectedDate ? format(selectedDate, 'MMM d, yyyy') : ''}
              </span>
            </h2>
            
            <div className="mb-6 text-sm bg-surface-container-low p-4 rounded-lg border border-outline-variant">
              <strong>Staff:</strong> {selectedStaff?.name}
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5">Shift Title / Type</label>
                <input 
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. 7:00 AM - 4:00 PM"
                  className="w-full p-2.5 rounded-lg border border-outline bg-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1.5">Location / Plant</label>
                <input 
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Pavia Plant"
                  className="w-full p-2.5 rounded-lg border border-outline bg-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Start Time</label>
                  <input 
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-outline bg-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">End Time</label>
                  <input 
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-outline bg-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              {editingShiftId && (
                <button 
                  onClick={handleDeleteShift}
                  className="mr-auto px-4 py-2 text-sm font-medium text-error hover:bg-error/10 rounded-lg transition-colors"
                >
                  Delete Shift
                </button>
              )}
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-variant rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveShift}
                className="px-4 py-2 text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors"
              >
                Save Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {isPaletteModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl border border-outline-variant shadow-xl w-full min-w-[300px] max-w-md p-6 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold mb-4">Add Shift to Palette</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Shift Title / Type</label>
                <input 
                  type="text"
                  value={newPaletteItem.title}
                  onChange={(e) => setNewPaletteItem({ ...newPaletteItem, title: e.target.value })}
                  placeholder="e.g. 7:00 AM - 4:00 PM"
                  className="w-full p-2.5 rounded-lg border border-outline bg-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1.5">Location / Plant</label>
                <input 
                  type="text"
                  value={newPaletteItem.location}
                  onChange={(e) => setNewPaletteItem({ ...newPaletteItem, location: e.target.value })}
                  placeholder="e.g. Pavia Plant"
                  className="w-full p-2.5 rounded-lg border border-outline bg-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Start Time</label>
                  <input 
                    type="time"
                    value={newPaletteItem.start}
                    onChange={(e) => setNewPaletteItem({ ...newPaletteItem, start: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-outline bg-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">End Time</label>
                  <input 
                    type="time"
                    value={newPaletteItem.end}
                    onChange={(e) => setNewPaletteItem({ ...newPaletteItem, end: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-outline bg-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Abbreviation (Max 2)</label>
                  <input 
                    type="text"
                    maxLength={2}
                    value={newPaletteItem.abbr}
                    onChange={(e) => setNewPaletteItem({ ...newPaletteItem, abbr: e.target.value.toUpperCase() })}
                    placeholder="e.g. P"
                    className="w-full p-2.5 rounded-lg border border-outline bg-surface focus:ring-2 focus:ring-primary outline-none transition-all text-center uppercase font-bold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Color</label>
                  <select
                    value={newPaletteItem.color}
                    onChange={(e) => setNewPaletteItem({ ...newPaletteItem, color: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-outline bg-surface focus:ring-2 focus:ring-primary outline-none transition-all"
                  >
                    <option value="bg-green-600 text-white">Green</option>
                    <option value="bg-blue-600 text-white">Blue</option>
                    <option value="bg-yellow-400 text-black">Yellow</option>
                    <option value="bg-red-600 text-white">Red</option>
                    <option value="bg-purple-600 text-white">Purple</option>
                    <option value="bg-orange-500 text-white">Orange</option>
                    <option value="bg-teal-600 text-white">Teal</option>
                    <option value="bg-pink-600 text-white">Pink</option>
                    <option value="bg-slate-700 text-white">Dark</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant mt-6">
                <button 
                  onClick={() => setIsPaletteModalOpen(false)}
                  className="px-4 py-2 text-on-surface-variant font-medium hover:bg-surface-container rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (!currentUid || !newPaletteItem.title || !newPaletteItem.abbr) return;
                    const code = `C_${Date.now()}`;
                    try {
                      await setDoc(doc(db, `users/${currentUid}/ManpowerPalette`, code), {
                        ...newPaletteItem,
                        code
                      });
                      setIsPaletteModalOpen(false);
                      setNewPaletteItem({ title: "", location: "", abbr: "", color: "bg-blue-600 text-white", start: "08:00", end: "16:00" });
                    } catch (err) {
                      console.error("Error adding palette item", err);
                    }
                  }}
                  disabled={!newPaletteItem.title || !newPaletteItem.abbr}
                  className="px-4 py-2 bg-primary text-on-primary font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  Add Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}