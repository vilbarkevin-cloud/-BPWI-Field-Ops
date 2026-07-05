const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');
code = code.replace(/server: \{\n      hmr: false,\n      watch: null,\n    \},\n    \},/g, 'server: {\n      hmr: false,\n      watch: null,\n    }\n');
fs.writeFileSync('vite.config.ts', code);
