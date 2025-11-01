// ========== Global lists ==========
ArrayList<Platform> platforms = new ArrayList<Platform>();
ArrayList<Spike> spikes = new ArrayList<Spike>();
ArrayList<Hole> holes = new ArrayList<Hole>();

// ========== Game objects ==========
Ball ball;
Goal goal;
UIButton restartButton;
UIButton backButton;

// ========== Game states ==========
int GAME_PLAYING = 0;
int GAME_CLEARED = 1;
int GAME_OVER = 2;
int GAME_PAUSED = 3;
int gameState = GAME_PLAYING;

// ========== Stage control ==========
int stage = 1; // 1 or 2 only

// ========== Input flags ==========
boolean leftPressed = false, rightPressed = false;

// ========== Base physics for ball ==========
float BASE_MOVE_SPEED = 2.0;
float BASE_GRAVITY = 1.0;
float BASE_JUMP = 15.0;

// ========== BGM =========================
import processing.sound.*;
SoundFile bgm;
float bgmCurrent = 0.0, bgmTarget = 0.0;
final float BGM_MAX = 0.6;
boolean hasBgm = false; // guard if file is missing

// ========== Setup ==========
void setup() {
  size(800, 450);
  buildStage(stage);
  restartButton = new UIButton(width - 120, 12, 100, 32, "RESTART");
  backButton    = new UIButton(width - 240, 12, 100, 32, "<-");

  // try to load BGM (safe guard)
  try {
    bgm = new SoundFile(this, "bgm.mp3");
    bgm.loop();
    bgm.amp(0);
    hasBgm = true;
  } catch (Exception e) {
    hasBgm = false;
  }
}

