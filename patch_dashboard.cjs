const fs = require('fs');
let code = fs.readFileSync('src/views/DashboardView.tsx', 'utf8');

code = code.replace(
  /onClick=\{\(\) => \{\s*if \(log\.rawType === 'meter_test'\) \{\s*setCurrentView\('meter_qa_logs'\);\s*setActiveJobId\(log\.rawId\);\s*\} else if \(log\.type === 'task'\) \{\s*setCurrentView\('tasks'\);\s*setActiveJobId\(log\.rawId\);\s*\} else if \(log\.type === 'incident'\) \{\s*setCurrentView\('incidents'\);\s*setActiveJobId\(log\.rawId\);\s*\} else if \(log\.type === 'activity' \|\| log\.type === 'chlorination'\) \{\s*setCurrentView\('activity'\);\s*setActiveJobId\(log\.rawId\);\s*\}\s*\}\}/g,
  `onClick={() => {
                      if (log.rawType === 'meter_test') {
                        dispatchAction('VIEW_METER_QA', { jobId: log.rawId });
                      } else if (log.type === 'task') {
                        dispatchAction('VIEW_TASK', { jobId: log.rawId });
                      } else if (log.type === 'incident') {
                        dispatchAction('CREATE_INCIDENT', { jobId: log.rawId });
                      } else if (log.type === 'activity' || log.type === 'chlorination') {
                        dispatchAction('EDIT_ACTIVITY', { jobId: log.rawId });
                      }
                    }}`
);

fs.writeFileSync('src/views/DashboardView.tsx', code);
