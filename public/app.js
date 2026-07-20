const state = {
  profile: null,
  activeSet: [],
  currentIndex: 0,
  puzzle: null,
  puzzleStartedAt: 0,
  hints: [],
  hintIndex: 0,
  lastProgress: null,
  fn: null,
  mismo: null,
  xouts: null,
  np: null,
  slg: null,
  pb: null
};

const gameModules = {};


const el = {
  name: document.getElementById("name"),
  gradeBand: document.getElementById("gradeBand"),
  loginBtn: document.getElementById("loginBtn"),
  profileStatus: document.getElementById("profileStatus"),
  gameType: document.getElementById("gameType"),
  difficultyDown: document.getElementById("difficultyDown"),
  difficulty: document.getElementById("difficulty"),
  difficultyUp: document.getElementById("difficultyUp"),
  difficultyLabel: document.getElementById("difficultyLabel"),
  setSizeLabel: document.getElementById("setSizeLabel"),
  setSize: document.getElementById("setSize"),
  setProgress: document.getElementById("setProgress"),
  newPuzzleBtn: document.getElementById("newPuzzleBtn"),
  puzzleBox: document.getElementById("puzzleBox"),
  choiceButtons: document.getElementById("choiceButtons"),
  numberLine: document.getElementById("numberLine"),
  answerRow: document.getElementById("answerRow"),
  answer: document.getElementById("answer"),
  submitBtn: document.getElementById("submitBtn"),
  hintBtn: document.getElementById("hintBtn"),
  result: document.getElementById("result"),
  progress: document.getElementById("progress"),
  // Reasoning capture panel (optional "explain your thinking" / "second method")
  reasoningPanel: document.getElementById("reasoningPanel"),
  reasoningExplanationField: document.getElementById("reasoningExplanationField"),
  reasoningExplanationPrompt: document.getElementById("reasoningExplanationPrompt"),
  reasoningExplanation: document.getElementById("reasoningExplanation"),
  reasoningSecondMethodField: document.getElementById("reasoningSecondMethodField"),
  reasoningSecondMethodPrompt: document.getElementById("reasoningSecondMethodPrompt"),
  reasoningSecondMethod: document.getElementById("reasoningSecondMethod"),
  explanationFeedback: document.getElementById("explanationFeedback"),
  fnZone: document.getElementById("factorNinjaZone"),
  fnStreak: document.getElementById("fnStreak"),
  fnSubLabel: document.getElementById("fnSubLabel"),
  fnHintBtn: document.getElementById("fnHintBtn"),
  fnArena: document.getElementById("fnArena"),
  fnOrbArea: document.getElementById("fnOrbArea"),
  fnOrb: document.getElementById("fnOrb"),
  fnTray: document.getElementById("fnTray"),
  fnPrimes: document.getElementById("fnPrimes"),
  fnCards: document.getElementById("fnCards"),
  fnKeypad: document.getElementById("fnKeypad"),
  fnHintArea: document.getElementById("fnHintArea"),
  fnBanner: document.getElementById("fnBanner"),
  fnParticles: document.getElementById("fnParticles"),
  // Mismo
  mismoZone: document.getElementById("mismoZone"),
  mismoProgress: document.getElementById("mismoProgress"),
  mismoBoard: document.getElementById("mismoBoard"),
  // X-Outs
  xOutsZone: document.getElementById("xOutsZone"),
  xOutsStatus: document.getElementById("xOutsStatus"),
  xOutsBoard: document.getElementById("xOutsBoard"),
  // Number Paths
  npZone: document.getElementById("numberPathsZone"),
  npStatus: document.getElementById("numberPathsStatus"),
  npBoard: document.getElementById("numberPathsBoard"),
  // Story Logic Grids
  slgZone: document.getElementById("storyLogicZone"),
  slgIntro: document.getElementById("storyLogicIntro"),
  slgClues: document.getElementById("storyLogicClues"),
  slgGrid: document.getElementById("storyLogicGrid"),
  slgCheckBtn: document.getElementById("storyLogicCheckBtn"),
  slgBanner: document.getElementById("storyLogicBanner"),
  // KenKen
  kkZone: document.getElementById("kenkenZone"),
  kkGrid: document.getElementById("kkGrid"),
  kkNumpad: document.getElementById("kkNumpad"),
  kkCheckBtn: document.getElementById("kkCheckBtn"),
  kkBanner: document.getElementById("kkBanner"),
  // Balance Scale
  bsZone: document.getElementById("balanceZone"),
  bsScale: document.getElementById("bsScale"),
  bsLeft: document.getElementById("bsLeft"),
  bsRight: document.getElementById("bsRight"),
  bsEquation: document.getElementById("bsEquation"),
  bsKeypad: document.getElementById("bsKeypad"),
  bsBanner: document.getElementById("bsBanner"),
  // Shikaku
  skZone: document.getElementById("shikakuZone"),
  skCanvas: document.getElementById("skCanvas"),
  skGridWrap: document.getElementById("skGridWrap"),
  skUndoBtn: document.getElementById("skUndoBtn"),
  skClearBtn: document.getElementById("skClearBtn"),
  skCheckBtn: document.getElementById("skCheckBtn"),
  skBanner: document.getElementById("skBanner"),
  // Angle Chase Studio
  acsZone: document.getElementById("angleChaseZone"),
  acsSvg: document.getElementById("acsSvg"),
  // Counting Lab
  clZone: document.getElementById("countingLabZone"),
  clDiagram: document.getElementById("clDiagram"),
  // Proof Blocks
  pbZone: document.getElementById("proofBlocksZone"),
  pbGoal: document.getElementById("proofBlocksGoal"),
  pbDiagram: document.getElementById("proofBlocksDiagram"),
  pbSvg: document.getElementById("proofBlocksSvg"),
  pbBank: document.getElementById("proofBlocksBank"),
  pbProof: document.getElementById("proofBlocksProof"),
  pbCheckBtn: document.getElementById("proofBlocksCheckBtn"),
  pbClearBtn: document.getElementById("proofBlocksClearBtn"),
  pbBanner: document.getElementById("proofBlocksBanner")
};

function difficultyLabel(n) {
  if (n <= 2) return "Easy";
  if (n <= 4) return "Medium";
  return "Challenge";
}

function updateDifficultyUi() {
  const d = Number(el.difficulty.value || "1");
  el.difficultyLabel.textContent = difficultyLabel(d);
}

function updateSetSizeUi() {
  const isMismo = el.gameType.value === "mismo";
  const isXOuts = el.gameType.value === "x-outs";
  if (el.setSizeLabel) {
    el.setSizeLabel.style.display = isXOuts ? "none" : "";
    if (isMismo) el.setSizeLabel.textContent = "Pairs";
    else if (isXOuts) el.setSizeLabel.textContent = "Set Size (fixed)";
    else el.setSizeLabel.textContent = "Set Size";
  }
  el.setSize.min = isMismo ? "4" : "1";
  el.setSize.max = "12";
  el.setSize.disabled = isXOuts;
  el.setSize.style.display = isXOuts ? "none" : "";
  const current = Number(el.setSize.value || "1");
  const min = Number(el.setSize.min || "1");
  const max = Number(el.setSize.max || "12");
  const clamped = isXOuts ? 1 : Math.max(min, Math.min(max, current));
  el.setSize.value = String(clamped);
}

function adjustDifficulty(delta) {
  const min = Number(el.difficulty.min || "1");
  const max = Number(el.difficulty.max || "6");
  const current = Number(el.difficulty.value || "1");
  const next = Math.max(min, Math.min(max, current + delta));
  el.difficulty.value = String(next);
  updateDifficultyUi();
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "API error");
  return body;
}

function getCurrentPuzzle() {
  return state.activeSet[state.currentIndex] || null;
}

function currentAttemptTimeMs() {
  if (!state.puzzleStartedAt) return 0;
  return Math.max(0, Date.now() - state.puzzleStartedAt);
}

// ----- Optional reasoning capture -----
// Show/hide + configure the "Explain your thinking" panel based on the
// puzzle's advisory `data.reasoning` flag. Purely optional enrichment: it never
// gates submission and never affects grading.
function applyReasoningPanel(puzzle) {
  if (!el.reasoningPanel) return;
  const reasoning = puzzle?.data?.reasoning;
  const supportsExplanation = Boolean(reasoning?.supportsExplanation);
  const supportsTwoMethod = Boolean(reasoning?.supportsTwoMethod);

  // Reset contents on every render so text never leaks between puzzles.
  if (el.reasoningExplanation) el.reasoningExplanation.value = "";
  if (el.reasoningSecondMethod) el.reasoningSecondMethod.value = "";
  el.reasoningPanel.open = false;
  clearExplanationFeedback();

  if (!supportsExplanation && !supportsTwoMethod) {
    el.reasoningPanel.style.display = "none";
    return;
  }

  el.reasoningPanel.style.display = "";
  if (el.reasoningExplanationField) {
    el.reasoningExplanationField.style.display = supportsExplanation ? "" : "none";
  }
  if (el.reasoningExplanationPrompt && reasoning?.explanationPrompt) {
    el.reasoningExplanationPrompt.textContent = reasoning.explanationPrompt;
  }
  if (el.reasoningSecondMethodField) {
    el.reasoningSecondMethodField.style.display = supportsTwoMethod ? "" : "none";
  }
  if (el.reasoningSecondMethodPrompt && reasoning?.secondMethodPrompt) {
    el.reasoningSecondMethodPrompt.textContent = reasoning.secondMethodPrompt;
  }
}

// Collect the optional reasoning fields for an attempt payload. Returns {} when
// the panel is hidden or empty, so attempts for non-supporting games are byte
// -for-byte identical to before (backward compatible).
function collectReasoning() {
  if (!el.reasoningPanel || el.reasoningPanel.style.display === "none") return {};
  const out = {};
  const explanation = (el.reasoningExplanation?.value || "").trim();
  const secondMethod = (el.reasoningSecondMethod?.value || "").trim();
  if (explanation) out.explanation = explanation;
  if (secondMethod) out.secondMethod = secondMethod;
  return out;
}

// ----- Optional explanation-quality feedback (purely additive encouragement) -----
// Surfaces the server's rubric result as friendly "badges earned" + a note.
// It is NEVER shown as a grade/number and never appears when no explanation was
// written. Nothing here changes the correctness result.
function clearExplanationFeedback() {
  if (!el.explanationFeedback) return;
  el.explanationFeedback.hidden = true;
  el.explanationFeedback.replaceChildren();
}

function applyExplanationFeedback(response) {
  const box = el.explanationFeedback;
  if (!box) return;
  const score = response?.result?.explanationScore;
  const badges = Array.isArray(score?.badges) ? score.badges : [];
  const notes = Array.isArray(score?.feedback) ? score.feedback : [];
  if (!score || (badges.length === 0 && notes.length === 0)) {
    clearExplanationFeedback();
    return;
  }
  box.replaceChildren();

  const title = document.createElement("div");
  title.className = "xf-title";
  title.textContent = "Reasoning bonus";
  box.appendChild(title);

  if (badges.length > 0) {
    const row = document.createElement("div");
    row.className = "xf-badges";
    for (const b of badges) {
      const chip = document.createElement("span");
      chip.className = "xf-badge";
      chip.textContent = `⭐ ${b}`;
      row.appendChild(chip);
    }
    box.appendChild(row);
  }

  for (const n of notes) {
    const p = document.createElement("p");
    p.className = "xf-note";
    p.textContent = n;
    box.appendChild(p);
  }

  box.hidden = false;
}

