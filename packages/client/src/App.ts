import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  Cosmetics,
  LobbyStateView,
  RaceSnapshot,
  RoomPhase,
  ServerToClientEvents,
  StandingEntry,
  TrackDefinition,
} from '@speedster/shared';
import { loadProfile, saveProfile, type Profile } from './customization/UnlockStore';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) || 'http://localhost:8787';

export interface Toast {
  id: number;
  text: string;
}

export interface RosterEntry {
  name: string;
  cosmetics: Cosmetics;
}

type Listener = () => void;

class App {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  myId: string | null = null;

  phase: RoomPhase = 'lobby';
  lobby: LobbyStateView | null = null;
  countdownEndsAt: number | null = null;
  track: TrackDefinition | null = null;
  raceInstanceId = 0;
  snapshot: RaceSnapshot | null = null;
  takenPowerupIds = new Set<string>();
  standings: StandingEntry[] | null = null;
  toasts: Toast[] = [];
  roster = new Map<string, RosterEntry>();

  profile: Profile = loadProfile();

  private listeners = new Set<Listener>();
  private toastSeq = 0;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }

  connect() {
    if (this.socket) return;
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
      transports: ['websocket'],
    });
    this.socket = socket;

    socket.on('connect', () => {
      this.myId = socket.id ?? null;
      socket.emit('join_room', { name: this.profile.name, cosmetics: this.profile.cosmetics });
      this.notify();
    });

    socket.on('lobby_state', (view) => {
      this.lobby = view;
      this.phase = view.phase;
      for (const p of view.players) {
        this.roster.set(p.id, { name: p.name, cosmetics: p.cosmetics });
      }
      this.notify();
    });

    socket.on('countdown', ({ startsAt }) => {
      this.phase = 'countdown';
      this.countdownEndsAt = startsAt;
      this.notify();
    });

    socket.on('race_start', ({ track }) => {
      this.phase = 'racing';
      this.track = track;
      this.raceInstanceId++;
      this.snapshot = null;
      this.takenPowerupIds = new Set();
      this.standings = null;
      this.toasts = [];
      this.notify();
    });

    socket.on('snapshot', (payload) => {
      this.snapshot = payload;
      this.notify();
    });

    socket.on('powerup_taken', ({ powerupId, playerId }) => {
      this.takenPowerupIds.add(powerupId);
      const name = this.roster.get(playerId)?.name ?? 'Someone';
      this.pushToast(`${name} grabbed a Speed Boost!`);
    });

    socket.on('checkpoint_result', ({ eliminated }) => {
      if (eliminated.length === 0) return;
      if (eliminated.includes(this.myId ?? '')) {
        this.pushToast('You were eliminated at the checkpoint!');
      } else {
        this.pushToast(`${eliminated.length} runner${eliminated.length === 1 ? '' : 's'} eliminated at the checkpoint!`);
      }
    });

    socket.on('race_finished', ({ standings }) => {
      this.phase = 'results';
      this.standings = standings;
      const mine = standings.find((s) => s.id === this.myId);
      if (mine?.place === 1) this.unlockCrown();
      this.notify();
    });

    socket.on('error_msg', ({ message }) => this.pushToast(message));

    socket.on('disconnect', () => {
      this.pushToast('Disconnected from server.');
      this.notify();
    });
  }

  private pushToast(text: string) {
    const toast = { id: ++this.toastSeq, text };
    this.toasts = [...this.toasts, toast];
    this.notify();
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== toast.id);
      this.notify();
    }, 4000);
  }

  private unlockCrown() {
    if (this.profile.unlockedHats.includes('crown')) return;
    this.profile.unlockedHats.push('crown');
    saveProfile(this.profile);
    this.pushToast('New unlock: Crown! 👑');
    this.notify();
  }

  private pushProfile() {
    saveProfile(this.profile);
    this.socket?.emit('set_profile', { name: this.profile.name, cosmetics: this.profile.cosmetics });
  }

  setName(name: string) {
    this.profile.name = name.trim().slice(0, 16) || 'Runner';
    this.pushProfile();
  }

  setCosmetics(cosmetics: Cosmetics) {
    this.profile.cosmetics = cosmetics;
    this.pushProfile();
  }

  setReady(ready: boolean) {
    this.socket?.emit('set_ready', { ready });
  }

  addBot() {
    this.socket?.emit('add_bots', { count: 1 });
  }

  startRace() {
    this.socket?.emit('start_race');
  }

  jump() {
    this.socket?.emit('jump_input', { seq: 0 });
  }

  setDuck(ducking: boolean) {
    this.socket?.emit('duck_input', { ducking });
  }
}

export const app = new App();
