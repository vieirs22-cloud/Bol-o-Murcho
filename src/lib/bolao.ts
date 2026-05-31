import fixture from "./bolao-fixture.json";

export type ParticipantStatus = "active" | "inactive";
export type ParticipantRole = "participant" | "admin";

export type Participant = {
  id: string;
  name: string;
  nickname: string;
  email: string;
  passwordHash: string;
  groupName?: string;
  status: ParticipantStatus;
  role: ParticipantRole;
  createdAt: string;
  updatedAt: string;
};

export type Team = {
  id: string;
  name: string;
  code: string;
  flagEmoji: string;
  flagAsset?: string;
  group: string;
};

export type Match = {
  id: string;
  group: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  startsAt: string;
  status: "scheduled" | "live" | "finished";
};

export type InitialPrediction = {
  id: string;
  participantId: string;
  championTeamId: string;
  runnerUpTeamId: string;
  topScorer: string;
  bestPlayer: string;
  submittedAt: string;
  updatedAt: string;
};

export type MatchPrediction = {
  id: string;
  participantId: string;
  matchId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  submittedAt?: string;
  updatedAt?: string;
};

export type OfficialResult = {
  id: string;
  stage: "group_stage" | "round_of_32" | "round_of_16" | "quarter_finals" | "semi_finals" | "final";
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  winnerTeamId?: string;
  updatedAt: string;
};

export type KnockoutPrediction = {
  id: string;
  participantId: string;
  stage: "round_of_32" | "round_of_16" | "quarter_finals" | "semi_finals" | "final";
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  winnerTeamId?: string;
  submittedAt?: string;
  updatedAt?: string;
};

export type StageControl = {
  id: string;
  stage:
    | "initial_predictions"
    | "group_stage"
    | "round_of_32"
    | "round_of_16"
    | "quarter_finals"
    | "semi_finals"
    | "final"
    | "ranking";
  isOpen: boolean;
  deadlineAt: string;
  updatedAt: string;
};

export type AppData = {
  participants: Participant[];
  teams: Team[];
  matches: Match[];
  initialPredictions: InitialPrediction[];
  matchPredictions: MatchPrediction[];
  knockoutPredictions: KnockoutPrediction[];
  officialResults: OfficialResult[];
  stageControls: StageControl[];
};

export const STORAGE_KEY = "super-bolao-mvp-state-v4";
export const SESSION_KEY = "super-bolao-session-v2";
export const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
export const PRIMARY_ADMIN_EMAIL = "leonardo.v.vieira@gmail.com";
export const PRIMARY_ADMIN_PASSWORD = "Adm-xjMu4tR$nd%%rM";

const fixtureSeedTeams: Team[] = fixture.teams.map((team) => ({
  id: team.id,
  name: team.name,
  code: team.code,
  flagEmoji: team.flagEmoji,
  flagAsset: team.flagAsset,
  group: team.group,
}));

const fixtureSeedMatches: Match[] = fixture.groupMatches.map((match) => ({
  id: match.id,
  group: match.group,
  round: match.round,
  homeTeamId: match.homeTeamId,
  awayTeamId: match.awayTeamId,
  startsAt: match.startsAt,
  status: match.status as Match["status"],
}));

