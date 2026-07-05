import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  Play,
  MapPin,
  Info,
  Camera,
  Clock,
  ClipboardX,
  ClipboardCheck,
  ChevronDown,
  CheckCircle2,
  TrendingUp,
  Timer,
  Plus,
  User,
  X,
  Loader2,
  Zap,
  Mic,
  MicOff,
  RefreshCw,
  ShieldAlert,
  Edit2,
  Trash2,
} from "lucide-react";
import { useNetworkInfo } from "../utils/useNetworkInfo";
import { useProximityAlert } from "../utils/useProximityAlert";
import { useToast } from "../utils/ToastContext";
import { db } from "../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  updateDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  where,
  orderBy,
  limit,
  deleteDoc,
} from "firebase/firestore";
import { defaultStaff as dataStoreDefaultStaff } from "../lib/dataStore";
import { ACTIVITY_TYPES } from "../lib/activityTypes";
import { useAdminRole } from "../hooks/useAdminRole";
import { haptics } from "../utils/haptics";

import { useNavigation } from "../contexts/NavigationContext";
import { useSyncQueue } from "../utils/useSyncQueue";
import { PrintableTaskHistory, PrintableTaskHistoryData } from "../components/PrintableTaskHistory";
import { PrintableMeterTest } from "../components/PrintableMeterTest";
import { compressImage } from "../utils/imageProcessor";
import { get } from "idb-keyval";

export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "pending" | "in-progress" | "completed";

export interface Task {
  id: string;
  title: string;
  priority: TaskPriority;
  location: string; // Legacy combined location
  facility?: string;
  site?: string;
  blockLot?: string;
  deadline: string;
  estimatedHours?: number;
  completedAt?: string; // To track efficiency
  updatedAt?: string;
  createdAt?: string; // To track TAT
  tatJustification?: string;
  description: string;
  assignedTo: string;
  status: TaskStatus;
  isSynced?: boolean;
  linkedActivity?: string;
  joNumber?: string;
  updatedBy?: string;
  accountNumber?: string;
  accountName?: string;
}

// Sourced from shared lib/activityTypes.ts
const activityTypes = ACTIVITY_TYPES;

const defaultTasks: Task[] = [];

interface TasksViewProps {
  setActiveTab?: any;
  onSwitchToAdhoc?: (activityType?: string, taskContext?: Task) => void;
  currentUser?: string | null;
  currentUid?: string | null;
  globalSearchQuery?: string;
}

