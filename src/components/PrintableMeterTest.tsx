import React from 'react';
import { CheckSquare, Square } from 'lucide-react';

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
    <div ref={ref} className="bg-[#f3f7fa] text-gray-900 w-full min-w-[700px] max-w-3xl mx-auto font-sans text-sm printable-meter-test p-8 print:min-w-0 print:p-0 print:bg-white flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex items-center gap-4 pb-2">
        <img src="/logo.png" className="h-14 w-auto" alt="BP Waterworks Logo" />
        <div className="flex flex-col">
          <span className="font-black text-gray-900 text-xl tracking-tight leading-none uppercase">BP Waterworks, Inc.</span>
          <span className="text-gray-500 text-xs mt-1">121 Basa Sw, Moor Streed, Phnox, 6804</span>
          <span className="text-gray-500 text-xs">Phone: (912) 234-9833</span>
        </div>
      </div>

      <h2 className="font-black text-2xl tracking-wide text-gray-900 uppercase text-center mt-2 mb-2 print:mb-4">Water Meter Test Results</h2>

      {/* Cards Grid Container */}
      <div className="flex flex-col gap-5 print:gap-4">
        
        {/* Job Information */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm print:shadow-none print:border-gray-300 print:rounded-none print:p-4">
          <h3 className="font-bold text-gray-800 pb-2 mb-4 text-sm uppercase tracking-widest border-b border-gray-100 print:mb-3">Job Information</h3>
          <div className="grid grid-cols-3 gap-6 print:gap-4">
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs font-medium mb-1">Job Order Number</span>
              <span className="font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2 print:border-none print:bg-transparent print:p-0">{data.jobOrderNumber || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs font-medium mb-1">Date of Testing</span>
              <span className="font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2 print:border-none print:bg-transparent print:p-0">{data.date || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs font-medium mb-1">Tested By</span>
              <span className="font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2 print:border-none print:bg-transparent print:p-0">{data.testedBy ? data.testedBy.split(',').map(s => s.split('-')[0].trim()).join(', ') : '-'}</span>
            </div>
          </div>
        </div>

        {/* Customer & Meter Details */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm print:shadow-none print:border-gray-300 print:rounded-none print:p-4">
          <h3 className="font-bold text-gray-800 pb-2 mb-4 text-sm uppercase tracking-widest border-b border-gray-100 print:mb-3">Customer & Meter Details</h3>
          <div className="grid grid-cols-2 gap-6 print:gap-4">
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs font-medium mb-1">Account Number</span>
              <span className="font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2 print:border-none print:bg-transparent print:p-0">{data.accountNumber || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs font-medium mb-1">Account Name</span>
              <span className="font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2 print:border-none print:bg-transparent print:p-0">{data.accountName || '-'}</span>
            </div>
            <div className="flex flex-col col-span-2">
              <span className="text-gray-500 text-xs font-medium mb-1">Project / Address</span>
              <span className="font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2 print:border-none print:bg-transparent print:p-0">{data.projectAddress || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs font-medium mb-1">Meter Brand</span>
              <span className="font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2 print:border-none print:bg-transparent print:p-0">{data.meterBrand || '-'}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-gray-500 text-xs font-medium mb-1">Meter Serial Number</span>
                <span className="font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2 print:border-none print:bg-transparent print:p-0">{data.meterSerialNumber || '-'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500 text-xs font-medium mb-1">Meter Size</span>
                <span className="font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2 print:border-none print:bg-transparent print:p-0">{data.meterSize || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Test Readings */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm print:shadow-none print:border-gray-300 print:rounded-none print:p-4">
          <h3 className="font-bold text-gray-800 pb-2 mb-4 text-sm uppercase tracking-widest border-b border-gray-100 print:mb-3">Test Readings</h3>
          <div className="flex flex-col mb-4">
            <span className="text-gray-500 text-xs font-medium mb-1">Volume of Water</span>
            <div className="bg-[#f0f4f8] border border-gray-200 rounded px-3 py-2 flex justify-between items-center w-1/2 print:border-gray-300 print:bg-transparent print:w-full">
              <span className="font-bold text-gray-900">{data.volumeOfWater || 0}</span>
              <span className="text-gray-500 text-xs font-medium">liters</span>
            </div>
          </div>

          <table className="w-full text-left border-collapse mb-4 mt-2">
            <thead>
              <tr className="bg-[#f0f4f8] print:bg-transparent print:border-b print:border-gray-300">
                <th className="font-semibold text-gray-600 py-2 px-3 text-xs uppercase tracking-wider rounded-tl-lg print:p-0 print:pb-2">Test Point</th>
                <th className="font-semibold text-gray-600 py-2 px-3 text-xs uppercase tracking-wider print:p-0 print:pb-2">Initial Reading</th>
                <th className="font-semibold text-gray-600 py-2 px-3 text-xs uppercase tracking-wider print:p-0 print:pb-2">Final Reading</th>
                <th className="font-semibold text-gray-600 py-2 px-3 text-xs uppercase tracking-wider text-right rounded-tr-lg print:p-0 print:pb-2">% Error</th>
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
                    <td className="py-3 px-3 text-gray-900 font-medium print:px-0">{i + 1}</td>
                    <td className="py-3 px-3 text-gray-900 print:px-0">{hasData ? row.init?.toFixed(4) : ''}</td>
                    <td className="py-3 px-3 text-gray-900 print:px-0">{hasData ? row.final?.toFixed(4) : ''}</td>
                    <td className={`py-3 px-3 font-bold text-right print:px-0 ${hasData && !isErrOk ? 'text-red-600 print:text-black' : hasData ? 'text-green-600 print:text-black' : 'text-gray-400 print:text-black'}`}>
                      {hasData ? (err > 0 ? '+' : '') + err.toFixed(2) + '%' : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-between items-center bg-[#f0f4f8] rounded-lg p-3 border border-gray-200 print:border-none print:bg-transparent print:p-0 print:mt-4">
            <span className="font-bold text-gray-800 text-xs uppercase tracking-wider">Overall Avg Error</span>
            <div className="flex items-center gap-3">
              <span className={`font-black text-lg ${avgErr !== null ? (isToleranceOk ? 'text-green-600 print:text-black' : 'text-red-600 print:text-black') : 'text-gray-900 print:text-black'}`}>
                {avgErr !== null ? (avgErr > 0 ? '+' : '') + avgErr.toFixed(2) + '%' : ''}
              </span>
              {avgErr !== null && (
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${isToleranceOk ? 'bg-green-100 text-green-700 border-green-200 print:border-gray-400 print:text-black' : 'bg-red-100 text-red-700 border-red-200 print:border-gray-400 print:text-black'}`}>
                  {isToleranceOk ? 'Within Tolerance' : 'Out of Tolerance'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Results & Decision */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm print:shadow-none print:border-gray-300 print:rounded-none print:p-4">
          <h3 className="font-bold text-gray-800 pb-2 mb-4 text-sm uppercase tracking-widest border-b border-gray-100 print:mb-3">Results & Decision</h3>
          <div className="space-y-4">
            <div>
              <span className="text-gray-500 text-xs font-medium block mb-2">Testing Results</span>
              <span className={`inline-block px-3 py-1 rounded font-bold text-xs uppercase tracking-widest border ${computedTestingResults === 'Normal' || computedTestingResults === 'Passed' ? 'bg-green-100 text-green-700 border-green-200 print:border-gray-400 print:text-black' : 'bg-red-100 text-red-700 border-red-200 print:border-gray-400 print:text-black'}`}>
                {computedTestingResults}
              </span>
            </div>
            <div>
              <span className="text-gray-500 text-xs font-medium block mb-1">Recommendation</span>
              <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 font-bold text-gray-900 text-sm print:border-gray-300 print:bg-transparent">
                {computedRecommendation}
              </div>
            </div>
            <div>
              <span className="text-gray-500 text-xs font-medium block mb-1">Comments:</span>
              <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-gray-700 text-sm min-h-[60px] print:border-gray-300 print:bg-transparent">
                Test conducted as per standard volumetric procedure.
              </div>
            </div>
          </div>
        </div>

        {/* Sign-Off & Approval */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm print:shadow-none print:border-gray-300 print:rounded-none print:p-4">
          <h3 className="font-bold text-gray-800 pb-2 mb-4 text-sm uppercase tracking-widest border-b border-gray-100 print:mb-3">Sign-Off & Approval</h3>
          
          <div className="flex gap-8 mb-6 print:mb-4">
            <div className="flex items-center gap-2">
              {data.finalDecision === 'Proceed' ? <CheckSquare className="w-5 h-5 text-gray-900" /> : <Square className="w-5 h-5 text-gray-300 print:text-gray-500" />}
              <span className="text-sm font-bold text-gray-700">Proceed</span>
            </div>
            <div className="flex items-center gap-2">
              {data.finalDecision === 'Override: Retain' ? <CheckSquare className="w-5 h-5 text-gray-900" /> : <Square className="w-5 h-5 text-gray-300 print:text-gray-500" />}
              <span className="text-sm font-bold text-gray-700">Override: Retain</span>
            </div>
            <div className="flex items-center gap-2">
              {data.finalDecision === 'RETEST' ? <CheckSquare className="w-5 h-5 text-gray-900" /> : <Square className="w-5 h-5 text-gray-300 print:text-gray-500" />}
              <span className="text-sm font-bold text-gray-700 uppercase">RETEST</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs font-medium mb-1">Witnessed by</span>
              <div className="bg-gray-50 border border-gray-200 rounded px-3 flex items-center h-12 print:border-gray-400 print:bg-transparent">
               {data.witnessSignatureImg ? (
                 <img src={data.witnessSignatureImg} className="max-h-10 max-w-full object-contain" alt="Witness Signature" />
               ) : (
                 <span className="font-bold text-gray-900 text-sm">{data.witnessedBy || 'Customer Signature'}</span>
               )}
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500 text-xs font-medium mb-1">Checked by</span>
              <div className="bg-gray-50 border border-gray-200 rounded px-3 flex items-center h-12 font-bold text-gray-900 text-sm print:border-gray-400 print:bg-transparent">
                {data.checkedBy || 'H. Talavera'}
              </div>
            </div>
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
