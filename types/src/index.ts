declare const GSS_SCOPE: unique symbol;

/**
 * A compile-time GSS path reference. The React/Vite Adapter lowers each
 * statically verified reference to its primitive class string before runtime.
 * The recursive index keeps ordinary TypeScript consumers from rejecting a
 * source-level reference before that lowering occurs; the Compiler remains
 * responsible for validating actual paths against ScopeSchema.
 */
export type GssScope<TTargets extends object = Record<never, never>> = string & {
  /** Backward-compatible explicit terminal access. */
  readonly self: string;
  readonly [GSS_SCOPE]: true;
} & TTargets;

/** Broad source-reference shape; actual paths are validated by the Adapter. */
export type GssUnknownScope = GssScope<{
  readonly [target: string]: GssUnknownScope;
}>;

export type GssStyles = Readonly<Record<string, GssUnknownScope>>;
