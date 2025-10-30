/* 
let = ArrayList, boolean,  (all declaration)
const = int, float
function = void
*/ 

// ==========================================
// ========== main ==========================

// ========== Global lists ==========
let platforms = [];
let spikes = [];
let holes = [];

// ========== Game objects ==========
let ball;
let goal;
let restartButton;
let backButton;

// ========== Game states ==========
const GAME_PLAYING = 0;
const GAME_CLEARED = 1;
const GAME_OVER = 2;
const GAME_PAUSED = 3;
let gameState = GAME_PLAYING;

// ========== Stage control ==========
let stage = 1; // 1 or 2 only

// ========== Input flags ==========
let leftPressed = false, rightPressed = false;

// ========== Base physics for ball ==========
const BASE_MOVE_SPEED = 2.0;
const BASE_GRAVITY = 1.0;
const BASE_JUMP = 15.0;

// ========== BGM =========================
let bgm;
let bgmCurrent = 0.0, bgmTarget = 0.0;
const BGM_MAX = 0.6;
let hasBgm = false; // guard if file is missing

// (Optional) Try to load in preload so it's ready by setup
function preload() {
  if (typeof loadSound === "function") {
    try {
      bgm = loadSound("bgm.mp3",
        () => { hasBgm = true; },
        () => { hasBgm = false; }
      );
    } catch (e) {
      hasBgm = false;
    }
  }
}

// ========== Setup ===================
function setup() {
  createCanvas(800, 450);
  buildStage(stage);
  restartButton = new UIButton(width - 120, 12, 100, 32, "RESTART");
  backButton    = new UIButton(width - 240, 12, 100, 32, "<-");

  // try to start BGM (safe guard)
  try {
    if (hasBgm && bgm) {
      if (!bgm.isPlaying()) bgm.loop();
      bgm.amp(0);
    }
  } catch (e) {
    hasBgm = false;
  }
}

// ========== draw ====================
function draw() {
  background(255);

  // --- WORLD: update when playing ---
  if (gameState === GAME_PLAYING) {
    // holes
    for (const h of holes) h.update();
    // ball
    const dir = (rightPressed ? 1 : 0) - (leftPressed ? 1 : 0);
    ball.update(dir, platforms, holes);
    // spikes collision
    for (const s of spikes) {
      s.update();
      if (s.active && s.hits(ball)) gameState = GAME_OVER;
    }
    // goal check (stages 1–2 only)
    if (goal && goal.reached(ball)) {
      gameState = GAME_CLEARED;
    }
  }

  // --- WORLD: draw everything ---
  for (const p of platforms) p.draw();
  for (const h of holes) h.draw();
  for (const s of spikes) s.draw();
  ball.draw();
  if (goal) goal.draw();

  // --- UI overlays ---
  if (gameState === GAME_PAUSED) {
    fill(0, 0, 0, 100);
    noStroke();
    rect(0, 0, width, height);
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(40);
    text("PAUSED", width/2, height/2);
    textSize(18);
    text("Press SPACE to resume", width/2, height/2 + 28);
  } else if (gameState === GAME_CLEARED) {
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(36);
    if (stage === 1) {
      text("STAGE 1 COMPLETE!\nPress any key for Stage 2", width/2, height/2);
    } else {
      text("GAME CLEAR!\nPress any key to restart", width/2, height/2);
    }
  } else if (gameState === GAME_OVER) {
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(36);
    text("GAME OVER\nPress any key to restart", width/2, height/2);
  }

  // --- HUD ---
  fill(0);
  textAlign(LEFT, TOP);
  textSize(14);
  text("← → move, SPACE: pause/resume", 10, 8);

  // --- BGM fade ---
  if (hasBgm && bgm) {
    if (gameState === GAME_PLAYING) bgmTarget = BGM_MAX;
    else if (gameState === GAME_CLEARED) bgmTarget = 0.35;
    else bgmTarget = 0.0;
    bgmCurrent = lerp(bgmCurrent, bgmTarget, 0.08);
    bgm.amp(bgmCurrent);
  }
}

// ========== Key pressed ==========
function keyPressed() {
  // cleared → go next or restart
  if (gameState === GAME_CLEARED) {
    if (stage === 1) {
      stage = 2;                  // 1 → 2
    } else {
      stage = 1;                  // 2 → 1 (no stage 3)
    }
    buildStage(stage);
    gameState = GAME_PLAYING;
    return;
  }

  // game over → restart same stage
  if (gameState === GAME_OVER) {
    buildStage(stage);
    gameState = GAME_PLAYING;
    return;
  }

  // pause toggle
  if (key === ' ') {
    if (gameState === GAME_PLAYING) gameState = GAME_PAUSED;
    else if (gameState === GAME_PAUSED) gameState = GAME_PLAYING;
    return;
  }

  // movement flags
  if (keyCode === LEFT_ARROW)  leftPressed = true;
  if (keyCode === RIGHT_ARROW) rightPressed = true;
}

