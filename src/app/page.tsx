"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import type { CSSProperties, FormEvent } from "react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppData,
  GROUPS,
  KnockoutPrediction,
  MatchPrediction,
  OfficialResult,
  Participant,
  ParticipantStatus,
  SESSION_KEY,
  Team,
  flagAssetForTeam,
  fromDateTimeInputValue,
  getStageControl,
  getTeam,
  groupLabel,
  isPredictionFilled,
  loadData,
  saveData,
  toDateTimeInputValue,
} from "@/lib/bolao";
import {
  BackendSnapshot,
  adminRecordOfficialResultToBackend,
  adminToggleParticipantToBackend,
  adminUpdateStageControlToBackend,
  adminUpsertParticipantToBackend,
  loadBackendSnapshot,
  loginWithBackend,
  mergeBackendSnapshot,
  saveInitialPredictionToBackend,
  saveKnockoutPredictionsToBackend,
  saveMatchPredictionsToBackend,
} from "@/lib/supabase-data";
import {
  acceptsPhasePrediction,
  countCompleteResults,
  getPhaseState,
  isPhaseVisible,
  phaseNoticeMessage,
  phaseResultStage,
  phaseStatusLabel,
  previousResultStageByPhase,
  type BettingPhase,
} from "@/utils/phaseStatus";
import fixture from "@/lib/bolao-fixture.json";

type View =
  | "login"
  | "home"
  | "initial"
  | "groups"
  | "round32Overview"
  | "round32"
  | "round16Overview"
  | "round16"
  | "quarterOverview"
  | "quarterFinals"
  | "semiOverview"
  | "semiFinals"
  | "final"
  | "ranking"
  | "admin"
  | "locks"
  | "rules";
type GoalValue = number | null;
type PredictionDraftMap = Record<string, { homeGoals: GoalValue; awayGoals: GoalValue }>;
type ProjectedMatch = { id: string; homeTeamId: string; awayTeamId: string; round?: number; startsAt?: string };
type ResultStage = OfficialResult["stage"];
type FixtureKnockoutStage = (typeof fixture.knockoutMatches)[number]["stage"];

const stageLabels = {
  initial_predictions: "Palpites Gerais",
  group_stage: "Palpites",
  round_of_32: "32 avos",
  round_of_16: "Oitavas",
  quarter_finals: "Quartas",
  semi_finals: "Semifinais",
  final: "Final",
  ranking: "Classificação",
};

const BACKEND_SESSION_KEY = `${SESSION_KEY}:supabase-token`;
const WELCOME_STORAGE_PREFIX = "bolao-murcho-welcome-seen";
const backendRequiredMessage = "Sua sessão não está conectada ao Supabase. Saia e entre novamente.";

type StageName = keyof typeof stageLabels;
type NavItem = {
  id: Exclude<View, "login">;
  label: string;
  adminOnly?: boolean;
  requiresInitial?: boolean;
  stage?: StageName;
};
type FillStatus = "complete" | "partial" | "empty" | "waiting" | "locked";
type HomeChecklistItem = {
  id: string;
  title: string;
  filled: number;
  total: number;
  status: string;
  detail: string;
  kind: FillStatus;
  view?: Exclude<View, "login">;
  preview?: "group_stage";
};
type ConfigTab = "participants" | "stages" | "results";

const baseNavItems: NavItem[] = [
  { id: "home", label: "Página Inicial" },
  { id: "initial", label: "Palpites Gerais", stage: "initial_predictions" },
  { id: "groups", label: "Palpites", requiresInitial: true, stage: "group_stage" },
  { id: "round32Overview", label: "Classificados 32 avos", requiresInitial: true, stage: "round_of_32" },
  { id: "round32", label: "32 avos", requiresInitial: true, stage: "round_of_32" },
  { id: "round16Overview", label: "Oitavas", requiresInitial: true, stage: "round_of_16" },
  { id: "round16", label: "Placares Oitavas", requiresInitial: true, stage: "round_of_16" },
  { id: "quarterOverview", label: "Quartas", requiresInitial: true, stage: "quarter_finals" },
  { id: "quarterFinals", label: "Placares Quartas", requiresInitial: true, stage: "quarter_finals" },
  { id: "semiOverview", label: "Semifinais", requiresInitial: true, stage: "semi_finals" },
  { id: "semiFinals", label: "Placares Semifinais", requiresInitial: true, stage: "semi_finals" },
  { id: "final", label: "Final", requiresInitial: true, stage: "final" },
  { id: "locks", label: "Configurações", adminOnly: true },
  { id: "ranking", label: "Classificação", stage: "ranking" },
  { id: "rules", label: "Regulamento" },
];

const resultStageOptions: ResultStage[] = [
  "group_stage",
  "round_of_32",
  "round_of_16",
  "quarter_finals",
  "semi_finals",
  "final",
];

type ChampionTheme = {
  primary: string;
  primaryDark: string;
  accent: string;
  accentDark: string;
  tertiary?: string;
  soft: string;
  primaryRgb: string;
  accentRgb: string;
};

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

const defaultChampionTheme: ChampionTheme = {
  primary: "#2692ff",
  primaryDark: "#083763",
  accent: "#16a34a",
  accentDark: "#052541",
  soft: "#eef7ff",
  primaryRgb: "38, 146, 255",
  accentRgb: "22, 163, 74",
};

const championThemes: Record<string, ChampionTheme> = {
  AR: { primary: "#75aadb", primaryDark: "#14365d", accent: "#f6b40e", accentDark: "#0b2847", soft: "#eef8ff", primaryRgb: "117, 170, 219", accentRgb: "246, 180, 14" },
  AT: { primary: "#c8102e", primaryDark: "#6f091b", accent: "#ffffff", accentDark: "#39040d", soft: "#fff1f3", primaryRgb: "200, 16, 46", accentRgb: "255, 255, 255" },
  AU: { primary: "#012169", primaryDark: "#061638", accent: "#ffcd00", accentDark: "#07122b", soft: "#eef3ff", primaryRgb: "1, 33, 105", accentRgb: "255, 205, 0" },
  BA: { primary: "#002f6c", primaryDark: "#061c3a", accent: "#f7d116", accentDark: "#061c3a", soft: "#eef5ff", primaryRgb: "0, 47, 108", accentRgb: "247, 209, 22" },
  BE: { primary: "#111827", primaryDark: "#020617", accent: "#fae042", accentDark: "#3b1608", soft: "#fff8d7", primaryRgb: "17, 24, 39", accentRgb: "250, 224, 66" },
  BR: { primary: "#009b3a", primaryDark: "#002776", accent: "#ffdf00", accentDark: "#01341c", soft: "#f3fbdf", primaryRgb: "0, 155, 58", accentRgb: "255, 223, 0" },
  CA: { primary: "#d80621", primaryDark: "#7f0715", accent: "#ffffff", accentDark: "#3e050c", soft: "#fff1f2", primaryRgb: "216, 6, 33", accentRgb: "255, 255, 255" },
  CD: { primary: "#007fff", primaryDark: "#063a72", accent: "#f7d618", accentDark: "#082b4c", soft: "#edf7ff", primaryRgb: "0, 127, 255", accentRgb: "247, 214, 24" },
  CH: { primary: "#d52b1e", primaryDark: "#7a130d", accent: "#ffffff", accentDark: "#3d0806", soft: "#fff2f1", primaryRgb: "213, 43, 30", accentRgb: "255, 255, 255" },
  CI: { primary: "#f77f00", primaryDark: "#7f3b00", accent: "#009e60", accentDark: "#08351f", soft: "#fff5e7", primaryRgb: "247, 127, 0", accentRgb: "0, 158, 96" },
  CO: { primary: "#fcd116", primaryDark: "#14365d", accent: "#003893", accentDark: "#081f47", soft: "#fff9d8", primaryRgb: "252, 209, 22", accentRgb: "0, 56, 147" },
  CV: { primary: "#003893", primaryDark: "#061e4a", accent: "#f7d116", accentDark: "#061e4a", soft: "#eef4ff", primaryRgb: "0, 56, 147", accentRgb: "247, 209, 22" },
  CW: { primary: "#002b7f", primaryDark: "#061845", accent: "#f9e814", accentDark: "#061845", soft: "#eef4ff", primaryRgb: "0, 43, 127", accentRgb: "249, 232, 20" },
  CZ: { primary: "#11457e", primaryDark: "#061c38", accent: "#d7141a", accentDark: "#061c38", soft: "#eef5ff", primaryRgb: "17, 69, 126", accentRgb: "215, 20, 26" },
  DE: { primary: "#111827", primaryDark: "#020617", accent: "#ffce00", accentDark: "#240a0a", soft: "#fff8dc", primaryRgb: "17, 24, 39", accentRgb: "255, 206, 0" },
  DZ: { primary: "#006633", primaryDark: "#062f1a", accent: "#d21034", accentDark: "#062f1a", soft: "#eefaf3", primaryRgb: "0, 102, 51", accentRgb: "210, 16, 52" },
  EC: { primary: "#ffdd00", primaryDark: "#0f3b75", accent: "#034ea2", accentDark: "#0f213c", soft: "#fff9d8", primaryRgb: "255, 221, 0", accentRgb: "3, 78, 162" },
  EG: { primary: "#ce1126", primaryDark: "#111827", accent: "#f1c232", accentDark: "#24070b", soft: "#fff1f2", primaryRgb: "206, 17, 38", accentRgb: "241, 194, 50" },
  ES: { primary: "#c60b1e", primaryDark: "#65050f", accent: "#ffc400", accentDark: "#3d060b", soft: "#fff5d6", primaryRgb: "198, 11, 30", accentRgb: "255, 196, 0" },
  FR: { primary: "#0055a4", primaryDark: "#061f46", accent: "#ef4135", accentDark: "#061f46", soft: "#eef5ff", primaryRgb: "0, 85, 164", accentRgb: "239, 65, 53" },
  "GB-ENG": { primary: "#cf142b", primaryDark: "#082747", accent: "#ffffff", accentDark: "#061b34", soft: "#fff1f3", primaryRgb: "207, 20, 43", accentRgb: "255, 255, 255" },
  "GB-SCT": { primary: "#005eb8", primaryDark: "#06345f", accent: "#ffffff", accentDark: "#082747", soft: "#eef7ff", primaryRgb: "0, 94, 184", accentRgb: "255, 255, 255" },
  GH: { primary: "#006b3f", primaryDark: "#062d1e", accent: "#fcd116", accentDark: "#24180a", soft: "#f3fbdf", primaryRgb: "0, 107, 63", accentRgb: "252, 209, 22" },
  HR: { primary: "#171796", primaryDark: "#071044", accent: "#ff0000", accentDark: "#071044", soft: "#eef2ff", primaryRgb: "23, 23, 150", accentRgb: "255, 0, 0" },
  HT: { primary: "#00209f", primaryDark: "#071c54", accent: "#d21034", accentDark: "#071c54", soft: "#eef3ff", primaryRgb: "0, 32, 159", accentRgb: "210, 16, 52" },
  IQ: { primary: "#007a3d", primaryDark: "#062d1a", accent: "#ce1126", accentDark: "#111827", soft: "#eefaf3", primaryRgb: "0, 122, 61", accentRgb: "206, 17, 38" },
  IR: { primary: "#239f40", primaryDark: "#052d18", accent: "#da0000", accentDark: "#052d18", soft: "#eefaf1", primaryRgb: "35, 159, 64", accentRgb: "218, 0, 0" },
  JO: { primary: "#007a3d", primaryDark: "#111827", accent: "#ce1126", accentDark: "#111827", soft: "#eefaf3", primaryRgb: "0, 122, 61", accentRgb: "206, 17, 38" },
  JP: { primary: "#bc002d", primaryDark: "#650018", accent: "#ffffff", accentDark: "#30000b", soft: "#fff1f4", primaryRgb: "188, 0, 45", accentRgb: "255, 255, 255" },
  KR: { primary: "#003478", primaryDark: "#061d41", accent: "#c60c30", accentDark: "#061d41", soft: "#eef5ff", primaryRgb: "0, 52, 120", accentRgb: "198, 12, 48" },
  MA: { primary: "#c1272d", primaryDark: "#5f0b10", accent: "#006233", accentDark: "#250607", soft: "#fff1f2", primaryRgb: "193, 39, 45", accentRgb: "0, 98, 51" },
  MX: { primary: "#006847", primaryDark: "#083225", accent: "#ce1126", accentDark: "#083225", soft: "#eefaf5", primaryRgb: "0, 104, 71", accentRgb: "206, 17, 38" },
  NL: { primary: "#f97316", primaryDark: "#082747", accent: "#ffffff", accentDark: "#06213f", soft: "#fff4e8", primaryRgb: "249, 115, 22", accentRgb: "255, 255, 255" },
  NO: { primary: "#00205b", primaryDark: "#061733", accent: "#ba0c2f", accentDark: "#061733", soft: "#eef3ff", primaryRgb: "0, 32, 91", accentRgb: "186, 12, 47" },
  NZ: { primary: "#00247d", primaryDark: "#061844", accent: "#cc142b", accentDark: "#061844", soft: "#eef3ff", primaryRgb: "0, 36, 125", accentRgb: "204, 20, 43" },
  PA: { primary: "#005293", primaryDark: "#061f3b", accent: "#d21034", accentDark: "#061f3b", soft: "#eef6ff", primaryRgb: "0, 82, 147", accentRgb: "210, 16, 52" },
  PT: { primary: "#006600", primaryDark: "#052d14", accent: "#ffcc00", accentDark: "#2d0909", soft: "#f1fbef", primaryRgb: "0, 102, 0", accentRgb: "255, 204, 0" },
  PY: { primary: "#0038a8", primaryDark: "#061d4a", accent: "#d52b1e", accentDark: "#061d4a", soft: "#eef4ff", primaryRgb: "0, 56, 168", accentRgb: "213, 43, 30" },
  QA: { primary: "#8a1538", primaryDark: "#42091b", accent: "#ffffff", accentDark: "#26050e", soft: "#fff1f5", primaryRgb: "138, 21, 56", accentRgb: "255, 255, 255" },
  SA: { primary: "#006c35", primaryDark: "#052d18", accent: "#ffffff", accentDark: "#052d18", soft: "#eefaf3", primaryRgb: "0, 108, 53", accentRgb: "255, 255, 255" },
  SE: { primary: "#006aa7", primaryDark: "#062f4d", accent: "#fecc00", accentDark: "#062f4d", soft: "#eef8ff", primaryRgb: "0, 106, 167", accentRgb: "254, 204, 0" },
  SN: { primary: "#00853f", primaryDark: "#062f1d", accent: "#fdef42", accentDark: "#062f1d", soft: "#f3fbdf", primaryRgb: "0, 133, 63", accentRgb: "253, 239, 66" },
  TN: { primary: "#e70013", primaryDark: "#73000a", accent: "#ffffff", accentDark: "#340005", soft: "#fff1f2", primaryRgb: "231, 0, 19", accentRgb: "255, 255, 255" },
  TR: { primary: "#e30a17", primaryDark: "#76050b", accent: "#ffffff", accentDark: "#350205", soft: "#fff1f2", primaryRgb: "227, 10, 23", accentRgb: "255, 255, 255" },
  US: { primary: "#3c3b6e", primaryDark: "#161638", accent: "#b22234", accentDark: "#161638", soft: "#f0f2ff", primaryRgb: "60, 59, 110", accentRgb: "178, 34, 52" },
  UY: { primary: "#0038a8", primaryDark: "#061d4a", accent: "#fcd116", accentDark: "#061d4a", soft: "#eef4ff", primaryRgb: "0, 56, 168", accentRgb: "252, 209, 22" },
  UZ: { primary: "#0099b5", primaryDark: "#063a45", accent: "#1eb53a", accentDark: "#063a45", soft: "#eefdff", primaryRgb: "0, 153, 181", accentRgb: "30, 181, 58" },
  ZA: { primary: "#007749", primaryDark: "#051f31", accent: "#ffb612", accentDark: "#051f31", soft: "#eefaf5", primaryRgb: "0, 119, 73", accentRgb: "255, 182, 18" },
};

