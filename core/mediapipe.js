/**
 * MediaPipe 핸드트래킹 코어 모듈
 * - 웹캠 연결 + 핸드 랜드마크 추출
 * - 제스처 감지 (핀치, 그랩, 포인트 등)
 * - 손가락별 좌표 쉽게 접근
 *
 * 사용법:
 *   const tracker = new HandTracker(videoEl, canvasEl);
 *   await tracker.start();
 *   tracker.onResults((hands) => {
 *     if (hands.length > 0) {
 *       const index = hands[0].indexTip; // {x, y, z}
 *     }
 *   });
 */

// MediaPipe Hands CDN에서 로드 필요:
// <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>
// <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>

const LANDMARKS = {
  wrist: 0,
  thumbTip: 4,
  indexTip: 8,
  middleTip: 12,
  ringTip: 16,
  pinkyTip: 20,
  thumbMcp: 2,
  indexMcp: 5,
  middleMcp: 9,
  ringMcp: 13,
  pinkyMcp: 17
};

export class HandTracker {
  constructor(videoEl, canvasEl) {
    this.video = videoEl;
    this.canvas = canvasEl;
    this.ctx = canvasEl?.getContext('2d');
    this.hands = null;
    this.camera = null;
    this.callbacks = [];
    this.latestResults = null;
  }

  async start(options = {}) {
    const { maxHands = 2, minDetection = 0.7, minTracking = 0.5 } = options;

    this.hands = new window.Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    this.hands.setOptions({
      maxNumHands: maxHands,
      modelComplexity: 1,
      minDetectionConfidence: minDetection,
      minTrackingConfidence: minTracking
    });

    this.hands.onResults((results) => this._onResults(results));

    this.camera = new window.Camera(this.video, {
      onFrame: async () => {
        await this.hands.send({ image: this.video });
      },
      width: 1280,
      height: 720
    });

    await this.camera.start();
    return this;
  }

  onResults(callback) {
    this.callbacks.push(callback);
    return this;
  }

  _onResults(results) {
    this.latestResults = results;

    const parsed = [];
    if (results.multiHandLandmarks) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const lm = results.multiHandLandmarks[i];
        const handedness = results.multiHandedness[i]?.label ?? 'Unknown';
        parsed.push(this._parseHand(lm, handedness));
      }
    }

    for (const cb of this.callbacks) {
      cb(parsed, results);
    }
  }

  _parseHand(landmarks, handedness) {
    const get = (name) => {
      const idx = LANDMARKS[name];
      const lm = landmarks[idx];
      return {
        x: lm.x * this.canvas.width,
        y: lm.y * this.canvas.height,
        z: lm.z,
        normalized: { x: lm.x, y: lm.y, z: lm.z }
      };
    };

    const hand = {
      handedness,
      landmarks,
      wrist: get('wrist'),
      thumbTip: get('thumbTip'),
      indexTip: get('indexTip'),
      middleTip: get('middleTip'),
      ringTip: get('ringTip'),
      pinkyTip: get('pinkyTip')
    };

    // 제스처 감지
    hand.isPinch = this._distance(hand.thumbTip, hand.indexTip) < 40;
    hand.isGrab = this._isGrab(landmarks);
    hand.isPoint = this._isPoint(landmarks);

    return hand;
  }

  _distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _isGrab(lm) {
    // 모든 손가락 끝이 MCP보다 아래(y가 큼)면 주먹
    const tips = [8, 12, 16, 20];
    const mcps = [5, 9, 13, 17];
    return tips.every((tip, i) => lm[tip].y > lm[mcps[i]].y);
  }

  _isPoint(lm) {
    // 검지만 펴고 나머지 접힘
    const indexUp = lm[8].y < lm[5].y;
    const othersDown = [12, 16, 20].every(
      (tip, i) => lm[tip].y > lm[[9, 13, 17][i]].y
    );
    return indexUp && othersDown;
  }

  /** 디버그용: 랜드마크를 캔버스에 그리기 */
  drawDebug() {
    if (!this.latestResults?.multiHandLandmarks || !this.ctx) return;

    const ctx = this.ctx;
    for (const landmarks of this.latestResults.multiHandLandmarks) {
      for (const lm of landmarks) {
        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.arc(
          lm.x * this.canvas.width,
          lm.y * this.canvas.height,
          4, 0, Math.PI * 2
        );
        ctx.fill();
      }
    }
  }

  stop() {
    if (this.camera) this.camera.stop();
  }
}
