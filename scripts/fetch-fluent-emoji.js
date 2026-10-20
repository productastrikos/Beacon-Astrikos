/**
 * One-off helper: downloads the Fluent UI Emoji "Flat" SVGs used by the app into
 * public/icons/fluent. Source: https://github.com/microsoft/fluentui-emoji (MIT).
 * Usage: node scripts/fetch-fluent-emoji.js
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'icons', 'fluent');
fs.mkdirSync(OUT, { recursive: true });

// slug (our file name) -> Fluent emoji folder name
const ICONS = {
  'water-wave': 'Water wave', mountain: 'Mountain', 'vibration-mode': 'Vibration mode', 'snow-capped-mountain': 'Snow-capped mountain',
  fire: 'Fire', thermometer: 'Thermometer', snowflake: 'Snowflake', 'puzzle-piece': 'Puzzle piece', cyclone: 'Cyclone', desert: 'Desert',
  'high-voltage': 'High voltage', 'control-knobs': 'Control knobs', satellite: 'Satellite', loudspeaker: 'Loudspeaker',
  'police-car-light': 'Police car light', 'safety-vest': 'Safety vest', minibus: 'Minibus', brain: 'Brain', 'bar-chart': 'Bar chart',
  gear: 'Gear', 'busts-in-silhouette': 'Busts in silhouette', warning: 'Warning', 'round-pushpin': 'Round pushpin', clipboard: 'Clipboard',
  'electric-plug': 'Electric plug', 'chart-increasing': 'Chart increasing', 'chart-decreasing': 'Chart decreasing',
  'blue-square': 'Blue square', 'yellow-square': 'Yellow square', 'orange-square': 'Orange square', 'red-square': 'Red square',
  'white-circle': 'White circle', 'green-circle': 'Green circle', 'orange-circle': 'Orange circle', 'red-circle': 'Red circle',
  'yellow-circle': 'Yellow circle', 'blue-circle': 'Blue circle',
  'new-button': 'New button', 'counterclockwise-arrows': 'Counterclockwise arrows button', 'pause-button': 'Pause button',
  'check-mark-button': 'Check mark button', locked: 'Locked', 'check-mark': 'Check mark', 'hourglass-not-done': 'Hourglass not done',
  'hourglass-done': 'Hourglass done', 'red-question-mark': 'Red question mark', 'test-tube': 'Test tube', 'bust-in-silhouette': 'Bust in silhouette',
  magnifier: 'Magnifying glass tilted right', 'cross-mark': 'Cross mark', prohibited: 'Prohibited', 'no-entry': 'No entry', construction: 'Construction',
  motorway: 'Motorway', pushpin: 'Pushpin', 'hammer-and-wrench': 'Hammer and wrench', 'chequered-flag': 'Chequered flag', eye: 'Eye',
  wastebasket: 'Wastebasket', 'card-index-dividers': 'Card index dividers', 'classical-building': 'Classical building', 'inbox-tray': 'Inbox tray',
  'play-button': 'Play button', 'up-arrow': 'Up arrow', 'down-arrow': 'Down arrow', minus: 'Minus', 'bookmark-tabs': 'Bookmark tabs',
  'three-oclock': 'Three oclock', 'world-map': 'World map', 'crescent-moon': 'Crescent moon', sun: 'Sun', bell: 'Bell',
  'anticlockwise-arrows': 'Counterclockwise arrows button', 'no-mobile': 'No mobile phones', 'memo': 'Memo', 'locked-with-key': 'Locked with key',
};

const base = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets';
async function get(url) {
  const r = await fetch(url);
  return r.ok ? await r.text() : null;
}

(async () => {
  const failed = [];
  for (const [slug, folder] of Object.entries(ICONS)) {
    const dest = path.join(OUT, `${slug}.svg`);
    if (fs.existsSync(dest)) continue;
    const guess = folder.toLowerCase().replace(/[:]/g, '').replace(/\s+/g, '_');
    let svg = await get(`${base}/${encodeURIComponent(folder)}/Flat/${encodeURIComponent(`${guess}_flat.svg`)}`);
    if (!svg) {
      const list = await fetch(`https://api.github.com/repos/microsoft/fluentui-emoji/contents/assets/${encodeURIComponent(folder)}/Flat`);
      if (list.ok) {
        const items = await list.json();
        const f = items.find((i) => i.name.endsWith('.svg'));
        if (f) svg = await get(f.download_url);
      }
    }
    if (svg) fs.writeFileSync(dest, svg);
    else failed.push(`${slug} (${folder})`);
  }
  fs.writeFileSync(path.join(OUT, 'LICENSE.txt'),
    'Fluent UI Emoji — Flat style. Copyright (c) Microsoft Corporation. MIT License.\nhttps://github.com/microsoft/fluentui-emoji\n');
  console.log('downloaded', fs.readdirSync(OUT).filter((n) => n.endsWith('.svg')).length, 'icons');
  if (failed.length) console.log('FAILED:', failed.join(', '));
})();
