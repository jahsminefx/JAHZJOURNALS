const fs = require('fs');
const path = require('path');

const replacements = {
  // 1. Strip out the dual classes I added previously so we can just target base forms
  'bg-white dark:bg-gray-950': 'bg-background',
  'bg-white dark:bg-slate-950': 'bg-background',
  'bg-gray-50 dark:bg-gray-900': 'bg-surface',
  'bg-slate-50 dark:bg-slate-900': 'bg-surface',
  'bg-white dark:bg-gray-800': 'bg-surface-muted',
  'bg-white dark:bg-slate-800': 'bg-surface-muted',

  'border-gray-200 dark:border-gray-800': 'border-border',
  'border-slate-200 dark:border-slate-800': 'border-border',
  'border-gray-200 dark:border-gray-700': 'border-border',
  'border-slate-200 dark:border-slate-700': 'border-border',
  'border-gray-200 dark:border-slate-800': 'border-border',

  'text-gray-900 dark:text-gray-100': 'text-foreground',
  'text-slate-900 dark:text-slate-100': 'text-foreground',
  'text-gray-800 dark:text-gray-200': 'text-foreground',
  'text-gray-700 dark:text-gray-300': 'text-muted',
  'text-gray-600 dark:text-gray-400': 'text-muted',
  'text-gray-500 dark:text-gray-400': 'text-muted',

  'bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100': 'bg-background text-foreground',

  'hover:bg-gray-100 dark:hover:bg-gray-700': 'hover:bg-surface-muted',
  'hover:bg-gray-100 dark:hover:bg-gray-800': 'hover:bg-surface-muted',
  'hover:border-gray-300 dark:hover:border-gray-600': 'hover:border-foreground/20',

  // 2. Map standard original unauthenticated files (public landing pages etc)
  'bg-gray-950': 'bg-background',
  'bg-slate-950': 'bg-background',
  'bg-gray-900': 'bg-surface',
  'bg-slate-900': 'bg-surface',
  'bg-gray-800': 'bg-surface-muted',
  'bg-slate-800': 'bg-surface-muted',

  'border-gray-800': 'border-border',
  'border-slate-800': 'border-border',
  'border-gray-700': 'border-border',
  'border-slate-700': 'border-border',

  'text-gray-100': 'text-foreground',
  'text-slate-100': 'text-foreground',
  'text-gray-300': 'text-muted',
  'text-gray-400': 'text-muted'
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  for (const [key, value] of Object.entries(replacements)) {
    content = content.split(key).join(value);
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      processFile(fullPath);
    }
  }
}

walkDir(path.join(__dirname, 'src', 'pages'));
walkDir(path.join(__dirname, 'src', 'components'));
console.log('Semantic Token injection complete.');