function applyReinforcementMessage(response, fallback) {
  const reinforce = response?.result?.reinforcement;
  if (!reinforce) {
    el.result.textContent = fallback;
    el.result.classList.remove("result-success");
    return;
  }
  const parts = [fallback];
  if (Array.isArray(reinforce.gainedSkills) && reinforce.gainedSkills.length > 0) {
    parts.push(`+Skill XP: ${reinforce.gainedSkills.join(", ")}`);
  }
  if (reinforce.levelProgress) {
    parts.push(reinforce.levelProgress);
  }
  if (Number(reinforce.streak || 0) > 1) {
    parts.push(`Streak ${reinforce.streak}`);
  }
  el.result.textContent = parts.join(" • ");
  el.result.classList.remove("result-success");
  void el.result.offsetWidth;
  el.result.classList.add("result-success");
  setTimeout(() => {
    el.result.classList.remove("result-success");
  }, 1800);
}

function renderNumberLine(puzzle) {
  el.numberLine.innerHTML = "";
  if (!puzzle || puzzle.gameTypeId !== "number-bonds-sprint") return;
  if (!puzzle.data.showNumberLine) return;

  const min = Number(puzzle.data.numberLineMin || 0);
  const max = Number(puzzle.data.numberLineMax || 10);
  const range = Math.max(1, max - min);
  const known = Number(puzzle.data.known || 0);
  const target = Number(puzzle.data.target || 0);
  const marks = [];
  for (let i = min; i <= max; i += 1) {
    marks.push(i);
  }

  const track = document.createElement("div");
  track.className = "line-track";
  for (const mark of marks) {
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.style.left = `${((mark - min) / range) * 100}%`;

    const tickMark = document.createElement("div");
    tickMark.className = "tick-mark";
    const tickLabel = document.createElement("div");
    tickLabel.className = "tick-label";
    tickLabel.textContent = String(mark);
    if (mark === known) tickLabel.textContent += " (start)";
    if (mark === target) tickLabel.textContent += " (target)";

    tick.appendChild(tickMark);
    tick.appendChild(tickLabel);
    track.appendChild(tick);
  }
  el.numberLine.appendChild(track);
}

function renderChoices(puzzle) {
  el.choiceButtons.innerHTML = "";
  if (!puzzle) return;
  const choices = puzzle.data?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return;

  for (const choice of choices) {
    const btn = document.createElement("button");
    btn.textContent = String(choice);
    btn.addEventListener("click", async () => {
      el.answer.value = String(choice);
      await submitCurrent();
    });
    el.choiceButtons.appendChild(btn);
  }
}

function isNumberBondsButtonMode(puzzle) {
  return puzzle?.gameTypeId === "number-bonds-sprint" && puzzle?.data?.inputMode === "buttons";
}

function updateGenericAnswerControls(puzzle) {
  if (!el.answerRow || !el.answer || !el.submitBtn || !el.hintBtn) return;
  const buttonMode = isNumberBondsButtonMode(puzzle);
  el.answerRow.style.display = "";
  el.answer.style.display = buttonMode ? "none" : "";
  el.submitBtn.style.display = buttonMode ? "none" : "";
  el.hintBtn.style.display = "";
}

function playNumberBondsWinEffect() {
  if (el.puzzleBox) {
    el.puzzleBox.classList.remove("nb-win-pop");
    // Force restart so each correct answer animates.
    void el.puzzleBox.offsetWidth;
    el.puzzleBox.classList.add("nb-win-pop");
    setTimeout(() => el.puzzleBox.classList.remove("nb-win-pop"), 700);
  }

  if (!el.numberLine) return;
  const burst = document.createElement("div");
  burst.className = "nb-burst";
  const colors = ["#22c55e", "#f59e0b", "#0ea5e9", "#ef4444", "#a855f7"];
  for (let i = 0; i < 14; i += 1) {
    const dot = document.createElement("span");
    dot.className = "nb-dot";
    const angle = (Math.PI * 2 * i) / 14;
    const dist = 26 + Math.random() * 54;
    dot.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    dot.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
    dot.style.background = colors[i % colors.length];
    burst.appendChild(dot);
  }
  el.numberLine.appendChild(burst);
  setTimeout(() => burst.remove(), 750);
}

// ===== Factor Ninja Interactive UI =====

function hideFactorNinja() {
  if (!el.fnZone) return;
  el.fnZone.style.display = "none";
  el.fnOrbArea.style.display = "none";
  el.fnTray.style.display = "none";
  el.fnPrimes.style.display = "none";
  el.fnCards.style.display = "none";
  el.fnKeypad.style.display = "none";
  el.fnHintArea.style.display = "none";
  el.fnBanner.className = "fn-banner";
  el.fnBanner.textContent = "";
  el.fnParticles.innerHTML = "";
  state.fn = null;
}

function hideGenericInput() {
  if (el.answerRow) el.answerRow.style.display = "none";
}

function restoreGenericInput() {
  if (el.answerRow) el.answerRow.style.display = "";
}

function fnSpawnParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "fn-particle";
    p.style.left = x + "px";
    p.style.top = y + "px";
    p.style.background = color || ["#39ff14", "#ffd700", "#a78bfa", "#f472b6"][i % 4];
    const angle = (Math.PI * 2 * i) / count;
    const dist = 40 + Math.random() * 60;
    p.style.setProperty("--dx", Math.cos(angle) * dist + "px");
    p.style.setProperty("--dy", Math.sin(angle) * dist + "px");
    p.style.animation = `fn-particle-fly 0.8s ease-out forwards`;
    p.style.transform = `translate(0,0)`;
    // Use custom end position via inline keyframes
    const id = "p" + Math.random().toString(36).slice(2, 8);
    p.style.animationName = id;
    const sheet = document.styleSheets[0];
    sheet.insertRule(`@keyframes ${id} {
      0% { transform: translate(0,0) scale(1); opacity:1; }
      100% { transform: translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0); opacity:0; }
    }`, sheet.cssRules.length);
    el.fnParticles.appendChild(p);
    setTimeout(() => p.remove(), 900);
  }
}

function fnShowBanner(text) {
  el.fnBanner.textContent = text;
  el.fnBanner.className = "fn-banner fn-banner-show";
}

function fnStreakText() {
  const correct = state.activeSet.slice(0, state.currentIndex).length;
  if (correct > 0) return `Streak: ${correct}`;
  return "";
}

// --- Prime Factors interactive mode ---

function renderPrimeFactorsMode(puzzle) {
  const data = puzzle.data;
  el.fnOrbArea.style.display = "";
  el.fnTray.style.display = "";
  el.fnPrimes.style.display = "";
  el.fnCards.style.display = "none";
  el.fnKeypad.style.display = "none";
  el.fnHintArea.style.display = "";
  el.fnHintArea.textContent = "";
  el.fnSubLabel.textContent = "Slash to Split";

  state.fn = {
    mode: "prime_factors",
    target: data.target,
    remaining: data.target,
    collected: [],
    primeChoices: data.primeChoices || [2, 3, 5, 7, 11, 13]
  };

  updateOrbDisplay();
  renderFactorTray();
  renderPrimeButtons();
}

function updateOrbDisplay() {
  el.fnOrb.textContent = state.fn.remaining;
  el.fnOrb.className = "fn-orb";
  if (state.fn.remaining === 1) {
    el.fnOrb.className = "fn-orb fn-orb-done";
    el.fnOrb.textContent = "1";
  }
}

function renderFactorTray() {
  el.fnTray.innerHTML = "";
  for (let i = 0; i < state.fn.collected.length; i++) {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.textContent = " \u00d7 ";
      sep.style.color = "#a78bfa";
      sep.style.fontWeight = "700";
      sep.style.fontSize = "1.1rem";
      el.fnTray.appendChild(sep);
    }
    const chip = document.createElement("span");
    chip.className = "fn-factor-chip";
    chip.textContent = state.fn.collected[i];
    el.fnTray.appendChild(chip);
  }
}

function renderPrimeButtons() {
  el.fnPrimes.innerHTML = "";
  for (const prime of state.fn.primeChoices) {
    const btn = document.createElement("button");
    btn.className = "fn-prime-btn";
    btn.textContent = prime;
    btn.addEventListener("click", () => handlePrimeClick(prime));
    el.fnPrimes.appendChild(btn);
  }
}

function handlePrimeClick(prime) {
  if (!state.fn || state.fn.remaining <= 1) return;

  if (state.fn.remaining % prime === 0) {
    // Correct - slash and split
    state.fn.remaining = state.fn.remaining / prime;
    state.fn.collected.push(prime);

    el.fnOrb.className = "fn-orb fn-orb-split";
    setTimeout(() => updateOrbDisplay(), 400);

    // Particles from orb center
    const rect = el.fnOrb.getBoundingClientRect();
    const zoneRect = el.fnZone.getBoundingClientRect();
    fnSpawnParticles(
      rect.left - zoneRect.left + rect.width / 2,
      rect.top - zoneRect.top + rect.height / 2,
      8, "#a78bfa"
    );

    renderFactorTray();

    // Check if done
    if (state.fn.remaining === 1) {
      setTimeout(() => {
        fnShowBanner("SLICED!");
        fnSpawnParticles(
          el.fnZone.offsetWidth / 2,
          el.fnZone.offsetHeight / 2,
          20, null
        );
        // Auto-submit the answer
        const answer = state.fn.collected.join(" \u00d7 ");
        el.answer.value = answer;
        setTimeout(() => submitCurrent(), 1200);
      }, 500);
    }
  } else {
    // Wrong - shake
    el.fnOrb.className = "fn-orb fn-orb-shake";
    setTimeout(() => {
      el.fnOrb.className = "fn-orb";
    }, 400);
  }
}

// --- GCF/LCM keypad mode ---

function renderKeypadMode(puzzle, subType) {
  const data = puzzle.data;
  const difficulty = Number(puzzle.difficulty || 1);
  const showFactors = difficulty <= 4;
  el.fnOrbArea.style.display = "none";
  el.fnTray.style.display = "none";
  el.fnPrimes.style.display = "none";
  el.fnCards.style.display = "";
  el.fnKeypad.style.display = "";
  el.fnHintArea.style.display = "";
  el.fnSubLabel.textContent = subType === "gcf" ? "Find the Shared Power" : "Build the Bridge";

  state.fn = { mode: subType, keypadValue: "" };

  // Render number cards
  el.fnCards.innerHTML = "";
  const cardA = makeNumberCard(data.a, showFactors ? (data.factorsA || []) : []);
  const cardB = makeNumberCard(data.b, showFactors ? (data.factorsB || []) : []);
  el.fnCards.appendChild(cardA);
  el.fnCards.appendChild(cardB);

  // Hint area for LCM
  el.fnHintArea.textContent = "";

  // Render keypad
  renderKeypad();
}

function makeNumberCard(num, factors) {
  const card = document.createElement("div");
  card.className = "fn-num-card";
  const big = document.createElement("div");
  big.className = "fn-big-num";
  big.textContent = num;
  card.appendChild(big);

  if (factors.length > 0) {
    const list = document.createElement("div");
    list.className = "fn-factor-list";
    for (const f of factors) {
      const chip = document.createElement("span");
      chip.className = "fn-mini-chip";
      chip.textContent = f;
      list.appendChild(chip);
    }
    card.appendChild(list);
  }
  return card;
}

