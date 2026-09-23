import { describe, expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

const moduleId = '/project/src/card.gss';
const specificityList = '.card:has(.error, .warning:hover) { color: red; }';
const competingRule = '.card[data-active="yes"] { color: blue; }';

describe('observed selector-list specificity', () => {
  it.each([false, true])('retains list-maximum specificity on every observed branch (reverse=%s)', (reverse) => {
    const source = (reverse ? [competingRule, specificityList] : [specificityList, competingRule]).join('\n');
    const compiler = createGssCompilerSession({ projectRoot: '/project' });
    const replacement = compiler.replaceStylesheet({ id: moduleId, source });
    const css = compiler.finalize().css;
    const subject = replacement.module?.scopeSchema.exports.card?.selfClassName.split(' ')
      .find((name) => name.includes('--observed_error'));
    const observed = replacement.module?.scopeSchema.exports.error?.selfClassName;

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    expect(subject).toBe('gss-hs--module_src_2f_card_2e_gss--subject_card--relation_descendant--observed_error');
    expect(observed).toBeDefined();
    const warningSubject = replacement.module?.scopeSchema.exports.card?.selfClassName.split(' ')
      .find((name) => name.includes('--state_hover--observed_warning'));
    const warningObserved = replacement.module?.scopeSchema.exports.warning?.selfClassName.split(' ')
      .find((name) => name.includes('--observed_warning'));
    expect(warningSubject).toBeDefined();
    expect(warningObserved).toBeDefined();
    expect(css).toContain(
      `.${subject}.${subject}.${subject}:has(:where(.${observed})) {\n  color: red;\n}`
    );
    expect(css).toContain(
      `.${warningSubject}.${warningSubject}.${warningSubject}:has(:where(.${warningObserved}:hover)) {\n  color: red;\n}`
    );
    const blueRule = css.split('\n\n').find((rule) => rule.includes('color: blue;'));
    expect(blueRule).toContain('[data-active="yes"]');
    expect(blueRule).not.toContain(subject);
  });

  it.each([false, true])('retains the strongest shared branch when list order changes (strongerFirst=%s)', (strongerFirst) => {
    const weaker = '.card:has(.error, .warning) { color: red; }';
    const stronger = '.card:has(.error, .warning:hover) { color: red; }';
    const rules = strongerFirst ? [stronger, weaker] : [weaker, stronger];
    const source = [...rules, weaker, '.card:hover { color: blue; }'].join('\n');
    const compiler = createGssCompilerSession({ projectRoot: '/project' });
    const replacement = compiler.replaceStylesheet({ id: moduleId, source });
    const css = compiler.finalize().css;
    const redRules = css.split('\n\n').filter((rule) => rule.includes('color: red;'));
    const subject = replacement.module?.scopeSchema.exports.card?.selfClassName.split(' ')
      .find((name) => name.includes('--observed_error'));
    const observed = replacement.module?.scopeSchema.exports.error?.selfClassName;

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    expect(subject).toBeDefined();
    expect(observed).toBeDefined();
    const errorRules = redRules.filter((rule) => rule.includes(`:has(:where(.${observed}))`));
    expect(errorRules).toHaveLength(2);
    expect(errorRules.some((rule) => rule.includes(`${`.${subject}`.repeat(2)}:has`))).toBe(true);
    expect(errorRules.some((rule) => rule.includes(`${`.${subject}`.repeat(3)}:has`))).toBe(true);
    expect(redRules).toHaveLength(4);
    expect(css).toContain('color: blue;');
  });

  it('keeps deduplicated specificity emissions through replacement and failed LKG updates', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });
    const weaker = '.card:has(.error, .warning) { color: red; }';
    const stronger = '.card:has(.error, .warning:hover) { color: red; }';
    const accepted = compiler.replaceStylesheet({
      id: moduleId,
      source: [stronger, weaker, '.card:hover { color: blue; }'].join('\n')
    });
    const beforeFailure = compiler.finalize().css;
    const rejected = compiler.replaceStylesheet({
      id: moduleId,
      source: '.card:unknown { color: green; }'
    });

    expect(accepted).toMatchObject({ committed: true, diagnostics: [] });
    expect(beforeFailure.match(/color: red;/g)).toHaveLength(4);
    expect(rejected.committed).toBe(false);
    expect(compiler.finalize().css).toBe(beforeFailure);
  });

  it('pads residual tag branches without adding their lower type specificity', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });
    const replacement = compiler.replaceStylesheet({
      id: moduleId,
      source: '.card:has(button, .error) { color: red; }'
    });
    const css = compiler.finalize().css;
    const subject = replacement.module?.scopeSchema.exports.card?.selfClassName.split(' ')
      .find((name) => name.includes('--residual_'));
    const errorSubject = replacement.module?.scopeSchema.exports.card?.selfClassName.split(' ')
      .find((name) => name.includes('--observed_error'));
    const observed = replacement.module?.scopeSchema.exports.error?.selfClassName;

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    expect(subject).toBeDefined();
    expect(errorSubject).toBeDefined();
    expect(observed).toBeDefined();
    expect(css).toContain(`.${subject}.${subject}:has(:where(button)) {\n  color: red;\n}`);
    expect(css).toContain(`.${errorSubject}.${errorSubject}:has(:where(.${observed})) {\n  color: red;\n}`);
  });
});
