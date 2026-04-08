import { useState, useEffect } from "react";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RED_SUITS = new Set(["♥", "♦"]);
const INIT_COINS = 500;
const BET_OPTIONS = [10, 25, 50, 100];

function createDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank, id: `${rank}${suit}` })));
}

function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardValue(rank) {
  if (["J", "Q", "K"].includes(rank)) return 10;
  if (rank === "A") return 1;
  return parseInt(rank, 10);
}

function isFaceCard(rank) {
  return ["J", "Q", "K"].includes(rank);
}

function cardValueVariants(rank) {
  if (rank === "3") return [3, 6];
  if (rank === "6") return [6, 3];
  return [cardValue(rank)];
}

function evalSelection(hand, tripleIdxs) {
  if (tripleIdxs.length !== 3) return null;
  const [i, j, k] = tripleIdxs;
  const vi = cardValueVariants(hand[i].rank);
  const vj = cardValueVariants(hand[j].rank);
  const vk = cardValueVariants(hand[k].rank);
  let used3as6 = false;
  let foundTriple = false;

  outer: for (const a of vi) {
    for (const b of vj) {
      for (const c of vk) {
        if ((a + b + c) % 10 === 0) {
          used3as6 =
            a !== cardValue(hand[i].rank) ||
            b !== cardValue(hand[j].rank) ||
            c !== cardValue(hand[k].rank);
          foundTriple = true;
          break outer;
        }
      }
    }
  }

  if (!foundTriple) return null;

  const rest = hand.filter((_, idx) => !tripleIdxs.includes(idx));
  const isPair = rest[0].rank === rest[1].rank;
  const sum2 = (cardValue(rest[0].rank) + cardValue(rest[1].rank)) % 10;
  const niuVal = sum2 === 0 ? 10 : sum2;
  const swapNote = used3as6 ? "★" : "";

  const restHasSpadeA = rest.some((c) => c.rank === "A" && c.suit === "♠");
  const restHasJQK = rest.some((c) => isFaceCard(c.rank));
  const isSpadeANiu = restHasSpadeA && restHasJQK;

  if (niuVal === 10) {
    if (isSpadeANiu && isPair) {
      return {
        type: "spade-a-pair",
        value: 10,
        label: `牛牛(黑桃A+对子)${swapNote}`,
        tripleIdx: tripleIdxs,
        isPair,
        isSpadeANiu,
        used3as6,
      };
    }
    if (isSpadeANiu) {
      return {
        type: "spade-a-niu",
        value: 10,
        label: `牛牛(黑桃A)${swapNote}`,
        tripleIdx: tripleIdxs,
        isPair,
        isSpadeANiu,
        used3as6,
      };
    }
    if (isPair) {
      return {
        type: "niu-niu-pair",
        value: 10,
        label: `牛牛(对子)${swapNote}`,
        tripleIdx: tripleIdxs,
        isPair,
        isSpadeANiu: false,
        used3as6,
      };
    }
    return {
      type: "niu-niu",
      value: 10,
      label: `牛牛${swapNote}`,
      tripleIdx: tripleIdxs,
      isPair,
      isSpadeANiu: false,
      used3as6,
    };
  }

  if (isSpadeANiu && isPair) {
    return {
      type: "spade-a-pair",
      value: niuVal,
      label: `牛${niuVal}(黑桃A+对子)${swapNote}`,
      tripleIdx: tripleIdxs,
      isPair,
      isSpadeANiu,
      used3as6,
    };
  }
  if (isSpadeANiu) {
    return {
      type: "spade-a-niu",
      value: niuVal,
      label: `牛${niuVal}(黑桃A)${swapNote}`,
      tripleIdx: tripleIdxs,
      isPair,
      isSpadeANiu,
      used3as6,
    };
  }
  if (isPair) {
    return {
      type: "niu-pair",
      value: niuVal,
      label: `牛${niuVal}(对子)${swapNote}`,
      tripleIdx: tripleIdxs,
      isPair,
      isSpadeANiu: false,
      used3as6,
    };
  }
  return {
    type: "niu",
    value: niuVal,
    label: `牛${niuVal}${swapNote}`,
    tripleIdx: tripleIdxs,
    isPair,
    isSpadeANiu: false,
    used3as6,
  };
}

