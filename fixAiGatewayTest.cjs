const fs = require('fs');
let code = fs.readFileSync('src/lib/aiGateway.test.ts', 'utf8');

code = code.replace(/beforeEach\(\(\) => \{/g, 'beforeEach(async () => {');
code = code.replace(/const res = aiGateway.createProject/g, 'const res = await aiGateway.createProject');

code = code.replace(/afterEach\(\(\) => \{/g, 'afterEach(async () => {');
code = code.replace(/aiGateway.deleteProject/g, 'await aiGateway.deleteProject');

code = code.replace(/it\('([^']+)', \(\) => \{/g, "it('$1', async () => {");
code = code.replace(/const res = aiGateway\./g, 'const res = await aiGateway.');
code = code.replace(/const res2 = aiGateway\./g, 'const res2 = await aiGateway.');

fs.writeFileSync('src/lib/aiGateway.test.ts', code);
