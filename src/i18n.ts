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

    casual: "CASUAL",

    double: "LOCAL VS",

    practice: "PRACTICE",

    settings: "SETTINGS",

    help: "HELP",

    loading: "LOADING",

    matchmaking: "MATCHMAKING",

    deployingAi: "DEPLOYING AI OPPONENT",

    searching: "SEARCHING...",

    casualMatchmaking: "CASUAL MATCHMAKING",

    matchFound: "MATCH FOUND",

    aiMatch: "AI MATCH",

    searchingOpponent: "Searching for opponent...",

    connectingToServer: "Connecting to matchmaking server...",

    cancel: "CANCEL",

    restart: "REMATCH",

    main: "MAIN MENU",

    mainMenu: "MAIN MENU",

    round: "ROUND",

    roundResult: "ROUND RESULT",

    finalScore: "FINAL SCORE",

    youShort: "YOU",

    opponentShort: "OPP",

    victory: "VICTORY",

    defeat: "DEFEAT",

    preparingNextRound: "Preparing next round...",

    nextRoundIn: "Starting in %{count}",

    rematch: "REMATCH",

    waitingForOpponent: "Waiting for opponent...",

    opponentLeft: "Opponent disconnected.",

    opponentAwayCountdown: "Opponent disconnected. %{count}s remaining...",

    searchingNewMatch: "Searching for a new match...",

    settingsTitle: "Settings",

    helpTitle: "Help",

    helpPageBasics: "Page 1 · Basics",

    helpPageChainsA: "Page 2 · Chains I",

    helpPageChainsB: "Page 3 · Chains II",

    helpPageItemsModes: "Page 4 · Items & Modes",

    helpPrev: "Previous",

    helpNext: "Next",

    helpObjectiveTitle: "Objective",

    helpObjectiveBody: "Survive the chains and force your opponent into danger first.",

    helpControlsTitle: "Controls",

    helpControlsBody: "Move with your configured keys. After picking up an item, use your chain key to trigger it.",

    helpHazardsTitle: "Arena Rules",

    helpHazardsBody: "Every chain shows a warning before its hitbox becomes active. The arena pressure increases as the round continues.",

    helpChainsTitle: "Chain Types",

    helpChainNormalTitle: "Normal",

    helpChainNormalBody: "A basic straight chain that cuts across the opponent arena.",

    helpChainRushTitle: "Rush",

    helpChainRushBody: "A high-speed chain with a very short warning window.",

    helpChainTurnTitle: "Turn",

    helpChainTurnBody: "An L-shaped chain that bends once. Dodging the first line may still lead into the second.",

    helpChainFakeTitle: "Fake",

    helpChainFakeBody: "A deceptive chain that shows a false warning before the real attack follows.",

    helpChainGiantTitle: "Giant",

    helpChainGiantBody: "A massive chain that blocks a much wider area.",

    helpChainTrackingTitle: "Tracking",

    helpChainTrackingBody: "A tracking chain that bends toward the target after launch.",

    helpChainPhaseTitle: "Phase",

    helpChainPhaseBody: "A phase chain that disappears briefly, then returns on the same line.",

    helpItemsTitle: "Items",

    helpItemsBody: "Picking up an item stores one random chain. Using it creates a chain at a random position in the opponent arena.",

    helpPracticeTitle: "Practice Mode",

    helpPracticeBody: "Practice starts with lower pressure so you can learn spacing and dodge timing.",

    helpModesTitle: "Modes",

    helpModesBody: "Casual is online matchmaking, Local VS is two players on one device, and Practice is solo survival.",

    back: "BACK",

    nicknameSetting: "Nickname",

    guestName: "Guest Name",

    languageSetting: "Language",

    keySettings: "Key Settings",

    pressKey: "press key...",

    sound: "Sound",

    glowParticle: "Glow / Particle",

    glow: "Glow",

    particle: "Particle",

    enterNickname: "Please enter your nickname.",

    start: "START",

    encounterLabel: "ENCOUNTER",

    encounter: {

      chainStorm: {

        name: "Chain Storm",

        description: "Chain generation speed increases across the arena.",

      },

      itemFever: {

        name: "Item Fever",

        description: "Items spawn much more frequently.",

      },

      overclock: {

        name: "Overclock",

        description: "Chains launch faster after their warning ends.",

      },

    },

  },
  ko: {
    casual: "캐주얼",
    double: "로컬 대전",
    practice: "연습",
    settings: "설정",
    help: "도움말",

    loading: "LOADING",
    matchmaking: "매칭 중",

    deployingAi: "AI 상대 배치 중",
    searching: "탐색 중...",

    casualMatchmaking: "캐주얼 매칭",
    matchFound: "MATCH FOUND",
    aiMatch: "AI MATCH",

    searchingOpponent: "상대방을 찾는 중...",
    connectingToServer: "매칭 서버 연결 중...",

    cancel: "취소",

    restart: "리매치",

    main: "메인 메뉴",
    mainMenu: "메인 메뉴",

    round: "ROUND",
    roundResult: "ROUND RESULT",
    finalScore: "FINAL SCORE",

    youShort: "YOU",
    opponentShort: "OPP",

    victory: "VICTORY",
    defeat: "DEFEAT",

    preparingNextRound: "다음 라운드 준비 중...",
    nextRoundIn: "%{count}초 후 시작",

    rematch: "REMATCH",

    waitingForOpponent: "상대방을 기다리는 중...",

    opponentLeft: "상대방이 연결을 종료했습니다.",

    opponentAwayCountdown: "상대방이 연결을 잃었습니다. %{count}초 남음...",

    searchingNewMatch: "새로운 매치를 찾는 중...",

    settingsTitle: "설정",
    helpTitle: "도움말",

    helpPageBasics: "1장 · 기본",
    helpPageChainsA: "2장 · 체인 I",
    helpPageChainsB: "3장 · 체인 II",
    helpPageItemsModes: "4장 · 아이템 & 모드",

    helpPrev: "이전",
    helpNext: "다음",

    helpObjectiveTitle: "목표",
    helpObjectiveBody:
      "체인을 피하며 생존하고, 상대를 먼저 위험 구역에 몰아넣으세요.",

    helpControlsTitle: "조작",
    helpControlsBody:
      "설정한 이동 키로 움직이며, 아이템 획득 후 사용 키로 체인을 발동합니다.",

    helpHazardsTitle: "아레나 규칙",
    helpHazardsBody:
      "모든 체인은 먼저 경고를 표시한 뒤 실제 공격 판정이 활성화됩니다. 시간이 지날수록 아레나 압박은 강해집니다.",

    helpChainsTitle: "체인 종류",

    helpChainNormalTitle: "노멀",
    helpChainNormalBody:
      "가장 기본적인 직선 체인입니다. 상대 아레나를 곧게 가로지릅니다.",

    helpChainRushTitle: "러시",
    helpChainRushBody:
      "경고 시간이 매우 짧은 고속 돌진 체인입니다.",

    helpChainTurnTitle: "턴",
    helpChainTurnBody:
      "한 번 꺾이는 L자형 체인입니다. 첫 번째 라인을 피해도 두 번째 라인에 걸릴 수 있습니다.",

    helpChainFakeTitle: "페이크",
    helpChainFakeBody:
      "가짜 경고 위치를 먼저 보여준 뒤 진짜 공격이 따라오는 교란형 체인입니다.",

    helpChainGiantTitle: "자이언트",
    helpChainGiantBody:
      "매우 넓은 범위를 차단하는 거대 체인입니다.",

    helpChainTrackingTitle: "트래킹",
    helpChainTrackingBody:
      "발동 이후 목표 방향으로 꺾여 들어오는 추적형 체인입니다.",

    helpChainPhaseTitle: "페이즈",
    helpChainPhaseBody:
      "잠시 사라졌다가 같은 라인으로 다시 나타나는 위상 체인입니다.",

    helpItemsTitle: "아이템",
    helpItemsBody:
      "아이템을 획득하면 무작위 체인 1개를 저장합니다. 사용 시 상대 아레나의 무작위 위치에 체인이 생성됩니다.",

    helpPracticeTitle: "연습 모드",
    helpPracticeBody:
      "초반 난도가 낮아 거리 감각과 회피 타이밍을 익히기 좋습니다.",

    helpModesTitle: "모드",
    helpModesBody:
      "캐주얼은 온라인 매칭, 로컬 대전은 같은 기기 2인 플레이, 연습은 솔로 생존 모드입니다.",

    back: "뒤로",

    nicknameSetting: "닉네임",
    guestName: "게스트 이름",

    languageSetting: "언어",

    keySettings: "키 설정",
    pressKey: "키를 입력하세요...",

    sound: "사운드",

    glowParticle: "글로우 / 파티클",
    glow: "글로우",
    particle: "파티클",

    enterNickname: "닉네임을 입력해주세요.",

    start: "시작",

    encounterLabel: "ENCOUNTER",

    encounter: {
      chainStorm: {
        name: "체인 스톰",
        description:
          "아레나 전체에서 체인 생성 속도가 증가합니다.",
      },

      itemFever: {
        name: "아이템 피버",
        description:
          "아이템 생성 빈도가 크게 증가합니다.",
      },

      overclock: {
        name: "오버클록",
        description:
          "경고 종료 후 체인 발사 속도가 증가합니다.",
      },
    },
  },
  ja: {

    casual: "カジュアル",

    double: "ローカル対戦",

    practice: "練習",

    settings: "設定",

    help: "ヘルプ",

    loading: "LOADING",

    matchmaking: "マッチング中",

    deployingAi: "AI相手を配備中",

    searching: "検索中...",

    casualMatchmaking: "カジュアルマッチング",

    matchFound: "MATCH FOUND",

    aiMatch: "AI MATCH",

    searchingOpponent: "対戦相手を探しています...",

    connectingToServer: "マッチングサーバーに接続中...",

    cancel: "キャンセル",

    restart: "リマッチ",

    main: "メインメニュー",

    mainMenu: "メインメニュー",

    round: "ROUND",

    roundResult: "ROUND RESULT",

    finalScore: "FINAL SCORE",

    youShort: "YOU",

    opponentShort: "OPP",

    victory: "VICTORY",

    defeat: "DEFEAT",

    preparingNextRound: "次のラウンドを準備中...",

    nextRoundIn: "%{count}秒後に開始",

    rematch: "REMATCH",

    waitingForOpponent: "対戦相手を待っています...",

    opponentLeft: "相手が切断しました。",

    opponentAwayCountdown: "相手の接続が切れました。残り %{count} 秒...",

    searchingNewMatch: "新しいマッチを探しています...",

    settingsTitle: "設定",

    helpTitle: "ヘルプ",

    helpPageBasics: "1章 · 基本",

    helpPageChainsA: "2章 · チェーン I",

    helpPageChainsB: "3章 · チェーン II",

    helpPageItemsModes: "4章 · アイテム & モード",

    helpPrev: "前へ",

    helpNext: "次へ",

    helpObjectiveTitle: "目的",

    helpObjectiveBody: "チェーンを避けながら生き残り、相手を先に危険地帯へ追い込みます。",

    helpControlsTitle: "操作",

    helpControlsBody: "設定した移動キーで動き、アイテム取得後に使用キーでチェーンを発動します。",

    helpHazardsTitle: "アリーナルール",

    helpHazardsBody: "すべてのチェーンは先に警告を表示し、その後に攻撃判定が有効になります。時間が経つほどアリーナの圧力は高まります。",

    helpChainsTitle: "チェーン種類",

    helpChainNormalTitle: "ノーマル",

    helpChainNormalBody: "相手アリーナをまっすぐ横切る基本の直線チェーンです。",

    helpChainRushTitle: "ラッシュ",

    helpChainRushBody: "警告時間が非常に短い高速突進チェーンです。",

    helpChainTurnTitle: "ターン",

    helpChainTurnBody: "一度だけ曲がるL字型チェーンです。最初のラインを避けても、次のラインに当たることがあります。",

    helpChainFakeTitle: "フェイク",

    helpChainFakeBody: "偽の警告位置を見せた後、本命の攻撃が続く撹乱型チェーンです。",

    helpChainGiantTitle: "ジャイアント",

    helpChainGiantBody: "広い範囲を塞ぐ巨大チェーンです。",

    helpChainTrackingTitle: "トラッキング",

    helpChainTrackingBody: "発動後、目標方向へ曲がっていく追跡型チェーンです。",

    helpChainPhaseTitle: "フェーズ",

    helpChainPhaseBody: "一瞬消えた後、同じラインに再び現れる位相チェーンです。",

    helpItemsTitle: "アイテム",

    helpItemsBody: "アイテムを取るとランダムなチェーンを1つ保持します。使用すると相手アリーナのランダム位置にチェーンが生成されます。",

    helpPracticeTitle: "練習モード",

    helpPracticeBody: "序盤の圧力が低く、間合いと回避タイミングを覚えやすいモードです。",

    helpModesTitle: "モード",

    helpModesBody: "カジュアルはオンラインマッチング、ローカル対戦は同じ端末での2人対戦、練習はソロ生存モードです。",

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

    encounterLabel: "ENCOUNTER",

    encounter: {

      chainStorm: {

        name: "チェーンストーム",

        description: "アリーナ全体でチェーン生成速度が上がります。",

      },

      itemFever: {

        name: "アイテムフィーバー",

        description: "アイテムの出現頻度が大きく上がります。",

      },

      overclock: {

        name: "オーバークロック",

        description: "警告終了後、チェーンの発射速度が上がります。",

      },

    },

  },
  "zh-CN": {

    casual: "休闲",

    double: "本地对战",

    practice: "练习",

    settings: "设置",

    help: "帮助",

    loading: "LOADING",

    matchmaking: "匹配中",

    deployingAi: "AI对手部署中",

    searching: "搜索中...",

    casualMatchmaking: "休闲匹配",

    matchFound: "MATCH FOUND",

    aiMatch: "AI MATCH",

    searchingOpponent: "寻找对手中...",

    connectingToServer: "正在连接匹配服务器...",

    cancel: "取消",

    restart: "再战",

    main: "主菜单",

    mainMenu: "主菜单",

    round: "ROUND",

    roundResult: "ROUND RESULT",

    finalScore: "FINAL SCORE",

    youShort: "YOU",

    opponentShort: "OPP",

    victory: "VICTORY",

    defeat: "DEFEAT",

    preparingNextRound: "正在准备下一回合...",

    nextRoundIn: "%{count}秒后开始",

    rematch: "REMATCH",

    waitingForOpponent: "等待对手中...",

    opponentLeft: "对手已断开连接。",

    opponentAwayCountdown: "对手已断开连接。剩余 %{count} 秒...",

    searchingNewMatch: "正在寻找新对手...",

    settingsTitle: "设置",

    helpTitle: "帮助",

    helpPageBasics: "第1页 · 基础",

    helpPageChainsA: "第2页 · 锁链 I",

    helpPageChainsB: "第3页 · 锁链 II",

    helpPageItemsModes: "第4页 · 道具 & 模式",

    helpPrev: "上一页",

    helpNext: "下一页",

    helpObjectiveTitle: "目标",

    helpObjectiveBody: "躲避锁链并生存下来，率先把对手逼入危险区域。",

    helpControlsTitle: "操作",

    helpControlsBody: "使用设置好的移动键移动，拾取道具后用使用键触发锁链。",

    helpHazardsTitle: "竞技场规则",

    helpHazardsBody: "所有锁链都会先显示警告，然后才会激活攻击判定。回合持续越久，竞技场压力越高。",

    helpChainsTitle: "锁链类型",

    helpChainNormalTitle: "普通",

    helpChainNormalBody: "最基础的直线锁链，会直接横穿对手区域。",

    helpChainRushTitle: "突进",

    helpChainRushBody: "警告时间极短的高速突进锁链。",

    helpChainTurnTitle: "转折",

    helpChainTurnBody: "会拐一次弯的L形锁链。躲过第一条线，也可能撞上第二条线。",

    helpChainFakeTitle: "假象",

    helpChainFakeBody: "先显示假警告位置，再出现真正攻击的干扰型锁链。",

    helpChainGiantTitle: "巨型",

    helpChainGiantBody: "能够封锁大范围空间的巨型锁链。",

    helpChainTrackingTitle: "追踪",

    helpChainTrackingBody: "发动后会朝目标方向弯曲的追踪型锁链。",

    helpChainPhaseTitle: "相位",

    helpChainPhaseBody: "短暂消失后，会在同一路线再次出现的相位锁链。",

    helpItemsTitle: "道具",

    helpItemsBody: "拾取道具后会储存1条随机锁链。使用时会在对手区域的随机位置生成锁链。",

    helpPracticeTitle: "练习模式",

    helpPracticeBody: "开局压力较低，适合练习距离感和闪避时机。",

    helpModesTitle: "模式",

    helpModesBody: "休闲为在线匹配，本地对战为同设备双人对战，练习为单人生存模式。",

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

    enterNickname: "请输入昵称。",

    start: "开始",

    encounterLabel: "ENCOUNTER",

    encounter: {

      chainStorm: {

        name: "锁链风暴",

        description: "整个竞技场的锁链生成速度提高。",

      },

      itemFever: {

        name: "道具狂热",

        description: "道具生成频率大幅提高。",

      },

      overclock: {

        name: "超频",

        description: "警告结束后，锁链发射速度提高。",

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

export function t(key: string, options?: Record<string, unknown>): string {
  return String(i18n.t(key, options));
}
