const fs = require('fs');

let pal = fs.readFileSync('src/components/CommandPalette.tsx', 'utf8');
pal = pal.replace("key?: React.Key | number", "key?: string | number");
fs.writeFileSync('src/components/CommandPalette.tsx', pal);

let test = fs.readFileSync('src/lib/aiGateway.test.ts', 'utf8');
test = test.replace(/const todoRes = aiGateway/g, "const todoRes = await aiGateway");
test = test.replace(/const p2Res = aiGateway/g, "const p2Res = await aiGateway");
fs.writeFileSync('src/lib/aiGateway.test.ts', test);
