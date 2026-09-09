import type { HatId } from '@speedster/shared';
import { app } from '../App';
import { COLOR_OPTIONS, HAT_CATALOG } from '../customization/UnlockStore';
import { drawRunner, drawHat, drawShadow, RUNNER } from '../render/characters';

function escapeHtml(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/** Animated preview of the runner you are about to race as. */
function startRunnerPreview(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const scale = 1.32;
  let start = performance.now();

  const frame = (now: number) => {
    const phase = (((now - start) / 700) % 1 + 1) % 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 - 4 * scale, canvas.height - 26);
    ctx.scale(scale, scale);
    drawShadow(ctx, 24);
    drawRunner(ctx, { color: app.profile.cosmetics.color, pose: 'run', phase });
    const hat = app.profile.cosmetics.hat;
    if (hat && hat !== 'none') {
      ctx.translate(7, -RUNNER.height + 20);
      drawHat(ctx, hat as 'top_hat' | 'crown');
    }
    ctx.restore();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // keep the cycle stable if the tab is backgrounded and resumed
  document.addEventListener('visibilitychange', () => (start = performance.now()));
}

export function bindLobbyUI() {
  const overlay = document.getElementById('lobby-overlay')!;
  const countdownOverlay = document.getElementById('countdown-overlay')!;
  const countdownNumber = countdownOverlay.querySelector('.countdown-number')!;
  const nameInput = document.getElementById('name-input') as HTMLInputElement;
  const colorContainer = document.getElementById('color-swatches')!;
  const hatContainer = document.getElementById('hat-options')!;
  const readyBtn = document.getElementById('ready-btn') as HTMLButtonElement;
  const addBotBtn = document.getElementById('add-bots-btn') as HTMLButtonElement;
  const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
  const playerList = document.getElementById('player-list')!;
  const hint = document.getElementById('lobby-hint')!;
  const preview = document.getElementById('runner-preview') as HTMLCanvasElement;

  startRunnerPreview(preview);

  nameInput.value = app.profile.name;
  nameInput.addEventListener('change', () => app.setName(nameInput.value));

  function renderSwatches() {
    colorContainer.innerHTML = '';
    for (const color of COLOR_OPTIONS) {
      const btn = document.createElement('button');
      btn.className = 'swatch';
      btn.style.background = color;
      btn.classList.toggle('selected', app.profile.cosmetics.color === color);
      btn.addEventListener('click', () => {
        app.setCosmetics({ ...app.profile.cosmetics, color });
        renderSwatches();
      });
      colorContainer.appendChild(btn);
    }

    hatContainer.innerHTML = '';
    for (const hat of HAT_CATALOG) {
      const unlocked = app.profile.unlockedHats.includes(hat.id);
      const btn = document.createElement('button');
      btn.className = 'swatch';
      btn.textContent = unlocked ? hat.label : `🔒 ${hat.label}`;
      btn.disabled = !unlocked;
      btn.title = unlocked ? hat.label : hat.unlockHint;
      btn.classList.toggle('selected', app.profile.cosmetics.hat === hat.id);
      btn.addEventListener('click', () => {
        app.setCosmetics({ ...app.profile.cosmetics, hat: hat.id as HatId });
        renderSwatches();
      });
      hatContainer.appendChild(btn);
    }
  }
  renderSwatches();

  readyBtn.addEventListener('click', () => {
    const me = app.lobby?.players.find((p) => p.id === app.myId);
    app.setReady(!(me?.ready ?? false));
  });
  addBotBtn.addEventListener('click', () => app.addBot());
  startBtn.addEventListener('click', () => app.startRace());

  app.subscribe(() => {
    const lobby = app.lobby;
    const inLobby = app.phase === 'lobby';
    overlay.hidden = !inLobby;
    countdownOverlay.hidden = app.phase !== 'countdown';

    if (!lobby || !inLobby) return;

    playerList.innerHTML = '';
    for (const p of lobby.players) {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="dot" style="background:${p.cosmetics.color}"></span>
        <span class="pname">${escapeHtml(p.name)}${p.isHost ? ' 👑' : ''}${p.isBot ? ' 🤖' : ''}</span>
        <span class="pstatus ${p.ready ? '' : 'waiting'}">${p.ready ? 'READY' : 'WAITING'}</span>
      `;
      playerList.appendChild(li);
    }

    const isHost = lobby.hostId === app.myId;
    startBtn.hidden = !isHost;
    const humanCount = lobby.players.filter((p) => !p.isBot).length;
    const allReady = lobby.players.length > 0 && lobby.players.every((p) => p.ready);
    startBtn.disabled = !allReady || lobby.players.length < lobby.minPlayers || humanCount === 0;

    const me = lobby.players.find((p) => p.id === app.myId);
    readyBtn.textContent = me?.ready ? 'Not Ready' : 'Ready Up';
    addBotBtn.disabled = lobby.players.length >= lobby.maxPlayers;

    hint.textContent = isHost
      ? allReady
        ? 'Everyone is ready — start the race!'
        : `Waiting for all players to ready up (${lobby.players.length}/${lobby.maxPlayers} in lobby)…`
      : 'Waiting for the host to start the race…';
  });

  setInterval(() => {
    if (app.phase !== 'countdown' || !app.countdownEndsAt) return;
    const secs = Math.max(0, Math.ceil((app.countdownEndsAt - Date.now()) / 1000));
    const next = secs > 0 ? String(secs) : 'GO!';
    if (countdownNumber.textContent !== next) {
      countdownNumber.textContent = next;
      (countdownNumber as HTMLElement).style.animation = 'none';
      void (countdownNumber as HTMLElement).offsetWidth;
      (countdownNumber as HTMLElement).style.animation = 'pop 0.45s ease-out';
    }
  }, 120);
}

export function bindResultsUI() {
  const overlay = document.getElementById('results-overlay')!;
  const list = document.getElementById('standings-list')!;

  app.subscribe(() => {
    const show = app.phase === 'results';
    overlay.hidden = !show;
    if (!show || !app.standings) return;

    list.innerHTML = '';
    for (const s of app.standings) {
      const li = document.createElement('li');
      li.classList.toggle('mine', s.id === app.myId);
      if (s.place <= 3 && s.outcome === 'finished') li.classList.add(`podium-${s.place}`);
      const medal = s.place === 1 ? '🥇' : s.place === 2 ? '🥈' : s.place === 3 ? '🥉' : `#${s.place}`;
      const color = app.roster.get(s.id)?.cosmetics.color ?? '#8892b0';
      const detail =
        s.outcome === 'finished' ? 'Finished' : `Cut at checkpoint ${(s.eliminatedAtCheckpoint ?? 0) + 1}`;
      li.innerHTML = `<span class="place">${medal}</span><span class="dot" style="background:${color}"></span><span class="pname">${escapeHtml(
        s.name
      )}</span><span class="detail">${detail}</span>`;
      list.appendChild(li);
    }
  });
}
