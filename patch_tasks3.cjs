const fs = require('fs');
const content = fs.readFileSync('src/views/TasksView.tsx', 'utf8');

const targetStr = `    </div>
  );
}`;

const replaceStr = `
      {/* Hidden PDF Printable Test Area */}
      {reprintData && (
        <div className="hidden print:block">
          <PrintableMeterTest
            data={{
              account: reprintData.details?.testAccountName || reprintData.details?.accountNumber || "",
              date: new Date(reprintData.date).toLocaleDateString(),
              projectAddress: \`\${reprintData.siteOrWell || reprintData.area} \${reprintData.blockLot ? "- " + reprintData.blockLot : ""}\`,
              natureOfTest: reprintData.details?.testNature || "",
              paymentDetails: "",
              meterBrand: reprintData.details?.meterBrand || "",
              meterSerialNumber: reprintData.details?.meterSerialNumber || "",
              volumeOfWater: 30, // 3 x 10
              natureOfMeter: reprintData.details?.meterNature || "",
              reading1_init: Number(reprintData.details?.currentReading || 0),
              reading1_final: Number(reprintData.details?.reading1 || 0),
              reading2_init: Number(reprintData.details?.reading1 || 0),
              reading2_final: Number(reprintData.details?.reading2 || 0),
              reading3_init: Number(reprintData.details?.reading2 || 0),
              reading3_final: Number(reprintData.details?.reading3 || 0),
              error1: (((Number(reprintData.details?.reading1 || 0) - Number(reprintData.details?.currentReading || 0)) / 0.01) - 1) * 100,
              error2: (((Number(reprintData.details?.reading2 || 0) - Number(reprintData.details?.reading1 || 0)) / 0.01) - 1) * 100,
              error3: (((Number(reprintData.details?.reading3 || 0) - Number(reprintData.details?.reading2 || 0)) / 0.01) - 1) * 100,
              avgError: (((Number(reprintData.details?.reading3 || 0) - Number(reprintData.details?.currentReading || 0)) / 0.03) - 1) * 100,
              testingResults:
                (((Number(reprintData.details?.reading3 || 0) - Number(reprintData.details?.currentReading || 0)) / 0.03) - 1) * 100 > 5
                  ? "Fast Moving"
                  : (((Number(reprintData.details?.reading3 || 0) - Number(reprintData.details?.currentReading || 0)) / 0.03) - 1) * 100 < -5
                    ? "Slow Moving"
                    : "Passed",
              recommendation:
                Math.abs((((Number(reprintData.details?.reading3 || 0) - Number(reprintData.details?.currentReading || 0)) / 0.03) - 1) * 100) > 5
                  ? "Replace"
                  : "Retain",
              testedBy: (reprintData.staff || []).join(", "),
              witnessedBy: reprintData.details?.witnessedBy || "",
              witnessSignatureImg: reprintData.details?.witnessSignature || undefined,
              checkedBy: "HERNAN TALAVERA",
              finalDecision: "",
            }}
            ref={printRef}
          />
        </div>
      )}
    </div>
  );
}`;

fs.writeFileSync('src/views/TasksView.tsx', content.replace(targetStr, replaceStr));
