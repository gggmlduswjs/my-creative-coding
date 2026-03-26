/**
 * Web Audio API 코어 모듈
 * - 마이크/오디오 파일 입력
 * - 주파수 데이터 추출 (bass, mid, treble)
 * - 비트 감지
 *
 * 사용법:
 *   const audio = new AudioCore();
 *   await audio.connectMic();        // 마이크 입력
 *   await audio.connectFile(url);    // 파일 입력
 *   const data = audio.getFrequencyData();
 *   const {bass, mid, treble} = audio.getEnergy();
 */

export class AudioCore {
  constructor(fftSize = 2048) {
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.fftSize = fftSize;
    this.dataArray = null;
    this.freqArray = null;
  }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;

    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
    this.freqArray = new Float32Array(bufferLength);
  }

  async connectMic() {
    if (!this.ctx) await this.init();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.ctx.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    return this;
  }

  async connectFile(url) {
    if (!this.ctx) await this.init();
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    this.audioElement = audio;
    this.source = this.ctx.createMediaElementSource(audio);
    this.source.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    return this;
  }

  play() {
    if (this.audioElement) {
      this.ctx.resume();
      this.audioElement.play();
    }
  }

  pause() {
    if (this.audioElement) this.audioElement.pause();
  }

  /** 0~255 Uint8Array 주파수 데이터 */
  getFrequencyData() {
    this.analyser.getByteFrequencyData(this.dataArray);
    return this.dataArray;
  }

  /** 파형 데이터 (오실로스코프용) */
  getTimeDomainData() {
    const timeData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(timeData);
    return timeData;
  }

  /**
   * 주파수 대역별 에너지 (0~255)
   * bass: 20-250Hz, mid: 250-2000Hz, treble: 2000-16000Hz
   */
  getEnergy() {
    this.analyser.getByteFrequencyData(this.dataArray);
    const nyquist = this.ctx.sampleRate / 2;
    const binCount = this.dataArray.length;

    const freqToBin = (freq) => Math.round((freq / nyquist) * binCount);

    const avgRange = (low, high) => {
      const lowBin = freqToBin(low);
      const highBin = freqToBin(high);
      let sum = 0;
      for (let i = lowBin; i <= highBin && i < binCount; i++) {
        sum += this.dataArray[i];
      }
      return sum / (highBin - lowBin + 1);
    };

    return {
      bass: avgRange(20, 250),
      mid: avgRange(250, 2000),
      treble: avgRange(2000, 16000),
      raw: this.dataArray
    };
  }

  /**
   * 간단한 비트 감지
   * threshold를 넘으면 true
   */
  isBeat(threshold = 150) {
    const { bass } = this.getEnergy();
    return bass > threshold;
  }

  getVolume() {
    this.analyser.getByteFrequencyData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    return sum / this.dataArray.length;
  }

  destroy() {
    if (this.source) this.source.disconnect();
    if (this.ctx) this.ctx.close();
  }
}
