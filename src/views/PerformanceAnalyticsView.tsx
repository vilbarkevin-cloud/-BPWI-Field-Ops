import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  LineChart, Line
} from 'recharts';

export function PerformanceAnalyticsView({ currentUid }: { currentUid: string | null }) {
  console.log("Analytics view mounted");
  const [tasks, setTasks] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUid) return;

    let unsubTasks = () => {};
    let unsubAttendance = () => {};

    const loadData = async () => {
      // Load tasks
      const tasksQuery = query(collection(db, `users/${currentUid}/tasks`), orderBy("createdAt", "desc"), limit(1000));
      unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
        setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      // Load attendance
      const attendanceQuery = query(collection(db, `users/${currentUid}/attendance`), orderBy("timestamp", "desc"), limit(1000));
      unsubAttendance = onSnapshot(attendanceQuery, (snapshot) => {
        setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      setLoading(false);
    };

    loadData();

    return () => {
      unsubTasks();
      unsubAttendance();
    };
  }, [currentUid]);

  // Process data for charts
  const monthlyCompletionRate = useMemo(() => {
    // Group tasks by month
    const months: Record<string, { total: number; completed: number }> = {};
    
    tasks.forEach(t => {
      if (!t.createdAt) return;
      let dateObj;
      if (t.createdAt?.toMillis) {
        dateObj = new Date(t.createdAt.toMillis());
      } else if (typeof t.createdAt === 'string') {
        dateObj = new Date(t.createdAt);
      } else {
        return;
      }
      
      if (isNaN(dateObj.getTime())) return;
      
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      if (!months[monthKey]) {
        months[monthKey] = { total: 0, completed: 0 };
      }
      months[monthKey].total++;
      if (t.status === 'completed') {
        months[monthKey].completed++;
      }
    });

    return Object.keys(months).sort().map(key => {
      const data = months[key];
      const rate = data.total > 0 ? (data.completed / data.total) * 100 : 0;
      
      // format label (e.g., "2026-06" to "Jun 2026")
      const [year, m] = key.split('-');
      const date = new Date(parseInt(year), parseInt(m) - 1);
      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      return {
        name: label,
        total: data.total,
        completed: data.completed,
        rate: Math.round(rate)
      };
    }).slice(-12); // Last 12 months
  }, [tasks]);

  const monthlyAttendance = useMemo(() => {
    const months: Record<string, { clockIns: number }> = {};
    
    attendance.forEach(a => {
      if (a.type !== 'clock-in') return;
      let dateObj;
      if (a.timestamp?.toMillis) {
        dateObj = new Date(a.timestamp.toMillis());
      } else if (typeof a.timestamp === 'string') {
        dateObj = new Date(a.timestamp);
      } else {
        return;
      }
      
      if (isNaN(dateObj.getTime())) return;
      
      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      if (!months[monthKey]) {
        months[monthKey] = { clockIns: 0 };
      }
      months[monthKey].clockIns++;
    });

    return Object.keys(months).sort().map(key => {
      const data = months[key];
      
      const [year, m] = key.split('-');
      const date = new Date(parseInt(year), parseInt(m) - 1);
      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      return {
        name: label,
        clockIns: data.clockIns
      };
    }).slice(-12);
  }, [attendance]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <h1 className="text-2xl font-bold text-on-surface mb-6">Performance Analytics</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Completion Rate */}
        <div className="bg-surface border border-outline-variant rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-on-surface mb-4">Monthly Task Completion Rate</h2>
          {monthlyCompletionRate.length === 0 && !loading ? (
            <div className="h-[300px] flex items-center justify-center text-on-surface-variant">
              No task data available
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyCompletionRate} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={10} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="total" name="Total Tasks" stroke="#94A3B8" strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="completed" name="Completed Tasks" stroke="#22C55E" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="rate" name="Completion Rate (%)" stroke="#3B82F6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Staff Attendance */}
        <div className="bg-surface border border-outline-variant rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-on-surface mb-4">Monthly Staff Attendance (Clock-Ins)</h2>
          {monthlyAttendance.length === 0 && !loading ? (
            <div className="h-[300px] flex items-center justify-center text-on-surface-variant">
              No attendance data available
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyAttendance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="clockIns" name="Total Clock-Ins" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