// ========== draw ==========
void draw() {
  background(255);

  // --- WORLD: update when playing ---
  if (gameState == GAME_PLAYING) {
    // holes
    for (Hole h : holes) h.update();
    // ball
    float dir = (rightPressed ? 1 : 0) - (leftPressed ? 1 : 0);
    ball.update(dir, platforms, holes);
    // spikes collision
    for (Spike s : spikes) {
      s.update();
      if (s.active && s.hits(ball)) gameState = GAME_OVER;
    }
    // goal check (stages 1–2 only)
    if (goal != null && goal.reached(ball)) {
      gameState = GAME_CLEARED;
    }
  }

  // --- WORLD: draw everything ---
  for (Platform p : platforms) p.draw();
  for (Hole h : holes) h.draw();
  for (Spike s : spikes) s.draw();
  ball.draw();
  if (goal != null) goal.draw();

  // --- UI overlays ---
  if (gameState == GAME_PAUSED) {
    fill(0, 0, 0, 100);
    noStroke();
    rect(0, 0, width, height);
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(40);
    text("PAUSED", width/2, height/2);
    textSize(18);
    text("Press SPACE to resume", width/2, height/2 + 28);
  } else if (gameState == GAME_CLEARED) {
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(36);
    if (stage == 1) {
      text("STAGE 1 COMPLETE!\nPress any key for Stage 2", width/2, height/2);
    } else {
      text("GAME CLEAR!\nPress any key to restart", width/2, height/2);
    }
  } else if (gameState == GAME_OVER) {
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
  if (hasBgm) {
    if (gameState == GAME_PLAYING) bgmTarget = BGM_MAX;
    else if (gameState == GAME_CLEARED) bgmTarget = 0.35;
    else bgmTarget = 0.0;
    bgmCurrent = lerp(bgmCurrent, bgmTarget, 0.08);
    bgm.amp(bgmCurrent);
  }
}

// ========== Key pressed ==========
void keyPressed() {
  // cleared → go next or restart
  if (gameState == GAME_CLEARED) {
    if (stage == 1) {
      stage = 2;                  // 1 → 2
    } else {
      stage = 1;                  // 2 → 1 (no stage 3)
    }
    buildStage(stage);
    gameState = GAME_PLAYING;
    return;
  }

  // game over → restart same stage
  if (gameState == GAME_OVER) {
    buildStage(stage);
    gameState = GAME_PLAYING;
    return;
  }

  // pause toggle
  if (key == ' ') {
    if (gameState == GAME_PLAYING) gameState = GAME_PAUSED;
    else if (gameState == GAME_PAUSED) gameState = GAME_PLAYING;
    return;
  }

  // movement flags
  if (key == CODED) {
    if (keyCode == LEFT)  leftPressed = true;
    if (keyCode == RIGHT) rightPressed = true;
  }
}

// ========== Key released ==========
void keyReleased() {
  if (key == CODED) {
    if (keyCode == LEFT)  leftPressed = false;
    if (keyCode == RIGHT) rightPressed = false;
  }
}

// ========== Mouse click ==========
void mousePressed() {
  if (restartButton != null && restartButton.contains(mouseX, mouseY)) {
    buildStage(stage);
    gameState = GAME_PLAYING;
  }
}
// ==================================== Class =================================
// ==================================== Ball Class ============================
// Simple ball with auto-jump on landing
class Ball {
  float x, y, r;
  float vy = 0;
  boolean grounded = false;

  float moveSpeed = BASE_MOVE_SPEED;
  float gravity = BASE_GRAVITY;
  float jumpPower = BASE_JUMP;
  int jumpDelay = 100;      // delay before auto jump
  int lastJumpTime = 0;

  // optional double-jump (kept simple)
  float doubleProb = 0.25;
  int doubleMinDelay = 120;
  int doubleMaxDelay = 260;
  float doubleMult = 1.5;
  int scheduledDoubleAt = -1;
  boolean willDouble = false;
  boolean doubleUsed = false;

  Ball(float x, float y, float r) {
    this.x = x; this.y = y; this.r = r;
  }

  boolean holeOpenAt(ArrayList<Hole> holes, Platform p, float px) {
    for (Hole h : holes) {
      if (h.p == p && h.active) {
        if (px >= h.x && px <= h.x + h.w) return true;
      }
    }
    return false;
  }

  void update(float dir, ArrayList<Platform> plats, ArrayList<Hole> holes) {
    // horizontal by key
    if (leftPressed)  x -= moveSpeed;
    if (rightPressed) x += moveSpeed;
    x = constrain(x, r, width - r);

    // gravity
    vy += gravity;
    y += vy;

    // landing detect
    boolean falling = (vy >= 0);
    Platform landed = null;
    float bestTop = Float.POSITIVE_INFINITY;
    float epsX = 2.5, epsY = 2.5;

    if (falling) {
      for (Platform p : plats) {
        float topY = p.y - r;
        boolean withinX  = (x >= p.x - epsX && x <= p.x + p.w + epsX);
        boolean onTopBand = (y >= topY - epsY);
        if (withinX && onTopBand) {
          if (holeOpenAt(holes, p, x)) continue;
          if (topY < bestTop) {
            bestTop = topY;
            landed = p;
          }
        }
      }
    }

    if (landed != null) {
      y = bestTop;
      vy = 0;
      grounded = true;
      willDouble = false;
      doubleUsed = false;
      scheduledDoubleAt = -1;
    } else {
      grounded = false;
    }

    // auto-jump when grounded for a moment
    if (grounded && millis() - lastJumpTime >= jumpDelay) {
      vy = -jumpPower;
      grounded = false;
      lastJumpTime = millis();

      // schedule double-jump sometimes
      willDouble = (random(1) < doubleProb);
      doubleUsed = false;
      if (willDouble) {
        scheduledDoubleAt = lastJumpTime + int(random(doubleMinDelay, doubleMaxDelay));
      } else {
        scheduledDoubleAt = -1;
      }
    }

    // fire double-jump in air
    if (!grounded && willDouble && !doubleUsed && scheduledDoubleAt > 0
        && millis() >= scheduledDoubleAt) {
      vy = -jumpPower * doubleMult;
      doubleUsed = true;
      scheduledDoubleAt = -1;
    }

    // basic fall-out fail-safe
    if (y - r > height + 80) {
      gameState = GAME_OVER;
    }
  }

  void draw() {
    // simple hint ring before double-jump
    if (!grounded && willDouble && !doubleUsed && scheduledDoubleAt > 0) {
      int dt = scheduledDoubleAt - millis();
      if (dt <= 80 && dt > 0) {
        pushStyle();
        noFill();
        stroke(255, 100);
        strokeWeight(2);
        ellipse(x, y, r*2.6, r*2.6);
        popStyle();
      }
    }
    // ball
    noStroke();
    fill(255, 160, 180);
    ellipse(x, y, r*2, r*2);
  }
}
// ================================== Hole Class ===================================
// Blinking hole on a platform
class Hole {
  Platform p;
  float x;
  float w;
  int period;
  int openMs;
  int phase;
  boolean active = false;

  Hole(Platform p, float x, float w, int period, int openMs) {
    this.p = p; this.x = x; this.w = w;
    this.period = period; this.openMs = openMs;
    this.phase = int(random(0, period));
  }

  void update() {
    int t = (millis() + phase) % period;
    active = (t < openMs);
  }

  void draw() {
    if (!active) return;
    noStroke();
    fill(255);
    rect(x, p.y, w, p.h);
    stroke(200);
    noFill();
    rect(x, p.y, w, p.h);
  }
}

// ================================== Platform Class ===================================
// Static platform rectangle
class Platform {
  float x, y, w, h;
  Platform(float x, float y, float w, float h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
  }
  void draw() {
    noStroke();
    fill(70, 120, 255);
    rect(x, y, w, h);
  }
}

// ================================== Button Class ======================================
// Simple UI button
class UIButton {
  float x, y, w, h;
  String label;

  UIButton(float x, float y, float w, float h, String label) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.label = label;
  }

  void draw() {
    noStroke();
    fill(240);
    rect(x, y, w, h, 10);
    stroke(120);
    noFill();
    rect(x, y, w, h, 10);
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(14);
    text(label, x + w/2, y + h/2);
  }

  boolean contains(float mx, float my) {
    return (mx >= x && mx <= x + w && my >= y && my <= y + h);
  }
}

