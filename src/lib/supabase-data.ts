import type {
  AppData,
  InitialPrediction,
  KnockoutPrediction,
  Match,
  MatchPrediction,
  OfficialResult,
  Participant,
  ParticipantStatus,
  StageControl,
  Team,
} from "@/lib/bolao";
import { createClient } from "@/utils/supabase/client";

export type BackendSnapshot = Partial<AppData> & {
  currentParticipantId?: string | null;
  isAuthenticated?: boolean;
};

type BackendLoginPayload = {
  sessionToken: string;
  participant: BackendParticipant;
  state: unknown;
};

type BackendParticipant = {
  id: string;
  name: string;
  nickname?: string;
  email: string;
  status: ParticipantStatus;
  role: Participant["role"];
  createdAt: string;
  updatedAt: string;
};

type InitialPredictionInput = Pick<
  InitialPrediction,
  "championTeamId" | "runnerUpTeamId" | "topScorer" | "bestPlayer"
>;

type MatchPredictionInput = Pick<MatchPrediction, "matchId" | "homeGoals" | "awayGoals">;

type KnockoutPredictionInput = Pick<
  KnockoutPrediction,
  "matchId" | "homeTeamId" | "awayTeamId" | "homeGoals" | "awayGoals" | "winnerTeamId"
>;

type ParticipantInput = {
  id?: string | null;
  name: string;
  email: string;
  password?: string;
  status: ParticipantStatus;
};

type OfficialResultInput = Pick<
  OfficialResult,
  "stage" | "matchId" | "homeTeamId" | "awayTeamId" | "homeGoals" | "awayGoals" | "winnerTeamId"
> & {
  round?: number;
  group?: string | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asArray<T>(value: unknown): T[] | undefined {
  return Array.isArray(value) ? (value as T[]) : undefined;
}

function mapParticipant(participant: BackendParticipant): Participant {
  return {
    id: participant.id,
    name: participant.name,
    nickname: participant.nickname ?? participant.name,
    email: participant.email,
    passwordHash: "",
    status: participant.status,
    role: participant.role,
    createdAt: participant.createdAt,
    updatedAt: participant.updatedAt,
  };
}

function normalizeBackendState(raw: unknown, isAuthenticated: boolean): BackendSnapshot {
  const state = (raw ?? {}) as Record<string, unknown>;
  const participants = asArray<BackendParticipant>(state.participants);

  return {
    currentParticipantId: typeof state.currentParticipantId === "string" ? state.currentParticipantId : null,
    isAuthenticated,
    participants: participants?.map(mapParticipant),
    teams: asArray<Team>(state.teams),
    matches: asArray<Match>(state.matches),
    initialPredictions: isAuthenticated ? (asArray<InitialPrediction>(state.initialPredictions) ?? []) : undefined,
    matchPredictions: isAuthenticated ? (asArray<MatchPrediction>(state.matchPredictions) ?? []) : undefined,
    knockoutPredictions: isAuthenticated ? (asArray<KnockoutPrediction>(state.knockoutPredictions) ?? []) : undefined,
    officialResults: asArray<OfficialResult>(state.officialResults),
    stageControls: asArray<StageControl>(state.stageControls),
  };
}

function ensureData<T>(data: T | null, error: { message?: string } | null): T {
  if (error) {
    throw new Error(error.message ?? "Erro ao comunicar com o Supabase.");
  }

  if (data === null || data === undefined) {
    throw new Error("Supabase não retornou dados.");
  }

  return data;
}

export function mergeBackendSnapshot(current: AppData, snapshot: BackendSnapshot): AppData {
  return {
    ...current,
    participants: snapshot.participants?.length ? snapshot.participants : current.participants,
    teams: snapshot.teams?.length ? snapshot.teams : current.teams,
    matches: snapshot.matches?.length ? snapshot.matches : current.matches,
    initialPredictions:
      snapshot.isAuthenticated && snapshot.initialPredictions ? snapshot.initialPredictions : current.initialPredictions,
    matchPredictions:
      snapshot.isAuthenticated && snapshot.matchPredictions ? snapshot.matchPredictions : current.matchPredictions,
    knockoutPredictions:
      snapshot.isAuthenticated && snapshot.knockoutPredictions ? snapshot.knockoutPredictions : current.knockoutPredictions,
    officialResults: snapshot.officialResults ?? current.officialResults,
    stageControls: snapshot.stageControls?.length ? snapshot.stageControls : current.stageControls,
  };
}

export async function loadBackendSnapshot(sessionToken?: string | null) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("app_get_state", {
    p_session_token: sessionToken ?? null,
  });

  return normalizeBackendState(ensureData(data, error), Boolean(sessionToken));
}