function calcBestNiu(hand) {
  if (hand.length < 5) return { type: "no-niu", value: 0, label: "没牛" };
  if (hand.every((c) => isFaceCard(c.rank))) {
    return { type: "five-face", value: 15, label: "五花牛", tripleIdx: [] };
  }
  let best = { type: "no-niu", value: 0, label: "没牛" };
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      for (let k = j + 1; k < 5; k++) {
        const r = evalSelection(hand, [i, j, k]);
        if (!r) continue;
        const rMult = multiplier(r);
        const bMult = multiplier(best);
        if (r.value > best.value) best = r;
        else if (r.value === best.value && rMult > bMult) best = r;
      }
    }
  }
  return best;
}

function multiplier(result) {
  if (!result) return 1;
  if (result.type === "five-face") return 3;
  if (result.type === "spade-a-pair") return 4;
  if (result.type === "spade-a-niu") return 5;
  if (result.type === "niu-niu-pair") return 3;
  if (result.type === "niu-niu") return 2;
  if (result.isPair) return 3;
  if (result.value === 9) return 2;
  return 1;
}

function calcWin(playerResult, dealerResult, bet) {
  if (!playerResult || !dealerResult) return 0;
  if (playerResult.type === "five-face") return bet * 3;
  const cmp = playerResult.value - dealerResult.value;
  const mult = Math.max(multiplierFull(playerResult), multiplierFull(dealerResult));
  if (cmp > 0) return bet * mult;
  if (cmp < 0) return -bet * mult;
  return 0;
}

function multiplierFull(result) {
  if (!result) return 1;
  if (result.type === "five-face") return 3;
  if (result.type === "spade-a-pair") return 4;
  if (result.type === "spade-a-niu") return 5;
  if (result.type === "niu-niu-pair") return 3;
  if (result.type === "niu-niu") return 2;
  if (result.isPair) return 3;
  if (result.value === 9) return 2;
  return 1;
}

function getLabel(result, lang) {
  if (!result) return "";
  const zh = lang !== "en";
  const sw = result.used3as6 ? "★" : "";
  if (result.type === "five-face") return zh ? "五花牛" : "Five Face";
  if (result.type === "no-niu") return zh ? "没牛" : "No Niu";
  const niuPart = result.value === 10 ? (zh ? "牛牛" : "Niu Niu") : zh ? `牛${result.value}` : `Niu ${result.value}`;
  if (result.isSpadeANiu && result.isPair) return `${niuPart}(${zh ? "黑桃A+对子" : "♠A+Pair"})${sw}`;
  if (result.isSpadeANiu) return `${niuPart}(${zh ? "黑桃A" : "♠A"})${sw}`;
  if (result.isPair) return `${niuPart}(${zh ? "对子" : "Pair"})${sw}`;
  return `${niuPart}${sw}`;
}

