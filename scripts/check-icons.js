/**
 * Build guard: fails if two hazards share the same icon (and tint), or if a mapped SVG is missing.
 * Runs automatically before `npm run build` (see "prebuild" in package.json).
 */
const fs = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'config', 'hazardIcons.json'), 'utf8'));
const seen = new Map();
const problems = [];
for (const [hazard, icon] of Object.entries(cfg.icons)) {
  const key = `${icon}|${cfg.tints[hazard] || ''}`;
  if (seen.has(key)) problems.push(`Hazards "${seen.get(key)}" and "${hazard}" share the same icon "${icon}"`);
  else seen.set(key, hazard);
  if (!fs.existsSync(path.join(__dirname, '..', 'public', 'icons', 'fluent', `${icon}.svg`))) problems.push(`Missing SVG for "${hazard}": ${icon}.svg`);
}
if (problems.length) {
  console.error('Icon configuration check failed:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log(`Icon configuration OK (${seen.size} unique hazard icons).`);
