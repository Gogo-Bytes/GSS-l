declare const GSS_SCOPE: unique symbol;

export type GssScope<TTargets extends object = Record<never, never>> = {
  readonly self: string;
  readonly [GSS_SCOPE]: true;
} & TTargets;

/** Broad scope shape; actual paths are validated against Compiler ScopeSchema. */
export type GssUnknownScope = GssScope<{
  readonly [target: string]: GssUnknownScope;
}>;

export type GssStyles = Readonly<Record<string, GssUnknownScope>>;
