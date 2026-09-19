declare const GSS_SCOPE: unique symbol;

export type GssScope<TTargets extends object = Record<never, never>> = {
  readonly self: string;
  readonly [GSS_SCOPE]: true;
} & TTargets;
