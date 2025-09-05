import { convertCastPlainTextToStructured } from './farcaster';

export const MAX_SHORT_CAST_LENGTH = 320;
export const MAX_CAST_LENGTH = 1024; // Protocol limit (pro users only for 321-1024)

export function useTextLength({ text, isPro = false }: { text: string; isPro?: boolean }) {
  // Mentions don't occupy space in the cast, so we need to ignore them for our length calculation
  const structuredTextUnits = convertCastPlainTextToStructured({ text });
  const textWithoutMentions = structuredTextUnits.reduce((acc, unit) => {
    if (unit.type !== 'mention') acc += unit.serializedContent;
    return acc;
  }, '');

  const lengthInBytes = new TextEncoder().encode(textWithoutMentions).length;

  // Non-pro users limited to 320 bytes, pro users can use up to 1024 bytes
  const MAX_USER_CAST_CHARACTERS = isPro ? MAX_CAST_LENGTH : MAX_SHORT_CAST_LENGTH;
  const ninetyPercentComplete = MAX_USER_CAST_CHARACTERS * 0.9;
  const isValid = lengthInBytes <= MAX_USER_CAST_CHARACTERS;

  return {
    length: lengthInBytes,
    isLongCast: lengthInBytes > MAX_SHORT_CAST_LENGTH,
    isValid,
    tailwindColor: !isValid
      ? 'text-red-500 font-semibold'
      : lengthInBytes > ninetyPercentComplete
        ? `text-orange-500`
        : 'text-foreground/60',
    label:
      lengthInBytes > MAX_USER_CAST_CHARACTERS
        ? `-${lengthInBytes - MAX_USER_CAST_CHARACTERS} characters left`
        : lengthInBytes > ninetyPercentComplete
          ? `${MAX_USER_CAST_CHARACTERS - lengthInBytes} characters left`
          : ``,
  };
}
