// All sound is synthesised with WebAudio — no audio files anywhere.
// A tiny synth: short blips, a noise burst for gunfire, a two-tone siren
// and an engine hum whose pitch follows the player's speed.

export function createAudio() {
  let context = null;
  let master = null;
  let sirenNodes = null;
  let engineNodes = null;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function blip(freq, duration, type, volume, slideTo) {
    if (!ensure()) return;
    const t = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    gain.gain.setValueAtTime(volume || 0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function noiseBurst(duration, volume, lowpass) {
    if (!ensure()) return;
    const t = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const gain = context.createGain();
    gain.gain.value = volume || 0.6;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t);
  }

  return {
    unlock,
    click() { blip(660, 0.06, 'square', 0.25); },
    pickup() { blip(880, 0.09, 'sine', 0.4); blip(1320, 0.12, 'sine', 0.3); },
    punch() { noiseBurst(0.08, 0.4, 900); },
    shoot() { noiseBurst(0.12, 0.7, 2400); blip(180, 0.08, 'sawtooth', 0.3, 60); },
    hurt() { blip(220, 0.18, 'sawtooth', 0.4, 110); },
    bust() { blip(440, 0.4, 'sawtooth', 0.4, 220); blip(330, 0.5, 'sawtooth', 0.35, 165); },
    mission() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => blip(freq, 0.16, 'triangle', 0.4), i * 110);
      });
    },
    // A looping two-tone siren while any police car is chasing.
    siren(on) {
      if (on && !sirenNodes && ensure()) {
        const osc = context.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 700;
        const lfo = context.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 1.6;
        const lfoGain = context.createGain();
        lfoGain.gain.value = 260;
        const gain = context.createGain();
        gain.gain.value = 0.05;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        lfo.start();
        sirenNodes = { osc, lfo, gain };
      } else if (!on && sirenNodes) {
        try { sirenNodes.osc.stop(); sirenNodes.lfo.stop(); } catch { /* already stopped */ }
        sirenNodes = null;
      }
    },
    // A low engine hum that follows the player car's speed, 0..1.
    engine(level) {
      if (!ensure()) return;
      if (level <= 0.02) {
        if (engineNodes) {
          try { engineNodes.osc.stop(); } catch { /* already stopped */ }
          engineNodes = null;
        }
        return;
      }
      if (!engineNodes) {
        const osc = context.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 60;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        const gain = context.createGain();
        gain.gain.value = 0.05;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        osc.start();
        engineNodes = { osc, gain };
      }
      engineNodes.osc.frequency.value = 55 + level * 130;
      engineNodes.gain.gain.value = 0.03 + level * 0.05;
    },
  };
}