// ========== Key released ==========
function keyReleased() {
  if (keyCode === LEFT_ARROW)  leftPressed = false;
  if (keyCode === RIGHT_ARROW) rightPressed = false;
}

// ========== Mouse click ==========
function mousePressed() {
  if (restartButton && restartButton.contains(mouseX, mouseY)) {
    buildStage(stage);
    gameState = GAME_PLAYING;
  }
}

// ================================================
// ================== Ball Class ==================

// Simple ball with auto-jump on landing
class Ball {
  constructor(x, y, r) {
    this.x = x; this.y = y; this.r = r;
    this.vy = 0;
    this.grounded = false;

    this.moveSpeed = BASE_MOVE_SPEED;
    this.gravity = BASE_GRAVITY;
    this.jumpPower = BASE_JUMP;
    this.jumpDelay = 100;      // delay before auto jump
    this.lastJumpTime = 0;

    // optional double-jump (kept simple)
    this.doubleProb = 0.25;
    this.doubleMinDelay = 120;
    this.doubleMaxDelay = 260;
    this.doubleMult = 1.5;
    this.scheduledDoubleAt = -1;
    this.willDouble = false;
    this.doubleUsed = false;
  }

  holeOpenAt(holes, p, px) {
    for (const h of holes) {
      if (h.p === p && h.active) {
        if (px >= h.x && px <= h.x + h.w) return true;
      }
    }
    return false;
  }

  update(dir, plats, holes) {
    // horizontal by key
    if (leftPressed)  this.x -= this.moveSpeed;
    if (rightPressed) this.x += this.moveSpeed;
    this.x = constrain(this.x, this.r, width - this.r);

    // gravity
    this.vy += this.gravity;
    this.y += this.vy;

    // landing detect
    const falling = (this.vy >= 0);
    let landed = null;
    let bestTop = Number.POSITIVE_INFINITY;
    const epsX = 2.5, epsY = 2.5;

    if (falling) {
      for (const p of plats) {
        const topY = p.y - this.r;
        const withinX  = (this.x >= p.x - epsX && this.x <= p.x + p.w + epsX);
        const onTopBand = (this.y >= topY - epsY);
        if (withinX && onTopBand) {
          if (this.holeOpenAt(holes, p, this.x)) continue;
          if (topY < bestTop) {
            bestTop = topY;
            landed = p;
          }
        }
      }
    }

    if (landed) {
      this.y = bestTop;
      this.vy = 0;
      this.grounded = true;
      this.willDouble = false;
      this.doubleUsed = false;
      this.scheduledDoubleAt = -1;
    } else {
      this.grounded = false;
    }

    // auto-jump when grounded for a moment
    if (this.grounded && millis() - this.lastJumpTime >= this.jumpDelay) {
      this.vy = -this.jumpPower;
      this.grounded = false;
      this.lastJumpTime = millis();

      // schedule double-jump sometimes
      this.willDouble = (random(1) < this.doubleProb);
      this.doubleUsed = false;
      if (this.willDouble) {
        this.scheduledDoubleAt = this.lastJumpTime + int(random(this.doubleMinDelay, this.doubleMaxDelay));
      } else {
        this.scheduledDoubleAt = -1;
      }
    }

    // fire double-jump in air
    if (!this.grounded && this.willDouble && !this.doubleUsed && this.scheduledDoubleAt > 0
        && millis() >= this.scheduledDoubleAt) {
      this.vy = -this.jumpPower * this.doubleMult;
      this.doubleUsed = true;
      this.scheduledDoubleAt = -1;
    }

    // basic fall-out fail-safe
    if (this.y - this.r > height + 80) {
      gameState = GAME_OVER;
    }
  }

  draw() {
    // simple hint ring before double-jump
    if (!this.grounded && this.willDouble && !this.doubleUsed && this.scheduledDoubleAt > 0) {
      const dt = this.scheduledDoubleAt - millis();
      if (dt <= 80 && dt > 0) {
        push();
        noFill();
        stroke(255, 100);
        strokeWeight(2);
        ellipse(this.x, this.y, this.r*2.6, this.r*2.6);
        pop();
      }
    }
    // ball
    noStroke();
    fill(255, 160, 180);
    ellipse(this.x, this.y, this.r*2, this.r*2);
  }
}

// ================================================
// ================== Goal Class ==================

