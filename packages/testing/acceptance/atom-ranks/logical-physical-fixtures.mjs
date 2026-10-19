export const modes = [
  {writingMode:'horizontal-tb',direction:'ltr',inline:['left','right'],block:['top','bottom']},
  {writingMode:'horizontal-tb',direction:'rtl',inline:['right','left'],block:['top','bottom']},
  {writingMode:'vertical-rl',direction:'ltr',inline:['top','bottom'],block:['right','left']},
  {writingMode:'vertical-rl',direction:'rtl',inline:['bottom','top'],block:['right','left']},
  {writingMode:'vertical-lr',direction:'ltr',inline:['top','bottom'],block:['left','right']}
];
const sides = ['top','right','bottom','left'];
const physical = (family,side) => family === 'inset' ? side : `${family}-${side}`;
export const simpleFixtures = [];
const fixtures = simpleFixtures;
for (const family of ['margin','padding','inset','scroll-margin','scroll-padding']) for (const mode of modes) {
  for (const shape of ['long-long','short-long','long-short','block-short']) for (const reverseSource of [false,true]) for (const count of [4,2]) {
    const axis = shape === 'block-short' ? 'block' : 'inline';
    const logicalShort = shape === 'short-long' || shape === 'block-short';
    const physicalShort = shape === 'long-short' || shape === 'block-short';
    const logical = `${family}-${axis}${logicalShort ? '' : '-start'}`;
    const phys = physicalShort ? family : physical(family,mode[axis][0]);
    const declarations = count === 4 ? [ ['a',logical,'1px'], ['b',phys,'2px'], ['c',logical,'1px'], ['d',phys,'3px'] ] : [ ['b',phys,'2px'], ['c',logical,'1px'] ];
    if (reverseSource) declarations.reverse();
    // Independent literal side assignment in AUTHORED source order, not compiler families/order.
    const expected = Object.fromEntries(sides.map(side=>[physical(family,side),'0px']));
    for (const [name,property,value] of declarations) if (name === 'b' || name === 'c') {
      const affected = property === logical ? (logicalShort ? mode[axis] : [mode[axis][0]]) : (physicalShort ? sides : [mode[axis][0]]);
      for (const side of affected) expected[physical(family,side)] = value;
    }
    const source = declarations.map(([name,property,value])=>`.${name}{${property}:${value}}`).join('');
    fixtures.push({name:`${family}/${mode.writingMode}/${mode.direction}/${shape}/${reverseSource}/${count}`,family,mode,shape,reverseSource,count,source,expected,scopes:['b','c']});
  }
}
// Keep the original non-directional alias/reset controls too.
const extras = [
  {name:'gap-grid-row-gap',a:'gap:1px',b:'grid-row-gap:2px',d:'grid-row-gap:3px',properties:['row-gap','column-gap']},
  {name:'grid-gap-row-gap',a:'grid-gap:1px',b:'row-gap:2px',d:'row-gap:3px',properties:['row-gap','column-gap']},
  {name:'grid-column-gap-gap',a:'grid-column-gap:1px',b:'gap:2px',d:'gap:3px',properties:['row-gap','column-gap']},
  {name:'border-image-reset',a:'border:1px solid red',b:'border-image-source:linear-gradient(red, blue)',d:'border-image-source:linear-gradient(blue, red)',properties:['border-image-source','border-top-width','border-top-color']},
  {name:'border-corner',a:'border-radius:1px',b:'border-top-left-radius:2px',d:'border-top-left-radius:3px',properties:['border-top-left-radius','border-bottom-right-radius']},
  {name:'text-decoration-reset',a:'text-decoration:underline solid red',b:'text-decoration-thickness:2px',d:'text-decoration-thickness:3px',properties:['text-decoration-line','text-decoration-color','text-decoration-thickness']},
  {name:'font-reset',a:'font:12px serif',b:'font-kerning:none',d:'font-kerning:normal',properties:['font-size','font-kerning']},
  {name:'font-variant-reset',a:'font-variant:normal',b:'font-variant-caps:small-caps',d:'font-variant-caps:all-small-caps',properties:['font-variant-caps']},
  {name:'background-position-reset',a:'background:red',b:'background-position-x:2px',d:'background-position-x:3px',properties:['background-color','background-position-x']}
];
for (const extra of extras) for (const reverseSource of [false,true]) {
  const rules = [`.a{${extra.a}}`,`.b{${extra.b}}`,`.c{${extra.a}}`,`.d{${extra.d}}`];
  fixtures.push({...extra,name:`${extra.name}/${reverseSource}`,reverseSource,source:(reverseSource?rules.reverse():rules).join(''),scopes:['b','c'],mode:modes[0]});
}

