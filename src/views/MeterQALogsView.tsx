import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Search, Loader2, AlertCircle, Printer, Edit2, X } from "lucide-react";
import { PrintableMeterTest } from "../components/PrintableMeterTest";

interface MeterQALogsViewProps {
  currentUid: string | null;
}

export function MeterQALogsView({ currentUid }: MeterQALogsViewProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Passed" | "Failed">("All");

  // Print Preview
  const [printPreviewData, setPrintPreviewData] = useState<any | null>(null);

  // Edit Data Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currentUid) return;

    const fetchLogs = async () => {
      setIsLoading(true);
      setError("");
      try {
        const q = query(
          collection(db, `users/${currentUid}/activities`),
          where("type", "==", "meter_test"),
          where("status", "==", "completed")
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
          } as any;
        });
        
        // Sort descending by date locally since we don't have composite indexes guaranteed
        data.sort((a, b) => {
          const dateA = new Date(a.date || a.createdAt || 0).getTime();
          const dateB = new Date(b.date || b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        setLogs(data);
      } catch (err) {
        console.error("Failed to fetch meter QA logs:", err);
        setError("Failed to load meter QA logs. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [currentUid]);

  const handleEditClick = (log: any) => {
    const details = log.details || {};
    setEditFormData({
      date: log.date || "",
      testAccountName: details.testAccountName || log.accountName || "",
      accountNumber: details.accountNumber || log.accountNumber || "",
      meterSerialNumber: details.meterSerialNumber || "",
      meterBrand: details.meterBrand || "",
      meterSize: details.meterSize || "",
      volumeOfWater: details.volumeOfWater || 30,
      currentReading: details.currentReading || "",
      reading1: details.reading1 || "",
      reading2: details.reading2 || "",
      reading3: details.reading3 || "",
    });
    setEditingLogId(log.id);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUid || !editingLogId) return;

    setIsSaving(true);
    try {
      const logRef = doc(db, `users/${currentUid}/activities`, editingLogId);
      
      // Calculate errors
      const testVolCubicMeters = (Number(editFormData.volumeOfWater) / 3) / 1000;
      
      const r1i = Number(editFormData.currentReading);
      const r1f = Number(editFormData.reading1);
      const r2f = Number(editFormData.reading2);
      const r3f = Number(editFormData.reading3);

      let err1 = null; let err2 = null; let err3 = null;
      let totalRegistered = 0;
      let validCount = 0;

      if (!isNaN(r1i) && !isNaN(r1f) && r1i >= 0 && r1f >= 0) {
        const diff = r1f - r1i;
        err1 = ((diff - testVolCubicMeters) / testVolCubicMeters) * 100;
        totalRegistered += diff;
        validCount++;
      }
      if (!isNaN(r1f) && !isNaN(r2f) && r1f >= 0 && r2f >= 0) {
        const diff = r2f - r1f;
        err2 = ((diff - testVolCubicMeters) / testVolCubicMeters) * 100;
        totalRegistered += diff;
        validCount++;
      }
      if (!isNaN(r2f) && !isNaN(r3f) && r2f >= 0 && r3f >= 0) {
        const diff = r3f - r2f;
        err3 = ((diff - testVolCubicMeters) / testVolCubicMeters) * 100;
        totalRegistered += diff;
        validCount++;
      }

      let avgError = null;
      if (validCount > 0 && testVolCubicMeters > 0) {
        const totalActual = testVolCubicMeters * validCount;
        avgError = ((totalRegistered - totalActual) / totalActual) * 100;
      }

      const testingResults = avgError !== null 
        ? (avgError > 5 ? 'Fast Moving' : avgError < -5 ? 'Slow Moving' : 'Normal')
        : "";

      const recommendation = avgError !== null
        ? (Math.abs(avgError) > 5 ? 'Replace' : 'Retain')
        : "";

      await updateDoc(logRef, {
        date: editFormData.date,
        "details.testAccountName": editFormData.testAccountName,
        "details.accountNumber": editFormData.accountNumber,
        "details.meterSerialNumber": editFormData.meterSerialNumber,
        "details.meterBrand": editFormData.meterBrand,
        "details.meterSize": editFormData.meterSize,
        "details.volumeOfWater": Number(editFormData.volumeOfWater),
        "details.currentReading": editFormData.currentReading,
        "details.reading1": editFormData.reading1,
        "details.reading2": editFormData.reading2,
        "details.reading3": editFormData.reading3,
        "details.error1": err1,
        "details.error2": err2,
        "details.error3": err3,
        "details.avgError": avgError,
        "details.testingResults": testingResults,
        "details.recommendation": recommendation,
        updatedAt: serverTimestamp(),
      });

      setLogs(logs.map(log => {
        if (log.id === editingLogId) {
          return {
            ...log,
            date: editFormData.date,
            details: {
              ...log.details,
              testAccountName: editFormData.testAccountName,
              accountNumber: editFormData.accountNumber,
              meterSerialNumber: editFormData.meterSerialNumber,
              meterBrand: editFormData.meterBrand,
              meterSize: editFormData.meterSize,
              volumeOfWater: Number(editFormData.volumeOfWater),
              currentReading: editFormData.currentReading,
              reading1: editFormData.reading1,
              reading2: editFormData.reading2,
              reading3: editFormData.reading3,
              error1: err1,
              error2: err2,
              error3: err3,
              avgError: avgError,
              testingResults: testingResults,
              recommendation: recommendation,
            }
          };
        }
        return log;
      }));

      setIsEditModalOpen(false);
      setEditingLogId(null);
    } catch (err) {
      console.error("Error updating QA log:", err);
      alert("Failed to update log.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const details = log.details || {};
    
    // Status Filter logic
    let isPassed = false;
    let isFailed = false;
    const testingResult = details.testingResults || details.meterTestStatus || "";
    const recommendation = details.recommendation || "";
    const avgErr = details.avgError;
    
    if (avgErr !== undefined && avgErr !== null) {
      if (Math.abs(avgErr) <= 5) {
        isPassed = true;
      } else {
        isFailed = true;
      }
    } else {
       if (testingResult.toLowerCase() === "passed" || testingResult.toLowerCase() === "normal" || recommendation.toLowerCase() === "retain") {
         isPassed = true;
       } else if (testingResult.toLowerCase() === "failed" || testingResult.toLowerCase().includes("moving") || recommendation.toLowerCase() === "replace") {
         isFailed = true;
       }
    }

    if (statusFilter === "Passed" && !isPassed) return false;
    if (statusFilter === "Failed" && !isFailed) return false;

    // Search logic (Meter Serial No)
    if (searchQuery) {
      const serial = details.meterSerialNumber || "";
      if (!serial.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="shrink-0 border-b border-outline-variant bg-surface px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline-sm text-on-surface">Meter QA Logs</h2>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Master data table for all completed meter test activities.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search serial no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm w-full md:w-64 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="py-2 px-3 bg-surface-container border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="All">All Status</option>
            <option value="Passed">Passed</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6 bg-surface-container-lowest">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-on-surface-variant">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p>Loading meter QA logs...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-error bg-error-container/10 rounded-xl">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p>{error}</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-on-surface-variant bg-surface-container rounded-xl border border-outline-variant border-dashed">
            <Search className="w-8 h-8 mb-4 opacity-50" />
            <p className="font-medium text-on-surface">No meter QA logs found</p>
            <p className="text-sm mt-1">Adjust your search or filter to see more results.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-outline-variant overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Date</th>
                    <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Account Name</th>
                    <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Meter Serial No</th>
                    <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Test Volume</th>
                    <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">Avg % Error</th>
                    <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-center">Result</th>
                    <th className="py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {filteredLogs.map((log) => {
                    const details = log.details || {};
                    const dateStr = log.date ? new Date(log.date).toLocaleDateString() : "-";
                    const accountName = details.testAccountName || log.accountName || "-";
                    const serialNo = details.meterSerialNumber || "-";
                    const avgError = details.avgError;
                    
                    let isPassed = false;
                    let isFailed = false;
                    const testingResult = details.testingResults || details.meterTestStatus || "";
                    const recommendation = details.recommendation || "";
                    
                    if (avgError !== undefined && avgError !== null) {
                      if (Math.abs(avgError) <= 5) {
                        isPassed = true;
                      } else {
                        isFailed = true;
                      }
                    } else {
                       if (testingResult.toLowerCase() === "passed" || testingResult.toLowerCase() === "normal" || recommendation.toLowerCase() === "retain") {
                         isPassed = true;
                       } else if (testingResult.toLowerCase() === "failed" || testingResult.toLowerCase().includes("moving") || recommendation.toLowerCase() === "replace") {
                         isFailed = true;
                       }
                    }

                    return (
                      <tr key={log.id} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="py-3 px-4 text-sm text-on-surface whitespace-nowrap">{dateStr}</td>
                        <td className="py-3 px-4 text-sm font-medium text-on-surface">{accountName}</td>
                        <td className="py-3 px-4 text-sm font-mono text-on-surface-variant">{serialNo}</td>
                        <td className="py-3 px-4 text-sm text-on-surface text-right whitespace-nowrap">
                          {details.volumeOfWater ? `${details.volumeOfWater}L` : "30L (3x10)"}
                        </td>
                        <td className={`py-3 px-4 text-sm font-medium text-right ${avgError !== undefined && avgError !== null ? (Math.abs(avgError) > 5 ? 'text-error' : 'text-primary') : 'text-on-surface-variant'}`}>
                          {avgError !== undefined && avgError !== null ? (avgError > 0 ? '+' : '') + avgError.toFixed(2) + '%' : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                             isPassed ? 'bg-success/10 text-success border border-success/20' : 
                             isFailed ? 'bg-error/10 text-error border border-error/20' : 
                             'bg-surface-variant text-on-surface-variant border border-outline-variant'
                           }`}>
                             {isPassed ? 'Passed' : isFailed ? 'Failed' : 'Pending'}
                           </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrintPreviewData(log);
                              }}
                              className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Print Preview"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(log);
                              }}
                              className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Edit Data"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Data Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-[512px] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface">
              <h3 className="font-headline-sm font-semibold text-lg text-on-surface">
                Edit Meter QA Log
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveEdit}
              className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 bg-surface"
            >
              <div className="form-group flex flex-col gap-1.5">
                <label className="text-label-md font-semibold text-on-surface">
                  Account Name
                </label>
                <input
                  type="text"
                  value={editFormData.testAccountName || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, testAccountName: e.target.value })}
                  className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">
                    Meter Serial Number
                  </label>
                  <input
                    type="text"
                    value={editFormData.meterSerialNumber || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, meterSerialNumber: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">
                    Meter Brand
                  </label>
                  <input
                    type="text"
                    value={editFormData.meterBrand || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, meterBrand: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">
                    Meter Size
                  </label>
                  <input
                    type="text"
                    value={editFormData.meterSize || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, meterSize: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
                <div className="form-group flex flex-col gap-1.5">
                  <label className="text-label-md font-semibold text-on-surface">
                    Test Volume (Liters)
                  </label>
                  <input
                    type="number"
                    value={editFormData.volumeOfWater || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, volumeOfWater: e.target.value })}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="mt-2 border-t border-outline-variant pt-4">
                <h4 className="font-label-lg font-semibold text-on-surface mb-3">Readings</h4>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="form-group flex flex-col gap-1.5">
                    <label className="text-label-md text-on-surface-variant">
                      Initial Reading
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editFormData.currentReading || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, currentReading: e.target.value })}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="form-group flex flex-col gap-1.5">
                    <label className="text-label-md text-on-surface-variant">
                      Reading 1 Final
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editFormData.reading1 || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, reading1: e.target.value })}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="form-group flex flex-col gap-1.5">
                    <label className="text-label-md text-on-surface-variant">
                      Reading 2 Final
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editFormData.reading2 || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, reading2: e.target.value })}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="form-group flex flex-col gap-1.5">
                    <label className="text-label-md text-on-surface-variant">
                      Reading 3 Final
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editFormData.reading3 || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, reading3: e.target.value })}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-outline-variant bg-surface-container-lowest mt-auto flex justify-end gap-3 sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-6 py-2 border border-outline-variant text-on-surface-variant hover:bg-surface-variant font-medium rounded-full transition-colors text-sm"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary text-white hover:bg-primary/90 font-medium rounded-full transition-colors text-sm flex items-center gap-2">
                  {isSaving ? 'Saving...' : 'Save Changes'}
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
                  <Printer className="w-4 h-4" />
                  Confirm & Print
                </button>
              </div>
            </div>

            {/* Modal Body / Printable Content */}
            <div className="p-6 overflow-auto bg-gray-100 print:bg-transparent print:overflow-visible print:p-0">
              <PrintableMeterTest
                data={{
                  jobOrderNumber: printPreviewData.joNumber || printPreviewData.id || "",
                  accountName: printPreviewData.details?.testAccountName || printPreviewData.accountName || "",
                  accountNumber: printPreviewData.details?.accountNumber || printPreviewData.accountNumber || "",
                  date: (printPreviewData.date && !isNaN(new Date(printPreviewData.date).getTime())) ? new Date(printPreviewData.date).toLocaleDateString() : new Date().toLocaleDateString(),
                  projectAddress: `${printPreviewData.siteOrWell || printPreviewData.area || ""} ${printPreviewData.blockLot ? "- " + printPreviewData.blockLot : ""}`,
                  meterBrand: printPreviewData.details?.meterBrand || "",
                  meterSerialNumber: printPreviewData.details?.meterSerialNumber || "",
                  meterSize: printPreviewData.details?.meterSize || "",
                  volumeOfWater: Number(printPreviewData.details?.volumeOfWater || 30),
                  reading1_init: printPreviewData.details?.currentReading !== undefined && printPreviewData.details?.currentReading !== "" ? Number(printPreviewData.details?.currentReading) : undefined,
                  reading1_final: printPreviewData.details?.reading1 !== undefined && printPreviewData.details?.reading1 !== "" ? Number(printPreviewData.details?.reading1) : undefined,
                  reading2_init: printPreviewData.details?.reading1 !== undefined && printPreviewData.details?.reading1 !== "" ? Number(printPreviewData.details?.reading1) : undefined,
                  reading2_final: printPreviewData.details?.reading2 !== undefined && printPreviewData.details?.reading2 !== "" ? Number(printPreviewData.details?.reading2) : undefined,
                  reading3_init: printPreviewData.details?.reading2 !== undefined && printPreviewData.details?.reading2 !== "" ? Number(printPreviewData.details?.reading2) : undefined,
                  reading3_final: printPreviewData.details?.reading3 !== undefined && printPreviewData.details?.reading3 !== "" ? Number(printPreviewData.details?.reading3) : undefined,
                  error1: printPreviewData.details?.error1,
                  error2: printPreviewData.details?.error2,
                  error3: printPreviewData.details?.error3,
                  avgError: printPreviewData.details?.avgError,
                  testingResults: printPreviewData.details?.testingResults || "",
                  recommendation: printPreviewData.details?.recommendation || "",
                  testedBy: (printPreviewData.staff || []).join(", ") || "",
                  witnessedBy: printPreviewData.details?.witnessedBy || "",
                  witnessSignatureImg: printPreviewData.details?.witnessSignature || undefined,
                  checkedBy: "HERNAN TALAVERA",
                  finalDecision: "",
                }}
              />
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}

