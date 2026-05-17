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
    help: "help",
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
    round: "ROUND",
    roundResult: "ROUND RESULT",
    finalScore: "FINAL SCORE",
    youShort: "YOU",
    opponentShort: "OPP",
    victory: "VICTORY",
    defeat: "DEFEAT",
    preparingNextRound: "Preparing next round...",
    nextRoundIn: "Next round in %{count}",
    rematch: "REMATCH",
    waitingForOpponent: "Waiting for opponent...",
    opponentLeft: "Opponent left. Searching new match...",
    opponentAwayCountdown: "Opponent disconnected. %{count}s remaining...",
    searchingNewMatch: "Searching new match...",
    settingsTitle: "Settings",
    helpTitle: "Help",
    helpPageBasics: "Page 1 · Basics",
    helpPageChainsA: "Page 2 · Chains I",
    helpPageChainsB: "Page 3 · Chains II",
    helpPageItemsModes: "Page 4 · Items & Modes",
    helpPrev: "Previous",
    helpNext: "Next",
    helpObjectiveTitle: "Objective",
    helpObjectiveBody: "Outlast the arena, dodge chains, and force the other player into a hit.",
    helpControlsTitle: "Controls",
    helpControlsBody: "Move with your configured keys. Use your chain key after grabbing an item.",
    helpHazardsTitle: "Arena Rules",
    helpHazardsBody: "Every chain shows a warning first, then becomes lethal. The longer the round lasts, the more pressure the arena creates.",
    helpChainsTitle: "Chain Types",
    helpChainNormalTitle: "Normal",
    helpChainNormalBody: "A standard straight chain that cuts across the enemy arena.",
    helpChainRushTitle: "Rush",
    helpChainRushBody: "A fast red chain with short warning time and a sudden strike.",
    helpChainTurnTitle: "Turn",
    helpChainTurnBody: "An L-shaped chain that bends once, catching players who dodge only the first line.",
    helpChainFakeTitle: "Fake",
    helpChainFakeBody: "A deceptive purple warning that shows a false position before the real line arrives.",
    helpChainGiantTitle: "Giant",
    helpChainGiantBody: "A huge blue chain with a much wider hit zone that blocks more space.",
    helpChainTrackingTitle: "Tracking",
    helpChainTrackingBody: "A green chain that curves toward the target after it starts moving.",
    helpChainPhaseTitle: "Phase",
    helpChainPhaseBody: "An orange chain that briefly disappears, then returns on the same line.",
    helpItemsTitle: "Items",
    helpItemsBody: "Picking up an item stores one random chain. When used, it creates a random chain at a random position in the enemy arena.",
    helpPracticeTitle: "Practice",
    helpPracticeBody: "Practice starts softer so you can learn spacing before the arena becomes aggressive.",
    helpModesTitle: "Modes",
    helpModesBody: "Casual uses online matchmaking, Double is local versus, and Practice is solo survival.",
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
    double: "ダブル",
    practice: "練習",
    settings: "設定",
    help: "ヘルプ",
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
    round: "ラウンド",
    roundResult: "ラウンド結果",
    finalScore: "最終スコア",
    youShort: "YOU",
    opponentShort: "OPP",
    victory: "勝利",
    defeat: "敗北",
    preparingNextRound: "次のラウンドを準備中...",
    nextRoundIn: "%{count}秒後に次のラウンド",
    rematch: "リマッチ",
    waitingForOpponent: "対戦相手を待っています...",
    opponentLeft: "相手が退出しました。新しいマッチを探しています...",
    opponentAwayCountdown: "相手の接続が切れました。残り %{count} 秒...",
    searchingNewMatch: "新しいマッチを探しています...",
    settingsTitle: "設定",
    helpTitle: "ヘルプ",
    helpPageBasics: "1章 · 基本",
    helpPageChainsA: "2章 · チェーン I",
    helpPageChainsB: "3章 · チェーン II",
    helpPageItemsModes: "4章 · アイテムとモード",
    helpPrev: "Prev",
    helpNext: "Next",
    helpObjectiveTitle: "目的",
    helpObjectiveBody: "チェーンを避けながら生き残り、相手を先に被弾させます。",
    helpControlsTitle: "操作",
    helpControlsBody: "設定した移動キーで動き、アイテム取得後に使用キーでチェーンを発射します。",
    helpHazardsTitle: "アリーナルール",
    helpHazardsBody: "すべてのチェーンは先に警告を出してから致命判定になります。時間が経つほどアリーナの圧も上がります。",
    helpChainsTitle: "チェーン種類",
    helpChainNormalTitle: "ノーマル",
    helpChainNormalBody: "基本の直線チェーンです。相手アリーナをまっすぐ横切ります。",
    helpChainRushTitle: "ラッシュ",
    helpChainRushBody: "赤い高速チェーンです。警告が短く、一気に飛び込みます。",
    helpChainTurnTitle: "ターン",
    helpChainTurnBody: "一度曲がる L 字チェーンです。最初の線だけ避けると二本目に当たります。",
    helpChainFakeTitle: "フェイク",
    helpChainFakeBody: "紫の攪乱チェーンです。先に偽の位置を見せてから本命が来ます。",
    helpChainGiantTitle: "ジャイアント",
    helpChainGiantBody: "青い大型チェーンです。判定幅が広く、広い範囲を塞ぎます。",
    helpChainTrackingTitle: "トラッキング",
    helpChainTrackingBody: "緑の追尾チェーンです。発動後に相手方向へ曲がります。",
    helpChainPhaseTitle: "フェーズ",
    helpChainPhaseBody: "オレンジのチェーンです。少し消えてから同じラインに戻ります。",
    helpItemsTitle: "アイテム効果",
    helpItemsBody: "アイテムを取るとランダムなチェーンを 1 回分保持します。使うと相手アリーナのランダム位置にランダムなチェーンが生成されます。",
    helpPracticeTitle: "練習モード",
    helpPracticeBody: "練習モードは序盤の密度を抑えて、回避と間合いを覚えやすくしています。",
    helpModesTitle: "モード",
    helpModesBody: "Casual はオンライン対戦、Double はローカル対戦、Practice はソロ生存です。",
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
    help: "帮助",
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
    round: "回合",
    roundResult: "回合结果",
    finalScore: "最终比分",
    youShort: "我方",
    opponentShort: "对手",
    victory: "胜利",
    defeat: "失败",
    preparingNextRound: "正在准备下一回合...",
    nextRoundIn: "%{count}秒后进入下一回合",
    rematch: "再来一局",
    waitingForOpponent: "等待对手中...",
    opponentLeft: "对手已离开。正在搜索新对手...",
    opponentAwayCountdown: "对手已断开连接。剩余 %{count} 秒...",
    searchingNewMatch: "正在搜索新对手...",
    settingsTitle: "设置",
    helpTitle: "帮助",
    helpPageBasics: "第1页 · 基础",
    helpPageChainsA: "第2页 · 锁链 I",
    helpPageChainsB: "第3页 · 锁链 II",
    helpPageItemsModes: "第4页 · 道具与模式",
    helpPrev: "上一页",
    helpNext: "下一页",
    helpObjectiveTitle: "目标",
    helpObjectiveBody: "躲开锁链并尽量生存，让对手先被击中。",
    helpControlsTitle: "操作",
    helpControlsBody: "使用你设置的移动按键移动，拾取道具后用使用键发射锁链。",
    helpHazardsTitle: "竞技场规则",
    helpHazardsBody: "所有锁链都会先显示警告，再进入真正的危险阶段。时间越久，竞技场压迫会越强。",
    helpChainsTitle: "锁链类型",
    helpChainNormalTitle: "普通",
    helpChainNormalBody: "最基础的直线锁链，会直接横穿对手区域。",
    helpChainRushTitle: "突进",
    helpChainRushBody: "红色高速锁链，预警更短，攻击更突然。",
    helpChainTurnTitle: "转折",
    helpChainTurnBody: "会拐一次弯的 L 形锁链，只躲第一段也可能吃到第二段。",
    helpChainFakeTitle: "假象",
    helpChainFakeBody: "紫色干扰锁链，会先显示假位置，再出现真正路线。",
    helpChainGiantTitle: "巨型",
    helpChainGiantBody: "蓝色大范围锁链，判定更宽，封路能力很强。",
    helpChainTrackingTitle: "追踪",
    helpChainTrackingBody: "绿色追踪锁链，发动后会朝目标方向弯过去。",
    helpChainPhaseTitle: "相位",
    helpChainPhaseBody: "橙色锁链，会短暂消失后沿同一路线再次出现。",
    helpItemsTitle: "道具效果",
    helpItemsBody: "拾取道具后会储存 1 次随机锁链。使用时会在对手区域的随机位置生成随机锁链。",
    helpPracticeTitle: "练习模式",
    helpPracticeBody: "练习模式开局更温和，方便先熟悉走位和闪避节奏。",
    helpModesTitle: "模式",
    helpModesBody: "休闲是在线匹配，双人是本地对战，练习是单人生存。",
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

export function t(key: string, options?: Record<string, unknown>): string {
  return String(i18n.t(key, options));
}
