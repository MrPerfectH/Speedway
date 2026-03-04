const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const menuPanel = document.getElementById("menuPanel");
const hudPanel = document.getElementById("hudPanel");

const playersTemplate = [
  { id: 1, key: "Space", label: "Space", color: "#ff4d4d" },
  { id: 2, key: "Enter", label: "Enter", color: "#59a4ff" },
  { id: 3, key: "ShiftLeft", label: "Left Shift", color: "#ffd93d" },
  { id: 4, key: "ControlLeft", label: "Left Ctrl", color: "#5ee173" },
];

const speeds = {
  Slow: 180,
  Medium: 230,
  Fast: 280,
};

const state = {
  phase: "title",
  playerCount: 2,
  speedChoice: "Medium",
  targetLaps: 3,
  players: [],
  winnerText: "",
  countdown: 3,
  raceStartAt: 0,
  lastTime: 0,
  cameraShake: 0,
};

const track = {
  cx: canvas.width / 2,
  cy: canvas.height / 2,
  outerRx: 430,
  outerRy: 250,
  innerRx: 280,
  innerRy: 120,
};
track.midRx = (track.outerRx + track.innerRx) / 2;
track.midRy = (track.outerRy + track.innerRy) / 2;

function renderMenu() {
  if (state.phase === "title") {
    menuPanel.innerHTML = `
      <div class="row">
        <label>Players:
          <select id="playerCount">
            ${[1,2,3,4].map(n => `<option value="${n}" ${n===state.playerCount?"selected":""}>${n}</option>`).join("")}
          </select>
        </label>
        <button id="toSetup">Next: Speed Setup</button>
      </div>
      <div class="tip">Each player uses one key: Space, Enter, Left Shift, Left Ctrl.</div>
    `;
    document.getElementById("toSetup").onclick = () => {
      state.playerCount = Number(document.getElementById("playerCount").value);
      state.phase = "setup";
      renderMenu();
    };
  } else if (state.phase === "setup") {
    menuPanel.innerHTML = `
      <div class="row">
        <label>Speed:
          <select id="speedChoice">
            ${Object.keys(speeds).map(s => `<option value="${s}" ${s===state.speedChoice?"selected":""}>${s}</option>`).join("")}
          </select>
        </label>
        <label>Target Laps:
          <select id="targetLaps">
            ${[1,2,3,4,5].map(n => `<option value="${n}" ${n===state.targetLaps?"selected":""}>${n}</option>`).join("")}
          </select>
        </label>
        <button id="toReady">Ready Screen</button>
      </div>
    `;
    document.getElementById("toReady").onclick = () => {
      state.speedChoice = document.getElementById("speedChoice").value;
      state.targetLaps = Number(document.getElementById("targetLaps").value);
      setupPlayers();
      state.phase = "ready";
      state.countdown = 3;
      state.raceStartAt = performance.now();
      renderMenu();
    };
  } else if (state.phase === "ready") {
    menuPanel.innerHTML = `
      <strong>Get Ready!</strong> Countdown starts automatically.<br>
      Keys: ${state.players.map(p => `<span style="color:${p.color}">P${p.id}: ${p.label}</span>`).join(" | ")}
    `;
  } else if (state.phase === "gameplay") {
    menuPanel.innerHTML = `
      <strong>Race in progress</strong> — Hold your key to turn left. Release to drift outward.
    `;
  } else if (state.phase === "winner") {
    menuPanel.innerHTML = `
      <strong>${state.winnerText}</strong>
      <div class="row" style="margin-top:0.5rem;">
        <button id="newRace">New Race</button>
      </div>
    `;
    document.getElementById("newRace").onclick = () => {
      state.phase = "title";
      renderMenu();
    };
  }
}

function setupPlayers() {
  const starts = [
    { a: -Math.PI / 2, heading: Math.PI },
    { a: 0, heading: -Math.PI / 2 },
    { a: Math.PI / 2, heading: 0 },
    { a: Math.PI, heading: Math.PI / 2 },
  ];

  state.players = playersTemplate.slice(0, state.playerCount).map((base, idx) => {
    const s = starts[idx];
    const x = track.cx + Math.cos(s.a) * track.midRx;
    const y = track.cy + Math.sin(s.a) * track.midRy;
    const a0 = ellipseAngle(x, y);
    return {
      ...base,
      x,
      y,
      heading: s.heading,
      speed: speeds[state.speedChoice],
      turnRate: 2.85,
      keyDown: false,
      out: false,
      laps: 0,
      cumulativeAngle: 0,
      lastAngle: a0,
      wobble: 0,
    };
  });
}

