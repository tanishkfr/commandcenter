const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'return { success: false, reason: parseResult.reason, options: parseResult.options, status: 400 };',
  'return { success: false, reason: (parseResult as any).reason, options: (parseResult as any).options, status: 400 };'
);

code = code.replace(
  'command: inputCommand',
  'command: inputCommandString'
);

fs.writeFileSync('server.ts', code);
