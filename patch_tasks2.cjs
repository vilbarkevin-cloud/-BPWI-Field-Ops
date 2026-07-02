const fs = require('fs');
const content = fs.readFileSync('src/views/TasksView.tsx', 'utf8');

const targetStr = `                  <div className="flex flex-col gap-1 mt-4">`;
const replaceStr = `                  <div className="flex items-center justify-between mt-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-primary font-semibold">
                        <CheckCircle2 className="w-5 h-5" />
                        Done
                      </div>
                      {task.completedAt && (
                        <div className="text-xs text-on-surface-variant flex items-center gap-1.5 ml-7">
                          <Clock className="w-3.5 h-3.5" />
                          Completed by <span className="font-medium text-on-surface">{task.updatedBy || task.assignedTo || "User"}</span> at {
                            new Date(task.completedAt).toLocaleString(undefined, { 
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                            })
                          }
                        </div>
                      )}
                    </div>
                    {task.linkedActivity === 'meter_test' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReprintTask(task);
                        }}
                        className="btn-primary text-xs px-3 py-1"
                      >
                        Reprint Form
                      </button>
                    )}
                  </div>`;

// First remove the old div content
const startIdx = content.indexOf('                  <div className="flex flex-col gap-1 mt-4">');
if (startIdx !== -1) {
  const endIdx = content.indexOf('                  </div>\n                </div>\n              )}\n            </div>', startIdx);
  if (endIdx !== -1) {
     const toReplace = content.substring(startIdx, endIdx + 24);
     fs.writeFileSync('src/views/TasksView.tsx', content.replace(toReplace, replaceStr));
  } else {
     console.log('endIdx not found');
  }
} else {
  console.log('startIdx not found');
}