function ellipseAngle(x, y) {
  return Math.atan2((y - track.cy) / track.midRy, (x - track.cx) / track.midRx);
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function update(dt) {
  if (state.phase === "ready") {
    const elapsed = (performance.now() - state.raceStartAt) / 1000;
    state.countdown = Math.max(0, 3 - elapsed);
    if (elapsed >= 3) {
      state.phase = "gameplay";
      renderMenu();
    }
    return;
  }
  if (state.phase !== "gameplay") return;

  const active = state.players.filter((p) => !p.out);
  for (const p of active) {
    if (p.keyDown) p.heading -= p.turnRate * dt;

    p.x += Math.cos(p.heading) * p.speed * dt;
    p.y += Math.sin(p.heading) * p.speed * dt;
    p.wobble = p.keyDown ? 0.35 : -0.12;

    const dx = p.x - track.cx;
    const dy = p.y - track.cy;
    const dOuter = (dx * dx) / (track.outerRx * track.outerRx) + (dy * dy) / (track.outerRy * track.outerRy);
    const dInner = (dx * dx) / (track.innerRx * track.innerRx) + (dy * dy) / (track.innerRy * track.innerRy);

    if (dOuter > 1 || dInner < 1) {
      eliminate(p, "Wall collision");
      continue;
    }

    const ang = ellipseAngle(p.x, p.y);
    const delta = normalizeAngle(ang - p.lastAngle);
    p.lastAngle = ang;
    p.cumulativeAngle += delta;

    while (p.cumulativeAngle <= -Math.PI * 2) {
      p.cumulativeAngle += Math.PI * 2;
      p.laps += 1;
      if (p.laps >= state.targetLaps) {
        state.winnerText = `🏆 Player ${p.id} wins by reaching ${state.targetLaps} laps!`;
        state.phase = "winner";
        renderMenu();
        return;
      }
    }
  }

  for (let i = 0; i < state.players.length; i++) {
    for (let j = i + 1; j < state.players.length; j++) {
      const a = state.players[i];
      const b = state.players[j];
      if (a.out || b.out) continue;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < 20) {
        eliminate(a, "Bike collision");
        eliminate(b, "Bike collision");
      }
    }
  }

  const remaining = state.players.filter((p) => !p.out);
  if (remaining.length === 1) {
    state.winnerText = `🏆 Player ${remaining[0].id} wins by survival!`;
    state.phase = "winner";
    renderMenu();
  } else if (remaining.length === 0) {
    state.winnerText = "💥 All riders eliminated. Draw!";
    state.phase = "winner";
    renderMenu();
  }
}

function eliminate(player, reason) {
  if (player.out) return;
  player.out = true;
  player.reason = reason;
  state.cameraShake = 9;
}

function drawTrack() {
  ctx.fillStyle = "#5c4630";
  ellipse(track.cx, track.cy, track.outerRx, track.outerRy, true);
  ctx.fillStyle = "#252525";
  ellipse(track.cx, track.cy, track.innerRx, track.innerRy, true);

  ctx.strokeStyle = "#c4cedb";
  ctx.lineWidth = 3;
  ellipse(track.cx, track.cy, track.outerRx, track.outerRy, false);
  ctx.strokeStyle = "#7f1d1d";
  ellipse(track.cx, track.cy, track.innerRx, track.innerRy, false);

  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "#f5f5f5";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(track.cx, track.cy - track.outerRy);
  ctx.lineTo(track.cx, track.cy - track.innerRy);
  ctx.stroke();
  ctx.setLineDash([]);
}

function ellipse(x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  fill ? ctx.fill() : ctx.stroke();
}

function drawPlayers() {
  for (const p of state.players) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.heading + p.wobble);
    ctx.globalAlpha = p.out ? 0.35 : 1;

    ctx.fillStyle = p.color;
    ctx.fillRect(-12, -6, 24, 12);
    ctx.fillStyle = "#101010";
    ctx.fillRect(6, -3, 8, 6);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText(String(p.id), -3, 3);
    ctx.restore();
  }
}

function drawOverlay() {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  if (state.phase === "title") {
    ctx.font = "bold 46px sans-serif";
    ctx.fillText("SPEEDWAY", canvas.width / 2, 140);
    ctx.font = "24px sans-serif";
    ctx.fillText("One key per rider. Hold key to turn left.", canvas.width / 2, 185);
  }

  if (state.phase === "ready") {
    ctx.font = "bold 64px sans-serif";
    const val = Math.ceil(state.countdown);
    ctx.fillText(val > 0 ? String(val) : "GO!", canvas.width / 2, canvas.height / 2);
  }

  if (state.phase === "winner") {
    ctx.font = "bold 40px sans-serif";
    ctx.fillText("RACE FINISHED", canvas.width / 2, 150);
    ctx.font = "28px sans-serif";
    ctx.fillText(state.winnerText, canvas.width / 2, 200);
  }
}

function renderHud() {
  if (!state.players.length) {
    hudPanel.innerHTML = "<em>Select player count to start.</em>";
    return;
  }

  const cards = state.players
    .map(
      (p) => `
      <article class="player-card ${p.out ? "out" : ""}" style="border-left-color:${p.color}">
        <strong>Player ${p.id}</strong><br>
        Key: ${p.label}<br>
        Laps: ${p.laps}/${state.targetLaps}<br>
        Status: ${p.out ? "Eliminated" : "Racing"}
      </article>
    `
    )
    .join("");

  hudPanel.innerHTML = `<div class="hud-grid">${cards}</div><div class="tip">Speed: ${state.speedChoice} (${speeds[state.speedChoice]} px/s). Goal: first to ${state.targetLaps} laps or last rider standing.</div>`;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state.cameraShake > 0) {
    state.cameraShake -= 0.8;
    const dx = (Math.random() - 0.5) * state.cameraShake;
    const dy = (Math.random() - 0.5) * state.cameraShake;
    ctx.save();
    ctx.translate(dx, dy);
    drawTrack();
    drawPlayers();
    ctx.restore();
  } else {
    drawTrack();
    drawPlayers();
  }

  if (state.phase !== "gameplay") drawOverlay();
}

function loop(t) {
  const dt = Math.min((t - state.lastTime) / 1000 || 0, 0.033);
  state.lastTime = t;
  update(dt);
  draw();
  renderHud();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  for (const p of state.players) {
    if (e.code === p.key) {
      p.keyDown = true;
      e.preventDefault();
    }
  }
});

window.addEventListener("keyup", (e) => {
  for (const p of state.players) {
    if (e.code === p.key) {
      p.keyDown = false;
      e.preventDefault();
    }
  }
});

renderMenu();
renderHud();
requestAnimationFrame(loop);
