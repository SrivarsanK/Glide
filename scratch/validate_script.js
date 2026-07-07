const { getEditorHTML } = require('../packages/overlay/dist/editor-html.js');

try {
  const html = getEditorHTML(5173);
  // Find the main script tag. We know it starts after some point.
  // Let's locate the last <script> tag.
  const scriptStartIdx = html.lastIndexOf('<script>');
  const scriptEndIdx = html.lastIndexOf('</script>');
  
  if (scriptStartIdx === -1 || scriptEndIdx === -1) {
    console.error('Could not find script tag');
    process.exit(1);
  }
  
  const scriptContent = html.substring(scriptStartIdx + 8, scriptEndIdx);
  
  console.log('Script length:', scriptContent.length);
  
  // Try compiling it using new Function
  new Function(scriptContent);
  console.log('JavaScript is syntactically valid!');
} catch (err) {
  console.error('Syntax Error found:');
  console.error(err);
  
  // Let's print the line number if available
  if (err.stack) {
    console.error(err.stack);
  }
}
