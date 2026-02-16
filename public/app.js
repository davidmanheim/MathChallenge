const state = {
  profile: null,
  activeSet: [],
  currentIndex: 0,
  puzzle: null,
  hints: [],
  hintIndex: 0,
  fn: null // Factor Ninja interactive state
};

const el = {
  name: document.getElementById("name"),
  gradeBand: document.getElementById("gradeBand"),
  loginBtn: document.getElementById("loginBtn"),
  profileStatus: document.getElementById("profileStatus"),
  gameType: document.getElementById("gameType"),
  difficulty: document.getElementById("difficulty"),
  difficultyLabel: document.getElementById("difficultyLabel"),
  setSize: document.getElementById("setSize"),
  setProgress: document.getElementById("setProgress"),
  newPuzzleBtn: document.getElementById("newPuzzleBtn"),
  puzzleBox: document.getElementById("puzzleBox"),
  choiceButtons: document.getElementById("choiceButtons"),
  numberLine: document.getElementById("numberLine"),
  answer: document.getElementById("answer"),
  submitBtn: document.getElementById("submitBtn"),
  hintBtn: document.getElementById("hintBtn"),
  result: document.getElementById("result"),
  progress: document.getElementById("progress"),
  fnZone: document.getElementById("factorNinjaZone"),
  fnStreak: document.getElementById("fnStreak"),
  fnSubLabel: document.getElementById("fnSubLabel"),
  fnArena: document.getElementById("fnArena"),
  fnOrbArea: document.getElementById("fnOrbArea"),
  fnOrb: document.getElementById("fnOrb"),
  fnTray: document.getElementById("fnTray"),
  fnPrimes: document.getElementById("fnPrimes"),
  fnCards: document.getElementById("fnCards"),
  fnKeypad: document.getElementById("fnKeypad"),
  fnHintArea: document.getElementById("fnHintArea"),
  fnBanner: document.getElementById("fnBanner"),
  fnParticles: document.getElementById("fnParticles")
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

function renderNumberLine(puzzle) {
  el.numberLine.innerHTML = "";
  if (!puzzle || puzzle.gameTypeId !== "number-bonds-sprint") return;
  if (!puzzle.data.showNumberLine) return;

  const max = Number(puzzle.data.numberLineMax || 10);
  const known = Number(puzzle.data.known || 0);
  const target = Number(puzzle.data.target || 0);
  const marks = [];

  for (let i = 0; i <= max; i += 1) {
    if (i <= 10 || i === known || i === target || i % 5 === 0) {
      marks.push(i);
    }
  }

  const track = document.createElement("div");
  track.className = "line-track";
  for (const mark of marks) {
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.style.left = `${(mark / max) * 100}%`;

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

// ===== Factor Ninja Interactive UI =====

function hideFactorNinja() {
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

function showFactorNinjaDefault(answer) {
  // Hide the generic text input row when Factor Ninja is active
  el.answer.parentElement.style.display = "none";
}

function restoreGenericInput() {
  el.answer.parentElement.style.display = "";
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
  el.fnHintArea.style.display = "none";
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
  const cardA = makeNumberCard(data.a, data.factorsA || []);
  const cardB = makeNumberCard(data.b, data.factorsB || []);
  el.fnCards.appendChild(cardA);
  el.fnCards.appendChild(cardB);

  // Hint area for LCM
  el.fnHintArea.textContent = "";
  if (subType === "lcm") {
    el.fnHintArea.textContent = `Hint: LCM = (${data.a} \u00d7 ${data.b}) \u00f7 GCF`;
  }

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
      timeMs: 0
    })
  });

  if (response.result.isCorrect) {
    // Victory
    fnShowBanner("CORRECT!");
    fnSpawnParticles(el.fnZone.offsetWidth / 2, el.fnZone.offsetHeight / 2, 20, null);

    const justFinished = state.currentIndex + 1 === state.activeSet.length;
    setTimeout(() => {
      if (justFinished) {
        el.result.textContent = "Correct! Set complete. Start another set.";
        state.activeSet = [];
        state.currentIndex = 0;
      } else {
        el.result.textContent = "Correct! Moving to next question.";
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
  hideFactorNinja();
  el.fnZone.style.display = "";
  showFactorNinjaDefault();
  el.fnStreak.textContent = fnStreakText();

  const subType = puzzle.data.subType;
  if (subType === "prime_factors") {
    renderPrimeFactorsMode(puzzle);
  } else {
    renderKeypadMode(puzzle, subType);
  }
}

// ===== End Factor Ninja =====

function renderPuzzle() {
  state.puzzle = getCurrentPuzzle();
  state.hints = [];
  state.hintIndex = 0;
  el.result.textContent = "";
  el.answer.value = "";
  el.choiceButtons.innerHTML = "";
  el.numberLine.innerHTML = "";
  hideFactorNinja();
  restoreGenericInput();

  if (!state.puzzle) {
    el.puzzleBox.textContent = "No active puzzle set. Start a new set.";
    el.setProgress.textContent = "";
    el.choiceButtons.innerHTML = "";
    el.numberLine.innerHTML = "";
    return;
  }

  const difficultyText = String(state.puzzle.data?.difficultyLabel || "").trim();
  const label = difficultyText || difficultyLabel(Number(state.puzzle.difficulty || 1));
  el.setProgress.textContent = `Question ${state.currentIndex + 1} of ${state.activeSet.length} • Difficulty: ${label} (${state.puzzle.difficulty})`;

  // Dispatch to Factor Ninja interactive UI
  if (state.puzzle.gameTypeId === "factor-ninja") {
    el.puzzleBox.textContent = state.puzzle.prompt.text;
    renderFactorNinja(state.puzzle);
    return;
  }

  el.puzzleBox.textContent = state.puzzle.prompt.text;
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
}

async function refreshProgress() {
  if (!state.profile) return;
  const summary = await api(`/api/progress?profileId=${state.profile.id}`);
  el.progress.textContent = JSON.stringify(summary, null, 2);
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
      timeMs: 0
    })
  });

  if (response.result.isCorrect) {
    const justFinished = state.currentIndex + 1 === state.activeSet.length;
    if (justFinished) {
      el.result.textContent = "Correct! Set complete. Start another set.";
      state.activeSet = [];
      state.currentIndex = 0;
    } else {
      el.result.textContent = "Correct! Moving to next question.";
      state.currentIndex += 1;
    }
    renderPuzzle();
  } else {
    el.result.textContent = "Not yet. Try again or tap Hint.";
  }

  await refreshProgress();
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

el.hintBtn.addEventListener("click", async () => {
  const puzzle = getCurrentPuzzle();
  if (!puzzle) return;
  if (state.hints.length === 0) {
    const hintData = await api("/api/puzzles/hints", {
      method: "POST",
      body: JSON.stringify({ puzzle })
    });
    state.hints = hintData.hints;
  }
  if (state.hintIndex < state.hints.length) {
    el.result.textContent = `Hint ${state.hintIndex + 1}: ${state.hints[state.hintIndex]}`;
    state.hintIndex += 1;
  }
});

el.submitBtn.addEventListener("click", submitCurrent);
el.difficulty.addEventListener("change", updateDifficultyUi);
el.difficulty.addEventListener("input", updateDifficultyUi);

updateDifficultyUi();
loadGames();
renderPuzzle();
