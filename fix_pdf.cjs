const fs = require('fs');

const files = [
  'src/views/TasksView.tsx',
  'src/views/ActivityView.tsx',
  'src/views/TripTicketView.tsx',
  'src/views/DashboardView.tsx',
  'src/components/BillingForm.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    content = content.replace(
      /const canvas = await html2canvas\(/g,
      `const html2canvasFunc = typeof html2canvas === 'function' ? html2canvas : (html2canvas as any).default;\n          const canvas = await html2canvasFunc(`
    );
    
    content = content.replace(
      /const pdf = new jsPDF\(/g,
      `const jsPDFFunc = typeof jsPDF === 'function' ? jsPDF : (jsPDF as any).jsPDF || (jsPDF as any).default;\n          const pdf = new jsPDFFunc(`
    );
    
    fs.writeFileSync(file, content);
    console.log("Patched", file);
  }
});
