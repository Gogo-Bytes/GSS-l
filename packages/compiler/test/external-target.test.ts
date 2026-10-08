import { describe, expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

const id = '/project/editor.gss';
const source = '.editor :global(.ProseMirror-focused) { color: red; }';

describe('anchored external declaration target', () => {
  it('exports only the owned anchor and emits a native descendant selector without adding a class to the external node', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source });
    expect(result).toMatchObject({ committed: true, diagnostics: [] });
    const schema = session.getScopeSchema(id)!;
    expect(Object.keys(schema.exports)).toEqual(['editor']);
    expect(schema.exports.editor!.targets).toEqual({});
    const anchor = schema.exports.editor!.selfClassName;
    expect(anchor).not.toBe('');
    const css = session.finalize().css;
    expect(css).toContain(`.${anchor} .ProseMirror-focused {\n  color: red;\n}`);
    expect(css).not.toContain(':global(');
    expect(schema.exports).not.toHaveProperty('ProseMirror-focused');
  });

  it('keeps an externally supplied compound class as one native target without exporting either class', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source:
      '.editor :global(.ProseMirror.ProseMirror-focused) { color: red; }'
    });
    expect(result).toMatchObject({ committed: true, diagnostics: [] });
    const schema = session.getScopeSchema(id)!;
    expect(Object.keys(schema.exports)).toEqual(['editor']);
    expect(schema.exports.editor!.targets).toEqual({});
    const anchor = schema.exports.editor!.selfClassName;
    expect(session.finalize().css).toContain(
      `.${anchor} .ProseMirror.ProseMirror-focused {\n  color: red;\n}`
    );
    expect(JSON.stringify(schema)).not.toContain('ProseMirror-focused');
  });

  it('uses an external class on the owned node as a condition, not as an external declaration target', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source:
      '.editor:global(.ProseMirror-focused) { color: red; }'
    });
    expect(result).toMatchObject({ committed: true, diagnostics: [] });
    const schema = session.getScopeSchema(id)!;
    expect(Object.keys(schema.exports)).toEqual(['editor']);
    expect(schema.exports.editor!.targets).toEqual({});
    const ownedClass = schema.exports.editor!.selfClassName;
    expect(session.finalize().css).toContain(
      `.${ownedClass}.ProseMirror-focused {\n  color: red;\n}`
    );
    expect(JSON.stringify(schema)).not.toContain('ProseMirror-focused');
  });

  it('preserves owned ancestors and same-node class specificity without adding a class to external nodes', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source:
      '.outer .editor:global(.ProseMirror-focused) { color: red; }'
    });
    expect(result).toMatchObject({ committed: true, diagnostics: [] });
    const outer = session.getScopeSchema(id)!.exports.outer!;
    const editor = outer.targets.editor!;
    expect(session.finalize().css).toContain(
      `.${outer.selfClassName} .${editor.selfClassName}.ProseMirror-focused {\n  color: red;\n}`
    );
  });

  it.each([
    '.editor { color: blue; } .editor:global(.ProseMirror-focused) { color: red; }',
    '.editor:global(.ProseMirror-focused) { color: red; } .editor { color: blue; }'
  ])('lets a proven same-node external class refine one normal base property in either source order: %s', (source) => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source });
    expect(result).toMatchObject({ committed: true, diagnostics: [] });
    const schema = session.getScopeSchema(id)!;
    expect(Object.keys(schema.exports)).toEqual(['editor']);
    const classes = schema.exports.editor!.selfClassName.split(' ');
    expect(classes).toHaveLength(2);
    const css = session.finalize().css;
    expect(css).toContain('color: blue;');
    expect(css).toContain('color: red;');
    expect(css).toContain('.ProseMirror-focused {');
  });

  it('rejects unproved mixed same-node external conditions transactionally', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id, source }).committed).toBe(true);
    const previous = session.finalize();
    for (const unsupported of [
      '.editor { margin: 1px; } .editor:global(.ProseMirror-focused) { margin-left: 2px; }',
      '.editor { color: blue !important; } .editor:global(.ProseMirror-focused) { color: red; }',
      '.outer .editor { color: blue; } .outer .editor:global(.ProseMirror-focused) { color: red; }',
      '.editor:global(.ProseMirror-focused) { unregistered-shorthand: value; }',
      '.editor:global(.ProseMirror-focused) .child { color: red; }',
      '.editor:global(.ProseMirror-focused):hover { color: red; }'
    ]) {
      const result = session.replaceStylesheet({ id, source: unsupported });
      expect(result).toMatchObject({ committed: false, generation: 1,
        diagnostics: [{ code: 'GSS1101', reason: 'capability-not-registered' }] });
      expect(session.finalize()).toEqual(previous);
    }
  });

  it('observes an explicit external class inside :has without exporting or classing that node', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source:
      '.editor:has(:global(.ProseMirror-focused)) { color: red; }'
    });
    expect(result).toMatchObject({ committed: true, diagnostics: [] });
    const schema = session.getScopeSchema(id)!;
    expect(Object.keys(schema.exports)).toEqual(['editor']);
    expect(schema.exports.editor!.targets).toEqual({});
    const css = session.finalize().css;
    expect(css).toContain(':has(.ProseMirror-focused)');
    expect(css).not.toContain(':global(');
    expect(JSON.stringify(schema)).not.toContain('ProseMirror-focused');
  });

  it.each([
    '.input:checked + .label { color: red; } .input .label:has(:global(.external)) { color: blue; }',
    '.input:checked:disabled + .label { color: red; } .input .label:has(:global(.external.active)) { color: blue; }'
  ])('rejects coactive structural and external observations at equal native specificity: %s', (unsafe) => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id, source: '.label { color: green; }' }).committed).toBe(true);
    const previous = session.finalize();
    const result = session.replaceStylesheet({ id, source: unsafe });
    expect(result).toMatchObject({ committed: false, generation: 1,
      diagnostics: [{ code: 'GSS1205', reason: 'ambiguous-coactive-state-conflict' }] });
    expect(session.finalize()).toEqual(previous);
  });

  it('rejects an unsupported external :has list without a specificity proof transactionally', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id, source }).committed).toBe(true);
    const previous = session.finalize();
    const result = session.replaceStylesheet({ id, source:
      '.editor:has(:global(.ProseMirror-focused), .owned) { color: red; }'
    });
    expect(result).toMatchObject({ committed: false, generation: 1,
      diagnostics: [{ code: 'GSS1101', reason: 'capability-not-registered' }] });
    expect(session.finalize()).toEqual(previous);
  });

  it.each([
    [':not(:global(.external))', ':not(.external)'],
    [':is(:global(.external))', ':is(.external)'],
    [':where(:global(.external))', ':where(.external)'],
    [':is(:global(.external), :global(.another))', ':is(.another,.external)']
  ])('keeps a single external class inside %s as a browser-matched owned-node condition', (authored, native) => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source: `.editor${authored} { color: red; }` });
    expect(result).toMatchObject({ committed: true, diagnostics: [] });
    const schema = session.getScopeSchema(id)!;
    expect(Object.keys(schema.exports)).toEqual(['editor']);
    expect(schema.exports.editor!.targets).toEqual({});
    expect(session.finalize().css).toContain(`${native} {\n  color: red;\n}`);
    expect(session.finalize().css).not.toContain(':global(');
  });

  it('rejects an unproved external compound inside a functional condition with rollback', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id, source }).committed).toBe(true);
    const previous = session.finalize();
    const result = session.replaceStylesheet({ id, source:
      '.editor:not(:global(.external.active)) { color: blue; }'
    });
    expect(result).toMatchObject({ committed: false, generation: 1,
      diagnostics: [{ code: 'GSS1101', reason: 'capability-not-registered' }] });
    expect(session.finalize()).toEqual(previous);
  });

  it('keeps owned declarations and external targets separate in one Module', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source:
      '.editor { display: block; } .editor :global(.ProseMirror-focused) { color: red; }'
    });
    expect(result).toMatchObject({ committed: true, diagnostics: [] });
    const anchor = session.getScopeSchema(id)!.exports.editor!.selfClassName;
    expect(anchor).toContain('gss-a--');
    expect(session.finalize().css).toContain(' .ProseMirror-focused {\n  color: red;\n}');
  });

  it('does not conflate logical properties on an owned anchor with physical properties on its external descendant', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source:
      '.editor { margin-inline: 1px; } .editor :global(.ProseMirror-focused) { margin-left: 2px; }'
    });
    expect(result).toMatchObject({ committed: true, diagnostics: [] });
  });

  it('rejects logical/physical overlap on the same external target', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source:
      '.editor :global(.ProseMirror-focused) { margin-inline: 1px; margin-left: 2px; }'
    });
    expect(result).toMatchObject({ committed: false,
      diagnostics: [{ code: 'GSS1206', reason: 'logical-physical-property-conflict' }] });
  });

  it('retains every owned ancestor and authored class specificity before the external target', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source:
      '.outer .editor :global(.ProseMirror-focused) { color: red; }'
    });
    expect(result).toMatchObject({ committed: true, diagnostics: [] });
    const schema = session.getScopeSchema(id)!;
    expect(Object.keys(schema.exports)).toEqual(['outer']);
    const outer = schema.exports.outer!;
    const editor = outer.targets.editor!;
    expect(outer.selfClassName).not.toBe('');
    expect(editor.selfClassName).not.toBe('');
    expect(editor.targets).toEqual({});
    expect(session.finalize().css).toContain(
      `.${outer.selfClassName} .${editor.selfClassName} .ProseMirror-focused {\n  color: red;\n}`
    );
    expect(JSON.stringify(schema)).not.toContain('ProseMirror-focused');
  });

  it('retains registered media and authored layer around an external target', () => {
    const session = createGssCompilerSession({
      projectRoot: '/project', layers: ['base'], conditions: { media: ['(min-width: 400px)'] }
    });
    const result = session.replaceStylesheet({ id, source:
      '@layer base { @media (min-width: 400px) { .editor :global(.ProseMirror-focused) { color: red; } } }'
    });
    expect(result).toMatchObject({ committed: true, diagnostics: [] });
    expect(session.getScopeSchema(id)!.exports.editor!.selfClassName).not.toBe('');
    const css = session.finalize().css;
    expect(css).toContain('@layer base;');
    expect(css).toContain('@layer base {\n  @media (min-width: 400px) {');
    expect(css).toContain(' .ProseMirror-focused {\n      color: red;');
    expect(css).not.toContain(':global(');
  });

  it('warns on an unregistered media query without inventing precedence', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source:
      '@media (min-width: 400px) { .editor :global(.ProseMirror-focused) { color: red; } }'
    });
    expect(result).toMatchObject({ committed: true,
      diagnostics: [{ code: 'GSS1102', severity: 'warning', reason: 'condition-not-registered' }] });
    expect(session.finalize().css).toContain('@media (min-width: 400px) {');
  });

  it('keeps competing external effects across conditions fail-closed', () => {
    const session = createGssCompilerSession({
      projectRoot: '/project', conditions: { media: ['(min-width: 400px)', '(min-width: 600px)'] }
    });
    const result = session.replaceStylesheet({ id, source: [
      '@media (min-width: 400px) { .editor :global(.ProseMirror-focused) { color: red; } }',
      '@media (min-width: 600px) { .editor :global(.ProseMirror-focused) { color: blue; } }'
    ].join(' ') });
    expect(result).toMatchObject({ committed: false, generation: 0,
      diagnostics: [{ code: 'GSS1205', reason: 'ambiguous-coactive-state-conflict' }] });
  });

  it('rejects overlapping external effects without a proved winner', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source: source +
      ' .editor :global(.ProseMirror-focused.active) { color: blue; }'
    });
    expect(result).toMatchObject({ committed: false, generation: 0,
      diagnostics: [{ code: 'GSS1205', reason: 'ambiguous-coactive-state-conflict' }] });
    expect(session.finalize().css).toBe('');
  });

  it('rejects unanchored or unsupported external placements transactionally', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id, source }).committed).toBe(true);
    const previous = session.finalize();
    const schema = session.getScopeSchema(id);
    for (const unsupported of [
      ':global(.ProseMirror-focused) { color: blue; }',
      '.editor :global(.ProseMirror-focused):hover { color: blue; }',
      '.editor :global(.ProseMirror-focused) .child { color: blue; }',
      '.editor :global(.ProseMirror-focused) { unregistered-shorthand: blue; }'
    ]) {
      const result = session.replaceStylesheet({ id, source: unsupported });
      expect(result).toMatchObject({ committed: false, generation: 1,
        diagnostics: [{ code: 'GSS1101', reason: 'capability-not-registered' }] });
      expect(session.finalize()).toEqual(previous);
      expect(session.getScopeSchema(id)).toEqual(schema);
    }
  });
});
