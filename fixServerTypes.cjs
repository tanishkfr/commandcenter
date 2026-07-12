const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  "return { success: false, reason: (parseResult as any).reason, options: (parseResult as any).options, status: 400 };",
  "const pr: any = parseResult;\n      return { success: false, reason: pr.reason, options: pr.options, status: 400 };"
);
fs.writeFileSync('server.ts', code);
