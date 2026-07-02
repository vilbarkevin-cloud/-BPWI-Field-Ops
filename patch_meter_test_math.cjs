const fs = require('fs');

let content = fs.readFileSync('src/components/PrintableMeterTest.tsx', 'utf8');

// Update the table body math
const oldBodyRegex = /<tbody>[\s\S]*?<\/tbody>/;

const newBodyHtml = `<tbody>
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
                </tbody>`;

content = content.replace(oldBodyRegex, newBodyHtml);

fs.writeFileSync('src/components/PrintableMeterTest.tsx', content);
