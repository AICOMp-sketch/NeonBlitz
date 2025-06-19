(() => {
  'use strict';

  // Canvas and rendering contexts
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  const particlesCanvas = document.getElementById('particles-canvas');
  const pctx = particlesCanvas.getContext('2d');

  // Responsive scaling helpers
  function fitCanvasToContainer() {
    let container = canvas.parentElement;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * window.devicePixelRatio;
    canvas.height = h * window.devicePixelRatio;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    particlesCanvas.width = canvas.width;
    particlesCanvas.height = canvas.height;
    particlesCanvas.style.width = canvas.style.width;
    particlesCanvas.style.height = canvas.style.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  window.addEventListener('resize', fitCanvasToContainer);
  fitCanvasToContainer();

  // Game data structures
  const gameState = {
    score: 0,
    level: 1,
    lives: 3,
    health: 100,
    combo: 0,
    powerUps: [],
    isPaused: false,
    isGameOver: false,
    difficulty: 1,
    elapsedTime: 0
  };

  const player = {
    x: 100,
    y: 270,
    width: 40,
    height: 40,
    direction: 'right',
    speed: 250, // pixels per second
    bullets: [],
    canShoot: true,
    shootCooldown: 300, // ms
    lastShootTime: 0,
    isInvincibleTimer: 0,
    health: 100,
  };

  const enemies = [];
  const collectibles = [];

  const achievements = [
    { id: 'first_blood', name: 'First Blood', description: 'Destroy your first enemy', icon: 'bloodtype', unlocked: false, progress: 0, reward: 100 },
    { id: 'survivor', name: 'Survivor', description: 'Survive 3 levels', icon: 'shield', unlocked: false, progress: 0, reward: 300 },
    { id: 'collector', name: 'Collector', description: 'Collect 15 items', icon: 'inventory_2', unlocked: false, progress: 0, reward: 200 },
    { id: 'combo_master', name: 'Combo Master', description: 'Achieve a combo of 5', icon: 'auto_mode', unlocked: false, progress: 0, reward: 200 },
    { id: 'undefeated', name: 'Undefeated', description: 'Finish level without losing health', icon: 'sentiment_very_satisfied', unlocked: false, progress: 0, reward: 400 },
  ];

  const highScoresKey = 'neon_blitz_highscores_v1';
  const highScores = JSON.parse(localStorage.getItem(highScoresKey) || '[]');

  const settings = {
    soundVolume: 0.75,
    musicVolume: 0.5,
    graphics: 'medium',
    controls: 'keyboard',
    fullscreen: false,
  };

  let lastFrameTime = 0;
  let keysPressed = {};

  // UI elements references
  const scoreEl = document.getElementById('score-value');
  const levelEl = document.getElementById('level-value');
  const livesEl = document.getElementById('lives-value');
  const healthBar = document.getElementById('health-fill');
  const timerEl = document.getElementById('timer');
  const powerupsListEl = document.getElementById('powerups-list');
  const achievementsListEl = document.getElementById('achievements-list');
  const achievementPopupEl = document.getElementById('achievement-popup');
  const achievementMessageEl = document.getElementById('achievement-message');
  const pauseOverlayEl = document.getElementById('pause-overlay');
  const modalOverlayEl = document.getElementById('modal-overlay');

  // Sound effects & music setup
  const sounds = {
    shoot: new Audio('https://freesound.org/data/previews/320/320654_5260877-lq.mp3'),
    explosion: new Audio('https://freesound.org/data/previews/276/276033_5121236-lq.mp3'),
    powerup: new Audio('https://freesound.org/data/previews/331/331912_3248244-lq.mp3'),
    collision: new Audio('https://freesound.org/data/previews/215/215342_1979596-lq.mp3'),
  };
  const bgm = new Audio('https://cdn.pixabay.com/download/audio/2021/10/22/audio_876e1a9e08.mp3?filename=synthwave-background-11867.mp3');
  bgm.loop = true;
  bgm.volume = settings.musicVolume;

  function playSound(name) {
    if (!sounds[name]) return;
    sounds[name].volume = settings.soundVolume;
    sounds[name].currentTime = 0;
    sounds[name].play().catch(() => {});
  }

  // Initialize achievement UI list
  function renderAchievementsList() {
    achievementsListEl.innerHTML = '';
    for (const a of achievements) {
      const div = document.createElement('div');
      div.classList.add('achievement');
      if (a.unlocked) div.classList.add('unlocked');
      div.innerHTML = `<span class="material-icons icon">${a.icon}</span> ${a.name}`;
      achievementsListEl.appendChild(div);
    }
  }
  renderAchievementsList();

  // Show achievement popup
  let achievementTimeout;
  function showAchievementPopup(name) {
    achievementMessageEl.textContent = `${name} unlocked!`;
    achievementPopupEl.setAttribute('aria-hidden', 'false');
    achievementPopupEl.classList.add('show');
    clearTimeout(achievementTimeout);
    achievementTimeout = setTimeout(() => {
      achievementPopupEl.classList.remove('show');
      achievementPopupEl.setAttribute('aria-hidden', 'true');
    }, 3500);
  }

  // Collapsible sidebar groups logic
  const sidebarHeaders = document.querySelectorAll('.sidebar-section h3');
  sidebarHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const section = header.parentElement;
      const isCollapsed = section.classList.toggle('collapsed');
      header.setAttribute('aria-expanded', String(!isCollapsed));
    });
  });

  // Toggle sidebar on bottom button
  const sidebar = document.getElementById('game-sidebar');
  document.getElementById('toggle-sidebar').addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  // Pause button event
  const pauseBtn = document.getElementById('btn-pause');
  pauseBtn.addEventListener('click', () => {
    togglePause();
  });

  // Fullscreen toggle
  const fullscreenBtn = document.getElementById('btn-fullscreen');
  fullscreenBtn.addEventListener('click', () => {
    toggleFullscreen();
  });

  // Shoot button for touch
  const shootBtn = document.getElementById('btn-shoot');
  shootBtn.addEventListener('click', () => {
    shootBullet();
  });

  // Settings menu
  function openSettings() {
    modalOverlayEl.classList.add('active');
    document.getElementById('settings-form').soundVolume.value = settings.soundVolume * 100;
    document.getElementById('settings-form').musicVolume.value = settings.musicVolume * 100;
    document.getElementById('settings-form').graphics.value = settings.graphics;
    document.getElementById('settings-form').controls.value = settings.controls;
  }
  function closeSettings() {
    modalOverlayEl.classList.remove('active');
  }
  // Close settings button
  document.getElementById('btn-close-settings').addEventListener('click', closeSettings);

  // Keyboard shortcuts and controls input handling
  window.addEventListener('keydown', e => {
    if(e.repeat) return;
    keysPressed[e.key.toLowerCase()] = true;
    if(e.key === 'p') togglePause();
    if(e.key === 'f') toggleFullscreen();
    if(e.key === 'Escape' && modalOverlayEl.classList.contains('active')) closeSettings();
    if(e.key === 'm') {
      if(bgm.paused) bgm.play();
      else bgm.pause();
    }
  });

  window.addEventListener('keyup', e => {
    keysPressed[e.key.toLowerCase()] = false;
  });

  // Gamepad simulation shortcut keys for demo
  // WASD + Spacebar for shooting; P for pause; F for fullscreen

  // FULLSCREEN API HANDLER
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      settings.fullscreen = true;
    } else {
      document.exitFullscreen();
      settings.fullscreen = false;
    }
  }

  // PLAYER Shoot bullet function
  function shootBullet() {
    const now = performance.now();
    if (!player.canShoot || now - player.lastShootTime < player.shootCooldown) return;
    player.lastShootTime = now;
    player.canShoot = false;
    setTimeout(() => player.canShoot = true, player.shootCooldown);
    // Create a bullet at player position
    player.bullets.push({
      x: player.x + player.width,
      y: player.y + player.height / 2 - 4,
      width: 12,
      height: 8,
      speed: 600,
      alive: true,
    });
    playSound('shoot');
  }

  // Entity spawning helpers
  let enemyIdCounter = 0;
  function addEnemy(type) {
    const y = Math.random() * (canvas.height / window.devicePixelRatio - 48);
    enemies.push({
      id: enemyIdCounter++,
      type,
      x: canvas.width / window.devicePixelRatio + 20,
      y,
      width: 40,
      height: 40,
      health: 3 + gameState.level,
      speed: 100 + gameState.level * 10,
      alive: true,
      behavior: 'linear',
      rewards: 50,
      hitTimer: 0,
    });
  }

  let collectibleIdCounter = 0;
  function addCollectible(type, x, y) {
    collectibles.push({
      id: collectibleIdCounter++,
      type,
      x,
      y,
      width: 24,
      height: 24,
      value: 25,
      alive: true,
      effect: () => {
        gainHealth(15);
        playSound('powerup');
      },
      animationFrame: 0,
      animationSpeed: 0.02,
    });
  }

  // Health management
  function gainHealth(amount) {
    gameState.health = Math.min(gameState.health + amount, 100);
    player.health = gameState.health;
  }
  function loseHealth(amount) {
    if (player.isInvincibleTimer > 0) return;
    gameState.health = Math.max(gameState.health - amount, 0);
    player.health = gameState.health;
    player.isInvincibleTimer = 2000; // 2 seconds invincibility
    triggerScreenShake(8, 150);
    if (gameState.health === 0) {
      gameState.lives--;
      if (gameState.lives > 0) {
        // Respawn player health and invincibility for short duration
        gameState.health = 100;
        player.health = 100;
        player.isInvincibleTimer = 3000;
        playSound('collision');
      } else {
        gameOver();
      }
    } else {
      playSound('collision');
    }
    updateHealthBar();
  }

  // UI Updaters
  function updateScore(amount = 0) {
    gameState.score += amount;
    // Animate score on increment
    scoreEl.textContent = String(gameState.score);
    scoreEl.classList.add('hit');
    setTimeout(() => scoreEl.classList.remove('hit'), 400);
  }
  function updateLevel(level) {
    levelEl.textContent = level;
  }
  function updateLives(lives) {
    livesEl.textContent = lives;
  }
  function updateHealthBar() {
    healthBar.style.width = gameState.health + '%';
    healthBar.setAttribute('aria-valuenow', gameState.health);
  }
  function updateTimerDisplay(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }

  // Game state changes
  function gameOver() {
    gameState.isGameOver = true;
    pauseGame();
    saveHighScore();
    openGameOverModal();
  }

  // Save high score
  function saveHighScore() {
    const now = new Date();
    const newEntry = {
      name: 'Player',
      score: gameState.score,
      level: gameState.level,
      date: now.toISOString(),
      achievements: achievements.filter(a => a.unlocked).map(a => a.id)
    };
    highScores.push(newEntry);
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > 10) highScores.length = 10;
    localStorage.setItem(highScoresKey, JSON.stringify(highScores));
  }

  // Game over modal with stats and social sharing
  function openGameOverModal() {
    modalOverlayEl.classList.add('active');
    modalOverlayEl.querySelector('#modal-title').textContent = 'Game Over';
    const form = modalOverlayEl.querySelector('form');
    form.innerHTML = `
      <p>Your score: <strong>${gameState.score}</strong></p>
      <p>Reached Level: <strong>${gameState.level}</strong></p>
      <p>Achievements unlocked: <strong>${achievements.filter(a => a.unlocked).length}</strong></p>
      <button type="button" id="btn-restart" class="btn">Restart</button>
      <button type="button" id="btn-close" class="btn">Close</button>
    `;
    document.getElementById('btn-restart').onclick = () => {
      modalOverlayEl.classList.remove('active');
      resetGame();
    };
    document.getElementById('btn-close').onclick = closeSettings;
  }

  // Reset game variables for new game
  function resetGame() {
    gameState.score = 0;
    gameState.level = 1;
    gameState.lives = 3;
    gameState.health = 100;
    gameState.combo = 0;
    gameState.powerUps.length = 0;
    gameState.isPaused = false;
    gameState.isGameOver = false;
    gameState.difficulty = 1;
    gameState.elapsedTime = 0;
    player.x = 100;
    player.y = canvas.height / window.devicePixelRatio / 2 - player.height / 2;
    player.health = 100;
    player.bullets.length = 0;
    enemies.length = 0;
    collectibles.length = 0;
    achievements.forEach(a => { a.unlocked = false; a.progress = 0; });
    updateScore(0);
    updateLevel(1);
    updateLives(3);
    updateHealthBar();
    updateTimerDisplay(0);
    renderAchievementsList();
    pauseOverlayEl.classList.remove('active');
    gameLoop(performance.now());
  }

  // Toggle pause
  function togglePause() {
    if (gameState.isGameOver) return;
    gameState.isPaused = !gameState.isPaused;
    pauseOverlayEl.classList.toggle('active', gameState.isPaused);
    if (!gameState.isPaused) {
      lastFrameTime = performance.now();
      requestAnimationFrame(gameLoop);
      bgm.play().catch(() => {});
    } else {
      bgm.pause();
    }
  }

  // Spawn logic & progressive difficulty
  let enemySpawnTimer = 0;
  let collectibleSpawnTimer = 0;
  const enemySpawnInterval = 2000;
  const collectibleSpawnInterval = 4000;

  // Collision helpers
  function rectsCollide(a, b) {
    return a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y;
  }

  // Particle system implementation
  const particles = [];
  class Particle {
    constructor(x, y, color, size, life, speedX = 0, speedY = 0, gravity = 0) {
      this.x = x;
      this.y = y;
      this.color = color;
      this.size = size;
      this.life = life;
      this.speedX = speedX;
      this.speedY = speedY;
      this.gravity = gravity;
      this.alpha = 1;
    }
    update(dt) {
      this.x += this.speedX * dt;
      this.y += this.speedY * dt;
      this.speedY += this.gravity * dt;
      this.life -= dt;
      if (this.life < 0) this.alpha = 0;
      else this.alpha = this.life / 1; // Fade out over 1 second
    }
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }
  }
  // Spawn particle effect helper
  function createParticleEffect(x, y, color = 'cyan', amount = 20) {
    for(let i=0; i < amount; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const speed = Math.random() * 150 + 50;
      const size = Math.random() * 2 + 1;
      particles.push(new Particle(
        x, y, color, size, 1,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        200
      ));
    }
  }

  // Screen shake vars
  let shakeDuration = 0;
  let shakeIntensity = 0;
  let shakeTime = 0;

  function triggerScreenShake(intensity, duration) {
    shakeIntensity = intensity;
    shakeDuration = duration;
    shakeTime = 0;
  }

  // Movement & input handling
  function handleInput(deltaTime) {
    let speed = player.speed * (deltaTime / 1000);
    if (keysPressed['arrowup'] || keysPressed['w']) player.y -= speed;
    if (keysPressed['arrowdown'] || keysPressed['s']) player.y += speed;
    if (keysPressed['arrowleft'] || keysPressed['a']) player.x -= speed;
    if (keysPressed['arrowright'] || keysPressed['d']) player.x += speed;
    // Clamp inside screen
    const maxY = canvas.height / window.devicePixelRatio - player.height;
    const maxX = canvas.width / window.devicePixelRatio - player.width;
    player.y = Math.min(Math.max(player.y, 0), maxY);
    player.x = Math.min(Math.max(player.x, 0), maxX);

    if(keysPressed[' ']) shootBullet();
  }

  // Update game entities
  function updateGame(deltaTime) {
    gameState.elapsedTime += deltaTime / 1000;
    updateTimerDisplay(gameState.elapsedTime);

    // Update player invincibility timer
    if(player.isInvincibleTimer > 0) {
      player.isInvincibleTimer = Math.max(0, player.isInvincibleTimer - deltaTime);
    }

    // Update bullets
    player.bullets = player.bullets.filter(b => b.alive);
    player.bullets.forEach(bullet => {
      bullet.x += bullet.speed * (deltaTime / 1000);
      if(bullet.x > canvas.width / window.devicePixelRatio) bullet.alive = false;
    });

    // Update enemies
    enemies.forEach(enemy => {
      // Basic linear movement
      enemy.x -= enemy.speed * (deltaTime / 1000);
      if(enemy.x + enemy.width < 0) {
        enemy.alive = false;
        loseHealth(10); // Damage player if enemy escapes
      }
      // Hit flash timing
      enemy.hitTimer = Math.max(0, enemy.hitTimer - deltaTime);
    });
    // Remove dead enemies
    for(let i = enemies.length - 1; i >= 0; i--) {
      if(!enemies[i].alive) enemies.splice(i, 1);
    }

    // Update collectibles animation
    collectibles.forEach(c => {
      c.animationFrame += c.animationSpeed * deltaTime;
      if (c.animationFrame >= 1) c.animationFrame = 0;
    });

    // Remove dead collectibles
    for(let i = collectibles.length - 1; i >= 0; i--) {
      if(!collectibles[i].alive) collectibles.splice(i, 1);
    }

    // Spawn enemies
    enemySpawnTimer += deltaTime;
    if(enemySpawnTimer > enemySpawnInterval / gameState.difficulty) {
      enemySpawnTimer = 0;
      addEnemy('basic');
    }

    // Spawn collectibles
    collectibleSpawnTimer += deltaTime;
    if(collectibleSpawnTimer > collectibleSpawnInterval) {
      collectibleSpawnTimer = 0;
      addCollectible('health', Math.random() * (canvas.width / window.devicePixelRatio - 50) + 50, Math.random() * (canvas.height / window.devicePixelRatio - 50) + 25);
    }

    // Increase difficulty gradually
    if (gameState.elapsedTime > gameState.level * 30) {
      gameState.level++;
      gameState.difficulty += 0.5;
      updateLevel(gameState.level);
      showAchievementProgress('survivor');
    }

    checkCollisions();
    updatePowerUps(deltaTime);
    updateParticles(deltaTime);
  }

  // Collision detection and handling
  function checkCollisions() {
    // Player bullets with enemies
    player.bullets.forEach(bullet => {
      enemies.forEach(enemy => {
        if(bullet.alive && enemy.alive && rectsCollide(bullet, enemy)) {
          bullet.alive = false;
          enemy.health -= 1;
          enemy.hitTimer = 100;
          createParticleEffect(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 'purple', 15);
          if(enemy.health <= 0) {
            enemy.alive = false;
            updateScore(enemy.rewards);
            createParticleEffect(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 'red', 40);
            showAchievementProgress('first_blood');
          }
          playSound('explosion');
        }
      });
    });

    // Player with enemies
    enemies.forEach(enemy => {
      if(enemy.alive && rectsCollide(player, enemy)) {
        enemy.alive = false;
        loseHealth(30);
        createParticleEffect(player.x + player.width / 2, player.y + player.height / 2, 'red', 30);
        playSound('collision');
      }
    });

    // Player with collectibles
    collectibles.forEach(collectible => {
      if(collectible.alive && rectsCollide(player, collectible)) {
        collectible.alive = false;
        collectible.effect();
        updateScore(collectible.value);
        showAchievementProgress('collector');
        createParticleEffect(collectible.x + collectible.width / 2, collectible.y + collectible.height / 2, 'yellow', 25);
      }
    });
  }

  // Powerup system
  function updatePowerUps(deltaTime) {
    // Decrease timers and remove expired power-ups
    for(let i = gameState.powerUps.length - 1; i >= 0; i--) {
      let p = gameState.powerUps[i];
      p.timeLeft -= deltaTime;
      if(p.timeLeft <= 0) {
        gameState.powerUps.splice(i, 1);
      }
    }
    renderPowerUps();
  }
  function renderPowerUps() {
    powerupsListEl.innerHTML = '';
    gameState.powerUps.forEach(p => {
      const div = document.createElement('div');
      div.className = 'powerup';
      div.textContent = `${p.name} (${Math.ceil(p.timeLeft / 1000)}s)`;
      powerupsListEl.appendChild(div);
    });
  }

  // Achievements progress and unlocking
  function showAchievementProgress(id) {
    const a = achievements.find(a => a.id === id);
    if(!a || a.unlocked) return;
    a.progress++;
    if ((id === 'first_blood' && a.progress > 0) ||
        (id === 'survivor' && gameState.level >= 3) ||
        (id === 'collector' && a.progress >= 15) ||
        (id === 'combo_master' && gameState.combo >= 5) ||
        (id === 'undefeated' && gameState.health === 100 && gameState.lives >= 1)) {
      a.unlocked = true;
      updateScore(a.reward);
      renderAchievementsList();
      showAchievementPopup(a.name);
    }
  }

  // Particle system update and draw
  function updateParticles(deltaTime) {
    for(let i = particles.length - 1; i >= 0; i--) {
      particles[i].update(deltaTime / 1000);
      if(particles[i].alpha <= 0) particles.splice(i, 1);
    }
  }
  function drawParticles() {
    pctx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
    particles.forEach(p => p.draw(pctx));
  }

  // Render game visuals
  function renderGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw player
    ctx.save();
    if(player.isInvincibleTimer > 0) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(player.isInvincibleTimer * 0.05);
    }
    ctx.fillStyle = 'cyan';
    ctx.shadowColor = 'cyan';
    ctx.shadowBlur = 12;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.restore();

    // Player bullets
    ctx.fillStyle = 'yellow';
    player.bullets.forEach(bullet => {
      ctx.shadowColor = 'yellow';
      ctx.shadowBlur = 10;
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });

    // Enemies
    enemies.forEach(enemy => {
      if(enemy.hitTimer > 0) {
        ctx.fillStyle = 'magenta';
        ctx.shadowColor = 'magenta';
      } else {
        ctx.fillStyle = 'red';
        ctx.shadowColor = 'red';
      }
      ctx.shadowBlur = 14;
      ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    });

    // Collectibles with a floating animation
    collectibles.forEach(c => {
      const floatOffset = Math.sin(c.animationFrame * Math.PI * 2) * 5;
      const gradient = ctx.createRadialGradient(c.x + c.width/2, c.y + c.height/2 + floatOffset, 5, c.x + c.width/2, c.y + c.height/2 + floatOffset, 15);
      gradient.addColorStop(0, 'yellow');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.shadowColor = 'yellow';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.ellipse(c.x + c.width/2, c.y + c.height/2 + floatOffset, c.width/2, c.height/3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'yellow';
      ctx.fillRect(c.x + 4, c.y + floatOffset, c.width-8, c.height- (floatOffset/3));
    });
  }

  // Game loop
  function gameLoop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if(!gameState.isPaused && !gameState.isGameOver) {
      handleInput(deltaTime);
      updateGame(deltaTime);
      renderGame();

      if (shakeDuration > 0) {
        shakeTime += deltaTime;
        if(shakeTime < shakeDuration) {
          const dx = (Math.random() - 0.5) * shakeIntensity;
          const dy = (Math.random() - 0.5) * shakeIntensity;
          canvas.style.transform = `translate(${dx}px, ${dy}px)`;
          particlesCanvas.style.transform = `translate(${dx}px, ${dy}px)`;
        } else {
          shakeDuration = 0;
          shakeTime = 0;
          canvas.style.transform = "";
          particlesCanvas.style.transform = "";
        }
      }

      drawParticles();
    }

    requestAnimationFrame(gameLoop);
  }

  // Start background music
  bgm.volume = settings.musicVolume;
  bgm.play().catch(() => {}); // ignore if autoplay blocked

  // Initialize UI states
  updateScore(0);
  updateLevel(gameState.level);
  updateLives(gameState.lives);
  updateHealthBar();
  updateTimerDisplay(0);

  // Initialize player position center left
  player.x = 100;
  player.y = (canvas.height / window.devicePixelRatio) / 2 - player.height / 2;

  // Start game loop
  requestAnimationFrame(gameLoop);

  // Accessibility: focus main for keyboard control
  document.getElementById('game-main').focus();
})();
