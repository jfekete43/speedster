import Phaser from 'phaser';
import { app } from './App';
import { MainScene } from './scenes/MainScene';
import { bindHud } from './ui/hud';
import { bindLobbyUI, bindResultsUI } from './ui/overlays';

bindLobbyUI();
bindResultsUI();
bindHud();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#101820',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MainScene],
});

app.connect();

window.addEventListener('beforeunload', () => {
  game.destroy(true);
});
