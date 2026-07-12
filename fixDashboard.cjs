const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

if (!code.includes('setContext')) {
  code = code.replace(
    'const [time, setTime] = useState(new Date());',
    'const [time, setTime] = useState(new Date());\n  const [context, setContext] = useState<any>({});'
  );
}

fs.writeFileSync('src/components/Dashboard.tsx', code);
