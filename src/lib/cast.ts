export type CastKind = "file" | "youtube";

export type CastDecisionInput = {
  kind: CastKind;
  deviceAvailable: boolean;
};

export type CastDecision = "prompt" | "hidden";

export function castDecision({ kind, deviceAvailable }: CastDecisionInput): CastDecision {
  if (kind === "youtube") {
    return "hidden";
  }

  if (kind === "file" && deviceAvailable) {
    return "prompt";
  }

  return "hidden";
}