const T = {
  zh: {
    brand: "现代手游版",
    subtitle: "更清晰的下注、选牌与结果对比体验",
    chips: "筹码",
    pl: "总盈亏",
    currentBet: "本局下注",
    selectBet: "选择下注金额",
    deal: "开始发牌",
    dealer: "庄家",
    yourHand: "你的手牌",
    selectedCount: (n) => `已选 ${n}/3 张`,
    fiveFaceNotice: "🌟 五花牛！无需选牌，直接确认。",
    confirm: "确认开牌",
    noNiuBtn: "直接报没牛",
    won: (n) => `赢了 RM${n}`,
    lost: (n) => `输了 RM${n}`,
    tie: "平局",
    yourChoice: "你的选择",
    bestComboLabel: (sub) => (sub ? "推荐更优组合" : "最佳组合"),
    suboptimalNote: (d) => `最佳组合会比你这手多赚 / 少亏 RM${d}`,
    optimalNote: "这手你已经选到最优解。",
    dealerPrefix: "庄家结果",
    times: (n) => `结算倍数 ×${n}`,
    playAgain: "再来一局",
    resetChips: "重置筹码",
    history: "最近战绩",
    errSelectThree: "请选择 3 张牌来凑牛，或者直接报没牛。",
    errInvalidCombo: (sum) => `这 3 张合计 ${sum}（个位 ${sum % 10}），不是 10 的倍数，不能成牛。`,
    previewPartial: (s) => `当前点数和：${s}（个位 ${s % 10}）`,
    previewValid: (label) => `有效组合：${label}`,
    previewInvalid: (s) => `个位数 ${s % 10}，当前还不能成牛`,
    logWon: (n) => `赢 RM${n}`,
    logLost: (n) => `输 RM${n}`,
    logTie: "平局",
    logMissed: (d) => `（少赚 / 多亏 RM${d}）`,
    tiePayout: "平",
    rules: "玩法：选 3 张点数和为 10 倍数的牌；剩余 2 张个位数为牛数。牛 9 / 牛牛 ×2，对子 ×3，对子A ×4，JQK + ♠A ×5，其余 ×1。",
    rulesSwap: "★ 凑牛时 3 与 6 可互换。",
    pickHint: "点选 3 张牌试组合，系统会实时提示是否成牛。",
    betHint: "先选筹码，再开局。",
    dealerHint: "庄家自动用最佳组合结算。",
    roundSummary: "本局结算",
  },
  en: {
    brand: "Modern mobile style",
    subtitle: "Cleaner betting, card picking and result comparison",
    chips: "Chips",
    pl: "P/L",
    currentBet: "Bet",
    selectBet: "Select Bet Amount",
    deal: "Deal Cards",
    dealer: "Dealer",
    yourHand: "Your Hand",
    selectedCount: (n) => `Selected ${n}/3`,
    fiveFaceNotice: "🌟 Five Face! No card pick needed — confirm directly.",
    confirm: "Confirm",
    noNiuBtn: "Call No Niu",
    won: (n) => `Won RM${n}`,
    lost: (n) => `Lost RM${n}`,
    tie: "Tie",
    yourChoice: "Your pick",
    bestComboLabel: (sub) => (sub ? "Better combo" : "Best combo"),
    suboptimalNote: (d) => `Best combo improves this hand by RM${d}`,
    optimalNote: "You already picked the optimal combo.",
    dealerPrefix: "Dealer result",
    times: (n) => `Settlement ×${n}`,
    playAgain: "Play Again",
    resetChips: "Reset Chips",
    history: "Recent rounds",
    errSelectThree: "Select 3 cards to form a Niu, or call No Niu.",
    errInvalidCombo: (sum) => `These 3 cards sum to ${sum} (units ${sum % 10}), not a multiple of 10.`,
    previewPartial: (s) => `Current sum: ${s} (units ${s % 10})`,
    previewValid: (label) => `Valid combo: ${label}`,
    previewInvalid: (s) => `Units digit ${s % 10}, not valid yet`,
    logWon: (n) => `Won RM${n}`,
    logLost: (n) => `Lost RM${n}`,
    logTie: "Tie",
    logMissed: (d) => `(missed RM${d})`,
    tiePayout: "Tie",
    rules: "How to play: pick 3 cards summing to a multiple of 10; the remaining 2 cards determine the Niu value. Niu 9 / Niu Niu ×2, Pair ×3, Pair Ace ×4, JQK + ♠A ×5, others ×1.",
    rulesSwap: "★ 3 and 6 can swap while forming a combo.",
    pickHint: "Tap 3 cards and get live feedback instantly.",
    betHint: "Choose your chip size before each round.",
    dealerHint: "Dealer always settles with the best combo.",
    roundSummary: "Round result",
  },
};

