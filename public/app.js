const state = {
  profile: null,
  activeSet: [],
  currentIndex: 0,
  puzzle: null,
  hints: [],
  hintIndex: 0,
  fn: null,
  mismo: null,
  xouts: null
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
  answerRow: document.getElementById("answerRow"),
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
  fnParticles: document.getElementById("fnParticles"),
  // Mismo
  mismoZone: document.getElementById("mismoZone"),
  mismoProgress: document.getElementById("mismoProgress"),
  mismoBoard: document.getElementById("mismoBoard"),
  // X-Outs
  xOutsZone: document.getElementById("xOutsZone"),
  xOutsStatus: document.getElementById("xOutsStatus"),
  xOutsBoard: document.getElementById("xOutsBoard"),
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
  skBanner: document.getElementById("skBanner")
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

// ===== Mismo Interactive UI =====

function hideMismo() {
  if (!el.mismoZone) return;
  el.mismoZone.style.display = "none";
  el.mismoBoard.innerHTML = "";
  el.mismoProgress.textContent = "";
  state.mismo = null;
}

function parseExpectedPairs(raw) {
  const text = String(raw || "").trim();
  if (!text) return new Set();
  const out = new Set();
  for (const chunk of text.split(",").filter(Boolean)) {
    const m = chunk.match(/^(\d+)-(\d+)$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    out.add(a < b ? `${a}-${b}` : `${b}-${a}`);
  }
  return out;
}

function setPairKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function renderMismo(puzzle) {
  if (!el.mismoZone) return;
  hideMismo();
  el.mismoZone.style.display = "";
  hideGenericInput();

  const cards = Array.isArray(puzzle.data.cards) ? puzzle.data.cards : [];
  const expectedPairs = parseExpectedPairs(puzzle.data.expectedPairs);
  state.mismo = {
    selected: null,
    cards,
    expectedPairs,
    solvedPairs: new Set(),
    locked: false
  };
  mismoRefreshProgress();
  el.mismoBoard.innerHTML = "";

  for (const card of cards) {
    const node = document.createElement("button");
    node.className = "mismo-card";
    node.textContent = String(card.expr);
    node.dataset.cardId = String(card.id);
    node.addEventListener("click", () => mismoSelectCard(card.id, node));
    el.mismoBoard.appendChild(node);
  }
}

function mismoRefreshProgress() {
  if (!state.mismo || !el.mismoProgress) return;
  const done = state.mismo.solvedPairs.size;
  const total = state.mismo.expectedPairs.size;
  el.mismoProgress.textContent = `Pairs found: ${done} / ${total}`;
}

function markMismoCard(cardId, className) {
  const node = el.mismoBoard.querySelector(`[data-card-id="${cardId}"]`);
  if (node) node.classList.add(className);
}

async function mismoSelectCard(cardId, node) {
  if (!state.mismo || state.mismo.locked) return;
  const alreadySolved = [...state.mismo.solvedPairs].some((p) => {
    const [a, b] = p.split("-").map(Number);
    return a === cardId || b === cardId;
  });
  if (alreadySolved) return;

  if (state.mismo.selected === null) {
    state.mismo.selected = cardId;
    node.classList.add("selected");
    return;
  }

  if (state.mismo.selected === cardId) {
    state.mismo.selected = null;
    node.classList.remove("selected");
    return;
  }

  const first = state.mismo.selected;
  const firstNode = el.mismoBoard.querySelector(`[data-card-id="${first}"]`);
  const key = setPairKey(first, cardId);
  state.mismo.selected = null;
  if (firstNode) firstNode.classList.remove("selected");

  if (state.mismo.expectedPairs.has(key)) {
    state.mismo.solvedPairs.add(key);
    markMismoCard(first, "matched");
    markMismoCard(cardId, "matched");
    el.result.textContent = "Nice match.";
    mismoRefreshProgress();
  } else {
    if (firstNode) firstNode.classList.add("wrong");
    node.classList.add("wrong");
    setTimeout(() => {
      if (firstNode) firstNode.classList.remove("wrong");
      node.classList.remove("wrong");
    }, 280);
    el.result.textContent = "Those two are not equivalent yet.";
  }

  if (state.mismo.solvedPairs.size === state.mismo.expectedPairs.size) {
    state.mismo.locked = true;
    const answer = JSON.stringify(
      [...state.mismo.solvedPairs].map((p) => p.split("-").map(Number))
    );
    el.answer.value = answer;
    setTimeout(() => submitCurrent(), 300);
  }
}

// ===== End Mismo =====

// ===== X-Outs Interactive UI =====

function hideXOuts() {
  if (!el.xOutsZone) return;
  el.xOutsZone.style.display = "none";
  el.xOutsBoard.innerHTML = "";
  el.xOutsStatus.textContent = "";
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
  setTimeout(() => submitCurrent(), 250);
}

// ===== End X-Outs =====

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
  el.kkGrid.style.gridTemplateColumns = `repeat(${size}, 52px)`;
  el.kkGrid.style.gridTemplateRows = `repeat(${size}, 52px)`;

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
      timeMs: 0
    })
  });

  if (response.result.isCorrect) {
    el.kkBanner.textContent = "SOLVED!";
    // Color all cells green
    for (const cell of el.kkGrid.children) {
      cell.classList.add("kk-correct");
    }
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
  el.bsScale.classList.remove("bs-balanced");
  state.bs = null;
}

