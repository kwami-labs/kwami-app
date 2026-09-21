export const defaultGradient = { x: '#00d9ff', y: '#a855f7', z: '#22c55e' };

export function getGradient(colors: { x: string; y: string; z: string }) {
  return `linear-gradient(135deg, ${colors.x} 0%, ${colors.y} 50%, ${colors.z} 100%)`;
}

export function randomHex() {
  return (
    '#' +
    Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, '0')
  );
}

export function randomizeGradientColors(colors: { x: string; y: string; z: string }) {
  colors.x = randomHex();
  colors.y = randomHex();
  colors.z = randomHex();
}
