import { I18n } from "i18n-js";

export type Language = "en" | "ko" | "ja" | "zh-CN";

const SETTINGS_KEY = "rainbow-chain-settings";

function getInitialLocale(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    const lang = raw ? (JSON.parse(raw) as { language?: string }).language : null;
    if (lang === "ko" || lang === "ja" || lang === "zh-CN") return lang;
  } catch { /* ignore */ }
  return "en";
}

const translations = {
  en: {
    casual: "casual",
    double: "double",
    practice: "practice",
    settings: "settings",
    loading: "LOADING",
    matchmaking: "MATCHMAKING",
    deployingAi: "DEPLOYING AI OPPONENT",
    searching: "SEARCHING",
    casualMatchmaking: "CASUAL MATCHMAKING",
    matchFound: "MATCH FOUND",
    aiMatch: "AI MATCH",
    searchingOpponent: "Searching for opponent...",
    connectingToServer: "Connecting to matchmaking server...",
    cancel: "cancel",
    restart: "Restart",
    main: "Main",
    mainMenu: "Main Menu",
    waitingForOpponent: "Waiting for opponent...",
    opponentLeft: "Opponent left. Searching new match...",
    searchingNewMatch: "Searching new match...",
    settingsTitle: "Settings",
    back: "back",
    nicknameSetting: "Nickname",
    guestName: "Guest Name",
    languageSetting: "Language",
    keySettings: "Key Settings",
    pressKey: "press key...",
    sound: "Sound",
    glowParticle: "Glow / Particle",
    glow: "Glow",
    particle: "Particle",
    enterNickname: "Please write your nickname.",
    start: "start",
    encounterLabel: "ENCOUNTER",
    encounter: {
      chainStorm: {
        name: "Chain Storm",
        description: "Chains are produced faster across the arena.",
      },
      itemFever: {
        name: "Item Fever",
        description: "Items spawn more often for nonstop pickups.",
      },
      overclock: {
        name: "Overclock",
        description: "Chains launch faster once the warning ends.",
      },
    },
  },
  ko: {
    casual: "캐주얼",
    double: "더블",
    practice: "연습",
    settings: "설정",
    loading: "로딩 중",
    matchmaking: "매칭 중",
    deployingAi: "AI 배치 중",
    searching: "탐색 중",
    casualMatchmaking: "캐주얼 매칭",
    matchFound: "매칭 완료",
    aiMatch: "AI 매칭",
    searchingOpponent: "상대방을 찾는 중...",
    connectingToServer: "매칭 서버에 연결 중...",
    cancel: "취소",
    restart: "재시작",
    main: "메인",
    mainMenu: "메인 메뉴",
    waitingForOpponent: "상대방을 기다리는 중...",
    opponentLeft: "상대방이 나갔습니다. 새 매칭 탐색 중...",
    searchingNewMatch: "새 매칭 탐색 중...",
    settingsTitle: "설정",
    back: "뒤로",
    nicknameSetting: "닉네임",
    guestName: "게스트 이름",
    languageSetting: "언어",
    keySettings: "키 설정",
    pressKey: "키를 누르세요...",
    sound: "사운드",
    glowParticle: "글로우 / 파티클",
    glow: "글로우",
    particle: "파티클",
    enterNickname: "닉네임을 입력해주세요.",
    start: "시작",
    encounterLabel: "조우",
    encounter: {
      chainStorm: {
        name: "체인 폭풍",
        description: "아레나 전체에서 체인이 더 빠르게 생성됩니다.",
      },
      itemFever: {
        name: "아이템 피버",
        description: "아이템이 더 자주 생성되어 끊임없이 획득할 수 있습니다.",
      },
      overclock: {
        name: "오버클록",
        description: "경고가 끝나면 체인이 더 빠르게 발사됩니다.",
      },
    },
  },
  ja: {
    casual: "カジュアル",
    double: "ダブル",
    practice: "練習",
    settings: "設定",
    loading: "ロード中",
    matchmaking: "マッチング中",
    deployingAi: "AI配備中",
    searching: "検索中",
    casualMatchmaking: "カジュアルマッチング",
    matchFound: "マッチ成立",
    aiMatch: "AIマッチ",
    searchingOpponent: "対戦相手を探しています...",
    connectingToServer: "マッチングサーバーに接続中...",
    cancel: "キャンセル",
    restart: "リスタート",
    main: "メイン",
    mainMenu: "メインメニュー",
    waitingForOpponent: "対戦相手を待っています...",
    opponentLeft: "相手が退出しました。新しいマッチを探しています...",
    searchingNewMatch: "新しいマッチを探しています...",
    settingsTitle: "設定",
    back: "戻る",
    nicknameSetting: "ニックネーム",
    guestName: "ゲスト名",
    languageSetting: "言語",
    keySettings: "キー設定",
    pressKey: "キーを押してください...",
    sound: "サウンド",
    glowParticle: "グロー / パーティクル",
    glow: "グロー",
    particle: "パーティクル",
    enterNickname: "ニックネームを入力してください。",
    start: "スタート",
    encounterLabel: "エンカウント",
    encounter: {
      chainStorm: {
        name: "チェーンストーム",
        description: "アリーナ全体でチェーンの生成が速くなります。",
      },
      itemFever: {
        name: "アイテムフィーバー",
        description: "アイテムの出現頻度が上がり、連続で回収できます。",
      },
      overclock: {
        name: "オーバークロック",
        description: "警告終了後、チェーンの発射速度が上がります。",
      },
    },
  },
  "zh-CN": {
    casual: "休闲",
    double: "双人",
    practice: "练习",
    settings: "设置",
    loading: "加载中",
    matchmaking: "匹配中",
    deployingAi: "部署AI对手中",
    searching: "搜索中",
    casualMatchmaking: "休闲匹配",
    matchFound: "找到对手",
    aiMatch: "AI对战",
    searchingOpponent: "正在搜索对手...",
    connectingToServer: "连接匹配服务器中...",
    cancel: "取消",
    restart: "重新开始",
    main: "主界面",
    mainMenu: "主菜单",
    waitingForOpponent: "等待对手中...",
    opponentLeft: "对手已离开。正在搜索新对手...",
    searchingNewMatch: "正在搜索新对手...",
    settingsTitle: "设置",
    back: "返回",
    nicknameSetting: "昵称",
    guestName: "访客名称",
    languageSetting: "语言",
    keySettings: "按键设置",
    pressKey: "请按键...",
    sound: "音效",
    glowParticle: "光效 / 粒子",
    glow: "光效",
    particle: "粒子",
    enterNickname: "请输入您的昵称。",
    start: "开始",
    encounterLabel: "遭遇事件",
    encounter: {
      chainStorm: {
        name: "锁链风暴",
        description: "整个竞技场中的锁链生成速度会更快。",
      },
      itemFever: {
        name: "道具狂热",
        description: "道具会更频繁出现，能够连续拾取。",
      },
      overclock: {
        name: "超频",
        description: "警告结束后，锁链发射速度会更快。",
      },
    },
  },
};

export const i18n = new I18n(translations);
i18n.enableFallback = true;
i18n.defaultLocale = "en";
i18n.locale = getInitialLocale();

export function setLocale(lang: Language): void {
  i18n.locale = lang;
}

export function t(key: string): string {
  return String(i18n.t(key));
}