function isBettingPhase(stage: StageName): stage is BettingPhase {
  return stage !== "ranking";
}

function getResultStageTotal(data: AppData, stage: ResultStage) {
  return getOfficialMatchesForStage(data, stage).length;
}

function isPreviousPhaseComplete(data: AppData, stage: BettingPhase) {
  const previousStage = previousResultStageByPhase[stage];

  if (!previousStage) {
    return true;
  }

  const totalMatches = getResultStageTotal(data, previousStage);

  if (totalMatches === 0) {
    return false;
  }

  return countCompleteResults(data.officialResults, previousStage, previousStage !== "group_stage") >= totalMatches;
}

function getPhaseGate(data: AppData, stage: BettingPhase, now = new Date()) {
  const resultStage = phaseResultStage[stage];

  return getPhaseState({
    control: getStageControl(data, stage),
    isReleased: isPreviousPhaseComplete(data, stage),
    now,
    requireWinner: resultStage !== "group_stage",
    resultStage,
    results: data.officialResults,
    totalMatches: getResultStageTotal(data, resultStage),
  });
}

function canSubmitPhase(data: AppData, stage: BettingPhase, now = new Date()) {
  return acceptsPhasePrediction(getPhaseGate(data, stage, now));
}

function isStageOn(data: AppData, stage: StageName) {
  if (!isBettingPhase(stage)) {
    return Boolean(getStageControl(data, stage)?.isOpen);
  }

  return isPhaseVisible(getPhaseGate(data, stage));
}

function getAvailableNavItems(data: AppData, user: Participant, hasInitialPrediction: boolean) {
  return baseNavItems.filter((item) => {
    if (item.adminOnly && user.role !== "admin") {
      return false;
    }

    if (item.requiresInitial && !hasInitialPrediction) {
      return false;
    }

    if (item.stage && !isStageOn(data, item.stage)) {
      return false;
    }

    return true;
  });
}

function getFallbackView(items: NavItem[]) {
  return items[0]?.id ?? "home";
}

function getChampionTeamForParticipant(data: AppData, participant: Participant) {
  const prediction = data.initialPredictions.find((item) => item.participantId === participant.id);
  return prediction ? getTeam(data.teams, prediction.championTeamId) : undefined;
}

function getChampionThemeStyle(team?: Team): ThemeStyle {
  const theme = (team ? championThemes[team.code] : undefined) ?? defaultChampionTheme;
  const accentIsWhite = theme.accent.toLowerCase() === "#ffffff" || theme.accent.toLowerCase() === "#fff";

  return {
    "--theme-primary": theme.primary,
    "--theme-primary-dark": theme.primaryDark,
    "--theme-accent": theme.accent,
    "--theme-tertiary": theme.tertiary ?? "#ffffff",
    "--theme-accent-text": accentIsWhite ? theme.primary : theme.accent,
    "--theme-accent-dark": theme.accentDark,
    "--theme-on-accent": accentIsWhite ? theme.primaryDark : "#ffffff",
    "--theme-soft": theme.soft,
    "--theme-primary-rgb": theme.primaryRgb,
    "--theme-accent-rgb": theme.accentRgb,
  };
}

function fixtureMatchNumber(matchId: string) {
  return Number(matchId.replace("jogo-", "")) || 0;
}

function buildPredictionMap(predictions: MatchPrediction[], participantId: string) {
  return predictions
    .filter((prediction) => prediction.participantId === participantId)
    .reduce<PredictionDraftMap>((map, prediction) => {
      map[prediction.matchId] = {
        homeGoals: prediction.homeGoals,
        awayGoals: prediction.awayGoals,
      };
      return map;
    }, {});
}

function buildKnockoutMap(predictions: KnockoutPrediction[], participantId: string, stage: KnockoutPrediction["stage"]) {
  return predictions
    .filter((prediction) => prediction.participantId === participantId && prediction.stage === stage)
    .reduce<Record<string, KnockoutPrediction>>((map, prediction) => {
      map[prediction.matchId] = prediction;
      return map;
    }, {});
}

function buildOfficialResultMap(results: OfficialResult[], stage?: OfficialResult["stage"]) {
  return results
    .filter((result) => !stage || result.stage === stage)
    .reduce<Record<string, OfficialResult>>((map, result) => {
      map[result.matchId] = result;
      return map;
    }, {});
}

function isOfficialResultFilled(result: OfficialResult | undefined) {
  return result?.homeGoals !== null && result?.homeGoals !== undefined && result?.awayGoals !== null && result?.awayGoals !== undefined;
}

function getOfficialWinnerId(match: ProjectedMatch, result?: OfficialResult) {
  if (!result || !isOfficialResultFilled(result)) {
    return null;
  }

  if (result?.winnerTeamId) {
    return result.winnerTeamId;
  }

  const homeGoals = result.homeGoals ?? 0;
  const awayGoals = result.awayGoals ?? 0;

  if (homeGoals === awayGoals) {
    return null;
  }

  return homeGoals > awayGoals ? match.homeTeamId : match.awayTeamId;
}

function calculateOfficialStandings(data: AppData) {
  const resultMap = buildOfficialResultMap(data.officialResults, "group_stage");

  return GROUPS.map((group) => {
    const rows = data.teams
      .filter((team) => team.group === group)
      .map((team) => ({ team, played: 0, points: 0, gf: 0, ga: 0, gd: 0 }));

    data.matches
      .filter((match) => match.group === group)
      .forEach((match) => {
        const result = resultMap[match.id];

        if (!isOfficialResultFilled(result)) {
          return;
        }

        const homeGoals = result.homeGoals ?? 0;
        const awayGoals = result.awayGoals ?? 0;
        const home = rows.find((row) => row.team.id === match.homeTeamId);
        const away = rows.find((row) => row.team.id === match.awayTeamId);

        if (!home || !away) {
          return;
        }

        home.played += 1;
        away.played += 1;
        home.gf += homeGoals;
        home.ga += awayGoals;
        away.gf += awayGoals;
        away.ga += homeGoals;

        if (homeGoals > awayGoals) {
          home.points += 3;
        } else if (awayGoals > homeGoals) {
          away.points += 3;
        } else {
          home.points += 1;
          away.points += 1;
        }
      });

    rows.forEach((row) => {
      row.gd = row.gf - row.ga;
    });

    rows.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.name.localeCompare(b.team.name));
    return { group, rows };
  });
}

function getRound32Teams(data: AppData) {
  const standings = calculateOfficialStandings(data);
  const resultMap = buildOfficialResultMap(data.officialResults, "group_stage");
  const filledResults = data.matches.filter((match) => isOfficialResultFilled(resultMap[match.id])).length;
  const isReady = filledResults === data.matches.length;
  const topTwo = isReady ? standings.flatMap((standing) => standing.rows.slice(0, 2).map((row) => row.team)) : [];
  const bestThirds = isReady
    ? standings
        .map((standing) => standing.rows[2])
        .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.name.localeCompare(b.team.name))
        .slice(0, 8)
        .map((row) => row.team)
    : [];

  return { filledResults, isReady, standings, teams: [...topTwo, ...bestThirds], totalResults: data.matches.length };
}

function getFixtureTemplates(stage: FixtureKnockoutStage) {
  return fixture.knockoutMatches.filter((match) => match.stage === stage);
}

function getTeamIdFromGroupSlot(
  slot: string,
  standings: ReturnType<typeof calculateOfficialStandings>,
  bestThirds: Team[],
) {
  if (slot.startsWith("Melhor 3")) {
    return bestThirds.shift()?.id ?? null;
  }

  const slotMatch = slot.match(/^([12])([A-L])$/);

  if (!slotMatch) {
    return null;
  }

  const position = Number(slotMatch[1]) - 1;
  const group = slotMatch[2];
  return standings.find((standing) => standing.group === group)?.rows[position]?.team.id ?? null;
}

function buildRound32Matches(data: AppData) {
  const { isReady, standings } = getRound32Teams(data);

  if (!isReady) {
    return [];
  }

  const bestThirds = standings
    .map((standing) => standing.rows[2])
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.name.localeCompare(b.team.name))
    .slice(0, 8)
    .map((row) => row.team);

  return getFixtureTemplates("round_of_32").reduce<ProjectedMatch[]>((matches, template) => {
    const homeTeamId = getTeamIdFromGroupSlot(template.homeSlot, standings, bestThirds);
    const awayTeamId = getTeamIdFromGroupSlot(template.awaySlot, standings, bestThirds);

    if (!homeTeamId || !awayTeamId) {
      return matches;
    }

    matches.push({
      id: template.id,
      homeTeamId,
      awayTeamId,
      round: template.round,
      startsAt: template.startsAt,
    });
    return matches;
  }, []);
}

function getWinnerIdByFixtureSlot(
  slot: string,
  sourceMatches: ProjectedMatch[],
  sourceResults: Record<string, OfficialResult>,
) {
  const winnerSlot = slot.match(/^V(\d+)$/);

  if (!winnerSlot) {
    return null;
  }

  const sourceMatch = sourceMatches.find((match) => match.id === `jogo-${winnerSlot[1]}`);
  return sourceMatch ? getOfficialWinnerId(sourceMatch, sourceResults[sourceMatch.id]) : null;
}

function buildKnockoutStageMatches(
  stage: FixtureKnockoutStage,
  sourceMatches: ProjectedMatch[],
  sourceResults: Record<string, OfficialResult>,
) {
  return getFixtureTemplates(stage).reduce<ProjectedMatch[]>((matches, template) => {
    const homeTeamId = getWinnerIdByFixtureSlot(template.homeSlot, sourceMatches, sourceResults);
    const awayTeamId = getWinnerIdByFixtureSlot(template.awaySlot, sourceMatches, sourceResults);

    if (!homeTeamId || !awayTeamId) {
      return matches;
    }

    matches.push({
      id: template.id,
      homeTeamId,
      awayTeamId,
      round: template.round,
      startsAt: template.startsAt,
    });
    return matches;
  }, []);
}

function getRound32Matches(data: AppData, participantId: string) {
  void participantId;
  return buildRound32Matches(data);
}

function getRound16Matches(data: AppData, participantId: string) {
  void participantId;
  return buildKnockoutStageMatches(
    "round_of_16",
    getRound32Matches(data, participantId),
    buildOfficialResultMap(data.officialResults, "round_of_32"),
  );
}

function getQuarterFinalMatches(data: AppData, participantId: string) {
  void participantId;
  return buildKnockoutStageMatches(
    "quarter_finals",
    getRound16Matches(data, participantId),
    buildOfficialResultMap(data.officialResults, "round_of_16"),
  );
}

function getSemiFinalMatches(data: AppData, participantId: string) {
  void participantId;
  return buildKnockoutStageMatches(
    "semi_finals",
    getQuarterFinalMatches(data, participantId),
    buildOfficialResultMap(data.officialResults, "quarter_finals"),
  );
}

function getFinalMatch(data: AppData, participantId: string) {
  void participantId;
  return buildKnockoutStageMatches(
    "final",
    getSemiFinalMatches(data, participantId),
    buildOfficialResultMap(data.officialResults, "semi_finals"),
  );
}

function getOfficialMatchesForStage(data: AppData, stage: OfficialResult["stage"]) {
  if (stage === "group_stage") {
    return data.matches.map((match) => ({
      id: match.id,
      group: match.group,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      round: match.round,
    }));
  }

  if (stage === "round_of_32") {
    return getRound32Matches(data, "official");
  }

  if (stage === "round_of_16") {
    return getRound16Matches(data, "official");
  }

  if (stage === "quarter_finals") {
    return getQuarterFinalMatches(data, "official");
  }

  if (stage === "semi_finals") {
    return getSemiFinalMatches(data, "official");
  }

  return getFinalMatch(data, "official");
}

