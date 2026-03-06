import { useState, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const RED_SUITS = new Set(["♥","♦"]);
const INIT_COINS = 500;
const BET_OPTIONS = [10, 25, 50, 100];

// ─── Deck Helpers ─────────────────────────────────────────────────────────────
function createDeck() {
  return SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank, id: `${rank}${suit}` })));
}
function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ─── Card Value ───────────────────────────────────────────────────────────────
function cardValue(rank) {
  if (["J","Q","K"].includes(rank)) return 10;
  if (rank === "A") return 1;
  return parseInt(rank);
}
function isFaceCard(rank) { return ["J","Q","K"].includes(rank); }
function cardValueVariants(rank) {
  if (rank === "3") return [3, 6];
  if (rank === "6") return [6, 3];
  return [cardValue(rank)];
}

// ─── Evaluate a specific triple selection ────────────────────────────────────
function evalSelection(hand, tripleIdxs) {
  if (tripleIdxs.length !== 3) return null;
  const [i, j, k] = tripleIdxs;
  const vi = cardValueVariants(hand[i].rank);
  const vj = cardValueVariants(hand[j].rank);
  const vk = cardValueVariants(hand[k].rank);
  let used3as6 = false, foundTriple = false;
  outer: for (const a of vi) for (const b of vj) for (const c of vk) {
    if ((a + b + c) % 10 === 0) {
      used3as6 = (a !== cardValue(hand[i].rank)) || (b !== cardValue(hand[j].rank)) || (c !== cardValue(hand[k].rank));
      foundTriple = true;
      break outer;
    }
  }
  if (!foundTriple) return null;

  const rest = hand.filter((_, idx) => !tripleIdxs.includes(idx));
  const isPair = rest[0].rank === rest[1].rank;
  const sum2 = (cardValue(rest[0].rank) + cardValue(rest[1].rank)) % 10;
  const niuVal = sum2 === 0 ? 10 : sum2;
  const swapNote = used3as6 ? "★" : "";

  // 5×: remaining 2 cards must be ♠A + one JQK
  const restHasSpadeA = rest.some(c => c.rank === "A" && c.suit === "♠");
  const restHasJQK    = rest.some(c => isFaceCard(c.rank));
  const isSpadeANiu = restHasSpadeA && restHasJQK;

  if (niuVal === 10) {
    if (isSpadeANiu && isPair)  return { type:"spade-a-pair",   value:10, label:`牛牛(黑桃A+对子)${swapNote}`, tripleIdx:tripleIdxs, isPair, isSpadeANiu, used3as6 };
    if (isSpadeANiu)            return { type:"spade-a-niu",    value:10, label:`牛牛(黑桃A)${swapNote}`,      tripleIdx:tripleIdxs, isPair, isSpadeANiu, used3as6 };
    if (isPair)                 return { type:"niu-niu-pair",   value:10, label:`牛牛(对子)${swapNote}`,       tripleIdx:tripleIdxs, isPair, isSpadeANiu:false, used3as6 };
    return                             { type:"niu-niu",        value:10, label:`牛牛${swapNote}`,             tripleIdx:tripleIdxs, isPair, isSpadeANiu:false, used3as6 };
  }

  if (isSpadeANiu && isPair)   return { type:"spade-a-pair",  value:niuVal, label:`牛${niuVal}(黑桃A+对子)${swapNote}`, tripleIdx:tripleIdxs, isPair, isSpadeANiu, used3as6 };
  if (isSpadeANiu)             return { type:"spade-a-niu",   value:niuVal, label:`牛${niuVal}(黑桃A)${swapNote}`,      tripleIdx:tripleIdxs, isPair, isSpadeANiu, used3as6 };
  if (isPair)                  return { type:"niu-pair",      value:niuVal, label:`牛${niuVal}(对子)${swapNote}`,       tripleIdx:tripleIdxs, isPair, isSpadeANiu:false, used3as6 };
  return                              { type:"niu",           value:niuVal, label:`牛${niuVal}${swapNote}`,             tripleIdx:tripleIdxs, isPair, isSpadeANiu:false, used3as6 };
}

