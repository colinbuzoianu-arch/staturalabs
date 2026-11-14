// P16 §2 / sandbox-readiness rule 4: ONE resolver for environment-driven
// defaults, keyed on APP_ENVIRONMENT (production | sandbox). No per-environment
// `if` scattered through pages. Today APP_ENVIRONMENT is unset → "production".
export type AppEnvironment = "production" | "sandbox";

export function appEnvironment(): AppEnvironment {
  return process.env.APP_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
}

// Default engine-flag state for a tenant with no explicit EngineFlagSetting.
// production → OFF (new tenants see nothing; the demo tenant is set to PREVIEW by
// its seed). sandbox → PREVIEW (branch prepared; the sandbox milestone uses it).
// VALIDATED is NEVER a default — it is only ever set deliberately, guarded by a
// review record.
export function defaultEngineFlagState(
  env: AppEnvironment = appEnvironment(),
): "OFF" | "PREVIEW" {
  return env === "sandbox" ? "PREVIEW" : "OFF";
}

// Pure: the EFFECTIVE engine state. No setting → the environment default. A
// VALIDATED setting with no matching review (e.g. the engine version was bumped)
// fails safe to PREVIEW — adoption never proceeds without a current review.
export function effectiveEngineState(
  settingState: "OFF" | "PREVIEW" | "VALIDATED" | null,
  hasCurrentReview: boolean,
  env: AppEnvironment = appEnvironment(),
): "OFF" | "PREVIEW" | "VALIDATED" {
  if (settingState === null) return defaultEngineFlagState(env);
  if (settingState === "VALIDATED" && !hasCurrentReview) return "PREVIEW";
  return settingState;
}
