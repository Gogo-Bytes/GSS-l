const whitespace = '[\\t\\n\\r\\f ]';
const leadingWhitespace = new RegExp(`^${whitespace}+`);
const trailingWhitespace = new RegExp(`${whitespace}+$`);

/** Bounded reference syntax only; no file/URI resolution or production discovery. */
export function referenceImageUrl(value: string): { url?: string } | undefined {
  value = value.replace(leadingWhitespace, '').replace(trailingWhitespace, '');
  if (/^none$/i.test(value)) return {};
  if (!/^url\(/i.test(value) || !value.endsWith(')')) return undefined;
  let body = value.slice(4, -1).replace(leadingWhitespace, '');
  const quote = body[0] === '"' || body[0] === "'" ? body[0] : undefined;
  if (quote) {
    body = body.replace(trailingWhitespace, '');
    if (!body.endsWith(quote) || body.length < 2) return undefined;
    body = body.slice(1, -1);
  }
  let url = '';
  for (let index = 0; index < body.length; index++) {
    let character = body[index]!;
    if (!quote && /^[\t\n\r\f ]+$/.test(body.slice(index))) break;
    if (character === '\\') {
      const rest = body.slice(index + 1);
      const hex = /^[0-9a-f]{1,6}(?:\r\n|[\t\n\r\f ])?/i.exec(rest)?.[0];
      if (hex) {
        const code = parseInt(hex, 16);
        if (!validCodePoint(code)) return undefined;
        character = String.fromCodePoint(code);
        index += hex.length;
      } else {
        if (!rest || /^[\n\r\f]/.test(rest)) return undefined;
        character = rest[0]!;
        index++;
      }
    } else if (quote ? character === quote : /[\t\n\r\f ()'"]/.test(character) || body.slice(index, index + 2) === '/*') {
      return undefined;
    }
    url += character;
  }
  if (!url || Array.from(url).some((character) => !validCodePoint(character.codePointAt(0)!))) return undefined;
  return { url };
}

function validCodePoint(code: number): boolean {
  return code >= 0x20 && code !== 0x7f && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
}

/** Outside strings, the previous function/escape restriction is unchanged. */
export function referenceContentValue(value: string): boolean {
  let quote: string | undefined;
  for (const character of value) {
    if (character === '\\') return false;
    if (quote) { if (character === quote) quote = undefined; }
    else if (character === '"' || character === "'") quote = character;
    else if (character === '(' || character === ')') return false;
  }
  return quote === undefined;
}

export function renderReferenceUrl(url: string): string {
  const escaped = Array.from(url, (character) => {
    if (character === '"' || character === '\\') return `\\${character}`;
    const code = character.codePointAt(0)!;
    return code < 0x20 || code === 0x7f ? `\\${code.toString(16)} ` : character;
  }).join('');
  return `url("${escaped}")`;
}