// Explicit GSS oracles: ownership and strict-child priority, NOT the raw
// authored child CSS (whose equal-specificity source tie would yield 1px).
export const semanticFixtures = [];
for (const family of ['margin','padding','inset','scroll-margin','scroll-padding']) {
  for (const kind of ['owned','child']) for (const reverse of [false,true]) for (const shorthand of [false,true]) {
    const side = kind === 'owned' ? 'top' : 'left';
    const property = physical(family,side), logical = `${family}-inline${shorthand ? '' : '-start'}`;
    const strong = `.root${kind === 'child' ? ' > ' : ' '}.item{${property}:2px}`;
    const weak = `${kind === 'child' ? '.root ' : ''}.item{${logical}:1px}`;
    semanticFixtures.push({name:`${family}/${kind}/${reverse}/${shorthand}`, family, side, logical, shorthand,
      source:reverse ? weak + strong : strong + weak, scopes:['root.item'],
      oracle:`.root-item{${logical}:1px;${property}:2px}`, strong:true,
      image:family === 'padding' && !reverse && !shorthand});
  }
}
for (const reverse of [false,true]) {
  const strong='.root .item{scroll-margin-left:2px}', weak='.item{scroll-margin-inline-start:1px}';
  semanticFixtures.push({name:`prior-nested-scroll/${reverse}`,family:'scroll-margin',side:'left',logical:'scroll-margin-inline-start',
    source:reverse ? weak+strong : strong+weak,scopes:['root.item'],oracle:'.root-item{scroll-margin-inline-start:1px;scroll-margin-left:2px}',strong:true});
  semanticFixtures.push({name:`non-child/${reverse}`,family:'margin',side:'left',logical:'margin-inline-start',
    source:reverse ? '.root .item{margin-inline-start:1px}.root > .item{margin-left:2px}' : '.root > .item{margin-left:2px}.root .item{margin-inline-start:1px}',
    scopes:['root.item'],oracle:'.root-item{margin-inline-start:1px}',strong:false,indirect:true});
  semanticFixtures.push({name:`checked-predicate/${reverse}`,family:'scroll-margin',side:'left',logical:'scroll-margin-inline-start',
    source:`.item:where(:checked):where(:disabled){scroll-margin-left:2px}${reverse ? '.item:focus,.item:where(:checked)' : '.item:where(:checked),.item:focus'}{scroll-margin-inline-start:1px}`,
    scopes:['item'],oracle:'.item{scroll-margin-inline-start:1px;scroll-margin-left:2px}',strong:true,checked:true});
  semanticFixtures.push({name:`native-specificity/${reverse}`,family:'padding',side:'left',logical:'padding-inline-start',
    source:reverse ? '.b{padding-inline-start:1px}.a:hover{padding-left:2px}' : '.a:hover{padding-left:2px}.b{padding-inline-start:1px}',
    scopes:['a','b'],oracle:'.b{padding-inline-start:1px}.a:hover{padding-left:2px}',strong:true,hover:true,image:!reverse});
  semanticFixtures.push({name:`native-important/${reverse}`,family:'padding',side:'left',logical:'padding-inline-start',
    source:reverse ? '.b{padding-inline-start:1px}.a{padding-left:2px!important}' : '.a{padding-left:2px!important}.b{padding-inline-start:1px}',
    scopes:['a','b'],oracle:'.b{padding-inline-start:1px}.a{padding-left:2px!important}',strong:true});
  semanticFixtures.push({name:`pseudo-subject/${reverse}`,family:'margin',side:'left',logical:'margin-inline-start',
    source:`${reverse ? '.a::after,.a::before' : '.a::before,.a::after'}{margin-left:2px}.b::before{margin-inline-start:1px}`,
    scopes:['a','b'],oracle:'.a::before,.a::after{margin-left:2px}.b::before{margin-inline-start:1px}',strong:true,sourceTie:true,pseudo:'::before'});
}
semanticFixtures.push({name:'owned-partial-shorthand',family:'scroll-margin',side:'left',logical:'scroll-margin-inline',shorthand:true,
  source:'.root .item{scroll-margin:2px;scroll-margin-top:3px}.item{scroll-margin-inline:1px}',scopes:['root.item'],
  oracle:'.root-item{scroll-margin-inline:1px;scroll-margin:2px;scroll-margin-top:3px}',strong:true,partial:true});
for (const reverse of [false,true]) {
  const owned='.root .item{scroll-margin-left:2px}', state='.item:hover{scroll-margin-inline-start:1px}';
  const ownedOracle='.root-item.root-item{scroll-margin-left:2px}', stateOracle='.root-item:hover{scroll-margin-inline-start:1px}';
  semanticFixtures.push({name:`owned-path-guard/${reverse}`,family:'scroll-margin',side:'left',logical:'scroll-margin-inline-start',
    source:reverse?state+owned:owned+state,scopes:['root.item'],oracle:reverse?stateOracle+ownedOracle:ownedOracle+stateOracle,
    strong:true,sourceTie:!reverse,hover:true});
}
