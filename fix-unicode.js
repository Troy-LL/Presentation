const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/web/components/host-console.tsx');
const buffer = fs.readFileSync(filePath);

let result = buffer;

// Fix checkmark corruption: C3 A2 E2 81 B3 → ✓ (U+2713)
// This matches the pattern: âœ"  
const checksumPattern = Buffer.from([0xC3, 0xA2, 0xE2, 0x81, 0xB3]);
const checksumReplacement = Buffer.from([0xE2, 0x9C, 0x93]); // ✓

while (result.includes(checksumPattern)) {
  const index = result.indexOf(checksumPattern);
  if (index === -1) break;
  result = Buffer.concat([
    result.slice(0, index),
    checksumReplacement,
    result.slice(index + checksumPattern.length)
  ]);
}

fs.writeFileSync(filePath, result);
console.log('Fixed checkmark corruption in host-console.tsx');
