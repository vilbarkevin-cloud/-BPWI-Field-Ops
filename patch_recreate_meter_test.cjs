const fs = require('fs');

const content = `import React, { forwardRef } from 'react';
import { Droplet } from 'lucide-react';

export interface MeterTestData {
  account: string;
  date: string;
  projectAddress: string;
  natureOfTest: string;
  paymentDetails?: string;
  meterBrand: string;
  meterSerialNumber?: string;
  volumeOfWater: number; // usually 30 liters
  linePressure?: number;
  natureOfMeter: string; // Old, New
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
  testingResults: string; // Fast Moving, Slow Moving, Passed
  recommendation: string; // Replace, Retain
  testedBy: string;
  witnessedBy: string;
  witnessSignatureImg?: string;
  checkedBy: string;
  finalDecision: string; // Proceed, Override: Retain, RETEST
}

export const PrintableMeterTest = forwardRef<HTMLDivElement, { data: MeterTestData }>(({ data }, ref) => {
  return (
    <div ref={ref} className="p-8 bg-white text-black max-w-4xl mx-auto font-sans text-sm printable-meter-test border border-gray-200 print:border-none my-8">
      <div className="flex flex-col items-center justify-center border-b-[3px] border-black pb-6 mb-6 text-center">
        <div className="w-20 h-20 bg-blue-500 text-white flex items-center justify-center font-bold text-xl rounded-full mb-3 print:border-black print:border-2">
           <Droplet className="w-12 h-12" strokeWidth={2} />
        </div>
        <h1 className="text-3xl font-black tracking-wider uppercase mb-1">BP Waterworks, Inc.</h1>
        <p className="text-sm font-medium">Unit 3B-5B, 2nd Floor, 5J's Commercial Bldg., Zone 7</p>
        <p className="text-sm font-medium">Road 8, Don Julio Subd., Brgy. Aganan, Pavia, Iloilo</p>
        <p className="text-sm font-medium mt-1">Tel. (0905) 300-4368 / 338-2853</p>
      </div>
      
      <h2 className="text-center font-bold text-lg mb-4 underline uppercase">WATERMETER TEST RESULTS</h2>

      <table className="w-full border-collapse border-[3px] border-black mb-6 text-sm">
        <tbody>
          <tr>
            <td className="border border-black p-3 font-semibold w-1/4">Account:</td>
            <td className="border border-black p-3 w-1/4">{data.account}</td>
            <td className="border border-black p-3 w-1/4 font-semibold">Date:</td>
            <td className="border border-black p-3 w-1/4 text-right">{data.date}</td>
          </tr>
          <tr>
            <td className="border border-black p-3" colSpan={2} rowSpan={2}>
              <span className="font-semibold block mb-1">Project/Address:</span>
              <div className="text-center mt-2">{data.projectAddress}</div>
            </td>
            <td className="border border-black p-3 font-semibold">Nature of Test:</td>
            <td className="border border-black p-3 text-center">{data.natureOfTest}</td>
          </tr>
          <tr>
            <td className="border border-black p-3 align-top h-20" colSpan={2} rowSpan={5}>
              <span className="font-semibold block mb-1">Comments:</span>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-3 font-semibold">Payment Details:</td>
            <td className="border border-black p-3">{data.paymentDetails}</td>
          </tr>
          <tr>
            <td className="border border-black p-3 font-semibold">Meter Brand / SN:</td>
            <td className="border border-black p-3 text-center">{data.meterBrand} {data.meterSerialNumber ? \`/ \${data.meterSerialNumber}\` : ""}</td>
          </tr>
          <tr>
            <td className="border border-black p-3 font-semibold">Volume of Water:</td>
            <td className="border border-black p-3 text-center">{data.volumeOfWater} liters</td>
          </tr>
          <tr>
            <td className="border border-black p-3 font-semibold">Line Pressure:</td>
            <td className="border border-black p-3 text-center">{data.linePressure !== undefined ? \`\${data.linePressure} psi\` : "N/A"}</td>
          </tr>
          <tr>
            <td className="border border-black p-3 font-semibold">Nature of Meter:</td>
            <td className="border border-black p-3 text-center">{data.natureOfMeter}</td>
            <td className="border border-black p-3 font-semibold align-top h-24 relative min-h-[150px]" colSpan={2} rowSpan={2}>
              Witnessed by:
              {data.witnessSignatureImg ? (
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-2 mt-4">
                  <img src={data.witnessSignatureImg} alt="Signature" className="max-h-[80px]" />
                  <div className="text-center uppercase font-bold border-t border-black w-3/4 mx-auto pt-1 leading-none text-xs">{data.witnessedBy}</div>
                </div>
              ) : (
                <div className="absolute bottom-2 left-0 right-0 text-center uppercase font-bold border-t border-black w-3/4 mx-auto pt-1">{data.witnessedBy}</div>
              )}
            </td>
          </tr>
          <tr>
            <td className="border border-black p-0" colSpan={2}>
              <table className="w-full h-full text-center">
                <thead>
                  <tr className="bg-gray-100">
                    <th colSpan={3} className="border-b-2 border-black p-3 font-bold uppercase tracking-wider text-base">Normal Flow</th>
                  </tr>
                  <tr className="bg-gray-100">
                    <th colSpan={2} className="border-b-2 border-black p-2 font-bold border-r-2 border-black">Reading</th>
                    <th className="border-b-2 border-black p-2 font-bold">% Error</th>
                  </tr>
                  <tr className="bg-gray-50">
                    <th className="border-b-2 border-black p-2 font-semibold border-r-2 border-black w-1/3">Initial</th>
                    <th className="border-b-2 border-black p-2 font-semibold border-r-2 border-black w-1/3">Final</th>
                    <th className="border-b-2 border-black p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { init: data.reading1_init, final: data.reading1_final },
                    { init: data.reading2_init, final: data.reading2_final },
                    { init: data.reading3_init, final: data.reading3_final },
                  ].map((row, i) => {
                    const hasData = typeof row.init === 'number' && row.init > 0 && typeof row.final === 'number' && row.final > 0;
                    const testVolCubicMeters = (data.volumeOfWater / 3) / 1000;
                    let err = 0;
                    if (hasData && testVolCubicMeters > 0) {
                      const registeredVol = row.final - row.init;
                      err = ((registeredVol - testVolCubicMeters) / testVolCubicMeters) * 100;
                    }
                    return (
                      <tr key={i}>
                         <td className="border-b border-black p-2 border-r-2 border-black text-base">{hasData ? row.init.toFixed(4) : ''}</td>
                         <td className="border-b border-black p-2 border-r-2 border-black text-base">{hasData ? row.final.toFixed(4) : ''}</td>
                         <td className={\`border-b border-black p-2 font-bold text-base \${hasData && Math.abs(err) > 5 ? 'text-red-600' : ''}\`}>
                           {hasData ? (err > 0 ? '+' : '') + err.toFixed(2) + '%' : ''}
                         </td>
                      </tr>
                    );
                  })}
                  <tr>
                     <td colSpan={2} className="border-r-2 border-black p-2 bg-gray-50 font-semibold text-right pr-4">Average % Error:</td>
                     <td className="p-2 font-bold text-lg">
                       {(() => {
                         const rows = [
                           { init: data.reading1_init, final: data.reading1_final },
                           { init: data.reading2_init, final: data.reading2_final },
                           { init: data.reading3_init, final: data.reading3_final },
                         ];
                         let totalRegistered = 0;
                         let validCount = 0;
                         const testVolCubicMeters = (data.volumeOfWater / 3) / 1000;
                         rows.forEach(r => {
                           if (typeof r.init === 'number' && r.init > 0 && typeof r.final === 'number' && r.final > 0) {
                             totalRegistered += (r.final - r.init);
                             validCount++;
                           }
                         });
                         if (validCount === 0 || testVolCubicMeters === 0) return 'N/A';
                         const totalActual = testVolCubicMeters * validCount;
                         const avgErr = ((totalRegistered - totalActual) / totalActual) * 100;
                         return <span className={Math.abs(avgErr) > 5 ? 'text-red-600' : ''}>{(avgErr > 0 ? '+' : '') + avgErr.toFixed(2) + '%'}</span>;
                       })()}
                     </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-3 font-semibold align-top min-h-[120px]" colSpan={2}>
              Checked by:
              <div className="mt-16 text-center uppercase tracking-wider font-bold border-t border-black w-3/4 mx-auto pt-1">{data.checkedBy || 'HERNAN TALAVERA'}</div>
            </td>
            <td className="border border-black p-3 font-semibold" colSpan={2} rowSpan={4}>
              Final Decision
              <div className="mt-2 space-y-1 ml-4">
                 <label className="flex flex-row items-center gap-2"><div className={\`w-4 h-4 border border-black flex items-center justify-center\`}>{data.finalDecision === 'Proceed' ? '✓' : ''}</div> Proceed</label>
                 <label className="flex flex-row items-center gap-2"><div className={\`w-4 h-4 border border-black flex items-center justify-center\`}>{data.finalDecision === 'Override: Retain' ? '✓' : ''}</div> Override: Retain</label>
                 <label className="flex flex-row items-center gap-2"><div className={\`w-4 h-4 border border-black flex items-center justify-center\`}>{data.finalDecision === 'RETEST' ? '✓' : ''}</div> RETEST</label>
              </div>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-3 font-semibold">Testing Results:</td>
            <td className="border border-black p-3 text-center font-bold">{data.testingResults}</td>
          </tr>
          <tr>
            <td className="border border-black p-3 font-semibold">Recommendation:</td>
            <td className="border border-black p-3 text-center font-bold">{data.recommendation}</td>
          </tr>
          <tr>
            <td className="border border-black p-3 font-semibold align-top min-h-[120px]">Tested by:</td>
            <td className="border border-black p-3 text-center align-bottom pb-2">
               <div className="mt-16 text-center uppercase tracking-wider font-bold border-t border-black w-3/4 mx-auto pt-1">{data.testedBy}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <style dangerouslySetInnerHTML={{__html: \`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-meter-test, .printable-meter-test * {
            visibility: visible;
          }
          .printable-meter-test {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .text-red-500 {
            color: #ef4444 !important;
          }
          .text-red-600 {
            color: #dc2626 !important;
          }
        }
      \`}} />
    </div>
  );
});
`;

fs.writeFileSync('src/components/PrintableMeterTest.tsx', content);
