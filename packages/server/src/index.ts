import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@speedster/shared';
import { RoomManager } from './RoomManager.js';

const PORT = Number(process.env.PORT) || 8787;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

const manager = new RoomManager(io);

io.on('connection', (socket) => {
  manager.handleConnection(socket);
});

httpServer.listen(PORT, () => {
  console.log(`Speedster server listening on :${PORT}`);
});
