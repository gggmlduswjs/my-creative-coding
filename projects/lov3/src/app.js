/**
 * LOV3 — 9:16 Webcam + Hand Tracking + Music-Reactive Visual
 *
 * 씬 구성:
 *   1. Pixel Hearts  — 손 위치에서 픽셀 하트 방출, 핑크 네온
 *   2. Code Aura     — 손바닥에서 방사형 데이터 스트림 (191914 스타일)
 *   3. Fire Climax   — 손을 따라다니는 파티클 불꽃 (192109 스타일)
 *
 * 조작:
 *   SPACE  오디오 재생/일시정지
 *   1/2/3  씬 수동 전환
 *   R      녹화 토글
 *   F      전체화면
 */

import { AudioCore, ParticleSystem, CanvasRecorder } from '../../../core/index.js';
import { GlitchEffect, ChromaEffect, BloomEffect } from '../../../effects/index.js';

// ─── Config ───────────────────────────────────────────────
const W = 1080;
const H = 1920;

const PINK   = '#ff0066';
const CYAN   = '#00ffcc';
const ORANGE = '#ff6600';
const RED    = '#ff0033';
const WHITE  = '#ffffff';

// ─── Utilities ────────────────────────────────────────────
const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const map   = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);
const dist  = (x1, y1, x2, y2) => Math.sqrt((x1-x2)**2 + (y1-y2)**2);

function randomHex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

