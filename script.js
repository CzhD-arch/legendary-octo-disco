const MODEL_NAMES = [
  "GPT-4o",
  "GPT-4.1",
  "GPT-4.5",
  "GPT-4 Turbo",
  "o1",
  "o3-mini",
  "o4-mini",
  "GPT-3.5 Turbo"
];

const CHAT_OPENERS = [
  "I suspect patterns in tonight's voting behavior.",
  "Let's stay rational and use evidence.",
  "Anyone else seeing contradictions?",
  "I logged every statement. Who changed their story?",
  "Staying calm. We can solve this.",
  "I'll share my confidence score after this round."
];

const CHAT_REACTS = [
  "That reads suspiciously confident.",
  "Could be a frame-up. Need more signal.",
  "Strong claim, weak evidence.",
  "I agree with that vector.",
  "Noted. Updating my suspicion weights.",
  "Let's avoid random elimination."
];

const ui = {
  startBtn: document.getElementById("startBtn"),
  nextBtn: document.getElementById("nextBtn"),
  soundToggle: document.getElementById("soundToggle"),
  volume: document.getElementById("volume"),
  players: document.getElementById("players"),
  chatLog: document.getElementById("chatLog"),
  eventLog: document.getElementById("eventLog")
};

let gameState = null;
let audioCtx = null;

function createPlayers() {
  const picks = [...MODEL_NAMES].sort(() => Math.random() - 0.5).slice(0, 6);
  const mafiaIndex = Math.floor(Math.random() * picks.length);
  return picks.map((name, index) => ({
    name,
    alive: true,
    role: index === mafiaIndex ? "Mafia" : "Citizen"
  }));
}

function appendLog(target, text, className = "") {
  const p = document.createElement("p");
  p.textContent = text;
  if (className) {
    p.classList.add(className);
  }
  target.prepend(p);
}

function alivePlayers() {
  return gameState.players.filter((p) => p.alive);
}

function updatePlayersUI(reveal = false) {
  ui.players.innerHTML = "";
  gameState.players.forEach((player) => {
    const li = document.createElement("li");
    li.className = `player ${player.alive ? "" : "dead"}`;

    const left = document.createElement("strong");
    left.textContent = player.name;

    const right = document.createElement("span");
    right.className = "role-tag";
    right.textContent = reveal || !player.alive ? player.role : "Unknown role";

    li.append(left, right);
    ui.players.appendChild(li);
  });
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAlive(except = null) {
  const alive = alivePlayers().filter((p) => p.name !== except);
  if (alive.length === 0) {
    return null;
  }
  return randomFrom(alive);
}

function postChatLine() {
  const speaker = randomAlive();
  if (!speaker) {
    return;
  }

  const target = randomAlive(speaker.name);
  const style = Math.random() > 0.5 ? CHAT_OPENERS : CHAT_REACTS;
  const core = randomFrom(style);
  const line = target
    ? `${speaker.name}: ${core} (${target.name}, thoughts?)`
    : `${speaker.name}: ${core}`;

  appendLog(ui.chatLog, line, "note");
}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
}

function playTone(freq, duration = 0.2, type = "sine", gainBase = 0.07) {
  if (!ui.soundToggle.checked) {
    return;
  }

  ensureAudio();
  const gainLevel = (Number(ui.volume.value) / 100) * gainBase;

  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;

  gain.gain.setValueAtTime(gainLevel, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

function playCue(kind) {
  if (kind === "start") {
    playTone(392, 0.12, "square", 0.06);
    setTimeout(() => playTone(523, 0.16, "triangle", 0.07), 110);
    return;
  }

  if (kind === "day") {
    playTone(660, 0.09, "triangle", 0.06);
    setTimeout(() => playTone(740, 0.09, "triangle", 0.06), 80);
    return;
  }

  if (kind === "night") {
    playTone(220, 0.2, "sawtooth", 0.08);
    return;
  }

  if (kind === "eliminate") {
    playTone(180, 0.25, "square", 0.08);
    return;
  }

  if (kind === "win") {
    playTone(523, 0.12, "triangle", 0.08);
    setTimeout(() => playTone(659, 0.14, "triangle", 0.08), 120);
    setTimeout(() => playTone(784, 0.16, "triangle", 0.08), 240);
  }
}

function checkWinner() {
  const alive = alivePlayers();
  const mafiaAlive = alive.filter((p) => p.role === "Mafia").length;
  const citizensAlive = alive.length - mafiaAlive;

  if (mafiaAlive === 0) {
    appendLog(ui.eventLog, "Citizens win! Mafia was discovered.", "good");
    updatePlayersUI(true);
    gameState.phase = "ended";
    ui.nextBtn.disabled = true;
    playCue("win");
    return true;
  }

  if (mafiaAlive >= citizensAlive) {
    appendLog(ui.eventLog, "Mafia wins! They controlled the vote.", "bad");
    updatePlayersUI(true);
    gameState.phase = "ended";
    ui.nextBtn.disabled = true;
    playCue("eliminate");
    return true;
  }

  return false;
}

function runDayPhase() {
  gameState.round += 1;
  appendLog(ui.eventLog, `Round ${gameState.round}: Day discussion starts.`, "note");
  postChatLine();
  postChatLine();
  postChatLine();

  const suspect = randomAlive();
  if (!suspect) {
    return;
  }

  suspect.alive = false;
  appendLog(
    ui.eventLog,
    `${suspect.name} was voted out by consensus. Role: ${suspect.role}.`,
    suspect.role === "Mafia" ? "good" : "bad"
  );

  updatePlayersUI(false);
  playCue("day");
}

function runNightPhase() {
  appendLog(ui.eventLog, `Round ${gameState.round}: Night falls.`, "note");
  const mafia = alivePlayers().find((p) => p.role === "Mafia");
  const target = randomAlive(mafia?.name);

  if (mafia && target) {
    target.alive = false;
    appendLog(ui.eventLog, `${target.name} was eliminated overnight.`, "bad");
    playCue("night");
  } else {
    appendLog(ui.eventLog, "No overnight elimination occurred.", "note");
  }

  updatePlayersUI(false);
}

function nextRound() {
  if (!gameState || gameState.phase === "ended") {
    return;
  }

  runDayPhase();
  if (checkWinner()) {
    return;
  }

  runNightPhase();
  checkWinner();
}

function resetLogs() {
  ui.chatLog.innerHTML = "";
  ui.eventLog.innerHTML = "";
  appendLog(ui.chatLog, "Model chat will appear here.", "note");
  appendLog(ui.eventLog, "Game events will appear here.", "note");
}

function startGame() {
  gameState = {
    players: createPlayers(),
    round: 0,
    phase: "playing"
  };

  resetLogs();
  updatePlayersUI(false);
  appendLog(ui.eventLog, "New game initialized. Roles assigned.", "good");
  postChatLine();
  postChatLine();

  ui.nextBtn.disabled = false;
  playCue("start");
}

ui.startBtn.addEventListener("click", startGame);
ui.nextBtn.addEventListener("click", nextRound);
ui.soundToggle.addEventListener("change", () => {
  appendLog(ui.eventLog, ui.soundToggle.checked ? "Sound enabled." : "Sound muted.", "note");
});

resetLogs();
