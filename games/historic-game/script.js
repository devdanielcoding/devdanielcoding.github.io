const DECKS = [
  {
    id: "historia-general",
    path: "./data/historia-general.json"
  }
];

const CARDS_PER_PLAYER = 6;

const state = {
  decks: [],
  selectedDeck: null,
  gameMode: "hard",
  playerCount: 2,
  playerNames: ["Jugador 1", "Jugador 2", "Jugador 3"],
  players: [],
  timeline: [],
  drawPile: [],
  discardedPile: [],
  currentPlayerIndex: 0,
  pendingPlacement: null,
  selectedCardId: null,
  started: false
};

const elements = {
  deckView: document.getElementById("deckView"),
  configView: document.getElementById("configView"),
  gameView: document.getElementById("gameView"),
  deckGrid: document.getElementById("deckGrid"),
  setupSummary: document.getElementById("setupSummary"),
  playerNames: document.getElementById("playerNames"),
  startGameButton: document.getElementById("startGameButton"),
  backToDeckButton: document.getElementById("backToDeckButton"),
  restartButton: document.getElementById("restartButton"),
  currentTurnLabel: document.getElementById("currentTurnLabel"),
  scoreboard: document.getElementById("scoreboard"),
  timeline: document.getElementById("timeline"),
  hand: document.getElementById("hand"),
  handTitle: document.getElementById("handTitle"),
  validateButton: document.getElementById("validateButton"),
  message: document.getElementById("message"),
  timelineHint: document.getElementById("timelineHint"),
  winnerModal: document.getElementById("winnerModal"),
  winnerTitle: document.getElementById("winnerTitle"),
  winnerText: document.getElementById("winnerText"),
  winnerDeckButton: document.getElementById("winnerDeckButton"),
  winnerRestartButton: document.getElementById("winnerRestartButton")
};

const showView = (viewName) => {
  [elements.deckView, elements.configView, elements.gameView].forEach((view) => {
    view.classList.remove("view-active");
  });
  elements[viewName].classList.add("view-active");
};

const shuffle = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const setMessage = (text, type = "") => {
  elements.message.textContent = text;
  elements.message.className = `message ${type}`.trim();
};

const hideWinnerModal = () => {
  elements.winnerModal.hidden = true;
};

const showWinnerModal = (player) => {
  state.started = false;
  elements.validateButton.disabled = true;
  elements.winnerTitle.textContent = `${player.name} gano`;
  elements.winnerText.textContent = `${player.name} se quedo sin cartas y gano la partida.`;
  elements.winnerModal.hidden = false;
  elements.winnerRestartButton.focus();
};

const loadDecks = async () => {
  const loadedDecks = await Promise.all(
    DECKS.map(async (deck) => {
      const response = await fetch(deck.path);
      if (!response.ok) {
        throw new Error(`No se pudo cargar ${deck.path}`);
      }
      return response.json();
    })
  );
  state.decks = loadedDecks;
  renderDecks();
};

const renderDecks = () => {
  elements.deckGrid.innerHTML = "";

  state.decks.forEach((deck) => {
    const button = document.createElement("button");
    button.className = "deck-card";
    button.type = "button";
    button.innerHTML = `
      <div>
        <h3>${deck.title}</h3>
        <p>${deck.description}</p>
      </div>
      <div>
        <div class="deck-meta">
          <span class="chip">${deck.events.length} eventos</span>
          <span class="chip">2 o 3 jugadores</span>
          <span class="chip">${CARDS_PER_PLAYER} cartas por jugador</span>
        </div>
        <span class="primary-button">Elegir mazo</span>
      </div>
    `;
    button.addEventListener("click", () => {
      state.selectedDeck = deck;
      updateSetupSummary();
      showView("configView");
    });
    elements.deckGrid.appendChild(button);
  });
};

