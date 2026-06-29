import React, { useState } from "react";
import { X, Send, AlertTriangle, ShieldCheck, ClipboardList } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface HuddleReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUid: string | null;
}

export function HuddleReportModal({ isOpen, onClose, currentUid }: HuddleReportModalProps) {
  const [statusUpdate, setStatusUpdate] = useState("");
  const [shiftBlockers, setShiftBlockers] = useState("");
  const [safetyNotes, setSafetyNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUid) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, `users/${currentUid}/huddle_reports`), {
        statusUpdate,
        shiftBlockers,
        safetyNotes,
        timestamp: serverTimestamp(),
      });
      setStatusUpdate("");
      setShiftBlockers("");
      setSafetyNotes("");
      onClose();
    } catch (err) {
      console.error("Error submitting huddle report:", err);
      alert("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-surface rounded-2xl w-[95vw] md:w-[600px] max-w-[600px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-outline-variant flex items-center justify-between bg-surface-container-lowest">
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Daily Huddle Report
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-low rounded-full transition-colors">
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="huddle-form" onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-secondary" />
                Status Updates
              </label>
              <textarea
                required
                value={statusUpdate}
                onChange={(e) => setStatusUpdate(e.target.value)}
                className="w-full p-4 rounded-xl border border-outline-variant bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none min-h-[160px]"
                placeholder="What did the team accomplish? What's the focus for today?"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-error" />
                Shift Blockers
              </label>
              <textarea
                value={shiftBlockers}
                onChange={(e) => setShiftBlockers(e.target.value)}
                className="w-full p-4 rounded-xl border border-outline-variant bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none min-h-[120px]"
                placeholder="Any obstacles preventing work? (e.g. equipment down, missing parts)"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Safety Notes
              </label>
              <textarea
                value={safetyNotes}
                onChange={(e) => setSafetyNotes(e.target.value)}
                className="w-full p-4 rounded-xl border border-outline-variant bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none min-h-[120px]"
                placeholder="Safety incidents, near misses, or reminders for the team"
              />
            </div>
          </form>
        </div>
        
        <div className="p-6 border-t border-outline flex justify-end gap-3 bg-surface-container-lowest">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-full border border-outline-variant text-on-surface hover:bg-surface-container-low transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="huddle-form"
            disabled={isSubmitting}
            className="px-6 py-2 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              "Submitting..."
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