function formatCountdown(deadlineAt: string, now: Date) {
  const difference = new Date(deadlineAt).getTime() - now.getTime();

  if (difference <= 0) {
    return "Palpites encerrados";
  }

  const totalMinutes = Math.floor(difference / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${pad(days)} dias ${pad(hours)} horas ${pad(minutes)} minutos`;
}

function formatDateTime(isoDate: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

function getDefaultView(user: Participant, data: AppData): View {
  const hasInitialPrediction = data.initialPredictions.some(
    (prediction) => prediction.participantId === user.id,
  );
  const availableItems = getAvailableNavItems(data, user, hasInitialPrediction);

  if (user.role === "admin" && availableItems.some((item) => item.id === "admin")) {
    return "admin";
  }

  return getFallbackView(availableItems);
}

function getParticipantProgress(data: AppData, participantId: string) {
  const predictionMap = buildPredictionMap(data.matchPredictions, participantId);
  const filledMatches = data.matches.filter((match) => isPredictionFilled(predictionMap[match.id])).length;
  const hasInitialPrediction = data.initialPredictions.some(
    (prediction) => prediction.participantId === participantId,
  );

  return {
    filledMatches,
    totalMatches: data.matches.length,
    hasInitialPrediction,
  };
}

function resultSign(homeGoals: number, awayGoals: number) {
  return Math.sign(homeGoals - awayGoals);
}

function scoreMatchPrediction(
  prediction: { homeGoals: number | null; awayGoals: number | null } | undefined,
  result: OfficialResult | undefined,
  exactPoints: number,
  partialPoints: number,
  resultPoints: number,
) {
  if (!prediction || !result || !isPredictionFilled(prediction) || !isOfficialResultFilled(result)) {
    return { exactHit: 0, points: 0, resultHit: 0 };
  }

  const predictedHome = prediction.homeGoals ?? 0;
  const predictedAway = prediction.awayGoals ?? 0;
  const resultHome = result.homeGoals ?? 0;
  const resultAway = result.awayGoals ?? 0;
  const sameResult = resultSign(predictedHome, predictedAway) === resultSign(resultHome, resultAway);

  if (!sameResult) {
    return { exactHit: 0, points: 0, resultHit: 0 };
  }

  if (predictedHome === resultHome && predictedAway === resultAway) {
    return { exactHit: 1, points: exactPoints, resultHit: 1 };
  }

  if (predictedHome === resultHome || predictedAway === resultAway) {
    return { exactHit: 0, points: partialPoints, resultHit: 1 };
  }

  return { exactHit: 0, points: resultPoints, resultHit: 1 };
}

function calculatePredictedStandings(data: AppData, group: string, predictionMap: PredictionDraftMap) {
  const rows = data.teams
    .filter((team) => team.group === group)
    .map((team) => ({ team, played: 0, points: 0, gf: 0, ga: 0, gd: 0 }));

  data.matches
    .filter((match) => match.group === group)
    .forEach((match) => {
      const prediction = predictionMap[match.id];

      if (!isPredictionFilled(prediction)) {
        return;
      }

      const homeGoals = prediction.homeGoals ?? 0;
      const awayGoals = prediction.awayGoals ?? 0;
      const home = rows.find((row) => row.team.id === match.homeTeamId);
      const away = rows.find((row) => row.team.id === match.awayTeamId);

      if (!home || !away) {
        return;
      }

      home.played += 1;
      away.played += 1;
      home.gf += homeGoals;
      home.ga += awayGoals;
      away.gf += awayGoals;
      away.ga += homeGoals;

      if (homeGoals > awayGoals) {
        home.points += 3;
      } else if (awayGoals > homeGoals) {
        away.points += 3;
      } else {
        home.points += 1;
        away.points += 1;
      }
    });

  rows.forEach((row) => {
    row.gd = row.gf - row.ga;
  });

  return rows.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.name.localeCompare(b.team.name));
}

function getParticipantLatestUpdate(data: AppData, participantId: string, fallbackDate: string) {
  const dates = [
    fallbackDate,
    ...data.initialPredictions
      .filter((prediction) => prediction.participantId === participantId)
      .map((prediction) => prediction.updatedAt),
    ...data.matchPredictions
      .filter((prediction) => prediction.participantId === participantId && prediction.updatedAt)
      .map((prediction) => prediction.updatedAt as string),
    ...data.knockoutPredictions
      .filter((prediction) => prediction.participantId === participantId && prediction.updatedAt)
      .map((prediction) => prediction.updatedAt as string),
  ];

  return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? fallbackDate;
}

function calculateParticipantScore(data: AppData, participant: Participant) {
  const groupResults = buildOfficialResultMap(data.officialResults, "group_stage");
  const predictionMap = buildPredictionMap(data.matchPredictions, participant.id);
  const initialPrediction = data.initialPredictions.find((prediction) => prediction.participantId === participant.id);
  const knockoutStages: KnockoutPrediction["stage"][] = [
    "round_of_32",
    "round_of_16",
    "quarter_finals",
    "semi_finals",
    "final",
  ];
  const score = {
    bonusPoints: 0,
    exactHits: 0,
    groupClassificationPoints: 0,
    groupStagePoints: 0,
    knockoutPoints: 0,
    resultHits: 0,
    scoredMatches: 0,
    total: 0,
  };

  data.matches.forEach((match) => {
    const result = groupResults[match.id];
    const matchScore = scoreMatchPrediction(predictionMap[match.id], result, 12, 7, 5);

    if (isOfficialResultFilled(result) && isPredictionFilled(predictionMap[match.id])) {
      score.scoredMatches += 1;
    }

    score.groupStagePoints += matchScore.points;
    score.exactHits += matchScore.exactHit;
    score.resultHits += matchScore.resultHit;
  });

  const officialStandings = calculateOfficialStandings(data);

  GROUPS.forEach((group) => {
    const groupMatches = data.matches.filter((match) => match.group === group);
    const hasAllOfficialResults = groupMatches.every((match) => isOfficialResultFilled(groupResults[match.id]));
    const hasAllPredictions = groupMatches.every((match) => isPredictionFilled(predictionMap[match.id]));

    if (!hasAllOfficialResults || !hasAllPredictions) {
      return;
    }

    const predictedTopTwo = calculatePredictedStandings(data, group, predictionMap).slice(0, 2);
    const officialTopTwo = officialStandings.find((standing) => standing.group === group)?.rows.slice(0, 2) ?? [];

    predictedTopTwo.forEach((row, index) => {
      if (officialTopTwo[index]?.team.id === row.team.id) {
        score.groupClassificationPoints += 5;
      }
    });
  });

  knockoutStages.forEach((stage) => {
    const resultMap = buildOfficialResultMap(data.officialResults, stage);
    const predictionMapForStage = buildKnockoutMap(data.knockoutPredictions, participant.id, stage);
    const matches = getOfficialMatchesForStage(data, stage);

    matches.forEach((match) => {
      const result = resultMap[match.id];
      const prediction = predictionMapForStage[match.id];
      const matchScore = scoreMatchPrediction(prediction, result, 15, 8, 6);

      if (isOfficialResultFilled(result) && isKnockoutPredictionFilled(prediction)) {
        score.scoredMatches += 1;
      }

      score.knockoutPoints += matchScore.points;
      score.exactHits += matchScore.exactHit;
      score.resultHits += matchScore.resultHit;
    });
  });

  if (initialPrediction) {
    const finalMatch = getFinalMatch(data, participant.id)[0];
    const finalResult = buildOfficialResultMap(data.officialResults, "final")[finalMatch?.id ?? ""];

    if (finalMatch) {
      const finalists = [finalMatch.homeTeamId, finalMatch.awayTeamId];

      if (finalists.includes(initialPrediction.championTeamId)) {
        score.bonusPoints += 10;
      }

      if (finalists.includes(initialPrediction.runnerUpTeamId)) {
        score.bonusPoints += 10;
      }
    }

    const championId = finalMatch ? getOfficialWinnerId(finalMatch, finalResult) : null;

    if (championId && initialPrediction.championTeamId === championId) {
      score.bonusPoints += 15;
    }
  }

  score.total = score.groupStagePoints + score.knockoutPoints + score.groupClassificationPoints + score.bonusPoints;
  return score;
}

function getRankingRows(data: AppData) {
  return data.participants
    .filter((participant) => participant.status === "active")
    .map((participant) => {
      const progress = getParticipantProgress(data, participant.id);
      const score = calculateParticipantScore(data, participant);
      const status = progress.hasInitialPrediction
        ? `${progress.filledMatches}/${progress.totalMatches} jogos`
        : "Palpites iniciais pendentes";

      return {
        exactHits: score.exactHits,
        participant,
        points: score.total,
        resultHits: score.resultHits,
        score,
        status,
        updatedAt: getParticipantLatestUpdate(data, participant.id, participant.updatedAt),
      };
    })
    .sort((a, b) =>
      b.points - a.points
      || b.exactHits - a.exactHits
      || b.resultHits - a.resultHits
      || a.participant.name.localeCompare(b.participant.name),
    );
}

function getRankingMetrics(data: AppData, participantId: string) {
  const rows = getRankingRows(data);
  const currentIndex = rows.findIndex((row) => row.participant.id === participantId);
  const currentRow = currentIndex >= 0 ? rows[currentIndex] : undefined;

  return {
    activeParticipants: rows.length,
    points: currentRow?.points ?? 0,
    position: currentIndex >= 0 ? currentIndex + 1 : Math.max(1, rows.length),
  };
}

function isKnockoutPredictionFilled(prediction?: KnockoutPrediction) {
  return prediction?.homeGoals !== null && prediction?.homeGoals !== undefined
    && prediction?.awayGoals !== null && prediction?.awayGoals !== undefined;
}

function getFillKind(filled: number, total: number, waiting = false, locked = false): FillStatus {
  if (locked) {
    return "locked";
  }

  if (waiting) {
    return "waiting";
  }

  if (total > 0 && filled === total) {
    return "complete";
  }

  if (filled > 0) {
    return "partial";
  }

  return "empty";
}

function getFillStatusLabel(kind: FillStatus) {
  if (kind === "locked") {
    return "🔐 Bloqueado";
  }

  if (kind === "complete") {
    return "Completo";
  }

  if (kind === "partial") {
    return "Em andamento";
  }

  if (kind === "waiting") {
    return "Aguardando resultados oficiais";
  }

  return "Falta preencher";
}

function getHomeChecklist(data: AppData, participant: Participant): HomeChecklistItem[] {
  const items: HomeChecklistItem[] = [];

  const groupPredictionMap = buildPredictionMap(data.matchPredictions, participant.id);
  const filledGroupMatches = data.matches.filter((match) => isPredictionFilled(groupPredictionMap[match.id])).length;
  const groupGate = getPhaseGate(data, "group_stage");
  const groupLocked = groupGate === "nao_liberada";
  const groupKind = getFillKind(filledGroupMatches, data.matches.length, false, groupLocked);
  items.push({
    id: "group_stage",
    title: "Fase de Grupos",
    filled: filledGroupMatches,
    total: data.matches.length,
    status: groupGate === "aberta_para_palpites" ? getFillStatusLabel(groupKind) : phaseStatusLabel(groupGate),
    detail: groupLocked ? "Liberação pelo Admin na data da fase." : `${GROUPS.length} grupos, ${data.matches.length} jogos.`,
    kind: groupKind,
    preview: groupLocked ? undefined : "group_stage",
  });

  const knockoutStages: Array<{
    id: KnockoutPrediction["stage"];
    title: string;
    view: Exclude<View, "login">;
    getMatches: (data: AppData, participantId: string) => ProjectedMatch[];
  }> = [
    { id: "round_of_32", title: "32 avos", view: "round32", getMatches: getRound32Matches },
    { id: "round_of_16", title: "Oitavas", view: "round16", getMatches: getRound16Matches },
    { id: "quarter_finals", title: "Quartas", view: "quarterFinals", getMatches: getQuarterFinalMatches },
    { id: "semi_finals", title: "Semifinais", view: "semiFinals", getMatches: getSemiFinalMatches },
  ];

  knockoutStages.forEach((stage) => {
    const stageGate = getPhaseGate(data, stage.id);
    const stageIsOpen = stageGate !== "nao_liberada";
    const matches = stage.getMatches(data, participant.id);
    const expectedMatches = getFixtureTemplates(stage.id).length;
    const predictionMap = buildKnockoutMap(data.knockoutPredictions, participant.id, stage.id);
    const filled = matches.filter((match) => isKnockoutPredictionFilled(predictionMap[match.id])).length;
    const locked = !stageIsOpen;
    const waiting = stageIsOpen && matches.length === 0;
    const total = waiting ? expectedMatches : matches.length;
    const kind = getFillKind(filled, total || expectedMatches, waiting, locked);

    items.push({
      id: stage.id,
      title: stage.title,
      filled,
      total: total || expectedMatches,
      status: stageGate === "aberta_para_palpites" ? getFillStatusLabel(kind) : phaseStatusLabel(stageGate),
      detail: !stageIsOpen
        ? "Liberação pelo Admin na data da fase."
        : waiting
          ? "Aguardando resultados oficiais para montar os jogos."
          : `${matches.length} jogos disponíveis.`,
      kind,
      view: locked ? undefined : stage.view,
    });
  });

  return items;
}

function getViewMeta(view: View) {
  const meta: Record<Exclude<View, "login">, { title: string; description: string }> = {
    home: {
      title: "Página Inicial",
      description: "Resumo dos seus palpites e andamento do bolão.",
    },
    initial: {
      title: "Palpites Gerais",
      description: "Palpites gerais antes da Copa começar.",
    },
    groups: {
      title: "Palpites",
      description: "Fase de grupos organizada por rodada.",
    },
    round32Overview: {
      title: "Classificados 32 avos",
      description: "Times que seu palpite levou ao primeiro mata-mata.",
    },
    round32: {
      title: "32 avos",
      description: "Placares projetados para o Round of 32.",
    },
    round16Overview: {
      title: "Oitavas",
      description: "Fluxo dos classificados pelos resultados dos 32 avos.",
    },
    round16: {
      title: "Placares das Oitavas",
      description: "Palpites dos jogos das oitavas.",
    },
    quarterOverview: {
      title: "Quartas",
      description: "Fluxo dos classificados pelos resultados das oitavas.",
    },
    quarterFinals: {
      title: "Placares das Quartas",
      description: "Palpites dos jogos das quartas de final.",
    },
    semiOverview: {
      title: "Semifinais",
      description: "Fluxo dos classificados pelos resultados das quartas.",
    },
    semiFinals: {
      title: "Placares das Semifinais",
      description: "Palpites dos jogos das semifinais.",
    },
    final: {
      title: "Final",
      description: "Placar da final definida pelos resultados oficiais.",
    },
    ranking: {
      title: "Classificação",
      description: "Classificação geral do bolão.",
    },
    admin: {
      title: "Participantes",
      description: "Perfis gerenciados pelo administrador.",
    },
    locks: {
      title: "Configurações",
      description: "Controle de liberação e prazos.",
    },
    rules: {
      title: "Regulamento",
      description: "Regras de pontuação e critérios do campeonato.",
    },
  };

  return view === "login" ? null : meta[view];
}

export default function Home() {
  const [data, setData] = useState<AppData | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [backendSessionToken, setBackendSessionToken] = useState<string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [view, setView] = useState<View>("login");

  useEffect(() => {
    const loadedData = loadData();
    const savedSessionId = window.localStorage.getItem(SESSION_KEY);
    const savedBackendToken = window.localStorage.getItem(BACKEND_SESSION_KEY);
    const savedUser = loadedData.participants.find(
      (participant) => participant.id === savedSessionId && participant.status === "active",
    );

    setData(loadedData);

    if (savedBackendToken) {
      setBackendSessionToken(savedBackendToken);
    }

    if (savedUser && savedBackendToken) {
      setSessionUserId(savedUser.id);
      setView(getDefaultView(savedUser, loadedData));
    } else if (savedSessionId && !savedBackendToken) {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const savedSessionId = window.localStorage.getItem(SESSION_KEY);
    const savedBackendToken = window.localStorage.getItem(BACKEND_SESSION_KEY);

    loadBackendSnapshot(savedBackendToken)
      .then((snapshot) => {
        if (!isMounted) {
          return;
        }

        setData((current) => {
          const base = current ?? loadData();
          const next = mergeBackendSnapshot(base, snapshot);
          const nextUserId = snapshot.currentParticipantId ?? savedSessionId;
          const nextUser = next.participants.find((participant) => participant.id === nextUserId);

          saveData(next);
          if (nextUser) {
            setSessionUserId(nextUser.id);
            window.localStorage.setItem(SESSION_KEY, nextUser.id);
            setView(getDefaultView(nextUser, next));
          }

          return next;
        });
      })
      .catch(() => {
        if (savedBackendToken) {
          window.localStorage.removeItem(SESSION_KEY);
          window.localStorage.removeItem(BACKEND_SESSION_KEY);
          setBackendSessionToken(null);
          setSessionUserId(null);
          setView("login");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const applyBackendSnapshot = useCallback((snapshot: BackendSnapshot) => {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next = mergeBackendSnapshot(current, snapshot);
      const nextUserId = snapshot.currentParticipantId ?? sessionUserId;
      const nextUser = next.participants.find((participant) => participant.id === nextUserId);

      saveData(next);

      if (nextUser) {
        setSessionUserId(nextUser.id);
        window.localStorage.setItem(SESSION_KEY, nextUser.id);
      }

      return next;
    });
  }, [sessionUserId]);

  const currentUser = useMemo(
    () => data?.participants.find((participant) => participant.id === sessionUserId) ?? null,
    [data, sessionUserId],
  );
  const currentUserId = currentUser?.id ?? null;

  const hasInitialPrediction = Boolean(
    currentUser &&
      data?.initialPredictions.some((prediction) => prediction.participantId === currentUser.id),
  );

  useEffect(() => {
    if (!backendSessionToken || !currentUserId || (view !== "ranking" && view !== "home")) {
      return;
    }

    let isMounted = true;

    async function refreshRankingData() {
      try {
        const snapshot = await loadBackendSnapshot(backendSessionToken);

        if (isMounted) {
          applyBackendSnapshot(snapshot);
        }
      } catch {
        // Keep the current screen usable if a background refresh fails.
      }
    }

    refreshRankingData();
    const timer = window.setInterval(refreshRankingData, 60000);
    window.addEventListener("focus", refreshRankingData);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshRankingData);
    };
  }, [applyBackendSnapshot, backendSessionToken, currentUserId, view]);

  useEffect(() => {
    if (!data || !currentUser || view === "login") {
      return;
    }

    const availableItems = getAvailableNavItems(data, currentUser, hasInitialPrediction);

    if (!availableItems.some((item) => item.id === view)) {
      setView(getFallbackView(availableItems));
    }
  }, [data, currentUser, hasInitialPrediction, view]);

  useEffect(() => {
    if (!currentUser) {
      setShowWelcomeModal(false);
      return;
    }

    const welcomeKey = `${WELCOME_STORAGE_PREFIX}:${currentUser.id}`;
    setShowWelcomeModal(window.localStorage.getItem(welcomeKey) !== "true");
  }, [currentUser]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  function commitData(updater: (current: AppData) => AppData) {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next = updater(current);
      saveData(next);
      return next;
    });
  }

  async function handleLogin(email: string, password: string) {
    if (!data) {
      return "Dados ainda estão carregando.";
    }

    if (!email.trim() || !password.trim()) {
      return "Informe e-mail e senha.";
    }

    try {
      const backendLogin = await loginWithBackend(email, password);
      const snapshot: BackendSnapshot = {
        ...backendLogin.state,
        currentParticipantId: backendLogin.participant.id,
        isAuthenticated: true,
      };
      const next = mergeBackendSnapshot(data, snapshot);
      const nextUser =
        next.participants.find((participant) => participant.id === backendLogin.participant.id) ??
        backendLogin.participant;

      window.localStorage.setItem(BACKEND_SESSION_KEY, backendLogin.sessionToken);
      window.localStorage.setItem(SESSION_KEY, nextUser.id);
      setBackendSessionToken(backendLogin.sessionToken);
      setSessionUserId(nextUser.id);
      saveData(next);
      setData(next);
      setView(getDefaultView(nextUser, next));
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      return message.includes("invalid_credentials")
        ? "E-mail ou senha inválidos."
        : "Não foi possível validar o login no Supabase. Tente novamente.";
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(BACKEND_SESSION_KEY);
    setSessionUserId(null);
    setBackendSessionToken(null);
    setShowWelcomeModal(false);
    setView("login");
  }

  function handleWelcomeContinue() {
    if (currentUser) {
      window.localStorage.setItem(`${WELCOME_STORAGE_PREFIX}:${currentUser.id}`, "true");
    }

    setShowWelcomeModal(false);
    setView("initial");
  }

  if (!data) {
    return (
      <main className="page-wrap">
        <section className="app-card loading-card">Carregando Super Bolão...</section>
      </main>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const navItems = getAvailableNavItems(data, currentUser, hasInitialPrediction);
  const activeView = navItems.some((item) => item.id === view) ? view : getFallbackView(navItems);
  const viewMeta = getViewMeta(activeView);
  const championTeam = getChampionTeamForParticipant(data, currentUser);

  return (
    <main className="app-shell" style={getChampionThemeStyle(championTeam)}>
      <aside className="side-menu">
        <div className="side-brand">
          <span>Bolão 2026</span>
          <strong>Bolão Murcho</strong>
          {currentUser.role === "admin" && <small>Admin</small>}
        </div>
        <nav className="side-nav" aria-label="Menu principal">
          {navItems.map((item) => (
            <button
              className={activeView === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setView(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="app-main">
        <header className="content-head">
          <div>
            <p>{viewMeta?.description}</p>
            <h1>{viewMeta?.title}</h1>
          </div>
          <div className="user-chip">
            <strong>{currentUser.name}</strong>
            <button onClick={handleLogout} type="button">Sair</button>
          </div>
        </header>

        {activeView === "home" && (
          <HomeDashboard
            canStartInitial={canSubmitPhase(data, "initial_predictions")}
            data={data}
            participant={currentUser}
            onGoToInitial={() => setView("initial")}
            onGoToView={(nextView) => setView(nextView)}
          />
        )}
        {activeView === "initial" && (
          <InitialPredictions
            backendSessionToken={backendSessionToken}
            data={data}
            onBackendSnapshot={applyBackendSnapshot}
            onDone={() => setView("groups")}
            participant={currentUser}
          />
        )}
        {activeView === "groups" && (
          <GroupPredictions
            backendSessionToken={backendSessionToken}
            data={data}
            onBackendSnapshot={applyBackendSnapshot}
            participant={currentUser}
          />
        )}
        {activeView === "round32Overview" && <Round32Overview data={data} participant={currentUser} />}
        {activeView === "round32" && (
          <Round32Predictions
            backendSessionToken={backendSessionToken}
            data={data}
            onBackendSnapshot={applyBackendSnapshot}
            participant={currentUser}
          />
        )}
        {activeView === "round16Overview" && <Round16Overview data={data} participant={currentUser} />}
        {activeView === "round16" && <KnockoutStagePredictions backendSessionToken={backendSessionToken} data={data} getMatches={getRound16Matches} onBackendSnapshot={applyBackendSnapshot} participant={currentUser} stage="round_of_16" title="Oitavas" />}
        {activeView === "quarterOverview" && (
          <KnockoutFlowOverview
            data={data}
            getSourceMatches={getRound16Matches}
            getTargetMatches={getQuarterFinalMatches}
            participant={currentUser}
            sourceStage="round_of_16"
            sourceTitle="Oitavas"
            targetTitle="Quartas"
          />
        )}
        {activeView === "quarterFinals" && <KnockoutStagePredictions backendSessionToken={backendSessionToken} data={data} getMatches={getQuarterFinalMatches} onBackendSnapshot={applyBackendSnapshot} participant={currentUser} stage="quarter_finals" title="Quartas" />}
        {activeView === "semiOverview" && (
          <KnockoutFlowOverview
            data={data}
            getSourceMatches={getQuarterFinalMatches}
            getTargetMatches={getSemiFinalMatches}
            participant={currentUser}
            sourceStage="quarter_finals"
            sourceTitle="Quartas"
            targetTitle="Semifinais"
          />
        )}
        {activeView === "semiFinals" && <KnockoutStagePredictions backendSessionToken={backendSessionToken} data={data} getMatches={getSemiFinalMatches} onBackendSnapshot={applyBackendSnapshot} participant={currentUser} stage="semi_finals" title="Semifinais" />}
        {activeView === "final" && <KnockoutStagePredictions backendSessionToken={backendSessionToken} data={data} getMatches={getFinalMatch} isFinal onBackendSnapshot={applyBackendSnapshot} participant={currentUser} stage="final" title="Final" />}
        {activeView === "ranking" && <RankingPage currentUser={currentUser} data={data} />}
        {activeView === "locks" && <LocksPage backendSessionToken={backendSessionToken} data={data} onBackendSnapshot={applyBackendSnapshot} onCommit={commitData} />}
        {activeView === "rules" && <RulesPage />}
      </section>

      {showWelcomeModal && <WelcomeModal onContinue={handleWelcomeContinue} />}
    </main>
  );
}

function WelcomeModal({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="welcome-modal-backdrop" role="presentation">
      <section aria-labelledby="welcome-modal-title" className="welcome-modal" role="dialog">
        <div className="welcome-modal-mark">BM</div>
        <p className="eyebrow">Bolão Murcho 2026</p>
        <h2 id="welcome-modal-title">Bem-vindo ao bolão</h2>
        <p>
          Você vai preencher seus palpites fase por fase. Comece pelos Palpites Gerais,
          escolhendo campeão, vice, artilheiro e melhor jogador. Depois, preencha os
          placares da fase de grupos.
        </p>
        <div className="welcome-modal-rules">
          <span>O prazo fecha a comporta automaticamente.</span>
          <span>Quando um resultado oficial começa, a fase trava.</span>
          <span>Depois disso, seus palpites ficam apenas para consulta.</span>
        </div>
        <button className="btn green" onClick={onContinue} type="button">
          Continuar
        </button>
      </section>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (email: string, password: string) => Promise<string | null> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const result = await onLogin(email, password);
    setError(result ?? "");
    setIsSubmitting(false);
  }

  return (
    <main className="login-fullscreen">
      <section className="login-split">
        <div className="login-art">
          <div>
            <Image
              alt="Bolão Murcho"
              className="login-logo-image"
              height={260}
              priority
              src="/assets/bolao-murcho-logo.png"
              unoptimized
              width={260}
            />
            <p>A emoção do futebol, a disputa entre amigos e a classificação atualizada em tempo real.</p>
          </div>
          <div className="pitch-line" />
        </div>

        <div className="login-form">
          <div className="login-box">
            <h2>Bem-vindo!</h2>
            <p>Entre na sua conta para continuar seus palpites.</p>

            <form className="login-stack" onSubmit={handleSubmit}>
              <input
                autoComplete="email"
                className="input"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu@email.com"
                type="text"
                value={email}
              />
              <input
                autoComplete="current-password"
                className="input"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Senha"
                type="password"
                value={password}
              />

              {error && <p className="alert error">{error}</p>}

          <button className="btn" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
            </form>

          </div>
        </div>
      </section>
    </main>
  );
}

function TeamFlag({ team, size = "md" }: { team?: Team; size?: "md" | "lg" | "xl" }) {
  if (!team) {
    return <span className={`flag-image ${size}`} />;
  }

  return (
    <span className={`flag-image ${size}`}>
      <Image alt={`Bandeira ${team.name}`} height={24} src={flagAssetForTeam(team)} unoptimized width={32} />
    </span>
  );
}

function ScoreInput({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  value: number | null | undefined;
}) {
  function handleChange(nextValue: string) {
    if (nextValue === "") {
      onChange("");
      return;
    }

    const numericValue = Math.max(0, Math.floor(Number(nextValue)));

    if (Number.isFinite(numericValue)) {
      onChange(String(numericValue));
    }
  }

  return (
    <input
      aria-label={label}
      className="score-input"
      disabled={disabled}
      inputMode="numeric"
      min={0}
      onChange={(event) => handleChange(event.target.value)}
      onKeyDown={(event) => {
        if (["-", "+", "e", "E", ".", ","].includes(event.key)) {
          event.preventDefault();
        }
      }}
      pattern="[0-9]*"
      type="number"
      value={value ?? ""}
    />
  );
}

function TeamPicker({
  disabled,
  onChange,
  teams,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  teams: Team[];
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedTeam = getTeam(teams, value);
  const sortedTeams = useMemo(
    () => [...teams].sort((first, second) => first.name.localeCompare(second.name, "pt-BR")),
    [teams],
  );

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  function chooseTeam(teamId: string) {
    onChange(teamId);
    setIsOpen(false);
  }

  return (
    <div className="team-picker">
      <button
        className={`team-picker-button ${selectedTeam ? "" : "empty"}`}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <TeamFlag team={selectedTeam} />
        <span>{selectedTeam?.name ?? "Selecione"}</span>
      </button>
      {isOpen && (
        <div className="team-picker-menu">
          {sortedTeams.map((team) => (
            <button
              className={team.id === value ? "selected" : ""}
              key={team.id}
              onClick={() => chooseTeam(team.id)}
              type="button"
            >
              <TeamFlag team={team} />
              <span>{team.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HomeDashboard({
  canStartInitial,
  data,
  participant,
  onGoToInitial,
  onGoToView,
}: {
  canStartInitial: boolean;
  data: AppData;
  participant: Participant;
  onGoToInitial: () => void;
  onGoToView: (view: Exclude<View, "login">) => void;
}) {
  const initialPrediction = data.initialPredictions.find(
    (prediction) => prediction.participantId === participant.id,
  );
  const progress = getParticipantProgress(data, participant.id);
  const rankingMetrics = getRankingMetrics(data, participant.id);
  const checklist = getHomeChecklist(data, participant);
  const champion = initialPrediction ? getTeam(data.teams, initialPrediction.championTeamId) : undefined;
  const runnerUp = initialPrediction ? getTeam(data.teams, initialPrediction.runnerUpTeamId) : undefined;
  const groupPercent = Math.round((progress.filledMatches / progress.totalMatches) * 100);
  const [openPreview, setOpenPreview] = useState<"group_stage" | null>(null);

  function scrollToChecklist() {
    document.getElementById("home-stage-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleChecklistAction(item: HomeChecklistItem) {
    if (item.preview === "group_stage") {
      setOpenPreview("group_stage");
      window.setTimeout(() => {
        document.getElementById("home-group-stage-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
      return;
    }

    if (item.view) {
      onGoToView(item.view);
    }
  }

  return (
    <section className="home-screen">
      <div className="home-hero-card">
        <div>
          <p>{participant.name}, seu campeão escolhido</p>
          <h2>{champion ? champion.name : "Sem campeão escolhido"}</h2>
          <span>{champion ? "Palpite geral salvo" : "Complete seus palpites gerais para atualizar a página inicial"}</span>
        </div>
        <aside className="home-ranking-panel" aria-label="Resumo da classificação">
          <div className="home-ranking-title">
            <small>Classificação</small>
            <strong>Seu momento no bolão</strong>
          </div>
          <div className="home-ranking-metrics">
            <div>
              <small>Posição</small>
              <strong>{rankingMetrics.position}º</strong>
            </div>
            <div>
              <small>Pontos</small>
              <strong>{rankingMetrics.points}</strong>
            </div>
            <div>
              <small>Participantes</small>
              <strong>{rankingMetrics.activeParticipants}</strong>
            </div>
          </div>
          <button className="home-ranking-action" onClick={scrollToChecklist} type="button">
            Ver preenchimento por fase
          </button>
        </aside>
        <div className="home-flag" aria-hidden="true">{champion ? <TeamFlag size="xl" team={champion} /> : "🏆"}</div>
      </div>

      <div className="home-grid">
        <article className="home-card">
          <small>Final projetada</small>
          <strong>
            {champion?.name ?? "Campeão"} x {runnerUp?.name ?? "Vice"}
          </strong>
          <span>{initialPrediction ? "Baseada no seu palpite geral." : "Ainda falta escolher campeão e vice."}</span>
        </article>
        <article className="home-card">
          <small>Artilheiro</small>
          <strong>{initialPrediction?.topScorer || "Pendente"}</strong>
          <span>Bônus pré-Copa.</span>
        </article>
        <article className="home-card">
          <small>Melhor jogador</small>
          <strong>{initialPrediction?.bestPlayer || "Pendente"}</strong>
          <span>Bônus pré-Copa.</span>
        </article>
        <article className="home-card">
          <small>Fase de grupos</small>
          <strong>
            {groupPercent}%
          </strong>
          <span>{progress.filledMatches}/{progress.totalMatches} jogos preenchidos.</span>
        </article>
      </div>

      {!initialPrediction && canStartInitial && (
        <button className="btn" onClick={onGoToInitial} type="button">
          Escolher campeão
        </button>
      )}

      <section className="home-checklist" id="home-stage-checklist">
        <header>
          <div>
            <small>Colinha</small>
            <h3>Preenchimento por fase</h3>
          </div>
          <p>Use este resumo para ver rapidamente o que já foi salvo e onde ainda falta palpitar.</p>
        </header>
        <div className="home-checklist-grid">
          {checklist.map((item) => {
            const percent = item.total ? Math.round((item.filled / item.total) * 100) : 0;

            return (
              <article className={`home-check-card ${item.kind}`} key={item.id}>
                <div className="home-check-topline">
                  <strong>{item.title}</strong>
                  <span>{item.status}</span>
                </div>
                <div className="home-check-progress" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </div>
                <p>{item.filled}/{item.total} preenchidos</p>
                <small>{item.detail}</small>
                <button
                  className="home-check-link"
                  disabled={item.kind === "locked" || (!item.view && !item.preview)}
                  onClick={() => handleChecklistAction(item)}
                  type="button"
                >
                  {item.kind === "locked"
                    ? "🔐 Bloqueado"
                    : item.preview === "group_stage"
                      ? "Ver preenchimento"
                      : "Abrir fase"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {openPreview === "group_stage" && (
        <GroupStageReadonlyPreview data={data} participant={participant} />
      )}
    </section>
  );
}

function GroupStageReadonlyPreview({ data, participant }: { data: AppData; participant: Participant }) {
  const predictionMap = buildPredictionMap(data.matchPredictions, participant.id);

  return (
    <section className="home-group-preview" id="home-group-stage-preview">
      <header>
        <div>
          <small>Fase de Grupos</small>
          <h3>Visualização dos palpites salvos</h3>
        </div>
        <p>Jogos sem palpite salvo aparecem como - x -.</p>
      </header>

      <div className="home-group-preview-grid">
        {GROUPS.map((group) => {
          const matches = data.matches
            .filter((match) => match.group === group)
            .sort((a, b) => a.round - b.round || fixtureMatchNumber(a.id) - fixtureMatchNumber(b.id));
          const filledMatches = matches.filter((match) => isPredictionFilled(predictionMap[match.id])).length;

          return (
            <article className="home-group-preview-card" key={group}>
              <div className="home-group-preview-head">
                <strong>{groupLabel(group)}</strong>
                <span>{filledMatches}/{matches.length}</span>
              </div>
              <div className="home-group-preview-list">
                {matches.map((match) => {
                  const homeTeam = getTeam(data.teams, match.homeTeamId);
                  const awayTeam = getTeam(data.teams, match.awayTeamId);
                  const prediction = predictionMap[match.id];

                  return (
                    <div className="home-group-preview-row" key={match.id}>
                      <span className="home-group-team">
                        <TeamFlag team={homeTeam} />
                        <strong>{homeTeam?.name}</strong>
                      </span>
                      <span className="home-group-score">
                        {prediction?.homeGoals ?? "-"} x {prediction?.awayGoals ?? "-"}
                      </span>
                      <span className="home-group-team away">
                        <strong>{awayTeam?.name}</strong>
                        <TeamFlag team={awayTeam} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function InitialPredictions({
  backendSessionToken,
  data,
  onBackendSnapshot,
  onDone,
  participant,
}: {
  backendSessionToken: string | null;
  data: AppData;
  onBackendSnapshot: (snapshot: BackendSnapshot) => void;
  onDone: () => void;
  participant: Participant;
}) {
  const existingPrediction = data.initialPredictions.find(
    (prediction) => prediction.participantId === participant.id,
  );
  const stageControl = getStageControl(data, "initial_predictions");
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const phaseGate = getPhaseGate(data, "initial_predictions", currentTime);
  const canEdit = acceptsPhasePrediction(phaseGate);
  const blockedMessage = phaseNoticeMessage(phaseGate);
  const [form, setForm] = useState({
    championTeamId: existingPrediction?.championTeamId ?? "",
    runnerUpTeamId: existingPrediction?.runnerUpTeamId ?? "",
    topScorer: existingPrediction?.topScorer ?? "",
    bestPlayer: existingPrediction?.bestPlayer ?? "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setForm({
      championTeamId: existingPrediction?.championTeamId ?? "",
      runnerUpTeamId: existingPrediction?.runnerUpTeamId ?? "",
      topScorer: existingPrediction?.topScorer ?? "",
      bestPlayer: existingPrediction?.bestPlayer ?? "",
    });
  }, [
    existingPrediction?.bestPlayer,
    existingPrediction?.championTeamId,
    existingPrediction?.id,
    existingPrediction?.runnerUpTeamId,
    existingPrediction?.topScorer,
    existingPrediction?.updatedAt,
  ]);

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!canEdit) {
      setMessage(blockedMessage);
      return;
    }

    if (!form.championTeamId || !form.runnerUpTeamId || !form.topScorer.trim() || !form.bestPlayer.trim()) {
      setMessage("Preencha todos os campos obrigatórios.");
      return;
    }

    if (form.championTeamId === form.runnerUpTeamId) {
      setMessage("Campeão e vice-campeão precisam ser seleções diferentes.");
      return;
    }

    const predictionInput = {
      championTeamId: form.championTeamId,
      runnerUpTeamId: form.runnerUpTeamId,
      topScorer: form.topScorer.trim(),
      bestPlayer: form.bestPlayer.trim(),
    };

    if (!backendSessionToken) {
      setMessage(backendRequiredMessage);
      return;
    }

    try {
      const snapshot = await saveInitialPredictionToBackend(backendSessionToken, predictionInput);
      onBackendSnapshot(snapshot);
      onDone();
    } catch {
      setMessage("Não foi possível salvar no Supabase. Tente novamente.");
    }
  }

  return (
    <section className="initial-screen">
      <div className="feature-topline deadline-only">
        <aside className={`round-card ${canEdit ? "" : "closed"}`}>
          <small>Prazo para envio</small>
          <strong>{stageControl ? formatCountdown(stageControl.deadlineAt, currentTime) : "Sem prazo"}</strong>
          <span>{canEdit ? "Aberto para edição" : "Palpites encerrados"}</span>
        </aside>
      </div>

      {!canEdit && <p className="alert warning">{blockedMessage}</p>}

      <div className="champion-card">
        <form className="form-area" onSubmit={handleSubmit}>
          <div className="form-title">
            <h3>Panorama Geral da Copa</h3>
            <p>Preencha seus palpites gerais antes de seguir para Palpites.</p>
          </div>

          <div className="form-grid mock-form-grid">
            <div className="form-row">
              <div className="field-label">
                <label>Seleção Campeã</label>
                <small>Bônus pré-torneio.</small>
              </div>
              <TeamPicker
                disabled={!canEdit}
                onChange={(value) => updateForm("championTeamId", value)}
                teams={data.teams}
                value={form.championTeamId}
              />
            </div>

            <div className="form-row">
              <div className="field-label">
                <label>Vice-campeã</label>
                <small>Também vale ponto.</small>
              </div>
              <TeamPicker
                disabled={!canEdit}
                onChange={(value) => updateForm("runnerUpTeamId", value)}
                teams={data.teams}
                value={form.runnerUpTeamId}
              />
            </div>

            <div className="form-row">
              <div className="field-label">
                <label>Artilheiro</label>
                <small>Obrigatório.</small>
              </div>
              <input
                className="input"
                disabled={!canEdit}
                onChange={(event) => updateForm("topScorer", event.target.value)}
                placeholder="Ex: Vini Jr."
                value={form.topScorer}
              />
            </div>

            <div className="form-row">
              <div className="field-label">
                <label>Melhor Jogador</label>
                <small>Obrigatório.</small>
              </div>
              <input
                className="input"
                disabled={!canEdit}
                onChange={(event) => updateForm("bestPlayer", event.target.value)}
                placeholder="Ex: Neymar"
                value={form.bestPlayer}
              />
            </div>

            {message && <p className={`alert ${message.includes("diferentes") || message.includes("Preencha") ? "error" : "warning"}`}>{message}</p>}

            <div className="button-row">
              <button className="btn" disabled={!canEdit} type="submit">
                Salvar e continuar →
              </button>
            </div>
          </div>
        </form>

      </div>
    </section>
  );
}

function GroupPredictions({
  backendSessionToken,
  data,
  onBackendSnapshot,
  participant,
}: {
  backendSessionToken: string | null;
  data: AppData;
  onBackendSnapshot: (snapshot: BackendSnapshot) => void;
  participant: Participant;
}) {
  const [activeGroup, setActiveGroup] = useState("A");
  const [drafts, setDrafts] = useState<PredictionDraftMap>(() =>
    buildPredictionMap(data.matchPredictions, participant.id),
  );
  const [now, setNow] = useState(() => new Date());
  const [saveMessage, setSaveMessage] = useState("");
  const stageControl = getStageControl(data, "group_stage");
  const phaseGate = getPhaseGate(data, "group_stage", now);
  const canEdit = acceptsPhasePrediction(phaseGate);
  const blockedMessage = phaseNoticeMessage(phaseGate);

  useEffect(() => {
    setDrafts(buildPredictionMap(data.matchPredictions, participant.id));
  }, [data.matchPredictions, participant.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeIndex = GROUPS.indexOf(activeGroup);
  const groupMatches = data.matches
    .filter((match) => match.group === activeGroup)
    .sort((first, second) => fixtureMatchNumber(first.id) - fixtureMatchNumber(second.id));
  const groupRounds = [1, 2, 3].map((round) => ({
    round,
    matches: groupMatches.filter((match) => match.round === round),
  }));
  const filledMatches = data.matches.filter((match) => isPredictionFilled(drafts[match.id])).length;
  const totalMatches = data.matches.length;
  const groupStatuses = GROUPS.reduce<Record<string, boolean>>((statuses, group) => {
    const matches = data.matches.filter((match) => match.group === group);
    statuses[group] = matches.every((match) => isPredictionFilled(drafts[match.id]));
    return statuses;
  }, {});

  function getDraft(matchId: string) {
    return drafts[matchId] ?? { homeGoals: null, awayGoals: null };
  }

  function setGoal(matchId: string, side: "homeGoals" | "awayGoals", value: string) {
    setSaveMessage("");
    setDrafts((current) => ({
      ...current,
      [matchId]: {
        ...getDraft(matchId),
        [side]: value === "" ? null : Number(value),
      },
    }));
  }

  async function savePredictions() {
    if (!canEdit) {
      setSaveMessage(blockedMessage);
      return;
    }

    const participantPredictions = data.matches.map((match) => {
      const draft = drafts[match.id] ?? { homeGoals: null, awayGoals: null };

      return {
        matchId: match.id,
        homeGoals: draft.homeGoals,
        awayGoals: draft.awayGoals,
      };
    });

    if (!backendSessionToken) {
      setSaveMessage(backendRequiredMessage);
      return;
    }

    try {
      const snapshot = await saveMatchPredictionsToBackend(backendSessionToken, participantPredictions);
      onBackendSnapshot(snapshot);
      setSaveMessage("Palpites salvos com sucesso.");
    } catch {
      setSaveMessage("Não foi possível salvar no Supabase. Tente novamente.");
    }
  }

  return (
    <section className="feature-shell groups-screen">
      <div className="feature-topline deadline-only">
        <aside className={`round-card ${canEdit ? "" : "closed"}`}>
          <small>Prazo para envio</small>
          <strong>{stageControl ? formatCountdown(stageControl.deadlineAt, now) : "Sem prazo"}</strong>
          <span>{canEdit ? `${filledMatches}/${totalMatches} palpites preenchidos` : "Palpites encerrados"}</span>
        </aside>
      </div>

      {!canEdit && <p className="alert warning">{blockedMessage}</p>}

      <div className="group-status-strip" aria-label="Navegação de grupos">
        {GROUPS.map((group) => (
          <button
            className={`group-chip ${activeGroup === group ? "active" : ""} ${groupStatuses[group] ? "done" : "pending"}`}
            key={group}
            onClick={() => setActiveGroup(group)}
            type="button"
          >
            <strong>{groupLabel(group)}</strong>
            <span>{groupStatuses[group] ? "✓" : "!"}</span>
          </button>
        ))}
      </div>

      <div className="round-tabs">
        <div className="round-tab-group">
          <button className="round-tab active" type="button">
            {groupLabel(activeGroup)}
          </button>
          <button className="round-tab" type="button">
            Grupo {activeIndex + 1} de 12
          </button>
        </div>
        <div className="progress-mini">
          Você preencheu {filledMatches} de {totalMatches} jogos da fase de grupos.
          <div className="progress-bar">
            <span style={{ width: `${Math.round((filledMatches / totalMatches) * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="groups-list">
        <article className="group-fold">
          <header className="group-fold-header">
            <div className="group-title">
              <div className="group-letter">{activeGroup}</div>
              <div>
                <h4>{groupLabel(activeGroup)}</h4>
                <p>{groupMatches.length} jogos disponíveis para preenchimento</p>
              </div>
            </div>
            <span className={`status-badge ${groupStatuses[activeGroup] ? "done" : "pending"}`}>
              {groupStatuses[activeGroup] ? "✓" : "!"}
            </span>
          </header>

          <div className="group-fold-body">
            {groupRounds.map((round) => (
              <section className="round-block" key={round.round}>
                <h5>Rodada {round.round}</h5>
                {round.matches.map((match) => {
                  const homeTeam = getTeam(data.teams, match.homeTeamId);
                  const awayTeam = getTeam(data.teams, match.awayTeamId);
                  const draft = getDraft(match.id);
                  const isFilled = isPredictionFilled(draft);

                  return (
                    <div className={`game-row ${isFilled ? "is-complete" : "is-pending"}`} key={match.id}>
                      <div className="team">
                        <TeamFlag team={homeTeam} />
                        {homeTeam?.name}
                      </div>
                      <div className="score">
                        <ScoreInput
                          disabled={!canEdit}
                          label={`Gols ${homeTeam?.name}`}
                          onChange={(value) => setGoal(match.id, "homeGoals", value)}
                          value={draft.homeGoals}
                        />
                        x
                        <ScoreInput
                          disabled={!canEdit}
                          label={`Gols ${awayTeam?.name}`}
                          onChange={(value) => setGoal(match.id, "awayGoals", value)}
                          value={draft.awayGoals}
                        />
                      </div>
                      <div className="team away">
                        {awayTeam?.name}
                        <TeamFlag team={awayTeam} />
                      </div>
                      <div className={`game-state ${isFilled ? "done" : "pending"}`}>{isFilled ? "✓" : "!"}</div>
                    </div>
                  );
                })}
              </section>
            ))}

            <div className="group-footer">
              <span className={groupStatuses[activeGroup] ? "ok-line" : "warning-line"}>
                {groupStatuses[activeGroup] ? "Tudo certo neste grupo." : "Ainda há placares em aberto neste grupo."}
              </span>
              <span>
                {groupMatches.filter((match) => isPredictionFilled(drafts[match.id])).length}/{groupMatches.length} jogos preenchidos
              </span>
            </div>
          </div>
        </article>
      </div>

      {saveMessage && <p className={`alert ${saveMessage === blockedMessage ? "warning" : "success"}`}>{saveMessage}</p>}

      <div className="save-line">
        <button
          className="btn secondary"
          disabled={activeIndex === 0}
          onClick={() => setActiveGroup(GROUPS[activeIndex - 1])}
          type="button"
        >
          Voltar
        </button>
        <span>{canEdit ? `${filledMatches}/${totalMatches} palpites preenchidos` : "Palpites encerrados"}</span>
        <button
          className="btn secondary"
          disabled={activeIndex === GROUPS.length - 1}
          onClick={() => setActiveGroup(GROUPS[activeIndex + 1])}
          type="button"
        >
          Próximo grupo
        </button>
        <button className="btn green" disabled={!canEdit} onClick={savePredictions} type="button">
          Salvar palpites
        </button>
      </div>
    </section>
  );
}

function Round32Overview({ data, participant }: { data: AppData; participant: Participant }) {
  const { filledResults, isReady, standings, teams, totalResults } = getRound32Teams(data);
  const resultMap = buildOfficialResultMap(data.officialResults, "group_stage");
  void participant;

  return (
    <section className="knockout-screen">
      <div className="feature-topline deadline-only">
        <div className="metric-card compact">
          <small>Resultados oficiais</small>
          <strong>{filledResults}/{totalResults}</strong>
        </div>
      </div>

      {!isReady ? (
        <section className="empty-state inline-empty">
          <p className="eyebrow">Aguardando resultados</p>
          <h2>Os 32 avos ainda não estão definidos</h2>
          <p>O Admin precisa alimentar todos os resultados oficiais da fase de grupos.</p>
        </section>
      ) : (
        <div className="qualified-grid">
          {teams.map((team, index) => (
            <article className="qualified-card" key={`${team.id}-${index}`}>
              <span>{index + 1}</span>
              <TeamFlag team={team} />
              <strong>{team.name}</strong>
              <small>{groupLabel(team.group)}</small>
            </article>
          ))}
        </div>
      )}

      <div className="section-subhead">
        <h3>Resultados oficiais da fase de grupos</h3>
      </div>

      <div className="groups-list compact-list">
        {standings.map((standing) => (
          <article className="group-fold" key={standing.group}>
            <header className="group-fold-header">
              <div className="group-title">
                <div className="group-letter">{standing.group}</div>
                <div>
                  <h4>{groupLabel(standing.group)}</h4>
                  <p>Classificação projetada pelos seus placares</p>
                </div>
              </div>
            </header>

            <div className="standings-strip">
              {standing.rows.map((row, index) => (
                <div className={index < 2 || index === 2 ? "standing-row qualified" : "standing-row"} key={row.team.id}>
                  <span>{index + 1}º</span>
                  <TeamFlag team={row.team} />
                  <strong>{row.team.name}</strong>
                  <small>{row.points} pts · SG {row.gd}</small>
                </div>
              ))}
            </div>

            <div className="group-fold-body">
              {data.matches
                .filter((match) => match.group === standing.group)
                .sort((first, second) => fixtureMatchNumber(first.id) - fixtureMatchNumber(second.id))
                .map((match) => {
                  const homeTeam = getTeam(data.teams, match.homeTeamId);
                  const awayTeam = getTeam(data.teams, match.awayTeamId);
                  const result = resultMap[match.id];

                  return (
                    <div className="readonly-score-row" key={match.id}>
                      <div className="team">
                        <TeamFlag team={homeTeam} />
                        {homeTeam?.name}
                      </div>
                      <strong>
                        {result?.homeGoals ?? "-"} x {result?.awayGoals ?? "-"}
                      </strong>
                      <div className="team away">
                        {awayTeam?.name}
                        <TeamFlag team={awayTeam} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Round32Predictions({
  backendSessionToken,
  data,
  onBackendSnapshot,
  participant,
}: {
  backendSessionToken: string | null;
  data: AppData;
  onBackendSnapshot: (snapshot: BackendSnapshot) => void;
  participant: Participant;
}) {
  const matches = getRound32Matches(data, participant.id);
  const [drafts, setDrafts] = useState<Record<string, KnockoutPrediction>>(() =>
    buildKnockoutMap(data.knockoutPredictions, participant.id, "round_of_32"),
  );
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => new Date());
  const phaseGate = getPhaseGate(data, "round_of_32", now);
  const canEdit = acceptsPhasePrediction(phaseGate);
  const blockedMessage = phaseNoticeMessage(phaseGate);

  useEffect(() => {
    setDrafts(buildKnockoutMap(data.knockoutPredictions, participant.id, "round_of_32"));
  }, [data.knockoutPredictions, participant.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function getDraft(match: ProjectedMatch) {
    return drafts[match.id] ?? {
      id: `ko-${participant.id}-${match.id}`,
      participantId: participant.id,
      stage: "round_of_32" as const,
      matchId: match.id,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeGoals: null,
      awayGoals: null,
    };
  }

  function setKnockoutValue(match: ProjectedMatch, field: "homeGoals" | "awayGoals", value: string) {
    setMessage("");
    setDrafts((current) => {
      const existing = getDraft(match);
      const next = {
        ...existing,
        [field]: value === "" ? null : Number(value),
      };

      return { ...current, [match.id]: next };
    });
  }

  async function saveRound32() {
    if (!canEdit) {
      setMessage(blockedMessage);
      return;
    }

    const updatedAt = new Date().toISOString();
    const predictions = matches.map((match) => {
      const draft = getDraft(match);

      return {
        ...draft,
        submittedAt: draft.submittedAt ?? updatedAt,
        updatedAt,
      };
    });

    if (!backendSessionToken) {
      setMessage(backendRequiredMessage);
      return;
    }

    try {
      const snapshot = await saveKnockoutPredictionsToBackend(backendSessionToken, "round_of_32", predictions);
      onBackendSnapshot(snapshot);
      setMessage("Palpites dos 32 avos salvos.");
    } catch {
      setMessage("Não foi possível salvar no Supabase. Tente novamente.");
    }
  }

  return (
    <section className="knockout-screen">
      {!canEdit && <p className="alert warning">{blockedMessage}</p>}
      {!matches.length && (
        <section className="empty-state inline-empty">
          <p className="eyebrow">Aguardando resultados</p>
          <h2>Os jogos dos 32 avos ainda não foram definidos</h2>
          <p>A próxima fase será montada pelos resultados oficiais da fase de grupos.</p>
        </section>
      )}

      <div className="bracket-list">
        {matches.map((match, index) => {
          const homeTeam = getTeam(data.teams, match.homeTeamId);
          const awayTeam = getTeam(data.teams, match.awayTeamId);
          const draft = getDraft(match);

          return (
            <article className="knockout-match" key={match.id}>
              <header>
                <span>Jogo {index + 1}</span>
                <strong>32 avos</strong>
              </header>
              <div className="game-row is-pending">
                <div className="team">
                  <TeamFlag team={homeTeam} />
                  {homeTeam?.name}
                </div>
                <div className="score">
                  <ScoreInput
                    disabled={!canEdit}
                    label={`Gols ${homeTeam?.name}`}
                    onChange={(value) => setKnockoutValue(match, "homeGoals", value)}
                    value={draft.homeGoals}
                  />
                  x
                  <ScoreInput
                    disabled={!canEdit}
                    label={`Gols ${awayTeam?.name}`}
                    onChange={(value) => setKnockoutValue(match, "awayGoals", value)}
                    value={draft.awayGoals}
                  />
                </div>
                <div className="team away">
                  {awayTeam?.name}
                  <TeamFlag team={awayTeam} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {message && <p className={`alert ${message === blockedMessage ? "warning" : "success"}`}>{message}</p>}

      <div className="save-line">
        <span>{matches.length} jogos dos 32 avos</span>
        <button className="btn green" disabled={!canEdit || !matches.length} onClick={saveRound32} type="button">
          Salvar palpites
        </button>
      </div>
    </section>
  );
}

function KnockoutStagePredictions({
  backendSessionToken,
  data,
  getMatches,
  isFinal = false,
  onBackendSnapshot,
  participant,
  stage,
  title,
}: {
  backendSessionToken: string | null;
  data: AppData;
  getMatches: (data: AppData, participantId: string) => ProjectedMatch[];
  isFinal?: boolean;
  onBackendSnapshot: (snapshot: BackendSnapshot) => void;
  participant: Participant;
  stage: KnockoutPrediction["stage"];
  title: string;
}) {
  const matches = getMatches(data, participant.id);
  const [drafts, setDrafts] = useState<Record<string, KnockoutPrediction>>(() =>
    buildKnockoutMap(data.knockoutPredictions, participant.id, stage),
  );
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => new Date());
  const phaseGate = getPhaseGate(data, stage, now);
  const canEdit = acceptsPhasePrediction(phaseGate);
  const blockedMessage = phaseNoticeMessage(phaseGate);

  useEffect(() => {
    setDrafts(buildKnockoutMap(data.knockoutPredictions, participant.id, stage));
  }, [data.knockoutPredictions, participant.id, stage]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function getDraft(match: ProjectedMatch) {
    return drafts[match.id] ?? {
      id: `ko-${participant.id}-${match.id}`,
      participantId: participant.id,
      stage,
      matchId: match.id,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeGoals: null,
      awayGoals: null,
    };
  }

  function setValue(match: ProjectedMatch, field: "homeGoals" | "awayGoals", value: string) {
    setMessage("");
    setDrafts((current) => {
      const existing = getDraft(match);
      const next = {
        ...existing,
        [field]: value === "" ? null : Number(value),
      };

      return { ...current, [match.id]: next };
    });
  }

  async function saveStage() {
    if (!canEdit) {
      setMessage(blockedMessage);
      return;
    }

    const updatedAt = new Date().toISOString();
    const predictions = matches.map((match) => {
      const draft = getDraft(match);

      return {
        ...draft,
        winnerTeamId: undefined,
        submittedAt: draft.submittedAt ?? updatedAt,
        updatedAt,
      };
    });

    if (!backendSessionToken) {
      setMessage(backendRequiredMessage);
      return;
    }

    try {
      const snapshot = await saveKnockoutPredictionsToBackend(backendSessionToken, stage, predictions);
      onBackendSnapshot(snapshot);
      setMessage(`Palpites de ${title.toLowerCase()} salvos.`);
    } catch {
      setMessage("Não foi possível salvar no Supabase. Tente novamente.");
    }
  }

  return (
    <section className="knockout-screen">
      {isFinal && (
        <div className="alert success">
          A final é montada pelos resultados oficiais das semifinais. Se o backend ainda não alimentar essa etapa, o Admin pode ajustar os resultados em Configurações.
        </div>
      )}
      {!canEdit && <p className="alert warning">{blockedMessage}</p>}
      {!matches.length && (
        <section className="empty-state inline-empty">
          <p className="eyebrow">Aguardando resultados</p>
          <h2>Esta fase ainda não foi definida</h2>
          <p>Os confrontos serão montados automaticamente pelo backend; Configurações fica como fallback manual do Admin.</p>
        </section>
      )}

      <div className={isFinal ? "bracket-list final-list" : "bracket-list"}>
        {matches.map((match, index) => {
          const homeTeam = getTeam(data.teams, match.homeTeamId);
          const awayTeam = getTeam(data.teams, match.awayTeamId);
          const draft = getDraft(match);

          return (
            <article className={isFinal ? "knockout-match final-match" : "knockout-match"} key={match.id}>
              <header>
                <span>{isFinal ? "Jogo final" : `Jogo ${index + 1}`}</span>
                <strong>{title}</strong>
              </header>
              <div className="game-row is-pending">
                <div className="team">
                  <TeamFlag team={homeTeam} />
                  {homeTeam?.name}
                </div>
                <div className="score">
                  <ScoreInput
                    disabled={!canEdit}
                    label={`Gols ${homeTeam?.name}`}
                    onChange={(value) => setValue(match, "homeGoals", value)}
                    value={draft.homeGoals}
                  />
                  x
                  <ScoreInput
                    disabled={!canEdit}
                    label={`Gols ${awayTeam?.name}`}
                    onChange={(value) => setValue(match, "awayGoals", value)}
                    value={draft.awayGoals}
                  />
                </div>
                <div className="team away">
                  {awayTeam?.name}
                  <TeamFlag team={awayTeam} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {message && <p className={`alert ${message === blockedMessage ? "warning" : "success"}`}>{message}</p>}

      <div className="save-line">
        <span>{matches.length} {matches.length === 1 ? "jogo" : "jogos"} de {title.toLowerCase()}</span>
        <button className="btn green" disabled={!canEdit || !matches.length} onClick={saveStage} type="button">
          Salvar palpites
        </button>
      </div>
    </section>
  );
}

function Round16Overview({ data, participant }: { data: AppData; participant: Participant }) {
  return (
    <KnockoutFlowOverview
      data={data}
      getSourceMatches={getRound32Matches}
      getTargetMatches={getRound16Matches}
      participant={participant}
      sourceStage="round_of_32"
      sourceTitle="32 avos"
      targetTitle="Oitavas"
    />
  );
}

function KnockoutFlowOverview({
  data,
  getSourceMatches,
  getTargetMatches,
  participant,
  sourceStage,
  sourceTitle,
  targetTitle,
}: {
  data: AppData;
  getSourceMatches: (data: AppData, participantId: string) => ProjectedMatch[];
  getTargetMatches: (data: AppData, participantId: string) => ProjectedMatch[];
  participant: Participant;
  sourceStage: OfficialResult["stage"];
  sourceTitle: string;
  targetTitle: string;
}) {
  const sourceMatches = getSourceMatches(data, participant.id);
  const sourceMap = buildOfficialResultMap(data.officialResults, sourceStage);
  const targetMatches = getTargetMatches(data, participant.id);

  return (
    <section className="knockout-screen">
      {!targetMatches.length && (
        <section className="empty-state inline-empty">
          <p className="eyebrow">Aguardando resultados</p>
          <h2>{targetTitle} ainda não está definida</h2>
          <p>Os classificados aparecem aqui quando os resultados oficiais da fase anterior forem alimentados.</p>
        </section>
      )}

      <div className="bracket-flow">
        <div className="bracket-column">
          <h3>{sourceTitle}</h3>
          {sourceMatches.map((match, index) => {
            const homeTeam = getTeam(data.teams, match.homeTeamId);
            const awayTeam = getTeam(data.teams, match.awayTeamId);
            const result = sourceMap[match.id];
            const winner = getTeam(data.teams, getOfficialWinnerId(match, result) ?? "");

            return (
              <article className="flow-match" key={match.id}>
                <small>Jogo {index + 1}</small>
                <div className={winner?.id === homeTeam?.id ? "flow-team winner" : "flow-team"}>
                  <TeamFlag team={homeTeam} />
                  <span>{homeTeam?.name}</span>
                  <strong>{result?.homeGoals ?? "-"}</strong>
                </div>
                <div className={winner?.id === awayTeam?.id ? "flow-team winner" : "flow-team"}>
                  <TeamFlag team={awayTeam} />
                  <span>{awayTeam?.name}</span>
                  <strong>{result?.awayGoals ?? "-"}</strong>
                </div>
              </article>
            );
          })}
        </div>

        <div className="bracket-column">
          <h3>{targetTitle}</h3>
          {targetMatches.map((match, index) => {
            const homeTeam = getTeam(data.teams, match.homeTeamId);
            const awayTeam = getTeam(data.teams, match.awayTeamId);

            return (
              <article className="flow-match large" key={match.id}>
                <small>{targetTitle} {index + 1}</small>
                <div className="flow-team winner">
                  <TeamFlag team={homeTeam} />
                  <span>{homeTeam?.name}</span>
                </div>
                <div className="flow-team winner">
                  <TeamFlag team={awayTeam} />
                  <span>{awayTeam?.name}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ParticipantSettingsPanel({
  backendSessionToken,
  data,
  onBackendSnapshot,
}: {
  backendSessionToken: string | null;
  data: AppData;
  onBackendSnapshot: (snapshot: BackendSnapshot) => void;
}) {
  const emptyForm = {
    name: "",
    email: "",
    password: "",
    status: "active" as ParticipantStatus,
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  const participants = data.participants.filter((participant) => participant.role === "participant");

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function editParticipant(participant: Participant) {
    setEditingId(participant.id);
    setMessage("");
    setForm({
      name: participant.name,
      email: participant.email,
      password: "",
      status: participant.status,
    });
  }

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!form.name.trim() || !form.email.trim()) {
      setMessage("Nome e e-mail são obrigatórios.");
      return;
    }

    if (!editingId && !form.password.trim()) {
      setMessage("Senha é obrigatória ao criar participante.");
      return;
    }

    const duplicatedEmail = data.participants.some(
      (participant) =>
        participant.email.trim().toLowerCase() === form.email.trim().toLowerCase() &&
        participant.id !== editingId,
    );

    if (duplicatedEmail) {
      setMessage("Já existe um participante com este e-mail.");
      return;
    }

    if (!backendSessionToken) {
      setMessage(backendRequiredMessage);
      return;
    }

    try {
      const snapshot = await adminUpsertParticipantToBackend(backendSessionToken, {
        id: editingId,
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        status: form.status,
      });

      onBackendSnapshot(snapshot);
      setMessage(editingId ? "Participante atualizado." : "Participante cadastrado.");
      resetForm();
    } catch (error) {
      const details = error instanceof Error ? error.message : "";
      setMessage(details ? `Não foi possível salvar no Supabase: ${details}` : "Não foi possível salvar no Supabase. Confira os dados e tente novamente.");
    }
  }

  async function toggleParticipantStatus(participant: Participant) {
    if (!backendSessionToken) {
      setMessage(backendRequiredMessage);
      return;
    }

    try {
      const snapshot = await adminToggleParticipantToBackend(backendSessionToken, participant.id);
      onBackendSnapshot(snapshot);
    } catch (error) {
      const details = error instanceof Error ? error.message : "";
      setMessage(details ? `Não foi possível alterar o status no Supabase: ${details}` : "Não foi possível alterar o status no Supabase.");
    }
  }

  return (
    <section className="participants-config">
      <div className="config-subhead">
        <div>
          <h3>Participantes</h3>
          <p>Total: {participants.length} participantes · perfis gerenciados somente pelo administrador</p>
        </div>
      </div>

      <div className="admin-workspace">
        <form className="admin-form" onSubmit={submitParticipant}>
          <h3>{editingId ? "Editar participante" : "Cadastrar participante"}</h3>
          <label>
            <span>Nome</span>
            <input onChange={(event) => updateForm("name", event.target.value)} value={form.name} />
          </label>
          <label>
            <span>E-mail</span>
            <input
              inputMode="email"
              onChange={(event) => updateForm("email", event.target.value)}
              type="text"
              value={form.email}
            />
          </label>
          <label>
            <span>Senha</span>
            <input
              onChange={(event) => updateForm("password", event.target.value)}
              placeholder={editingId ? "Deixe em branco para manter" : ""}
              type="password"
              value={form.password}
            />
          </label>
          <label>
            <span>Status</span>
            <select onChange={(event) => updateForm("status", event.target.value)} value={form.status}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>

          {message && <p className={`alert ${message.includes("obrigat") || message.includes("existe") || message.includes("Supabase") || message.includes("sessão") ? "error" : "success"}`}>{message}</p>}

          <div className="button-row">
            <button className="btn" type="submit">
              {editingId ? "Salvar alterações" : "Cadastrar participante"}
            </button>
            {editingId && (
              <button className="btn secondary" onClick={resetForm} type="button">
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="admin-panel">
          <h3>Participantes</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((participant) => (
                  <tr key={participant.id}>
                    <td>{participant.name}</td>
                    <td>{participant.email}</td>
                    <td>
                      <span className={`status-pill ${participant.status}`}>{participant.status === "active" ? "Ativo" : "Inativo"}</span>
                    </td>
                    <td className="table-actions">
                      <button className="mini-button" onClick={() => editParticipant(participant)} type="button">
                        Editar
                      </button>
                      <button className="mini-button" onClick={() => toggleParticipantStatus(participant)} type="button">
                        {participant.status === "active" ? "Inativar" : "Ativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </section>
  );
}

function RankingPage({ currentUser, data }: { currentUser: Participant; data: AppData }) {
  const rankingControl = getStageControl(data, "ranking");
  const rows = getRankingRows(data);
  const currentRow = rows.find((row) => row.participant.id === currentUser.id);

  if (!rankingControl?.isOpen && currentUser.role !== "admin") {
    return (
      <section className="empty-state">
        <p className="eyebrow">Classificação</p>
        <h2>Classificação temporariamente oculta</h2>
        <p>A organização ainda não liberou a visualização da classificação.</p>
      </section>
    );
  }

  return (
    <section className="ranking-screen">
      <div className="ranking-layout">
        <div className="table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Posição</th>
                  <th>Participante</th>
                  <th>Pontos</th>
                  <th>Cravadas</th>
                  <th>Acertos</th>
                  <th>Palpites preenchidos</th>
                  <th>Última atualização</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr className={row.participant.id === currentUser.id ? "you-row" : ""} key={row.participant.id}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{row.participant.name}</strong>
                      <span>{row.participant.role === "admin" ? "Admin participante" : "Participante"}</span>
                    </td>
                    <td>{row.points}</td>
                    <td>{row.exactHits}</td>
                    <td>{row.resultHits}</td>
                    <td>{row.status}</td>
                    <td>{formatDateTime(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <aside>
          <div className="metric-card">
            <small>Sua posição</small>
            <strong>{Math.max(1, rows.findIndex((row) => row.participant.id === currentUser.id) + 1)}º</strong>
          </div>
          <div className="metric-card">
            <small>Pontos totais</small>
            <strong>{currentRow?.points ?? 0}</strong>
          </div>
          <div className="metric-card">
            <small>Cravadas</small>
            <strong>{currentRow?.exactHits ?? 0}</strong>
          </div>
          <div className="metric-card">
            <small>Acertos</small>
            <strong>{currentRow?.resultHits ?? 0}</strong>
          </div>
        </aside>
      </div>
    </section>
  );
}

function OfficialResultsPanel({
  backendSessionToken,
  data,
  onBackendSnapshot,
  onCommit,
}: {
  backendSessionToken: string | null;
  data: AppData;
  onBackendSnapshot: (snapshot: BackendSnapshot) => void;
  onCommit: (updater: (current: AppData) => AppData) => void;
}) {
  const [stage, setStage] = useState<ResultStage>("group_stage");
  const [activeGroup, setActiveGroup] = useState(GROUPS[0]);
  const [syncMessage, setSyncMessage] = useState("");
  const resultMap = buildOfficialResultMap(data.officialResults, stage);
  const stageMatches = getOfficialMatchesForStage(data, stage);
  const matches = stage === "group_stage"
    ? stageMatches.filter((match) => "group" in match && match.group === activeGroup)
    : stageMatches;

  function updateResult(match: ProjectedMatch, field: "homeGoals" | "awayGoals" | "winnerTeamId", value: string) {
    const now = new Date().toISOString();
    const existing = resultMap[match.id];
    const next: OfficialResult = {
      id: existing?.id ?? `result-${stage}-${match.id}`,
      stage,
      matchId: match.id,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeGoals: existing?.homeGoals ?? null,
      awayGoals: existing?.awayGoals ?? null,
      winnerTeamId: existing?.winnerTeamId,
      updatedAt: now,
    };

    if (field === "winnerTeamId") {
      next.winnerTeamId = value || undefined;
    } else {
      next[field] = value === "" ? null : Number(value);

      if (stage !== "group_stage" && next.homeGoals !== null && next.awayGoals !== null && next.homeGoals !== next.awayGoals) {
        next.winnerTeamId = next.homeGoals > next.awayGoals ? match.homeTeamId : match.awayTeamId;
      }
    }

    if (stage === "group_stage") {
      next.winnerTeamId = undefined;
    }

    // TODO: replace local manual fallback with backend-fed official results.
    onCommit((current) => {
      return {
        ...current,
        officialResults: [
          ...current.officialResults.filter((result) => !(result.stage === stage && result.matchId === match.id)),
          next,
        ],
      };
    });

    if (backendSessionToken) {
      const projectedRound = "round" in match && typeof match.round === "number" ? match.round : undefined;
      const projectedGroup = "group" in match && typeof match.group === "string" ? match.group : null;

      adminRecordOfficialResultToBackend(backendSessionToken, {
        ...next,
        round: projectedRound,
        group: projectedGroup,
      })
        .then((snapshot) => {
          setSyncMessage("");
          onBackendSnapshot(snapshot);
        })
        .catch(() => {
          setSyncMessage("Não foi possível sincronizar este resultado no Supabase.");
        });
    }
  }

  return (
    <section className="admin-panel results-panel">
      <div className="section-head">
        <div>
          <h3>Resultados oficiais</h3>
          <p>O backend deve alimentar esses placares. A edição manual aqui é fallback do Admin.</p>
        </div>
        <select onChange={(event) => setStage(event.target.value as ResultStage)} value={stage}>
          {resultStageOptions.map((option) => (
            <option key={option} value={option}>{stageLabels[option]}</option>
          ))}
        </select>
      </div>

      {stage === "group_stage" && (
        <div className="group-tabs result-tabs">
          {GROUPS.map((group) => (
            <button
              className={activeGroup === group ? "group-tab active" : "group-tab"}
              key={group}
              onClick={() => setActiveGroup(group)}
              type="button"
            >
              {groupLabel(group)}
            </button>
          ))}
        </div>
      )}

      {!matches.length ? (
        <section className="empty-state inline-empty">
          <p className="eyebrow">Aguardando fase anterior</p>
          <h2>Sem confrontos definidos</h2>
          <p>Aguarde a alimentação do backend ou use Configurações como fallback manual.</p>
        </section>
      ) : (
        <div className="results-list">
          {syncMessage && <p className="alert error">{syncMessage}</p>}
          {matches.map((match, index) => {
            const homeTeam = getTeam(data.teams, match.homeTeamId);
            const awayTeam = getTeam(data.teams, match.awayTeamId);
            const result = resultMap[match.id];

            return (
              <article className="result-row" key={match.id}>
                <header>
                  <span>{"round" in match ? `Rodada ${match.round}` : `Jogo ${index + 1}`}</span>
                  <strong>{stageLabels[stage]}</strong>
                </header>
                <div className="game-row">
                  <div className="team">
                    <TeamFlag team={homeTeam} />
                    {homeTeam?.name}
                  </div>
                  <div className="score">
                    <ScoreInput
                      label={`Gols ${homeTeam?.name}`}
                      onChange={(value) => updateResult(match, "homeGoals", value)}
                      value={result?.homeGoals}
                    />
                    x
                    <ScoreInput
                      label={`Gols ${awayTeam?.name}`}
                      onChange={(value) => updateResult(match, "awayGoals", value)}
                      value={result?.awayGoals}
                    />
                  </div>
                  <div className="team away">
                    {awayTeam?.name}
                    <TeamFlag team={awayTeam} />
                  </div>
                </div>

                {stage !== "group_stage" && (
                  <label className="winner-line">
                    <span>Classificado oficial</span>
                    <select onChange={(event) => updateResult(match, "winnerTeamId", event.target.value)} value={result?.winnerTeamId ?? ""}>
                      <option value="">Selecione</option>
                      <option value={match.homeTeamId}>{homeTeam?.name}</option>
                      <option value={match.awayTeamId}>{awayTeam?.name}</option>
                    </select>
                  </label>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LocksPage({
  backendSessionToken,
  data,
  onBackendSnapshot,
  onCommit,
}: {
  backendSessionToken: string | null;
  data: AppData;
  onBackendSnapshot: (snapshot: BackendSnapshot) => void;
  onCommit: (updater: (current: AppData) => AppData) => void;
}) {
  const [activeConfigTab, setActiveConfigTab] = useState<ConfigTab>("participants");

  async function updateStage(stage: keyof typeof stageLabels, patch: { isOpen?: boolean; deadlineAt?: string }) {
    const now = new Date().toISOString();
    const isSharedDeadlinePatch =
      typeof patch.deadlineAt === "string" && (stage === "initial_predictions" || stage === "group_stage");
    const stagesToUpdate: StageName[] = isSharedDeadlinePatch
        ? ["initial_predictions", "group_stage"]
        : [stage];

    if (backendSessionToken) {
      try {
        let latestSnapshot: BackendSnapshot | null = null;

        for (const stageToUpdate of stagesToUpdate) {
          const currentControl = data.stageControls.find((control) => control.stage === stageToUpdate);

          if (currentControl) {
            latestSnapshot = await adminUpdateStageControlToBackend(
              backendSessionToken,
              stageToUpdate,
              patch.isOpen ?? currentControl.isOpen,
              patch.deadlineAt ?? currentControl.deadlineAt ?? null,
            );
          }
        }

        if (latestSnapshot) {
          onBackendSnapshot(latestSnapshot);
        }
      } catch {
        // Local fallback below keeps the admin UI responsive during development.
      }
    }

    onCommit((current) => ({
      ...current,
      stageControls: current.stageControls.map((control) =>
        stagesToUpdate.includes(control.stage) ? { ...control, ...patch, updatedAt: now } : control,
      ),
    }));
  }
  const now = new Date();
  const stageSections: Array<{ title: string; description: string; stages: StageName[] }> = [
    {
      title: "Entrada de palpites",
      description: "Palpites Gerais e Palpites compartilham o mesmo prazo de envio.",
      stages: ["initial_predictions", "group_stage"],
    },
    {
      title: "Mata-mata",
      description: "Fases que aparecem quando o backend/resultados montarem os confrontos.",
      stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    },
    {
      title: "Visibilidade",
      description: "Controle do que fica disponível para todos acompanharem.",
      stages: ["ranking"],
    },
  ];
  const openControls = data.stageControls.filter((control) => control.isOpen).length;
  const nextDeadline = data.stageControls
    .filter((control) => control.stage !== "ranking" && control.deadlineAt && new Date(control.deadlineAt) > now)
    .sort((a, b) => new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime())[0];
  const filledOfficialResults = data.officialResults.filter((result) => result.homeGoals !== null && result.awayGoals !== null).length;
  const totalOfficialSlots = data.matches.length + fixture.knockoutMatches.length;

  return (
    <section className="locks-screen">
      <div className="config-summary-grid">
        <article>
          <small>Fases abertas</small>
          <strong>{openControls}/{data.stageControls.length}</strong>
          <span>Inclui páginas e palpites.</span>
        </article>
        <article>
          <small>Próximo prazo</small>
          <strong>{nextDeadline ? stageLabels[nextDeadline.stage] : "Sem prazo futuro"}</strong>
          <span>{nextDeadline ? formatDateTime(nextDeadline.deadlineAt) : "Revise as datas das fases."}</span>
        </article>
        <article>
          <small>Resultados oficiais</small>
          <strong>{filledOfficialResults}/{totalOfficialSlots}</strong>
          <span>Placar salvo no fallback do Admin.</span>
        </article>
      </div>

      <div className="config-tabs" role="tablist" aria-label="Seções de configuração">
        {[
          { id: "participants" as const, label: "Participantes" },
          { id: "stages" as const, label: "Fases e prazos" },
          { id: "results" as const, label: "Resultados oficiais" },
        ].map((tab) => (
          <button
            aria-selected={activeConfigTab === tab.id}
            className={activeConfigTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => setActiveConfigTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeConfigTab === "participants" && (
        <ParticipantSettingsPanel backendSessionToken={backendSessionToken} data={data} onBackendSnapshot={onBackendSnapshot} />
      )}

      {activeConfigTab === "stages" && (
      <div className="config-layout">
        <section className="config-panel stages-panel">
          <header>
            <div>
              <small>Liberação</small>
              <h3>Fases e páginas</h3>
            </div>
          </header>
          <div className="stage-sections">
            {stageSections.map((section) => (
              <div className="stage-section" key={section.title}>
                <div className="stage-section-head">
                  <strong>{section.title}</strong>
                  <span>{section.description}</span>
                </div>
                <div className="stage-list">
                  {section.stages.map((stage) => {
                    const control = data.stageControls.find((stageControl) => stageControl.stage === stage);

                    if (!control) {
                      return null;
                    }

                    const computedState = isBettingPhase(control.stage) ? phaseStatusLabel(getPhaseGate(data, control.stage)) : null;

                    return (
                      <div className="stage-row" key={control.stage}>
                        <div className="stage-copy">
                          <strong>{stageLabels[control.stage]}</strong>
                          <span>
                            {control.stage === "ranking"
                              ? "Controle de visibilidade da página"
                              : `Prazo atual: ${formatDateTime(control.deadlineAt)} · ${computedState}`}
                          </span>
                        </div>
                        <label className="stage-deadline">
                          <span>{control.stage === "ranking" ? "Data de referência" : "Data e hora limite"}</span>
                          <input
                            onChange={(event) => updateStage(control.stage, { deadlineAt: fromDateTimeInputValue(event.target.value) })}
                            type="datetime-local"
                            value={toDateTimeInputValue(control.deadlineAt)}
                          />
                        </label>
                        <div className="stage-actions">
                          <span className={control.isOpen ? "stage-state open" : "stage-state closed"}>
                            {control.stage === "ranking"
                              ? control.isOpen ? "Visível" : "Oculto"
                              : control.isOpen ? "Aberto" : "Fechado"}
                          </span>
                          <label className="switch-toggle">
                            <input
                              aria-label={`Alterar status de ${stageLabels[control.stage]}`}
                              checked={control.isOpen}
                              onChange={(event) => updateStage(control.stage, { isOpen: event.target.checked })}
                              type="checkbox"
                            />
                            <span aria-hidden="true" />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      )}

      {activeConfigTab === "results" && (
        <OfficialResultsPanel backendSessionToken={backendSessionToken} data={data} onBackendSnapshot={onBackendSnapshot} onCommit={onCommit} />
      )}
    </section>
  );
}

function RulesPage() {
  return (
    <section className="rules-screen">
      <div className="rules-grid rules-compact">
        <section className="rule-block">
          <h3>Classificação das Equipes</h3>
          <ul>
            <li>1º e 2º lugar do grupo: 5 pontos</li>
            <li>Cada finalista: 10 pontos</li>
            <li>Campeão: 15 pontos</li>
          </ul>
        </section>

        <section className="rule-block">
          <h3>Prêmios Individuais</h3>
          <ul>
            <li>Artilheiro: 15 pontos</li>
            <li>Melhor jogador: 15 pontos</li>
          </ul>
        </section>

        <section className="rule-block">
          <h3>Fase de Grupos</h3>
          <ul>
            <li>Acerto: 12 pontos</li>
            <li>Resultado + parcial: 7 pontos</li>
            <li>Resultado: 5 pontos</li>
            <li>Sem resultado: 0 pontos</li>
          </ul>
        </section>

        <section className="rule-block">
          <h3>Mata-mata</h3>
          <p>Resultado pelo tempo regulamentar.</p>
          <ul>
            <li>Acerto: 15 pontos</li>
            <li>Resultado + parcial: 8 pontos</li>
            <li>Resultado: 6 pontos</li>
            <li>Sem resultado: 0 pontos</li>
          </ul>
        </section>

        <section className="rule-block">
          <h3>Como os palpites são avaliados</h3>
          <ol>
            <li>Placar completo correto: acerto.</li>
            <li>Resultado correto + gols parciais.</li>
            <li>Apenas vencedor/empate correto.</li>
            <li>Resultado errado: 0 ponto.</li>
          </ol>
        </section>

        <section className="rule-block">
          <h3>Desempate da Fase de Grupos</h3>
          <ol>
            <li>Confronto direto</li>
            <li>Saldo de gols</li>
            <li>Gols marcados</li>
          </ol>
        </section>
      </div>
    </section>
  );
}