export function hashPassword(password: string) {
  return `local-demo:${password.split("").reverse().join("")}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  return hashPassword(password) === passwordHash;
}

export function buildMatches() {
  return fixtureSeedMatches.map((match) => ({ ...match }));
}

export function createSeedData(): AppData {
  const now = new Date().toISOString();

  return {
    participants: [
      {
        id: "admin-seed",
        name: "Leonardo Vieira",
        nickname: "Leonardo Vieira",
        email: PRIMARY_ADMIN_EMAIL,
        passwordHash: hashPassword(PRIMARY_ADMIN_PASSWORD),
        status: "active",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      },
    ],
    teams: fixtureSeedTeams,
    matches: buildMatches(),
    initialPredictions: [],
    matchPredictions: [],
    knockoutPredictions: [],
    officialResults: [],
    stageControls: [
      {
        id: "stage-initial",
        stage: "initial_predictions",
        isOpen: true,
        deadlineAt: "2026-06-11T12:00:00.000-03:00",
        updatedAt: now,
      },
      {
        id: "stage-group",
        stage: "group_stage",
        isOpen: true,
        deadlineAt: "2026-06-11T12:00:00.000-03:00",
        updatedAt: now,
      },
      {
        id: "stage-round-32",
        stage: "round_of_32",
        isOpen: true,
        deadlineAt: "2026-06-28T12:00:00.000-03:00",
        updatedAt: now,
      },
      {
        id: "stage-round-16",
        stage: "round_of_16",
        isOpen: true,
        deadlineAt: "2026-07-04T12:00:00.000-03:00",
        updatedAt: now,
      },
      {
        id: "stage-quarter-finals",
        stage: "quarter_finals",
        isOpen: true,
        deadlineAt: "2026-07-09T12:00:00.000-03:00",
        updatedAt: now,
      },
      {
        id: "stage-semi-finals",
        stage: "semi_finals",
        isOpen: true,
        deadlineAt: "2026-07-14T12:00:00.000-03:00",
        updatedAt: now,
      },
      {
        id: "stage-final",
        stage: "final",
        isOpen: true,
        deadlineAt: "2026-07-19T12:00:00.000-03:00",
        updatedAt: now,
      },
      {
        id: "stage-ranking",
        stage: "ranking",
        isOpen: true,
        deadlineAt: "2026-07-19T23:59:00.000-03:00",
        updatedAt: now,
      },
    ],
  };
}

function mergeStageControls(saved: StageControl[] | undefined, seed: StageControl[]) {
  if (!saved) {
    return seed;
  }

  const merged = seed.map((seedControl) => {
    const savedControl = saved.find((control) => control.stage === seedControl.stage);
    return savedControl ? { ...seedControl, ...savedControl } : seedControl;
  });
  const sharedDeadline = merged.find((control) => control.stage === "group_stage")?.deadlineAt;

  return merged.map((control) =>
    sharedDeadline && (control.stage === "initial_predictions" || control.stage === "group_stage")
      ? { ...control, deadlineAt: sharedDeadline }
      : control,
  );
}

function mergeParticipants(saved: Participant[] | undefined, seed: Participant[]) {
  if (!saved?.length) {
    return seed;
  }

  const adminSeed = seed.find((participant) => participant.id === "admin-seed");
  if (!adminSeed) {
    return saved;
  }

  const savedAdmin = saved.find(
    (participant) =>
      participant.id === adminSeed.id ||
      participant.email.toLowerCase() === "admin@superbolao.com" ||
      participant.email.toLowerCase() === PRIMARY_ADMIN_EMAIL,
  );
  const withoutSeedAdmins = saved.filter(
    (participant) =>
      participant.id !== adminSeed.id &&
      participant.id !== "participant-seed" &&
      participant.email.toLowerCase() !== "admin@superbolao.com" &&
      participant.email.toLowerCase() !== PRIMARY_ADMIN_EMAIL &&
      participant.email.toLowerCase() !== "participante@superbolao.com",
  );
  const mergedAdmin: Participant = {
    ...adminSeed,
    createdAt: savedAdmin?.createdAt ?? adminSeed.createdAt,
  };
  return [mergedAdmin, ...withoutSeedAdmins];
}

export function normalizeData(saved: Partial<AppData> | null): AppData {
  const seed = createSeedData();

  if (!saved) {
    return {
      ...seed,
      teams: seed.teams.map((team) => ({ ...team, flagAsset: flagAssetForTeam(team) })),
    };
  }

  return {
    participants: mergeParticipants(saved.participants, seed.participants),
    teams: seed.teams.map((team) => ({ ...team, flagAsset: flagAssetForTeam(team) })),
    matches: seed.matches,
    initialPredictions: saved.initialPredictions ?? [],
    matchPredictions: saved.matchPredictions ?? [],
    knockoutPredictions: saved.knockoutPredictions ?? [],
    officialResults: saved.officialResults ?? [],
    stageControls: mergeStageControls(saved.stageControls, seed.stageControls),
  };
}

export function loadData(): AppData {
  if (typeof window === "undefined") {
    return createSeedData();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeData(raw ? (JSON.parse(raw) as Partial<AppData>) : null);
  } catch {
    return createSeedData();
  }
}

export function saveData(data: AppData) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export function groupLabel(group: string) {
  return `Grupo ${group}`;
}

export function flagAssetForTeam(team: Pick<Team, "code" | "flagAsset">) {
  return team.flagAsset ?? `/flags/${team.code.toLowerCase()}.svg`;
}

export function getTeam(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId);
}

export function getStageControl(data: AppData, stage: StageControl["stage"]) {
  return data.stageControls.find((control) => control.stage === stage);
}

export function canEditStage(stageControl: StageControl | undefined, now = new Date()) {
  return Boolean(stageControl?.isOpen && now < new Date(stageControl.deadlineAt));
}

export function isPredictionFilled(
  prediction: Pick<MatchPrediction, "homeGoals" | "awayGoals"> | undefined,
) {
  return prediction?.homeGoals !== null && prediction?.homeGoals !== undefined && prediction?.awayGoals !== null && prediction?.awayGoals !== undefined;
}

export function goalLabel(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return value >= 7 ? "7+" : String(value);
}

export function toDateTimeInputValue(isoDate: string) {
  const date = new Date(isoDate);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeInputValue(value: string) {
  return new Date(value).toISOString();
}


