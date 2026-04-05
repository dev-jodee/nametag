export const PRESET_COLORS: string[] = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#f43f5e', // Rose
];

const toHex = (value: number): string => value.toString(16).padStart(2, '0');

export function getRandomColor(): string {
  const red = Math.floor(Math.random() * 256);
  const green = Math.floor(Math.random() * 256);
  const blue = Math.floor(Math.random() * 256);

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}
