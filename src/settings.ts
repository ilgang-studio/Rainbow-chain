export interface ControlSettings {
  up: string;
  down: string;
  left: string;
  right: string;
  use: string;
}

export interface AppSettings {
  language: "en" | "ko" | "ja" | "zh-CN";
  controls: ControlSettings;
  bgmVolume: number;
  sfxVolume: number;
  glowIntensity: "low" | "medium" | "high";
  particleIntensity: "low" | "medium" | "high";
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "en",
  controls: {
    up: "w",
    down: "s",
    left: "a",
    right: "d",
    use: " ",
  },
  bgmVolume: 70,
  sfxVolume: 82,
  glowIntensity: "medium",
  particleIntensity: "medium",
};
