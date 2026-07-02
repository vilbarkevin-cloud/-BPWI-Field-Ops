const fs = require('fs');

let content = fs.readFileSync('src/components/PrintableMeterTest.tsx', 'utf8');

// Replace the BPWI Header to be centered, bolded, formal letterhead
content = content.replace(
  /<div className="flex items-center gap-4 border-b-2 border-black pb-4 mb-4">[\s\S]*?<\/div>/,
  `<div className="flex flex-col items-center justify-center border-b-[3px] border-black pb-6 mb-6 text-center">
        <div className="w-20 h-20 bg-blue-500 text-white flex items-center justify-center font-bold text-xl rounded-full mb-3 print:border-black print:border-2">
           <Droplet className="w-12 h-12" strokeWidth={2} />
        </div>
        <h1 className="text-3xl font-black tracking-wider uppercase mb-1">BP Waterworks, Inc.</h1>
        <p className="text-sm font-medium">Unit 3B-5B, 2nd Floor, 5J's Commercial Bldg., Zone 7</p>
        <p className="text-sm font-medium">Road 8, Don Julio Subd., Brgy. Aganan, Pavia, Iloilo</p>
        <p className="text-sm font-medium mt-1">Tel. (0905) 300-4368 / 338-2853</p>
      </div>`
);

// Thicker outer borders for the table: border-2 border-black
content = content.replace(
  /<table className="w-full border-collapse border border-black mb-4">/,
  `<table className="w-full border-collapse border-[3px] border-black mb-6 text-sm">`
);

// Update table rows rendering logic
const tableRowsRegex = /<table className="w-full h-full text-center">[\s\S]*?<\/table>/;

const newTableHtml = `<table className="w-full h-full text-center">
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
                    { init: data.reading1_init, final: data.reading1_final, err: data.error1 },
                    { init: data.reading2_init, final: data.reading2_final, err: data.error2 },
                    { init: data.reading3_init, final: data.reading3_final, err: data.error3 },
                  ].map((row, i) => {
                    const hasData = row.init > 0 && row.final > 0;
                    return (
                      <tr key={i}>
                         <td className="border-b border-black p-2 border-r-2 border-black text-base">{hasData ? row.init.toFixed(4) : ''}</td>
                         <td className="border-b border-black p-2 border-r-2 border-black text-base">{hasData ? row.final.toFixed(4) : ''}</td>
                         <td className={\`border-b border-black p-2 font-bold text-base \${hasData && Math.abs(row.err) > 5 ? 'text-red-600' : ''}\`}>
                           {hasData ? (row.err > 0 ? '+' : '') + row.err.toFixed(2) + '%' : ''}
                         </td>
                      </tr>
                    );
                  })}
                  <tr>
                     <td colSpan={2} className="border-r-2 border-black p-2 bg-gray-50 font-semibold text-right pr-4">Average % Error:</td>
                     <td className={\`p-2 font-bold text-lg \${Math.abs(data.avgError) > 5 ? 'text-red-600' : ''}\`}>
                       {data.reading3_init > 0 && data.reading3_final > 0 ? ((data.avgError > 0 ? '+' : '') + data.avgError.toFixed(2) + '%') : 'N/A'}
                     </td>
                  </tr>
                </tbody>
              </table>`;

content = content.replace(tableRowsRegex, newTableHtml);

// Make other cells thicker borders if we want, but border-black is fine, let's just make sure signature blocks are taller
content = content.replace(
  /<td className="border border-black p-2 font-semibold" colSpan={2}>\s*Checked by:\s*<div className="mt-8 text-center uppercase tracking-wider">\{data\.checkedBy \|\| 'HERNAN TALAVERA'\}<\/div>\s*<\/td>/,
  `<td className="border border-black p-3 font-semibold align-top min-h-[120px]" colSpan={2}>
              Checked by:
              <div className="mt-16 text-center uppercase tracking-wider font-bold border-t border-black w-3/4 mx-auto pt-1">{data.checkedBy || 'HERNAN TALAVERA'}</div>
            </td>`
);

content = content.replace(
  /<td className="border border-black p-2 font-semibold align-top h-16">Tested by:<\/td>\s*<td className="border border-black p-2 text-center align-middle">\{data\.testedBy\}<\/td>/,
  `<td className="border border-black p-3 font-semibold align-top min-h-[120px]">Tested by:</td>
            <td className="border border-black p-3 text-center align-bottom pb-2">
               <div className="mt-16 text-center uppercase tracking-wider font-bold border-t border-black w-3/4 mx-auto pt-1">{data.testedBy}</div>
            </td>`
);

content = content.replace(
  /<td className="border border-black p-2 font-semibold align-top h-24 relative" colSpan={2} rowSpan={2}>\s*Witnessed by:\s*\{data\.witnessSignatureImg \? \([\s\S]*?\) : \(\s*<div className="mt-8 text-center italic border-b border-black w-3\/4 mx-auto pb-1">\{data\.witnessedBy\}<\/div>\s*\)\}\s*<\/td>/,
  `<td className="border border-black p-3 font-semibold align-top min-h-[150px] relative" colSpan={2} rowSpan={2}>
              Witnessed by:
              {data.witnessSignatureImg ? (
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-2 mt-4">
                  <img src={data.witnessSignatureImg} alt="Signature" className="max-h-[80px]" />
                  <div className="text-center uppercase font-bold border-t border-black w-3/4 mx-auto pt-1 leading-none text-xs">{data.witnessedBy}</div>
                </div>
              ) : (
                <div className="absolute bottom-2 left-0 right-0 text-center uppercase font-bold border-t border-black w-3/4 mx-auto pt-1">{data.witnessedBy}</div>
              )}
            </td>`
);

// Cell padding adjustments for other cells
content = content.replace(/className="border border-black p-2/g, 'className="border border-black p-3');

fs.writeFileSync('src/components/PrintableMeterTest.tsx', content);
