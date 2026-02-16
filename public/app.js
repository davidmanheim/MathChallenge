const state = {
  profile: null,
  puzzle: null,
  hints: [],
  hintIndex: 0
};

const el = {
  name: document.getElementById("name"),
  gradeBand: document.getElementById("gradeBand"),
  loginBtn: document.getElementById("loginBtn"),
  profileStatus: document.getElementById("profileStatus"),
  gameType: document.getElementById("gameType"),
  difficulty: document.getElementById("difficulty"),
  newPuzzleBtn: document.getElementById("newPuzzleBtn"),
  puzzleBox: document.getElementById("puzzleBox"),
  answer: document.getElementById("answer"),
  submitBtn: document.getElementById("submitBtn"),
  hintBtn: document.getElementById("hintBtn"),
  result: document.getElementById("result"),
  progress: document.getElementById("progress")
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "API error");
  return body;
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
      difficulty: Number(el.difficulty.value || "1")
    })
  });
  state.puzzle = data.puzzle;
  state.hintIndex = 0;
  state.hints = [];
  el.puzzleBox.textContent = state.puzzle.prompt.text;
  el.result.textContent = "";
});

el.hintBtn.addEventListener("click", async () => {
  if (!state.puzzle) return;
  if (state.hints.length === 0) {
    const hintData = await api("/api/puzzles/hints", {
      method: "POST",
      body: JSON.stringify({
        puzzle: state.puzzle
      })
    });
    state.hints = hintData.hints;
  }
  if (state.hintIndex < state.hints.length) {
    el.result.textContent = `Hint ${state.hintIndex + 1}: ${state.hints[state.hintIndex]}`;
    state.hintIndex += 1;
  }
});

el.submitBtn.addEventListener("click", async () => {
  if (!state.profile || !state.puzzle) {
    el.result.textContent = "Login and generate a puzzle first.";
    return;
  }
  const response = await api("/api/attempts", {
    method: "POST",
    body: JSON.stringify({
      profileId: state.profile.id,
      puzzle: state.puzzle,
      answer: el.answer.value,
      hintsUsed: state.hintIndex,
      timeMs: 0
    })
  });
  el.result.textContent = response.result.isCorrect ? "Correct!" : "Not yet. Try again.";
  await refreshProgress();
});

loadGames();
