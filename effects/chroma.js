/**
 * 크로마틱 어베레이션 (색수차) 이펙트
 * - RGB 채널을 방향별로 분리
 * - Canvas 2D 기반
 *
 * 사용법:
 *   const chroma = new ChromaEffect(canvas);
 *   // 매 프레임:
 *   chroma.apply(ctx, amount); // amount: 0~20 (픽셀)
 */

export class ChromaEffect {
  constructor(canvas) {
    this.canvas = canvas;
    this.offscreen = document.createElement('canvas');
    this.offscreen.width = canvas.width;
    this.offscreen.height = canvas.height;
    this.offCtx = this.offscreen.getContext('2d');
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} amount - 분리 거리 (픽셀, 기본 5)
   * @param {number} angle - 분리 방향 (라디안, 기본 0 = 수평)
   */
  apply(ctx, amount = 5, angle = 0) {
    if (amount <= 0) return;

    const dx = Math.cos(angle) * amount;
    const dy = Math.sin(angle) * amount;

    // 원본 백업
    this.offCtx.clearRect(0, 0, this.offscreen.width, this.offscreen.height);
    this.offCtx.drawImage(this.canvas, 0, 0);

    // 원본 어둡게
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Red 채널
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.8;

    // R - 한쪽 방향
    ctx.drawImage(this.offscreen, dx, dy);

    // G - 중앙
    ctx.drawImage(this.offscreen, 0, 0);

    // B - 반대 방향
    ctx.drawImage(this.offscreen, -dx, -dy);

    ctx.restore();
  }

  /** 마우스 위치 기반 동적 색수차 */
  applyFromMouse(ctx, mouseX, mouseY, maxAmount = 10) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

    const amount = (dist / maxDist) * maxAmount;
    const angle = Math.atan2(dy, dx);

    this.apply(ctx, amount, angle);
  }

  resize(w, h) {
    this.offscreen.width = w;
    this.offscreen.height = h;
  }
}
