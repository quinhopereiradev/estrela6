// Efeitos sonoros sintetizados (sem arquivos de áudio): pontos, desafio, conquista, nível.
let ctx = null;
const KEY = 'lu-sfx';
export const sfxEnabled = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; } };
export const setSfxEnabled = (v) => { try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (e) { /* sem storage */ } };

function ac() {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
function tone(c, out, { f, t, d = 0.18, type = 'square', v = 0.12, slide = 0, attack = 0.005 }) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.02);
}
function noise(c, out, t, d = 0.25, v = 0.06, hp = 3000) {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * d), c.sampleRate), x = b.getChannelData(0);
  for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / x.length);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'highpass'; f.frequency.value = hp; g.gain.value = v;
  s.buffer = b; s.connect(f); f.connect(g); g.connect(out); s.start(t);
}
const N = (semi) => 440 * Math.pow(2, semi / 12);

const SOUNDS = {
  // moedinha: duas notas rápidas subindo
  points(c, out, t) { tone(c, out, { f: N(7), t, d: 0.08, type: 'square', v: 0.08 }); tone(c, out, { f: N(14), t: t + 0.07, d: 0.22, type: 'square', v: 0.08 }); },
  // desafio concluído: acorde + subida (fanfarra curta)
  mission(c, out, t) {
    [N(-5), N(-1), N(2)].forEach((f) => tone(c, out, { f, t, d: 0.5, type: 'sawtooth', v: 0.05, attack: 0.02 }));
    [N(2), N(5), N(9), N(14)].forEach((f, i) => tone(c, out, { f, t: t + 0.16 + i * 0.07, d: 0.3, type: 'square', v: 0.06 }));
    noise(c, out, t, 0.4, 0.04, 5000);
  },
  // conquista: brilho em arpejo
  achievement(c, out, t) { [0, 4, 7, 12, 16, 19].forEach((s, i) => tone(c, out, { f: N(12 + s), t: t + i * 0.055, d: 0.35, type: 'triangle', v: 0.07 })); },
  // subiu de nível: graves + três notas largas
  level(c, out, t) {
    tone(c, out, { f: 70, t, d: 0.6, type: 'sine', v: 0.25, slide: 0.6 });
    [N(-12), N(-5), N(0)].forEach((f, i) => tone(c, out, { f, t: t + 0.1 + i * 0.16, d: 0.45, type: 'sawtooth', v: 0.06, attack: 0.03 }));
  },
  // aviso neutro (pin enviado, recusa)
  notice(c, out, t) { tone(c, out, { f: N(0), t, d: 0.12, type: 'triangle', v: 0.08 }); tone(c, out, { f: N(-5), t: t + 0.1, d: 0.18, type: 'triangle', v: 0.06 }); },
};

export function playSfx(kind) {
  if (!kind || !sfxEnabled()) return;
  const c = ac(); if (!c || !SOUNDS[kind]) return;
  const out = c.createGain(); out.gain.value = 0.9;
  const comp = c.createDynamicsCompressor();
  out.connect(comp); comp.connect(c.destination);
  SOUNDS[kind](c, out, c.currentTime + 0.01);
}
