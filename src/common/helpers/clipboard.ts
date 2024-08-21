export const addToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
}