// ─── Find best result for a hand ─────────────────────────────────────────────
function calcBestNiu(hand) {
  if (hand.length < 5) return { type:"no-niu", value:0, label:"没牛" };
  if (hand.every(c => isFaceCard(c.rank)))
    return { type:"five-face", value:15, label:"五花牛", tripleIdx:[] };
  let best = { type:"no-niu", value:0, label:"没牛" };
  for (let i = 0; i < 5; i++) for (let j = i+1; j < 5; j++) for (let k = j+1; k < 5; k++) {
    const r = evalSelection(hand, [i,j,k]);
    if (!r) continue;
    const rMult = multiplier(r), bMult = multiplier(best);
    // Compare by value first, then by multiplier (better payout)
    if (r.value > best.value) best = r;
    else if (r.value === best.value && rMult > bMult) best = r;
  }
  return best;
}

function multiplier(result) {
  if (!result) return 1;
  if (result.type === "five-face")    return 3;
  if (result.type === "spade-a-pair") return 4; // 对子A → 4×
  if (result.type === "spade-a-niu")  return 5; // JQK + 黑桃A → 5×
  if (result.type === "niu-niu-pair") return 3; // 牛牛 + 对子 → 3×
  if (result.type === "niu-niu")      return 2; // 牛10 → 2×
  if (result.isPair)                  return 3; // 对子 → 3×
  if (result.value === 9)             return 2; // 牛9 → 2×
  return 1;                                     // 大小 → 1×
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
  if (result.type === "five-face")    return 3;
  if (result.type === "spade-a-pair") return 4; // 对子A → 4×
  if (result.type === "spade-a-niu")  return 5; // JQK + 黑桃A → 5×
  if (result.type === "niu-niu-pair") return 3; // 牛牛 + 对子 → 3×
  if (result.type === "niu-niu")      return 2; // 牛10 → 2×
  if (result.isPair)                  return 3; // 对子 → 3×
  if (result.value === 9)             return 2; // 牛9 → 2×
  return 1;                                     // 大小 → 1×
}

// ─── Translations & Label Helper ─────────────────────────────────────────────
function getLabel(result, lang) {
  if (!result) return '';
  const zh = lang !== 'en';
  const sw = result.used3as6 ? '★' : '';
  if (result.type === 'five-face') return zh ? '五花牛' : 'Five Face';
  if (result.type === 'no-niu')   return zh ? '没牛' : 'No Niu';
  const niuPart = result.value === 10
    ? (zh ? '牛牛' : 'Niu Niu')
    : (zh ? `牛${result.value}` : `Niu ${result.value}`);
  if (result.isSpadeANiu && result.isPair)
    return `${niuPart}(${zh ? '黑桃A+对子' : '♠A+Pair'})${sw}`;
  if (result.isSpadeANiu)
    return `${niuPart}(${zh ? '黑桃A' : '♠A'})${sw}`;
  if (result.isPair)
    return `${niuPart}(${zh ? '对子' : 'Pair'})${sw}`;
  return `${niuPart}${sw}`;
}

