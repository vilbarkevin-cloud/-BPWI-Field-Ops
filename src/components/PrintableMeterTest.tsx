import React from 'react';
import { CheckSquare, Square, User } from 'lucide-react';

export interface MeterTestData {
  jobOrderNumber?: string;
  accountNumber?: string;
  accountName?: string;
  date: string;
  projectAddress: string;
  meterBrand: string;
  meterSerialNumber?: string;
  meterSize?: string;
  volumeOfWater: number;
  reading1_init?: number;
  reading1_final?: number;
  reading2_init?: number;
  reading2_final?: number;
  reading3_init?: number;
  reading3_final?: number;
  error1?: number;
  error2?: number;
  error3?: number;
  avgError?: number;
  testingResults: string;
  recommendation: string;
  testedBy: string;
  witnessedBy: string;
  witnessSignatureImg?: string;
  checkedBy: string;
  finalDecision: string;
}

export const PrintableMeterTest = ({ data, ref }: { data: MeterTestData; ref?: React.Ref<HTMLDivElement> }) => {
  const rows = [
    { init: data.reading1_init, final: data.reading1_final },
    { init: data.reading2_init, final: data.reading2_final },
    { init: data.reading3_init, final: data.reading3_final },
  ];
  let totalRegistered = 0;
  let validCount = 0;
  const testVolCubicMeters = (data.volumeOfWater / 3) / 1000;
  rows.forEach(r => {
    if (typeof r.init === 'number' && r.init >= 0 && typeof r.final === 'number' && r.final >= 0) {
      totalRegistered += (r.final - r.init);
      validCount++;
    }
  });
  
  let avgErr: number | null = null;
  if (validCount > 0 && testVolCubicMeters > 0) {
    const totalActual = testVolCubicMeters * validCount;
    avgErr = ((totalRegistered - totalActual) / totalActual) * 100;
  }

  const computedTestingResults = avgErr !== null 
    ? (avgErr > 5 ? 'Fast Moving' : avgErr < -5 ? 'Slow Moving' : 'Normal')
    : (data.testingResults === 'Passed' ? 'Normal' : data.testingResults);

  const computedRecommendation = avgErr !== null
    ? (Math.abs(avgErr) > 5 ? 'Replace' : 'Retain')
    : data.recommendation;

  const isToleranceOk = avgErr !== null && Math.abs(avgErr) <= 5;

  return (
    <div ref={ref} className="bg-white text-gray-900 w-full min-w-[700px] max-w-3xl mx-auto font-sans text-sm printable-meter-test p-8 print:min-w-0 print:p-0 print:bg-white flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-blue-600 pb-4 mb-2 print:border-b print:border-black">
        <div className="flex items-center gap-4">
          <img src="/logo.png" className="h-16 w-auto" alt="BP Waterworks Logo" />
          <div className="flex flex-col">
            <span className="font-black text-gray-900 text-2xl tracking-tight leading-none uppercase">BP Waterworks</span>
            <span className="text-gray-500 text-xs font-medium tracking-widest uppercase mt-1">Field Service Report</span>
          </div>
        </div>
        <div className="text-right flex flex-col">
          <h2 className="font-bold text-lg tracking-wide text-gray-900 uppercase">Meter Test Results</h2>
          <span className="text-gray-500 font-medium text-sm mt-1">Date: {data.date || '-'}</span>
          <span className="text-gray-500 font-medium text-sm">Job Order: <span className="text-gray-900 font-bold">{data.jobOrderNumber || '-'}</span></span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Customer Details */}
        <div>
          <h3 className="font-bold text-gray-800 border-b border-gray-200 pb-2 mb-3 text-xs uppercase tracking-wider">Customer Information</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-[120px_1fr] items-start">
              <span className="text-gray-500 text-xs font-medium">Account No:</span>
              <span className="font-semibold text-gray-900 text-sm">{data.accountNumber || '-'}</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-start">
              <span className="text-gray-500 text-xs font-medium">Account Name:</span>
              <span className="font-semibold text-gray-900 text-sm">{data.accountName || '-'}</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-start">
              <span className="text-gray-500 text-xs font-medium">Address / Project:</span>
              <span className="font-semibold text-gray-900 text-sm">{data.projectAddress || '-'}</span>
            </div>
          </div>
        </div>

        {/* Meter Details */}
        <div>
          <h3 className="font-bold text-gray-800 border-b border-gray-200 pb-2 mb-3 text-xs uppercase tracking-wider">Meter Specifications</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-[120px_1fr] items-start">
              <span className="text-gray-500 text-xs font-medium">Meter Brand:</span>
              <span className="font-semibold text-gray-900 text-sm">{data.meterBrand || '-'}</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-start">
              <span className="text-gray-500 text-xs font-medium">Serial Number:</span>
              <span className="font-semibold text-gray-900 text-sm">{data.meterSerialNumber || '-'}</span>
            </div>
            <div className="grid grid-cols-[120px_1fr] items-start">
              <span className="text-gray-500 text-xs font-medium">Meter Size:</span>
              <span className="font-semibold text-gray-900 text-sm">{data.meterSize || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Test Readings */}
      <div>
        <div className="flex justify-between items-end border-b border-gray-200 pb-2 mb-3">
          <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Volumetric Test Readings</h3>
          <span className="text-xs font-medium text-gray-500">
            Test Volume: <span className="font-bold text-gray-900">{data.volumeOfWater || 0} Liters</span>
          </span>
        </div>
        
        <table className="w-full text-left border-collapse mb-4">
          <thead>
            <tr className="bg-gray-50/50 print:bg-transparent">
              <th className="font-semibold text-gray-500 py-2 border-b border-gray-200 text-xs uppercase tracking-wider">Trial</th>
              <th className="font-semibold text-gray-500 py-2 border-b border-gray-200 text-xs uppercase tracking-wider">Initial Reading</th>
              <th className="font-semibold text-gray-500 py-2 border-b border-gray-200 text-xs uppercase tracking-wider">Final Reading</th>
              <th className="font-semibold text-gray-500 py-2 border-b border-gray-200 text-xs uppercase tracking-wider text-right">% Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const hasData = typeof row.init === 'number' && typeof row.final === 'number' && row.init >= 0 && row.final >= 0;
              let err = 0;
              if (hasData && testVolCubicMeters > 0) {
                const registeredVol = row.final - row.init;
                err = ((registeredVol - testVolCubicMeters) / testVolCubicMeters) * 100;
              }
              const isErrOk = Math.abs(err) <= 5;
              return (
                <tr key={i} className="border-b border-gray-100 last:border-b-0 print:border-b print:border-gray-200">
                  <td className="py-2 text-gray-500 font-medium">Test {i + 1}</td>
                  <td className="py-2 font-semibold text-gray-900">{hasData ? row.init?.toFixed(4) : ''}</td>
                  <td className="py-2 font-semibold text-gray-900">{hasData ? row.final?.toFixed(4) : ''}</td>
                  <td className={`py-2 font-bold text-right ${hasData && !isErrOk ? 'text-red-600 print:text-black' : hasData ? 'text-green-600 print:text-black' : 'text-gray-400 print:text-black'}`}>
                    {hasData ? (err > 0 ? '+' : '') + err.toFixed(2) + '%' : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="bg-gray-50 p-4 rounded-lg flex items-center gap-6 border border-gray-200 print:border-none print:bg-transparent print:p-0">
            <span className="font-bold text-gray-500 text-xs uppercase tracking-wider">Average Error</span>
            <span className={`font-black text-xl ${avgErr !== null ? (isToleranceOk ? 'text-green-600 print:text-black' : 'text-red-600 print:text-black') : 'text-gray-900 print:text-black'}`}>
              {avgErr !== null ? (avgErr > 0 ? '+' : '') + avgErr.toFixed(2) + '%' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Results & Recommendation */}
      <div className="grid grid-cols-2 gap-8 mt-2">
        <div>
          <h3 className="font-bold text-gray-800 border-b border-gray-200 pb-2 mb-3 text-xs uppercase tracking-wider">Conclusion</h3>
          <div className="space-y-4">
            <div>
              <span className="text-gray-500 text-xs font-medium block mb-1">Status Result</span>
              <span className={`inline-block px-3 py-1 rounded font-bold text-xs uppercase tracking-widest border ${computedTestingResults === 'Normal' || computedTestingResults === 'Passed' ? 'bg-green-50 text-green-700 border-green-200 print:border-black print:text-black' : 'bg-red-50 text-red-700 border-red-200 print:border-black print:text-black'}`}>
                {computedTestingResults}
              </span>
            </div>
            <div>
              <span className="text-gray-500 text-xs font-medium block mb-1">Action Recommendation</span>
              <span className="font-bold text-gray-900 text-base">{computedRecommendation}</span>
            </div>
          </div>
        </div>
        <div>
          <h3 className="font-bold text-gray-800 border-b border-gray-200 pb-2 mb-3 text-xs uppercase tracking-wider">Remarks</h3>
          <div className="text-gray-600 text-sm italic border border-gray-200 rounded p-3 min-h-[80px] bg-gray-50/50 print:bg-transparent print:border-gray-300">
            Test conducted as per standard volumetric procedure.
          </div>
        </div>
      </div>

      {/* Sign-Off & Approval */}
      <div className="mt-4 border-t-2 border-gray-200 pt-6">
        <h3 className="font-bold text-gray-800 mb-6 text-xs uppercase tracking-wider text-center">Signatures & Acknowledgement</h3>
        
        <div className="grid grid-cols-3 gap-8">
          <div className="flex flex-col items-center">
            <div className="h-16 flex items-end justify-center w-full border-b border-gray-400 pb-1 mb-2 px-2 text-center text-sm font-bold text-gray-900">
              {data.testedBy ? data.testedBy.split(',').map(s => s.split('-')[0].trim()).join(', ') : ''}
            </div>
            <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">Tested By</span>
            <span className="text-gray-400 text-[10px] mt-0.5">BP Waterworks Technician</span>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="h-16 flex items-end justify-center w-full border-b border-gray-400 pb-1 mb-2 px-2 text-center relative">
               {data.witnessSignatureImg ? (
                 <img src={data.witnessSignatureImg} className="max-h-14 max-w-full object-contain mb-1" alt="Witness Signature" />
               ) : (
                 <span className="text-sm font-bold text-gray-900">{data.witnessedBy}</span>
               )}
            </div>
            <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">Witnessed By</span>
            <span className="text-gray-400 text-[10px] mt-0.5">{data.witnessedBy || 'Customer / Representative'}</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="h-16 flex items-end justify-center w-full border-b border-gray-400 pb-1 mb-2 px-2 text-center text-sm font-bold text-gray-900">
              {data.checkedBy || 'H. Talavera'}
            </div>
            <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">Checked By</span>
            <span className="text-gray-400 text-[10px] mt-0.5">Supervisor / QA</span>
          </div>
        </div>
        
        <div className="flex justify-center mt-8 gap-8">
          <div className="flex items-center gap-2">
            {data.finalDecision === 'Proceed' ? <CheckSquare className="w-5 h-5 text-gray-900" /> : <Square className="w-5 h-5 text-gray-300" />}
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Proceed</span>
          </div>
          <div className="flex items-center gap-2">
            {data.finalDecision === 'Override: Retain' ? <CheckSquare className="w-5 h-5 text-gray-900" /> : <Square className="w-5 h-5 text-gray-300" />}
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Override: Retain</span>
          </div>
          <div className="flex items-center gap-2">
            {data.finalDecision === 'RETEST' ? <CheckSquare className="w-5 h-5 text-gray-900" /> : <Square className="w-5 h-5 text-gray-300" />}
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Retest</span>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body {
            background-color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .printable-meter-test {
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 20px !important;
            background-color: white !important;
            gap: 20px !important;
          }
          @page {
            size: portrait;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
};

