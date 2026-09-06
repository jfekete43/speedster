import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@speedster/shared';
import { Room } from './Room.js';

const PUBLIC_ROOM_ID = 'public';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * MVP matchmaking: everyone lands in one shared public room (capacity MAX_PLAYERS).
 * Joining while a race is in progress still creates a player entry that starts
 * out eliminated/spectating until the room next resets to its lobby phase -
 * this keeps the model simple while multi-room matchmaking is a follow-up.
 */
export class RoomManager {
  private io: IOServer;
  private rooms = new Map<string, Room>();

  constructor(io: IOServer) {
    this.io = io;
  }

  private getOrCreateRoom(): Room {
    let room = this.rooms.get(PUBLIC_ROOM_ID);
    if (!room) {
      room = new Room(PUBLIC_ROOM_ID, this.io);
      this.rooms.set(PUBLIC_ROOM_ID, room);
    }
    return room;
  }

  handleConnection(socket: IOSocket) {
    socket.on('join_room', ({ name, cosmetics }) => {
      const room = this.getOrCreateRoom();
      room.addPlayer(socket, (name || 'Runner').slice(0, 16), cosmetics);
    });

    socket.on('disconnect', () => {
      for (const room of this.rooms.values()) {
        room.removePlayer(socket.id);
      }
    });
  }
}
