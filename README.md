# 🎈Bouncing Ball — Processing ↔︎ p5.js
Homework 2: 2D Game Design

Single-player 2D auto-jump platformer that explores <b> randomness, constraints, and collision detection.</b>

🔗 Live (p5.js): https://daon1ee.github.io/HW2/  
📦 Repository: this repo  
🧩 Tech: Processing (.pde) → p5.js (GitHub Pages)  

# 🕹️ How to Play
- Goal: Reach the flag (🏁) at the far right.  
- Move: ← / →  
- Pause / Resume: Space  
- Auto-jump: Jumps automatically shortly after landing.  
- Random double-jump: Occasionally triggers mid-air after a random delay.
- Obstacles: Spikes (🔺) and blinking floor holes (◻️)  
  Touching spikes or falling off-screen ⇒ Game Over  
- Stages: 1 (tutorial) → 2 (procedural/randomized hazards)

# ✨ Project Overview
<b> 🎲 Randomness (≥ 2 meaningful elements) </b>  
1.	Procedural hazards (Stage 2)  
- Spikes: random positions, periodic up/down with random phase.  
- Holes: random width/position per platform; each has random period, open duration, and phase.  
2.	Probabilistic double-jump  
- On landing, the next jump may schedule a double-jump with a random delay; a subtle ring telegraphs the timing.

# 🚧 Constraints (clear boundaries & rules)  
- Screen clamping with constrain, gravity, auto-jump only when grounded.
- Platforms/goal/hazards define navigable vs. forbidden space.

# 💥 Collision Detection (distinct outcomes)
- Ball ↔ Platform: landing/grounding (disabled over open holes)  
- Ball ↔ Spike: Game Over  
- Ball ↔ Goal: Stage Cleared  

# 👤 Player Mode
- Single-player

# 🧠 Game States
- Active / Paused / Stage Cleared / Game Over  
(On the web, the first user input acts as a lightweight “start gate” due to audio policy.)

# 👀 Visual Feedback
- State overlays, timed spike animation, hole open/close, control HUD.


# 🎵 Audio (Research Component)
- Implemented: Background music bgm.mp3 that responds to game state.

    
---------------------------------------------------------------------------------------
# 📝 Design & Research Notes
