const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'public', 'avatars');

const colors = [
  { bg: '#FFE4E1', body: '#FFB6C1', spike: '#FF69B4' }, // Classic Pink
  { bg: '#E0FFFF', body: '#87CEFA', spike: '#4169E1' }, // Blue
  { bg: '#F0FFF0', body: '#98FB98', spike: '#32CD32' }, // Green
  { bg: '#FFFACD', body: '#F0E68C', spike: '#FFD700' }, // Yellow
  { bg: '#E6E6FA', body: '#DDA0DD', spike: '#9370DB' }, // Purple
  { bg: '#FFF0F5', body: '#FFC0CB', spike: '#FF1493' }, // Deep Pink
  { bg: '#F5FFFA', body: '#66CDAA', spike: '#20B2AA' }, // Mint
  { bg: '#FFFAF0', body: '#FFDAB9', spike: '#FF8C00' }, // Peach
  { bg: '#F0F8FF', body: '#B0C4DE', spike: '#4682B4' }, // Steel Blue
  { bg: '#FFFFE0', body: '#BDB76B', spike: '#808000' }, // Olive
  { bg: '#FDF5E6', body: '#F4A460', spike: '#D2691E' }, // Sand
  { bg: '#F5F5F5', body: '#D3D3D3', spike: '#A9A9A9' }, // Gray
  { bg: '#FFE4B5', body: '#FFA07A', spike: '#FF4500' }, // Salmon
  { bg: '#E0FFE0', body: '#8FBC8F', spike: '#2E8B57' }, // Sea Green
  { bg: '#F0E68C', body: '#DAA520', spike: '#B8860B' }, // Goldenrod
  { bg: '#FFE4E1', body: '#DB7093', spike: '#C71585' }, // Pale Violet Red
];

const props = [
  '', // None
  '<path d="M 60,20 L 65,10 L 70,20 Z" fill="#FFD700" />', // Crown
  '<circle cx="65" cy="38" r="4" fill="#000" /><rect x="61" y="37" width="10" height="2" fill="#000" />', // Sunglasses
  '<path d="M 80,60 C 80,55 90,55 90,60 C 90,65 80,75 80,75 C 80,75 70,65 70,60 C 70,55 80,55 80,60 Z" fill="#FF0000" />', // Heart
  '<circle cx="85" cy="50" r="5" fill="#FFA500" /><circle cx="85" cy="50" r="2" fill="#FFFF00" />', // Flower
  '<rect x="55" y="15" width="20" height="5" fill="#333" /><rect x="60" y="5" width="10" height="10" fill="#333" />', // Top Hat
  '<path d="M 75,30 L 80,35 L 75,40 Z" fill="#00BFFF" />', // Tear
  '<circle cx="70" cy="42" r="4" fill="#FF0000" opacity="0.5" />', // Blush
];

for (let i = 0; i < 16; i++) {
  const c = colors[i];
  const prop = props[i % props.length];
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
    <!-- Background -->
    <circle cx="50" cy="50" r="50" fill="${c.bg}" />
    
    <!-- Spikes -->
    <path d="M 35,45 L 25,40 L 32,55 Z" fill="${c.spike}" />
    <path d="M 30,55 L 20,55 L 28,68 Z" fill="${c.spike}" />
    <path d="M 28,70 L 18,75 L 30,80 Z" fill="${c.spike}" />
    <path d="M 45,35 L 40,25 L 50,38 Z" fill="${c.spike}" />
    
    <!-- Body -->
    <path d="M 45,35 Q 25,45 30,85 L 70,85 Q 75,65 60,40 Z" fill="${c.body}" />
    
    <!-- Head -->
    <circle cx="60" cy="40" r="16" fill="${c.body}" />
    <ellipse cx="72" cy="46" rx="12" ry="9" fill="${c.body}" />
    
    <!-- Eye -->
    <circle cx="65" cy="38" r="2.5" fill="#333" />
    
    <!-- Cheek -->
    <circle cx="70" cy="43" r="3.5" fill="#FF69B4" opacity="0.6" />
    
    <!-- Mouth -->
    <path d="M 78,48 Q 80,50 82,48" stroke="#333" stroke-width="1.5" fill="none" stroke-linecap="round" />
    
    <!-- Arm -->
    <path d="M 55,60 Q 65,65 65,70 Q 60,70 55,65 Z" fill="${c.body}" />
    
    <!-- Prop -->
    ${prop}
</svg>`;

  fs.writeFileSync(path.join(outDir, `momo${i + 1}.svg`), svg);
}

console.log('16 momo SVGs generated!');
