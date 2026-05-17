import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RoomStartPayload } from "../network/events";
import { DEFAULT_SETTINGS, type AppSettings } from "../settings";

export type MenuMode = "casual" | "practice" | "double";
export type ViewState = "menu" | "settings" | "help" | "matchmaking";
export type ControlKey = keyof AppSettings["controls"];

const LEGACY_SETTINGS_STORAGE_KEY = "rainbow-chain-settings";
const LEGACY_GUEST_NICKNAME_STORAGE_KEY = "guestNickname";
const LEGACY_GUEST_ID_STORAGE_KEY = "guestId";
const APP_STORE_STORAGE_KEY = "rainbow-chain-app";

function sanitizeNickname(value: string): string {
  return value.trim().slice(0, 8);
}

function generateGuestNickname(): string {
  return `Guest_${Math.floor(10 + Math.random() * 90)}`;
}

function generateGuestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `guest_${crypto.randomUUID()}`;
  }
  return `guest_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}

function readLegacySettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const raw = window.localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      controls: {
        ...DEFAULT_SETTINGS.controls,
        ...parsed.controls,
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function readLegacyGuestNickname(): string {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem(LEGACY_GUEST_NICKNAME_STORAGE_KEY);
  return raw ? sanitizeNickname(raw) : "";
}

function readLegacyGuestId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(LEGACY_GUEST_ID_STORAGE_KEY) ?? "";
}

function createInitialAppState() {
  const guestNickname = readLegacyGuestNickname();
  return {
    settings: readLegacySettings(),
    selectedMode: null as MenuMode | null,
    view: "menu" as ViewState,
    queueSeconds: 0,
    aiMatchDeployed: false,
    matchmakingStatus: "MATCHMAKING",
    matchmakingDetail: "Searching for opponent...",
    activeRoomStart: null as RoomStartPayload | null,
    listeningKey: null as ControlKey | null,
    guestId: readLegacyGuestId(),
    guestNickname,
    nicknameInput: guestNickname,
    hasEnteredNickname: guestNickname.length > 0,
    transitionActive: false,
    transitionLabel: "LOADING",
    battleTrackIndex: 0,
  };
}

export interface AppStoreState {
  settings: AppSettings;
  selectedMode: MenuMode | null;
  view: ViewState;
  queueSeconds: number;
  aiMatchDeployed: boolean;
  matchmakingStatus: string;
  matchmakingDetail: string;
  activeRoomStart: RoomStartPayload | null;
  listeningKey: ControlKey | null;
  guestId: string;
  guestNickname: string;
  nicknameInput: string;
  hasEnteredNickname: boolean;
  transitionActive: boolean;
  transitionLabel: string;
  battleTrackIndex: number;
  setSettings: (next: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
  setSelectedMode: (next: MenuMode | null) => void;
  setView: (next: ViewState) => void;
  setQueueSeconds: (next: number) => void;
  setAiMatchDeployed: (next: boolean) => void;
  setMatchmakingStatus: (next: string) => void;
  setMatchmakingDetail: (next: string) => void;
  setActiveRoomStart: (next: RoomStartPayload | null) => void;
  setListeningKey: (next: ControlKey | null) => void;
  setGuestId: (next: string) => void;
  setGuestNickname: (next: string) => void;
  setNicknameInput: (next: string) => void;
  setHasEnteredNickname: (next: boolean) => void;
  setTransitionActive: (next: boolean) => void;
  setTransitionLabel: (next: string) => void;
  setBattleTrackIndex: (next: number) => void;
  ensureGuestIdentity: () => { guestId: string; nickname: string };
  updateGuestNickname: (value: string) => void;
  confirmGuestNickname: () => void;
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      ...createInitialAppState(),
      setSettings: (next) => {
        set((state) => ({
          settings: typeof next === "function" ? next(state.settings) : next,
        }));
      },
      setSelectedMode: (next) => set({ selectedMode: next }),
      setView: (next) => set({ view: next }),
      setQueueSeconds: (next) => set({ queueSeconds: next }),
      setAiMatchDeployed: (next) => set({ aiMatchDeployed: next }),
      setMatchmakingStatus: (next) => set({ matchmakingStatus: next }),
      setMatchmakingDetail: (next) => set({ matchmakingDetail: next }),
      setActiveRoomStart: (next) => set({ activeRoomStart: next }),
      setListeningKey: (next) => set({ listeningKey: next }),
      setGuestId: (next) => set({ guestId: next }),
      setGuestNickname: (next) => set({ guestNickname: next }),
      setNicknameInput: (next) => set({ nicknameInput: next }),
      setHasEnteredNickname: (next) => set({ hasEnteredNickname: next }),
      setTransitionActive: (next) => set({ transitionActive: next }),
      setTransitionLabel: (next) => set({ transitionLabel: next }),
      setBattleTrackIndex: (next) => set({ battleTrackIndex: next }),
      ensureGuestIdentity: () => {
        const state = get();
        const nextGuestId = state.guestId.trim() || generateGuestId();
        const nextGuestNickname = state.guestNickname.trim()
          || sanitizeNickname(state.nicknameInput)
          || generateGuestNickname();

        set({
          guestId: nextGuestId,
          guestNickname: nextGuestNickname,
          nicknameInput: nextGuestNickname,
          hasEnteredNickname: true,
        });

        return {
          guestId: nextGuestId,
          nickname: nextGuestNickname,
        };
      },
      updateGuestNickname: (value) => {
        const nextNickname = sanitizeNickname(value);
        const resolvedNickname = nextNickname || generateGuestNickname();
        set({
          guestNickname: resolvedNickname,
          nicknameInput: resolvedNickname,
          hasEnteredNickname: true,
        });
      },
      confirmGuestNickname: () => {
        const state = get();
        const nextNickname = sanitizeNickname(state.nicknameInput) || generateGuestNickname();
        set({
          guestNickname: nextNickname,
          nicknameInput: nextNickname,
          hasEnteredNickname: true,
        });
      },
    }),
    {
      name: APP_STORE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        guestId: state.guestId,
        guestNickname: state.guestNickname,
        nicknameInput: state.nicknameInput,
        hasEnteredNickname: state.hasEnteredNickname,
      }),
    },
  ),
);
