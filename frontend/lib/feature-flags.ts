// Feature flags: every flag defaults to off. Enable one for an environment by
// adding its name to the comma-separated NEXT_PUBLIC_FEATURE_FLAGS env var
// (see .env.example). No flag names are hardcoded here -- callers pass
// whatever name they choose, e.g. isFeatureEnabled("new_scoring_ui").

function enabledFlags(): Set<string> {
  const raw = process.env.NEXT_PUBLIC_FEATURE_FLAGS || ""
  return new Set(
    raw
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name.length > 0)
  )
}

export function isFeatureEnabled(flagName: string): boolean {
  return enabledFlags().has(flagName.trim().toLowerCase())
}