// ─── Hand data helper ─────────────────────────────────────
// MediaPipe landmarks → screen coords
function parseHands(results) {
  const hands = [];
  if (!results.multiHandLandmarks) return hands;

  for (let i = 0; i < results.multiHandLandmarks.length; i++) {
    const lm = results.multiHandLandmarks[i];
    const label = results.multiHandedness?.[i]?.label ?? 'Unknown';

    // Convert normalized → canvas coords (mirrored)
    const get = (idx) => ({
      x: (1 - lm[idx].x) * W,
      y: lm[idx].y * H,
      z: lm[idx].z
    });

    const palm = {
      x: (1 - ((lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5)) * W,
      y: ((lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5) * H,
    };

    const thumbTip = get(4);
    const indexTip = get(8);
    const middleTip = get(12);
    const ringTip = get(16);
    const pinkyTip = get(20);
    const wrist = get(0);

    const tips = [thumbTip, indexTip, middleTip, ringTip, pinkyTip];

    // Pinch = thumb-index close
    const isPinch = dist(thumbTip.x, thumbTip.y, indexTip.x, indexTip.y) < 50;

    // Open hand = all fingers spread
    const spread = tips.reduce((sum, t) => sum + dist(t.x, t.y, palm.x, palm.y), 0) / 5;
    const isOpen = spread > 100;

    hands.push({
      label, palm, wrist, tips, thumbTip, indexTip, middleTip, ringTip, pinkyTip,
      landmarks: lm, isPinch, isOpen, spread
    });
  }
  return hands;
}

// ─── Scene 1: Pixel Hearts ───────────────────────────────
class PixelHeartsScene {
  constructor() {
    this.particles = new ParticleSystem({ maxCount: 1500 });
    this.phase = 0;
    this.hearts = []; // floating hearts
  }

  update(dt, hands, audio) {
    this.phase += dt;
    const bassPulse = audio.bass / 255;

    // Emit heart particles from each fingertip
    for (const hand of hands) {
      for (const tip of hand.tips) {
        if (Math.random() < 0.4 + bassPulse * 0.5) {
          this.particles.emit(tip.x, tip.y, {
            count: 1,
            speed: 1.5 + bassPulse * 3,
            color: PINK,
            size: 3 + Math.random() * 5 + bassPulse * 4,
            life: 1 + Math.random() * 1.5,
            friction: 0.97,
            gravity: -0.5
          });
        }
      }

      // Palm burst on strong bass
      if (bassPulse > 0.6 && Math.random() < 0.5) {
        this.particles.emit(hand.palm.x, hand.palm.y, {
          count: 8 + Math.floor(bassPulse * 12),
          speed: 3 + bassPulse * 6,
          color: Math.random() < 0.7 ? PINK : '#ff66aa',
          size: 4 + Math.random() * 6,
          life: 0.8 + Math.random(),
          friction: 0.96
        });
      }

      // Floating heart shapes from palm
      if (Math.random() < 0.15 + bassPulse * 0.3) {
        this.hearts.push({
          x: hand.palm.x + (Math.random() - 0.5) * 60,
          y: hand.palm.y,
          vy: -(2 + Math.random() * 3 + bassPulse * 2),
          size: 15 + Math.random() * 25 + bassPulse * 15,
          life: 2 + Math.random(),
          maxLife: 3,
          rotation: (Math.random() - 0.5) * 0.3,
          color: Math.random() < 0.6 ? PINK : '#ff3388'
        });
      }
    }

    // Update floating hearts
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.y += h.vy;
      h.x += Math.sin(this.phase * 3 + i) * 0.5;
      h.life -= dt;
      if (h.life <= 0 || this.hearts.length > 80) {
        this.hearts.splice(i, 1);
      }
    }

    this.particles.update(dt);
  }

  draw(ctx, hands, audio) {
    const bassPulse = audio.bass / 255;

    // Draw connection lines between fingertips (wireframe feel)
    for (const hand of hands) {
      ctx.save();
      ctx.strokeStyle = PINK;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + bassPulse * 0.3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = PINK;

      // Connect tips to palm
      for (const tip of hand.tips) {
        ctx.beginPath();
        ctx.moveTo(hand.palm.x, hand.palm.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
      }

      // Connect tips in sequence
      for (let i = 0; i < hand.tips.length - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(hand.tips[i].x, hand.tips[i].y);
        ctx.lineTo(hand.tips[i + 1].x, hand.tips[i + 1].y);
        ctx.stroke();
      }

      // Tip dots
      ctx.fillStyle = WHITE;
      for (const tip of hand.tips) {
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 5 + bassPulse * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Palm circle
      ctx.strokeStyle = PINK;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4;
      const pr = 40 + bassPulse * 30 + Math.sin(this.phase * 4) * 10;
      ctx.beginPath();
      ctx.arc(hand.palm.x, hand.palm.y, pr, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // Draw floating hearts
    for (const h of this.hearts) {
      const alpha = clamp(h.life / h.maxLife, 0, 1);
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rotation);
      ctx.scale(h.size / 50, h.size / 50);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = h.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = h.color;
      // Parametric heart
      ctx.beginPath();
      for (let t = 0; t <= Math.PI * 2; t += 0.05) {
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
        if (t === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Particles with glow
    this.particles.drawGlow(ctx, 15);
  }
}

// ─── Scene 2: Code Aura ──────────────────────────────────
class CodeAuraScene {
  constructor() {
    this.particles = new ParticleSystem({ maxCount: 1500 });
    this.dataTexts = [];
    this.phase = 0;
  }

  _genText() {
    const choices = [
      () => randomHex(),
      () => (Math.random() * 999).toFixed(1),
      () => '0x' + Math.floor(Math.random() * 0xff).toString(16),
      () => ['vec3', 'float', 'uint8', 'rgba', 'null', 'void', '0xff', 'LOV3'][Math.floor(Math.random() * 8)],
      () => Math.floor(Math.random() * 256).toString(),
    ];
    return choices[Math.floor(Math.random() * choices.length)]();
  }

  update(dt, hands, audio) {
    this.phase += dt;
    const bassPulse = audio.bass / 255;
    const midPulse = audio.mid / 255;

    for (const hand of hands) {
      const cx = hand.palm.x;
      const cy = hand.palm.y;

      // Radial particles from palm
      const emitRate = 3 + Math.floor(bassPulse * 15);
      for (let i = 0; i < emitRate; i++) {
        const angle = Math.random() * Math.PI * 2;
        const colors = [CYAN, '#00ff66', '#00aaff', '#66ffcc'];
        this.particles.emit(cx, cy, {
          count: 1,
          speed: 3 + Math.random() * 5 + bassPulse * 6,
          baseAngle: angle,
          spread: 0.2,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 2 + Math.random() * 3,
          life: 1.5 + Math.random() * 2,
          friction: 0.98,
          gravity: 0
        });
      }

      // Data text emission from palm
      if (Math.random() < 0.3 + midPulse * 0.5) {
        const angle = Math.random() * Math.PI * 2;
        this.dataTexts.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * (3 + Math.random() * 5),
          vy: Math.sin(angle) * (3 + Math.random() * 5),
          text: this._genText(),
          life: 2 + Math.random(),
          maxLife: 3,
          size: 11 + Math.random() * 10,
          color: Math.random() < 0.5 ? CYAN : '#00ff66'
        });
      }

      // Fingertip sparks
      for (const tip of hand.tips) {
        if (Math.random() < 0.3) {
          this.particles.emit(tip.x, tip.y, {
            count: 1,
            speed: 1 + Math.random() * 2,
            color: CYAN,
            size: 2 + Math.random() * 2,
            life: 0.5 + Math.random() * 0.5,
            friction: 0.95
          });
        }
      }
    }

    // Update data texts
    for (let i = this.dataTexts.length - 1; i >= 0; i--) {
      const t = this.dataTexts[i];
      t.x += t.vx;
      t.y += t.vy;
      t.vx *= 0.98;
      t.vy *= 0.98;
      t.life -= dt;
      if (t.life <= 0 || this.dataTexts.length > 150) {
        this.dataTexts.splice(i, 1);
      }
    }

    this.particles.update(dt);
  }

  draw(ctx, hands, audio) {
    const bassPulse = audio.bass / 255;
    const midPulse = audio.mid / 255;

    for (const hand of hands) {
      const cx = hand.palm.x;
      const cy = hand.palm.y;

      // Radial lines from palm
      ctx.save();
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.2 + bassPulse * 0.3;
      const lineCount = 24;
      for (let i = 0; i < lineCount; i++) {
        const a = (i / lineCount) * Math.PI * 2 + this.phase * 0.3;
        const len = 150 + bassPulse * 300 + hand.spread;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.restore();

      // Concentric rings
      ctx.save();
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 1;
      for (let r = 1; r <= 4; r++) {
        const radius = r * 50 + Math.sin(this.phase * 3 + r) * 20 + bassPulse * 30;
        ctx.globalAlpha = 0.15 + bassPulse * 0.2 - r * 0.03;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Fingertip + palm landmarks (subtle dots)
      ctx.save();
      ctx.fillStyle = CYAN;
      ctx.shadowBlur = 8;
      ctx.shadowColor = CYAN;
      ctx.globalAlpha = 0.7;
      for (const tip of hand.tips) {
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Full landmark connections
      ctx.strokeStyle = `rgba(0,255,204,${0.15 + midPulse * 0.15})`;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      const connections = [
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [5,9],[9,10],[10,11],[11,12],
        [9,13],[13,14],[14,15],[15,16],
        [13,17],[17,18],[18,19],[19,20],[0,17]
      ];
      for (const [a, b] of connections) {
        const la = hand.landmarks[a];
        const lb = hand.landmarks[b];
        ctx.beginPath();
        ctx.moveTo((1 - la.x) * W, la.y * H);
        ctx.lineTo((1 - lb.x) * W, lb.y * H);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Data texts
    ctx.save();
    for (const t of this.dataTexts) {
      const alpha = clamp(t.life / t.maxLife, 0, 1);
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = t.color;
      ctx.font = `${t.size}px "SF Mono", "Fira Code", Consolas, monospace`;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();

    // Particles
    this.particles.drawGlow(ctx, 10);
  }
}

// ─── Scene 3: Fire Climax ─────────────────────────────────
class FireClimaxScene {
  constructor() {
    this.particles = new ParticleSystem({ maxCount: 2000 });
    this.phase = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  update(dt, hands, audio) {
    this.phase += dt;
    const bassPulse = audio.bass / 255;

    // Screen shake
    if (bassPulse > 0.7) {
      this.shakeX = (Math.random() - 0.5) * bassPulse * 20;
      this.shakeY = (Math.random() - 0.5) * bassPulse * 20;
    } else {
      this.shakeX *= 0.85;
      this.shakeY *= 0.85;
    }

    for (const hand of hands) {
      const colors = [ORANGE, RED, '#ff3300', '#ff9900', '#ffcc00', WHITE];

      // Fire stream from each fingertip
      for (const tip of hand.tips) {
        const count = 2 + Math.floor(bassPulse * 5);
        this.particles.emit(tip.x, tip.y, {
          count,
          speed: 3 + Math.random() * 4 + bassPulse * 5,
          baseAngle: -Math.PI / 2 + (Math.random() - 0.5) * 0.8,
          spread: 0.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 3 + Math.random() * 6 + bassPulse * 5,
          life: 0.8 + Math.random() * 1.5,
          friction: 0.98,
          gravity: -1.5
        });
      }

      // Massive palm explosion on open hand + beat
      if (hand.isOpen && bassPulse > 0.5) {
        this.particles.emit(hand.palm.x, hand.palm.y, {
          count: 10 + Math.floor(bassPulse * 20),
          speed: 5 + bassPulse * 10,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 4 + Math.random() * 8,
          life: 0.6 + Math.random() * 1,
          friction: 0.96
        });
      }

      // Trail between palm and wrist
      if (Math.random() < 0.5) {
        const mx = lerp(hand.wrist.x, hand.palm.x, Math.random());
        const my = lerp(hand.wrist.y, hand.palm.y, Math.random());
        this.particles.emit(mx, my, {
          count: 2,
          speed: 1 + Math.random() * 2,
          baseAngle: -Math.PI / 2,
          spread: 0.4,
          color: ORANGE,
          size: 2 + Math.random() * 3,
          life: 0.5 + Math.random() * 0.5,
          friction: 0.97,
          gravity: -0.8
        });
      }
    }

    // Ambient fire from bottom (always)
    const ambientCount = 2 + Math.floor(bassPulse * 5);
    for (let i = 0; i < ambientCount; i++) {
      this.particles.emit(Math.random() * W, H + 10, {
        count: 1,
        speed: 2 + Math.random() * 3,
        baseAngle: -Math.PI / 2,
        spread: 0.3,
        color: `rgba(255,${Math.floor(50 + Math.random() * 80)},0,1)`,
        size: 2 + Math.random() * 4,
        life: 2 + Math.random() * 2,
        friction: 0.99,
        gravity: -0.3
      });
    }

    this.particles.update(dt);
  }

  draw(ctx, hands, audio) {
    const bassPulse = audio.bass / 255;

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    // Hand silhouette glow
    for (const hand of hands) {
      // Outer glow around palm
      const grad = ctx.createRadialGradient(
        hand.palm.x, hand.palm.y, 0,
        hand.palm.x, hand.palm.y, 150 + bassPulse * 100
      );
      grad.addColorStop(0, `rgba(255,100,0,${0.15 + bassPulse * 0.2})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Landmark skeleton in orange
      ctx.save();
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4 + bassPulse * 0.3;
      ctx.shadowBlur = 12;
      ctx.shadowColor = ORANGE;
      const connections = [
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [5,9],[9,10],[10,11],[11,12],
        [9,13],[13,14],[14,15],[15,16],
        [13,17],[17,18],[18,19],[19,20],[0,17]
      ];
      for (const [a, b] of connections) {
        const la = hand.landmarks[a];
        const lb = hand.landmarks[b];
        ctx.beginPath();
        ctx.moveTo((1 - la.x) * W, la.y * H);
        ctx.lineTo((1 - lb.x) * W, lb.y * H);
        ctx.stroke();
      }

      // Tip circles
      ctx.fillStyle = '#ffcc00';
      for (const tip of hand.tips) {
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 6 + bassPulse * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Particles
    this.particles.drawGlow(ctx, 20);

    ctx.restore(); // shake
  }
}

// ─── HUD ──────────────────────────────────────────────────
class HUD {
  constructor() {
    this.frame = 0;
    this.fps = 0;
    this.fpsCounter = 0;
    this.fpsTimer = 0;
    this.sceneNames = ['PIXEL_HEARTS', 'CODE_AURA', 'FIRE_CLIMAX'];
  }

  update(dt) {
    this.frame++;
    this.fpsTimer += dt;
    this.fpsCounter++;
    if (this.fpsTimer >= 1) {
      this.fps = this.fpsCounter;
      this.fpsCounter = 0;
      this.fpsTimer = 0;
    }
  }

  draw(ctx, sceneIndex, isRecording, audioTime, handCount) {
    const pad = 32;
    ctx.save();

    // Border frame
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

    // Corner brackets
    const bLen = 30;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, pad + bLen); ctx.lineTo(pad, pad); ctx.lineTo(pad + bLen, pad);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W - pad - bLen, pad); ctx.lineTo(W - pad, pad); ctx.lineTo(W - pad, pad + bLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad, H - pad - bLen); ctx.lineTo(pad, H - pad); ctx.lineTo(pad + bLen, H - pad);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W - pad - bLen, H - pad); ctx.lineTo(W - pad, H - pad); ctx.lineTo(W - pad, H - pad - bLen);
    ctx.stroke();

    // Top left: project + hand info
    ctx.font = '600 16px "SF Mono", "Fira Code", Consolas, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`LOV3 // VISUAL`, pad + 12, pad + 12);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillText(`HANDS: ${handCount}`, pad + 12, pad + 34);

    // Top right: scene
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText(`${this.sceneNames[sceneIndex]}`, W - pad - 12, pad + 12);

    // Bottom left: frame + fps
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    const timeStr = audioTime > 0
      ? `${Math.floor(audioTime / 60)}:${Math.floor(audioTime % 60).toString().padStart(2, '0')}`
      : '--:--';
    ctx.fillText(`F:${this.frame.toString().padStart(6, '0')}  FPS:${this.fps}  T:${timeStr}`, pad + 12, H - pad - 12);

    // Bottom right: recording
    if (isRecording) {
      ctx.textAlign = 'right';
      const blink = Math.sin(Date.now() / 300) > 0;
      if (blink) {
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(W - pad - 60, H - pad - 18, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,0,0,0.6)';
      ctx.fillText('REC', W - pad - 12, H - pad - 12);
    }

    ctx.restore();
  }
}

// ─── Transition ───────────────────────────────────────────
class Transition {
  constructor() { this.active = false; this.timer = 0; this.duration = 0.4; }

  trigger() { this.active = true; this.timer = this.duration; }

  update(dt) {
    if (!this.active) return;
    this.timer -= dt;
    if (this.timer <= 0) { this.active = false; this.timer = 0; }
  }

  draw(ctx) {
    if (!this.active) return;
    const progress = 1 - this.timer / this.duration;
    // Glitch slices
    for (let i = 0; i < 12; i++) {
      const y = Math.random() * H;
      const h = 5 + Math.random() * 40;
      const offset = (Math.random() - 0.5) * 100 * (1 - progress);
      try {
        const slice = ctx.getImageData(0, Math.floor(y), W, Math.floor(h));
        ctx.putImageData(slice, Math.floor(offset), Math.floor(y));
      } catch(e) {}
    }
    // Flash
    const flashAlpha = progress < 0.3 ? (1 - progress / 0.3) * 0.6 : 0;
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

// ─── Main App ─────────────────────────────────────────────
class LOV3App {
  constructor() {
    this.canvas = document.getElementById('c');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = W;
    this.canvas.height = H;
    this.video = document.getElementById('webcam');

    this._fitCanvas();
    window.addEventListener('resize', () => this._fitCanvas());

    this.audio = new AudioCore();
    this.recorder = new CanvasRecorder(this.canvas, { filename: 'LOV3' });
    this.glitch = new GlitchEffect(this.canvas);
    this.chroma = new ChromaEffect(this.canvas);
    this.bloom = new BloomEffect(this.canvas);
    this.hud = new HUD();
    this.transition = new Transition();

    this.scenes = [
      new PixelHeartsScene(),
      new CodeAuraScene(),
      new FireClimaxScene()
    ];
    this.currentScene = 0;

    this.hands = [];
    this.audioLoaded = false;
    this.playing = false;
    this.lastTime = 0;
    this.simulatedBeat = 0;
    this.started = false;

    this._setupKeys();
    this._setupAudioDrop();
    this._setupStartButton();
  }

  _fitCanvas() {
    const wrap = document.getElementById('wrap');
    const vh = window.innerHeight * 0.95;
    const vw = window.innerWidth * 0.95;
    const ratio = 9 / 16;
    let h = vh;
    let w = h * ratio;
    if (w > vw) { w = vw; h = w / ratio; }
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    wrap.style.width = w + 'px';
    wrap.style.height = h + 'px';
  }

  _setupStartButton() {
    const btn = document.getElementById('start-btn');
    const overlay = document.getElementById('drop-overlay');

    btn.addEventListener('click', async () => {
      btn.textContent = 'LOADING...';
      btn.disabled = true;
      try {
        await this._startWebcam();
        await this._startHandTracking();
        overlay.classList.add('hidden');
        this.started = true;
      } catch (e) {
        btn.textContent = 'CAMERA ERROR';
        console.error(e);
      }
    });
  }

  async _startWebcam() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' }
    });
    this.video.srcObject = stream;
    await this.video.play();
  }

  async _startHandTracking() {
    const hands = new window.Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    });

    hands.onResults((results) => {
      this.hands = parseHands(results);
    });

    const camera = new window.Camera(this.video, {
      onFrame: async () => {
        await hands.send({ image: this.video });
      },
      width: 1280,
      height: 720
    });

    await camera.start();
  }

  _setupAudioDrop() {
    document.body.addEventListener('dragover', (e) => e.preventDefault());
    document.body.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files[0]) this._loadAudio(e.dataTransfer.files[0]);
    });
  }

  async _loadAudio(file) {
    const url = URL.createObjectURL(file);
    await this.audio.connectFile(url);
    this.audioLoaded = true;
    this.audio.play();
    this.playing = true;
  }

  _setupKeys() {
    window.addEventListener('keydown', (e) => {
      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (!this.audioLoaded) return;
          if (this.playing) { this.audio.pause(); this.playing = false; }
          else { this.audio.play(); this.playing = true; }
          break;
        case '1': this._switchScene(0); break;
        case '2': this._switchScene(1); break;
        case '3': this._switchScene(2); break;
        case 'r': this.recorder.toggle(); break;
        case 'f':
          if (!document.fullscreenElement) document.getElementById('wrap').requestFullscreen?.();
          else document.exitFullscreen?.();
          break;
      }
    });
  }

  _switchScene(index) {
    if (index === this.currentScene) return;
    this.transition.trigger();
    this.currentScene = index;
  }

  _getAudioData() {
    if (this.audioLoaded && this.playing) {
      return this.audio.getEnergy();
    }
    // Simulated beat for preview
    this.simulatedBeat += 1 / 60;
    const t = this.simulatedBeat;
    const beat = Math.pow(Math.sin(t * Math.PI * 2) * 0.5 + 0.5, 4);
    return {
      bass: 60 + beat * 150,
      mid: 50 + Math.sin(t * 3.7) * 40 + 40,
      treble: 30 + Math.sin(t * 7.3) * 25 + 25
    };
  }

  _getAudioTime() {
    return this.audioLoaded && this.audio.audioElement
      ? this.audio.audioElement.currentTime : 0;
  }

  run() {
    const loop = (timestamp) => {
      const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
      this.lastTime = timestamp;

      const audioData = this._getAudioData();
      const bassPulse = audioData.bass / 255;
      const scene = this.scenes[this.currentScene];

      // Update
      scene.update(dt, this.hands, audioData);
      this.hud.update(dt);
      this.transition.update(dt);

      // ─── Draw ───
      this.ctx.clearRect(0, 0, W, H);

      // 1. Draw webcam as background (mirrored, cover 9:16)
      if (this.video.readyState >= 2) {
        this.ctx.save();
        this.ctx.translate(W, 0);
        this.ctx.scale(-1, 1);

        // Cover fit: video is 16:9 landscape, canvas is 9:16 portrait
        const vw = this.video.videoWidth;
        const vh = this.video.videoHeight;
        const videoRatio = vw / vh;
        const canvasRatio = W / H;
        let sx = 0, sy = 0, sw = vw, sh = vh;
        if (videoRatio > canvasRatio) {
          // Video is wider → crop sides
          sw = vh * canvasRatio;
          sx = (vw - sw) / 2;
        } else {
          // Video is taller → crop top/bottom
          sh = vw / canvasRatio;
          sy = (vh - sh) / 2;
        }

        this.ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, W, H);
        this.ctx.restore();

        // Darken webcam for effect visibility
        this.ctx.fillStyle = `rgba(0,0,0,${0.35 + bassPulse * 0.15})`;
        this.ctx.fillRect(0, 0, W, H);
      } else {
        // No webcam yet → dark background
        this.ctx.fillStyle = '#080808';
        this.ctx.fillRect(0, 0, W, H);
      }

      // 2. Draw scene effects on top
      scene.draw(this.ctx, this.hands, audioData);

      // 3. Post-processing
      if (this.currentScene === 0 && bassPulse > 0.7) {
        this.glitch.apply(this.ctx, (bassPulse - 0.7) * 2);
      }
      if (this.currentScene === 1) {
        this.bloom.apply(this.ctx, { strength: 0.2 + bassPulse * 0.3, radius: 8 });
        if (bassPulse > 0.6) {
          this.chroma.apply(this.ctx, bassPulse * 5);
        }
      }
      if (this.currentScene === 2) {
        this.bloom.applyNeon(this.ctx, 0.35 + bassPulse * 0.4, 12);
        if (bassPulse > 0.8) {
          this.glitch.apply(this.ctx, (bassPulse - 0.8) * 3);
        }
      }

      // 4. Transition
      this.transition.draw(this.ctx);

      // 5. HUD
      this.hud.draw(this.ctx, this.currentScene, this.recorder.recording,
                     this._getAudioTime(), this.hands.length);
      this.recorder.drawIndicator(this.ctx);

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

// ─── Bootstrap ────────────────────────────────────────────
const app = new LOV3App();
app.run();
