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

function formatExpressionForDisplay(expr) {
  return String(expr || "")
    .replace(/sqrt\(([^)]+)\)/gi, "√($1)");
}

export default {
  render(puzzle, state, el, helpers) {
    if (!el.mismoZone) return;
    this.hide(el, state);
    el.mismoZone.style.display = "";
    if (helpers.hideGenericInput) {
      helpers.hideGenericInput();
    } else if (el.answerRow) {
      el.answerRow.style.display = "none";
    }

    const cards = Array.isArray(puzzle.data.cards) ? puzzle.data.cards : [];
    const expectedPairs = parseExpectedPairs(puzzle.data.expectedPairs);
    state.mismo = {
      selected: null,
      cards,
      expectedPairs,
      solvedPairs: new Set(),
      locked: false
    };

    const mismoRefreshProgress = () => {
      if (!state.mismo || !el.mismoProgress) return;
      const done = state.mismo.solvedPairs.size;
      const total = state.mismo.expectedPairs.size;
      el.mismoProgress.textContent = `Pairs found: ${done} / ${total}`;
    };

    const markMismoCard = (cardId, className) => {
      const node = el.mismoBoard.querySelector(`[data-card-id="${cardId}"]`);
      if (node) node.classList.add(className);
    };

    const mismoSelectCard = async (cardId, node) => {
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
        setTimeout(() => helpers.submitCurrent(), 300);
      }
    };

    mismoRefreshProgress();
    el.mismoBoard.innerHTML = "";

    for (const card of cards) {
      const node = document.createElement("button");
      node.className = "mismo-card";
      node.textContent = formatExpressionForDisplay(card.expr);
      node.dataset.cardId = String(card.id);
      node.addEventListener("click", () => mismoSelectCard(card.id, node));
      el.mismoBoard.appendChild(node);
    }
  },

  hide(el, state) {
    if (!el.mismoZone) return;
    el.mismoZone.style.display = "none";
    el.mismoBoard.innerHTML = "";
    if (el.mismoProgress) el.mismoProgress.textContent = "";
    if (state) state.mismo = null;
  }
};
