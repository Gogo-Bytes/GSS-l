// The native reference is the ORIGINAL local classes on one node, in the authored
// stylesheet order below. No ownership paths or ancestor translation are involved.
const gray = 'rgb(128, 128, 128)', red = 'rgb(255, 0, 0)', blue = 'rgb(0, 0, 255)', green = 'rgb(0, 128, 0)', purple = 'rgb(128, 0, 128)';
export const states = {
  idle: { hover: false, focus: false, pressed: false },
  hover: { hover: true, focus: false, pressed: false },
  pressed: { hover: false, focus: false, pressed: true },
  both: { hover: true, focus: false, pressed: true },
  focus: { hover: false, focus: true, pressed: false },
  hoverFocus: { hover: true, focus: true, pressed: false },
  all: { hover: true, focus: true, pressed: true }
};
const four = ['idle', 'hover', 'pressed', 'both'];
const a = '.a:hover { background-color: red; }\n.a[aria-pressed="true"] { background-color: blue; }';
const bOpposite = '.b[aria-pressed="true"] { background-color: blue; }\n.b:hover { background-color: red; }';
const fixture = (name, source, stateNames, backgrounds, extra = {}) => ({
  name, source, nativeCss: source, scopes: ['a', 'b'], stateNames,
  expected: backgrounds.map((background) => ({ background, color: 'rgb(0, 0, 0)', border: 'rgb(0, 0, 0)' })), ...extra
});
export const fixtures = [
  fixture('01-nonconflicting', '.a { color: red; }\n.b { background-color: blue; }', ['idle'], [blue], {
    expected: [{ background: blue, color: red, border: 'rgb(0, 0, 0)' }]
  }),
  fixture('02-unranked-base-conflict', '.a { background-color: red; }\n.b { background-color: blue; }', ['idle'], [blue]),
  fixture('03-unranked-same-hover', '.a:hover { background-color: red; }\n.b:hover { background-color: blue; }', ['idle', 'hover'], [gray, blue]),
  fixture('04-unranked-different-predicates', '.a:hover { background-color: red; }\n.b:focus { background-color: blue; }', ['idle', 'hover', 'focus', 'hoverFocus'], [gray, red, blue, blue]),
  fixture('05-ranked-unranked-same-hover', a + '\n.b:hover { background-color: green; }', four, [gray, green, blue, green]),
  fixture('06-ranked-unranked-different-focus', a + '\n.b:focus { background-color: green; }', ['idle', 'focus', 'hoverFocus', 'all'], [gray, green, green, green]),
  fixture('07-ranked-opposite-a-then-b', a + '\n' + bOpposite, four, [gray, red, blue, red]),
  fixture('08-ranked-opposite-b-then-a', bOpposite + '\n' + a, four, [gray, red, blue, blue]),
  fixture('09-interleaved-module-order', '.a:hover { background-color: red; }\n.b:hover { background-color: green; }\n.b:focus { background-color: purple; }\n.a[aria-pressed="true"] { background-color: blue; }', ['idle', 'hover', 'focus', 'pressed', 'hoverFocus', 'all'], [gray, green, purple, blue, purple, blue]),
  fixture('10-important-controls', a.replaceAll(';', ' !important;') + '\n.b:focus { background-color: green; }', ['idle', 'focus', 'hoverFocus', 'all'], [gray, green, red, blue]),
  fixture('11-specificity-control', a + '\n.b { background-color: green; }', four, [green, red, blue, blue]),
  fixture('12-duplicate-same-scope', a, four, [gray, red, blue, blue], { scopes: ['a', 'a'] })
];

// Additional independent literal contracts. Structural/owned cases intentionally
// express GSS ownership, not a native translation of authored descendant CSS.
fixtures.push(
  fixture('13-owner-one-color', '.a {color:red} .b {background-color:blue; border-color:green}', ['idle'], [blue], {
    expected: [{background:blue,color:red,border:green}]
  }),
  fixture('14-owner-two-color', '.a {color:red; background-color:blue} .b {color:blue; border-color:green}', ['idle'], [blue], {
    expected: [{background:blue,color:blue,border:green}]
  }),
  fixture('15-simple-shorthand', '.a {margin-left:2px} .b {margin:1px}', ['idle'], [gray], {
    expected: [{background:gray,color:'rgb(0, 0, 0)',border:'rgb(0, 0, 0)',marginLeft:'1px'}]
  })
);
