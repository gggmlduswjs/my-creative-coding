/**
 * 캔버스 영상 녹화 모듈
 * - Canvas를 WebM 영상으로 녹화
 * - 릴스용 녹화 후 자동 다운로드
 *
 * 사용법:
 *   const rec = new CanvasRecorder(canvas);
 *   rec.start();
 *   // ... 애니메이션 실행 ...
 *   rec.stop(); // 자동 다운로드
 *
 * 단축키 연결:
 *   const rec = new CanvasRecorder(canvas);
 *   rec.bindKey('r'); // R키로 녹화 시작/중지 토글
 */

export class CanvasRecorder {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.fps = options.fps ?? 60;
    this.mimeType = this._getBestMimeType();
    this.recorder = null;
    this.chunks = [];
    this.recording = false;
    this.filename = options.filename ?? 'creative-coding';
  }

  _getBestMimeType() {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';
  }

  start() {
    this.chunks = [];
    const stream = this.canvas.captureStream(this.fps);
    this.recorder = new MediaRecorder(stream, {
      mimeType: this.mimeType,
      videoBitsPerSecond: 8_000_000
    });

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.recorder.onstop = () => this._save();

    this.recorder.start();
    this.recording = true;
    console.log('🔴 녹화 시작');
  }

  stop() {
    if (this.recorder && this.recording) {
      this.recorder.stop();
      this.recording = false;
      console.log('⏹️ 녹화 중지');
    }
  }

  toggle() {
    if (this.recording) {
      this.stop();
    } else {
      this.start();
    }
  }

  _save() {
    const blob = new Blob(this.chunks, { type: this.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    a.href = url;
    a.download = `${this.filename}-${timestamp}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`💾 저장 완료: ${a.download}`);
  }

  /** 키보드 단축키 바인딩 */
  bindKey(key = 'r') {
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === key.toLowerCase() && !e.ctrlKey && !e.metaKey) {
        this.toggle();
      }
    });
    console.log(`⌨️ '${key}' 키로 녹화 토글`);
    return this;
  }

  /** 녹화 상태 표시 (캔버스 좌측 상단 빨간 점) */
  drawIndicator(ctx) {
    if (!this.recording) return;
    ctx.save();
    ctx.fillStyle = '#ff0000';
    ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 300) * 0.4;
    ctx.beginPath();
    ctx.arc(20, 20, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