function renderKeypad() {
  el.fnKeypad.innerHTML = "";

  // Display
  const display = document.createElement("div");
  display.className = "fn-keypad-display";
  display.id = "fnKeypadDisplay";
  display.textContent = state.fn.keypadValue || "\u00a0";
  el.fnKeypad.appendChild(display);

  // Number keys 1-9
  for (let i = 1; i <= 9; i++) {
    const key = document.createElement("button");
    key.className = "fn-key";
    key.textContent = i;
    key.addEventListener("click", () => fnKeyPress(String(i)));
    el.fnKeypad.appendChild(key);
  }

  // Bottom row: Clear, 0, Submit
  const clearKey = document.createElement("button");
  clearKey.className = "fn-key fn-key-action";
  clearKey.textContent = "CLR";
  clearKey.addEventListener("click", () => fnKeyPress("clear"));
  el.fnKeypad.appendChild(clearKey);

  const zeroKey = document.createElement("button");
  zeroKey.className = "fn-key";
  zeroKey.textContent = "0";
  zeroKey.addEventListener("click", () => fnKeyPress("0"));
  el.fnKeypad.appendChild(zeroKey);

  const goKey = document.createElement("button");
  goKey.className = "fn-key fn-key-go";
  goKey.textContent = "GO";
  goKey.addEventListener("click", () => fnKeyPress("go"));
  el.fnKeypad.appendChild(goKey);
}

function fnKeyPress(key) {
  if (!state.fn) return;
  const display = document.getElementById("fnKeypadDisplay");

  if (key === "clear") {
    state.fn.keypadValue = "";
    display.textContent = "\u00a0";
    return;
  }

  if (key === "go") {
    if (!state.fn.keypadValue) return;
    el.answer.value = state.fn.keypadValue;
    submitCurrentFromKeypad();
    return;
  }

  // Limit to 6 digits
  if (state.fn.keypadValue.length >= 6) return;
  state.fn.keypadValue += key;
  display.textContent = state.fn.keypadValue;
}

async function submitCurrentFromKeypad() {
  const puzzle = getCurrentPuzzle();
  if (!state.profile || !puzzle) return;

  const response = await api("/api/attempts", {
    method: "POST",
    body: JSON.stringify({
      profileId: state.profile.id,
      puzzle,
      answer: el.answer.value,
      hintsUsed: state.hintIndex,
      timeMs: currentAttemptTimeMs()
    })
  });

  if (response.result.isCorrect) {
    // Victory
    fnShowBanner("CORRECT!");
    fnSpawnParticles(el.fnZone.offsetWidth / 2, el.fnZone.offsetHeight / 2, 20, null);

    const justFinished = state.currentIndex + 1 === state.activeSet.length;
    setTimeout(() => {
      if (justFinished) {
        applyReinforcementMessage(response, "Correct! Set complete. Start another set.");
        state.activeSet = [];
        state.currentIndex = 0;
      } else {
        applyReinforcementMessage(response, "Correct! Moving to next question.");
        state.currentIndex += 1;
      }
      renderPuzzle();
    }, 1200);
  } else {
    // Wrong - flash the display
    const display = document.getElementById("fnKeypadDisplay");
    display.className = "fn-keypad-display fn-wrong";
    setTimeout(() => {
      display.className = "fn-keypad-display";
    }, 400);
    el.result.textContent = "Not yet. Try again or tap Hint.";
    state.fn.keypadValue = "";
    display.textContent = "\u00a0";
  }

  await refreshProgress();
}

// --- Main Factor Ninja renderer ---

function renderFactorNinja(puzzle) {
  if (!el.fnZone) return;
  hideFactorNinja();
  el.fnZone.style.display = "";
  hideGenericInput();
  el.fnStreak.textContent = fnStreakText();

  const subType = puzzle.data.subType;
  if (subType === "prime_factors") {
    renderPrimeFactorsMode(puzzle);
  } else {
    renderKeypadMode(puzzle, subType);
  }
}

// ===== End Factor Ninja =====

// ===== Mismo Interactive UI has been migrated to public/games/mismo.js =====


// ===== X-Outs Interactive UI =====

function hideXOuts() {
  if (!el.xOutsZone) return;
  el.xOutsZone.style.display = "none";
  el.xOutsZone.classList.remove("xouts-solved");
  el.xOutsBoard.innerHTML = "";
  el.xOutsStatus.textContent = "";
  el.xOutsStatus.classList.remove("xouts-win");
  state.xouts = null;
}

function xOutsCurrentSums() {
  if (!state.xouts) return null;
  const rowSums = state.xouts.grid.map((row, r) =>
    row.reduce((sum, val, c) => (
      state.xouts.crossed.has(`${r},${c}`) ? sum : sum + val
    ), 0)
  );
  const colSums = Array.from({ length: state.xouts.cols }, (_, c) =>
    state.xouts.grid.reduce((sum, row, r) => (
      state.xouts.crossed.has(`${r},${c}`) ? sum : sum + row[c]
    ), 0)
  );
  return { rowSums, colSums };
}

function xOutsSerializeCrossed() {
  if (!state.xouts) return "[]";
  const coords = [...state.xouts.crossed]
    .map((k) => k.split(",").map(Number))
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  return JSON.stringify(coords);
}

function renderXOuts(puzzle) {
  if (!el.xOutsZone) return;
  hideXOuts();
  el.xOutsZone.style.display = "";
  el.xOutsZone.classList.remove("xouts-solved");
  el.xOutsStatus.classList.remove("xouts-win");
  hideGenericInput();

  const grid = puzzle.data.grid;
  const rowTargets = puzzle.data.rowTargets;
  const colTargets = puzzle.data.colTargets;
  if (!Array.isArray(grid) || !Array.isArray(rowTargets) || !Array.isArray(colTargets)) return;

  state.xouts = {
    grid,
    rowTargets,
    colTargets,
    rows: grid.length,
    cols: grid[0].length,
    xCount: Number(puzzle.data.xCount || 0),
    crossed: new Set(),
    submitted: false
  };

  xOutsDrawBoard();
  xOutsUpdateStatus();
}

function xOutsDrawBoard() {
  if (!state.xouts) return;
  const { rows, cols, grid, rowTargets, colTargets } = state.xouts;
  const table = document.createElement("table");
  table.className = "xouts-table";
  const tbody = document.createElement("tbody");

  for (let r = 0; r < rows; r += 1) {
    const tr = document.createElement("tr");
    for (let c = 0; c < cols; c += 1) {
      const td = document.createElement("td");
      const btn = document.createElement("button");
      btn.className = "xouts-cell";
      btn.dataset.key = `${r},${c}`;
      btn.textContent = String(grid[r][c]);
      btn.addEventListener("click", () => xOutsToggle(r, c));
      td.appendChild(btn);
      tr.appendChild(td);
    }
    const target = document.createElement("td");
    target.className = "xouts-target";
    target.dataset.rowTarget = String(r);
    target.textContent = String(rowTargets[r]);
    tr.appendChild(target);
    tbody.appendChild(tr);
  }

  const targetRow = document.createElement("tr");
  for (let c = 0; c < cols; c += 1) {
    const td = document.createElement("td");
    td.className = "xouts-target";
    td.dataset.colTarget = String(c);
    td.textContent = String(colTargets[c]);
    targetRow.appendChild(td);
  }
  const empty = document.createElement("td");
  empty.textContent = "";
  targetRow.appendChild(empty);
  tbody.appendChild(targetRow);

  table.appendChild(tbody);
  el.xOutsBoard.innerHTML = "";
  el.xOutsBoard.appendChild(table);
}

function xOutsToggle(row, col) {
  if (!state.xouts || state.xouts.submitted) return;
  const key = `${row},${col}`;
  if (state.xouts.crossed.has(key)) {
    state.xouts.crossed.delete(key);
  } else {
    state.xouts.crossed.add(key);
  }
  const button = el.xOutsBoard.querySelector(`[data-key="${key}"]`);
  if (button) button.classList.toggle("crossed", state.xouts.crossed.has(key));
  xOutsUpdateStatus();
  xOutsTrySubmit();
}

function xOutsUpdateStatus() {
  if (!state.xouts) return;
  const sums = xOutsCurrentSums();
  if (!sums) return;

  const { rowSums, colSums } = sums;
  const { rowTargets, colTargets, xCount, crossed } = state.xouts;
  const crossedCount = crossed.size;
  el.xOutsStatus.textContent = `Crossed: ${crossedCount}/${xCount}`;

  for (let r = 0; r < rowSums.length; r += 1) {
    const node = el.xOutsBoard.querySelector(`[data-row-target="${r}"]`);
    if (!node) continue;
    node.classList.remove("ok", "bad");
    if (rowSums[r] === rowTargets[r]) node.classList.add("ok");
    else if (rowSums[r] < rowTargets[r]) node.classList.add("bad");
  }
  for (let c = 0; c < colSums.length; c += 1) {
    const node = el.xOutsBoard.querySelector(`[data-col-target="${c}"]`);
    if (!node) continue;
    node.classList.remove("ok", "bad");
    if (colSums[c] === colTargets[c]) node.classList.add("ok");
    else if (colSums[c] < colTargets[c]) node.classList.add("bad");
  }
}

function xOutsSolved() {
  if (!state.xouts) return false;
  if (state.xouts.crossed.size !== state.xouts.xCount) return false;
  const sums = xOutsCurrentSums();
  if (!sums) return false;
  for (let r = 0; r < state.xouts.rows; r += 1) {
    if (sums.rowSums[r] !== state.xouts.rowTargets[r]) return false;
  }
  for (let c = 0; c < state.xouts.cols; c += 1) {
    if (sums.colSums[c] !== state.xouts.colTargets[c]) return false;
  }
  return true;
}

function xOutsTrySubmit() {
  if (!state.xouts || state.xouts.submitted) return;
  if (!xOutsSolved()) return;
  state.xouts.submitted = true;
  el.answer.value = xOutsSerializeCrossed();
  el.xOutsZone.classList.add("xouts-solved");
  el.xOutsStatus.classList.add("xouts-win");
  el.xOutsStatus.textContent = "Awesome! Perfect solve!";
  setTimeout(() => submitCurrent(), 1600);
}

// ===== End X-Outs =====

// ===== Number Paths Interactive UI =====

function hideNumberPaths() {
  if (!el.npZone) return;
  el.npZone.style.display = "none";
  el.npZone.classList.remove("np-solved");
  el.npBoard.innerHTML = "";
  el.npStatus.textContent = "";
  state.np = null;
}

function npKey(r, c) {
  return `${r},${c}`;
}

