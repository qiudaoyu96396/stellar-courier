(() => {
      "use strict";

      const canvas = document.getElementById("gameCanvas");
      const ctx = canvas.getContext("2d");
      const stage = document.getElementById("stage");
      const hud = document.getElementById("hud");
      const scoreValue = document.getElementById("scoreValue");
      const comboValue = document.getElementById("comboValue");
      const hullPips = [...document.querySelectorAll(".hull-pip")];
      const shieldValue = document.getElementById("shieldValue");
      const dashValue = document.getElementById("dashValue");
      const soundBtn = document.getElementById("soundBtn");
      const pauseBtn = document.getElementById("pauseBtn");
      const dashBtn = document.getElementById("dashBtn");
      const mobileControls = document.querySelector(".mobile-controls");
      const startScreen = document.getElementById("startScreen");
      const gameOverScreen = document.getElementById("gameOverScreen");
      const pauseScreen = document.getElementById("pauseScreen");
      const startBtn = document.getElementById("startBtn");
      const restartBtn = document.getElementById("restartBtn");
      const menuBtn = document.getElementById("menuBtn");
      const resumeBtn = document.getElementById("resumeBtn");
      const finalScore = document.getElementById("finalScore");
      const finalBest = document.getElementById("finalBest");
      const bestLine = document.getElementById("bestLine");
      const gameOverMessage = document.getElementById("gameOverMessage");
      const toast = document.getElementById("toast");

      const TAU = Math.PI * 2;
      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      const rand = (min, max) => min + Math.random() * (max - min);
      const padScore = value => Math.max(0, Math.floor(value)).toString().padStart(4, "0");

      let W = 900;
      let H = 560;
      let dpr = 1;
      let state = "menu";
      let score = 0;
      let hull = 3;
      let shieldCharges = 0;
      let combo = 1;
      let comboTimer = 0;
      let elapsed = 0;
      let level = 1;
      let shake = 0;
      let screenFlash = 0;
      let lastTime = performance.now();
      let totalRunTime = 0;
      let soundEnabled = true;
      let audioCtx = null;
      let toastTimer = 0;
      let hazardSpawnTimer = 0;
      let powerTimer = 11;
      let shieldPickupTimer = 18;
      let pickupRespawnTimer = 0;
      let dashReadyFlash = 0;

      const keys = new Set();
      const pointer = { x: 0, y: 0, active: false, id: null };
      const stars = [];
      const dust = [];
      const hazards = [];
      const pickups = [];
      const particles = [];
      const shockwaves = [];

      const player = {
        x: 450,
        y: 300,
        vx: 0,
        vy: 0,
        r: 12,
        angle: -Math.PI / 2,
        invulnerable: 0,
        dash: 0,
        dashCooldown: 0,
        dashX: 0,
        dashY: -1
      };

      const savedBest = Number.parseInt(localStorage.getItem("stellarCourierBest") || "0", 10);
      const savedTime = Number.parseInt(localStorage.getItem("stellarCourierBestTime") || "0", 10);
      let best = Number.isFinite(savedBest) ? savedBest : 0;
      let bestTime = Number.isFinite(savedTime) ? savedTime : 0;
      updateBestLine();

      function formatTime(seconds) {
        const safe = Math.max(0, Math.floor(seconds));
        return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
      }

      function updateBestLine() {
        bestLine.textContent = `最高纪录 ${padScore(best)} · 航程 ${formatTime(bestTime)}`;
      }

      function resizeCanvas() {
        const rect = stage.getBoundingClientRect();
        const oldW = W || rect.width;
        const oldH = H || rect.height;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.max(1, rect.width);
        H = Math.max(1, rect.height);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (state === "playing" || state === "paused") {
          const sx = W / oldW;
          const sy = H / oldH;
          player.x *= sx;
          player.y *= sy;
          hazards.forEach(item => { item.x *= sx; item.y *= sy; });
          pickups.forEach(item => { item.x *= sx; item.y *= sy; });
        }

        makeBackdrop();
      }

      if (navigator.maxTouchPoints > 0 || "ontouchstart" in window) {
        mobileControls.classList.add("touch");
      }

      function makeBackdrop() {
        stars.length = 0;
        dust.length = 0;
        const count = Math.round(clamp((W * H) / 7200, 45, 135));
        for (let i = 0; i < count; i++) {
          stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: rand(0.35, 1.45),
            alpha: rand(0.2, 0.9),
            speed: rand(2, 14)
          });
        }
        for (let i = 0; i < 6; i++) {
          dust.push({
            x: Math.random() * W,
            y: Math.random() * H,
            rx: rand(100, 260),
            ry: rand(54, 160),
            angle: rand(0, TAU),
            alpha: rand(0.012, 0.035)
          });
        }
      }

      function resetGame() {
        score = 0;
        hull = 3;
        shieldCharges = 0;
        combo = 1;
        comboTimer = 0;
        elapsed = 0;
        totalRunTime = 0;
        level = 1;
        shake = 0;
        screenFlash = 0;
        hazardSpawnTimer = 0.35;
        powerTimer = 11;
        shieldPickupTimer = 18;
        pickupRespawnTimer = 0;
        hazards.length = 0;
        pickups.length = 0;
        particles.length = 0;
        shockwaves.length = 0;

        player.x = W * 0.5;
        player.y = H * 0.58;
        player.vx = 0;
        player.vy = 0;
        player.angle = -Math.PI / 2;
        player.invulnerable = 1.2;
        player.dash = 0;
        player.dashCooldown = 0;
        pointer.active = false;

        for (let i = 0; i < 5; i++) spawnPickup(true);
        for (let i = 0; i < 4; i++) spawnHazard(true);
        updateHud();
      }

      function startGame() {
        ensureAudio();
        state = "playing";
        resetGame();
        startScreen.hidden = true;
        gameOverScreen.hidden = true;
        pauseScreen.hidden = true;
        hud.classList.add("visible");
        pauseBtn.textContent = "暂停";
        showToast("送达开始 · 保持连击");
        playTone(330, 0.08, "sine", 0.035);
        setTimeout(() => playTone(494, 0.12, "sine", 0.03), 70);
        lastTime = performance.now();
      }

      function returnToMenu() {
        state = "menu";
        hud.classList.remove("visible");
        startScreen.hidden = false;
        gameOverScreen.hidden = true;
        pauseScreen.hidden = true;
        hazards.length = 0;
        pickups.length = 0;
        particles.length = 0;
        shockwaves.length = 0;
        updateBestLine();
      }

      function pauseGame() {
        if (state !== "playing") return;
        state = "paused";
        pauseScreen.hidden = false;
        pauseBtn.textContent = "继续";
        pointer.active = false;
      }

      function resumeGame() {
        if (state !== "paused") return;
        state = "playing";
        pauseScreen.hidden = true;
        pauseBtn.textContent = "暂停";
        lastTime = performance.now();
      }

      function togglePause() {
        if (state === "playing") pauseGame();
        else if (state === "paused") resumeGame();
      }

      function endGame() {
        state = "over";
        pointer.active = false;
        hud.classList.remove("visible");
        gameOverScreen.hidden = false;
        const isRecord = score > best;
        if (score > best) {
          best = score;
          bestTime = Math.floor(elapsed);
          localStorage.setItem("stellarCourierBest", String(best));
          localStorage.setItem("stellarCourierBestTime", String(bestTime));
        }
        finalScore.textContent = padScore(score);
        finalBest.textContent = padScore(best);
        finalBest.classList.toggle("record", isRecord);
        gameOverMessage.textContent = isRecord ? "新纪录。总部已经收到你的飞行日志。" : getRankMessage(score);
        updateBestLine();
        playTone(140, 0.2, "sawtooth", 0.035, 85);
      }

      function getRankMessage(value) {
        if (value >= 1200) return "王牌快递员，整条航线都在为你让路。";
        if (value >= 700) return "表现不错，陨石带只留下了几道擦痕。";
        if (value >= 300) return "航线已记录，下一次可以送得更远。";
        return "飞船已经返厂维修，星核还在等你。";
      }

      function updateHud() {
        scoreValue.textContent = padScore(score);
        comboValue.textContent = `×${combo.toFixed(1)}`;
        comboValue.classList.toggle("hot", combo >= 2.5);
        hullPips.forEach((pip, index) => pip.classList.toggle("active", index < hull));
        shieldValue.textContent = String(shieldCharges);
        shieldValue.classList.toggle("hot", shieldCharges > 0);
        dashBtn.classList.toggle("cooling", player.dashCooldown > 0.08);
        dashBtn.textContent = player.dashCooldown > 0.08 ? player.dashCooldown.toFixed(1) : "冲刺";
        dashBtn.disabled = state !== "playing" || player.dashCooldown > 0.08;
        dashValue.textContent = player.dashCooldown > 0.08 ? `${player.dashCooldown.toFixed(1)}s` : "就绪";
        dashValue.classList.toggle("cooling", player.dashCooldown > 0.08);
      }

      function showToast(text) {
        toast.textContent = text;
        toast.classList.add("show");
        toastTimer = 1.65;
      }

      function ensureAudio() {
        if (!soundEnabled || audioCtx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      }

      function playTone(frequency, duration, type = "sine", volume = 0.025, endFrequency = null) {
        if (!soundEnabled || !audioCtx) return;
        if (audioCtx.state === "suspended") audioCtx.resume();
        const now = audioCtx.currentTime;
        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);
        if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.connect(gain);
        gain.connect(audioCtx.destination);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
      }

      function spawnHazard(initial = false) {
        const edge = Math.floor(Math.random() * 4);
        const radius = rand(11, Math.min(30, 17 + level * 1.2));
        const speed = rand(38, 60) + level * 8;
        let x;
        let y;
        if (edge === 0) { x = rand(0, W); y = -radius - 8; }
        if (edge === 1) { x = W + radius + 8; y = rand(0, H); }
        if (edge === 2) { x = rand(0, W); y = H + radius + 8; }
        if (edge === 3) { x = -radius - 8; y = rand(0, H); }

        if (initial) {
          let attempts = 0;
          do {
            x = rand(radius + 10, Math.max(radius + 11, W - radius - 10));
            y = rand(radius + 10, Math.max(radius + 11, H - radius - 10));
            attempts++;
          } while (Math.hypot(x - player.x, y - player.y) < 150 && attempts < 20);
        }

        const targetX = initial ? rand(W * 0.2, W * 0.8) : player.x + rand(-90, 90);
        const targetY = initial ? rand(H * 0.2, H * 0.8) : player.y + rand(-90, 90);
        const angle = Math.atan2(targetY - y, targetX - x) + rand(-0.25, 0.25);
        const points = [];
        const sides = Math.floor(rand(6, 10));
        for (let i = 0; i < sides; i++) {
          points.push({
            angle: (i / sides) * TAU,
            radius: radius * rand(0.72, 1.1)
          });
        }

        hazards.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: radius,
          angle: rand(0, TAU),
          vr: rand(-0.75, 0.75),
          points,
          hp: radius > 24 ? 2 : 1
        });
      }

      function spawnPickup(initial = false) {
        let x = 0;
        let y = 0;
        let attempts = 0;
        do {
          x = rand(38, Math.max(39, W - 38));
          y = rand(70, Math.max(71, H - 38));
          attempts++;
        } while (attempts < 18 && (
          Math.hypot(x - player.x, y - player.y) < 80 ||
          hazards.some(item => Math.hypot(x - item.x, y - item.y) < item.r + 38)
        ));

        pickups.push({
          type: "star",
          x,
          y,
          vx: rand(-5, 5),
          vy: rand(-5, 5),
          r: 8,
          phase: rand(0, TAU),
          age: initial ? rand(0, 0.65) : 0,
          life: rand(7.2, 11.5),
          active: true
        });
      }

      function spawnRepair() {
        const x = rand(W * 0.12, W * 0.88);
        const y = rand(H * 0.15, H * 0.82);
        pickups.push({
          type: "repair",
          x,
          y,
          vx: 0,
          vy: 0,
          r: 12,
          phase: rand(0, TAU),
          age: 0,
          life: 8,
          active: true
        });
        showToast("补给舱出现");
        playTone(660, 0.08, "sine", 0.025);
      }

      function spawnShield() {
        const x = rand(W * 0.12, W * 0.88);
        const y = rand(H * 0.15, H * 0.82);
        pickups.push({
          type: "shield",
          x,
          y,
          vx: 0,
          vy: 0,
          r: 12,
          phase: rand(0, TAU),
          age: 0,
          life: 9,
          active: true
        });
        showToast("发现护盾电池");
        playTone(720, 0.08, "triangle", 0.022);
      }

      function emitParticles(x, y, color, count, speed = 150, size = 2.4) {
        for (let i = 0; i < count; i++) {
          const angle = rand(0, TAU);
          const velocity = rand(speed * 0.25, speed);
          particles.push({
            x,
            y,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity,
            life: rand(0.25, 0.7),
            maxLife: 0.7,
            size: rand(1, size),
            color
          });
        }
      }

      function addShockwave(x, y, color, maxRadius = 50) {
        shockwaves.push({ x, y, r: 3, maxRadius, life: 0.42, color });
      }

      function collectPickup(item) {
        item.active = false;
        if (item.type === "repair") {
          if (hull < 3) hull++;
          else score += 35;
          emitParticles(item.x, item.y, "#65f5ca", 24, 165, 3);
          addShockwave(item.x, item.y, "#65f5ca", 58);
          showToast(hull < 3 ? "船体修复" : "满舱补给 +35");
          playTone(520, 0.1, "sine", 0.025);
          setTimeout(() => playTone(780, 0.16, "sine", 0.025), 55);
        } else if (item.type === "shield") {
          if (shieldCharges < 1) {
            shieldCharges = 1;
            showToast("护盾已充能");
          } else {
            score += 75;
            showToast("护盾已满 +75");
          }
          emitParticles(item.x, item.y, "#7ed3ff", 28, 190, 3.2);
          addShockwave(item.x, item.y, "#7ed3ff", 64);
          playTone(470, 0.1, "triangle", 0.026);
          setTimeout(() => playTone(730, 0.17, "sine", 0.026), 60);
        } else {
          const gain = Math.round(10 * combo);
          score += gain;
          combo = Math.min(5, combo + 0.25);
          comboTimer = 2.7;
          emitParticles(item.x, item.y, "#ffd166", 16, 135, 2.8);
          addShockwave(item.x, item.y, "#ffd166", 34);
          playTone(500 + combo * 42, 0.08, "sine", 0.028);
          pickupRespawnTimer = 0.25;
        }
        updateHud();
      }

      function hitHazard(item) {
        if (player.dash > 0) {
          item.hp -= 2;
          emitParticles(item.x, item.y, "#ffb35c", 20, 180, 3.4);
          addShockwave(item.x, item.y, "#ffb35c", item.r + 20);
          if (item.hp <= 0) {
            item.dead = true;
            score += 5;
            playTone(180, 0.06, "square", 0.018, 95);
          }
          return;
        }

        if (player.invulnerable > 0) return;

        if (shieldCharges > 0) {
          item.dead = true;
          shieldCharges--;
          player.invulnerable = 0.9;
          shake = 9;
          emitParticles(player.x, player.y, "#7ed3ff", 34, 235, 4);
          addShockwave(player.x, player.y, "#7ed3ff", 76);
          playTone(240, 0.16, "triangle", 0.035, 700);
          showToast("护盾吸收冲击");
          updateHud();
          return;
        }

        hull--;
        combo = 1;
        comboTimer = 0;
        player.invulnerable = 1.55;
        item.dead = true;
        shake = 15;
        screenFlash = 0.65;
        emitParticles(player.x, player.y, "#ff647c", 32, 235, 4.2);
        emitParticles(item.x, item.y, "#ffad68", 18, 150, 3.2);
        addShockwave(player.x, player.y, "#ff647c", 82);
        playTone(95, 0.22, "sawtooth", 0.04, 45);
        updateHud();
        if (hull <= 0) {
          setTimeout(endGame, 120);
        } else {
          showToast("船体受损");
        }
      }

      function triggerDash() {
        if (state !== "playing" || player.dashCooldown > 0) return;
        let dx = 0;
        let dy = 0;
        if (pointer.active) {
          dx = pointer.x - player.x;
          dy = pointer.y - player.y;
        }
        if (Math.hypot(dx, dy) < 8) {
          dx = player.vx;
          dy = player.vy;
        }
        if (Math.hypot(dx, dy) < 4) {
          dx = Math.cos(player.angle);
          dy = Math.sin(player.angle);
        }
        const length = Math.hypot(dx, dy) || 1;
        player.dashX = dx / length;
        player.dashY = dy / length;
        player.vx = player.dashX * 820;
        player.vy = player.dashY * 820;
        player.dash = 0.23;
        player.dashCooldown = 2.7;
        player.invulnerable = Math.max(player.invulnerable, 0.26);
        addShockwave(player.x, player.y, "#66f7ff", 44);
        emitParticles(player.x, player.y, "#66f7ff", 18, 160, 2.7);
        playTone(260, 0.12, "triangle", 0.03, 520);
      }

      function handleKeyboard(dt) {
        const ax = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) -
                   (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
        const ay = (keys.has("ArrowDown") || keys.has("KeyS") ? 1 : 0) -
                   (keys.has("ArrowUp") || keys.has("KeyW") ? 1 : 0);
        const hasKeys = ax !== 0 || ay !== 0;

        if (hasKeys) {
          pointer.active = false;
          const length = Math.hypot(ax, ay) || 1;
          player.vx += (ax / length) * 1250 * dt;
          player.vy += (ay / length) * 1250 * dt;
        } else if (pointer.active) {
          const dx = pointer.x - player.x;
          const dy = pointer.y - player.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 7) {
            const acceleration = Math.min(1450, distance * 10);
            player.vx += (dx / distance) * acceleration * dt;
            player.vy += (dy / distance) * acceleration * dt;
          }
        }

        if (!hasKeys && !pointer.active) {
          const damping = Math.pow(player.dash > 0 ? 0.08 : 0.018, dt);
          player.vx *= damping;
          player.vy *= damping;
        } else {
          player.vx *= Math.pow(0.36, dt);
          player.vy *= Math.pow(0.36, dt);
        }

        const speed = Math.hypot(player.vx, player.vy);
        const maxSpeed = player.dash > 0 ? 860 : 390;
        if (speed > maxSpeed) {
          player.vx = (player.vx / speed) * maxSpeed;
          player.vy = (player.vy / speed) * maxSpeed;
        }

        player.x += player.vx * dt;
        player.y += player.vy * dt;

        const margin = player.r + 5;
        if (player.x < margin) { player.x = margin; player.vx = Math.abs(player.vx) * 0.45; }
        if (player.x > W - margin) { player.x = W - margin; player.vx = -Math.abs(player.vx) * 0.45; }
        if (player.y < margin + 54) { player.y = margin + 54; player.vy = Math.abs(player.vy) * 0.45; }
        if (player.y > H - margin) { player.y = H - margin; player.vy = -Math.abs(player.vy) * 0.45; }

        if (Math.hypot(player.vx, player.vy) > 10) {
          player.angle = Math.atan2(player.vy, player.vx);
        }
      }

      function update(dt) {
        for (const star of stars) {
          star.y += (star.speed + (state === "playing" ? level * 1.5 : 0)) * dt;
          if (star.y > H + 2) {
            star.y = -2;
            star.x = Math.random() * W;
          }
        }
        for (const cloud of dust) cloud.angle += dt * 0.003;

        if (state === "menu") {
          const t = performance.now() * 0.00025;
          player.x = W * 0.5 + Math.cos(t) * Math.min(90, W * 0.1);
          player.y = H * 0.56 + Math.sin(t * 1.2) * 25;
          player.angle = t * 2;
          return;
        }

        if (state !== "playing") {
          particles.forEach(p => p.life = Math.min(p.life, 0.2));
          updateEffects(dt);
          return;
        }

        elapsed += dt;
        totalRunTime += dt;
        if (toastTimer > 0) {
          toastTimer -= dt;
          if (toastTimer <= 0) toast.classList.remove("show");
        }
        if (comboTimer > 0) {
          comboTimer -= dt;
          if (comboTimer <= 0) combo = 1;
        }
        if (player.invulnerable > 0) player.invulnerable -= dt;
        if (player.dash > 0) player.dash -= dt;
        if (player.dashCooldown > 0) {
          player.dashCooldown = Math.max(0, player.dashCooldown - dt);
          if (player.dashCooldown === 0) {
            dashReadyFlash = 0.4;
            playTone(720, 0.06, "sine", 0.015);
          }
        }
        if (dashReadyFlash > 0) dashReadyFlash -= dt;

        const newLevel = 1 + Math.floor(elapsed / 18);
        if (newLevel !== level) {
          level = newLevel;
          showToast(`航区 ${String(level).padStart(2, "0")} · 速度提升`);
          addShockwave(player.x, player.y, "#9d7bff", 110);
          playTone(330, 0.09, "triangle", 0.025);
          setTimeout(() => playTone(495, 0.14, "triangle", 0.025), 75);
        }

        handleKeyboard(dt);
        updateEffects(dt);

        const targetHazards = Math.min(20, 5 + level * 2);
        hazardSpawnTimer -= dt;
        if (hazardSpawnTimer <= 0 && hazards.length < targetHazards) {
          spawnHazard();
          hazardSpawnTimer = Math.max(0.28, 1.1 - level * 0.055) * rand(0.72, 1.2);
        }

        const goldCount = pickups.filter(item => item.active && item.type === "star").length;
        if (pickupRespawnTimer > 0) pickupRespawnTimer -= dt;
        if (goldCount < 4 + Math.min(2, Math.floor(level / 4)) && pickupRespawnTimer <= 0) {
          spawnPickup();
          pickupRespawnTimer = 0.24;
        }

        powerTimer -= dt;
        if (powerTimer <= 0) {
          if (!pickups.some(item => item.active && item.type === "repair")) spawnRepair();
          powerTimer = rand(13, 18);
        }

        const shieldActive = pickups.some(item => item.active && item.type === "shield");
        if (!shieldActive) {
          shieldPickupTimer -= dt;
          if (shieldPickupTimer <= 0) {
            spawnShield();
            shieldPickupTimer = rand(20, 26);
          }
        }

        for (const item of hazards) {
          item.x += item.vx * dt;
          item.y += item.vy * dt;
          item.angle += item.vr * dt;
          if (item.x < -item.r * 2.7 || item.x > W + item.r * 2.7 ||
              item.y < -item.r * 2.7 || item.y > H + item.r * 2.7) {
            item.dead = true;
          }
          if (!item.dead && Math.hypot(item.x - player.x, item.y - player.y) < item.r + player.r - 2) {
            hitHazard(item);
          }
        }

        for (const item of pickups) {
          item.phase += dt * 2.2;
          item.age += dt;
          item.x += item.vx * dt;
          item.y += item.vy * dt;
          item.x = clamp(item.x, 22, W - 22);
          item.y = clamp(item.y, 72, H - 22);
          if (item.type === "star" && item.age > item.life) item.active = false;
          if (item.type === "repair" && item.age > item.life) item.active = false;
          if (item.type === "shield" && item.age > item.life) item.active = false;
          if (item.active && Math.hypot(item.x - player.x, item.y - player.y) < item.r + player.r + 4) {
            collectPickup(item);
          }
        }

        for (let i = hazards.length - 1; i >= 0; i--) {
          if (hazards[i].dead) hazards.splice(i, 1);
        }
        for (let i = pickups.length - 1; i >= 0; i--) {
          if (!pickups[i].active || pickups[i].age > pickups[i].life + 0.2) pickups.splice(i, 1);
        }

        updateHud();
      }

      function updateEffects(dt) {
        if (shake > 0) shake = Math.max(0, shake - dt * 42);
        if (screenFlash > 0) screenFlash = Math.max(0, screenFlash - dt * 2.7);
        for (const p of particles) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= Math.pow(0.06, dt);
          p.vy *= Math.pow(0.06, dt);
          p.life -= dt;
        }
        for (let i = particles.length - 1; i >= 0; i--) {
          if (particles[i].life <= 0) particles.splice(i, 1);
        }
        for (const wave of shockwaves) {
          wave.life -= dt;
          wave.r += (wave.maxRadius - wave.r) * Math.min(1, dt * 9);
        }
        for (let i = shockwaves.length - 1; i >= 0; i--) {
          if (shockwaves[i].life <= 0) shockwaves.splice(i, 1);
        }
      }

      function drawBackground() {
        ctx.clearRect(0, 0, W, H);
        for (const cloud of dust) {
          ctx.save();
          ctx.translate(cloud.x, cloud.y);
          ctx.rotate(cloud.angle);
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, cloud.rx);
          gradient.addColorStop(0, `rgba(110, 92, 220, ${cloud.alpha})`);
          gradient.addColorStop(1, "rgba(54, 92, 160, 0)");
          ctx.scale(1, cloud.ry / cloud.rx);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, 0, cloud.rx, 0, TAU);
          ctx.fill();
          ctx.restore();
        }

        for (const star of stars) {
          ctx.globalAlpha = star.alpha;
          ctx.fillStyle = "#d8ebff";
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.r, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      function drawPickup(item) {
        const pulse = 1 + Math.sin(item.phase * 1.8) * 0.08;
        ctx.save();
        ctx.translate(item.x, item.y);

        if (item.type === "repair") {
          const alpha = item.age > item.life - 2 ? 0.35 + Math.sin(item.age * 16) * 0.25 : 1;
          ctx.globalAlpha = alpha;
          ctx.rotate(item.phase * 0.45);
          ctx.shadowColor = "#65f5ca";
          ctx.shadowBlur = 22;
          ctx.strokeStyle = "#65f5ca";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const angle = i * Math.PI / 2;
            const x = Math.cos(angle) * 15 * pulse;
            const y = Math.sin(angle) * 15 * pulse;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = "rgba(101, 245, 202, 0.18)";
          ctx.fill();
          ctx.rotate(-item.phase * 0.45);
          ctx.fillStyle = "#c9fff4";
          ctx.fillRect(-6, -1.6, 12, 3.2);
          ctx.fillRect(-1.6, -6, 3.2, 12);
        } else if (item.type === "shield") {
          const alpha = item.age > item.life - 2 ? 0.35 + Math.sin(item.age * 16) * 0.25 : 1;
          ctx.globalAlpha = alpha;
          ctx.rotate(item.phase * 0.45);
          ctx.shadowColor = "#7ed3ff";
          ctx.shadowBlur = 24;

          const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 22 * pulse);
          glow.addColorStop(0, "rgba(217, 245, 255, 0.95)");
          glow.addColorStop(0.35, "rgba(105, 191, 255, 0.55)");
          glow.addColorStop(1, "rgba(50, 110, 255, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(0, 0, 22 * pulse, 0, TAU);
          ctx.fill();

          ctx.strokeStyle = "#bce7ff";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = -Math.PI / 2 + i * Math.PI / 3;
            const x = Math.cos(angle) * 14 * pulse;
            const y = Math.sin(angle) * 14 * pulse;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();

          ctx.rotate(-item.phase * 0.45);
          ctx.fillStyle = "#e0f7ff";
          ctx.beginPath();
          ctx.moveTo(0, -7);
          ctx.lineTo(6, 0);
          ctx.lineTo(0, 7);
          ctx.lineTo(-6, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.rotate(item.phase * 0.25);
          ctx.shadowColor = "#ffd166";
          ctx.shadowBlur = 25;
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
          gradient.addColorStop(0, "rgba(255, 252, 217, 1)");
          gradient.addColorStop(0.2, "rgba(255, 209, 102, 0.95)");
          gradient.addColorStop(1, "rgba(255, 157, 63, 0)");
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, 0, 16 * pulse, 0, TAU);
          ctx.fill();
          ctx.shadowBlur = 11;
          ctx.fillStyle = "#fff6cf";
          ctx.beginPath();
          ctx.moveTo(0, -6.5 * pulse);
          ctx.quadraticCurveTo(1.8, -1.6, 6.5, 0);
          ctx.quadraticCurveTo(1.8, 1.6, 0, 6.5 * pulse);
          ctx.quadraticCurveTo(-1.8, 1.6, -6.5, 0);
          ctx.quadraticCurveTo(-1.8, -1.6, 0, -6.5 * pulse);
          ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      function drawHazard(item) {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.angle);
        ctx.shadowColor = "rgba(174, 111, 255, 0.25)";
        ctx.shadowBlur = 17;
        const gradient = ctx.createRadialGradient(-item.r * 0.28, -item.r * 0.28, 1, 0, 0, item.r * 1.1);
        gradient.addColorStop(0, "#5f5871");
        gradient.addColorStop(0.45, "#343449");
        gradient.addColorStop(1, "#151826");
        ctx.fillStyle = gradient;
        ctx.strokeStyle = "rgba(183, 166, 215, 0.3)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        item.points.forEach((point, index) => {
          const x = Math.cos(point.angle) * point.radius;
          const y = Math.sin(point.angle) * point.radius;
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255, 141, 96, 0.56)";
        ctx.beginPath();
        ctx.arc(-item.r * 0.22, -item.r * 0.18, Math.max(1.2, item.r * 0.09), 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 134, 86, 0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-item.r * 0.55, item.r * 0.05);
        ctx.lineTo(-item.r * 0.08, item.r * 0.2);
        ctx.lineTo(item.r * 0.12, item.r * 0.05);
        ctx.stroke();
        ctx.restore();
      }

      function drawShip() {
        const speed = Math.hypot(player.vx, player.vy);
        const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0;
        if (blink && state === "playing") return;

        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle + Math.PI / 2);

        if (shieldCharges > 0) {
          ctx.save();
          ctx.strokeStyle = "rgba(126, 211, 255, 0.75)";
          ctx.lineWidth = 1.4;
          ctx.shadowColor = "#7ed3ff";
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(0, 0, 25 + Math.sin(performance.now() * 0.004) * 2, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }

        if (speed > 30 || player.dash > 0) {
          const flame = clamp(speed / 260, 0.4, 2.1) + (player.dash > 0 ? 1.4 : 0);
          const flameGradient = ctx.createLinearGradient(0, 5, 0, 23 + flame * 12);
          flameGradient.addColorStop(0, "rgba(102, 247, 255, 0.9)");
          flameGradient.addColorStop(0.42, "rgba(72, 151, 255, 0.55)");
          flameGradient.addColorStop(1, "rgba(92, 72, 255, 0)");
          ctx.shadowColor = "#66f7ff";
          ctx.shadowBlur = 20;
          ctx.fillStyle = flameGradient;
          ctx.beginPath();
          ctx.moveTo(-6, 7);
          ctx.quadraticCurveTo(0, 22 + flame * 12, 6, 7);
          ctx.closePath();
          ctx.fill();
        }

        ctx.shadowColor = player.dash > 0 ? "#ffffff" : "#66f7ff";
        ctx.shadowBlur = player.dash > 0 ? 30 : 18;
        const bodyGradient = ctx.createLinearGradient(0, -15, 0, 14);
        bodyGradient.addColorStop(0, "#f1ffff");
        bodyGradient.addColorStop(0.3, "#94f8ff");
        bodyGradient.addColorStop(1, "#4089b9");
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(9, 6);
        ctx.lineTo(4.5, 3.5);
        ctx.lineTo(0, 9);
        ctx.lineTo(-4.5, 3.5);
        ctx.lineTo(-9, 6);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#102742";
        ctx.beginPath();
        ctx.ellipse(0, -3.2, 2.7, 5.3, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.85)";
        ctx.beginPath();
        ctx.arc(-0.8, -4.9, 0.8, 0, TAU);
        ctx.fill();
        ctx.restore();

        if (player.dash > 0) {
          ctx.save();
          ctx.globalAlpha = 0.32;
          ctx.strokeStyle = "#66f7ff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(player.x - player.dashX * 18, player.y - player.dashY * 18);
          ctx.lineTo(player.x - player.dashX * 60, player.y - player.dashY * 60);
          ctx.stroke();
          ctx.restore();
        }
      }

      function drawEffects() {
        for (const wave of shockwaves) {
          ctx.save();
          ctx.globalAlpha = clamp(wave.life / 0.42, 0, 1) * 0.55;
          ctx.strokeStyle = wave.color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(wave.x, wave.y, wave.r, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
        for (const p of particles) {
          ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      function drawComboArc() {
        if (state !== "playing" || comboTimer <= 0 || combo <= 1) return;
        const ratio = clamp(comboTimer / 2.7, 0, 1);
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.strokeStyle = combo >= 2.5 ? "rgba(255,111,181,.6)" : "rgba(255,209,102,.48)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 25, -Math.PI / 2, -Math.PI / 2 + TAU * ratio);
        ctx.stroke();
        ctx.restore();
      }

      function getDashControl() {
        const radius = clamp(Math.min(W, H) * 0.075, 34, 42);
        return {
          x: W - radius - 22,
          y: H - radius - 22,
          radius
        };
      }

      function drawDashControl() {
        if (state !== "playing") return;

        const control = getDashControl();
        const cooling = player.dashCooldown > 0.08;

        ctx.save();
        ctx.translate(control.x, control.y);

        const gradient = ctx.createRadialGradient(0, 0, 4, 0, 0, control.radius);
        gradient.addColorStop(0, "rgba(17, 60, 78, 0.92)");
        gradient.addColorStop(1, "rgba(6, 19, 32, 0.88)");

        ctx.globalAlpha = cooling ? 0.58 : 1;
        ctx.fillStyle = gradient;
        ctx.strokeStyle = cooling ? "rgba(116, 139, 173, 0.5)" : "rgba(102, 247, 255, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = cooling ? "transparent" : "#66f7ff";
        ctx.shadowBlur = cooling ? 0 : 18;

        ctx.beginPath();
        ctx.arc(0, 0, control.radius, 0, TAU);
        ctx.fill();
        ctx.stroke();

        if (cooling) {
          const progress = 1 - clamp(player.dashCooldown / 2.7, 0, 1);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "#66f7ff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, control.radius - 4, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
          ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.fillStyle = cooling ? "#9caac2" : "#e8ffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `800 ${cooling ? 14 : 13}px "Segoe UI", sans-serif`;
        ctx.fillText(cooling ? `${player.dashCooldown.toFixed(1)}s` : "冲刺", 0, 1);
        ctx.restore();
      }

      function render() {
        const originalTransform = ctx.getTransform();
        ctx.save();
        if (shake > 0.2) {
          ctx.translate(rand(-shake, shake) * 0.35, rand(-shake, shake) * 0.35);
        }
        drawBackground();

        if (state !== "menu") {
          pickups.forEach(drawPickup);
          hazards.forEach(drawHazard);
        }
        drawComboArc();
        drawShip();
        drawEffects();

        if (state === "menu") {
          ctx.save();
          ctx.strokeStyle = "rgba(102,247,255,.18)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(player.x, player.y, 42 + Math.sin(performance.now() * 0.002) * 4, 0, TAU);
          ctx.stroke();
          ctx.setLineDash([2, 9]);
          ctx.beginPath();
          ctx.arc(player.x, player.y, 63, performance.now() * 0.0007, TAU + performance.now() * 0.0007);
          ctx.stroke();
          ctx.restore();
        }

        if (screenFlash > 0) {
          ctx.fillStyle = `rgba(255, 68, 104, ${screenFlash * 0.12})`;
          ctx.fillRect(-30, -30, W + 60, H + 60);
        }
        if (dashReadyFlash > 0 && state === "playing") {
          ctx.save();
          ctx.globalAlpha = dashReadyFlash / 0.4;
          ctx.strokeStyle = "#66f7ff";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(player.x, player.y, 22 + (0.4 - dashReadyFlash) * 45, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
        ctx.setTransform(originalTransform);
        drawDashControl();
      }

      function loop(now) {
        const dt = clamp((now - lastTime) / 1000, 0, 0.034);
        lastTime = now;
        update(dt);
        render();
        requestAnimationFrame(loop);
      }

      function pointerPosition(event) {
        const rect = canvas.getBoundingClientRect();
        return {
          x: ((event.clientX - rect.left) / rect.width) * W,
          y: ((event.clientY - rect.top) / rect.height) * H
        };
      }

      canvas.addEventListener("pointerdown", event => {
        if (state !== "playing") return;
        event.preventDefault();
        const point = pointerPosition(event);

        const dashControl = getDashControl();
        if (Math.hypot(point.x - dashControl.x, point.y - dashControl.y) <= dashControl.radius + 8) {
          triggerDash();
          return;
        }

        pointer.x = point.x;
        pointer.y = point.y;
        pointer.active = true;
        pointer.id = event.pointerId;
        canvas.setPointerCapture?.(event.pointerId);
        addShockwave(point.x, point.y, "#66f7ff", 18);
      });

      canvas.addEventListener("pointermove", event => {
        if (state !== "playing" || !pointer.active || pointer.id !== event.pointerId) return;
        event.preventDefault();
        const point = pointerPosition(event);
        pointer.x = point.x;
        pointer.y = point.y;
      });

      const releasePointer = event => {
        if (pointer.id !== null && pointer.id !== event.pointerId) return;
        pointer.active = false;
        pointer.id = null;
      };
      canvas.addEventListener("pointerup", releasePointer);
      canvas.addEventListener("pointercancel", releasePointer);

      window.addEventListener("keydown", event => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
          event.preventDefault();
        }
        keys.add(event.code);
        if (event.code === "Space" && !event.repeat) triggerDash();
        if (event.code === "KeyP" && !event.repeat) togglePause();
        if (event.code === "KeyM" && !event.repeat) toggleSound();
        if (event.code === "Enter" && !event.repeat) {
          if (state === "menu" || state === "over") startGame();
          else if (state === "paused") resumeGame();
        }
      });

      window.addEventListener("keyup", event => keys.delete(event.code));
      window.addEventListener("blur", () => {
        keys.clear();
        if (state === "playing") pauseGame();
      });

      startBtn.addEventListener("click", startGame);
      restartBtn.addEventListener("click", startGame);
      menuBtn.addEventListener("click", returnToMenu);
      resumeBtn.addEventListener("click", resumeGame);
      pauseBtn.addEventListener("click", togglePause);
      dashBtn.addEventListener("pointerdown", event => {
        event.preventDefault();
        triggerDash();
      });
      soundBtn.addEventListener("click", toggleSound);

      function toggleSound() {
        soundEnabled = !soundEnabled;
        soundBtn.textContent = soundEnabled ? "声音：开" : "声音：关";
        soundBtn.setAttribute("aria-label", soundEnabled ? "关闭声音" : "打开声音");
        if (soundEnabled) {
          ensureAudio();
          playTone(520, 0.07, "sine", 0.02);
        }
      }

      window.addEventListener("resize", resizeCanvas);
      if ("ResizeObserver" in window) {
        new ResizeObserver(resizeCanvas).observe(stage);
      }

      resizeCanvas();
      requestAnimationFrame(loop);
    })();