function Card({ card, faceDown = false, state = "normal", onClick, delay = 0, small = false }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const isRed = !faceDown && RED_SUITS.has(card?.suit);
  const isSelected = state === "selected";
  const isHighlight = state === "highlight";
  const isDim = state === "dim";
  const w = small ? 46 : 68;
  const h = small ? 66 : 98;

  return (
    <div
      onClick={onClick}
      style={{
        width: w,
        height: h,
        borderRadius: 16,
        flexShrink: 0,
        background: faceDown
          ? "linear-gradient(160deg,#17345f 0%,#0e203d 100%)"
          : "linear-gradient(180deg,#ffffff 0%,#eef4ff 100%)",
        border: isSelected
          ? "2px solid #5aa7ff"
          : isHighlight
          ? "2px solid #ffd166"
          : "1px solid rgba(255,255,255,0.14)",
        boxShadow: isSelected
          ? "0 14px 22px rgba(90,167,255,0.32)"
          : isHighlight
          ? "0 14px 22px rgba(255,209,102,0.28)"
          : "0 10px 18px rgba(0,0,0,0.22)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, 'Noto Sans SC', sans-serif",
        fontWeight: 800,
        color: faceDown ? "#7ce8ff" : isRed ? "#e45d74" : "#18253d",
        transform: `translateY(${visible ? (isSelected ? -10 : 0) : -18}px)`,
        opacity: visible ? (isDim ? 0.42 : 1) : 0,
        transition: "transform 0.28s ease, opacity 0.28s ease, box-shadow 0.2s ease, border 0.2s ease",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        position: "relative",
      }}
    >
      {faceDown ? (
        <div style={{ fontSize: small ? 18 : 26 }}>🂠</div>
      ) : (
        <>
          <div style={{ position: "absolute", top: 7, left: 7, fontSize: small ? 10 : 12, lineHeight: 1.1 }}>
            {card.rank}
            <br />
            {card.suit}
          </div>
          <div style={{ fontSize: small ? 18 : 28 }}>{card.suit}</div>
          <div
            style={{
              position: "absolute",
              bottom: 7,
              right: 7,
              fontSize: small ? 10 : 12,
              lineHeight: 1.1,
              transform: "rotate(180deg)",
            }}
          >
            {card.rank}
            <br />
            {card.suit}
          </div>
        </>
      )}
    </div>
  );
}

function Badge({ result, lang = "zh" }) {
  if (!result) return null;
  const color =
    result.type === "five-face"
      ? "#ffd166"
      : result.type === "spade-a-niu"
      ? "#b56bff"
      : result.type === "spade-a-pair"
      ? "#9b6cff"
      : result.type === "niu-niu-pair"
      ? "#7e8cff"
      : result.type === "niu-niu"
      ? "#ff8b6b"
      : result.isPair
      ? "#4ea2ff"
      : result.value >= 7
      ? "#38d996"
      : result.value >= 4
      ? "#55d6ff"
      : "#6c7d99";

  return <span className="badge-pill" style={{ background: color }}>{getLabel(result, lang)}</span>;
}

function NpcRow({ name, hand, result, revealed, isDealer, winAmount, lang = "zh" }) {
  const tripleSet = result?.tripleIdx ? new Set(result.tripleIdx) : new Set();
  const tx = T[lang];

  return (
    <div className={`npc-row ${isDealer ? "dealer" : ""}`}>
      <div className="npc-meta">
        <div className="npc-label">{isDealer ? `🏦 ${tx.dealer}` : `🤖 ${name}`}</div>
      </div>

      <div className="hand-row">
        {hand.map((card, i) => (
          <Card
            key={card.id}
            card={card}
            faceDown={!revealed}
            state={revealed && tripleSet.has(i) ? "highlight" : "normal"}
            small
            delay={i * 50}
          />
        ))}
      </div>

      <div className="npc-side">
        {revealed && result && <Badge result={result} lang={lang} />}
        {revealed && winAmount !== undefined && (
          <span style={{ fontSize: 12, color: winAmount > 0 ? "#38d996" : winAmount < 0 ? "#ff6b81" : "#92a4c5" }}>
            {winAmount > 0 ? `+RM${winAmount}` : winAmount < 0 ? `-RM${Math.abs(winAmount)}` : tx.tiePayout}
          </span>
        )}
      </div>
    </div>
  );
}

