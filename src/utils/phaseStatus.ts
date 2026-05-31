import type { OfficialResult, StageControl } from "@/lib/bolao";

export type PhaseState =
  | "nao_liberada"
  | "aberta_para_palpites"
  | "em_andamento"
  | "finalizada"
  | "resultados_publicados";

export type BettingPhase = Exclude<StageControl["stage"], "ranking">;
export type ResultPhase = OfficialResult["stage"];

export const bettingPhases: BettingPhase[] = [
  "initial_predictions",
  "group_stage",
  "round_of_32",
  "round_of_16",
  "quarter_finals",
  "semi_finals",
  "final",
];

export const phaseResultStage: Record<BettingPhase, ResultPhase> = {
  initial_predictions: "group_stage",
  group_stage: "group_stage",
  round_of_32: "round_of_32",
  round_of_16: "round_of_16",
  quarter_finals: "quarter_finals",
  semi_finals: "semi_finals",
  final: "final",
};

export const previousResultStageByPhase: Partial<Record<BettingPhase, ResultPhase>> = {
  round_of_32: "group_stage",
  round_of_16: "round_of_32",
  quarter_finals: "round_of_16",
  semi_finals: "quarter_finals",
  final: "semi_finals",
};

export const nextPhaseByResultStage: Partial<Record<ResultPhase, BettingPhase>> = {
  group_stage: "round_of_32",
  round_of_32: "round_of_16",
  round_of_16: "quarter_finals",
  quarter_finals: "semi_finals",
  semi_finals: "final",
};

export function hasResultStarted(result: OfficialResult | undefined) {
  return Boolean(
    (result?.homeGoals !== null && result?.homeGoals !== undefined) ||
      (result?.awayGoals !== null && result?.awayGoals !== undefined) ||
      result?.winnerTeamId,
  );
}

export function isResultComplete(result: OfficialResult | undefined, requireWinner = false) {
  const hasScore =
    result?.homeGoals !== null &&
    result?.homeGoals !== undefined &&
    result?.awayGoals !== null &&
    result?.awayGoals !== undefined;

  if (!hasScore) {
    return false;
  }

  if (!requireWinner || result.homeGoals !== result.awayGoals) {
    return true;
  }

  return Boolean(result.winnerTeamId);
}

export function countStartedResults(results: OfficialResult[], stage: ResultPhase) {
  return results.filter((result) => result.stage === stage && hasResultStarted(result)).length;
}

export function countCompleteResults(results: OfficialResult[], stage: ResultPhase, requireWinner = false) {
  return results.filter((result) => result.stage === stage && isResultComplete(result, requireWinner)).length;
}

export function getPhaseState({
  control,
  isReleased = true,
  now = new Date(),
  requireWinner = false,
  resultStage,
  results,
  totalMatches,
}: {
  control: StageControl | undefined;
  isReleased?: boolean;
  now?: Date;
  requireWinner?: boolean;
  resultStage: ResultPhase;
  results: OfficialResult[];
  totalMatches: number;
}): PhaseState {
  if (!control?.isOpen || !isReleased) {
    return "nao_liberada";
  }

  const completedResults = countCompleteResults(results, resultStage, requireWinner);

  if (totalMatches > 0 && completedResults >= totalMatches) {
    return "resultados_publicados";
  }

  if (countStartedResults(results, resultStage) > 0) {
    return "em_andamento";
  }

  if (control.deadlineAt && now.getTime() >= new Date(control.deadlineAt).getTime()) {
    return "em_andamento";
  }

  return "aberta_para_palpites";
}

export function acceptsPhasePrediction(state: PhaseState) {
  return state === "aberta_para_palpites";
}

export function isPhaseVisible(state: PhaseState) {
  return state !== "nao_liberada";
}

export function phaseStatusLabel(state: PhaseState) {
  const labels: Record<PhaseState, string> = {
    nao_liberada: "Fase nao liberada",
    aberta_para_palpites: "Aberta para palpites",
    em_andamento: "Fase em andamento",
    finalizada: "Fase finalizada",
    resultados_publicados: "Resultados publicados",
  };

  return labels[state];
}

export function phaseNoticeMessage(state: PhaseState) {
  if (state === "nao_liberada") {
    return "Fase ainda nao liberada.";
  }

  if (state === "em_andamento") {
    return "Fase em andamento. Os palpites desta fase ja foram encerrados porque o prazo fechou ou os resultados oficiais comecaram a ser computados. Acompanhe seus resultados no dashboard e na classificacao geral.";
  }

  if (state === "finalizada" || state === "resultados_publicados") {
    return "Fase finalizada. Os resultados ja estao disponiveis no dashboard e na classificacao geral. A proxima fase de palpites esta habilitada.";
  }

  return "Fase aberta para palpites.";
}
