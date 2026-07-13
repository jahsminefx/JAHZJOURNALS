const fs = require('fs');
const path = require('path');

const replacements = {
  // Backgrounds
  'bg-gray-950': 'bg-white dark:bg-gray-950',
  'bg-slate-950': 'bg-white dark:bg-slate-950',
  'bg-gray-900': 'bg-gray-50 dark:bg-gray-900',
  'bg-slate-900': 'bg-slate-50 dark:bg-slate-900',
  'bg-gray-800': 'bg-white dark:bg-gray-800',
  'bg-slate-800': 'bg-white dark:bg-slate-800',
  
  // Borders
  'border-gray-800': 'border-gray-200 dark:border-gray-800',
  'border-slate-800': 'border-slate-200 dark:border-slate-800',
  'border-gray-700': 'border-gray-200 dark:border-gray-700',
  'border-slate-700': 'border-slate-200 dark:border-slate-700',

  // Text
  'text-gray-100': 'text-gray-900 dark:text-gray-100',
  'text-slate-100': 'text-slate-900 dark:text-slate-100',
  'text-gray-200': 'text-gray-800 dark:text-gray-200',
  'text-gray-300': 'text-gray-700 dark:text-gray-300',
  'text-gray-400': 'text-gray-600 dark:text-gray-400',
  'text-gray-500': 'text-gray-500 dark:text-gray-400',
  
  // Form Inputs specific tweaks inside Settings
  'bg-gray-950 text-gray-100': 'bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100',
  
  // Hovers
  'hover:bg-gray-700': 'hover:bg-gray-100 dark:hover:bg-gray-700',
  'hover:bg-gray-800': 'hover:bg-gray-100 dark:hover:bg-gray-800',
  'hover:border-gray-600': 'hover:border-gray-300 dark:hover:border-gray-600',
  'hover:text-gray-100': 'hover:text-gray-900 dark:hover:text-gray-100',
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  for (const [key, value] of Object.entries(replacements)) {
    // Avoid double replacements (e.g., if "dark:bg-gray-900" is already there, don't replace "bg-gray-900")
    if (key.includes(' ')) {
      // For multi-word keys just do standard replace if it isn't preceded by dark:
      content = content.split(key).join(value);
      continue;
    }

    const isHover = key.startsWith('hover:');
    const regexStr = isHover 
       ? `(?<!dark:)(?<=[\\s"'\\\`])${key}(?=[\\s"'\\\`])` 
       : `(?<!dark:)(?<!hover:)(?<=[\\s"'\\\`])${key}(?=[\\s"'\\\`])`;
       
    const regex = new RegExp(regexStr, 'g');
    content = content.replace(regex, value);
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

walkDir(path.join(__dirname, 'client', 'src', 'pages'));
walkDir(path.join(__dirname, 'client', 'src', 'components'));
console.log('Class mapping complete. Review changes in git.');
