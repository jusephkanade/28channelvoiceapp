const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'public/voice-channel-widget.js');
let code = fs.readFileSync(file, 'utf8');

// Reemplazar textos pixel-hardcoded por tamaños rem de Tailwind para que escalen con html font-size
code = code.replace(/text-\[9px\]/g, 'text-xs opacity-80');
code = code.replace(/text-\[10px\]/g, 'text-xs');
code = code.replace(/text-\[11px\]/g, 'text-sm opacity-90');
code = code.replace(/text-\[12px\]/g, 'text-sm');
code = code.replace(/text-\[13px\]/g, 'text-base');

// Agrandar algunos iconos clave ligeramente para móviles si son w-4
code = code.replace(/w-4 h-4/g, 'w-5 h-5');
code = code.replace(/w-5 h-5/g, 'w-6 h-6');

// Agrandar los botones inferiores que son px-2 py-1
code = code.replace(/px-2 py-1/g, 'px-3 py-2');

fs.writeFileSync(file, code);
console.log('Reemplazos completados en voice-channel-widget.js');