const updateSetupSummary = () => {
  if (!state.selectedDeck) return;
  const neededCards = state.playerCount * CARDS_PER_PLAYER + 1;
  const spareCards = state.selectedDeck.events.length - neededCards;
  const modeLabel = state.gameMode === "hard" ? "dificil" : "facil";
  elements.setupSummary.textContent = `${state.selectedDeck.title}: modo ${modeLabel}. Se usaran ${neededCards} cartas al inicio (${state.playerCount} jugadores x ${CARDS_PER_PLAYER} cartas + 1 carta inicial). Quedaran ${Math.max(spareCards, 0)} cartas en el mazo para penalizaciones.`;
  elements.startGameButton.disabled = spareCards < 0;
};

const renderPlayerNameInputs = () => {
  elements.playerNames.innerHTML = "";

  for (let index = 0; index < state.playerCount; index += 1) {
    const wrapper = document.createElement("div");
    wrapper.className = "player-name-field";

    const label = document.createElement("label");
    label.setAttribute("for", `playerName${index + 1}`);
    label.textContent = `Jugador ${index + 1}`;

    const input = document.createElement("input");
    input.type = "text";
    input.id = `playerName${index + 1}`;
    input.value = state.playerNames[index] || `Jugador ${index + 1}`;
    input.placeholder = `Nombre del jugador ${index + 1}`;
    input.maxLength = 24;
    input.addEventListener("input", (event) => {
      state.playerNames[index] = event.target.value;
    });

    wrapper.append(label, input);
    elements.playerNames.appendChild(wrapper);
  }
};

const getPlayerName = (index) => {
  const name = (state.playerNames[index] || "").trim();
  return name || `Jugador ${index + 1}`;
};

const createCardElement = (event, options = {}) => {
  const card = document.createElement("article");
  card.className = `event-card ${options.className || ""}`.trim();
  card.dataset.cardId = event.id;
  card.innerHTML = `
    <div class="event-title">${event.title}</div>
    ${options.showYear ? `<div class="event-year">${event.year}</div>` : ""}
  `;
  return card;
};

const startGame = () => {
  if (!state.selectedDeck) return;

  const shuffledEvents = shuffle(state.selectedDeck.events);
  const initialCard = shuffledEvents.shift();
  const turnOrder = shuffle(
    Array.from({ length: state.playerCount }, (_, index) => ({
      id: `player-${index + 1}`,
      name: getPlayerName(index),
      hand: []
    }))
  );

  turnOrder.forEach((player) => {
    player.hand = shuffledEvents.splice(0, CARDS_PER_PLAYER);
  });

  state.players = turnOrder;
  state.timeline = [initialCard].sort((a, b) => a.year - b.year);
  state.drawPile = shuffledEvents;
  state.discardedPile = [];
  state.currentPlayerIndex = 0;
  state.pendingPlacement = null;
  state.selectedCardId = null;
  state.started = true;
  hideWinnerModal();

  showView("gameView");
  setMessage(`Orden sorteado: ${state.players.map((player) => player.name).join(", ")}. Empieza ${state.players[0].name}.`);
  renderGame();
};

const getCurrentPlayer = () => state.players[state.currentPlayerIndex];

const renderScoreboard = () => {
  elements.scoreboard.innerHTML = "";
  state.players.forEach((player, index) => {
    const score = document.createElement("div");
    score.className = `player-score ${index === state.currentPlayerIndex ? "active" : ""}`.trim();
    score.innerHTML = `
      <span>${index === state.currentPlayerIndex ? "En turno" : "Esperando"}</span>
      <strong>${player.name}</strong>
      <p>${player.hand.length} cartas restantes</p>
    `;
    elements.scoreboard.appendChild(score);
  });

  const deckStatus = document.createElement("div");
  deckStatus.className = "player-score";
  deckStatus.innerHTML = `
    <span>Mazo</span>
    <strong>${state.drawPile.length}</strong>
    <p>cartas de penalizacion</p>
  `;
  elements.scoreboard.appendChild(deckStatus);

  const modeStatus = document.createElement("div");
  modeStatus.className = "player-score";
  modeStatus.innerHTML = `
    <span>${state.gameMode === "hard" ? "Modo dificil" : "Modo facil"}</span>
    <strong>${state.discardedPile.length}</strong>
    <p>cartas descartadas</p>
  `;
  elements.scoreboard.appendChild(modeStatus);
};

