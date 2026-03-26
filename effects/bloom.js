/**
 * 블룸 (Glow) 이펙트
 * - Canvas 2D 기반 가우시안 블러 + 합성
 * - 밝은 부분이 빛나는 효과
 *
 * 사용법:
 *   const bloom = new BloomEffect(canvas);
 *   // 매 프레임 (렌더링 후):
 *   bloom.apply(ctx, { strength: 0.5, radius: 10 });
 */

export class BloomEffect {
  constructor(canvas) {
    this.canvas = canvas;

    // 블러용 오프스크린 (절반 해상도로 성능 최적화)
    this.blurCanvas = document.createElement('canvas');
    this.blurCanvas.width = Math.floor(canvas.width / 2);
    this.blurCanvas.height = Math.floor(canvas.height / 2);
    this.blurCtx = this.blurCanvas.getContext('2d');
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} options
   * @param {number} options.strength - 블룸 강도 (0~1, 기본 0.5)
   * @param {number} options.radius - 블러 반경 (기본 10)
   * @param {number} options.threshold - 밝기 임계값 (0~255, 기본 128)
   */
  apply(ctx, options = {}) {
    const { strength = 0.5, radius = 10 } = options;

    if (strength <= 0) return;

    // 원본을 절반 크기로 축소 (자연스러운 블러 + 성능)
    this.blurCtx.clearRect(0, 0, this.blurCanvas.width, this.blurCanvas.height);
    this.blurCtx.drawImage(
      this.canvas,
      0, 0,
      this.blurCanvas.width,
      this.blurCanvas.height
    );

    // CSS 블러 적용
    this.blurCtx.filter = `blur(${radius}px)`;
    this.blurCtx.drawImage(this.blurCanvas, 0, 0);
    this.blurCtx.filter = 'none';

    // 원본 위에 블러 이미지를 screen 블렌딩
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = strength;
    ctx.drawImage(
      this.blurCanvas,
      0, 0,
      this.canvas.width,
      this.canvas.height
    );
    ctx.restore();
  }

  /** 강한 네온 글로우 (블룸 2번 중첩) */
  applyNeon(ctx, strength = 0.7, radius = 15) {
    this.apply(ctx, { strength: strength * 0.6, radius });
    this.apply(ctx, { strength: strength * 0.4, radius: radius * 2 });
  }

  resize(w, h) {
    this.blurCanvas.width = Math.floor(w / 2);
    this.blurCanvas.height = Math.floor(h / 2);
  }
}
