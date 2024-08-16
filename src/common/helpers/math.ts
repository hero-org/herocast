export function randomNumberBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min);
}

export const roundToNextDigit = (value: number) => {
  const digits = value.toString().length;
  const factor = Math.pow(10, digits - 1);
  return Math.ceil(value / factor) * factor;
};
