/**
 * Build-time feature flags. Set VITE_FF_<NAME>=true in the build environment to turn one on.
 * Flags only gate UI entry points; data written while a flag was on must still load when it is off.
 */
const FLAGS = {
  intervalHabits: import.meta.env["VITE_FF_INTERVAL_HABITS"],
} as const;

export type FeatureFlag = keyof typeof FLAGS;

export function isFeatureEnabled(
  flag: FeatureFlag,
  env: Partial<Record<FeatureFlag, unknown>> = FLAGS,
): boolean {
  return env[flag] === "true" || env[flag] === true;
}
