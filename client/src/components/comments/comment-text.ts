export function insertTextAtSelection(
  text: string,
  insertedText: string,
  selection: { start: number; end: number },
  maxLength: number,
): { text: string; cursor: number } | null {
  const start = Math.max(0, Math.min(selection.start, text.length));
  const end = Math.max(start, Math.min(selection.end, text.length));
  const nextText = `${text.slice(0, start)}${insertedText}${text.slice(end)}`;

  if (nextText.length > maxLength) return null;

  return { text: nextText, cursor: start + insertedText.length };
}