function npIsAdjacent(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

function npParseExpected(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  const out = [];
  for (const chunk of text.split(";").filter(Boolean)) {
    const m = chunk.match(/^(\d+),(\d+)$/);
    if (!m) continue;
    out.push({ r: Number(m[1]), c: Number(m[2]) });
  }
  return out;
}

function npSerializePath(path) {
  return path.map((p) => `${p.r},${p.c}`).join(";");
}

function renderNumberPaths(puzzle) {
  if (!el.npZone) return;
  hideNumberPaths();
  el.npZone.style.display = "";
  hideGenericInput();

  const rows = Number(puzzle.data.rows || 0);
  const cols = Number(puzzle.data.cols || 0);
  const grid = puzzle.data.grid;
  const step = Number(puzzle.data.step || 1);
  const start = Number(puzzle.data.start || 1);
  const target = Number(puzzle.data.target || 1);
  const expectedPath = npParseExpected(puzzle.data.expectedPath);

  if (!Array.isArray(grid) || rows <= 0 || cols <= 0 || expectedPath.length === 0) return;

  state.np = {
    rows,
    cols,
    grid,
    step,
    start,
    target,
    expectedLen: expectedPath.length,
    expectedPath,
    path: [],
    submitted: false
  };

  el.npStatus.textContent = `Path: ${start} -> ${target} (count by ${step})`;
  npDrawBoard();
}

function npDrawBoard() {
  if (!state.np) return;
  const table = document.createElement("table");
  table.className = "np-table";
  const tbody = document.createElement("tbody");

  for (let r = 0; r < state.np.rows; r += 1) {
    const tr = document.createElement("tr");
    for (let c = 0; c < state.np.cols; c += 1) {
      const td = document.createElement("td");
      const btn = document.createElement("button");
      btn.className = "np-cell";
      btn.dataset.key = npKey(r, c);
      btn.textContent = String(state.np.grid[r][c]);
      btn.addEventListener("click", () => npToggle(r, c));
      td.appendChild(btn);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  el.npBoard.innerHTML = "";
  el.npBoard.appendChild(table);
  npRefreshMarks();
}

function npRefreshMarks() {
  if (!state.np) return;
  const pathIndex = new Map();
  for (let i = 0; i < state.np.path.length; i += 1) {
    pathIndex.set(npKey(state.np.path[i].r, state.np.path[i].c), i);
  }
  const cells = el.npBoard.querySelectorAll(".np-cell");
  for (const cell of cells) {
    const key = cell.dataset.key || "";
    const idx = pathIndex.get(key);
    cell.classList.remove("np-selected", "np-start", "np-end");
    if (idx !== undefined) {
      cell.classList.add("np-selected");
      if (idx === 0) cell.classList.add("np-start");
      if (idx === state.np.path.length - 1) cell.classList.add("np-end");
    }
  }
}

function npToggle(r, c) {
  if (!state.np || state.np.submitted) return;
  const value = Number(state.np.grid[r][c]);
  const key = npKey(r, c);
  const path = state.np.path;

  if (path.length > 0) {
    const last = path[path.length - 1];
    if (last.r === r && last.c === c) {
      path.pop();
      npRefreshMarks();
      el.npStatus.textContent = `Backtracked. ${path.length}/${state.np.expectedLen}`;
      return;
    }
  }

  const alreadyIndex = path.findIndex((p) => p.r === r && p.c === c);
  if (alreadyIndex >= 0) {
    el.npStatus.textContent = "That square is already in your path.";
    return;
  }

  if (path.length === 0) {
    if (value !== state.np.start) {
      el.npStatus.textContent = `Start on ${state.np.start}.`;
      return;
    }
    path.push({ r, c });
    npRefreshMarks();
    el.npStatus.textContent = `Great start! 1/${state.np.expectedLen}`;
    return;
  }

  const last = path[path.length - 1];
  const lastValue = Number(state.np.grid[last.r][last.c]);
  if (!npIsAdjacent(last, { r, c })) {
    el.npStatus.textContent = "Move to a side-neighbor square.";
    return;
  }
  if (value !== lastValue + state.np.step) {
    el.npStatus.textContent = `Next number should be ${lastValue + state.np.step}.`;
    return;
  }

  path.push({ r, c });
  npRefreshMarks();
  el.npStatus.textContent = `${path.length}/${state.np.expectedLen} cells in path.`;

  if (path.length === state.np.expectedLen) {
    npTrySubmit();
  }
}

function npTrySubmit() {
  if (!state.np || state.np.submitted) return;
  const serialized = npSerializePath(state.np.path);
  if (serialized !== npSerializePath(state.np.expectedPath)) {
    el.npStatus.textContent = "Close! Check the path order carefully.";
    return;
  }
  state.np.submitted = true;
  el.answer.value = serialized;
  el.npZone.classList.add("np-solved");
  el.npStatus.textContent = "Path complete! Nice work!";
  setTimeout(() => submitCurrent(), 1200);
}

// ===== End Number Paths =====

// ===== Story Logic Grids Interactive UI =====

function hideStoryLogic() {
  if (!el.slgZone) return;
  el.slgZone.style.display = "none";
  el.slgIntro.textContent = "";
  el.slgClues.innerHTML = "";
  el.slgGrid.innerHTML = "";
  el.slgBanner.textContent = "";
  state.slg = null;
}

function renderStoryLogic(puzzle) {
  if (!el.slgZone) return;
  hideStoryLogic();
  el.slgZone.style.display = "";
  hideGenericInput();

  const data = puzzle.data || {};
  const roles = Array.isArray(data.roles) ? data.roles : [];
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const clues = Array.isArray(data.clues) ? data.clues : [];
  state.slg = { roles, categories, submitted: false };

  el.slgIntro.textContent = data.intro || puzzle.prompt.text || "";

  const clueList = document.createElement("ol");
  clueList.className = "slg-clue-list";
  for (const clue of clues) {
    const item = document.createElement("li");
    item.textContent = String(clue.text || "");
    clueList.appendChild(item);
  }
  el.slgClues.appendChild(clueList);

  const table = document.createElement("table");
  table.className = "slg-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const roleHead = document.createElement("th");
  roleHead.textContent = "Who";
  headRow.appendChild(roleHead);
  for (const category of categories) {
    const th = document.createElement("th");
    th.textContent = category.label;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const role of roles) {
    const tr = document.createElement("tr");
    const roleCell = document.createElement("th");
    roleCell.scope = "row";
    roleCell.textContent = role;
    tr.appendChild(roleCell);
    for (const category of categories) {
      const td = document.createElement("td");
      const select = document.createElement("select");
      select.dataset.role = role;
      select.dataset.category = category.id;
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "-";
      select.appendChild(blank);
      for (const value of category.values || []) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      }
      select.addEventListener("change", slgRefreshAvailability);
      td.appendChild(select);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  el.slgGrid.appendChild(table);

  el.slgCheckBtn.onclick = slgSubmit;
  slgRefreshAvailability();
}

function slgBuildAnswer() {
  const answer = {};
  const selects = el.slgGrid.querySelectorAll("select[data-role][data-category]");
  for (const select of selects) {
    const role = select.dataset.role;
    const category = select.dataset.category;
    if (!role || !category || !select.value) return null;
    if (!answer[role]) answer[role] = {};
    answer[role][category] = select.value;
  }
  return answer;
}

function slgRefreshAvailability() {
  if (!state.slg) return;
  for (const category of state.slg.categories) {
    const selects = [...el.slgGrid.querySelectorAll(`select[data-category="${category.id}"]`)];
    const used = new Map();
    for (const select of selects) {
      if (select.value) used.set(select.value, (used.get(select.value) || 0) + 1);
    }
    for (const select of selects) {
      select.classList.toggle("slg-duplicate", Boolean(select.value && used.get(select.value) > 1));
      for (const option of select.options) {
        if (!option.value || option.value === select.value) {
          option.disabled = false;
        } else {
          option.disabled = used.has(option.value);
        }
      }
    }
  }
}

async function slgSubmit() {
  if (!state.slg || state.slg.submitted) return;
  const answer = slgBuildAnswer();
  if (!answer) {
    el.slgBanner.textContent = "Fill every cell first.";
    return;
  }
  state.slg.submitted = true;
  el.answer.value = JSON.stringify(answer);

  const puzzle = getCurrentPuzzle();
  const response = await api("/api/attempts", {
    method: "POST",
    body: JSON.stringify({
      profileId: state.profile.id,
      puzzle,
      answer: el.answer.value,
      hintsUsed: state.hintIndex,
      timeMs: currentAttemptTimeMs()
    })
  });

  if (response.result.isCorrect) {
    el.slgBanner.textContent = "Solved!";
    const justFinished = state.currentIndex + 1 === state.activeSet.length;
    setTimeout(() => {
      if (justFinished) {
        applyReinforcementMessage(response, "Correct! Set complete. Start another set.");
        state.activeSet = [];
        state.currentIndex = 0;
      } else {
        applyReinforcementMessage(response, "Correct! Moving to next question.");
        state.currentIndex += 1;
      }
      renderPuzzle();
    }, 1000);
  } else {
    state.slg.submitted = false;
    el.slgBanner.textContent = "Not yet. Recheck the clues.";
  }
  await refreshProgress();
}

// ===== End Story Logic Grids =====

// ===== KenKen Interactive UI =====

function hideKenKen() {
  if (!el.kkZone) return;
  el.kkZone.style.display = "none";
  el.kkGrid.innerHTML = "";
  el.kkNumpad.innerHTML = "";
  el.kkBanner.textContent = "";
  state.kk = null;
}

function renderKenKen(puzzle) {
  if (!el.kkZone) return;
  hideKenKen();
  el.kkZone.style.display = "";
  hideGenericInput();

  const size = puzzle.data.size;
  const cages = puzzle.data.cages;

  // Build cage map: cell key -> cage index
  const cageMap = {};
  for (let ci = 0; ci < cages.length; ci++) {
    for (const [r, c] of cages[ci].cells) {
      cageMap[`${r},${c}`] = ci;
    }
  }

  // Init state
  state.kk = {
    size,
    cages,
    cageMap,
    grid: Array.from({ length: size }, () => Array(size).fill(0)),
    selectedCell: null
  };

  // Build grid
  const kkAvail = (el.kkZone.clientWidth || 360) - 48;
  const kkCell = Math.min(52, Math.floor(kkAvail / size));
  el.kkZone.style.setProperty("--kk-cell", kkCell + "px");
  el.kkGrid.style.gridTemplateColumns = `repeat(${size}, ${kkCell}px)`;
  el.kkGrid.style.gridTemplateRows = `repeat(${size}, ${kkCell}px)`;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = document.createElement("div");
      cell.className = "kk-cell";
      cell.dataset.r = r;
      cell.dataset.c = c;

      // Cage borders
      const ci = cageMap[`${r},${c}`];
      if (r === 0 || cageMap[`${r - 1},${c}`] !== ci) cell.classList.add("kk-border-top");
      if (r === size - 1 || cageMap[`${r + 1},${c}`] !== ci) cell.classList.add("kk-border-bottom");
      if (c === 0 || cageMap[`${r},${c - 1}`] !== ci) cell.classList.add("kk-border-left");
      if (c === size - 1 || cageMap[`${r},${c + 1}`] !== ci) cell.classList.add("kk-border-right");

      // Cage label: show on top-left cell of each cage
      const cage = cages[ci];
      const isTopLeft = cage.cells[0][0] === r && cage.cells[0][1] === c ||
        !cage.cells.some(([cr, cc]) => cr < r || (cr === r && cc < c));
      if (isTopLeft) {
        // Find actual top-left
        const minR = Math.min(...cage.cells.map(([cr]) => cr));
        const minC = Math.min(...cage.cells.filter(([cr]) => cr === minR).map(([, cc]) => cc));
        if (r === minR && c === minC) {
          const label = document.createElement("span");
          label.className = "kk-cage-label";
          label.textContent = cage.cells.length === 1 ? String(cage.target) : `${cage.target}${cage.op}`;
          cell.appendChild(label);
        }
      }

      cell.addEventListener("click", () => kkSelectCell(r, c));
      el.kkGrid.appendChild(cell);
    }
  }

  // Numpad
  for (let n = 1; n <= size; n++) {
    const btn = document.createElement("button");
    btn.textContent = n;
    btn.addEventListener("click", () => kkPlaceDigit(n));
    el.kkNumpad.appendChild(btn);
  }
  // Clear button
  const clrBtn = document.createElement("button");
  clrBtn.textContent = "\u232b";
  clrBtn.addEventListener("click", () => kkPlaceDigit(0));
  el.kkNumpad.appendChild(clrBtn);

  // Check button
  el.kkCheckBtn.onclick = kkCheckSolution;
}

function kkSelectCell(r, c) {
  if (!state.kk) return;
  // Deselect previous
  const prev = el.kkGrid.querySelector(".kk-selected");
  if (prev) prev.classList.remove("kk-selected");

  state.kk.selectedCell = [r, c];
  const idx = r * state.kk.size + c;
  el.kkGrid.children[idx].classList.add("kk-selected");
}

function kkPlaceDigit(n) {
  if (!state.kk || !state.kk.selectedCell) return;
  const [r, c] = state.kk.selectedCell;
  state.kk.grid[r][c] = n;

  const idx = r * state.kk.size + c;
  const cell = el.kkGrid.children[idx];
  // Preserve cage label if present
  const label = cell.querySelector(".kk-cage-label");
  const valSpan = cell.querySelector(".kk-val") || document.createElement("span");
  valSpan.className = "kk-val";
  valSpan.textContent = n > 0 ? String(n) : "";
  if (!cell.querySelector(".kk-val")) cell.appendChild(valSpan);

  // Auto-advance to next empty cell
  const size = state.kk.size;
  for (let i = 1; i < size * size; i++) {
    const nr = Math.floor(((r * size + c) + i) % (size * size) / size);
    const nc = ((r * size + c) + i) % (size * size) % size;
    if (state.kk.grid[nr][nc] === 0) {
      kkSelectCell(nr, nc);
      return;
    }
  }
}

async function kkCheckSolution() {
  if (!state.kk) return;
  const grid = state.kk.grid;
  const size = state.kk.size;

  // Check if fully filled
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === 0) {
        el.kkBanner.textContent = "Fill all cells first!";
        return;
      }
    }
  }

  const answer = grid.map((row) => row.join(",")).join(",");
  el.answer.value = answer;

  const puzzle = getCurrentPuzzle();
  const response = await api("/api/attempts", {
    method: "POST",
    body: JSON.stringify({
      profileId: state.profile.id,
      puzzle,
      answer,
      hintsUsed: state.hintIndex,
      timeMs: currentAttemptTimeMs(),
      ...collectReasoning()
    })
  });

  applyExplanationFeedback(response);

  if (response.result.isCorrect) {
    el.kkBanner.textContent = "SOLVED!";
    // Color all cells green
    for (const cell of el.kkGrid.children) {
      cell.classList.add("kk-correct");
    }
    const justFinished = state.currentIndex + 1 === state.activeSet.length;
    setTimeout(() => {
      if (justFinished) {
        applyReinforcementMessage(response, "Correct! Set complete. Start another set.");
        state.activeSet = [];
        state.currentIndex = 0;
      } else {
        applyReinforcementMessage(response, "Correct! Moving to next question.");
        state.currentIndex += 1;
      }
      renderPuzzle();
    }, 1500);
  } else {
    el.kkBanner.textContent = "Not quite right. Check your work!";
    // Highlight row/col conflicts
    for (let r = 0; r < size; r++) {
      const rowVals = grid[r];
      const hasDup = new Set(rowVals).size !== size;
      if (hasDup) {
        for (let c = 0; c < size; c++) {
          el.kkGrid.children[r * size + c].classList.add("kk-wrong");
        }
      }
    }
    setTimeout(() => {
      for (const cell of el.kkGrid.children) cell.classList.remove("kk-wrong");
    }, 1500);
  }
  await refreshProgress();
}

