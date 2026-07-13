const fs = require('fs');
const path = require('path');

const replacements = {
  "stroke=\"#1f2937\"": "stroke=\"rgb(var(--border))\"",
  "stroke=\"#94a3b8\"": "stroke=\"rgb(var(--muted-foreground))\"",
  "fill: '#94a3b8'": "fill: 'rgb(var(--muted-foreground))'",
  "background: '#020617'": "background: 'rgb(var(--surface))'",
  "border: '1px solid #1e293b'": "border: '1px solid rgb(var(--border))'",
  "color: '#e2e8f0'": "color: 'rgb(var(--foreground))'",
  "stroke=\"#020617\"": "stroke=\"rgb(var(--background))\"",
  "stroke=\"#ecfdf5\"": "stroke=\"rgb(var(--background))\"",
  "text-white": "text-foreground",
  "text-slate-400": "text-muted",
  "text-slate-300": "text-foreground",
  "text-slate-500": "text-muted",
  "bg-background/40": "bg-surface-muted",
  "bg-background/70": "bg-surface",
  "bg-background/90": "bg-surface",
  "shadow-inner": ""
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

walkDir(path.join(__dirname, 'src', 'components', 'dashboard'));
walkDir(path.join(__dirname, 'src', 'pages'));
