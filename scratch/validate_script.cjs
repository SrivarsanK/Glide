const { getEditorHTML } = require('../packages/overlay/dist/editor-html.js');
const parser = require('@babel/parser');

const html = getEditorHTML(5173);
const scriptStartIdx = html.lastIndexOf('<script>');
const scriptEndIdx = html.lastIndexOf('</script>');

const scriptContent = html.substring(scriptStartIdx + 8, scriptEndIdx);

try {
  console.log('Parsing JS with @babel/parser...');
  parser.parse(scriptContent, {
    sourceType: 'script',
    allowReturnOutsideFunction: true
  });
  console.log('No syntax errors found!');
} catch (err) {
  console.error('Syntax Error parsed by Babel:');
  console.error(err.message);
  if (err.loc) {
    console.error(`Error at Line ${err.loc.line}, Column ${err.loc.column}`);
  }
}
