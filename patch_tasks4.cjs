const fs = require('fs');
let content = fs.readFileSync('src/views/TasksView.tsx', 'utf8');

const lines = content.split('\n');
let fixedLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('task.linkedActivity === \'meter_test\'')) {
     if (lines[i].includes('task.title.toLowerCase().includes(')) {
        fixedLines.push("                    {(task.linkedActivity === 'meter_test' || (task.title && task.title.toLowerCase().includes('meter test'))) && (");
     } else {
        fixedLines.push(lines[i]);
     }
  } else {
     fixedLines.push(lines[i]);
  }
}
fs.writeFileSync('src/views/TasksView.tsx', fixedLines.join('\n'));
