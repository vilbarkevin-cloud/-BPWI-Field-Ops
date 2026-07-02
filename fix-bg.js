const fs = require('fs');

const files = [
  'src/views/DashboardView.tsx',
  'src/views/ChlorinationView.tsx',
  'src/views/InventoryView.tsx',
  'src/views/IncidentsView.tsx',
  'src/views/ManpowerCalendarView.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/\bbg-white\b(?!\/)/g, 'bg-surface');
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