const clearSlotState = () => {
  document.querySelectorAll(".slot").forEach((slot) => {
    slot.classList.remove("drag-over", "pending");
  });
};

const placePendingCard = (cardId, slotIndex) => {
  if (!state.started) return;

  state.pendingPlacement = { cardId, slotIndex };
  clearSlotState();
  const slot = elements.timeline.querySelector(`[data-slot-index="${slotIndex}"]`);
  slot?.classList.add("pending");
  elements.validateButton.disabled = false;
  const card = getCurrentPlayer().hand.find((item) => item.id === cardId);
  elements.timelineHint.textContent = `${card.title} se validara en la posicion seleccionada.`;
};

const renderTimeline = () => {
  elements.timeline.innerHTML = "";

  for (let index = 0; index <= state.timeline.length; index += 1) {
    const slot = document.createElement("button");
    slot.className = "slot";
    slot.type = "button";
    slot.textContent = "+";
    slot.dataset.slotIndex = String(index);
    slot.addEventListener("dragover", (event) => {
      event.preventDefault();
      slot.classList.add("drag-over");
    });
    slot.addEventListener("dragleave", () => {
      slot.classList.remove("drag-over");
    });
    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      const cardId = event.dataTransfer.getData("text/plain") || state.selectedCardId;
      if (cardId) placePendingCard(cardId, index);
    });
    slot.addEventListener("click", () => {
      if (state.selectedCardId) placePendingCard(state.selectedCardId, index);
    });
    elements.timeline.appendChild(slot);

    if (state.timeline[index]) {
      elements.timeline.appendChild(createCardElement(state.timeline[index], { showYear: true }));
    }
  }
};

const renderHand = () => {
  const currentPlayer = getCurrentPlayer();
  elements.hand.innerHTML = "";
  elements.handTitle.textContent = `Cartas de ${currentPlayer.name}`;

  currentPlayer.hand.forEach((event) => {
    const card = createCardElement(event, { className: "hand-card", showYear: false });
    card.draggable = true;
    if (event.id === state.selectedCardId) {
      card.classList.add("selected");
    }
    card.addEventListener("dragstart", (dragEvent) => {
      state.selectedCardId = event.id;
      dragEvent.dataTransfer.setData("text/plain", event.id);
    });
    card.addEventListener("click", () => {
      state.selectedCardId = state.selectedCardId === event.id ? null : event.id;
      state.pendingPlacement = null;
      elements.validateButton.disabled = true;
      renderGame();
    });
    elements.hand.appendChild(card);
  });
};

const renderGame = () => {
  const currentPlayer = getCurrentPlayer();
  elements.currentTurnLabel.textContent = currentPlayer.name;
  elements.timelineHint.textContent = state.pendingPlacement
    ? elements.timelineHint.textContent
    : "Arrastra una carta o seleccionala y elige una posicion.";
  elements.validateButton.disabled = !state.pendingPlacement;
  renderScoreboard();
  renderTimeline();
  renderHand();
};

const isPlacementCorrect = (card, slotIndex) => {
  const leftCard = state.timeline[slotIndex - 1];
  const rightCard = state.timeline[slotIndex];
  const afterLeft = !leftCard || card.year >= leftCard.year;
  const beforeRight = !rightCard || card.year <= rightCard.year;
  return afterLeft && beforeRight;
};

const getCorrectInsertIndex = (card) => {
  const index = state.timeline.findIndex((timelineCard) => card.year <= timelineCard.year);
  return index === -1 ? state.timeline.length : index;
};

