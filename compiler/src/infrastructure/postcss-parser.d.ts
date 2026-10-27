// PostCSS exports this runtime subpath but supplies no declaration for it.
// Keep the adapter's Input-aware parser seam private and limited to what we use.
declare module 'postcss/lib/parser' {
  import type { Input, Root } from 'postcss';

  export default class Parser {
    constructor(input: Input);
    parse(): void;
    root: Root;
  }
}