export async function loginWithBackend(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("app_login", {
    p_email: email,
    p_password: password,
  });
  const payload = ensureData(data as BackendLoginPayload | null, error);
  const state = normalizeBackendState(payload.state, true);

  return {
    sessionToken: payload.sessionToken,
    participant: mapParticipant(payload.participant),
    state,
  };
}

export async function saveInitialPredictionToBackend(sessionToken: string, prediction: InitialPredictionInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("app_save_initial_prediction", {
    p_session_token: sessionToken,
    p_champion_team_id: prediction.championTeamId,
    p_runner_up_team_id: prediction.runnerUpTeamId,
    p_top_scorer: prediction.topScorer,
    p_best_player: prediction.bestPlayer,
  });

  return normalizeBackendState(ensureData(data, error), true);
}

export async function saveMatchPredictionsToBackend(sessionToken: string, predictions: MatchPredictionInput[]) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("app_save_match_predictions", {
    p_session_token: sessionToken,
    p_predictions: predictions,
  });

  return normalizeBackendState(ensureData(data, error), true);
}

export async function saveKnockoutPredictionsToBackend(
  sessionToken: string,
  stage: KnockoutPrediction["stage"],
  predictions: KnockoutPredictionInput[],
) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("app_save_knockout_predictions", {
    p_session_token: sessionToken,
    p_stage: stage,
    p_predictions: predictions,
  });

  return normalizeBackendState(ensureData(data, error), true);
}

export async function adminUpsertParticipantToBackend(sessionToken: string, participant: ParticipantInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("app_admin_upsert_participant", {
    p_session_token: sessionToken,
    p_participant_id: participant.id && uuidPattern.test(participant.id) ? participant.id : null,
    p_name: participant.name,
    p_email: participant.email,
    p_password: participant.password?.trim() ? participant.password : null,
    p_status: participant.status,
  });

  return normalizeBackendState(ensureData(data, error), true);
}

export async function adminToggleParticipantToBackend(sessionToken: string, participantId: string) {
  if (!uuidPattern.test(participantId)) {
    throw new Error("Participante local ainda não existe no Supabase.");
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("app_admin_toggle_participant", {
    p_session_token: sessionToken,
    p_participant_id: participantId,
  });

  return normalizeBackendState(ensureData(data, error), true);
}

export async function adminUpdateStageControlToBackend(
  sessionToken: string,
  stage: StageControl["stage"],
  isOpen: boolean,
  deadlineAt?: string | null,
) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("app_admin_update_stage_control", {
    p_session_token: sessionToken,
    p_stage: stage,
    p_is_open: isOpen,
    p_deadline_at: deadlineAt ?? null,
  });

  return normalizeBackendState(ensureData(data, error), true);
}

export async function adminRecordOfficialResultToBackend(sessionToken: string, result: OfficialResultInput) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("app_admin_record_official_result", {
    p_session_token: sessionToken,
    p_stage: result.stage,
    p_match_id: result.matchId,
    p_home_team_id: result.homeTeamId,
    p_away_team_id: result.awayTeamId,
    p_home_goals: result.homeGoals,
    p_away_goals: result.awayGoals,
    p_winner_team_id: result.winnerTeamId ?? null,
    p_round: result.round ?? 1,
    p_group_code: result.group ?? null,
  });

  return normalizeBackendState(ensureData(data, error), true);
}
