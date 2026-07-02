const fs = require('fs');

const content = fs.readFileSync('src/components/PrintableMeterTest.tsx', 'utf8');

// We want to calculate testingResults and recommendation instead of relying on props
// testingResults: (avgErr > 5) ? 'Fast Moving' : (avgErr < -5) ? 'Slow Moving' : 'Passed'
// recommendation: (Math.abs(avgErr) > 5) ? 'Replace' : 'Retain'

// Let's replace the whole file with a version that does this correctly at the top of the component.
let newContent = content.replace(
  /export const PrintableMeterTest = forwardRef<HTMLDivElement, \{ data: MeterTestData \}>\(\(\{ data \}, ref\) => \{/,
  `export const PrintableMeterTest = forwardRef<HTMLDivElement, { data: MeterTestData }>(({ data }, ref) => {
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
  
  let avgErr: number | null = null;
  if (validCount > 0 && testVolCubicMeters > 0) {
    const totalActual = testVolCubicMeters * validCount;
    avgErr = ((totalRegistered - totalActual) / totalActual) * 100;
  }

  const computedTestingResults = avgErr !== null 
    ? (avgErr > 5 ? 'Fast Moving' : avgErr < -5 ? 'Slow Moving' : 'Passed')
    : data.testingResults;

  const computedRecommendation = avgErr !== null
    ? (Math.abs(avgErr) > 5 ? 'Replace' : 'Retain')
    : data.recommendation;`
);

// Now update the table rows map
newContent = newContent.replace(
  /{\(\(\) => \{[\s\S]*?\}\)\(\)}/g,
  `{avgErr !== null ? <span className={Math.abs(avgErr) > 5 ? 'text-red-600' : ''}>{(avgErr > 0 ? '+' : '') + avgErr.toFixed(2) + '%'}</span> : 'N/A'}`
);

// Update testing results and recommendation rendering
newContent = newContent.replace(
  /<td className="border border-black p-3 text-center font-bold">\{data\.testingResults\}<\/td>/g,
  `<td className="border border-black p-3 text-center font-bold">
               <div className={\`inline-block px-3 py-1 rounded \${computedTestingResults === 'Passed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}\`}>
                 {computedTestingResults}
               </div>
            </td>`
);

newContent = newContent.replace(
  /<td className="border border-black p-3 text-center font-bold">\{data\.recommendation\}<\/td>/g,
  `<td className="border border-black p-3 text-center font-bold">
               <div className={\`inline-block px-3 py-1 rounded \${computedRecommendation === 'Retain' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}\`}>
                 {computedRecommendation}
               </div>
            </td>`
);

fs.writeFileSync('src/components/PrintableMeterTest.tsx', newContent);
