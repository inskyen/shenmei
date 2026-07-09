const fs = require('fs');
const content = fs.readFileSync('SVG.svg', 'utf8');

const matches = content.match(/<g>/g);
console.log('Total <g> tags:', matches ? matches.length : 0);

// Let's try to extract one of them to see its size.
const layerIndex = content.indexOf('<g id="Layer_6">');
if (layerIndex !== -1) {
    const layerContent = content.slice(layerIndex, layerIndex + 5000);
    console.log('Layer 6 preview:\\n', layerContent);
}