export default function NiuNiuGame() {
  const [lang, setLang] = useState("zh");
  const tx = T[lang];
  const [coins, setCoins] = useState(INIT_COINS);
  const [bet, setBet] = useState(25);
  const [phase, setPhase] = useState("bet");
  const [hands, setHands] = useState({ player: [], dealer: [] });
  const [npcResults, setNpcResults] = useState({});
  const [selectedIdxs, setSelectedIdxs] = useState([]);
  const [playerResult, setPlayerResult] = useState(null);
  const [bestResult, setBestResult] = useState(null);
  const [winAmount, setWinAmount] = useState(null);
  const [bestWinAmount, setBestWinAmount] = useState(null);
  const [selectionError, setSelectionError] = useState("");
  const [roundLog, setRoundLog] = useState([]);
  const [totalWon, setTotalWon] = useState(0);
  const [shake, setShake] = useState(false);

  function startRound() {
    if (bet > coins) return;
    const deck = shuffle(createDeck());
    setHands({ player: deck.slice(0, 5), dealer: deck.slice(5, 10) });
    setSelectedIdxs([]);
    setPlayerResult(null);
    setBestResult(null);
    setWinAmount(null);
    setBestWinAmount(null);
    setSelectionError("");
    setNpcResults({});
    setPhase("select");
  }

  function toggleCard(idx) {
    if (phase !== "select") return;
    setSelectionError("");
    setSelectedIdxs((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : prev.length >= 3 ? prev : [...prev, idx]
    );
  }

  function confirmSelection(declareNoNiu = false) {
    const isFiveFace = hands.player.every((c) => isFaceCard(c.rank));
    const npcR = {};
    ["dealer"].forEach((key) => {
      npcR[key] = calcBestNiu(hands[key]);
    });
    setNpcResults(npcR);

    let selected;
    if (isFiveFace) {
      selected = { type: "five-face", value: 15, tripleIdx: [] };
    } else if (declareNoNiu) {
      selected = { type: "no-niu", value: 0, tripleIdx: [] };
    } else {
      if (selectedIdxs.length !== 3) {
        setSelectionError(tx.errSelectThree);
        return;
      }
      selected = evalSelection(hands.player, selectedIdxs);
      if (!selected) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
        const vals = selectedIdxs.map((i) => cardValue(hands.player[i].rank));
        const sum = vals.reduce((a, b) => a + b, 0);
        setSelectionError(tx.errInvalidCombo(sum));
        return;
      }
    }

    const best = isFiveFace ? selected : calcBestNiu(hands.player);
    setPlayerResult(selected);
    setBestResult(best);

    const dealerResult = npcR.dealer;
    const actual = calcWin(selected, dealerResult, bet);
    const optimal = calcWin(best, dealerResult, bet);
    setWinAmount(actual);
    setBestWinAmount(optimal);
    setCoins((prev) => prev + actual);
    setTotalWon((prev) => prev + actual);

    const diff = optimal - actual;
    let log = actual > 0 ? tx.logWon(actual) : actual < 0 ? tx.logLost(Math.abs(actual)) : tx.logTie;
    if (diff > 0) log += tx.logMissed(diff);
    setRoundLog((prev) => [log, ...prev].slice(0, 6));
    setPhase("result");
  }

  const isFiveFace = hands.player.length === 5 && hands.player.every((c) => isFaceCard(c.rank));
  const diff = bestWinAmount !== null && winAmount !== null ? bestWinAmount - winAmount : 0;
  const isSuboptimal = diff > 0;

  function getCardState(idx) {
    if (phase === "result") {
      if (playerResult?.tripleIdx?.includes(idx)) return "highlight";
      return "dim";
    }
    if (selectedIdxs.includes(idx)) return "selected";
    return "normal";
  }

  const previewResult = phase === "select" && selectedIdxs.length === 3 && !isFiveFace ? evalSelection(hands.player, selectedIdxs) : null;
  const previewSum =
    phase === "select" && selectedIdxs.length > 0 && !isFiveFace
      ? selectedIdxs.reduce((s, i) => s + cardValue(hands.player[i].rank), 0)
      : null;

  const statPLClass = totalWon > 0 ? "positive" : totalWon < 0 ? "negative" : "";

  return (
    <div className="niuniu-shell">
      <div className="niuniu-app">
        <div className="niuniu-hero">
          <div className="hero-topbar">
            <div>
              <div className="hero-badge">🃏 {tx.brand}</div>
              <div className="hero-title">
                <h1>牛牛</h1>
                <p>{tx.subtitle}</p>
              </div>
            </div>
            <button className="lang-switch" onClick={() => setLang((l) => (l === "zh" ? "en" : "zh"))}>
              {lang === "zh" ? "EN" : "中文"}
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card highlight">
              <div className="label">{tx.chips}</div>
              <div className="value">RM{coins}</div>
            </div>
            <div className={`stat-card ${statPLClass}`}>
              <div className="label">{tx.pl}</div>
              <div className="value">{totalWon >= 0 ? "+" : ""}RM{totalWon}</div>
            </div>
            <div className="stat-card">
              <div className="label">{tx.currentBet}</div>
              <div className="value">RM{bet}</div>
            </div>
          </div>
        </div>

        <div className="game-stack">
          {phase === "bet" && (
            <div className="game-panel">
              <div className="panel-title-row">
                <div>
                  <div className="panel-title">{tx.selectBet}</div>
                  <div className="panel-subtitle">{tx.betHint}</div>
                </div>
              </div>

              <div className="bet-grid">
                {BET_OPTIONS.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBet(b)}
                    disabled={b > coins}
                    className={`bet-chip ${bet === b ? "active" : ""}`}
                  >
                    RM{b}
                  </button>
                ))}
              </div>

              <button className="primary-btn" onClick={startRound} disabled={bet > coins}>
                {tx.deal}
              </button>
            </div>
          )}

          {phase !== "bet" && (
            <div className="rows-stack">
              <div className="game-panel">
                <div className="panel-title-row">
                  <div>
                    <div className="panel-title">🏦 {tx.dealer}</div>
                    <div className="panel-subtitle">{tx.dealerHint}</div>
                  </div>
                </div>
                <NpcRow name={tx.dealer} hand={hands.dealer} result={npcResults.dealer} revealed={phase === "result"} isDealer lang={lang} />
              </div>

              <div className={`game-panel player-panel ${shake ? "shake" : ""}`}>
                <div className="panel-title-row">
                  <div>
                    <div className="panel-title">👤 {tx.yourHand}</div>
                    <div className="panel-subtitle">{tx.pickHint}</div>
                  </div>
                  <div className="panel-subtitle">{phase === "select" && !isFiveFace ? tx.selectedCount(selectedIdxs.length) : ""}</div>
                </div>

                {isFiveFace && phase === "select" && <div className="notice-box">{tx.fiveFaceNotice}</div>}

                <div className="player-cards">
                  {hands.player.map((card, i) => (
                    <Card
                      key={card.id}
                      card={card}
                      state={getCardState(i)}
                      onClick={phase === "select" && !isFiveFace ? () => toggleCard(i) : undefined}
                      delay={i * 80}
                    />
                  ))}
                </div>

                {phase === "select" && !isFiveFace && selectedIdxs.length > 0 && (
                  <div className="inline-note" style={{ color: previewResult ? "#38d996" : selectedIdxs.length === 3 ? "#ff6b81" : "#92a4c5" }}>
                    {selectedIdxs.length < 3
                      ? tx.previewPartial(previewSum)
                      : previewResult
                      ? tx.previewValid(getLabel(previewResult, lang))
                      : tx.previewInvalid(previewSum)}
                  </div>
                )}

                {selectionError && <div className="error-box">{selectionError}</div>}

                {phase === "select" && (
                  <div className="actions-row">
                    <button className="secondary-btn" onClick={() => confirmSelection(false)}>
                      {tx.confirm}
                    </button>
                    {!isFiveFace && (
                      <button className="ghost-btn" onClick={() => confirmSelection(true)}>
                        {tx.noNiuBtn}
                      </button>
                    )}
                  </div>
                )}

                {phase === "result" && (
                  <div style={{ animation: "pop 0.28s ease" }}>
                    <div className={`result-hero ${winAmount > 0 ? "win" : winAmount < 0 ? "lose" : "tie"}`}>
                      {winAmount > 0 ? tx.won(winAmount) : winAmount < 0 ? tx.lost(Math.abs(winAmount)) : tx.tie}
                    </div>

                    <div className={`compare-box ${isSuboptimal ? "suboptimal" : ""}`}>
                      <div className="panel-title-row" style={{ marginBottom: 10 }}>
                        <div>
                          <div className="panel-title">{tx.roundSummary}</div>
                          <div className="panel-subtitle">{isSuboptimal ? tx.suboptimalNote(diff) : tx.optimalNote}</div>
                        </div>
                      </div>

                      <div className="compare-grid">
                        <div className="compare-column">
                          <div className="compare-column-title">{tx.yourChoice}</div>
                          <div className="small-hand">
                            {hands.player.map((card, i) => {
                              const inTriple = playerResult?.tripleIdx?.includes(i);
                              return <Card key={card.id} card={card} small state={inTriple ? "highlight" : "normal"} delay={i * 40} />;
                            })}
                          </div>
                          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Badge result={playerResult} lang={lang} />
                            <span style={{ fontSize: 12, color: winAmount > 0 ? "#38d996" : winAmount < 0 ? "#ff6b81" : "#92a4c5" }}>
                              {winAmount > 0 ? `+RM${winAmount}` : winAmount < 0 ? `-RM${Math.abs(winAmount)}` : tx.tiePayout}
                            </span>
                          </div>
                        </div>

                        <div className="compare-column">
                          <div className={`compare-column-title ${isSuboptimal ? "warn" : "good"}`}>{tx.bestComboLabel(isSuboptimal)}</div>
                          <div className="small-hand">
                            {hands.player.map((card, i) => {
                              const inBestTriple = bestResult?.tripleIdx?.includes(i);
                              return <Card key={card.id} card={card} small state={inBestTriple ? "selected" : "normal"} delay={i * 40} />;
                            })}
                          </div>
                          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Badge result={bestResult} lang={lang} />
                            <span style={{ fontSize: 12, color: bestWinAmount > 0 ? "#38d996" : bestWinAmount < 0 ? "#ff6b81" : "#92a4c5" }}>
                              {bestWinAmount > 0 ? `+RM${bestWinAmount}` : bestWinAmount < 0 ? `-RM${Math.abs(bestWinAmount)}` : tx.tiePayout}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={`compare-footer ${isSuboptimal ? "warn" : "good"}`}>
                        {isSuboptimal ? tx.suboptimalNote(diff) : tx.optimalNote}
                      </div>
                    </div>

                    <div className="muted-line">
                      {tx.dealerPrefix}：<Badge result={npcResults.dealer} lang={lang} /> · {tx.times(Math.max(multiplierFull(playerResult), multiplierFull(npcResults.dealer)))}
                    </div>

                    <div className="actions-row">
                      <button className="primary-btn" onClick={() => setPhase("bet")}>
                        {tx.playAgain}
                      </button>
                      {coins <= 0 && (
                        <button
                          className="ghost-btn"
                          onClick={() => {
                            setCoins(INIT_COINS);
                            setTotalWon(0);
                            setPhase("bet");
                          }}
                        >
                          {tx.resetChips}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {roundLog.length > 0 && (
            <div className="history-box">
              <div className="panel-title-row" style={{ marginBottom: 8 }}>
                <div>
                  <div className="panel-title">{tx.history}</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {roundLog.map((log, i) => (
                  <div key={i} className={`log-item ${i === 0 ? "active" : ""}`}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rules-box">
            <div className="panel-title-row" style={{ marginBottom: 8 }}>
              <div>
                <div className="panel-title">规则说明</div>
              </div>
            </div>
            <div className="rules-copy">
              {tx.rules}
              <span style={{ color: "#7ce8ff" }}> {tx.rulesSwap}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
