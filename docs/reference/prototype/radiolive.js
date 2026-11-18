// Rádio "ao vivo": todo mundo que sintoniza ouve a mesma faixa, no mesmo ponto.
// A posição sai do relógio + grade do dia (sem servidor de streaming).
// No Laravel isto vira GET /api/radio/{station}/now, calculado do mesmo jeito em PHP.

export const hourOf = (t = Date.now()) => { const d = new Date(t); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };
export const showAt = (st, h) => st.shows.find((s) => h >= s.start && h < s.end) || st.shows[0];
export const nextShow = (st, h) => { const i = st.shows.indexOf(showAt(st, h)); return st.shows[(i + 1) % st.shows.length]; };
export const fmtH = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}h`;

// Clima do programa decide quais faixas entram: madrugada calma, tarde agitada
export const MOODS = { calmo: 'Calmo', misto: 'Misto', agitado: 'Agitado' };
export const showMood = (sh) => sh.mood || (sh.kind !== 'musica' ? 'misto' : sh.start < 6 ? 'calmo' : sh.start < 12 ? 'misto' : sh.start < 18 ? 'agitado' : 'misto');

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function showPlaylist(st, sh, date = new Date()) {
  const tracks = st.tracks.filter((t) => t.is_active);
  const mood = showMood(sh);
  const byEnergy = [...tracks].sort((a, b) => (a.energy ?? 0.5) - (b.energy ?? 0.5));
  const n = Math.max(4, Math.ceil(tracks.length * 0.6));
  const pool = mood === 'calmo' ? byEnergy.slice(0, n) : mood === 'agitado' ? byEnergy.slice(-n) : tracks;
  const r = rng(hash(`${dayKey(date)}|${st.id}|${sh.start}`));
  const out = [...pool];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// O que está no ar agora (ou no instante t): faixa, ponto da faixa e a próxima
export function liveAt(st, t = Date.now()) {
  const d = new Date(t);
  const sh = showAt(st, hourOf(t));
  const start = new Date(d); start.setHours(sh.start, 0, 0, 0);
  const list = showPlaylist(st, sh, d);
  const total = list.reduce((a, x) => a + x.duration_seconds, 0);
  let off = ((t - start.getTime()) / 1000) % total;
  for (let i = 0; i < list.length; i++) {
    const tr = list[i];
    if (off < tr.duration_seconds) return { show: sh, track: tr, offset: off, next: list[(i + 1) % list.length], list };
    off -= tr.duration_seconds;
  }
  return { show: sh, track: list[0], offset: 0, next: list[1] || list[0], list };
}

// ---------------------------------------------------------------------------
// Roteiro dos locutores (inglês, humor original no espírito das rádios de GTA).
// No Laravel isto vira uma tabela de "falas" editável no Filament + geração por IA.
// ---------------------------------------------------------------------------
export const TAGLINES = {
  neon: 'The sound of Vice City after dark.',
  kalaga: 'Dust, diesel and six strings.',
  gulf: 'Rock that smells like motor oil.',
  swamp: "Straight from the swamp. Please don't feed the gators.",
  keys: 'Toes in the sand, drink in hand.',
};
export const BANTER = {
  neon: [
    'Somebody on Ocean Drive just bought sunglasses they cannot afford. Respect.',
    'Traffic update: the causeway is moving at the speed of a retired guy in a convertible. So, normal.',
    "If your car doesn't have neon underglow, are you even allowed to drive at night?",
    'This one goes out to everyone trying to parallel park a yacht.',
    "Fun fact: in Vice City, 'business casual' means the shirt is only half unbuttoned.",
  ],
  kalaga: [
    'The sugar mill smells sweet, the pickup smells worse, and the radio still works. Blessed.',
    'Friendly reminder from the county: shooting at road signs is not a hobby. It is, however, very popular.',
    "If you hear banjos in the woods, that's just us. Probably.",
    'Mount Kalaga is beautiful this time of year. Also every other time of year. We just like saying it.',
    'Dolly here. My truck has three hundred thousand miles and zero working seatbelts. Living the dream.',
  ],
  gulf: [
    'Big Earl here. Port Gellhorn weather: rust, with a chance of more rust.',
    'The ferry is late again. Shocking. Here is a song that is actually on time.',
    'If your check engine light is on, turn this up. Problem solved.',
    'Shout-out to the guy at the motel who has been "checking out tomorrow" since March.',
    'This next song is louder than the paper mill. Barely.',
  ],
  swamp: [
    'Swamp Static, broadcasting from a shack we are legally not allowed to describe.',
    'Humidity: yes. Mosquitoes: also yes. Bad decisions: ongoing.',
    'To the airboat captain doing donuts at three a.m.: we hear you. Everyone hears you.',
    "If something in the water winks at you, don't wink back.",
    'We lost signal for a minute there. A heron sat on the antenna. We negotiated.',
  ],
  keys: [
    'Marina Sol on the Overseas Highway, where the only rush hour is the sunset.',
    'If your boat is called Reel Estate, I am sorry, but also, thank you.',
    'Island time update: it is currently whenever you want it to be.',
    'Somebody just paid forty dollars for a coconut with a straw in it. Living their best life.',
    'Reminder: sunscreen is cheaper than regret.',
  ],
};
export const WEATHER = [
  'Leonida weather: hot. Tomorrow: hotter. Hurricane season: always.',
  'Forecast calls for sun, humidity, and a ninety percent chance of someone yelling at a pelican.',
  'Expect afternoon storms, followed by everyone pretending they saw it coming.',
  'It is so humid out there, your sunglasses are sweating.',
];
export const ADS = [
  'Vice Beach Timeshares. Own one week a year of a condo you will never find again. Act now, think later.',
  "The Leonida State Lottery. You can't win if you don't play. You also can't win if you do. Play responsibly.",
  'Swamp Juice. It is green, it is warm, and it is legally a beverage.',
  "Hurricane insurance from Totally Real Coverage Incorporated. We'll be there for you. Unless there is wind.",
  'Feeling lost? Try LostGPS, the navigation app that gets you there eventually. Recalculating. Recalculating.',
  'Port Gellhorn Pawn and Bail. One stop for your worst Saturday.',
  "Kalaga Monster Trucks. Compensating for something since nineteen eighty-seven.",
  "Flamingo Fitness. Stand on one leg for an hour. It's not a workout, it's a lifestyle.",
];
export const KICKERS = [
  'A pelican stole a tourist\'s phone and is now reportedly doing better on social media than the tourist.',
  'Officials confirm the sun will continue to exist. Residents are urged to remain sweaty.',
  'A local man arrested for jaywalking says he was, quote, just exploring the map.',
  'Scientists warn that Florida Man has evolved. He now has a podcast.',
  'The mayor promised to fix every pothole by spring. He did not say which spring.',
];
export const RECADOS = [
  { from: 'mangue boy', text: 'says hi to everyone in Hamlet who found the alligator in the hat. He asks you to please stop feeding it.' },
  { from: 'vice girl', text: 'wants to know who already cracked the Morse code on the flamingo sign. No spoilers, just say yes or no.' },
  { from: 'kalaga kid', text: 'requests something with a guitar for everyone driving up Mount Kalaga in a pickup with no brakes.' },
  { from: 'port rat', text: 'warns all Port Gellhorn drivers: the nine o\'clock ferry is always late. Always.' },
  { from: 'keys lime', text: 'says the sunset over the Keys tonight is unreal, and photo mode is now a lifestyle.' },
];
// Tom de voz por apresentador (a voz é a do navegador; no Laravel, áudio pré-gerado)
export const HOST_VOICE = {
  'DJ Flamingo': { pitch: 1.1, rate: 1.08 }, 'Lady Vice': { pitch: 1.35, rate: 1.04 }, 'Dolly Pines': { pitch: 1.25, rate: 0.95 },
  'Big Earl': { pitch: 0.55, rate: 0.92 }, 'Swamp Static': { pitch: 0.75, rate: 0.88 }, 'Marina Sol': { pitch: 1.2, rate: 0.98 },
  'Redação 6★': { pitch: 1.0, rate: 1.1 }, 'Ouvintes': { pitch: 1.1, rate: 1.04 }, 'Commercial': { pitch: 0.95, rate: 1.18 },
};