const T = {
  zh: {
    chips: '筹码', pl: '总盈亏', currentBet: '本局下注',
    selectBet: '选择下注金额', deal: '发牌！',
    dealer: '庄家', cpu: '电脑',
    yourHand: '你的手牌',
    selectedCount: n => `已选 ${n}/3 张`,
    fiveFaceNotice: '🌟 五花牛！无需选牌，直接确认！',
    confirm: '确认开牌 👊', noNiuBtn: '没牛 🐄',
    won: n => `🎉 赢了 RM${n}！`,
    lost: n => `😞 输了 RM${n}`,
    tie: '🤝 平局',
    yourChoice: '👤 你的选择',
    bestComboLabel: sub => sub ? '💡 最佳组合' : '✅ 最佳组合',
    suboptimalNote: d => `最佳组合比你的选择 多 RM${d}`,
    optimalNote: '🎯 恭喜！你选了最佳组合！',
    dealerPrefix: '庄家：',
    times: n => `×${n}倍`,
    playAgain: '再来一局', resetChips: '重置筹码',
    history: '历史记录',
    errSelectThree: '请选择3张牌来凑牛，或点「没牛」提交！',
    errInvalidCombo: sum => `❌ 选的3张点数之和为 ${sum}（个位 ${sum%10}），不是10的倍数，凑不了牛！请重新选择。`,
    previewPartial: s => `当前点数和：${s}（个位 ${s%10}）`,
    previewValid: label => `✅ 有效！组合为 ${label}`,
    previewInvalid: s => `❌ 点数和个位为 ${s%10}，不是0，无法凑牛`,
    logWon: n => `赢 RM${n}`, logLost: n => `输 RM${n}`, logTie: '平局',
    logMissed: d => `（少赚/多亏 RM${d}）`,
    tiePayout: '平',
    rules: '玩法：选3张和为10的倍数 → 剩余2张个位为牛数。牛9/牛10 ×2，对子 ×3，对子A ×4，JQK+♠A ×5，其余 ×1。',
    rulesPair: '',
    rulesSpade: '',
    rulesSwap: '★ 凑牛时3↔6可互换。',
  },
  en: {
    chips: 'Chips', pl: 'P/L', currentBet: 'Bet',
    selectBet: 'Select Bet Amount', deal: 'Deal!',
    dealer: 'Dealer', cpu: 'CPU',
    yourHand: 'Your Hand',
    selectedCount: n => `Selected ${n}/3`,
    fiveFaceNotice: '🌟 Five Face! No selection needed, confirm!',
    confirm: 'Confirm 👊', noNiuBtn: 'No Niu 🐄',
    won: n => `🎉 Won RM${n}!`,
    lost: n => `😞 Lost RM${n}`,
    tie: '🤝 Tie',
    yourChoice: '👤 Your Choice',
    bestComboLabel: sub => sub ? '💡 Best Combo' : '✅ Best Combo',
    suboptimalNote: d => `Best combo beats yours by RM${d}`,
    optimalNote: '🎯 You picked the best combo!',
    dealerPrefix: 'Dealer: ',
    times: n => `×${n}`,
    playAgain: 'Play Again', resetChips: 'Reset Chips',
    history: 'History',
    errSelectThree: "Please select 3 cards, or click 'No Niu'!",
    errInvalidCombo: sum => `❌ Sum is ${sum} (units: ${sum%10}), not a multiple of 10! Try again.`,
    previewPartial: s => `Sum: ${s} (units: ${s%10})`,
    previewValid: label => `✅ Valid! Combo: ${label}`,
    previewInvalid: s => `❌ Units digit is ${s%10} (not 0), invalid`,
    logWon: n => `Won RM${n}`, logLost: n => `Lost RM${n}`, logTie: 'Tie',
    logMissed: d => `(missed RM${d})`,
    tiePayout: 'Tie',
    rules: 'How to play: Select 3 cards summing to a multiple of 10 → remaining 2 cards (units) = Niu value. Niu 9/Niu 10 ×2, Pair ×3, Pair Ace ×4, JQK+♠A ×5, others ×1.',
    rulesPair: '',
    rulesSpade: '',
    rulesSwap: '★ 3↔6 swap allowed when forming combos.',
  },
};

