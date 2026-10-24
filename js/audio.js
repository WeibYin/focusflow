/**
 * FocusFlow Procedural Web Audio Synthesizer
 * 零外部 MP3 依赖：利用浏览器原生 Web Audio API 实时合成自然环境白噪音与完成提示音
 */

class AmbientAudioEngine {
  constructor() {
    this.ctx = null;
    this.channels = {
      rain: { active: false, volume: 0.45, nodes: null },
      fire: { active: false, volume: 0.35, nodes: null },
      waves: { active: false, volume: 0.30, nodes: null },
      binaural: { active: false, volume: 0.20, nodes: null },
    };
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound(type) {
    this.ensureContext();
    const ch = this.channels[type];
    if (!ch) return false;

    if (ch.active) {
      this.stopChannel(type);
    } else {
      this.startChannel(type);
    }
    return ch.active;
  }

  setVolume(type, volumePercent) {
    const ch = this.channels[type];
    if (!ch) return;
    ch.volume = Math.max(0, Math.min(1, volumePercent / 100));
    if (ch.active && ch.nodes && ch.nodes.gainNode && this.ctx) {
      ch.nodes.gainNode.gain.setTargetAtTime(ch.volume, this.ctx.currentTime, 0.08);
    }
  }

  stopAll() {
    Object.keys(this.channels).forEach((type) => {
      if (this.channels[type].active) {
        this.stopChannel(type);
      }
    });
  }

  startChannel(type) {
    this.ensureContext();
    const ch = this.channels[type];
    if (ch.active) return;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.01, ch.volume), this.ctx.currentTime + 0.4);
    gainNode.connect(this.ctx.destination);

    let cleanup = () => {};

    if (type === 'rain') {
      // 粉红噪波 + 带通滤波模拟窗外夜雨
      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1350;

      whiteNoise.connect(filter);
      filter.connect(gainNode);
      whiteNoise.start(0);

      cleanup = () => {
        try { whiteNoise.stop(); } catch (_) {}
        whiteNoise.disconnect();
      };
    } else if (type === 'fire') {
      // 暖色布朗噪波 + 随机柴火噼啪脉冲
      const bufferSize = 3 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 1.8;
        // 随机叠加清脆火花爆裂声
        if (Math.random() < 0.0012) {
          output[i] += (Math.random() * 2 - 1) * 0.85;
        }
      }
      const src = this.ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 650;

      src.connect(filter);
      filter.connect(gainNode);
      src.start(0);

      cleanup = () => {
        try { src.stop(); } catch (_) {}
        src.disconnect();
      };
    } else if (type === 'waves') {
      // LFO 调制的周期性海浪呼吸声
      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.18;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;

      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.14; // 约 7 秒一次海浪起伏

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 340;

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      src.connect(filter);
      filter.connect(gainNode);
      src.start(0);
      lfo.start(0);

      cleanup = () => {
        try { src.stop(); lfo.stop(); } catch (_) {}
        src.disconnect();
        lfo.disconnect();
      };
    } else if (type === 'binaural') {
      // 432Hz (左耳) + 442Hz (右耳) = 10Hz Alpha 专注差频脑波
      const oscLeft = this.ctx.createOscillator();
      const oscRight = this.ctx.createOscillator();
      const panLeft = this.ctx.createStereoPanner();
      const panRight = this.ctx.createStereoPanner();

      oscLeft.type = 'sine';
      oscRight.type = 'sine';
      oscLeft.frequency.value = 216;
      oscRight.frequency.value = 226; // 10Hz Alpha 差频

      panLeft.pan.value = -0.8;
      panRight.pan.value = 0.8;

      const subGain = this.ctx.createGain();
      subGain.gain.value = 0.25;

      oscLeft.connect(panLeft);
      oscRight.connect(panRight);
      panLeft.connect(subGain);
      panRight.connect(subGain);
      subGain.connect(gainNode);

      oscLeft.start(0);
      oscRight.start(0);

      cleanup = () => {
        try { oscLeft.stop(); oscRight.stop(); } catch (_) {}
        oscLeft.disconnect();
        oscRight.disconnect();
      };
    }

    ch.active = true;
    ch.nodes = { gainNode, cleanup };
  }

  stopChannel(type) {
    const ch = this.channels[type];
    if (!ch || !ch.active) return;
    if (ch.nodes) {
      ch.nodes.cleanup();
      ch.nodes.gainNode.disconnect();
    }
    ch.active = false;
    ch.nodes = null;
  }

  /**
   * 播放清脆的治愈系正弦琶音提示音（番茄钟完成时触发）
   */
  playChime() {
    this.ensureContext();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = this.ctx.currentTime + idx * 0.14;
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 1.15);
    });
  }
}

window.AmbientAudioEngine = AmbientAudioEngine;
