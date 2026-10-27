/* global document, getComputedStyle, requestAnimationFrame */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import postcss from 'postcss';
import { createGssCompilerSession } from '@gss-l/compiler';
import { comparePng } from '../task-board/visual.mjs';
import { modes, simpleFixtures, semanticFixtures } from './logical-physical-fixtures.mjs';

const sides=['top','right','bottom','left'];
const physical=(family,side)=>family==='inset'?side:`${family}-${side}`;
async function compile(fixture) {
  const session=createGssCompilerSession({projectRoot:'/logical-order'});
  const result=session.replaceStylesheet({id:'/logical-order/Case.gss',source:fixture.source});
  assert.equal(result.committed,true,`${fixture.name}: ${JSON.stringify(result.diagnostics)}`);
  assert.deepEqual(result.diagnostics,[]);
  const exports=(await import(`data:text/javascript,${encodeURIComponent(result.module.moduleCode)}`)).default;
  const schema=session.getScopeSchema('/logical-order/Case.gss');
  const classes=(path)=>{
    let value=exports, node={targets:schema.exports};
    for(const part of path.split('.')) {value=value[part];node=node.targets[part];}
    assert.equal(value.self,node.selfClassName);
    return value.self;
  };
  return {snapshot:session.finalize(),exports,classes};
}
async function mount(page,fixture,compiled,reverse,semantic=false) {
  const names=(paths)=>{
    const tokens=paths.flatMap(path=>(compiled?compiled.classes(path):path.replaceAll('.','-')).split(' '));
    return (reverse?tokens.reverse():tokens).join(' ');
  };
  const prelude=semantic
    ? `:where(#target){display:block;position:relative;box-sizing:content-box;width:80px;height:60px;margin:0;padding:0;inset:0;scroll-margin:0;scroll-padding:0;border:1px solid black;background:gray;color:black;appearance:none;font:16px sans-serif}
       :where(#target)::before,:where(#target)::after{content:'x';display:block;margin:0;padding:0;inset:0;scroll-margin:0;scroll-padding:0}`
    : ':where(#target){position:absolute;margin:0;padding:0;inset:0;scroll-margin:0;scroll-padding:0}';
  const target=fixture.checked?`<input id="target" type="checkbox" checked disabled class="${names(fixture.scopes)}">`:`<div id="target" class="${names(fixture.scopes)}">x</div>`;
  const root=semantic&&fixture.scopes.includes('root.item') ? names(['root']) : '';
  await page.setContent(`<style>${prelude}</style><style id="subject-css">${compiled?compiled.snapshot.css:fixture.oracle??fixture.source}</style><div class="${root}" style="position:relative;width:200px;height:200px">${fixture.indirect?'<div>':''}${target}${fixture.indirect?'</div>':''}</div>`);
}
async function sample(page,fixture,mode,properties) {
  await page.bringToFront();
  await page.locator('#target').evaluate((node,mode)=>{node.style.writingMode=mode.writingMode;node.style.direction=mode.direction;},mode);
  await page.mouse.move(700,600);
  if(fixture.hover) await page.locator('#target').hover();
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(resolve));});
  const actual=await page.locator('#target').evaluate((node,{properties,pseudo})=>{
    const style=getComputedStyle(node,pseudo),rect=node.getBoundingClientRect();
    return {properties:Object.fromEntries(properties.map(p=>[p,style.getPropertyValue(p)])),geometry:[rect.x,rect.y,rect.width,rect.height],
      checked:node.matches(':checked'),hover:document.querySelector('#target:hover')===node,visibility:document.visibilityState};
  },{properties,pseudo:fixture.pseudo??null});
  assert.equal(actual.checked,fixture.checked??false);
  assert.equal(actual.hover,fixture.hover??false);
  assert.equal(actual.visibility,'visible');
  return actual;
}
function expectedSemantic(fixture,mode) {
  const result=Object.fromEntries(sides.map(side=>[physical(fixture.family,side),'0px']));
  const applyLogical=()=>{for(const side of fixture.shorthand?mode.inline:[mode.inline[0]]) result[physical(fixture.family,side)]='1px';};
  if(fixture.logicalStrong && fixture.strong) result[physical(fixture.family,fixture.side)]='2px';
  applyLogical();
  if(!fixture.logicalStrong && fixture.strong) result[physical(fixture.family,fixture.side)]='2px';
  if(fixture.partial) {for(const side of sides) result[physical(fixture.family,side)]=side==='top'?'3px':'2px';}
  return result;
}
export async function checkLogicalPhysicalOrder(native,atomic,directory,report) {
  report.simpleFixtures=simpleFixtures.length;
  report.semanticFixtures=semanticFixtures.length;
  report.readings=[];report.authoredReadings=[];report.images=[];report.negativeControls=[];report.compilations=[];
  for(const fixture of [...simpleFixtures,...semanticFixtures]) {
    const semantic=semanticFixtures.includes(fixture),compiled=await compile(fixture);
    report.compilations.push({name:fixture.name,source:fixture.source,exports:compiled.exports,snapshot:compiled.snapshot});
    for(const reverse of [false,true]) {
      await mount(native,fixture,undefined,reverse,semantic);await mount(atomic,fixture,compiled,reverse,semantic);
      // All mode mutations reuse the same emitted CSS, module exports and DOM.
      for(const mode of semantic?modes:[fixture.mode]) {
        const expected=semantic?expectedSemantic(fixture,mode):fixture.gssExpected??fixture.expected;
        const properties=fixture.properties??Object.keys(expected);
        if(fixture.gssOracle) {
          await native.locator('#subject-css').evaluate((node,css)=>{node.textContent=css;},fixture.source);
          const authored=await sample(native,fixture,mode,properties);
          assert.deepEqual(authored.properties,fixture.expected,`${fixture.name}: unchanged authored/native oracle`);
          report.authoredReadings.push({name:fixture.name,mode,reverse,authored});
          await native.locator('#subject-css').evaluate((node,css)=>{node.textContent=css;},fixture.gssOracle);
        }
        const reference=await sample(native,fixture,mode,properties);
        if(expected) assert.deepEqual(reference.properties,expected,`${fixture.name}: independent literal oracle`);
        // Capture while this page still owns the foreground/pointer. Firefox
        // removes hover when the other page is brought forward.
        const referenceImage=fixture.image&&!reverse&&mode===modes[0] ? await native.locator('#target').screenshot() : undefined;
        const actual=await sample(atomic,fixture,mode,properties);
        assert.deepEqual(actual,reference,`${fixture.name}/${mode.writingMode}/${mode.direction}/${reverse}`);
        if(expected) assert.deepEqual(actual.properties,expected,`${fixture.name}: required GSS/native value`);
        report.readings.push({name:fixture.name,mode,reverse,reference,actual});
        if(referenceImage) {
          const a=referenceImage,b=await atomic.locator('#target').screenshot(),comparison=comparePng(b,a);
          const name=fixture.name.replaceAll('/','-');
          await writeFile(join(directory,`logical-${name}-native.png`),a);await writeFile(join(directory,`logical-${name}-compiled.png`),b);
          const {diff,...summary}=comparison;report.images.push({name,...summary});
          if(!comparison.passed) await writeFile(join(directory,`logical-${name}-diff.png`),diff);
          assert.equal(comparison.passed,true,`${fixture.name}: exact RGBA pair`);
        }
      }
    }
    // The exact same oracle must reject deliberately reversed emitted order.
    if(fixture.name==='margin/horizontal-tb/ltr/long-long/false/2'||fixture.name==='prior-nested-scroll/false') {
      const tree=postcss.parse(compiled.snapshot.css);tree.nodes.reverse();
      await atomic.locator('#subject-css').evaluate((node,css)=>{node.textContent=css;},tree.toString());
      const mode=modes[0],expected=semantic?expectedSemantic(fixture,mode):fixture.gssExpected??fixture.expected;
      const corrupted=await sample(atomic,fixture,mode,Object.keys(expected));
      assert.throws(()=>assert.deepEqual(corrupted.properties,expected),assert.AssertionError);
      const property=semantic?'scroll-margin-left':'margin-left';
      assert.equal(expected[property],'2px');
      assert.equal(corrupted.properties[property],'1px');
      report.negativeControls.push({name:fixture.name,expected,corrupted});
    }
  }
  assert.equal(report.simpleFixtures,418);
  assert.equal(report.negativeControls.length,2);
  // The same-rule oracle is deliberately physical-last even when authored in reverse.
  report.sameRuleReadings=[];
  for(const family of ['margin','padding','inset']) for(const reverseSource of [false,true]) {
    const logical=`${family}-inline-start`, phys=physical(family,'left');
    const parts=[`${logical}:1px`,`${phys}:2px`];
    const fixture={name:`same-rule/${family}/${reverseSource}`,family,scopes:['a'],
      source:`.a{${(reverseSource?parts.reverse():parts).join(';')}}`,
      oracle:`.a{${logical}:1px;${phys}:2px}`};
    const compiled=await compile(fixture);
    for(const reverse of [false,true]) {
      await mount(native,fixture,undefined,reverse);await mount(atomic,fixture,compiled,reverse);
      for(const mode of modes) {
        const expected=Object.fromEntries(sides.map(side=>[physical(family,side),'0px']));
        expected[physical(family,mode.inline[0])]='1px';
        expected[phys]='2px';
        const properties=Object.keys(expected);
        const reference=await sample(native,fixture,mode,properties);
        const actual=await sample(atomic,fixture,mode,properties);
        assert.deepEqual(reference.properties,expected,`${fixture.name}: literal oracle`);
        assert.deepEqual(actual,reference,`${fixture.name}/${mode.writingMode}/${mode.direction}/${reverse}`);
        report.sameRuleReadings.push({name:fixture.name,mode,reverse,reference,actual});
      }
    }
  }
}