// Simple rectangular goal with flag
class Goal {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
  }

  reached(b) {
    const cx = constrain(b.x, this.x, this.x + this.w);
    const cy = constrain(b.y, this.y, this.y + this.h);
    const dx = b.x - cx, dy = b.y - cy;
    return dx*dx + dy*dy <= b.r*b.r;
  }

  draw() {
    noStroke();
    fill(80);
    rect(this.x + this.w, this.y, this.w * 0.2, this.h); // pole
    fill(255, 180, 60);
    const poleX = this.x + this.w;
    triangle(poleX, this.y + 8, poleX + 50, this.y + 20, poleX, this.y + 30);
  }
}

// ================================================
// ================== Hole Class ==================

// Blinking hole on a platform
class Hole {
  constructor(p, x, w, period, openMs) {
    this.p = p;
    this.x = x;
    this.w = w;
    this.period = period;
    this.openMs = openMs;
    this.phase = int(random(0, period));
    this.active = false;
  }

  update() {
    const t = (millis() + this.phase) % this.period;
    this.active = (t < this.openMs);
  }

  draw() {
    if (!this.active) return;
    noStroke();
    fill(255);
    rect(this.x, this.p.y, this.w, this.p.h);
    stroke(200);
    noFill();
    rect(this.x, this.p.y, this.w, this.p.h);
  }
}

// ================================================
// ================== Platform Class ==============

// Static platform rectangle
class Platform {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
  }
  draw() {
    noStroke();
    fill(70, 120, 255);
    rect(this.x, this.y, this.w, this.h);
  }
}

// ================================================
// ================== Button Class ================

// Simple UI button
class UIButton {
  constructor(x, y, w, h, label) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.label = label;
  }

  draw() {
    noStroke();
    fill(240);
    rect(this.x, this.y, this.w, this.h, 10);
    stroke(120);
    noFill();
    rect(this.x, this.y, this.w, this.h, 10);
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(14);
    text(this.label, this.x + this.w/2, this.y + this.h/2);
  }

  contains(mx, my) {
    return (mx >= this.x && mx <= this.x + this.w && my >= this.y && my <= this.y + this.h);
  }
}

// ================================================
// ================== Spike Class =================

// Pop-up spike with simple timer
class Spike {
  constructor(x, baseY) {
    this.x = x;
    this.baseY = baseY;
    this.w = 18;
    this.h = 20;

    this.period = 1000;    // full cycle
    this.upTime = 600;     // time active
    this.phase = int(random(0, this.period));
    this.active = false;
  }

  update() {
    const t = (millis() + this.phase) % this.period;
    this.active = (t < this.upTime);
  }

  hits(b) {
    if (!this.active) return false;
    const left = this.x - this.w*0.5;
    const right = this.x + this.w*0.5;
    const top = this.baseY - this.h*0.7; // lower hitbox top for easier game
    const bottom = this.baseY;

    const cx = constrain(b.x, left, right);
    const cy = constrain(b.y, top, bottom);
    const dx = b.x - cx, dy = b.y - cy;
    return dx*dx + dy*dy <= b.r*b.r;
  }

  draw() {
    if (!this.active) return;
    noStroke();
    fill(200, 40, 40);
    const x1 = this.x - this.w/2, x2 = this.x + this.w/2;
    triangle(x1, this.baseY, x2, this.baseY, this.x, this.baseY - this.h);
  }
}

// ================================================
// ================== Build Stage Class ===========

// ========== Build stage 1 or 2 ==========
function buildStage(level) {
  platforms = [];
  spikes = [];
  holes = [];
  goal = null;

  if (level === 1) {
    // base floor
    const x = 50, y = height - 100, w = width - 100, h = 20;
    platforms.push(new Platform(x, y, w, h));
    // ball spawn
    ball = new Ball(x + 40, y - 100, 10);
    // goal at right side
    goal = new Goal(x + w - 40, y - 100, 20, 100);
    return;
  }

  if (level === 2) {
    // multi-step slope
    let x = 70, y = height - 90, h = 20;
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const w = (i === 0) ? 220 : max(80, 150 - i*12);
      const pf = new Platform(x, y, w, h);
      platforms.push(pf);

      // random hole (skip first)
      if (i > 0 && random(1) < 0.3) {
        const margin = 20;
        const hw = random(40, 70);
        const hx = pf.x + random(margin, pf.w - margin - hw);
        const period = int(random(1500, 2500));
        const openMS = int(random(600, 900));
        holes.push(new Hole(pf, hx, hw, period, openMS));
      }

      // random spike (skip first)
      if (i > 0 && random(1) < 0.6) {
        const sx = pf.x + random(20, pf.w - 20);
        spikes.push(new Spike(sx, pf.y));
      }

      // step offset
      x += 95;
      y -= 50;
    }

    // ball on first platform
    const first = platforms[0];
    ball = new Ball(first.x + 40, first.y - 100, 10);

    // goal on last platform
    const last = platforms[platforms.length - 1];
    goal = new Goal(last.x + last.w - 40, last.y - 100, 20, 100);
    return;
  }
}