const finishTurn = () => {
  const currentPlayer = getCurrentPlayer();
  if (currentPlayer.hand.length === 0) {
    state.started = false;
    setMessage(`${currentPlayer.name} se quedo sin cartas. Partida terminada.`, "success");
    elements.validateButton.disabled = true;
    return currentPlayer;
  }

  const activePlayers = state.players.filter((player) => player.hand.length > 0);
  if (activePlayers.length === 0) {
    state.started = false;
    setMessage("Partida terminada. Todas las cartas fueron ubicadas en la linea de tiempo.", "success");
    elements.validateButton.disabled = true;
    return currentPlayer;
  }

  let guard = 0;
  do {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    guard += 1;
  } while (getCurrentPlayer().hand.length === 0 && guard <= state.players.length);

  return null;
};

const validatePlacement = () => {
  if (!state.started || !state.pendingPlacement) return;

  const currentPlayer = getCurrentPlayer();
  const cardIndex = currentPlayer.hand.findIndex((card) => card.id === state.pendingPlacement.cardId);
  if (cardIndex === -1) return;

  const card = currentPlayer.hand[cardIndex];
  const correct = isPlacementCorrect(card, state.pendingPlacement.slotIndex);

  if (correct) {
    state.timeline.splice(state.pendingPlacement.slotIndex, 0, card);
    currentPlayer.hand.splice(cardIndex, 1);
    setMessage(`Correcto: ${card.title} fue en ${card.year}.`, "success");
  } else {
    const drawnCard = state.drawPile.shift();
    currentPlayer.hand.splice(cardIndex, 1);

    if (state.gameMode === "hard") {
      const correctIndex = getCorrectInsertIndex(card);
      state.timeline.splice(correctIndex, 0, card);
    } else {
      state.discardedPile.push(card);
    }

    if (drawnCard) {
      currentPlayer.hand.push(drawnCard);
      const resultText = state.gameMode === "hard"
        ? "Se agrego a la linea"
        : "Se envio al descarte";
      setMessage(`Incorrecto: ${card.title} era de ${card.year}. ${resultText} y ${currentPlayer.name} robo una carta del mazo.`, "error");
    } else {
      const resultText = state.gameMode === "hard"
        ? "Se agrego a la linea"
        : "Se envio al descarte";
      setMessage(`Incorrecto: ${card.title} era de ${card.year}. ${resultText}, pero ya no quedan cartas en el mazo.`, "error");
    }
  }

  state.pendingPlacement = null;
  state.selectedCardId = null;
  const winner = finishTurn();
  renderGame();
  if (winner) {
    showWinnerModal(winner);
  }
};

document.querySelectorAll("input[name='players']").forEach((input) => {
  input.addEventListener("change", (event) => {
    state.playerCount = Number(event.target.value);
    renderPlayerNameInputs();
    updateSetupSummary();
  });
});

document.querySelectorAll("input[name='gameMode']").forEach((input) => {
  input.addEventListener("change", (event) => {
    state.gameMode = event.target.value;
    updateSetupSummary();
  });
});

elements.startGameButton.addEventListener("click", startGame);
elements.backToDeckButton.addEventListener("click", () => showView("deckView"));
elements.validateButton.addEventListener("click", validatePlacement);
const resetToDeck = () => {
  state.selectedDeck = null;
  state.players = [];
  state.timeline = [];
  state.drawPile = [];
  state.discardedPile = [];
  state.pendingPlacement = null;
  state.selectedCardId = null;
  setMessage("");
  hideWinnerModal();
  showView("deckView");
};

elements.restartButton.addEventListener("click", resetToDeck);
elements.winnerDeckButton.addEventListener("click", resetToDeck);
elements.winnerRestartButton.addEventListener("click", startGame);

loadDecks().catch((error) => {
  elements.deckGrid.innerHTML = `<div class="message error">${error.message}</div>`;
});

renderPlayerNameInputs();
