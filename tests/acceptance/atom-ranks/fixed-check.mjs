/* global document, window, getComputedStyle, requestAnimationFrame */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import postcss from 'postcss';
import { createGssCompilerSession } from '@gss-l/compiler';
import { comparePng } from '../task-board/visual.mjs';
import { fixedFixtures, states } from './fixed-fixtures.mjs';

const normalization = `html{font:16px/1.5 sans-serif;background:white} body{margin:20px}
button,input{display:block;box-sizing:border-box;width:160px;height:48px;margin:0;padding:4px;background-color:gray;color:black;border:1px solid black;border-radius:0;font:inherit}
#sink{position:fixed;left:700px;top:650px;width:20px;height:20px}
#target::before,#target::after{content:'test'}`;

async function compile(fixture) {
  const session = createGssCompilerSession({ projectRoot: '/fixed-ranks' });
  const replacement = session.replaceStylesheet({id:'/fixed-ranks/Case.gss',source:fixture.source});
  assert.equal(replacement.committed,true,JSON.stringify(replacement.diagnostics));
  assert.deepEqual(replacement.diagnostics,[]);
  assert.equal(replacement.module.compilationMode,'atomic');
  const exports = (await import(`data:text/javascript,${encodeURIComponent(replacement.module.moduleCode)}`)).default;
  const schema = session.getScopeSchema('/fixed-ranks/Case.gss');
  const classes = (path) => {
    let value = exports, node = {targets:schema.exports};
    for (const part of path.split('.')) { value = value?.[part]; node = node?.targets[part]; }
    assert.equal(value?.self,node?.selfClassName);
    return value?.self ?? '';
  };
  return {snapshot:session.finalize(),exports,classes};
}
async function mount(page, fixture, compiled, reverse) {
  const template = fixture.template ?? `<button id="target" class="{{${fixture.scopes.join(' ')}}}">target</button>`;
  const html = template.replaceAll(/\{\{([^}]+)\}\}/g, (_, paths) => {
    const classes = paths.split(' ').flatMap((path) => (compiled ? compiled.classes(path) : path.replaceAll('.','-')).split(' '));
    return (reverse ? classes.reverse() : classes).join(' ');
  });
  await page.setContent(`<style>${normalization}${fixture.nativeAppearance ? '' : 'input{appearance:none}'}</style><style id="subject-css">${compiled ? compiled.snapshot.css : fixture.nativeCss}</style><button id="sink" tabindex="-1">reset</button>${html}`);
  await page.locator('#target').evaluate((node) => {
    node.setAttribute('aria-pressed','false');
    node.addEventListener('click',()=>node.setAttribute('aria-pressed',String(node.getAttribute('aria-pressed')!=='true')));
  });
}
async function sample(page, fixture, state) {
  await page.bringToFront();
  await page.evaluate(()=>window.scrollTo(0,0));
  const target = page.locator('#target');
  if ((await target.getAttribute('aria-pressed')==='true')!==state.pressed) await target.click();
  await page.locator('#sink').click();
  if(state.focus) await target.focus();
  await page.mouse.move(0,0);
  if(state.hover) await target.hover();
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  const result = await target.evaluate((node,pseudo)=>{
    const style=getComputedStyle(node),subject=getComputedStyle(node,pseudo),rect=node.getBoundingClientRect();
    return {background:style.backgroundColor,color:subject.color,border:style.borderTopColor,marginLeft:style.marginLeft,
      geometry:[rect.x,rect.y,rect.width,rect.height],scroll:[window.scrollX,window.scrollY],
      hover:document.querySelector('#target:hover')===node,focus:document.activeElement===node,pressed:node.getAttribute('aria-pressed')==='true',
      checked:node.matches(':checked'),disabled:node.matches(':disabled'),after:getComputedStyle(node,'::after').color,
      has:node.matches(':has(.external)'),visibility:document.visibilityState};
  },fixture.pseudo ?? null);
  assert.deepEqual({hover:result.hover,focus:result.focus,pressed:result.pressed},state);
  assert.equal(result.checked,fixture.checked ?? false);assert.equal(result.disabled,fixture.disabled ?? false);
  assert.equal(result.visibility,'visible');assert.deepEqual(result.scroll,[0,0]);
  if (fixture.after) assert.equal(result.after,fixture.after);
  if (fixture.opaque) assert.equal(result.has,true);
  return result;
}
const image = (page) => page.locator('#target').screenshot({animations:'disabled',caret:'hide'});

export async function checkFixedModuleRanks(native, atomic, directory, report) {
  for (const fixture of fixedFixtures) {
    const compiled = await compile(fixture);
    report.fixtures.push({name:fixture.name,source:fixture.source,nativeCss:fixture.nativeCss,exports:compiled.exports,snapshot:compiled.snapshot,
      targetClassReferences:fixture.scopes.flatMap((scope)=>compiled.classes(scope).split(' ')).length,
      distinctTargetClasses:new Set(fixture.scopes.flatMap((scope)=>compiled.classes(scope).split(' '))).size});
    for (const reverse of [false,true]) {
      await mount(native,fixture,undefined,reverse);await mount(atomic,fixture,compiled,reverse);
      for (const [index,stateName] of fixture.stateNames.entries()) {
        const state=states[stateName],expectation=fixture.expected[index];
        const reference=await sample(native,fixture,state);
        for(const [property,value] of Object.entries(expectation)) assert.equal(reference[property],value,`${fixture.name}/${stateName}: independent reference ${property}`);
        const referenceImage=!reverse ? await image(native):undefined;
        const actual=await sample(atomic,fixture,state);
        for(const [property,value] of Object.entries(expectation)) assert.equal(actual[property],value,`${fixture.name}/${stateName}: compiled ${property}`);
        assert.deepEqual(actual,reference,`${fixture.name}/${stateName}/${reverse}: exact computed/state/geometry parity`);
        report.comparisons.push({name:fixture.name,stateName,reverse,expectation,reference,actual});
        if(referenceImage){
          const actualImage=await image(atomic),comparison=comparePng(actualImage,referenceImage),name=`fixed-${fixture.name}-${stateName}`;
          await writeFile(join(directory,`${name}-native.png`),referenceImage);await writeFile(join(directory,`${name}-compiled.png`),actualImage);
          const {diff,...summary}=comparison;report.images.push({name,...summary});
          if(!comparison.passed) await writeFile(join(directory,`${name}-diff.png`),diff);
          assert.equal(comparison.passed,true,`${name}: exact RGBA pair`);
        }
      }
    }
    if(fixture.name==='02-unranked-base-conflict'||fixture.corruptNested){
      const state=states[fixture.stateNames.at(-1)];
      const reference=await sample(native,fixture,state),referenceImage=await image(native);
      const tree=postcss.parse(compiled.snapshot.css);
      tree.nodes.reverse();
      await atomic.locator('#subject-css').evaluate((node,css)=>{node.textContent=css;},tree.toString());
      const corrupted=await sample(atomic,fixture,state),actualImage=await image(atomic);
      const property=fixture.corruptNested?'marginLeft':'background';
      assert.notEqual(corrupted[property],reference[property]);
      const comparison=comparePng(actualImage,referenceImage);
      // Margin reset changes raw geometry, not the target's cropped paint.
      if(fixture.corruptNested) assert.notDeepEqual(corrupted.geometry,reference.geometry);
      else assert.equal(comparison.passed,false);
      report.negativeControls.push({name:fixture.name,property,reference,corrupted,differentPixels:comparison.differentPixels});
    }
  }
  return report;
}
