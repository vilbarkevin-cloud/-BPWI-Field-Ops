const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');
code = code.replace(/server: \{[\s\S]*?\}/, 'server: {\n      hmr: false,\n      watch: null,\n    }');
fs.writeFileSync('vite.config.ts', code);
