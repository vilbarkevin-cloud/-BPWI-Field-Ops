import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot, query } from 'firebase/firestore';
import { BarChart3, TrendingUp, TrendingDown, Target, Clock, CheckCircle2, X, Download, Award, ShieldAlert, Zap, Medal, Star, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, ComposedChart } from 'recharts';
import { defaultStaff } from '../lib/dataStore';

interface KpiViewProps {
  setActiveTab?: any;
  currentUid?: string | null;
}

export function KpiView({ currentUid, setActiveTab }: KpiViewProps) {
  const [customStaff, setCustomStaff] = useState<string[]>([]);
  const [allStaff, setAllStaff] = useState<{id: string, name: string, showInKpis: boolean}[]>([]);
  const [showKpiUsersModal, setShowKpiUsersModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  
  const [activities, setActivities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tatDrilldownData, setTatDrilldownData] = useState<{month: string, breaches: any[]} | null>(null);

  useEffect(() => {
    let initialStaff: string[] = [];
    if (currentUid) {
      const q = query(collection(db, `users/${currentUid}/staff`));
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const staffDocs = snap.docs.map(d => ({
            id: d.id,
            name: d.data().name as string,
            showInKpis: d.data().showInKpis !== false, // default true
          })).filter(s => !s.name.toLowerCase().includes('head') && !s.name.toLowerCase().includes('admin'));
          
          staffDocs.sort((a,b) => a.name.localeCompare(b.name));
          setAllStaff(staffDocs);
          setCustomStaff(staffDocs.filter(s => s.showInKpis).map(s => s.name));
        } else {
          const stored = localStorage.getItem('watsanStaff');
          initialStaff = stored ? JSON.parse(stored) : defaultStaff;
          initialStaff = initialStaff.filter((name: string) => !name.toLowerCase().includes('head') && !name.toLowerCase().includes('admin'));
          setAllStaff(initialStaff.map(name => ({ id: name.replace(/\s+/g, "_").toLowerCase(), name, showInKpis: true })));
          setCustomStaff(initialStaff);
        }
      }, (error: any) => {
        if (error.code === 'permission-denied') return;
        console.error("KpiView Staff listener error:", error);
      });
      return () => unsub();
    } else {
      const stored = localStorage.getItem('watsanStaff');
      initialStaff = stored ? JSON.parse(stored) : defaultStaff;
      initialStaff = initialStaff.filter((name: string) => !name.toLowerCase().includes('head') && !name.toLowerCase().includes('admin'));
      setAllStaff(initialStaff.map(name => ({ id: name.replace(/\s+/g, "_").toLowerCase(), name, showInKpis: true })));
      setCustomStaff(initialStaff);
    }
  }, [currentUid]);

  const toggleUserKpiVisibility = async (staffId: string, currentStatus: boolean) => {
    if (!currentUid) return;
    try {
      await setDoc(
        doc(db, `users/${currentUid}/staff`, staffId),
        { showInKpis: !currentStatus },
        { merge: true }
      );
    } catch(err) {
      console.error(err);
      alert('Failed to update visibility');
    }
  };

  const [incidents, setIncidents] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUid) return;
    const actQ = query(collection(db, `users/${currentUid}/activities`));
    const taskQ = query(collection(db, `users/${currentUid}/tasks`));
    const incQ = query(collection(db, `users/${currentUid}/incidents`));
    
    const unsubAct = onSnapshot(actQ, (snap) => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error("KPI Act listener error:", error);
    });
    const unsubTask = onSnapshot(taskQ, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error("KPI Task listener error:", error);
    });
    const unsubInc = onSnapshot(incQ, (snap) => {
      setIncidents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error: any) => {
      if (error.code === 'permission-denied') return;
      console.error("KPI Inc listener error:", error);
    });

    return () => { unsubAct(); unsubTask(); unsubInc(); };
  }, [currentUid]);

  type DateRange = 'Weekly' | 'Monthly' | 'Quarterly';
  const [dateRange, setDateRange] = useState<DateRange>('Monthly');

  const now = new Date();
  const cutoffDate = new Date();
  const previousCutoffDate = new Date();
  
  if (dateRange === 'Weekly') {
    cutoffDate.setDate(now.getDate() - 7);
    previousCutoffDate.setDate(now.getDate() - 14);
  } else if (dateRange === 'Monthly') {
    cutoffDate.setMonth(now.getMonth() - 1);
    previousCutoffDate.setMonth(now.getMonth() - 2);
  } else if (dateRange === 'Quarterly') {
    cutoffDate.setMonth(now.getMonth() - 3);
    previousCutoffDate.setMonth(now.getMonth() - 6);
  }

  const isAfterCutoff = (itemDate: any) => {
    if (!itemDate) return true;
    const d = itemDate.toDate ? itemDate.toDate() : new Date(itemDate);
    if (isNaN(d.getTime())) return true;
    return d >= cutoffDate;
  };
  
  const isPreviousPeriod = (itemDate: any) => {
    if (!itemDate) return false;
    const d = itemDate.toDate ? itemDate.toDate() : new Date(itemDate);
    if (isNaN(d.getTime())) return false;
    return d >= previousCutoffDate && d < cutoffDate;
  };

  // Generate KPI data for each staff member based on actual tasks and activities
  const getComputedKPIs = (name: string) => {
    // Current period
    const userTasks = tasks.filter(t => t.assignedTo === name && isAfterCutoff(t.updatedAt || t.createdAt));
    const userActivities = activities.filter(a => ((a.staff || []).map((s:string)=>s.trim().toLowerCase()).includes(name.toLowerCase()) || a.operator === name || a.witnessedBy === name) && isAfterCutoff(a.date || a.timestamp));
    const userIncs = incidents.filter(i => i.reportedBy === name && isAfterCutoff(i.timestamp || i.createdAt));
    
    // Previous period
    const prevTasks = tasks.filter(t => t.assignedTo === name && isPreviousPeriod(t.updatedAt || t.createdAt));
    
    const currentTaskScore = userTasks.length > 0 ? (userTasks.filter(t => t.status === 'completed').length / userTasks.length) * 100 : 100;
    const prevTaskScore = prevTasks.length > 0 ? (prevTasks.filter(t => t.status === 'completed').length / prevTasks.length) * 100 : 100;
    
    let trend = 'same';
    if (currentTaskScore > prevTaskScore) trend = 'up';
    else if (currentTaskScore < prevTaskScore) trend = 'down';

    return {
      tasks: Math.round(currentTaskScore),
      hours: '0.0',
      trend: trend,
      jobsDone: userActivities.length,
    };
  };

  return (
    <div className="p-4 max-w-7xl mx-auto pb-24 animate-in fade-in duration-300">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Team Performance KPIs</h2>
            <p className="text-on-surface-variant mt-1">Individual performance metrics and activity scores.</p>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide items-center">
            {(['Weekly', 'Monthly', 'Quarterly'] as DateRange[]).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-full font-label-md transition-colors whitespace-nowrap ${
                  dateRange === range
                    ? 'bg-primary text-white'
                    : 'bg-surface border border-outline-variant text-on-surface hover:bg-surface-variant'
                }`}
              >
                {range}
              </button>
            ))}
            <div className="w-px h-8 bg-outline-variant mx-2 hidden md:block"></div>
            <button
              onClick={() => setShowKpiUsersModal(true)}
              className="px-4 py-2 bg-surface border border-outline-variant rounded-full text-on-surface hover:bg-surface-variant transition-colors whitespace-nowrap flex items-center gap-2 font-label-md"
              title="Manage displayed users"
            >
              <Users className="w-4 h-4" />
              <span>Users</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Overall Team Stats */}
          {(() => {
            let totalJobs = tasks.filter(t => t.status === 'completed' && isAfterCutoff(t.updatedAt || t.createdAt)).length + activities.filter(a => isAfterCutoff(a.date || a.timestamp)).length;

            return (
              <div className="lg:col-span-3 grid grid-cols-1 gap-4">
                <div className="bg-surface border border-outline-variant rounded-2xl p-4 lg:p-6 flex items-center gap-4 relative overflow-hidden group">
                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <CheckCircle2 className="w-24 h-24" />
                  </div>
                  <div className="p-3 bg-secondary text-white rounded-xl shrink-0 shadow-sm relative z-10">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="relative z-10">
                    <p className="text-sm lg:text-label-md text-on-surface-variant font-bold uppercase tracking-wider whitespace-nowrap">Jobs Completed</p>
                    <h3 className="font-display-sm text-2xl lg:text-3xl font-bold text-on-surface">{totalJobs}</h3>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAT Performance Chart */}
          {(() => {
            const tatTargets = {
              'Meter Test': 168,
              'New Meter Connection': 72,
              'Leak Repair': 24,
              'Meter Replacement': 72
            };

            // Generate last 6 months
            const months = [];
            for (let i = 5; i >= 0; i--) {
              const d = new Date();
              d.setMonth(d.getMonth() - i);
              months.push({
                label: d.toLocaleString('default', { month: 'short' }),
                month: d.getMonth(),
                year: d.getFullYear()
              });
            }

            const tatData = months.map(m => {
              const monthTasks = tasks.filter(t => {
                if (!t.completedAt || t.status !== 'completed') return false;
                const completedDate = new Date(t.completedAt);
                return completedDate.getMonth() === m.month && completedDate.getFullYear() === m.year;
              });

              let totalSLA_Met = 0;
              let totalSLA_Applicable = 0;
              const breachesList: any[] = [];

              const dataPoint: any = { name: m.label, breachesList };

              Object.keys(tatTargets).forEach(type => {
                const typeTasks = monthTasks.filter(t => {
                  const title = (t.title + " " + (t.linkedActivity || "").replace(/_/g, " ")).toLowerCase();
                  return title.includes(type.toLowerCase());
                });

                let totalHours = 0;
                let breaches = 0;

                typeTasks.forEach(t => {
                  const createdDate = new Date(t.createdAt || t.completedAt); // Fallback
                  const completedDate = new Date(t.completedAt);
                  const diffMs = completedDate.getTime() - createdDate.getTime();
                  const diffHours = Math.max(0, diffMs / (1000 * 60 * 60));
                  totalHours += diffHours;
                  
                  const target = (tatTargets as any)[type];
                  totalSLA_Applicable++;
                  
                  if (diffHours > target) {
                    breaches++;
                    breachesList.push({ ...t, diffHours, target, type });
                  } else {
                    totalSLA_Met++;
                  }
                });

                const avgHours = typeTasks.length > 0 ? parseFloat((totalHours / typeTasks.length).toFixed(1)) : 0;
                dataPoint[type] = avgHours;
              });
              
              dataPoint.compliance = totalSLA_Applicable > 0 ? Math.round((totalSLA_Met / totalSLA_Applicable) * 100) : 100;
              return dataPoint;
            });

            return (
              <div className="col-span-full">
                <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm min-w-0 relative">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                      <h3 className="font-headline-md text-on-surface flex items-center gap-2">
                        <Clock className="w-5 h-5 text-[#FF6B35]"/> Turnaround Time (TAT) vs SLA Targets
                      </h3>
                      <p className="text-sm text-on-surface-variant mt-1">
                        Average completion time (hours) by category and overall SLA compliance trend over 6 months. Click a bar to view breached tasks.
                      </p>
                    </div>
                  </div>
                  
                  <div className="h-80 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <ComposedChart data={tatData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}
                        onClick={(data: any) => {
                          if (data && data.activePayload && data.activePayload.length > 0) {
                            const payload = data.activePayload[0].payload;
                            if (payload.breachesList && payload.breachesList.length > 0) {
                              setTatDrilldownData({ month: payload.name, breaches: payload.breachesList });
                            } else {
                              alert(`No SLA breaches for ${payload.name}`);
                            }
                          }
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                          dy={10}
                          fontFamily="Inter, sans-serif"
                          fontWeight={500}
                          tick={{ fill: '#6B7280' }}
                        />
                        <YAxis 
                          yAxisId="left"
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                          width={40}
                          fontFamily="Inter, sans-serif"
                          tick={{ fill: '#6B7280' }}
                          label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6B7280', fontSize: 11 } }}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                          width={40}
                          fontFamily="Inter, sans-serif"
                          tick={{ fill: '#10B981' }}
                          domain={[0, 100]}
                          label={{ value: 'Compliance %', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#10B981', fontSize: 11 } }}
                        />
                        <RechartsTooltip 
                          contentStyle={{ 
                            borderRadius: '12px', 
                            border: '1px solid #E5E7EB', 
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            padding: '12px',
                            backgroundColor: 'white'
                          }}
                          itemStyle={{
                            fontSize: '13px',
                            fontWeight: 600,
                            padding: '0'
                          }}
                          cursor={{ fill: 'rgba(0, 102, 204, 0.05)', radius: 4 }}
                          formatter={(value: any, name: string) => {
                            if (name === 'compliance') return [`${value}%`, 'SLA Compliance'];
                            return [`${value} hrs (Target: ${tatTargets[name as keyof typeof tatTargets]}h)`, name];
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        
                        <Bar yAxisId="left" dataKey="Meter Test" fill="#0066CC" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        <Bar yAxisId="left" dataKey="New Meter Connection" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        <Bar yAxisId="left" dataKey="Leak Repair" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        <Bar yAxisId="left" dataKey="Meter Replacement" fill="#EC4899" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        
                        <Line 
                          yAxisId="right" 
                          type="monotone" 
                          dataKey="compliance" 
                          name="SLA Compliance %" 
                          stroke="#10B981" 
                          strokeWidth={3} 
                          dot={{ r: 4, fill: "#10B981", strokeWidth: 2, stroke: "#fff" }} 
                          activeDot={{ r: 6 }} 
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Individual Scores */}
          <div className="col-span-full">
            <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                <h3 className="font-headline-md text-on-surface flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary"/> Individual Rankings
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-variant/30 border-b border-outline-variant text-label-sm text-on-surface-variant uppercase tracking-wider">
                      <th className="py-4 px-6 font-medium">Team Member</th>
                      <th className="py-4 px-6 font-medium">Task Completion</th>
                      <th className="py-4 px-6 font-medium">Avg Time (hrs)</th>
                      <th className="py-4 px-6 font-medium text-right">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customStaff.map((staff, idx) => {
                      const kpi = getComputedKPIs(staff);
                      
                      return (
                        <tr 
                          key={staff} 
                          onClick={() => setSelectedStaff(staff)}
                          className="border-b border-outline-variant/50 hover:bg-surface-container-lowest transition-colors group cursor-pointer"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shadow-sm bg-surface-variant text-on-surface">
                                  {staff.charAt(0)}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors">
                                  {staff.includes(' - ') ? staff.split(' - ')[0] : staff}
                                </div>
                                {staff.includes(' - ') && (
                                  <div className="text-xs text-on-surface-variant mt-0.5">
                                    {staff.split(' - ')[1]}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 font-mono text-sm text-on-surface-variant">{kpi.tasks}%</td>
                          <td className="py-4 px-6 font-mono text-sm text-on-surface-variant">{kpi.hours}</td>
                          <td className="py-4 px-6 text-right">
                            {kpi.trend === 'up' ? (
                              <div className="flex items-center justify-end gap-1 text-[#166534] bg-[#bbf7d0]/30 inline-flex px-2 py-1 rounded">
                                <TrendingUp className="w-4 h-4"/>
                                <span className="text-xs font-bold">+2.4%</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1 text-error bg-error/10 inline-flex px-2 py-1 rounded">
                                <TrendingDown className="w-4 h-4"/>
                                <span className="text-xs font-bold">-1.1%</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Employee Appraisal Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-[896px] min-w-[300px] md:min-w-[700px] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-outline-variant bg-surface-container-lowest">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                  {selectedStaff.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-on-surface leading-tight">
                    {selectedStaff.includes(' - ') ? selectedStaff.split(' - ')[0] : selectedStaff}
                  </h2>
                  <p className="text-sm text-on-surface-variant font-medium text-primary">
                    {selectedStaff.includes(' - ') ? selectedStaff.split(' - ')[1] : 'Performance Appraisal Scorecard'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStaff(null)}
                className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const idx = customStaff.indexOf(selectedStaff);
                const kpi = getComputedKPIs(selectedStaff);
                
                return (
                  <div className="space-y-6">
                    {/* Top Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-sm text-on-surface-variant font-medium">Task Completion</p>
                          <CheckCircle2 className="w-4 h-4 text-[#166534]" />
                        </div>
                        <div className="flex items-end gap-2">
                          <h3 className="text-3xl font-bold text-on-surface">{kpi.tasks}%</h3>
                        </div>
                        <div className="w-full mt-3 h-1.5 bg-surface-variant rounded-full overflow-hidden">
                          <div className="h-full bg-[#166534]" style={{ width: `${kpi.tasks}%` }}></div>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Stats */}
                    <div className="grid grid-cols-1 gap-4">
                      <div className="bg-surface-variant/30 rounded-xl p-4 text-center">
                        <Zap className="w-5 h-5 mx-auto mb-2 text-[#00A8A8]" />
                        <p className="text-xs text-on-surface-variant mb-1">Jobs Done</p>
                        <p className="text-lg font-bold text-on-surface">{kpi.jobsDone}</p>
                      </div>
                    </div>

                    {/* Evaluator Notes Section */}
                    <div>
                      <label className="block text-sm font-semibold text-on-surface mb-2">Appraisal Notes / Feedback</label>
                      <textarea 
                        className="w-full form-input h-32 resize-none text-sm p-3"
                        placeholder="Enter supervisor feedback for the appraisal period here..."
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end gap-3">
              <button 
                onClick={() => setSelectedStaff(null)} 
                className="btn-secondary text-sm px-4 py-2"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  alert("Exporting scorecard to PDF...");
                  setSelectedStaff(null);
                }} 
                className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Scorecard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage KPI Users Modal */}
      {showKpiUsersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl shadow-xl w-full min-w-[300px] sm:min-w-[400px] max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-outline-variant shrink-0 bg-surface-container-lowest">
              <h3 className="font-display text-title-lg font-bold">Manage Users</h3>
              <button
                onClick={() => setShowKpiUsersModal(false)}
                className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2">
              <p className="text-sm text-on-surface-variant mb-2">
                Uncheck users to hide them from the Team KPIs page.
              </p>
              {allStaff.length > 0 ? allStaff.map(staff => (
                <label key={staff.id} className="flex items-center gap-3 p-3 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-variant cursor-pointer transition-colors">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      className="peer sr-only"
                      checked={staff.showInKpis}
                      onChange={() => toggleUserKpiVisibility(staff.id, staff.showInKpis)}
                    />
                    <div className="w-5 h-5 rounded border border-outline peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center transition-colors">
                      <CheckCircle2 className="w-4 h-4 text-white opacity-0 peer-checked:opacity-100" />
                    </div>
                  </div>
                  <span className="font-medium text-on-surface select-none">{staff.name}</span>
                </label>
              )) : (
                <div className="text-center p-4 text-on-surface-variant italic text-sm border border-dashed border-outline-variant rounded-lg">
                  No staff members available. Add them in Team Management.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-outline-variant bg-surface flex justify-end shrink-0">
              <button
                onClick={() => setShowKpiUsersModal(false)}
                className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAT Drilldown Modal */}
      {tatDrilldownData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl shadow-xl w-full min-w-[300px] sm:min-w-[600px] max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-outline-variant shrink-0 bg-surface-container-lowest">
              <div>
                <h3 className="font-display text-title-lg font-bold flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-error" /> SLA Breaches
                </h3>
                <p className="text-sm text-on-surface-variant">{tatDrilldownData.month} - {tatDrilldownData.breaches.length} Tasks breached their TAT Target.</p>
              </div>
              <button
                onClick={() => setTatDrilldownData(null)}
                className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
              {tatDrilldownData.breaches.map((task, idx) => (
                <div key={idx} className="bg-error-container/10 border border-error/20 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-on-surface text-base">{task.title}</h4>
                      <p className="text-sm text-on-surface-variant mb-1">{task.location}</p>
                      <div className="flex items-center gap-2 text-xs font-medium mt-2">
                        <span className="bg-error text-white px-2 py-0.5 rounded-full">
                          {task.diffHours.toFixed(1)} hrs
                        </span>
                        <span className="text-on-surface-variant">SLA Target: {task.target} hrs</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-on-surface-variant">
                      <p>Created: {task.createdAt ? new Date(task.createdAt).toLocaleString() : 'N/A'}</p>
                      <p>Completed: {task.completedAt ? new Date(task.completedAt).toLocaleString() : 'N/A'}</p>
                      <p className="mt-1 font-medium text-on-surface">Assignee: {task.assignedTo}</p>
                    </div>
                  </div>
                  
                  {task.tatJustification && (
                    <div className="mt-4 pt-3 border-t border-error/10">
                      <p className="text-sm font-semibold text-error/80 mb-1">Staff Justification:</p>
                      <p className="text-sm text-on-surface italic">"{task.tatJustification}"</p>
                    </div>
                  )}
                  {!task.tatJustification && (
                    <div className="mt-4 pt-3 border-t border-error/10">
                      <p className="text-sm text-on-surface-variant italic">No justification provided by staff.</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
