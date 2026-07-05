const fs = require('fs');
let code = fs.readFileSync('src/views/MeterQALogsView.tsx', 'utf8');

code = code.replace(
  /setActiveJobId\(log.id\);\s*setCurrentView\('tasks'\);/g,
  `dispatchAction('VIEW_TASK', { jobId: log.id });`
);

fs.writeFileSync('src/views/MeterQALogsView.tsx', code);
