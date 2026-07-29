(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const JOKES = {
    shotNine: 'Sometimes seven eats nine... but not today!',
    escapedNine: 'Sometimes seven eats nine...',
    gameOver: 'Why was six afraid of seven?  Because seven ate nine.'
  };

  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'Enter') {
      if (state.mode === 'start' || state.mode === 'gameover') startGame();
    }
    if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  function makePlayer() {
    return {
      x: W / 2,
      y: H - 50,
      w: 34,
      speed: 320,
      cooldown: 0,
      invuln: 0
    };
  }

  function makeGrid(wave) {
    const cols = 8;
    const rows = 4;
    const spacingX = 64;
    const spacingY = 56;
    const startX = (W - (cols - 1) * spacingX) / 2;
    const startY = 90;
    const enemies = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        enemies.push({
          x: startX + c * spacingX,
          y: startY + r * spacingY,
          w: 30,
          alive: true
        });
      }
    }
    return {
      enemies,
      dir: 1,
      baseSpeed: 40 + wave * 12,
      stepDown: 24,
      fireCooldown: 1.2
    };
  }

  const state = {
    mode: 'start', // start | playing | gameover
    player: makePlayer(),
    bullets: [],       // player bullets
    enemyBullets: [],
    grid: null,
    wave: 1,
    score: 0,
    lives: 3,
    nine: null,
    nineTimer: 6,
    message: '',
    messageTimer: 0
  };

  function startGame() {
    state.mode = 'playing';
    state.player = makePlayer();
    state.bullets = [];
    state.enemyBullets = [];
    state.wave = 1;
    state.score = 0;
    state.lives = 3;
    state.grid = makeGrid(state.wave);
    state.nine = null;
    state.nineTimer = randRange(6, 12);
    state.message = '';
    state.messageTimer = 0;
  }

  function randRange(a, b) {
    return a + Math.random() * (b - a);
  }

  function showMessage(text, duration = 2.2) {
    state.message = text;
    state.messageTimer = duration;
  }

  function nextWave() {
    state.wave += 1;
    state.grid = makeGrid(state.wave);
    state.enemyBullets = [];
    showMessage(`Wave ${state.wave}!`, 1.4);
  }

  function loseLife() {
    state.lives -= 1;
    state.enemyBullets = [];
    state.player = makePlayer();
    state.player.invuln = 1.5;
    if (state.lives <= 0) {
      state.mode = 'gameover';
    }
  }

  function update(dt) {
    if (state.mode !== 'playing') return;

    const p = state.player;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) p.x -= p.speed * dt;
    if (keys.has('ArrowRight') || keys.has('KeyD')) p.x += p.speed * dt;
    p.x = Math.max(p.w / 2 + 4, Math.min(W - p.w / 2 - 4, p.x));

    p.cooldown -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (keys.has('Space') && p.cooldown <= 0) {
      state.bullets.push({ x: p.x, y: p.y - 24, vy: -480 });
      p.cooldown = 0.28;
    }

    for (const b of state.bullets) b.y += b.vy * dt;
    state.bullets = state.bullets.filter((b) => b.y > -20);

    for (const b of state.enemyBullets) b.y += b.vy * dt;
    state.enemyBullets = state.enemyBullets.filter((b) => b.y < H + 20);

    // enemy grid movement
    const g = state.grid;
    const alive = g.enemies.filter((e) => e.alive);
    if (alive.length === 0) {
      nextWave();
      return;
    }
    const speed = g.baseSpeed * (1 + (32 - alive.length) / 32);
    let hitEdge = false;
    for (const e of alive) {
      e.x += g.dir * speed * dt;
      if (e.x < 24 || e.x > W - 24) hitEdge = true;
    }
    if (hitEdge) {
      g.dir *= -1;
      for (const e of alive) e.y += g.stepDown;
    }

    // enemy reaches player row -> lose life
    for (const e of alive) {
      if (e.y >= p.y - 30) {
        loseLife();
        return;
      }
    }

    // enemy fire
    g.fireCooldown -= dt;
    if (g.fireCooldown <= 0 && alive.length > 0) {
      const shooter = alive[Math.floor(Math.random() * alive.length)];
      state.enemyBullets.push({ x: shooter.x, y: shooter.y + 16, vy: 220 });
      g.fireCooldown = Math.max(0.5, 1.6 - state.wave * 0.08);
    }

    // player bullet vs enemy
    for (const b of state.bullets) {
      for (const e of alive) {
        if (!e.alive) continue;
        if (Math.abs(b.x - e.x) < 18 && Math.abs(b.y - e.y) < 18) {
          e.alive = false;
          b.y = -999;
          state.score += 10;
        }
      }
    }

    // enemy bullet vs player
    if (p.invuln <= 0) {
      for (const b of state.enemyBullets) {
        if (Math.abs(b.x - p.x) < 18 && Math.abs(b.y - p.y) < 18) {
          b.y = H + 999;
          loseLife();
          return;
        }
      }
    }

    // the "9" easter egg
    if (state.nine) {
      state.nine.x += state.nine.vx * dt;
      let consumed = false;
      for (const b of state.bullets) {
        if (Math.abs(b.x - state.nine.x) < 20 && Math.abs(b.y - state.nine.y) < 20) {
          b.y = -999;
          state.score += 150;
          showMessage(JOKES.shotNine);
          state.nine = null;
          consumed = true;
          break;
        }
      }
      if (!consumed && state.nine && (state.nine.x < -30 || state.nine.x > W + 30)) {
        showMessage(JOKES.escapedNine);
        state.nine = null;
      }
    } else {
      state.nineTimer -= dt;
      if (state.nineTimer <= 0) {
        const fromLeft = Math.random() < 0.5;
        state.nine = {
          x: fromLeft ? -20 : W + 20,
          y: 40,
          vx: (fromLeft ? 1 : -1) * 90
        };
        state.nineTimer = randRange(14, 22);
      }
    }

    if (state.messageTimer > 0) state.messageTimer -= dt;
  }

  function drawGlyph(ch, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    if (state.mode === 'start') {
      drawGlyph('6 7', W / 2, H / 2 - 60, 64, '#39ff6a');
      ctx.fillStyle = '#9be8ac';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('dedicated to Ruby', W / 2, H / 2 - 10);
      ctx.fillText('press ENTER to start', W / 2, H / 2 + 30);
      return;
    }

    if (state.mode === 'gameover') {
      drawGlyph('GAME OVER', W / 2, H / 2 - 90, 40, '#ff5555');
      ctx.fillStyle = '#39ff6a';
      ctx.font = '22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Score: ${state.score}`, W / 2, H / 2 - 30);
      ctx.fillStyle = '#9be8ac';
      ctx.font = 'italic 18px monospace';
      wrapText(JOKES.gameOver, W / 2, H / 2 + 10, 480, 24);
      ctx.font = '18px monospace';
      ctx.fillStyle = '#39ff6a';
      ctx.fillText('press ENTER to play again', W / 2, H / 2 + 90);
      return;
    }

    // playing
    const p = state.player;
    if (p.invuln <= 0 || Math.floor(p.invuln * 10) % 2 === 0) {
      drawGlyph('6', p.x, p.y, 34, '#39ff6a');
    }

    for (const e of state.grid.enemies) {
      if (e.alive) drawGlyph('7', e.x, e.y, 28, '#ff9a3c');
    }

    ctx.fillStyle = '#eafff0';
    for (const b of state.bullets) {
      ctx.fillRect(b.x - 2, b.y - 8, 4, 14);
    }
    ctx.fillStyle = '#ff5555';
    for (const b of state.enemyBullets) {
      ctx.fillRect(b.x - 2, b.y - 8, 4, 14);
    }

    if (state.nine) {
      drawGlyph('9', state.nine.x, state.nine.y, 30, '#ffd23c');
    }

    // HUD
    ctx.textAlign = 'left';
    ctx.fillStyle = '#39ff6a';
    ctx.font = '16px monospace';
    ctx.fillText(`Score: ${state.score}`, 12, 24);
    ctx.fillText(`Wave: ${state.wave}`, 12, 44);
    ctx.textAlign = 'right';
    ctx.fillText(`Lives: ${'6'.repeat(state.lives)}`, W - 12, 24);

    if (state.messageTimer > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd23c';
      ctx.font = 'italic 18px monospace';
      ctx.fillText(state.message, W / 2, 70);
    }
  }

  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lines = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    ctx.textAlign = 'center';
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
  }

  let last = 0;
  function loop(ts) {
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
    last = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  draw();
  requestAnimationFrame(loop);
})();
