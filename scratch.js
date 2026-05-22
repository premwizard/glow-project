const fs = require('fs');
const path = require('path');

const contentPath = `C:\\Users\\ASUS\\.gemini\\antigravity-ide\\brain\\72f809d7-c69c-44d3-bad1-ef301e1c9ec3\\.system_generated\\steps\\19\\content.md`;

try {
  const content = fs.readFileSync(contentPath, 'utf8');
  console.log('JS Loaded.');

  // 1. Extract h7 (changelog data)
  const targetStr = 'var h7=';
  const index = content.indexOf(targetStr);
  if (index !== -1) {
    const chunk = content.substring(index, index + 6000);
    fs.writeFileSync(path.join(__dirname, 'h7_extracted.txt'), chunk, 'utf8');
    console.log('Changelog h7 extracted and written to h7_extracted.txt');
  } else {
    console.log('var h7= not found');
  }

  // 2. Search for google-io-2026 to see blog details
  let blogIdx = 0;
  let blogCount = 0;
  let blogOutput = '';
  while ((blogIdx = content.indexOf('google-io-2026', blogIdx)) !== -1) {
    blogCount++;
    blogOutput += `\n=== Blog Match ${blogCount} at index ${blogIdx} ===\n`;
    blogOutput += content.substring(Math.max(0, blogIdx - 150), Math.min(content.length, blogIdx + 1500));
    blogOutput += '\n-------------------\n';
    blogIdx += 14;
  }
  fs.writeFileSync(path.join(__dirname, 'blog_extracted.txt'), blogOutput, 'utf8');
  console.log('Blog search complete. Written to blog_extracted.txt');

} catch (err) {
  console.error(err);
}
