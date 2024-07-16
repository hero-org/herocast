import { convertCastPlainTextToStructured } from "@mod-protocol/farcaster";

const MAX_BYTE_LENGTH = 320;

export function useTextLength({ text }: { text: string }) {
    // Mentions don't occupy space in the cast, so we need to ignore them for our length calculation
    const structuredTextUnits = convertCastPlainTextToStructured({ text });
    const textWithoutMentions = structuredTextUnits.reduce((acc, unit) => {
        if (unit.type !== "mention") acc += unit.serializedContent;
        return acc;
    }, "");

    const lengthInBytes = new TextEncoder().encode(textWithoutMentions).length;

    const ninetyPercentComplete = MAX_BYTE_LENGTH * 0.9;

    return {
        length: lengthInBytes,
        isValid: lengthInBytes <= MAX_BYTE_LENGTH,
        tailwindColor:
            lengthInBytes > MAX_BYTE_LENGTH
                ? "text-red-500 font-semibold"
                : lengthInBytes > ninetyPercentComplete
                    ? `text-orange-500`
                    : "text-foreground/60",
        label:
            lengthInBytes > MAX_BYTE_LENGTH
                ? `-${lengthInBytes - MAX_BYTE_LENGTH} characters left`
                : lengthInBytes > ninetyPercentComplete
                    ? `${MAX_BYTE_LENGTH - lengthInBytes} characters left`
                    : ``,
    };
}