// ===== End KenKen =====

// ===== Balance Scale Interactive UI =====

function hideBalance() {
  if (!el.bsZone) return;
  el.bsZone.style.display = "none";
  el.bsLeft.innerHTML = "";
  el.bsRight.innerHTML = "";
  el.bsEquation.textContent = "";
  el.bsKeypad.innerHTML = "";
  el.bsBanner.textContent = "";
  el.bsScale.classList.remove("bs-balanced", "bs-tip-left", "bs-tip-right");
  state.bs = null;
}

function renderBalance(puzzle) {
  if (!el.bsZone) return;
  hideBalance();
  el.bsZone.style.display = "";
  hideGenericInput();

  const data = puzzle.data;
  state.bs = { keypadValue: "0" };

  // Display equation
  el.bsEquation.textContent = data.display;

  // Render scale pans
  renderScaleSide(el.bsLeft, data.left);
  renderScaleSide(el.bsRight, data.right);

  // Build keypad
  renderBsKeypad();
  bsUpdatePreview();
}

function renderScaleSide(panEl, terms) {
  panEl.innerHTML = "";
  for (let i = 0; i < terms.length; i++) {
    if (i > 0) {
      const op = document.createElement("span");
      op.className = "bs-term-op";
      const val = terms[i].value ?? 0;
      op.textContent = (terms[i].type === "constant" && val < 0) ? "\u2212" : "+";
      panEl.appendChild(op);
    }

    const termEl = document.createElement("span");
    const t = terms[i];
    if (t.type === "variable") {
      termEl.className = "bs-term bs-term-var";
      termEl.textContent = (t.coefficient === 1 ? "" : t.coefficient) + "x";
    } else {
      termEl.className = "bs-term bs-term-const";
      termEl.textContent = String(Math.abs(t.value));
    }
    panEl.appendChild(termEl);
  }
}

function renderBsKeypad() {
  el.bsKeypad.innerHTML = "";

  const display = document.createElement("div");
  display.className = "bs-display";
  display.id = "bsDisplay";
  display.textContent = state.bs?.keypadValue || "0";
  el.bsKeypad.appendChild(display);

  for (let i = 1; i <= 9; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.addEventListener("click", () => bsKeyPress(String(i)));
    el.bsKeypad.appendChild(btn);
  }

  const negBtn = document.createElement("button");
  negBtn.className = "bs-key-action";
  negBtn.textContent = "\u00b1";
  negBtn.addEventListener("click", () => bsKeyPress("neg"));
  el.bsKeypad.appendChild(negBtn);

  const zeroBtn = document.createElement("button");
  zeroBtn.textContent = "0";
  zeroBtn.addEventListener("click", () => bsKeyPress("0"));
  el.bsKeypad.appendChild(zeroBtn);

  const clrBtn = document.createElement("button");
  clrBtn.className = "bs-key-action";
  clrBtn.textContent = "CLR";
  clrBtn.addEventListener("click", () => bsKeyPress("clear"));
  el.bsKeypad.appendChild(clrBtn);

  const delBtn = document.createElement("button");
  delBtn.className = "bs-key-action";
  delBtn.textContent = "\u232b";
  delBtn.addEventListener("click", () => bsKeyPress("del"));
  el.bsKeypad.appendChild(delBtn);

  const goBtn = document.createElement("button");
  goBtn.className = "bs-key-go";
  goBtn.textContent = "GO";
  goBtn.addEventListener("click", () => bsKeyPress("go"));
  el.bsKeypad.appendChild(goBtn);
}

function bsEvalSide(terms, x) {
  return terms.reduce((sum, t) => {
    if (t.type === "variable") return sum + (t.coefficient ?? 1) * x;
    return sum + (t.value ?? 0);
  }, 0);
}