// ================================== Spike Class ======================================
// Pop-up spike with simple timer
class Spike {
  float x;
  float baseY;
  float w = 18;
  float h = 20;

  int period = 1000;    // full cycle
  int upTime = 600;     // time active
  int phase = int(random(0, period));
  boolean active = false;

  Spike(float x, float baseY) {
    this.x = x;
    this.baseY = baseY;
  }

  void update() {
    int t = (millis() + phase) % period;
    active = (t < upTime);
  }

  boolean hits(Ball b) {
    if (!active) return false;
    float left = x - w*0.5;
    float right = x + w*0.5;
    float top = baseY - h*0.7; // lower hitbox top for easier game
    float bottom = baseY;

    float cx = constrain(b.x, left, right);
    float cy = constrain(b.y, top, bottom);
    float dx = b.x - cx, dy = b.y - cy;
    return dx*dx + dy*dy <= b.r*b.r;
  }

  void draw() {
    if (!active) return;
    noStroke();
    fill(200, 40, 40);
    float x1 = x - w/2, x2 = x + w/2;
    triangle(x1, baseY, x2, baseY, x, baseY - h);
  }
}

// ================================== BuildStage Class ======================================
// Build stage 1 or 2
void buildStage(int level) {
  platforms.clear();
  spikes.clear();
  holes.clear();
  goal = null;

  if (level == 1) {
    // base floor
    float x = 50, y = height - 100, w = width - 100, h = 20;
    platforms.add(new Platform(x, y, w, h));
    // ball spawn
    ball = new Ball(x + 40, y - 100, 10);
    // goal at right side
    goal = new Goal(x + w - 40, y - 100, 20, 100);
    return;
  }

  if (level == 2) {
    // multi-step slope
    float x = 70, y = height - 90, h = 20;
    int steps = 6;
    for (int i = 0; i < steps; i++) {
      float w = (i == 0) ? 220 : max(80, 150 - i*12);
      Platform pf = new Platform(x, y, w, h);
      platforms.add(pf);

      // random hole (skip first)
      if (i > 0 && random(1) < 0.3) {
        float margin = 20;
        float hw = random(40, 70);
        float hx = pf.x + random(margin, pf.w - margin - hw);
        int period = int(random(1500, 2500));
        int openMS = int(random(600, 900));
        holes.add(new Hole(pf, hx, hw, period, openMS));
      }

      // random spike (skip first)
      if (i > 0 && random(1) < 0.6) {
        float sx = pf.x + random(20, pf.w - 20);
        spikes.add(new Spike(sx, pf.y));
      }

      // step offset
      x += 95;
      y -= 50;
    }

    // ball on first platform
    Platform first = platforms.get(0);
    ball = new Ball(first.x + 40, first.y - 100, 10);

    // goal on last platform
    Platform last = platforms.get(platforms.size() - 1);
    goal = new Goal(last.x + last.w - 40, last.y - 100, 20, 100);
    return;
  }
}
