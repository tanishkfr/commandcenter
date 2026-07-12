const fs = require('fs');
let code = fs.readFileSync('src/components/CommandPalette.tsx', 'utf8');

code = code.replace(
  "function HistoryItem({ item, onUndo, isUndoing }: { item: any, onUndo: (id: string) => void | Promise<void>, isUndoing: boolean }) {",
  "function HistoryItem({ item, onUndo, isUndoing }: { key?: React.Key | number, item: any, onUndo: (id: string) => void | Promise<void>, isUndoing: boolean }) {"
);

fs.writeFileSync('src/components/CommandPalette.tsx', code);
