import hazardIcons from '../config/hazardIcons.json';
import { HAZARD_ICON, ICON_LABEL } from '../config/icons';

test('every hazard has a unique icon (or a distinct tint)', () => {
  const keys = Object.entries(HAZARD_ICON).map(([h, icon]) => `${icon}|${hazardIcons.tints[h] || ''}`);
  expect(new Set(keys).size).toBe(keys.length);
});

test('every mapped icon has an accessible label', () => {
  Object.values(HAZARD_ICON).forEach((icon) => expect(ICON_LABEL[icon]).toBeTruthy());
});