function renderBalance(puzzle) {
  if (!el.bsZone) return;
  hideBalance();
  el.bsZone.style.display = "";
  hideGenericInput();

  const data = puzzle.data;
  state.bs = { keypadValue: "" };

  // Display equation
  el.bsEquation.textContent = data.display;

  // Render scale pans
  renderScaleSide(el.bsLeft, data.left);
  renderScaleSide(el.bsRight, data.right);

  // Build keypad
  renderBsKeypad();
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
  display.textContent = "\u00a0";
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

function bsKeyPress(key) {
  if (!state.bs) return;
  const display = document.getElementById("bsDisplay");

  if (key === "clear") {
    state.bs.keypadValue = "";
    display.textContent = "\u00a0";
    return;
  }
  if (key === "del") {
    state.bs.keypadValue = state.bs.keypadValue.slice(0, -1);
    display.textContent = state.bs.keypadValue || "\u00a0";
    return;
  }
  if (key === "neg") {
    if (state.bs.keypadValue.startsWith("-")) {
      state.bs.keypadValue = state.bs.keypadValue.slice(1);
    } else {
      state.bs.keypadValue = "-" + state.bs.keypadValue;
    }
    display.textContent = state.bs.keypadValue || "\u00a0";
    return;
  }
  if (key === "go") {
    if (!state.bs.keypadValue) return;
    bsSubmit();
    return;
  }

  if (state.bs.keypadValue.replace("-", "").length >= 4) return;
  state.bs.keypadValue += key;
  display.textContent = state.bs.keypadValue;
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
      timeMs: 0
    })
  });

  if (response.result.isCorrect) {
    el.bsBanner.textContent = "BALANCED!";
    el.bsScale.classList.add("bs-balanced");

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
    const display = document.getElementById("bsDisplay");
    display.classList.add("bs-wrong");
    setTimeout(() => display.classList.remove("bs-wrong"), 400);
    el.result.textContent = "Not yet. Try again or tap Hint.";
    state.bs.keypadValue = "";
    display.textContent = "\u00a0";
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
  const cellSize = Math.min(52, Math.floor(400 / Math.max(rows, cols)));

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
      timeMs: 0
    })
  });

  if (response.result.isCorrect) {
    el.skBanner.textContent = "PERFECT!";
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
    el.skBanner.textContent = "Not quite. Check each rectangle has the right area!";
    setTimeout(() => { el.skBanner.textContent = ""; }, 2000);
  }
  await refreshProgress();
}

// ===== End Shikaku =====

function renderPuzzle() {
  state.puzzle = getCurrentPuzzle();
  state.hints = [];
  state.hintIndex = 0;
  el.result.textContent = "";
  el.answer.value = "";
  el.choiceButtons.innerHTML = "";
  el.numberLine.innerHTML = "";
  hideFactorNinja();
  hideMismo();
  hideXOuts();
  hideKenKen();
  hideBalance();
  hideShikaku();
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

  // Dispatch to custom interactive UIs
  if (state.puzzle.gameTypeId === "factor-ninja") {
    el.puzzleBox.textContent = state.puzzle.prompt.text;
    renderFactorNinja(state.puzzle);
    return;
  }
  if (state.puzzle.gameTypeId === "mismo") {
    el.puzzleBox.textContent = state.puzzle.prompt.text;
    renderMismo(state.puzzle);
    return;
  }
  if (state.puzzle.gameTypeId === "x-outs") {
    el.puzzleBox.textContent = state.puzzle.prompt.text;
    renderXOuts(state.puzzle);
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
