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
  const marks = document.getElementById('progress-marks')!;
  const pips = document.getElementById('progress-pips')!;

  let marksForRace = -1;
  const pipEls = new Map<string, HTMLElement>();

  app.subscribe(() => {
    hud.hidden = app.phase !== 'racing';

    if (app.phase === 'racing' && app.snapshot && app.track) {
      const track = app.track;

      // Checkpoint / finish ticks only need rebuilding when the track changes.
      if (marksForRace !== app.raceInstanceId) {
        marksForRace = app.raceInstanceId;
        marks.innerHTML = '';
        pips.innerHTML = '';
        pipEls.clear();
        for (const cp of track.checkpoints) {
          const mark = document.createElement('div');
          mark.className = 'cp-mark';
          mark.style.left = `${(cp.x / track.length) * 100}%`;
          marks.appendChild(mark);
        }
        const finish = document.createElement('div');
        finish.className = 'cp-mark finish';
        finish.style.left = '100%';
        marks.appendChild(finish);
      }

      const rows = [...app.snapshot.players].sort((a, b) => b.x - a.x);
      leaderboard.innerHTML = '';
      rows.slice(0, 10).forEach((row, i) => {
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
        li.innerHTML = `<span class="rank">${i + 1}</span><span class="dot" style="background:${
          meta?.cosmetics.color ?? '#888'
        }"></span><span class="pname">${escapeHtml(meta?.name ?? '???')}</span><span class="tag">${tag}</span>`;
        leaderboard.appendChild(li);
      });

      // progress pips
      for (const p of app.snapshot.players) {
        let pip = pipEls.get(p.id);
        if (!pip) {
          pip = document.createElement('div');
          pip.className = 'pip' + (p.id === app.myId ? ' mine' : '');
          pip.style.background = app.roster.get(p.id)?.cosmetics.color ?? '#888';
          pips.appendChild(pip);
          pipEls.set(p.id, pip);
        }
        pip.style.left = `${Math.min(100, (p.x / track.length) * 100)}%`;
        pip.classList.toggle('dead', !p.alive);
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
