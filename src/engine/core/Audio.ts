// Audio.ts — procedural audio via Web Audio API.
//
// No asset files. All sounds are synthesised: sword swings are bandpass
// noise bursts, bow shots are sawtooth + decay, footsteps are short
// oscillator clicks, ambient wind is pink noise filtered by a slow
// LFO. CPU-only; no sample buffers beyond short generated noise.

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientNodes: AudioNode[] = [];
  private enabled = true;

  init(): void {
    if (this.ctx) return;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (err) {
      console.warn("AudioBus: Web Audio unavailable", err);
    }
  }

  resume(): void {
    if (this.ctx?.state === "suspended") {
      void this.ctx.resume();
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.5 : 0;
  }

  swordSwing(): void { this.playSwordSwing(); }
  bowShot(): void { this.playBowShot(); }
  hit(): void { this.playHit(); }
  footstep(): void { this.playFootstep(); }
  dialogue(): void { this.playDialogue(); }
  discovery(): void { this.playDiscovery(); }

  startAmbientWind(): void {
    if (!this.ctx || !this.master) return;
    if (this.ambientNodes.length > 0) return;

    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 100;
    lfo.connect(lfoGain).connect(filter.frequency);

    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;

    noise.connect(filter).connect(gain).connect(this.master);
    noise.start();
    lfo.start();
    this.ambientNodes.push(noise, filter, lfo, lfoGain, gain);
  }

  stopAmbient(): void {
    for (const node of this.ambientNodes) {
      try {
        if ("stop" in node && typeof (node as AudioScheduledSourceNode).stop === "function") {
          (node as AudioScheduledSourceNode).stop();
        }
      } catch { /* already stopped */ }
      try { node.disconnect(); } catch { /* already disconnected */ }
    }
    this.ambientNodes = [];
  }

  private playSwordSwing(): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const noise = this.makeNoiseBuffer(0.2);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.15);
    filter.Q.value = 4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(now);
    src.stop(now + 0.22);
  }

  private playBowShot(): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  private playHit(): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const noise = this.makeNoiseBuffer(0.1);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(now);
    src.stop(now + 0.12);
  }

  private playFootstep(): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.05);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  private playDialogue(): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  private playDiscovery(): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    [660, 880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(gain).connect(this.master!);
      osc.start(start);
      osc.stop(start + 0.42);
    });
  }

  private makeNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
