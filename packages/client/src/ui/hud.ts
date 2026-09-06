import { app } from '../App';

function escapeHtml(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

export function bindHud() {
  const hud = document.getElementById('hud')!;
  const leaderboard = document.getElementById('leaderboard')!;
  const toastsEl = document.getElementById('toasts')!;

  app.subscribe(() => {
    hud.hidden = app.phase !== 'racing';

    if (app.phase === 'racing' && app.snapshot) {
      const rows = [...app.snapshot.players].sort((a, b) => b.x - a.x).slice(0, 10);
      leaderboard.innerHTML = '';
      for (const row of rows) {
        const meta = app.roster.get(row.id);
        const li = document.createElement('li');
        li.classList.toggle('mine', row.id === app.myId);
        li.classList.toggle('dead', !row.alive);
        const tag = row.finished
          ? '🏁'
          : !row.alive
            ? '💀'
            : row.shielded
              ? '🛡️'
              : row.boosted
                ? '⚡'
                : row.stumbling
                  ? '💫'
                  : '';
        li.innerHTML = `<span class="dot" style="background:${meta?.cosmetics.color ?? '#888'}"></span><span class="pname">${escapeHtml(meta?.name ?? '???')}</span><span class="tag">${tag}</span>`;
        leaderboard.appendChild(li);
      }
    }

    toastsEl.innerHTML = '';
    for (const toast of app.toasts) {
      const div = document.createElement('div');
      div.className = 'toast';
      div.textContent = toast.text;
      toastsEl.appendChild(div);
    }
  });
}
