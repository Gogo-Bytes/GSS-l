import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const originalArticle = await readFile(new URL('./article-original.gss', import.meta.url), 'utf8');
const four = [
  { name: 'idle', hover: false, focus: false, pressed: false },
  { name: 'hover', hover: true, focus: false, pressed: false },
  { name: 'pressed', hover: false, focus: false, pressed: true },
  { name: 'hover-pressed', hover: true, focus: false, pressed: true }
];
const eight = [...four, ...four.map((state) => ({ ...state, name: `focus-${state.name}`, focus: true }))];
const gray = 'rgb(128, 128, 128)', red = 'rgb(255, 0, 0)', blue = 'rgb(0, 0, 255)', green = 'rgb(0, 128, 0)';
const target = (name, module, path, nativeClass, expected) => ({ name, module, path, nativeClass, expected });

// Native CSS and literal expected colors are authored independently of compiler output.
// Ownership paths use native compound classes to represent specificity, not DOM ancestry.
export const fixtures = [
  {
    name: 'opposite-targets-and-unconflicted-isolation', states: four, images: true, corruptOrder: true,
    modules: { 'A.gss': `
      .a:hover { background-color: red; } .a[aria-pressed="true"] { background-color: blue; }
      .b[aria-pressed="true"] { background-color: blue; } .b:hover { background-color: red; }
      .same:hover { background-color: red; } .same[aria-pressed="true"] { background-color: blue; }
      .alone:hover { background-color: red; }` },
    nativeCss: `.native-a:hover, .native-same:hover, .native-alone:hover { background-color: red; }
      .native-a[aria-pressed=true], .native-same[aria-pressed=true] { background-color: blue; }
      .native-b[aria-pressed=true] { background-color: blue; } .native-b:hover { background-color: red; }`,
    targets: [target('a', 'A.gss', ['a'], 'native-a', [gray, red, blue, blue]),
      target('b', 'A.gss', ['b'], 'native-b', [gray, red, blue, red]),
      target('same', 'A.gss', ['same'], 'native-same', [gray, red, blue, blue]),
      target('alone', 'A.gss', ['alone'], 'native-alone', [gray, red, gray, red])]
  },
  {
    name: 'opposite-modules', states: four, images: true,
    modules: {
      'A.gss': '.button:hover { background-color: red; } .button[aria-pressed=true] { background-color: blue; }',
      'B.gss': '.button[aria-pressed=true] { background-color: blue; } .button:hover { background-color: red; }',
      'C.gss': '.button:hover { background-color: red; }'
    },
    nativeCss: '.native-a:hover, .native-c:hover { background-color: red; } .native-a[aria-pressed=true] { background-color: blue; } .native-b[aria-pressed=true] { background-color: blue; } .native-b:hover { background-color: red; }',
    targets: [target('a', 'A.gss', ['button'], 'native-a', [gray, red, blue, blue]),
      target('b', 'B.gss', ['button'], 'native-b', [gray, red, blue, red]),
      target('c', 'C.gss', ['button'], 'native-c', [gray, red, gray, red])]
  },
  {
    name: 'third-live-predicate-and-repeated-hover', states: eight,
    modules: { 'A.gss': `.a:hover { background-color: pink; } .a:hover { background-color: red; }
      .a[aria-pressed=true] { background-color: blue; } .a:focus { background-color: green; }
      .b:focus { background-color: green; } .b[aria-pressed=true] { background-color: blue; } .b:hover { background-color: red; }` },
    nativeCss: `.native-a:hover { background-color: pink; } .native-a:hover { background-color: red; }
      .native-a[aria-pressed=true] { background-color: blue; } .native-a:focus { background-color: green; }
      .native-b:focus { background-color: green; } .native-b[aria-pressed=true] { background-color: blue; } .native-b:hover { background-color: red; }`,
    targets: [target('a', 'A.gss', ['a'], 'native-a', [gray, red, blue, blue, green, green, green, green]),
      target('b', 'A.gss', ['b'], 'native-b', [gray, red, blue, red, green, red, blue, red])]
  },
  {
    name: 'both-important-native-ties', states: four,
    modules: { 'A.gss': `.a:hover { background-color: red !important; } .a[aria-pressed=true] { background-color: blue !important; }
      .b[aria-pressed=true] { background-color: blue !important; } .b:hover { background-color: red !important; }` },
    nativeCss: `.native-a:hover { background-color: red !important; } .native-a[aria-pressed=true] { background-color: blue !important; }
      .native-b[aria-pressed=true] { background-color: blue !important; } .native-b:hover { background-color: red !important; }`,
    targets: [target('a', 'A.gss', ['a'], 'native-a', [gray, red, blue, blue]), target('b', 'A.gss', ['b'], 'native-b', [gray, red, blue, red])]
  },
  {
    name: 'asymmetric-importance-stays-native', states: eight,
    modules: { 'A.gss': `.a:hover { background-color: red !important; } .a[aria-pressed=true] { background-color: blue; }
      .a:focus { background-color: green; }
      .b:hover { background-color: red; } .b[aria-pressed=true] { background-color: blue !important; } .b:focus { background-color: green; }` },
    nativeCss: `.native-a:hover { background-color: red !important; } .native-a[aria-pressed=true] { background-color: blue; } .native-a:focus { background-color: green; }
      .native-b:hover { background-color: red; } .native-b[aria-pressed=true] { background-color: blue !important; } .native-b:focus { background-color: green; }`,
    targets: [target('a', 'A.gss', ['a'], 'native-a', [gray, red, blue, red, green, red, green, red]),
      target('b', 'A.gss', ['b'], 'native-b', [gray, red, blue, blue, green, green, blue, blue])]
  },
  {
    name: 'base-closure-and-stronger-specificity', states: eight,
    modules: { 'A.gss': `.a:hover { background-color: red; } .a[aria-pressed=true] { background-color: blue; }
      .root .a { background-color: green; }
      .root .b { background-color: green; } .b:hover { background-color: red; } .b[aria-pressed=true] { background-color: blue; }
      .c:hover { background-color: red; } .c[aria-pressed=true] { background-color: blue; } .root .c:focus { background-color: green; }` },
    nativeCss: `.native-a:hover { background-color: red; } .native-a[aria-pressed=true] { background-color: blue; } .native-a.boost { background-color: green; }
      .native-b.boost { background-color: green; } .native-b:hover { background-color: red; } .native-b[aria-pressed=true] { background-color: blue; }
      .native-c:hover { background-color: red; } .native-c[aria-pressed=true] { background-color: blue; } .native-c.boost:focus { background-color: green; }`,
    targets: [target('a', 'A.gss', ['root', 'a'], 'native-a boost', Array(8).fill(green)),
      target('b', 'A.gss', ['root', 'b'], 'native-b boost', [green, red, blue, blue, green, red, blue, blue]),
      target('c', 'A.gss', ['root', 'c'], 'native-c boost', [gray, red, blue, blue, green, green, green, green])]
  },
  {
    name: 'historical-original-article-unchanged', states: four, images: true,
    modules: { 'Article.gss': originalArticle },
    nativeCss: `.native-button { padding: 8px 12px; border: 1px solid #a6b9ac; border-radius: 8px; color: #305346; background-color: #ffffff; font-family: inherit; font-size: 13px; font-weight: 650; line-height: 1.5; letter-spacing: 0; cursor: pointer; }
      .native-button:hover { background-color: #edf3ed; }
      .native-button:focus-visible { outline: 3px solid #527c64; outline-offset: 2px; }
      .native-button:disabled { opacity: 0.45; cursor: default; }
      .native-button[aria-pressed=true] { background-color: #dfeee3; border-color: #527c64; }`,
    targets: [target('button', 'Article.gss', ['button'], 'native-button', ['rgb(255, 255, 255)', 'rgb(237, 243, 237)', 'rgb(223, 238, 227)', 'rgb(223, 238, 227)'])]
  }
];
