/** Physical declarations retain their order and importance. Undefined means
 * the transformer cannot preserve the input; callers decide the fallback. */
export type PhysicalDeclaration = { property: string; value: string; important: boolean };

export type CompatibilityTransformer = {
  expand(declaration: PhysicalDeclaration): readonly PhysicalDeclaration[] | undefined;
  expandResource(css: string, kind: 'property' | 'keyframes' | 'font-face'): string | undefined;
};