export function TasksView({ currentUser, currentUid, setActiveTab, onSwitchToAdhoc, globalSearchQuery = "" }: TasksViewProps) {
  const { activeJobId, setActiveJobId } = useNavigation();
  const isAdmin = useAdminRole(currentUid);

  const [openTaskId, setOpenTaskId] = useState<string | null>(activeJobId);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLimit, setTaskLimit] = useState(50);
  const [hasMoreTasks, setHasMoreTasks] = useState(true);
  const [staffList, setStaffList] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(activeJobId || globalSearchQuery);

  useEffect(() => {
    if (activeJobId) {
      setSearchQuery(activeJobId);
      setOpenTaskId(activeJobId);
    } else {
      setSearchQuery(globalSearchQuery);
    }
  }, [activeJobId, globalSearchQuery]);

  const { syncData, isSyncing, enqueueAction } = useSyncQueue(currentUid);
  const [isPulling, setIsPulling] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [printPreviewData, setPrintPreviewData] = useState<PrintableTaskHistoryData | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const startY = useRef(0);
  const currentY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      startY.current = e.touches[0].clientY;
      currentY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    if (diff > 0) {
      setPullY(Math.min(diff, 80));
    } else {
      setPullY(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    if (pullY > 50) {
      if (syncData) {
        haptics.medium();
        await syncData();
        showToast("Sync check complete", "success");
      }
    }
    setIsPulling(false);
    setPullY(0);
  };

  useEffect(() => {
    setSearchQuery(globalSearchQuery);
  }, [globalSearchQuery]);
  const { showToast } = useToast();

  const handlePrintTask = async (task: Task) => {
    if (!currentUid) return;
    
    let match: any = null;
    
    try {
      // Fetch ALL activities in case 'type' is not exactly 'meter_test' or something
      const q1 = query(
        collection(db, `users/${currentUid}/activities`)
      );
      
      const snapshot = await getDocs(q1);
      let activities = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      // Filter for meter_test locally just to be sure
      activities = activities.filter(a => a.type === 'meter_test');
      
      activities.sort((a, b) => {
          const t1 = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.date || 0).getTime();
          const t2 = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.date || 0).getTime();
          return t2 - t1;
      });

      match = activities.find(a => 
        (a.taskId && a.taskId === task.id) ||
        (task.accountNumber && a.details?.accountNumber && String(a.details.accountNumber).includes(String(task.accountNumber))) ||
        (task.accountName && a.details?.testAccountName && String(a.details.testAccountName).toLowerCase().includes(String(task.accountName).toLowerCase()))
      );

      // Fallback: If no strict match, check if there's any meter test on the same day for this user
      if (!match && activities.length > 0) {
        match = activities[0];
      }
    } catch (error) {
      console.warn("Failed fetching activities from firestore. Continuing to offline check.", error);
    }

    // If still not found, check local offline queue (watsanActivities)
    if (!match) {
      try {
        const localActs = await get("watsanActivities") || [];
        const localMeterTests = localActs.filter((a: any) => a.type === 'meter_test');
        match = localMeterTests.find((a: any) => 
          (a.taskId && a.taskId === task.id) ||
          (task.accountNumber && a.details?.accountNumber && String(a.details.accountNumber).includes(String(task.accountNumber))) ||
          (task.accountName && a.details?.testAccountName && String(a.details.testAccountName).toLowerCase().includes(String(task.accountName).toLowerCase()))
        );
      } catch (e) {
        console.warn("Failed reading from local IDB", e);
      }
    }

    // If still no match (e.g. no activity was ever created, or network failed), generate a fallback so they can print a blank form for field use
    if (!match) {
      match = {
        date: task.completedAt || task.createdAt || new Date().toISOString(),
        siteOrWell: task.location || task.facility || task.site || "",
        area: task.facility || "",
        blockLot: task.blockLot || "",
        details: {
          testAccountName: task.accountName || "",
          accountNumber: task.accountNumber || "",
        },
        staff: task.assignedTo ? [task.assignedTo] : []
      };
    }

    setPrintPreviewData({ task, activity: match });
  };
  const { isLowDataMode } = useNetworkInfo();

  useProximityAlert(tasks);

  const getHistoricalEstimate = (title: string, location: string): number | null => {
    const lowercaseTitle = title.toLowerCase();
    const lowercaseLocation = location.toLowerCase();
    
    if (lowercaseTitle.includes("leak repair") || lowercaseTitle.includes("leak")) {
      if (lowercaseLocation.includes("pr2")) return 2.5;
      return 3.0;
    }
    if (lowercaseTitle.includes("meter replacement") || lowercaseTitle.includes("meter swap") || lowercaseTitle.includes("meter")) {
      return 1.5;
    }
    if (lowercaseTitle.includes("inspection") || lowercaseTitle.includes("inspect")) {
      return 1.0;
    }
    if (lowercaseTitle.includes("chlorination")) {
      return 4.0;
    }
    return null;
  };

  const handleTaskFieldChange = (field: keyof Task | 'joNumber' | 'accountNumber' | 'accountName' | 'linkedActivity', value: string) => {
    const updatedTask = { ...newTask, [field]: value };
    
    // Auto-predict completion time when title or location changes
    if (field === 'title' || field === 'location') {
      const estimate = getHistoricalEstimate(updatedTask.title || "", updatedTask.location || "");
      if (estimate) {
        const current = new Date();
        current.setMinutes(current.getMinutes() + estimate * 60);
        const tzOffset = current.getTimezoneOffset() * 60000;
        const localISOTime = new Date(current.getTime() - tzOffset).toISOString().slice(0, 16);
        updatedTask.deadline = localISOTime;
        updatedTask.estimatedHours = estimate;
      } else {
        // We only overwrite if they haven't explicitly set it, or simply leave it
      }
    }
    
    setNewTask(updatedTask);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localTab, setLocalTab] = useState<'active' | 'history'>('active');
  const [isSubmittingTask, setIsSubmittingTask] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: "",
    priority: "medium",
    location: "",
    deadline: "",
    description: "",
    assignedTo: "Unassigned",
    status: "pending",
    linkedActivity: "",
    joNumber: "",
    accountNumber: "",
    accountName: "",
  });

  // Autofill accountName from Customer Database
  useEffect(() => {
    if (newTask.accountNumber && newTask.accountNumber.length >= 6 && currentUid) {
      const timer = setTimeout(async () => {
        try {
          const docRef = doc(db, `users/${currentUid}/customers`, newTask.accountNumber as string);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data.accountName && !newTask.accountName) {
              setNewTask(prev => ({ ...prev, accountName: data.accountName }));
            }
          }
        } catch (e) {
          console.warn(e);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [newTask.accountNumber, currentUid]);

  // Modal state
  useEffect(() => {
    if (!newTask.joNumber || !currentUid) {
      setJoValidationMessage(null);
      return;
    }
    const checkJo = async () => {
      setIsCheckingJo(true);
      try {
        const q = query(collection(db, `users/${currentUid}/tasks`), where("joNumber", "==", newTask.joNumber), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setJoValidationMessage("Job Order ID already exists");
        } else {
          setJoValidationMessage(null);
        }
      } catch (err) {
        console.error("Error checking JO:", err);
      } finally {
        setIsCheckingJo(false);
      }
    };
    const timer = setTimeout(checkJo, 500);
    return () => clearTimeout(timer);
  }, [newTask.joNumber, currentUid]);

  const handleOpenNewTask = () => {
    setEditingTaskId(null);
    setNewTask({
      title: "",
      priority: "medium",
      location: "",
      deadline: "",
      estimatedHours: undefined,
      description: "",
      assignedTo: "Unassigned",
      status: "pending",
      linkedActivity: "",
      joNumber: "",
      accountNumber: "",
      accountName: "",
    });
    setIsModalOpen(true);
  };

  useEffect(() => {
    (window as any).tasksViewMounted = true;
    window.addEventListener("open-new-task", handleOpenNewTask);
    return () => {
      (window as any).tasksViewMounted = false;
      window.removeEventListener("open-new-task", handleOpenNewTask);
    };
  }, []);

  const [taskPhotos, setTaskPhotos] = useState<Record<string, string>>({});
  const [taskParts, setTaskParts] = useState<
    Record<string, { itemId: string; quantity: number }[]>
  >({});
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [taskLinkedAsset, setTaskLinkedAsset] = useState<Record<string, string>>({});
  const [joValidationMessage, setJoValidationMessage] = useState<string | null>(null);
  const [isCheckingJo, setIsCheckingJo] = useState(false);
  const [isRecording, setIsRecording] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUid) return;
    const q = query(collection(db, `users/${currentUid}/inventory`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setInventoryItems(fetched);
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error("Inventory listener error:", error);
    });
    return () => unsubscribe();
  }, [currentUid]);

  useEffect(() => {
    if (!currentUid) return;

    const q = query(
      collection(db, `users/${currentUid}/tasks`),
      orderBy("createdAt", "desc"),
      limit(taskLimit)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // If collection is initially empty, seed with defaultTasks
      if (snapshot.empty && taskLimit === 50) {
        defaultTasks.forEach(async (dt) => {
          const taskDocRef = doc(db, `users/${currentUid}/tasks`, dt.id);
          try {
            await setDoc(taskDocRef, {
              userId: currentUid,
              type: "task",
              date: new Date().toISOString(),
              area: dt.location,
              title: dt.title,
              priority: dt.priority,
              location: dt.location,
              deadline: dt.deadline,
              description: dt.description,
              assignedTo: dt.assignedTo,
              status: dt.status,
              isSynced: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (e) {
            console.error("Failed to seed default task:", e);
          }
        });
      } else {
        const fetchedTasks = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.title,
            priority: data.priority,
            location: data.location,
            deadline: data.deadline,
            estimatedHours: data.estimatedHours,
            completedAt: data.completedAt,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            tatJustification: data.tatJustification,
            description: data.description,
            assignedTo: data.assignedTo,
            status: data.status,
            isSynced: true,
            linkedActivity: data.linkedActivity,
            joNumber: data.joNumber,
            accountNumber: data.accountNumber,
            accountName: data.accountName,
            facility: data.facility,
            site: data.site,
            blockLot: data.blockLot,
          } as Task;
        });
        setTasks(fetchedTasks);
        setHasMoreTasks(snapshot.docs.length === taskLimit);
      }
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error("Tasks listener error:", error);
    });

    return () => unsubscribe();
  }, [currentUid, taskLimit]);

  useEffect(() => {
    const storedStaff = localStorage.getItem("watsanStaff");
    if (storedStaff) {
      let parsed = JSON.parse(storedStaff);
      if (parsed.includes("John Santos")) {
        parsed = parsed.filter((name: string) => name !== "John Santos");
        localStorage.setItem("watsanStaff", JSON.stringify(parsed));
      }
      setStaffList(parsed);
    } else {
      setStaffList(dataStoreDefaultStaff);
      localStorage.setItem(
        "watsanStaff",
        JSON.stringify(dataStoreDefaultStaff),
      );
    }
  }, []);

  const toggleDetail = (id: string) => {
    const nextId = openTaskId === id ? null : id;
    setOpenTaskId(nextId);
    if (activeJobId && !nextId) {
      setActiveJobId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!currentUid) return;
    if (confirm("Are you sure you want to delete this task?")) {
      try {
        if (navigator.onLine) {
          await deleteDoc(doc(db, `users/${currentUid}/tasks`, taskId));
          showToast("Task deleted successfully", "success");
        } else {
          showToast("Cannot delete task while offline", "error");
        }
      } catch (e) {
        console.error(e);
        showToast("Error deleting task", "error");
      }
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.location || !currentUid) {
      alert("Title and Area/Location are required.");
      return;
    }

    const taskId = editingTaskId || `task-${Date.now()}`;
    const taskDocRef = doc(db, `users/${currentUid}/tasks`, taskId);

    const taskPayload = {
      userId: currentUid,
      type: "task",
      date: new Date().toISOString(),
      area: newTask.location,
      title: newTask.title,
      priority: newTask.priority,
      location: newTask.location,
      deadline: newTask.deadline || "No deadline",
      estimatedHours: newTask.estimatedHours || null,
      description: newTask.description || "",
      assignedTo: newTask.assignedTo || "Unassigned",
      status: newTask.status || "pending",
      linkedActivity: newTask.linkedActivity || "",
      joNumber: newTask.joNumber || "",
      accountNumber: newTask.accountNumber || "",
      accountName: newTask.accountName || "",
      isSynced: navigator.onLine,
    };

    try {
      if (navigator.onLine) {
        await setDoc(taskDocRef, {
           ...taskPayload,
           ...(editingTaskId ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
        }, { merge: true });
        showToast(editingTaskId ? "Task updated successfully" : "Task created successfully", "success");
      } else {
        await enqueueAction("watsanTasks", { id: taskId, ...taskPayload, isSynced: false, createdAt: new Date().toISOString() });
        showToast(editingTaskId ? "Offline: Task update queued" : "Offline: Task queued for synchronization", "warning");
      }
      setIsModalOpen(false);
      setEditingTaskId(null);
      setNewTask({
        title: "",
        priority: "medium",
        location: "",
        deadline: "",
        estimatedHours: undefined,
        description: "",
        assignedTo: "Unassigned",
        status: "pending",
        linkedActivity: "",
        joNumber: "",
        accountNumber: "",
        accountName: "",
      });
    } catch (err) {
      console.error(err);
      showToast(editingTaskId ? "Error updating task" : "Error creating task", "error");
    }
  };

  const handlePhotoUpload = async (
    taskId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedFile = await compressImage(file, isLowDataMode);
      const reader = new FileReader();
      reader.onload = (event) => {
        setTaskPhotos((prev) => ({ ...prev, [taskId]: event.target?.result as string }));
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error("Error compressing image:", error);
      showToast("Error processing image", "error");
    }
  };

  const handleAddPart = (taskId: string, itemId: string, quantity: number) => {
    setTaskParts((prev) => {
      const parts = prev[taskId] || [];
      const existing = parts.find((p) => p.itemId === itemId);
      if (existing) {
        return {
          ...prev,
          [taskId]: parts
            .map((p) => (p.itemId === itemId ? { ...p, quantity } : p))
            .filter((p) => p.quantity > 0),
        };
      }
      if (quantity > 0) {
        return { ...prev, [taskId]: [...parts, { itemId, quantity }] };
      }
      return prev;
    });
  };

  const toggleVoiceRecord = (taskId: string) => {
    if (isRecording === taskId && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(null);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Speech recognition is not supported in this browser.", "error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(taskId);
      showToast("Listening...", "info");
    };

    const baseNotes = taskNotes[taskId] ? taskNotes[taskId] + (taskNotes[taskId].endsWith(' ') ? '' : ' ') : "";
    let localFinal = baseNotes;

    recognition.onresult = (event: any) => {
      let interim = "";
      let newFinal = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          newFinal += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      localFinal += newFinal;
      setTaskNotes(prev => ({ ...prev, [taskId]: localFinal + interim }));
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(null);
      showToast("Microphone error or permission denied.", "error");
    };

    recognition.onend = () => {
      setIsRecording(null);
    };

    recognition.start();
  };

  const updateTaskStatus = (id: string, newStatus: TaskStatus) => {
    if (!currentUid) return;
    
    let justification = "";
    if (newStatus === "completed") {
      const task = tasks.find((t) => t.id === id);
      if (task) {
        const title = (task.title + " " + (task.linkedActivity || "").replace(/_/g, " ")).toLowerCase();
        
        if (title.includes("leak repair") && !taskLinkedAsset[id]) {
          showToast("You must link a specific asset (from inventory) to complete a Leak Repair task.", "error");
          return;
        }

        if (task.createdAt) {
          const createdDate = new Date(task.createdAt);
          const now = new Date();
          const diffMs = now.getTime() - createdDate.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          const diffDays = diffHours / 24;

          let needsJustification = false;
          let limitStr = "";
          
          if (title.includes("meter test") && diffDays > 7) {
            needsJustification = true;
            limitStr = "7 days";
          } else if (title.includes("new meter connection") && diffDays > 3) {
            needsJustification = true;
            limitStr = "3 days";
          } else if (title.includes("leak repair") && diffHours > 24) {
            needsJustification = true;
            limitStr = "24 hours";
          } else if (title.includes("meter replacement") && diffDays > 3) {
            needsJustification = true;
            limitStr = "3 days";
          }

          if (needsJustification) {
            justification = prompt(`Turn Around Time (TAT) exceeded! The limit for this task is ${limitStr}. Please provide a justification for the delay:`) || "";
            if (!justification.trim()) {
               showToast("Justification is required for overdue TAT.", "error");
               return;
            }
          }
        }
      }
      setIsSubmittingTask(id);
    }

    (async () => {
      try {
        const taskRef = doc(db, `users/${currentUid}/tasks`, id);
        const updates: any = {
          status: newStatus,
          isSynced: navigator.onLine,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser || "Unknown User"
        };

        if (newStatus === "completed") {
          updates.completedAt = new Date().toISOString();
          if (justification) updates.tatJustification = justification;
          if (taskPhotos[id]) updates.photoUrl = taskPhotos[id];
          if (taskNotes[id]) updates.notes = taskNotes[id];
          if (taskLinkedAsset[id]) updates.linkedAssetId = taskLinkedAsset[id];
          if (taskParts[id] && taskParts[id].length > 0) {
            updates.consumedParts = taskParts[id];

            // Deduct from inventory
            for (const part of taskParts[id]) {
              const matchedItem = inventoryItems.find(
                (i) => i.id === part.itemId,
              );
              if (matchedItem) {
                const invRef = doc(
                  db,
                  `users/${currentUid}/inventory`,
                  matchedItem.id,
                );
                updateDoc(invRef, {
                  currentStock: Math.max(
                    0,
                    matchedItem.currentStock - part.quantity,
                  ),
                  updatedAt: serverTimestamp(),
                }).catch(console.warn);
              }
            }
          }
        }

        updateDoc(taskRef, updates).catch(console.warn);

        if (newStatus === "completed") {
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
          }
          showToast(
            !navigator.onLine
              ? "Offline: Task completed. Queued for synchronization."
              : "Task completed and synced successfully!",
            "success",
          );
        }
      } catch (err) {
        console.error(err);
        showToast("Error updating task status", "error");
      } finally {
        if (newStatus === "completed") setIsSubmittingTask(null);
      }
    })();
  };

  const [visibleCount, setVisibleCount] = useState(20);

  const filteredTasks = tasks.filter((t) => {
    const statusMatch = localTab === 'active' ? t.status !== 'completed' : t.status === 'completed';
    const searchMatch = !searchQuery || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.assignedTo.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.location.toLowerCase().includes(searchQuery.toLowerCase());
    return statusMatch && searchMatch;
  });
  
  const highTasks = filteredTasks.filter((t) => t.priority === "high");
  const mediumTasks = filteredTasks.filter((t) => t.priority === "medium");
  const lowTasks = filteredTasks.filter((t) => t.priority === "low");

  const paginatedHigh = highTasks.slice(0, visibleCount);
  const paginatedMedium = mediumTasks.slice(0, Math.max(0, visibleCount - highTasks.length));
  const paginatedLow = lowTasks.slice(0, Math.max(0, visibleCount - highTasks.length - mediumTasks.length));

  const renderTask = (task: Task) => {
    const priorityColorClass =
      task.priority === "high"
        ? "bg-error text-error"
        : task.priority === "medium"
          ? "bg-tertiary-container text-tertiary"
          : "bg-secondary text-secondary";
    const indicatorColorClass =
      task.priority === "high"
        ? "bg-error"
        : task.priority === "medium"
          ? "bg-tertiary-container"
          : "bg-secondary";

    return (
      <div
        key={task.id}
        className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm hover:shadow-md transition-shadow"
      >
        <div
          className="flex flex-col md:flex-row md:items-center justify-between gap-md cursor-pointer"
          onClick={() => toggleDetail(task.id)}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-1 ${indicatorColorClass} rounded-full self-stretch min-h-[40px] opacity-80`}
            ></div>
            <div>
              <h4 className="font-headline-md text-on-surface">
                {task.linkedActivity && (
                  <span className="inline-flex mr-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary align-middle">
                    {activityTypes.find(a => a.id === task.linkedActivity)?.label || task.linkedActivity}
                  </span>
                )}
                {task.title}
              </h4>
              <div className="flex flex-wrap items-center gap-4 mt-1 text-on-surface-variant">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-body-md">{task.location}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-body-md">Due: {task.deadline}</span>
                </div>
                {task.assignedTo !== "Unassigned" && (
                  <div className="flex items-center gap-1 text-primary">
                    <User className="w-4 h-4" />
                    <span className="text-body-md font-semibold">
                      {task.assignedTo.split(", ").map(a => a.split(" - ")[0]).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-lg">
            <span
              className={`px-3 py-1 rounded-full text-label-md font-label-md uppercase 
              ${
                task.status === "completed"
                  ? "bg-surface-container-high text-on-surface-variant"
                  : task.status === "in-progress"
                    ? "bg-tertiary-container text-on-tertiary-container"
                    : "bg-error-container text-on-error-container"
              }
            `}
            >
              {task.status.replace("-", " ")}
            </span>
            <ChevronDown
              className={`text-outline transition-transform duration-200 ${openTaskId === task.id ? "rotate-180" : ""}`}
            />
          </div>
        </div>

        {/* Task Detail Drawer */}
        {openTaskId === task.id && (
          <div className="mt-4 pt-4 border-t border-outline-variant flex flex-col gap-4 relative">
            <div>
              {(task.joNumber || task.accountNumber || task.accountName) && (
                <div className="mb-4 bg-surface-variant/30 rounded-lg p-3 text-body-md border border-outline-variant/30">
                  <h5 className="font-semibold text-on-surface mb-2">Job Details</h5>
                  <div className="grid grid-cols-2 gap-2 text-on-surface-variant text-sm">
                    {task.joNumber && <div><span className="opacity-70">JO Number:</span><br/><span className="text-on-surface font-medium">{task.joNumber}</span></div>}
                    {task.accountNumber && <div><span className="opacity-70">Account:</span><br/><span className="text-on-surface font-medium">{task.accountNumber}</span></div>}
                    {task.accountName && <div className="col-span-2"><span className="opacity-70">Account Name:</span><br/><span className="text-on-surface font-medium">{task.accountName}</span></div>}
                  </div>
                </div>
              )}
              <p className="text-body-md text-on-surface mb-4">
                {task.description}
              </p>

              </div>
            <div>
              {task.status !== "completed" && (
                <div className="bg-surface-container rounded-lg p-4 flex flex-col items-center justify-center text-center">
                  <p className="text-body-md text-on-surface mb-4">
                    Tasks are now completed by logging a Field Activity (Ad-Hoc).
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSwitchToAdhoc) {
                        const activityType = task.linkedActivity || (task.title ? task.title.toLowerCase().replace(/[\s-]/g, '_') : undefined);
                        onSwitchToAdhoc(activityType, task);
                      } else if (setActiveTab) {
                        setActiveTab("activity");
                      }
                    }}
                    className="btn-primary"
                  >
                    Complete via Field Activity
                  </button>
                </div>
              )}

              {task.status === "completed" && (
                <div className="bg-surface-container rounded-lg p-4">
                  <p className="text-label-md text-on-surface-variant mb-2">
                    Status:
                  </p>
                  <p className="text-body-md text-on-surface">
                    Marked as completed.
                  </p>
                  
                  {(task.createdAt || task.completedAt) && (
                    <div className="mt-4 pt-4 border-t border-outline-variant text-sm">
                      <p className="text-on-surface-variant">
                        <span className="font-semibold text-on-surface">Created:</span> {task.createdAt ? new Date(task.createdAt).toLocaleString() : 'Unknown'}
                      </p>
                      <p className="text-on-surface-variant mt-1">
                        <span className="font-semibold text-on-surface">Completed:</span> {task.completedAt ? new Date(task.completedAt).toLocaleString() : (task.status === "completed" && task.updatedAt ? new Date(task.updatedAt).toLocaleString() : 'Unknown')}
                      </p>
                      {task.createdAt && (task.completedAt || task.updatedAt) && (
                        <p className="text-on-surface-variant mt-1">
                          <span className="font-semibold text-on-surface">Turn Around Time:</span> {
                            ((new Date(task.completedAt || task.updatedAt || task.createdAt).getTime() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(1)
                          } hours
                        </p>
                      )}
                    </div>
                  )}

                  {task.tatJustification && (
                    <div className="mt-4 bg-error-container/20 p-3 rounded-md border border-error/20">
                      <p className="text-sm font-semibold text-error mb-1">Overdue Justification</p>
                      <p className="text-sm text-on-surface italic">"{task.tatJustification}"</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-primary font-semibold">
                        <CheckCircle2 className="w-5 h-5" />
                        Done
                      </div>
                      {task.completedAt && (
                        <div className="text-xs text-on-surface-variant flex items-center gap-1.5 ml-7">
                          <Clock className="w-3.5 h-3.5" />
                          Completed by <span className="font-medium text-on-surface">{task.updatedBy || task.assignedTo || "User"}</span> at {
                            new Date(task.completedAt).toLocaleString(undefined, { 
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                            })
                          }
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrintTask(task);
                      }}
                      className="btn-primary text-xs px-3 py-1"
                    >
                      {(task.linkedActivity === 'meter_test' || (task.title && task.title.toLowerCase().includes('meter test'))) ? 'Print Meter Test Result' : 'Print Form'}
                    </button>
                  </div>
                </div>
              )}
              {isAdmin && (
                <div className="mt-4 flex gap-2 justify-end border-t border-outline-variant pt-4">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setEditingTaskId(task.id); 
                      setNewTask(task); 
                      setIsModalOpen(true); 
                    }}
                    className="btn-secondary text-xs px-3 py-1"
                  >
                    <Edit2 className="w-3 h-3 mr-1 inline-block" /> Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTask(task.id);
                    }}
                    className="btn-secondary text-xs px-3 py-1 text-error border-error/50 hover:bg-error-container"
                  >
                    <Trash2 className="w-3 h-3 mr-1 inline-block" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="max-w-5xl mx-auto px-margin-mobile pt-lg md:pt-xl mb-24 relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to Refresh Indicator */}
      {(pullY > 0 || isSyncing) && (
        <div 
          className="absolute top-0 left-0 right-0 flex justify-center items-center overflow-hidden z-50 transition-all duration-200"
          style={{ height: `${isSyncing ? 60 : pullY}px` }}
        >
          <div className={`p-2 rounded-full bg-surface shadow-md ${isSyncing ? 'animate-spin' : ''} border border-outline-variant`}>
            <RefreshCw className={`w-5 h-5 text-primary ${isSyncing ? '' : 'transition-transform'}`} style={{ transform: `rotate(${pullY * 2}deg)` }} />
          </div>
        </div>
      )}

      {/* Header Section */}
      <section className="mb-lg flex flex-col md:flex-row md:items-end md:justify-between gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">
            Operations Tasks
          </h2>
          <p className="text-on-surface-variant mt-1">
            Manage and report on technical maintenance operations.
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => {
                haptics.tap();
                handleOpenNewTask();
              }}
              className="btn-primary px-4 py-1.5 text-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Task
            </button>
          )}
          <div className="flex bg-surface-container rounded-lg p-1">
            <button 
              onClick={() => setLocalTab('active')}
              className={`px-4 py-1.5 rounded-md text-label-md font-label-md transition-colors ${localTab === 'active' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              Active
            </button>
            <button 
              onClick={() => setLocalTab('history')}
              className={`px-4 py-1.5 rounded-md text-label-md font-label-md transition-colors ${localTab === 'history' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              History
            </button>
          </div>
        </div>
      </section>

      {/* Priority Legend */}
      <div className="flex flex-wrap gap-4 mb-lg pb-4 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-error"></span>
          <span className="text-label-md font-label-md uppercase tracking-wider text-on-surface-variant">
            High Priority ({highTasks.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-tertiary-container"></span>
          <span className="text-label-md font-label-md uppercase tracking-wider text-on-surface-variant">
            Medium Priority ({mediumTasks.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-secondary"></span>
          <span className="text-label-md font-label-md uppercase tracking-wider text-on-surface-variant">
            Low Priority ({lowTasks.length})
          </span>
        </div>
      </div>

      {/* Task List Containers */}
      <div className="space-y-xl">
        {/* HIGH PRIORITY SECTION */}
        {highTasks.length > 0 && (
          <div>
            <h3 className="font-label-md text-label-md text-error flex items-center gap-2 mb-md text-sm font-semibold">
              <AlertTriangle className="w-[18px] h-[18px]" />
              HIGH PRIORITY ({highTasks.length})
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
              {paginatedHigh.map(renderTask)}
            </div>
          </div>
        )}

        {/* MEDIUM PRIORITY SECTION */}
        {mediumTasks.length > 0 && (
          <div>
            <h3
              className="font-label-md text-label-md text-tertiary-container text-opacity-80 flex items-center gap-2 mb-md text-sm font-semibold"
              style={{ color: "#d97706" }}
            >
              <ClipboardX className="w-[18px] h-[18px]" />
              MEDIUM PRIORITY ({mediumTasks.length})
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
              {paginatedMedium.map(renderTask)}
            </div>
          </div>
        )}

        {/* LOW PRIORITY SECTION */}
        {lowTasks.length > 0 && (
          <div>
            <h3 className="font-label-md text-label-md text-secondary flex items-center gap-2 mb-md text-sm font-semibold">
              <ClipboardCheck className="w-[18px] h-[18px]" />
              LOW PRIORITY ({lowTasks.length})
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
              {paginatedLow.map(renderTask)}
            </div>
          </div>
        )}

        {filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-24 bg-surface border border-outline-variant/50 rounded-2xl shadow-sm">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-on-surface mb-2">
              {localTab === 'active' ? 'Zero Pending Tasks' : 'No Task History'}
            </h3>
            <p className="text-on-surface-variant max-w-[384px] mb-6">
              {localTab === 'active' ? "You're all caught up! There are no operational tasks currently assigned to you or your area." : "No completed tasks yet."}
            </p>
            {isAdmin && localTab === 'active' && (
              <button
                onClick={() => {
                  haptics.tap();
                  handleOpenNewTask();
                }}
                className="btn-primary py-2 px-6"
              >
                Create New Task
              </button>
            )}
          </div>
        )}

        {(filteredTasks.length > visibleCount || (filteredTasks.length <= visibleCount && hasMoreTasks)) && (
          <div className="text-center pt-4">
            <button 
              onClick={() => {
                haptics.tap();
                if (filteredTasks.length > visibleCount) {
                  setVisibleCount(v => v + 20);
                }
                if (visibleCount + 20 >= filteredTasks.length && hasMoreTasks) {
                  setTaskLimit(limit => limit + 50);
                }
              }}
              className="px-6 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-full transition-colors text-sm font-semibold"
            >
              Load More
            </button>
          </div>
        )}
      </div>

      {/* Productivity Summary */}
      <section className="mt-xl grid grid-cols-1 md:grid-cols-12 gap-gutter pb-xl">
        <div className="md:col-span-8 bg-primary p-lg rounded-2xl text-on-primary relative overflow-hidden flex flex-col justify-between min-h-[160px]">
          <div className="relative z-10">
            <h3 className="font-headline-md text-headline-md font-semibold text-lg">
              Shift Progress
            </h3>
            <p className="text-on-primary-container text-opacity-80">
              You've completed{" "}
              {tasks.filter((t) => t.status === "completed").length} of{" "}
              {tasks.length} assigned tasks today.
            </p>
          </div>
          <div className="relative z-10 w-full bg-on-primary/20 h-2 rounded-full overflow-hidden mt-8">
            <div
              className="bg-on-primary h-full transition-all duration-700"
              style={{
                width: `${tasks.length > 0 ? (tasks.filter((t) => t.status === "completed").length / tasks.length) * 100 : 0}%`,
              }}
            ></div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <TrendingUp className="w-32 h-32" />
          </div>
        </div>
        <div className="md:col-span-4 bg-surface-container-high p-lg rounded-2xl flex flex-col justify-center items-center text-center">
          <Timer className="text-primary w-10 h-10 mb-2" />
          <p className="text-label-md text-on-surface-variant uppercase font-semibold">
            Response Time
          </p>
          <p className="text-display font-display text-primary flex items-baseline justify-center font-bold text-4xl">
            12<span className="text-headline-md ml-1 text-xl">m</span>
          </p>
          <p className="text-label-sm text-on-surface-variant mt-1 text-xs">
            Avg. for Critical Incidents
          </p>
        </div>
      </section>

      {/* Create/Edit Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-[512px] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface">
              <h3 className="font-headline-sm font-semibold text-lg text-on-surface">
                {editingTaskId ? "Edit Task" : "Create New Task"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateTask}
              className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 bg-surface"
            >
              <div className="form-group flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Link to Field Activity (Optional)
                </label>
                <select
                  value={newTask.linkedActivity || ""}
                  onChange={(e) => {
                    const activityId = e.target.value;
                    const activityLabel = activityTypes.find(a => a.id === activityId)?.label || "";
                    setNewTask(prev => ({
                      ...prev,
                      linkedActivity: activityId,
                      title: (!prev.title || activityTypes.some(a => a.label === prev.title)) ? activityLabel : prev.title
                    }));
                  }}
                  className="form-input bg-surface appearance-none"
                >
                  <option value="">None / Custom Task</option>
                  {activityTypes.filter(a => a.id !== 'all').map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.label}
                    </option>
                  ))}
                </select>
              </div>

              {newTask.linkedActivity && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-surface-variant/30 p-4 rounded-xl border border-outline-variant/30">
                  <div className="form-group flex flex-col gap-1.5">
                    <label className="text-label-md font-semibold text-on-surface">
                      Job Order Number
                    </label>
                    <input
                      type="text"
                      value={newTask.joNumber || ""}
                      onChange={(e) =>
                        setNewTask({ ...newTask, joNumber: e.target.value })
                      }
                      className={`form-input ${joValidationMessage ? "error border-error bg-error-container" : ""}`}
                      placeholder="e.g. JO-10234"
                    />
                    {joValidationMessage && <p className="text-error text-xs mt-1">{joValidationMessage}</p>}
                  </div>
                  <div className="form-group flex flex-col gap-1.5">
                    <label className="text-label-md font-semibold text-on-surface">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={newTask.accountNumber || ""}
                      onChange={(e) =>
                        setNewTask({ ...newTask, accountNumber: e.target.value })
                      }
                      className="form-input"
                      placeholder="Enter account num"
                    />
                  </div>
                  <div className="form-group flex flex-col gap-1.5">
                    <label className="text-label-md font-semibold text-on-surface">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={newTask.accountName || ""}
                      onChange={(e) =>
                        setNewTask({ ...newTask, accountName: e.target.value })
                      }
                      className="form-input"
                      placeholder="Enter account name"
                    />
                  </div>
                </div>
              )}

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) =>
                    handleTaskFieldChange("title", e.target.value)
                  }
                  className="form-input"
                  placeholder="e.g. Inspect Generator 2"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">
                    Priority
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) =>
                      setNewTask({
                        ...newTask,
                        priority: e.target.value as TaskPriority,
                      })
                    }
                    className="form-input bg-surface appearance-none"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>

                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface flex justify-between items-center">
                    <span>Assign To (Multiple allowed)</span>
                    {newTask.assignedTo && newTask.assignedTo !== "Unassigned" && (
                      <span className="text-xs font-normal text-primary">
                        {newTask.assignedTo.split(", ").length} selected
                      </span>
                    )}
                  </label>
                  <div className="flex flex-col gap-2 max-h-40 overflow-y-auto border border-outline-variant rounded-lg p-3 bg-surface">
                    <label className="flex items-center gap-3 text-sm cursor-pointer hover:bg-surface-variant p-1 -mx-1 rounded transition-colors">
                      <input 
                        type="checkbox" 
                        checked={!newTask.assignedTo || newTask.assignedTo === "Unassigned"}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewTask({ ...newTask, assignedTo: "Unassigned" });
                          }
                        }}
                        className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4"
                      />
                      <span className={(!newTask.assignedTo || newTask.assignedTo === "Unassigned") ? "font-medium" : ""}>Unassigned</span>
                    </label>
                    {staffList.map((staff) => {
                      const currentAssignees = newTask.assignedTo && newTask.assignedTo !== "Unassigned" ? newTask.assignedTo.split(", ") : [];
                      const isChecked = currentAssignees.includes(staff);
                      return (
                        <label key={staff} className="flex items-center gap-3 text-sm cursor-pointer hover:bg-surface-variant p-1 -mx-1 rounded transition-colors">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              let nextAssignees = [...currentAssignees];
                              if (e.target.checked) {
                                nextAssignees.push(staff);
                              } else {
                                nextAssignees = nextAssignees.filter(s => s !== staff);
                              }
                              setNewTask({ ...newTask, assignedTo: nextAssignees.length ? nextAssignees.join(', ') : 'Unassigned' });
                            }}
                            className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4"
                          />
                          <span className={isChecked ? "font-medium" : ""}>{staff.split(" - ")[0]}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">
                    Area / Location *
                  </label>
                  <input
                    type="text"
                    value={newTask.location}
                    onChange={(e) =>
                      handleTaskFieldChange("location", e.target.value)
                    }
                    className="form-input"
                    placeholder="e.g. Filter Area A"
                    required
                  />
                </div>

                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">
                    Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={newTask.deadline}
                    onChange={(e) =>
                      setNewTask({ ...newTask, deadline: e.target.value })
                    }
                    className="form-input bg-surface"
                  />
                  {newTask.estimatedHours && (
                    <div className="text-xs text-primary font-medium flex items-center gap-1 mt-1">
                      <Zap className="w-3 h-3" />
                      Auto-suggested based on historical avg. ({newTask.estimatedHours} hours)
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Description
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) =>
                    setNewTask({ ...newTask, description: e.target.value })
                  }
                  className="form-input min-h-[100px] resize-y"
                  placeholder="Task instructions..."
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary px-6"
                >
                  Cancel
                </button>
                <button type="submit" disabled={!!joValidationMessage || isCheckingJo} className="btn-primary px-6">
                  {isCheckingJo ? 'Checking...' : (editingTaskId ? 'Save Changes' : 'Create Task')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {printPreviewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 print:bg-transparent print:static print:z-auto">
          <div className="bg-white w-[850px] max-w-[95vw] max-h-[95vh] rounded-2xl shadow-xl flex flex-col overflow-hidden print:w-auto print:max-w-none print:max-h-none print:rounded-none print:shadow-none print:bg-transparent">
            
            {/* Modal Header - Hidden when printing */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 hide-on-print">
              <h2 className="text-xl font-bold text-gray-800">Print Preview</h2>
              <div className="flex gap-3">
                <button 
                  onClick={() => setPrintPreviewData(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium transition-colors flex items-center gap-2"
                >
                  Confirm & Print
                </button>
              </div>
            </div>

            {/* Modal Body / Printable Content */}
            <div className="p-6 overflow-auto bg-gray-100 print:bg-transparent print:overflow-visible print:p-0">
               {printPreviewData?.activity?.type === "meter_test" || printPreviewData?.task?.type === "meter_test" ? (
                 <PrintableMeterTest
                   data={{
                     jobOrderNumber: printPreviewData?.task?.joNumber || printPreviewData?.task?.id || "",
                     accountName: printPreviewData?.activity?.details?.testAccountName || printPreviewData?.task?.accountName || "",
                     accountNumber: printPreviewData?.activity?.details?.accountNumber || printPreviewData?.task?.accountNumber || "",
                     date: (printPreviewData?.activity?.date && !isNaN(new Date(printPreviewData.activity.date).getTime())) ? new Date(printPreviewData.activity.date).toLocaleDateString() : (printPreviewData?.task?.date ? new Date(printPreviewData.task.date).toLocaleDateString() : new Date().toLocaleDateString()),
                     projectAddress: `${printPreviewData?.activity?.siteOrWell || printPreviewData?.activity?.area || printPreviewData?.task?.siteOrWell || printPreviewData?.task?.area || ""} ${printPreviewData?.activity?.blockLot ? "- " + printPreviewData.activity.blockLot : ""}`,
                     meterBrand: printPreviewData?.activity?.details?.meterBrand || "",
                     meterSerialNumber: printPreviewData?.activity?.details?.meterSerialNumber || "",
                     meterSize: printPreviewData?.activity?.details?.meterSize || "",
                     volumeOfWater: Number(printPreviewData?.activity?.details?.volumeOfWater || 30),
                     reading1_init: printPreviewData?.activity?.details?.currentReading !== undefined && printPreviewData?.activity?.details?.currentReading !== "" ? Number(printPreviewData.activity.details.currentReading) : undefined,
                     reading1_final: printPreviewData?.activity?.details?.reading1 !== undefined && printPreviewData?.activity?.details?.reading1 !== "" ? Number(printPreviewData.activity.details.reading1) : undefined,
                     reading2_init: printPreviewData?.activity?.details?.reading1 !== undefined && printPreviewData?.activity?.details?.reading1 !== "" ? Number(printPreviewData.activity.details.reading1) : undefined,
                     reading2_final: printPreviewData?.activity?.details?.reading2 !== undefined && printPreviewData?.activity?.details?.reading2 !== "" ? Number(printPreviewData.activity.details.reading2) : undefined,
                     reading3_init: printPreviewData?.activity?.details?.reading2 !== undefined && printPreviewData?.activity?.details?.reading2 !== "" ? Number(printPreviewData.activity.details.reading2) : undefined,
                     reading3_final: printPreviewData?.activity?.details?.reading3 !== undefined && printPreviewData?.activity?.details?.reading3 !== "" ? Number(printPreviewData.activity.details.reading3) : undefined,
                     error1: printPreviewData?.activity?.details?.error1,
                     error2: printPreviewData?.activity?.details?.error2,
                     error3: printPreviewData?.activity?.details?.error3,
                     avgError: printPreviewData?.activity?.details?.avgError,
                     testingResults: printPreviewData?.activity?.details?.testingResults || "",
                     recommendation: printPreviewData?.activity?.details?.recommendation || "",
                     testedBy: (printPreviewData?.activity?.staff || []).join(", ") || "",
                     witnessedBy: printPreviewData?.activity?.details?.witnessedBy || "",
                     witnessSignatureImg: printPreviewData?.activity?.details?.witnessSignature || undefined,
                     checkedBy: "HERNAN TALAVERA",
                     finalDecision: "",
                   }}
                 />
               ) : (
                 <PrintableTaskHistory data={printPreviewData} />
               )}
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
