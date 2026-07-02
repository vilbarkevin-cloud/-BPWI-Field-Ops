import React, { forwardRef } from 'react';
import { AppLogo } from './AppLogo';

export interface PrintableTaskHistoryData {
  task: any;
  activity: any;
}

export const PrintableTaskHistory = ({ data, ref }: { data: PrintableTaskHistoryData; ref?: React.Ref<HTMLDivElement> }) => {
  const { task, activity } = data;
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleString();
  };

  return (
    <div ref={ref} className="p-8 bg-white text-black max-w-4xl mx-auto font-sans text-sm printable-task-history border border-gray-200 print:border-none my-8">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
        <div className="flex items-center gap-4">
          {/* BPWI Logo Placeholder / Header */}
          <AppLogo className="w-16 h-16" />
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider mb-1">Task History Report</h1>
            <h2 className="text-lg font-semibold text-gray-700">Field Operations</h2>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg">{task.joNumber || `JO-${task.id.substring(0,6).toUpperCase()}`}</p>
          <p className="text-gray-600">Printed: {new Date().toLocaleString()}</p>
        </div>
      </div>

      {/* Task Details */}
      <div className="mb-6 border border-black p-4 bg-gray-50 print:bg-transparent print:border-gray-500">
        <h3 className="font-bold text-md mb-4 border-b border-gray-300 pb-1 uppercase tracking-wide">Job Order Details</h3>
        
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div><span className="font-bold inline-block w-32">Task Title:</span> {task.title}</div>
          <div><span className="font-bold inline-block w-32">Priority:</span> <span className="uppercase">{task.priority}</span></div>
          
          <div><span className="font-bold inline-block w-32">Account Name:</span> {task.accountName || "N/A"}</div>
          <div><span className="font-bold inline-block w-32">Account No:</span> {task.accountNumber || "N/A"}</div>
          
          <div className="col-span-2"><span className="font-bold inline-block w-32">Location:</span> {task.location} {task.blockLot ? `(${task.blockLot})` : ''}</div>
          <div className="col-span-2"><span className="font-bold inline-block w-32 text-gray-700">Description:</span> <span className="whitespace-pre-wrap">{task.description}</span></div>
        </div>
      </div>

      {/* Timestamps */}
      <div className="mb-6 border border-black p-4 print:border-gray-500">
        <h3 className="font-bold text-md mb-4 border-b border-gray-300 pb-1 uppercase tracking-wide">Timestamps & Status</h3>
        
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div><span className="font-bold inline-block w-32">Status:</span> <span className="uppercase">{task.status}</span></div>
          <div><span className="font-bold inline-block w-32">Assigned To:</span> {task.assignedTo || "N/A"}</div>
          
          <div><span className="font-bold inline-block w-32">Created:</span> {formatDate(task.createdAt)}</div>
          <div><span className="font-bold inline-block w-32">Deadline:</span> {formatDate(task.deadline)}</div>
          
          <div><span className="font-bold inline-block w-32">Completed:</span> {formatDate(task.completedAt)}</div>
          <div>
            <span className="font-bold inline-block w-32">Turn Around Time:</span> 
            {task.createdAt && task.completedAt ? (
               ((new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(1) + " hours"
            ) : "N/A"}
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="mb-6">
         <h3 className="font-bold text-md mb-2 uppercase tracking-wide">Activity Log</h3>
         <table className="w-full border-collapse border border-black">
           <thead>
             <tr className="bg-gray-200 print:bg-gray-100">
               <th className="border border-black p-2 text-left w-1/4">Timestamp</th>
               <th className="border border-black p-2 text-left w-1/4">Activity Type</th>
               <th className="border border-black p-2 text-left">Details</th>
             </tr>
           </thead>
           <tbody>
             {activity ? (
               <tr>
                 <td className="border border-black p-2">{formatDate(activity.date || activity.createdAt)}</td>
                 <td className="border border-black p-2 capitalize">{activity.type?.replace(/_/g, ' ')}</td>
                 <td className="border border-black p-2 text-sm">
                   {activity.notes ? <div className="mb-2 italic">"{activity.notes}"</div> : null}
                   
                   {activity.details && Object.keys(activity.details).length > 0 && (
                     <div className="grid grid-cols-1 gap-1 text-xs">
                        {Object.entries(activity.details).map(([key, val]) => {
                           if (key.toLowerCase().includes('signature') || key.toLowerCase().includes('image') || key === 'attachments') return null;
                           if (typeof val === 'object') return null;
                           return (
                             <div key={key}>
                               <span className="font-semibold">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span> {String(val)}
                             </div>
                           )
                        })}
                     </div>
                   )}
                 </td>
               </tr>
             ) : (
               <tr>
                 <td colSpan={3} className="border border-black p-4 text-center italic text-gray-500">
                   No specific field activity linked to this task.
                 </td>
               </tr>
             )}
           </tbody>
         </table>
      </div>

      <div className="mt-16 flex justify-between">
        <div className="w-64 text-center">
          <div className="border-b border-black mb-2"></div>
          <p className="font-bold text-sm">Prepared By</p>
          <p className="text-xs text-gray-500 mt-1">{task.assignedTo || 'Authorized Personnel'}</p>
        </div>
        <div className="w-64 text-center">
          <div className="border-b border-black mb-2"></div>
          <p className="font-bold text-sm">Checked/Verified By</p>
          <p className="text-xs text-gray-500 mt-1">Signature over Printed Name</p>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-task-history, .printable-task-history * {
            visibility: visible;
          }
          .printable-task-history {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
        }
      `}} />
    </div>
  );
};