function bsCurrentX() {
  if (!state.bs) return 0;
  const raw = String(state.bs.keypadValue || "").trim();
  if (!raw || raw === "-") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function bsUpdatePreview() {
  if (!state.bs) return;
  const puzzle = getCurrentPuzzle();
  if (!puzzle || puzzle.gameTypeId !== "balance-scale") return;

  const x = bsCurrentX();
  const left = bsEvalSide(puzzle.data.left || [], x);
  const right = bsEvalSide(puzzle.data.right || [], x);
  const diff = left - right;

  el.bsScale.classList.remove("bs-tip-left", "bs-tip-right", "bs-balanced");
  if (diff > 0) {
    el.bsScale.classList.add("bs-tip-left");
  } else if (diff < 0) {
    el.bsScale.classList.add("bs-tip-right");
  } else {
    el.bsScale.classList.add("bs-balanced");
  }

  el.bsBanner.textContent = `x=${x} -> left ${left}, right ${right}`;
}

function bsKeyPress(key) {
  if (!state.bs) return;
  const display = document.getElementById("bsDisplay");

  if (key === "clear") {
    state.bs.keypadValue = "0";
    display.textContent = "0";
    bsUpdatePreview();
    return;
  }
  if (key === "del") {
    state.bs.keypadValue = state.bs.keypadValue.slice(0, -1);
    if (!state.bs.keypadValue || state.bs.keypadValue === "-") {
      state.bs.keypadValue = "0";
    }
    display.textContent = state.bs.keypadValue;
    bsUpdatePreview();
    return;
  }
  if (key === "neg") {
    if (state.bs.keypadValue.startsWith("-")) {
      state.bs.keypadValue = state.bs.keypadValue.slice(1) || "0";
    } else {
      state.bs.keypadValue = state.bs.keypadValue === "0"
        ? "-0"
        : "-" + state.bs.keypadValue;
    }
    display.textContent = state.bs.keypadValue;
    bsUpdatePreview();
    return;
  }
  if (key === "go") {
    if (!state.bs.keypadValue) return;
    bsSubmit();
    return;
  }

  if (state.bs.keypadValue === "0" || state.bs.keypadValue === "-0") {
    state.bs.keypadValue = state.bs.keypadValue.startsWith("-") ? "-" : "";
  }
  if (state.bs.keypadValue.replace("-", "").length >= 4) return;
  state.bs.keypadValue += key;
  display.textContent = state.bs.keypadValue;
  bsUpdatePreview();
}

async function bsSubmit() {
  const puzzle = getCurrentPuzzle();
  if (!state.profile || !puzzle) return;
  const answer = state.bs.keypadValue;
  el.answer.value = answer;

  const response = await api("/api/attempts", {
    method: "POST",
    body: JSON.stringify({
      profileId: state.profile.id,
      puzzle,
      answer,
      hintsUsed: state.hintIndex,
      timeMs: currentAttemptTimeMs(),
      ...collectReasoning()
    })
  });

  applyExplanationFeedback(response);

  if (response.result.isCorrect) {
    el.bsBanner.textContent = "BALANCED!";
    el.bsScale.classList.remove("bs-tip-left", "bs-tip-right");
    el.bsScale.classList.add("bs-balanced");

    const justFinished = state.currentIndex + 1 === state.activeSet.length;
    setTimeout(() => {
      if (justFinished) {
        applyReinforcementMessage(response, "Correct! Set complete. Start another set.");
        state.activeSet = [];
        state.currentIndex = 0;
      } else {
        applyReinforcementMessage(response, "Correct! Moving to next question.");
        state.currentIndex += 1;
      }
      renderPuzzle();
    }, 1200);
  } else {
    const display = document.getElementById("bsDisplay");
    display.classList.add("bs-wrong");
    setTimeout(() => display.classList.remove("bs-wrong"), 400);
    bsUpdatePreview();
    el.result.textContent = "Not yet. Watch which side tips, then adjust x.";
  }
  await refreshProgress();
}

// ===== End Balance Scale =====

// ===== Shikaku Interactive UI =====

function hideShikaku() {
  if (!el.skZone) return;
  el.skZone.style.display = "none";
  el.skBanner.textContent = "";
  state.sk = null;
}

function renderShikaku(puzzle) {
  if (!el.skZone) return;
  hideShikaku();
  el.skZone.style.display = "";
  hideGenericInput();

  const data = puzzle.data;
  const rows = data.rows;
  const cols = data.cols;
  const clues = data.clues;
  const skAvail = (el.skZone.clientWidth || 360) - 40;
  const cellSize = Math.min(52, Math.floor(skAvail / Math.max(rows, cols)));

  state.sk = {
    rows, cols, clues, cellSize,
    rects: [], // placed rectangles
    dragStart: null,
    dragCurrent: null
  };

  // Set canvas size
  const canvas = el.skCanvas;
  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;
  el.skGridWrap.style.width = canvas.width + 6 + "px";

  // Draw initial grid
  skDraw();

  // Mouse/touch handlers
  canvas.onmousedown = (e) => skMouseDown(e);
  canvas.onmousemove = (e) => skMouseMove(e);
  canvas.onmouseup = (e) => skMouseUp(e);
  canvas.onmouseleave = () => { state.sk.dragStart = null; state.sk.dragCurrent = null; skDraw(); };

  // Touch support
  canvas.ontouchstart = (e) => { e.preventDefault(); skMouseDown(e.touches[0]); };
  canvas.ontouchmove = (e) => { e.preventDefault(); skMouseMove(e.touches[0]); };
  canvas.ontouchend = (e) => { e.preventDefault(); skMouseUp(e); };

  el.skUndoBtn.onclick = () => { state.sk.rects.pop(); skDraw(); };
  el.skClearBtn.onclick = () => { state.sk.rects = []; skDraw(); };
  el.skCheckBtn.onclick = skCheckSolution;
}

function skCellFromEvent(e) {
  const canvas = el.skCanvas;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const c = Math.floor(x / state.sk.cellSize);
  const r = Math.floor(y / state.sk.cellSize);
  return [
    Math.max(0, Math.min(state.sk.rows - 1, r)),
    Math.max(0, Math.min(state.sk.cols - 1, c))
  ];
}

function skMouseDown(e) {
  if (!state.sk) return;
  state.sk.dragStart = skCellFromEvent(e);
  state.sk.dragCurrent = state.sk.dragStart;
  skDraw();
}

function skMouseMove(e) {
  if (!state.sk || !state.sk.dragStart) return;
  state.sk.dragCurrent = skCellFromEvent(e);
  skDraw();
}

function skMouseUp() {
  if (!state.sk || !state.sk.dragStart || !state.sk.dragCurrent) return;
  const [r1, c1] = state.sk.dragStart;
  const [r2, c2] = state.sk.dragCurrent;
  const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
  const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
  const rect = { r: minR, c: minC, w: maxC - minC + 1, h: maxR - minR + 1 };

  // Only add if it doesn't overlap existing rects
  if (!skOverlaps(rect)) {
    state.sk.rects.push(rect);
  }

  state.sk.dragStart = null;
  state.sk.dragCurrent = null;
  skDraw();

  // Auto-check when grid is fully covered
  const totalCells = state.sk.rects.reduce((sum, r) => sum + r.w * r.h, 0);
  if (totalCells === state.sk.rows * state.sk.cols) {
    skCheckSolution();
  }
}

function skOverlaps(newRect) {
  for (const rect of state.sk.rects) {
    if (
      newRect.r < rect.r + rect.h &&
      newRect.r + newRect.h > rect.r &&
      newRect.c < rect.c + rect.w &&
      newRect.c + newRect.w > rect.c
    ) return true;
  }
  return false;
}

const SK_COLORS = [
  "rgba(59, 130, 246, 0.35)",
  "rgba(234, 179, 8, 0.35)",
  "rgba(168, 85, 247, 0.35)",
  "rgba(239, 68, 68, 0.35)",
  "rgba(34, 197, 94, 0.35)",
  "rgba(236, 72, 153, 0.35)",
  "rgba(14, 165, 233, 0.35)",
  "rgba(249, 115, 22, 0.35)"
];

function skDraw() {
  if (!state.sk) return;
  const { rows, cols, clues, cellSize, rects, dragStart, dragCurrent } = state.sk;
  const canvas = el.skCanvas;
  const ctx = canvas.getContext("2d");

  // Clear
  ctx.fillStyle = "#0a1f15";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  ctx.strokeStyle = "rgba(52, 211, 153, 0.3)";
  ctx.lineWidth = 1;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * cellSize);
    ctx.lineTo(cols * cellSize, r * cellSize);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cellSize, 0);
    ctx.lineTo(c * cellSize, rows * cellSize);
    ctx.stroke();
  }

  // Draw placed rectangles
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    ctx.fillStyle = SK_COLORS[i % SK_COLORS.length];
    ctx.fillRect(rect.c * cellSize + 1, rect.r * cellSize + 1,
      rect.w * cellSize - 2, rect.h * cellSize - 2);
    ctx.strokeStyle = SK_COLORS[i % SK_COLORS.length].replace("0.35", "0.8");
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.c * cellSize + 1, rect.r * cellSize + 1,
      rect.w * cellSize - 2, rect.h * cellSize - 2);
  }

  // Draw drag preview
  if (dragStart && dragCurrent) {
    const [r1, c1] = dragStart;
    const [r2, c2] = dragCurrent;
    const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
    ctx.fillStyle = "rgba(52, 211, 153, 0.2)";
    ctx.fillRect(minC * cellSize, minR * cellSize,
      (maxC - minC + 1) * cellSize, (maxR - minR + 1) * cellSize);
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(minC * cellSize, minR * cellSize,
      (maxC - minC + 1) * cellSize, (maxR - minR + 1) * cellSize);
    ctx.setLineDash([]);
  }

  // Draw clue numbers
  ctx.font = `bold ${Math.floor(cellSize * 0.5)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#34d399";
  for (const cl of clues) {
    ctx.fillText(
      String(cl.value),
      cl.c * cellSize + cellSize / 2,
      cl.r * cellSize + cellSize / 2
    );
  }
}

async function skCheckSolution() {
  if (!state.sk) return;
  const { rows, cols, rects } = state.sk;

  // Check full coverage
  const totalCells = rects.reduce((sum, r) => sum + r.w * r.h, 0);
  if (totalCells !== rows * cols) {
    el.skBanner.textContent = "Cover all cells first!";
    return;
  }

  const answer = rects
    .map((r) => `${r.r},${r.c},${r.w},${r.h}`)
    .sort()
    .join(";");
  el.answer.value = answer;

  const puzzle = getCurrentPuzzle();
  const response = await api("/api/attempts", {
    method: "POST",
    body: JSON.stringify({
      profileId: state.profile.id,
      puzzle,
      answer,
      hintsUsed: state.hintIndex,
      timeMs: currentAttemptTimeMs()
    })
  });

  if (response.result.isCorrect) {
    el.skBanner.textContent = "PERFECT!";
    const justFinished = state.currentIndex + 1 === state.activeSet.length;
    setTimeout(() => {
      if (justFinished) {
        applyReinforcementMessage(response, "Correct! Set complete. Start another set.");
        state.activeSet = [];
        state.currentIndex = 0;
      } else {
        applyReinforcementMessage(response, "Correct! Moving to next question.");
        state.currentIndex += 1;
      }
      renderPuzzle();
    }, 1200);
  } else {
    el.skBanner.textContent = "Not quite. Check each rectangle has the right area!";
    setTimeout(() => { el.skBanner.textContent = ""; }, 2000);
  }
  await refreshProgress();
}

// ===== End Shikaku =====

// ===== Angle Chase Studio Interactive UI =====

function hideAngleChase() {
  if (!el.acsZone) return;
  el.acsZone.style.display = "none";
  if (el.acsSvg) el.acsSvg.innerHTML = "";
}

function renderAngleChase(puzzle) {
  if (!el.acsZone || !el.acsSvg) return;
  hideAngleChase();
  el.acsZone.style.display = "";

  const diagram = puzzle.data.diagram;
  if (!diagram) return;

  const ns = "http://www.w3.org/2000/svg";
  const svg = el.acsSvg;
  svg.setAttribute("viewBox", `0 0 ${diagram.width} ${diagram.height}`);
  svg.innerHTML = "";

  for (const seg of diagram.segments || []) {
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", seg.a.x);
    line.setAttribute("y1", seg.a.y);
    line.setAttribute("x2", seg.b.x);
    line.setAttribute("y2", seg.b.y);
    line.setAttribute("class", "acs-line");
    svg.appendChild(line);
  }

  // Small dots at each distinct segment endpoint (vertices), for legibility.
  const vertexKeys = new Set();
  for (const seg of diagram.segments || []) {
    for (const p of [seg.a, seg.b]) {
      const key = `${Math.round(p.x)},${Math.round(p.y)}`;
      if (vertexKeys.has(key)) continue;
      vertexKeys.add(key);
    }
  }

  for (const mark of diagram.angleMarks || []) {
    const steps = Math.max(2, Math.min(48, Math.round(Math.abs(mark.value) / 6)));
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = mark.dir1 + (mark.value * i) / steps;
      const rad = (t * Math.PI) / 180;
      const x = mark.vertex.x + mark.radius * Math.cos(rad);
      const y = mark.vertex.y - mark.radius * Math.sin(rad);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const poly = document.createElementNS(ns, "polyline");
    poly.setAttribute("points", pts.join(" "));
    poly.setAttribute(
      "class",
      mark.isTarget ? "acs-arc-target" : mark.isGiven ? "acs-arc-given" : "acs-arc"
    );
    svg.appendChild(poly);

    if (mark.label) {
      const midDeg = mark.dir1 + mark.value / 2;
      const midRad = (midDeg * Math.PI) / 180;
      const labelR = mark.radius + 18;
      const lx = mark.vertex.x + labelR * Math.cos(midRad);
      const ly = mark.vertex.y - labelR * Math.sin(midRad);
      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", lx.toFixed(1));
      text.setAttribute("y", ly.toFixed(1));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute(
        "class",
        `acs-label ${mark.isTarget ? "acs-label-target" : mark.isGiven ? "acs-label-given" : ""}`
      );
      text.textContent = mark.label;
      svg.appendChild(text);
    }
  }

  for (const key of vertexKeys) {
    const [x, y] = key.split(",").map(Number);
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
    dot.setAttribute("r", 3);
    dot.setAttribute("class", "acs-vertex-dot");
    svg.appendChild(dot);
  }

  // Point/vertex letters (A, B, C, D, E, V, ...) that the prompt refers to by
  // name. Drawn last so they sit on top of segments and arcs.
  for (const pl of diagram.pointLabels || []) {
    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", Number(pl.x).toFixed(1));
    text.setAttribute("y", Number(pl.y).toFixed(1));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("class", "acs-point-label");
    text.textContent = pl.label;
    svg.appendChild(text);
  }
}

// ===== End Angle Chase Studio =====

// ===== Counting Lab =====

function hideCountingLab() {
  if (!el.clZone) return;
  el.clZone.style.display = "none";
  if (el.clDiagram) el.clDiagram.innerHTML = "";
}

function clMakeSlot(label, count) {
  const box = document.createElement("div");
  box.className = "cl-slot";
  const num = document.createElement("div");
  num.className = "cl-slot-count";
  num.textContent = String(count);
  const lab = document.createElement("div");
  lab.className = "cl-slot-label";
  lab.textContent = label;
  box.appendChild(num);
  box.appendChild(lab);
  return box;
}

function clMakeOp(symbol) {
  const op = document.createElement("div");
  op.className = "cl-op";
  op.textContent = symbol;
  return op;
}

function clRenderChainRow(slots, divideBy) {
  const row = document.createElement("div");
  row.className = "cl-chain-row";
  (slots || []).forEach((slot, i) => {
    if (i > 0) row.appendChild(clMakeOp("×"));
    row.appendChild(clMakeSlot(slot.label, slot.count));
  });
  if (divideBy) {
    row.appendChild(clMakeOp("÷"));
    row.appendChild(clMakeSlot("remove extra orderings", divideBy));
  }
  return row;
}

function renderCountingLab(puzzle) {
  if (!el.clZone || !el.clDiagram) return;
  hideCountingLab();
  el.clZone.style.display = "";

  const diagram = puzzle.data && puzzle.data.diagram;
  const container = el.clDiagram;
  container.innerHTML = "";
  if (!diagram) return;

  if (diagram.kind === "chain") {
    container.appendChild(clRenderChainRow(diagram.slots, diagram.divideBy));
  } else if (diagram.kind === "cases") {
    const row = document.createElement("div");
    row.className = "cl-cases-row";
    (diagram.cases || []).forEach((caseSpec, ci) => {
      if (ci > 0) row.appendChild(clMakeOp("+"));
      const caseBox = document.createElement("div");
      caseBox.className = "cl-case";
      const caseLabel = document.createElement("div");
      caseLabel.className = "cl-case-label";
      caseLabel.textContent = caseSpec.label;
      caseBox.appendChild(caseLabel);
      caseBox.appendChild(clRenderChainRow(caseSpec.slots));
      row.appendChild(caseBox);
    });
    container.appendChild(row);
  } else if (diagram.kind === "pigeonhole") {
    const row = document.createElement("div");
    row.className = "cl-pigeonhole-row";
    for (let i = 0; i < (diagram.categories || 0); i++) {
      const hole = document.createElement("div");
      hole.className = "cl-hole";
      hole.textContent = `color ${i + 1}`;
      row.appendChild(hole);
    }
    container.appendChild(row);
    const note = document.createElement("div");
    note.className = "cl-pigeonhole-note";
    note.textContent = `Goal: guarantee ${diagram.guaranteeCount} socks of the same color.`;
    container.appendChild(note);
  }
}

// ===== End Counting Lab =====

// ===== Proof Blocks Interactive UI =====

function hideProofBlocks() {
  if (!el.pbZone) return;
  el.pbZone.style.display = "none";
  if (el.pbGoal) el.pbGoal.textContent = "";
  if (el.pbDiagram) el.pbDiagram.style.display = "none";
  if (el.pbSvg) el.pbSvg.innerHTML = "";
  if (el.pbBank) el.pbBank.innerHTML = "";
  if (el.pbProof) el.pbProof.innerHTML = "";
  if (el.pbBanner) el.pbBanner.textContent = "";
  state.pb = null;
}

function pbKindLabel(kind) {
  if (kind === "given") return "Given";
  if (kind === "goal") return "Goal";
  return "Statement";
}

// Deterministic per-puzzle shuffle so the block bank is scrambled for the
// player while the served puzzle data stays a pure function of its structure
// (which lets the server dedup structurally-identical puzzles). Seeded by the
// puzzle seed so re-renders of the same puzzle keep a stable order.
function pbSeededShuffle(arr, seed) {
  const a = arr.slice();
  let s = (Number(seed) ^ 0x9e3779b9) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = (s >>> 8) % (i + 1);
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

// Draw a geometry proof's figure into the Proof Blocks SVG, reusing Angle Chase
// Studio's diagram model (segments + arc angle marks) and its acs- stroke
// classes so the two games render angles the same way.
function pbDrawAngleDiagram(svg, diagram) {
  const ns = "http://www.w3.org/2000/svg";
  svg.setAttribute("viewBox", `0 0 ${diagram.width} ${diagram.height}`);
  svg.innerHTML = "";

  for (const seg of diagram.segments || []) {
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", seg.a.x);
    line.setAttribute("y1", seg.a.y);
    line.setAttribute("x2", seg.b.x);
    line.setAttribute("y2", seg.b.y);
    line.setAttribute("class", "acs-line");
    svg.appendChild(line);
  }

  const vertexKeys = new Set();
  for (const seg of diagram.segments || []) {
    for (const p of [seg.a, seg.b]) {
      vertexKeys.add(`${Math.round(p.x)},${Math.round(p.y)}`);
    }
  }

  for (const mark of diagram.angleMarks || []) {
    const steps = Math.max(2, Math.min(48, Math.round(Math.abs(mark.value) / 6)));
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = mark.dir1 + (mark.value * i) / steps;
      const rad = (t * Math.PI) / 180;
      const x = mark.vertex.x + mark.radius * Math.cos(rad);
      const y = mark.vertex.y - mark.radius * Math.sin(rad);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const poly = document.createElementNS(ns, "polyline");
    poly.setAttribute("points", pts.join(" "));
    poly.setAttribute(
      "class",
      mark.isTarget ? "acs-arc-target" : mark.isGiven ? "acs-arc-given" : "acs-arc"
    );
    svg.appendChild(poly);

    if (mark.label) {
      const midDeg = mark.dir1 + mark.value / 2;
      const midRad = (midDeg * Math.PI) / 180;
      const labelR = mark.radius + 18;
      const lx = mark.vertex.x + labelR * Math.cos(midRad);
      const ly = mark.vertex.y - labelR * Math.sin(midRad);
      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", lx.toFixed(1));
      text.setAttribute("y", ly.toFixed(1));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute(
        "class",
        `acs-label ${mark.isTarget ? "acs-label-target" : mark.isGiven ? "acs-label-given" : ""}`
      );
      text.textContent = mark.label;
      svg.appendChild(text);
    }
  }

  for (const key of vertexKeys) {
    const [x, y] = key.split(",").map(Number);
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
    dot.setAttribute("r", 3);
    dot.setAttribute("class", "acs-vertex-dot");
    svg.appendChild(dot);
  }

  // Named point/vertex letters, if the diagram supplies them (shared with
  // Angle Chase Studio's diagram model).
  for (const pl of diagram.pointLabels || []) {
    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", Number(pl.x).toFixed(1));
    text.setAttribute("y", Number(pl.y).toFixed(1));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("class", "acs-point-label");
    text.textContent = pl.label;
    svg.appendChild(text);
  }
}

function renderProofBlocks(puzzle) {
  if (!el.pbZone) return;
  hideProofBlocks();
  el.pbZone.style.display = "";
  hideGenericInput();

  const data = puzzle.data || {};
  const rawBlocks = Array.isArray(data.blocks) ? data.blocks : [];
  if (rawBlocks.length === 0) return;
  // Scramble presentation order client-side (the served order is canonical).
  const blocks = pbSeededShuffle(rawBlocks, puzzle.seed);

  state.pb = {
    blocks,
    byId: new Map(blocks.map((b) => [b.id, b])),
    order: [], // ids the player has added, in order
    submitted: false
  };

  el.pbGoal.textContent = `Prove: ${data.goalStatement || ""}`;

  // Geometry proofs carry a figure; draw it above the blocks. Other domains
  // omit it.
  if (el.pbDiagram && el.pbSvg) {
    if (data.diagram && Array.isArray(data.diagram.segments)) {
      el.pbDiagram.style.display = "";
      pbDrawAngleDiagram(el.pbSvg, data.diagram);
    } else {
      el.pbDiagram.style.display = "none";
      el.pbSvg.innerHTML = "";
    }
  }

  el.pbCheckBtn.onclick = pbSubmit;
  el.pbClearBtn.onclick = () => {
    if (!state.pb || state.pb.submitted) return;
    state.pb.order = [];
    el.pbBanner.textContent = "";
    pbRender();
  };

  pbRender();
}

function pbMakeChip(block, context) {
  const chip = document.createElement("div");
  chip.className = `pb-chip pb-chip-${block.kind}`;
  const meta = document.createElement("div");
  meta.className = "pb-chip-meta";
  meta.textContent = pbKindLabel(block.kind);
  const stmt = document.createElement("div");
  stmt.className = "pb-chip-statement";
  stmt.textContent = block.statement;
  const reason = document.createElement("div");
  reason.className = "pb-chip-reason";
  reason.textContent = block.kind === "given" ? "(given)" : `because: ${block.reason}`;
  chip.appendChild(meta);
  chip.appendChild(stmt);
  chip.appendChild(reason);
  if (context) chip.appendChild(context);
  return chip;
}

function pbRender() {
  if (!state.pb) return;
  const pb = state.pb;
  const inProof = new Set(pb.order);

  // Bank: blocks not yet placed, in their (shuffled) presentation order.
  el.pbBank.innerHTML = "";
  const bankBlocks = pb.blocks.filter((b) => !inProof.has(b.id));
  if (bankBlocks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "pb-empty";
    empty.textContent = "All blocks placed. Check your proof.";
    el.pbBank.appendChild(empty);
  }
  for (const block of bankBlocks) {
    const chip = pbMakeChip(block, null);
    if (!pb.submitted) {
      chip.classList.add("pb-clickable");
      chip.addEventListener("click", () => {
        if (pb.submitted) return;
        pb.order.push(block.id);
        el.pbBanner.textContent = "";
        pbRender();
      });
    }
    el.pbBank.appendChild(chip);
  }

  // Proof: ordered placed blocks with position numbers + controls.
  el.pbProof.innerHTML = "";
  if (pb.order.length === 0) {
    const empty = document.createElement("div");
    empty.className = "pb-empty";
    empty.textContent = "Tap blocks on the left to build your proof here.";
    el.pbProof.appendChild(empty);
  }
  pb.order.forEach((id, idx) => {
    const block = pb.byId.get(id);
    if (!block) return;
    const controls = document.createElement("div");
    controls.className = "pb-chip-controls";
    const num = document.createElement("span");
    num.className = "pb-step-num";
    num.textContent = String(idx + 1);
    controls.appendChild(num);
    if (!pb.submitted) {
      const up = document.createElement("button");
      up.type = "button";
      up.className = "pb-move";
      up.textContent = "↑";
      up.disabled = idx === 0;
      up.addEventListener("click", (e) => {
        e.stopPropagation();
        [pb.order[idx - 1], pb.order[idx]] = [pb.order[idx], pb.order[idx - 1]];
        pbRender();
      });
      const down = document.createElement("button");
      down.type = "button";
      down.className = "pb-move";
      down.textContent = "↓";
      down.disabled = idx === pb.order.length - 1;
      down.addEventListener("click", (e) => {
        e.stopPropagation();
        [pb.order[idx + 1], pb.order[idx]] = [pb.order[idx], pb.order[idx + 1]];
        pbRender();
      });
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "pb-remove";
      rm.textContent = "×";
      rm.addEventListener("click", (e) => {
        e.stopPropagation();
        pb.order.splice(idx, 1);
        el.pbBanner.textContent = "";
        pbRender();
      });
      controls.appendChild(up);
      controls.appendChild(down);
      controls.appendChild(rm);
    }
    const chip = pbMakeChip(block, controls);
    chip.classList.add("pb-placed");
    el.pbProof.appendChild(chip);
  });
}

async function pbSubmit() {
  if (!state.pb || state.pb.submitted) return;
  if (state.pb.order.length === 0) {
    el.pbBanner.textContent = "Add some blocks to your proof first.";
    return;
  }
  state.pb.submitted = true;
  el.answer.value = JSON.stringify(state.pb.order);

  const puzzle = getCurrentPuzzle();
  const response = await api("/api/attempts", {
    method: "POST",
    body: JSON.stringify({
      profileId: state.profile.id,
      puzzle,
      answer: el.answer.value,
      hintsUsed: state.hintIndex,
      timeMs: currentAttemptTimeMs()
    })
  });

  if (response.result.isCorrect) {
    el.pbBanner.textContent = "Valid proof! Well reasoned.";
    const justFinished = state.currentIndex + 1 === state.activeSet.length;
    setTimeout(() => {
      if (justFinished) {
        applyReinforcementMessage(response, "Correct! Set complete. Start another set.");
        state.activeSet = [];
        state.currentIndex = 0;
      } else {
        applyReinforcementMessage(response, "Correct! Moving to next question.");
        state.currentIndex += 1;
      }
      renderPuzzle();
    }, 1100);
  } else {
    state.pb.submitted = false;
    el.pbBanner.textContent =
      "Not a valid proof yet. Check: no distractor blocks, every step's justification uses only blocks already above it, and you reach the goal.";
  }
  await refreshProgress();
}

// ===== End Proof Blocks =====

async function renderPuzzle() {
  state.puzzle = getCurrentPuzzle();
  state.puzzleStartedAt = state.puzzle ? Date.now() : 0;
  state.hints = [];
  state.hintIndex = 0;
  if (state.puzzle) {
    el.result.textContent = "";
  }
  el.answer.value = "";
  el.choiceButtons.innerHTML = "";
  el.numberLine.innerHTML = "";
  hideFactorNinja();
  
  // Hide active dynamic modules
  for (const key in gameModules) {
    if (gameModules[key] && typeof gameModules[key].hide === "function") {
      gameModules[key].hide(el, state);
    }
  }

  hideXOuts();
  hideNumberPaths();
  hideStoryLogic();
  hideKenKen();
  hideBalance();
  hideShikaku();
  hideAngleChase();
  hideCountingLab();
  hideProofBlocks();
  restoreGenericInput();

  if (!state.puzzle) {
    el.puzzleBox.textContent = "No active puzzle set. Start a new set.";
    el.setProgress.textContent = "";
    el.choiceButtons.innerHTML = "";
    el.numberLine.innerHTML = "";
    applyReasoningPanel(null);
    return;
  }

  // Optional "explain your thinking" panel — visibility driven by the puzzle's
  // advisory data.reasoning flag; applies across all game render branches below.
  applyReasoningPanel(state.puzzle);

  const difficultyText = String(state.puzzle.data?.difficultyLabel || "").trim();
  const label = difficultyText || difficultyLabel(Number(state.puzzle.difficulty || 1));
  el.setProgress.textContent = `Question ${state.currentIndex + 1} of ${state.activeSet.length} • Difficulty: ${label} (${state.puzzle.difficulty})`;

  // Dispatch to custom interactive UIs
  if (state.puzzle.gameTypeId === "factor-ninja") {
    el.puzzleBox.textContent = state.puzzle.prompt.text;
    renderFactorNinja(state.puzzle);
    return;
  }
  if (state.puzzle.gameTypeId === "mismo") {
    el.puzzleBox.textContent = state.puzzle.prompt.text;
    try {
      if (!gameModules["mismo"]) {
        gameModules["mismo"] = (await import("/games/mismo.js")).default;
      }
      gameModules["mismo"].render(state.puzzle, state, el, {
        submitCurrent,
        hideGenericInput,
        restoreGenericInput,
        showNextHint,
        refreshProgress,
        api,
        currentAttemptTimeMs,
        applyReinforcementMessage,
        difficultyLabel,
        renderPuzzle
      });
    } catch (err) {
      console.error("Error loading Mismo:", err);
      el.puzzleBox.textContent = `Error loading Mismo: ${err.message}`;
    }
    return;
  }
  if (state.puzzle.gameTypeId === "x-outs") {
    el.puzzleBox.textContent = state.puzzle.prompt.text;
    renderXOuts(state.puzzle);
    return;
  }
  if (state.puzzle.gameTypeId === "number-paths") {
    el.puzzleBox.textContent = state.puzzle.prompt.text;
    renderNumberPaths(state.puzzle);
    return;
  }
  if (state.puzzle.gameTypeId === "story-logic-grids") {
    el.puzzleBox.textContent = state.puzzle.data?.title || state.puzzle.prompt.text;
    renderStoryLogic(state.puzzle);
    return;
  }
  if (state.puzzle.gameTypeId === "kenken") {
    el.puzzleBox.textContent = state.puzzle.prompt.text;
    renderKenKen(state.puzzle);
    return;
  }
  if (state.puzzle.gameTypeId === "balance-scale") {
    el.puzzleBox.textContent = state.puzzle.prompt.text;
    renderBalance(state.puzzle);
    return;
  }
  if (state.puzzle.gameTypeId === "shikaku") {
    el.puzzleBox.textContent = state.puzzle.prompt.text;
    renderShikaku(state.puzzle);
    return;
  }
  if (state.puzzle.gameTypeId === "angle-chase-studio") {
    el.puzzleBox.textContent = state.puzzle.prompt.text;
    renderAngleChase(state.puzzle);
    updateGenericAnswerControls(state.puzzle);
    renderChoices(state.puzzle);
    renderNumberLine(state.puzzle);
    return;
  }
  if (state.puzzle.gameTypeId === "counting-lab") {
    el.puzzleBox.textContent = state.puzzle.prompt.text;
    renderCountingLab(state.puzzle);
    updateGenericAnswerControls(state.puzzle);
    renderChoices(state.puzzle);
    renderNumberLine(state.puzzle);
    return;
  }
  if (state.puzzle.gameTypeId === "proof-blocks") {
    el.puzzleBox.textContent = state.puzzle.prompt.text;
    renderProofBlocks(state.puzzle);
    return;
  }

  el.puzzleBox.textContent = state.puzzle.prompt.text;
  updateGenericAnswerControls(state.puzzle);
  renderChoices(state.puzzle);
  renderNumberLine(state.puzzle);
}

async function loadGames() {
  const data = await api("/api/games");
  el.gameType.innerHTML = "";
  for (const g of data) {
    const option = document.createElement("option");
    option.value = g.id;
    option.textContent = `${g.name} (G${g.minGrade}-G${g.maxGrade})`;
    el.gameType.appendChild(option);
  }
  updateSetSizeUi();
}

function renderProgressSummary(summary) {
  if (!summary || !summary.overview) {
    el.progress.textContent = "{}";
    return;
  }
  const o = summary.overview;
  const lines = [];
  lines.push("Overview");
  lines.push(`Attempts: ${o.totalAttempts} | Correct: ${o.correctAttempts} | Accuracy: ${Math.round((o.accuracy || 0) * 100)}%`);
  lines.push(`Avg success score: ${Math.round((o.avgSuccessScore || 0) * 100)}% | Best streak: ${o.bestStreak || 0}`);
  lines.push("");

  const bySkill = summary.bySkill || {};
  const topSkills = Object.entries(bySkill)
    .sort((a, b) => (b[1].mastery || 0) - (a[1].mastery || 0))
    .slice(0, 5);
  lines.push("Top Skills");
  if (topSkills.length === 0) {
    lines.push("No skill data yet.");
  } else {
    for (const [skill, s] of topSkills) {
      lines.push(`${skill}: mastery ${Math.round(s.mastery || 0)}% | recent ${Math.round((s.recentAccuracy || 0) * 100)}% | trend ${s.trend}`);
    }
  }
  lines.push("");

  lines.push("Per-Game Levels");
  const byGameLevel = summary.byGameLevel || {};
  const games = Object.keys(byGameLevel).slice(0, 6);
  if (games.length === 0) {
    lines.push("No game-level data yet.");
  } else {
    for (const game of games) {
      const levels = Object.entries(byGameLevel[game] || {})
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .slice(0, 6)
        .map(([lvl, s]) => `L${lvl}:${Math.round(s.mastery || 0)}%`);
      lines.push(`${game} -> ${levels.join("  ")}`);
    }
  }
  lines.push("");

  const highlights = summary.skillHighlights || {};
  lines.push("Highlights");
  lines.push(`Top gains: ${(highlights.topGains || []).join("; ") || "None yet"}`);
  lines.push(`Needs work: ${(highlights.needsWork || []).join("; ") || "None yet"}`);
  lines.push(`Ready to level up: ${(highlights.readyToLevel || []).join(", ") || "None yet"}`);
  lines.push("");

  const rec = summary.recommendations || {};
  lines.push("Recommended Next Focus");
  lines.push(`Focus: ${(rec.focusSkills || []).join(", ") || "Any practice"}`);
  lines.push(`Confidence: ${(rec.confidenceSkills || []).join(", ") || "Build wins"}`);
  lines.push(`Stretch: ${(rec.stretchSkills || []).join(", ") || "Try challenge mode"}`);
  lines.push(`Plan: ${rec.message || ""}`);

  el.progress.textContent = lines.join("\n");
}

async function refreshProgress() {
  if (!state.profile) return;
  const summary = await api(`/api/progress?profileId=${state.profile.id}`);
  state.lastProgress = summary;
  renderProgressSummary(summary);
}

async function submitCurrent() {
  const puzzle = getCurrentPuzzle();
  if (!state.profile || !puzzle) {
    el.result.textContent = "Login and start a puzzle set first.";
    return;
  }

  const response = await api("/api/attempts", {
    method: "POST",
    body: JSON.stringify({
      profileId: state.profile.id,
      puzzle,
      answer: el.answer.value,
      hintsUsed: state.hintIndex,
      timeMs: currentAttemptTimeMs(),
      ...collectReasoning()
    })
  });

  applyExplanationFeedback(response);

  if (response.result.isCorrect) {
    if (puzzle.gameTypeId === "number-bonds-sprint") {
      playNumberBondsWinEffect();
      await new Promise((resolve) => setTimeout(resolve, 650));
    }

    const justFinished = state.currentIndex + 1 === state.activeSet.length;
    if (justFinished) applyReinforcementMessage(response, "Correct! Set complete. Start another set.");
    else applyReinforcementMessage(response, "Correct! Moving to next question.");

    const transitionDelay = puzzle.gameTypeId === "x-outs" ? 250 : 1600;
    setTimeout(() => {
      if (justFinished) {
        state.activeSet = [];
        state.currentIndex = 0;
      } else {
        state.currentIndex += 1;
      }
      renderPuzzle();
    }, transitionDelay);
  } else {
    el.result.textContent = "Not yet. Try again or tap Hint.";
  }

  await refreshProgress();
}

async function showNextHint(target = "result") {
  const puzzle = getCurrentPuzzle();
  if (!puzzle) return;
  if (state.hints.length === 0) {
    const hintData = await api("/api/puzzles/hints", {
      method: "POST",
      body: JSON.stringify({ puzzle })
    });
    state.hints = hintData.hints;
  }
  if (state.hintIndex >= state.hints.length) return;

  const hintText = `Hint ${state.hintIndex + 1}: ${state.hints[state.hintIndex]}`;
  state.hintIndex += 1;

  if (target === "factor" && puzzle.gameTypeId === "factor-ninja" && el.fnHintArea) {
    el.fnHintArea.textContent = hintText;
    return;
  }
  el.result.textContent = hintText;
}

el.loginBtn.addEventListener("click", async () => {
  try {
    const profileData = await api("/api/profiles/login", {
      method: "POST",
      body: JSON.stringify({
        name: el.name.value,
        gradeBand: el.gradeBand.value
      })
    });
    state.profile = profileData.profile;
    el.profileStatus.textContent = `Playing as ${state.profile.displayName} (${state.profile.gradeBand})`;
    await refreshProgress();
  } catch (e) {
    el.profileStatus.textContent = e.message;
  }
});

el.newPuzzleBtn.addEventListener("click", async () => {
  if (!state.profile) {
    el.result.textContent = "Login first.";
    return;
  }
  const data = await api("/api/puzzles/next", {
    method: "POST",
    body: JSON.stringify({
      profileId: state.profile.id,
      gameTypeId: el.gameType.value,
      difficulty: Number(el.difficulty.value || "1"),
      setSize: Number(el.setSize.value || "5")
    })
  });

  state.activeSet = data.puzzleSet.map((x) => x.puzzle);
  state.currentIndex = 0;
  renderPuzzle();
});

el.hintBtn.addEventListener("click", async () => showNextHint("result"));
if (el.fnHintBtn) {
  el.fnHintBtn.addEventListener("click", async () => showNextHint("factor"));
}

el.submitBtn.addEventListener("click", submitCurrent);
el.difficulty.addEventListener("change", updateDifficultyUi);
el.difficulty.addEventListener("input", updateDifficultyUi);
el.gameType.addEventListener("change", updateSetSizeUi);
if (el.difficultyDown) {
  el.difficultyDown.addEventListener("click", () => adjustDifficulty(-1));
}
if (el.difficultyUp) {
  el.difficultyUp.addEventListener("click", () => adjustDifficulty(1));
}

updateDifficultyUi();
loadGames();
renderPuzzle();
