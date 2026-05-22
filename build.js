const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

// Ensure dist directory exists and is empty
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
} else {
  // Clean existing files in dist
  const existingFiles = fs.readdirSync(distDir);
  existingFiles.forEach(file => {
    fs.unlinkSync(path.join(distDir, file));
  });
}

// Files to copy to the final deployment build output
const filesToCopy = [
  'index.html',
  'styles.css',
  'gravity-engine.js',
  'app.js',
  'app.module.js',
  'app.controller.js',
  'app.directive.js'
];

filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Successfully compiled: ${file} -> dist/${file}`);
  } else {
    console.warn(`Warning: Source file ${file} was not found.`);
  }
});

console.log('🎉 Build completed successfully! Ready for Vercel deployment.');
