import type { HatId } from '@speedster/shared';
import { app } from '../App';
import { COLOR_OPTIONS, HAT_CATALOG } from '../customization/UnlockStore';

function escapeHtml(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
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
      btn.className = 'swatch hat-swatch';
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
        <span class="pstatus">${p.ready ? 'Ready' : 'Not ready'}</span>
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
        : 'Waiting for all players to ready up…'
      : 'Waiting for the host to start the race…';
  });

  // The countdown ticks locally between server events so the number stays live.
  setInterval(() => {
    if (app.phase !== 'countdown' || !app.countdownEndsAt) return;
    const secs = Math.max(0, Math.ceil((app.countdownEndsAt - Date.now()) / 1000));
    countdownNumber.textContent = secs > 0 ? String(secs) : 'GO!';
  }, 150);
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
      const medal = s.place === 1 ? '🥇' : s.place === 2 ? '🥈' : s.place === 3 ? '🥉' : `#${s.place}`;
      const detail =
        s.outcome === 'finished' ? 'Finished' : `Eliminated at checkpoint ${(s.eliminatedAtCheckpoint ?? 0) + 1}`;
      li.innerHTML = `<span class="place">${medal}</span><span class="pname">${escapeHtml(s.name)}</span><span class="detail">${detail}</span>`;
      list.appendChild(li);
    }
  });
}
