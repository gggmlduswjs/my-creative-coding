/**
 * 파티클 시스템 코어 모듈
 * - Canvas 2D / Three.js 양쪽 호환
 * - 파티클 생성, 업데이트, 소멸 관리
 * - 중력, 바람, 어트랙터 등 힘(force) 시스템
 *
 * 사용법 (Canvas 2D):
 *   const ps = new ParticleSystem({ maxCount: 1000 });
 *   ps.emit(x, y, { count: 20, speed: 3, color: '#ff0066' });
 *   // 매 프레임:
 *   ps.update(deltaTime);
 *   ps.draw(ctx);
 */

export class Particle {
  constructor(x, y, options = {}) {
    this.x = x;
    this.y = y;

    const angle = options.angle ?? Math.random() * Math.PI * 2;
    const speed = options.speed ?? (1 + Math.random() * 3);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.life = options.life ?? (0.5 + Math.random() * 1.5);
    this.maxLife = this.life;
    this.size = options.size ?? (2 + Math.random() * 4);
    this.color = options.color ?? '#ffffff';
    this.opacity = 1;

    this.friction = options.friction ?? 0.98;
    this.gravity = options.gravity ?? 0;
    this.shrink = options.shrink ?? true;
  }

  get alive() {
    return this.life > 0;
  }

  get progress() {
    return 1 - this.life / this.maxLife;
  }

  update(dt) {
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.vy += this.gravity * dt;

    this.x += this.vx;
    this.y += this.vy;

    this.life -= dt;
    this.opacity = Math.max(0, this.life / this.maxLife);
    if (this.shrink) {
      this.size *= 0.995;
    }
  }
}

export class ParticleSystem {
  constructor(options = {}) {
    this.particles = [];
    this.maxCount = options.maxCount ?? 2000;
    this.forces = [];
  }

  /**
   * 파티클 방출
   * @param {number} x - 발생 위치 X
   * @param {number} y - 발생 위치 Y
   * @param {object} options - { count, speed, color, size, life, spread, gravity, friction }
   */
  emit(x, y, options = {}) {
    const count = options.count ?? 10;
    const spread = options.spread ?? Math.PI * 2;
    const baseAngle = options.baseAngle ?? 0;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxCount) break;

      const angle = baseAngle + (Math.random() - 0.5) * spread;
      this.particles.push(new Particle(x, y, { ...options, angle }));
    }
  }

  /** 힘 추가 (중력, 바람, 어트랙터 등) */
  addForce(forceFn) {
    this.forces.push(forceFn);
    return this;
  }

  /** 포인트 어트랙터 추가 */
  addAttractor(x, y, strength = 0.1) {
    this.addForce((p) => {
      const dx = x - p.x;
      const dy = y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 1;
      p.vx += (dx / dist) * strength;
      p.vy += (dy / dist) * strength;
    });
    return this;
  }

  update(dt = 1 / 60) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      for (const force of this.forces) {
        force(p, dt);
      }

      p.update(dt);

      if (!p.alive) {
        this.particles.splice(i, 1);
      }
    }
  }

  /** Canvas 2D 렌더링 */
  draw(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 글로우 효과 포함 렌더링 */
  drawGlow(ctx, blur = 15) {
    ctx.save();
    ctx.shadowBlur = blur;
    for (const p of this.particles) {
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  get count() {
    return this.particles.length;
  }

  clear() {
    this.particles.length = 0;
  }
}