// ─── Card Component ───────────────────────────────────────────────────────────
function Card({ card, faceDown=false, state="normal", onClick, delay=0, small=false }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  const isRed = !faceDown && RED_SUITS.has(card?.suit);
  const isSelected = state === "selected";
  const isHighlight = state === "highlight";
  const isDim = state === "dim";
  const w = small ? 44 : 64, h = small ? 64 : 94;
  return (
    <div onClick={onClick} style={{
      width:w, height:h, borderRadius:8, flexShrink:0,
      background: faceDown ? "linear-gradient(135deg,#1a1a2e 25%,#16213e 75%)" : "#fff",
      border: isSelected ? "2.5px solid #4fc3f7"
            : isHighlight ? "2.5px solid #f5c518"
            : "1.5px solid rgba(255,255,255,0.15)",
      boxShadow: isSelected
        ? "0 0 16px rgba(79,195,247,0.7), 0 4px 12px rgba(0,0,0,0.4)"
        : isHighlight
        ? "0 0 14px rgba(245,197,24,0.6), 0 4px 12px rgba(0,0,0,0.4)"
        : "0 4px 12px rgba(0,0,0,0.35)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"'Georgia',serif", fontWeight:"bold",
      color: faceDown ? "transparent" : isRed ? "#c0392b" : "#1a1a2e",
      transform: `translateY(${visible ? (isSelected ? -10 : 0) : -30}px)`,
      opacity: visible ? (isDim ? 0.4 : 1) : 0,
      transition:"transform 0.3s cubic-bezier(.34,1.56,.64,1), opacity 0.3s, box-shadow 0.2s, border 0.2s",
      cursor: onClick ? "pointer" : "default",
      userSelect:"none", position:"relative",
    }}>
      {faceDown ? (
        <div style={{ fontSize: small?18:26, color:"#3a5a8a" }}>🂠</div>
      ) : (
        <>
          <div style={{ position:"absolute", top:4, left:6, fontSize:small?10:13, lineHeight:1 }}>
            {card.rank}<br/>{card.suit}
          </div>
          <div style={{ fontSize: small?18:28 }}>{card.suit}</div>
          <div style={{ position:"absolute", bottom:4, right:6, fontSize:small?10:13, lineHeight:1, transform:"rotate(180deg)" }}>
            {card.rank}<br/>{card.suit}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ result, lang = "zh" }) {
  if (!result) return null;
  const color = result.type === "five-face"    ? "#f5c518"
    : result.type === "spade-a-niu"            ? "#e040fb"
    : result.type === "spade-a-pair"           ? "#ab47bc"
    : result.type === "niu-niu-pair"           ? "#9b59b6"
    : result.type === "niu-niu"                ? "#e74c3c"
    : result.isPair                            ? "#8e44ad"
    : result.value >= 7                        ? "#e67e22"
    : result.value >= 4                        ? "#27ae60"
    : "#566";
  return (
    <span style={{
      background:color, color:"#fff", padding:"3px 10px", borderRadius:14,
      fontSize:12, fontWeight:"bold", boxShadow:`0 2px 8px ${color}70`, letterSpacing:.5,
      display:"inline-block",
    }}>{getLabel(result, lang)}</span>
  );
}

// ─── NPC Row ──────────────────────────────────────────────────────────────────
function NpcRow({ name, hand, result, revealed, isDealer, winAmount, lang = "zh" }) {
  const tripleSet = result?.tripleIdx ? new Set(result.tripleIdx) : new Set();
  const tx = T[lang];
  return (
    <div style={{
      background:"rgba(255,255,255,0.03)",
      border: isDealer ? "1.5px solid rgba(245,197,24,0.3)" : "1px solid rgba(255,255,255,0.07)",
      borderRadius:14, padding:"10px 14px",
      display:"flex", alignItems:"center", gap:10,
    }}>
      <div style={{ minWidth:64 }}>
        <div style={{ fontSize:12, fontWeight:"bold", color: isDealer ? "#f5c518" : "#777" }}>
          {isDealer ? `🏦 ${tx.dealer}` : `🤖 ${name}`}
        </div>
      </div>
      <div style={{ display:"flex", gap:4, flex:1 }}>
        {hand.map((card, i) => (
          <Card key={card.id} card={card} faceDown={!revealed}
            state={revealed && tripleSet.has(i) ? "highlight" : "normal"}
            small delay={i*50} />
        ))}
      </div>
      <div style={{ minWidth:96, textAlign:"right", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
        {revealed && result && <Badge result={result} lang={lang} />}
        {revealed && winAmount !== undefined && (
          <span style={{ fontSize:12, color: winAmount>0?"#2ecc71":winAmount<0?"#e74c3c":"#666" }}>
            {winAmount>0?`+RM${winAmount}`:winAmount<0?`-RM${Math.abs(winAmount)}`:tx.tiePayout}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Game ────────────────────────────────────────────────────────────────
export default function NiuNiuGame() {
  const [lang, setLang] = useState("zh");
  const tx = T[lang];
  const [coins, setCoins] = useState(INIT_COINS);
  const [bet, setBet] = useState(25);
  const [phase, setPhase] = useState("bet"); // bet | select | result
  const [hands, setHands] = useState({ player:[], dealer:[] });
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
    setHands({
      player: deck.slice(0,5),
      dealer: deck.slice(5,10),
    });
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
    setSelectedIdxs(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx)
      : prev.length >= 3 ? prev
      : [...prev, idx]
    );
  }

  function confirmSelection(declareNoNiu = false) {
    const isFiveFace = hands.player.every(c => isFaceCard(c.rank));

    // Evaluate NPC hands
    const npcR = {};
    ["dealer"].forEach(key => { npcR[key] = calcBestNiu(hands[key]); });
    setNpcResults(npcR);

    let selected;
    if (isFiveFace) {
      selected = { type:"five-face", value:15, tripleIdx:[] };
    } else if (declareNoNiu) {
      selected = { type:"no-niu", value:0, tripleIdx:[] };
    } else {
      if (selectedIdxs.length !== 3) {
        setSelectionError(tx.errSelectThree);
        return;
      }
      selected = evalSelection(hands.player, selectedIdxs);
      if (!selected) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
        const vals = selectedIdxs.map(i => cardValue(hands.player[i].rank));
        const sum = vals.reduce((a,b)=>a+b,0);
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
    setCoins(prev => prev + actual);
    setTotalWon(prev => prev + actual);

    const diff = optimal - actual;
    let log = actual > 0 ? tx.logWon(actual) : actual < 0 ? tx.logLost(Math.abs(actual)) : tx.logTie;
    if (diff > 0) log += tx.logMissed(diff);
    setRoundLog(prev => [log, ...prev].slice(0, 6));
    setPhase("result");
  }

  const isFiveFace = hands.player.length === 5 && hands.player.every(c => isFaceCard(c.rank));
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

  // Preview: does current 3-card selection form a valid niu?
  const previewResult = phase === "select" && selectedIdxs.length === 3 && !isFiveFace
    ? evalSelection(hands.player, selectedIdxs)
    : null;
  const previewSum = phase === "select" && selectedIdxs.length > 0 && !isFiveFace
    ? selectedIdxs.reduce((s, i) => s + cardValue(hands.player[i].rank), 0)
    : null;

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(160deg,#0a0e1a 0%,#0d1b2a 50%,#0a1628 100%)",
      fontFamily:"'Noto Sans SC','PingFang SC',sans-serif",
      color:"#e8eaf0", padding:"20px 16px", overflowX:"hidden",
    }}>
      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
        @keyframes pop { 0%{transform:scale(0.8);opacity:0} 100%{transform:scale(1);opacity:1} }
      `}</style>

      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:18, position:"relative" }}>
        <div style={{
          fontSize:34, fontWeight:900, letterSpacing:8,
          background:"linear-gradient(90deg,#f5c518,#e74c3c,#f5c518)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
        }}>牛 牛</div>
        <div style={{ fontSize:11, color:"#445", letterSpacing:4, marginTop:1 }}>NIU NIU · POKER</div>
        {/* Language toggle */}
        <button onClick={() => setLang(l => l === "zh" ? "en" : "zh")} style={{
          position:"absolute", top:0, right:0,
          padding:"5px 12px", borderRadius:8, border:"1.5px solid rgba(255,255,255,0.15)",
          background:"rgba(255,255,255,0.06)", color:"#aaa", fontSize:12,
          cursor:"pointer", fontWeight:"bold", letterSpacing:1,
        }}>{lang === "zh" ? "EN" : "中文"}</button>
      </div>

      {/* Stats Bar */}
      <div style={{
        display:"flex", justifyContent:"center", gap:28, marginBottom:16,
        background:"rgba(255,255,255,0.04)", borderRadius:12, padding:"10px 28px",
        maxWidth:420, margin:"0 auto 16px",
      }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:10, color:"#555", letterSpacing:1 }}>{tx.chips}</div>
          <div style={{ fontSize:22, fontWeight:"bold", color: coins < 50 ? "#e74c3c" : "#f5c518" }}>RM{coins}</div>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:10, color:"#555", letterSpacing:1 }}>{tx.pl}</div>
          <div style={{ fontSize:22, fontWeight:"bold", color: totalWon >= 0 ? "#2ecc71" : "#e74c3c" }}>
            {totalWon >= 0 ? "+" : ""}RM{totalWon}
          </div>
        </div>
        {phase !== "bet" && (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:10, color:"#555", letterSpacing:1 }}>{tx.currentBet}</div>
            <div style={{ fontSize:22, fontWeight:"bold", color:"#aaa" }}>RM{bet}</div>
          </div>
        )}
      </div>

      <div style={{ maxWidth:580, margin:"0 auto", display:"flex", flexDirection:"column", gap:10 }}>

        {/* ── BET PHASE ── */}
        {phase === "bet" && (
          <div style={{
            background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(255,255,255,0.08)",
            borderRadius:20, padding:28, textAlign:"center",
          }}>
            <div style={{ fontSize:15, color:"#aaa", marginBottom:16 }}>{tx.selectBet}</div>
            <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap", marginBottom:24 }}>
              {BET_OPTIONS.map(b => (
                <button key={b} onClick={() => setBet(b)} disabled={b > coins} style={{
                  padding:"10px 22px", borderRadius:10, fontSize:15, fontWeight:"bold",
                  cursor: b > coins ? "not-allowed" : "pointer",
                  border: bet === b ? "2px solid #f5c518" : "1.5px solid rgba(255,255,255,0.12)",
                  background: bet === b ? "rgba(245,197,24,0.15)" : "rgba(255,255,255,0.05)",
                  color: bet === b ? "#f5c518" : "#ccc", opacity: b > coins ? 0.4 : 1,
                }}>RM{b}</button>
              ))}
            </div>
            <button onClick={startRound} disabled={bet > coins} style={{
              padding:"14px 52px", borderRadius:12, border:"none",
              background:"linear-gradient(135deg,#f5c518,#e67e22)",
              color:"#1a1a2e", fontSize:18, fontWeight:900, cursor:"pointer",
              letterSpacing:2, boxShadow:"0 4px 20px rgba(245,197,24,0.4)",
            }}>{tx.deal}</button>
          </div>
        )}

        {/* ── NPC ROWS ── */}
        {phase !== "bet" && (
          <>
            <NpcRow name={tx.dealer} hand={hands.dealer} result={npcResults.dealer}
              revealed={phase === "result"} isDealer lang={lang} />
          </>
        )}

        {/* ── PLAYER HAND ── */}
        {phase !== "bet" && (
          <div style={{
            background:"rgba(79,195,247,0.05)",
            border: shake ? "2px solid rgba(231,76,60,0.6)" : "2px solid rgba(79,195,247,0.2)",
            borderRadius:16, padding:"16px 16px",
            animation: shake ? "shake 0.4s ease" : "none",
            transition:"border 0.2s",
          }}>
            {/* Header row */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <span style={{ fontSize:13, fontWeight:"bold", color:"#4fc3f7" }}>👤 {tx.yourHand}</span>
              <span style={{ fontSize:12, color: selectedIdxs.length===3 ? "#2ecc71" : "#667" }}>
                {phase === "select" && !isFiveFace ? tx.selectedCount(selectedIdxs.length) : ""}
              </span>
            </div>

            {/* Five face notice */}
            {isFiveFace && phase === "select" && (
              <div style={{ fontSize:13, color:"#f5c518", marginBottom:10, textAlign:"center", fontWeight:"bold" }}>
                {tx.fiveFaceNotice}
              </div>
            )}

            {/* Cards */}
            <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:12 }}>
              {hands.player.map((card, i) => (
                <Card key={card.id} card={card}
                  state={getCardState(i)}
                  onClick={phase === "select" && !isFiveFace ? () => toggleCard(i) : undefined}
                  delay={i * 80}
                />
              ))}
            </div>

            {/* Live preview while selecting */}
            {phase === "select" && !isFiveFace && selectedIdxs.length > 0 && (
              <div style={{
                textAlign:"center", fontSize:12, marginBottom:8,
                color: previewResult ? "#2ecc71" : selectedIdxs.length === 3 ? "#e74c3c" : "#778",
              }}>
                {selectedIdxs.length < 3
                  ? tx.previewPartial(previewSum)
                  : previewResult
                  ? tx.previewValid(getLabel(previewResult, lang))
                  : tx.previewInvalid(previewSum)
                }
              </div>
            )}

            {/* Error */}
            {selectionError && (
              <div style={{
                marginBottom:10, padding:"8px 14px", borderRadius:8,
                background:"rgba(231,76,60,0.12)", border:"1px solid rgba(231,76,60,0.3)",
                color:"#e74c3c", fontSize:13, textAlign:"center",
              }}>{selectionError}</div>
            )}

            {/* Confirm buttons */}
            {phase === "select" && (
              <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
                <button onClick={() => confirmSelection(false)} style={{
                  padding:"11px 32px", borderRadius:10, border:"none",
                  background: (selectedIdxs.length === 3 || isFiveFace)
                    ? "linear-gradient(135deg,#e74c3c,#c0392b)"
                    : "rgba(255,255,255,0.07)",
                  color: (selectedIdxs.length === 3 || isFiveFace) ? "#fff" : "#445",
                  fontSize:15, fontWeight:900, cursor:"pointer", letterSpacing:1,
                  boxShadow: (selectedIdxs.length === 3 || isFiveFace)
                    ? "0 4px 18px rgba(231,76,60,0.4)" : "none",
                  transition:"all 0.2s",
                }}>{tx.confirm}</button>

                {!isFiveFace && (
                  <button onClick={() => confirmSelection(true)} style={{
                    padding:"11px 28px", borderRadius:10, cursor:"pointer",
                    border:"1.5px solid rgba(150,150,150,0.25)",
                    background:"rgba(255,255,255,0.05)",
                    color:"#888", fontSize:15, fontWeight:"bold",
                    transition:"all 0.2s",
                  }}>{tx.noNiuBtn}</button>
                )}
              </div>
            )}

            {/* Result feedback */}
            {phase === "result" && (
              <div style={{ animation:"pop 0.3s ease" }}>
                {/* Big win/loss */}
                <div style={{
                  textAlign:"center", fontSize:24, fontWeight:900, marginBottom:12,
                  color: winAmount > 0 ? "#2ecc71" : winAmount < 0 ? "#e74c3c" : "#aaa",
                }}>
                  {winAmount > 0 ? tx.won(winAmount)
                   : winAmount < 0 ? tx.lost(Math.abs(winAmount))
                   : tx.tie}
                </div>

                {/* ── Your selection vs Best comparison ── */}
                <div style={{
                  background: isSuboptimal ? "rgba(245,197,24,0.06)" : "rgba(46,204,113,0.06)",
                  border: isSuboptimal ? "1px solid rgba(245,197,24,0.2)" : "1px solid rgba(46,204,113,0.2)",
                  borderRadius:12, padding:"14px 14px", marginBottom:10,
                }}>
                  <div style={{ display:"flex", gap:12, alignItems:"stretch", flexWrap:"wrap" }}>

                    {/* Player's selection */}
                    <div style={{ flex:1, minWidth:160 }}>
                      <div style={{ fontSize:11, color:"#667", marginBottom:6, letterSpacing:1 }}>
                        {tx.yourChoice}
                      </div>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                        {hands.player.map((card, i) => {
                          const inTriple = playerResult?.tripleIdx?.includes(i);
                          const isRest = playerResult?.tripleIdx?.length > 0 && !inTriple;
                          return (
                            <Card key={card.id} card={card} small
                              state={inTriple ? "highlight" : isRest ? "normal" : "normal"}
                              delay={i * 40}
                            />
                          );
                        })}
                      </div>
                      <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:6 }}>
                        <Badge result={playerResult} lang={lang} />
                        <span style={{ fontSize:12, color: winAmount > 0 ? "#2ecc71" : winAmount < 0 ? "#e74c3c" : "#888" }}>
                          {winAmount > 0 ? `+RM${winAmount}` : winAmount < 0 ? `-RM${Math.abs(winAmount)}` : tx.tiePayout}
                        </span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{
                      width:1, background:"rgba(255,255,255,0.08)",
                      alignSelf:"stretch", flexShrink:0,
                    }} />

                    {/* Best combination */}
                    <div style={{ flex:1, minWidth:160 }}>
                      <div style={{ fontSize:11, marginBottom:6, letterSpacing:1,
                        color: isSuboptimal ? "#f5c518" : "#2ecc71",
                      }}>
                        {tx.bestComboLabel(isSuboptimal)}
                      </div>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                        {hands.player.map((card, i) => {
                          const inBestTriple = bestResult?.tripleIdx?.includes(i);
                          return (
                            <Card key={card.id} card={card} small
                              state={inBestTriple ? "selected" : "normal"}
                              delay={i * 40}
                            />
                          );
                        })}
                      </div>
                      <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:6 }}>
                        <Badge result={bestResult} lang={lang} />
                        <span style={{ fontSize:12, color: bestWinAmount > 0 ? "#2ecc71" : bestWinAmount < 0 ? "#e74c3c" : "#888" }}>
                          {bestWinAmount > 0 ? `+RM${bestWinAmount}` : bestWinAmount < 0 ? `-RM${Math.abs(bestWinAmount)}` : tx.tiePayout}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Diff line */}
                  {isSuboptimal && (
                    <div style={{
                      marginTop:10, paddingTop:10,
                      borderTop:"1px solid rgba(245,197,24,0.15)",
                      fontSize:12, color:"#aaa", textAlign:"center",
                    }}>
                      <span style={{ color:"#e74c3c", fontWeight:"bold" }}>{tx.suboptimalNote(diff)}</span>
                    </div>
                  )}
                  {!isSuboptimal && (
                    <div style={{
                      marginTop:10, paddingTop:10,
                      borderTop:"1px solid rgba(46,204,113,0.15)",
                      fontSize:12, color:"#2ecc71", textAlign:"center", fontWeight:"bold",
                    }}>
                      {tx.optimalNote}
                    </div>
                  )}
                </div>

                {/* Dealer comparison line */}
                <div style={{ fontSize:12, color:"#556", textAlign:"center", marginBottom:12 }}>
                  {tx.dealerPrefix}<Badge result={npcResults.dealer} lang={lang} />
                  &nbsp;{tx.times(Math.max(multiplierFull(playerResult), multiplierFull(npcResults.dealer)))}
                </div>

                <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                  <button onClick={() => setPhase("bet")} style={{
                    padding:"11px 32px", borderRadius:10, border:"none",
                    background:"linear-gradient(135deg,#f5c518,#e67e22)",
                    color:"#1a1a2e", fontSize:15, fontWeight:900, cursor:"pointer",
                  }}>{tx.playAgain}</button>
                  {coins <= 0 && (
                    <button onClick={() => { setCoins(INIT_COINS); setTotalWon(0); setPhase("bet"); }} style={{
                      padding:"11px 32px", borderRadius:10,
                      border:"1.5px solid rgba(255,255,255,0.15)",
                      background:"transparent", color:"#aaa", fontSize:15, cursor:"pointer",
                    }}>{tx.resetChips}</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Round Log */}
        {roundLog.length > 0 && (
          <div style={{
            background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)",
            borderRadius:10, padding:"10px 16px",
          }}>
            <div style={{ fontSize:10, color:"#445", marginBottom:5, letterSpacing:1 }}>{tx.history}</div>
            {roundLog.map((log, i) => (
              <div key={i} style={{ fontSize:12, color: i===0?"#999":"#445", marginBottom:2 }}>{log}</div>
            ))}
          </div>
        )}

        {/* Rules */}
        <div style={{
          background:"rgba(255,255,255,0.02)", borderRadius:10,
          padding:"10px 16px", fontSize:11, color:"#445", lineHeight:2,
        }}>
          {tx.rules}
          <span style={{ color:"#8e44ad" }}> {tx.rulesPair}</span>
          <span style={{ color:"#e040fb" }}> {tx.rulesSpade}</span>
          <span style={{ color:"#1abc9c" }}> {tx.rulesSwap}</span>
        </div>
      </div>
    </div>
  );
}
