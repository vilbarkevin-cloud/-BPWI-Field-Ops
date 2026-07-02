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
  volumeOfWater: number; // usually 30 liters
  reading1_init: number;
  reading1_final: number;
  reading2_init: number;
  reading2_final: number;
  reading3_init: number;
  reading3_final: number;
  error1: number;
  error2: number;
  error3: number;
  avgError: number;
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
    <div ref={ref} className="bg-[#f0f4f8] text-gray-900 w-full min-w-[600px] max-w-2xl mx-auto font-sans text-sm printable-meter-test min-h-screen p-6 print:min-w-0 print:p-0 print:bg-white flex flex-col gap-4">
      
      {/* Header */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 print:border-none print:shadow-none print:p-0 print:mb-4">
        <svg viewBox="0 0 200 100" className="h-14 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 20C33.4 20 20 33.4 20 50C20 66.6 33.4 80 50 80C66.6 80 80 66.6 80 50C80 41.7 76.6 34.2 71.2 28.8L128.8 86.4C134.2 91.8 141.7 95.2 150 95.2C175 95.2 195.2 75 195.2 50C195.2 25 175 4.8 150 4.8C141.7 4.8 134.2 8.2 128.8 13.6L71.2 71.2C65.8 76.6 58.3 80 50 80C33.4 80 20 66.6 20 50C20 33.4 33.4 20 50 20Z" fill="#1e40af" />
          <path d="M150 20C166.6 20 180 33.4 180 50C180 66.6 166.6 80 150 80C133.4 80 120 66.6 120 50C120 41.7 123.4 34.2 128.8 28.8L71.2 86.4C65.8 91.8 58.3 95.2 50 95.2C25 95.2 4.8 75 4.8 50C4.8 25 25 4.8 50 4.8C58.3 4.8 65.8 8.2 71.2 13.6L128.8 71.2C134.2 76.6 141.7 80 150 80C166.6 80 180 66.6 180 50C180 33.4 166.6 20 150 20Z" fill="#3b82f6" opacity="0.8" />
        </svg>
        <div className="flex flex-col">
          <span className="font-bold text-gray-900 text-lg leading-tight">BP Waterworks, Inc.</span>
          <span className="text-gray-500 text-xs">Field Office</span>
        </div>
      </div>
      
      <h2 className="text-center font-bold text-xl tracking-wide text-gray-900 bg-blue-50 py-3 rounded-lg print:bg-transparent print:py-0 print:mb-2 uppercase">
        METER TEST RESULTS
      </h2>

      {/* Job Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 print:shadow-none print:border-gray-300">
        <h3 className="font-bold text-gray-900 mb-4 text-base">Job Information</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Job Order Number</label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold">{data.jobOrderNumber || '-'}</div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Date of Testing</label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2">
              <span className="text-gray-400">📅</span>
              {data.date || '-'}
            </div>
          </div>
        </div>
        <div>
          <label className="text-[11px] font-medium text-gray-600 block mb-1">Tested By</label>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="truncate">{data.testedBy ? data.testedBy.split(',').map(s => s.split('-')[0].trim()).join(', ') : '-'}</span>
          </div>
        </div>
      </div>

      {/* Customer & Meter Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 print:shadow-none print:border-gray-300">
        <h3 className="font-bold text-gray-900 mb-4 text-base">Customer & Meter Details</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Account Number</label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold flex justify-between items-center">
              {data.accountNumber || '-'}
              <span className="text-gray-400 text-xs">🔍</span>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Account Name</label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold">{data.accountName || '-'}</div>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="text-[11px] font-medium text-gray-600 block mb-1">Project / Address</label>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold">{data.projectAddress || '-'}</div>
        </div>
        
        <div className="mb-4">
          <label className="text-[11px] font-medium text-gray-600 block mb-1">Meter Brand</label>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold flex justify-between items-center">
            {data.meterBrand || '-'}
            <span className="text-red-500 font-serif italic font-bold text-xs">Itron</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Meter Serial Number</label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold">{data.meterSerialNumber || '-'}</div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Meter Size</label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold">{data.meterSize || '-'}</div>
          </div>
        </div>
      </div>

      {/* Test Readings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 print:shadow-none print:border-gray-300">
        <h3 className="font-bold text-gray-900 mb-4 text-base">Test Readings</h3>
        <div className="mb-4">
          <label className="text-[11px] font-medium text-gray-600 block mb-1">Volume of Water</label>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm font-semibold flex justify-between items-center text-gray-800">
            {data.volumeOfWater || 0}
            <span className="text-gray-500 font-normal">liters</span>
          </div>
        </div>

        <div className="rounded-lg overflow-hidden border border-gray-200 mb-4">
          <table className="w-full text-center border-collapse text-sm">
            <thead>
              <tr className="bg-blue-50 border-b border-gray-200">
                <th className="font-semibold text-gray-700 py-2 px-2 text-xs">Test Point</th>
                <th className="font-semibold text-gray-700 py-2 px-2 text-xs">Initial Reading</th>
                <th className="font-semibold text-gray-700 py-2 px-2 text-xs">Final Reading</th>
                <th className="font-semibold text-gray-700 py-2 px-2 text-xs">% Error</th>
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
                  <tr key={i} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2 px-2 text-gray-600">{i + 1}</td>
                    <td className="py-2 px-2 font-medium">{hasData ? row.init.toFixed(4) : '0.0000'}</td>
                    <td className="py-2 px-2 font-medium">{hasData ? row.final.toFixed(4) : '0.0000'}</td>
                    <td className={`py-2 px-2 font-semibold ${hasData && !isErrOk ? 'text-red-500' : hasData ? 'text-green-600' : 'text-gray-400'}`}>
                      {hasData ? (err > 0 ? '+' : '') + err.toFixed(2) + '%' : '0.00%'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="flex justify-between items-center px-2">
          <span className="font-bold text-gray-700 text-sm">Overall Avg Error</span>
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-900 text-sm">{avgErr !== null ? (avgErr > 0 ? '+' : '') + avgErr.toFixed(2) + '%' : '0.00%'}</span>
            {avgErr !== null && (
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${isToleranceOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isToleranceOk ? 'Within Tolerance' : 'Out of Tolerance'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Results & Decision */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 print:shadow-none print:border-gray-300">
        <h3 className="font-bold text-gray-900 mb-4 text-base">Results & Decision</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-2">Testing Results</label>
            <span className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider ${computedTestingResults === 'Normal' || computedTestingResults === 'Passed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {computedTestingResults}
            </span>
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Recommendation</label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold flex justify-between items-center">
              {computedRecommendation}
              <span className="text-gray-400 text-xs">▼</span>
            </div>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-gray-600 block mb-1">Comments:</label>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm min-h-[80px] text-gray-600 italic">
            Sample text are suitable and open date testing for comments on sample text.
          </div>
        </div>
      </div>

      {/* Sign-Off & Approval */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 print:shadow-none print:border-gray-300">
        <h3 className="font-bold text-gray-900 mb-4 text-base">Sign-Off & Approval</h3>
        
        <div className="flex gap-6 mb-6">
          <div className="flex items-center gap-2">
            {data.finalDecision === 'Proceed' ? <CheckSquare className="w-4 h-4 text-gray-700" /> : <Square className="w-4 h-4 text-gray-400" />}
            <span className="text-sm font-semibold text-gray-700">Proceed</span>
          </div>
          <div className="flex items-center gap-2">
            {data.finalDecision === 'Override: Retain' ? <CheckSquare className="w-4 h-4 text-gray-700" /> : <Square className="w-4 h-4 text-gray-400" />}
            <span className="text-sm font-semibold text-gray-700">Override: Retain</span>
          </div>
          <div className="flex items-center gap-2">
            {data.finalDecision === 'RETEST' ? <CheckSquare className="w-4 h-4 text-gray-700" /> : <Square className="w-4 h-4 text-gray-400" />}
            <span className="text-sm font-semibold text-gray-700 uppercase">Retest</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Witnessed by</label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 h-10 flex items-center justify-between relative">
              <span className="text-sm font-semibold">{data.witnessedBy}</span>
              {data.witnessSignatureImg && (
                <img src={data.witnessSignatureImg} className="absolute right-8 max-h-8 object-contain" alt="signature" />
              )}
              <span className="text-gray-400 text-xs">📝</span>
            </div>
          </div>
          
          <div>
            <label className="text-[11px] font-medium text-gray-600 block mb-1">Checked by</label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold h-10 flex items-center">
              {data.checkedBy || 'H. Talavera'}
            </div>
          </div>
          
          <div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 h-10 flex items-center justify-between">
              Customer Signature
              <span className="text-gray-400 text-xs">✏️</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body {
            background-color: white !important;
          }
          .printable-meter-test {
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 0;
            background-color: white !important;
            gap: 16px !important;
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
