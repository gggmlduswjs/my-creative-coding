/**
 * 글리치 이펙트
 * - Canvas 2D 기반 글리치 효과
 * - RGB 채널 분리, 스캔라인, 랜덤 슬라이스
 *
 * 사용법:
 *   const glitch = new GlitchEffect(canvas);
 *   // 매 프레임:
 *   glitch.apply(ctx, intensity); // intensity: 0~1
 */

export class GlitchEffect {
  constructor(canvas) {
    this.canvas = canvas;
    this.w = canvas.width;
    this.h = canvas.height;
  }

  /**
   * 글리치 효과 적용
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} intensity - 0(없음) ~ 1(최대)
   */
  apply(ctx, intensity = 0.5) {
    if (intensity <= 0) return;
    if (Math.random() > intensity * 0.8) return;

    this._rgbShift(ctx, intensity);
    this._sliceShift(ctx, intensity);
    if (intensity > 0.3) this._scanlines(ctx, intensity);
  }

  /** RGB 채널 분리 */
  _rgbShift(ctx, intensity) {
    const shift = Math.floor(intensity * 15);
    const imageData = ctx.getImageData(0, 0, this.w, this.h);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.6;

    // Red 채널 오른쪽으로
    ctx.drawImage(this.canvas, shift, 0);
    // Blue 채널 왼쪽으로
    ctx.drawImage(this.canvas, -shift, 0);

    ctx.restore();
  }

  /** 랜덤 수평 슬라이스 */
  _sliceShift(ctx, intensity) {
    const sliceCount = Math.floor(intensity * 8) + 1;

    for (let i = 0; i < sliceCount; i++) {
      const y = Math.random() * this.h;
      const height = Math.random() * 30 + 5;
      const offset = (Math.random() - 0.5) * intensity * 60;

      const slice = ctx.getImageData(0, y, this.w, height);
      ctx.putImageData(slice, offset, y);
    }
  }

  /** 스캔라인 오버레이 */
  _scanlines(ctx, intensity) {
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${intensity * 0.15})`;
    for (let y = 0; y < this.h; y += 3) {
      ctx.fillRect(0, y, this.w, 1);
    }
    ctx.restore();
  }
}
