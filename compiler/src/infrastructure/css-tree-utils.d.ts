// The lightweight runtime subpath exposes the same identifier codec as the main package.
declare module 'css-tree/utils' {
  export { ident, string } from 'css-tree';
}

declare module 'css-tree/tokenizer' {
  export const tokenTypes: Readonly<Record<'Ident' | 'String' | 'Function' | 'LeftParenthesis' | 'RightParenthesis', number>>;
  export function tokenize(source: string, onToken: (type: number, start: number, end: number) => void): void;
}
