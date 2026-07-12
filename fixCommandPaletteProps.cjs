const fs = require('fs');
let code = fs.readFileSync('src/components/CommandPalette.tsx', 'utf8');

code = code.replace(
  'onUndo: (id: string) => void',
  'onUndo: (id: string) => void | Promise<void>'
);

fs.writeFileSync('src/components/CommandPalette.tsx', code);
