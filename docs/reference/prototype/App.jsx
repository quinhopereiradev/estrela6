import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { POSTS, MARKERS, STATIONS } from './data.js';
import { renderTrack, makeNoiseBuffer } from './synth.js';
import { buildIndex, nlSearch, fmtDist } from './nlsearch.js';
import { regionAt, edgeDist } from './geo.js';
import { LEVELS, starsOf, nextLevel, trustOf, POINTS, ACHIEVEMENTS, ACH_CATEGORIES, TIERS, weekKey, weekEndsIn, dayKey, dayEndsIn, dailyChallenges, weeklyChallenges, MOCK_PLAYERS } from './game.js';
import NEWS from './news.json';
import { playSfx, sfxEnabled, setSfxEnabled } from './sfx.js';
import { hourOf, showAt, nextShow, fmtH, liveAt, showMood, MOODS, TAGLINES, HOST_VOICE, BANTER, WEATHER, ADS, KICKERS, RECADOS } from './radiolive.js';
import qrcode from 'qrcode-generator';

// Endereço público usado nos links de compartilhamento.
// Protótipo: o próprio artifact (o #local-ID chega até a página). No Laravel: config('app.url') . '/mapa/l/{id}'.
const PUBLIC_BASE = 'https://claude.ai/artifact/WeYiB9MBEetFxSgT97bshV';
const linkFor = (kind, id) => `${PUBLIC_BASE}#${kind === 'pin' ? 'pin' : 'local'}-${id}`;
import {
  IconPalm, IconStar, IconRadio, IconPin, IconFeed, IconPlay, IconPause, IconPrev, IconNext,
  IconVolume, IconMute, IconClose, IconShield, IconCheck,
} from './icons.jsx';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const CATEGORY_TAG = {
  noticia: { label: '[NOTÍCIA]', cls: 'tag-cyan' },
  teoria: { label: '[TEORIA]', cls: 'tag-orange' },
  'easter-egg': { label: '[EASTER EGG]', cls: 'tag-pink' },
  video: { label: '[SHORTS]', cls: 'tag-violet' },
};

const MARKER_CATS = {
  'easter-egg': { label: 'Easter Egg', color: '#ff007f' },
  veiculo: { label: 'Veículo', color: '#00f0ff' },
  segredo: { label: 'Segredo', color: '#a855f7' },
  missao: { label: 'Missão', color: '#ff5e00' },
};

const FEED_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'noticia', label: 'Notícias' },
  { key: 'teoria', label: 'Teorias' },
  { key: 'easter-egg', label: 'Easter Eggs' },
  { key: 'video', label: 'Shorts' },
];

const VIEWS = ['feed', 'mapa', 'radio', 'perfil'];
// Mapa-base: Yanis GTA VI Community Map v17 via GTADB.org (CC BY 4.0), recortado.
// Bounds em metros do jogo (mesmo sistema de coordenadas dos landmarks): [[yMin, xMin], [yMax, xMax]]
// Tiles 1024px em pirâmide (zoom -4 a 0 = 1 m/px); o navegador baixa só o que está visível.
const DEFAULT_MAP = {
  tiles: 'tiles/{z}/{x}_{y}.jpg', minNativeZoom: -4, maxNativeZoom: 0, maxZoom: 2.5,
  w: 15040, h: 20480, name: null, credit: true, bounds: [[-9216, -11264], [11264, 3776]],
};

const fmtTime = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase();

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function Tag({ category, className = '' }) {
  const t = CATEGORY_TAG[category];
  return <span className={`tag ${t.cls} ${className}`}>{t.label}</span>;
}

function Wanted({ level, size = 'w-3.5 h-3.5' }) {
  return (
    <span className="inline-flex gap-0.5 text-sunset" title={`Nível de hype ${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <IconStar key={i} filled={i <= level} className={`${size} ${i <= level ? 'drop-shadow-[0_0_4px_#ff5e00]' : 'opacity-40'}`} />
      ))}
    </span>
  );
}

/* Placeholder de capa: céu de pôr do sol + palmeiras. Troque por cover_image. */
function Cover({ post, className = '' }) {
  const palette = {
    noticia: ['#00f0ff', '#3b0764'],
    teoria: ['#ff5e00', '#3b0764'],
    'easter-egg': ['#ff007f', '#3b0764'],
    video: ['#a855f7', '#09090b'],
  }[post.category];
  const id = `g${post.id}`;
  if (post.cover_image) return <img src={post.cover_image} alt="" className={`w-full h-full object-cover ${className}`} />;
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className={`w-full h-full ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette[1]} />
          <stop offset="0.55" stopColor="#ff007f" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff5e00" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`${id}sun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd166" />
          <stop offset="1" stopColor="#ff007f" />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <rect x="0" y="0" width="400" height="160" />
        </clipPath>
      </defs>
      <rect width="400" height="240" fill={`url(#${id}s)`} />
      <g clipPath={`url(#${id}c)`}>
        <circle cx={200 + ((post.id * 47) % 120) - 60} cy="150" r="70" fill={`url(#${id}sun)`} />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x="0" y={112 + i * 10} width="400" height={2 + i} fill={palette[1]} opacity="0.85" />
        ))}
      </g>
      <rect y="160" width="400" height="80" fill="#09090b" />
      {Array.from({ length: 11 }).map((_, i) => (
        <line key={i} x1={200} y1={160} x2={-200 + i * 80} y2={240} stroke={palette[0]} strokeOpacity="0.45" strokeWidth="1" />
      ))}
      {[170, 182, 198, 220].map((y) => (
        <line key={y} x1="0" x2="400" y1={y} y2={y} stroke={palette[0]} strokeOpacity="0.35" strokeWidth="1" />
      ))}
      {/* palmeiras */}
      <g fill="#09090b">
        <path d="M40 160 C 44 120, 52 95, 60 80 L 64 82 C 57 100, 50 125, 48 160 Z" />
        <path d="M62 80 C 40 70, 20 78, 10 92 C 30 80, 48 80, 62 84 Z M62 80 C 80 66, 100 70, 112 84 C 96 76, 78 78, 64 84 Z M62 80 C 56 60, 66 48, 80 44 C 70 56, 66 68, 64 82 Z M62 82 C 44 84, 34 100, 32 112 C 42 98, 52 90, 64 86 Z M62 82 C 82 86, 92 100, 92 112 C 84 98, 74 90, 62 86 Z" />
        <path d="M350 160 C 352 130, 346 110, 336 96 L 340 94 C 350 108, 358 130, 358 160 Z" />
        <path d="M338 95 C 320 86, 300 90, 292 102 C 308 94, 324 94, 338 99 Z M338 95 C 352 82, 372 84, 382 96 C 368 90, 352 92, 340 99 Z M338 96 C 330 80, 338 70, 350 66 C 342 78, 340 88, 340 98 Z" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Navbar                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Proteção contra spoilers                                            */
/* ------------------------------------------------------------------ */

const SPOILER_TYPES = {
  historia: { label: 'História e missões', short: 'HISTÓRIA', hint: 'Enredo, personagens, missões e finais.' },
  easter: { label: 'Easter eggs e segredos', short: 'SEGREDO', hint: 'Easter eggs, segredos e o que tem escondido em cada lugar.' },
  leak: { label: 'Leaks e rumores', short: 'LEAK', hint: 'Material vazado e locais ainda não confirmados pela Rockstar.' },
};
const PIN_SPOILER = { missao: 'historia', 'easter-egg': 'easter', segredo: 'easter' };
const SPOILER_PRESETS = {
  tudo: { label: 'Quero tudo', tag: 'SEM FILTRO', color: '#ff5e00', desc: 'Leaks, teorias, missões e segredos à vista. Para quem caça tudo antes de todo mundo.', hide: { historia: false, easter: false, leak: false }, fog: false },
  oficial: { label: 'Só o oficial', tag: 'RECOMENDADO', color: '#00f0ff', desc: 'Esconde leaks e locais não confirmados. Bom para quem ainda vai comprar ou espera a versão de PC.', hide: { historia: false, easter: false, leak: true }, fog: false },
  cego: { label: 'Às cegas', tag: 'ZERO SPOILER', color: '#ff007f', desc: 'Esconde história, missões, segredos e leaks. O mapa começa coberto e você revela as regiões conforme explora no jogo.', hide: { historia: true, easter: true, leak: true }, fog: true },
};
const SPOILER_KEY = 'lu-spoilers-v1';
const loadSpoilers = () => { try { return JSON.parse(localStorage.getItem(SPOILER_KEY)); } catch (e) { return null; } };
const saveSpoilers = (v) => { try { localStorage.setItem(SPOILER_KEY, JSON.stringify(v)); } catch (e) { /* sem storage: vale só nesta visita */ } };
const presetOf = (hide, fog) =>
  Object.entries(SPOILER_PRESETS).find(([, p]) => p.fog === fog && Object.keys(p.hide).every((k) => p.hide[k] === hide[k]))?.[0] || 'custom';
const DEFAULT_SPOILERS = { preset: 'oficial', hide: { ...SPOILER_PRESETS.oficial.hide }, fog: false, visited: [], chosen: false };

/* Texto tarjado: mantém o "tamanho" das palavras sem revelar o conteúdo */
function Redacted({ text, className = '' }) {
  const words = String(text).split(/\s+/).slice(0, 14);
  return (
    <span className={`redacted ${className}`} aria-label="Conteúdo escondido (spoiler)">
      {words.map((w, i) => <span key={i} style={{ width: `${Math.min(10, Math.max(2, w.length)) * 0.55}em` }} />)}
    </span>
  );
}

function SpoilerVeil({ type, compact }) {
  const t = SPOILER_TYPES[type];
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-black/55 backdrop-blur-xl pointer-events-none">
      <div className="text-center px-3">
        <div className="spoiler-stamp">⚠ SPOILER · {t.short}</div>
        {!compact && <div className="font-mono text-[11px] text-zinc-300 mt-2">Toque para revelar</div>}
      </div>
    </div>
  );
}

function ShieldIcon(p) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
    </svg>
  );
}

function SpoilerModal({ value, regions, onSave, onClose, firstTime, shield, setShield }) {
  const [v, setV] = useState(() => ({ ...value, hide: { ...value.hide }, visited: [...value.visited] }));
  const applyPreset = (k) => setV((s) => ({ ...s, preset: k, hide: { ...SPOILER_PRESETS[k].hide }, fog: SPOILER_PRESETS[k].fog }));
  const setHide = (k, on) => setV((s) => { const hide = { ...s.hide, [k]: on }; return { ...s, hide, preset: presetOf(hide, s.fog) }; });
  const setFog = (on) => setV((s) => ({ ...s, fog: on, preset: presetOf(s.hide, on) }));
  const toggleVisited = (id) => setV((s) => ({ ...s, visited: s.visited.includes(id) ? s.visited.filter((x) => x !== id) : [...s.visited, id] }));
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !firstTime && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [firstTime, onClose]);

  return (
    <div className="fixed inset-0 z-[2700] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in" onClick={() => !firstTime && onClose()}>
      <div className="glass-card w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 relative" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Proteção contra spoilers">
        {!firstTime && <button onClick={onClose} className="absolute top-3 right-3 icon-btn" aria-label="Fechar"><IconClose className="w-5 h-5" /></button>}
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-lg bg-neon/15 border border-neon/50 text-neon"><ShieldIcon className="w-6 h-6" /></span>
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-sunset">{firstTime ? '// ANTES DE ENTRAR EM LEONIDA' : '// SUAS PREFERÊNCIAS'}</p>
            <h2 className="font-display uppercase text-3xl md:text-4xl text-white leading-none">Proteção contra spoilers</h2>
          </div>
        </div>
        <p className="mt-3 text-sm text-zinc-300">
          O GTA VI chega primeiro aos consoles, e a versão de PC ainda não tem data. Escolha o quanto você quer saber. Dá para mudar quando quiser pelo escudo no topo da página.
        </p>

        <div className="mt-5 grid md:grid-cols-3 gap-3" role="radiogroup" aria-label="Nível de proteção">
          {Object.entries(SPOILER_PRESETS).map(([k, p]) => {
            const on = v.preset === k;
            return (
              <button key={k} role="radio" aria-checked={on} onClick={() => applyPreset(k)}
                className={`text-left p-4 rounded-xl border transition ${on ? 'bg-white/5' : 'border-zinc-700 hover:border-zinc-500'}`}
                style={on ? { borderColor: p.color, boxShadow: `0 0 20px -6px ${p.color}` } : undefined}>
                <span className="font-mono text-[10px] tracking-widest" style={{ color: p.color }}>{p.tag}</span>
                <span className="block font-display uppercase text-2xl text-white mt-0.5">{p.label}</span>
                <span className="block text-xs text-zinc-400 mt-1">{p.desc}</span>
              </button>
            );
          })}
        </div>

        <details className="mt-5 rounded-xl border border-zinc-800 bg-black/40 p-4" open={!firstTime || v.preset === 'custom'}>
          <summary className="cursor-pointer font-mono text-xs tracking-widest text-zinc-300">PERSONALIZAR {v.preset === 'custom' && <span className="text-cyber">· PERSONALIZADO</span>}</summary>
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            {Object.entries(SPOILER_TYPES).map(([k, t]) => (
              <label key={k} className="flex gap-3 items-start cursor-pointer">
                <input type="checkbox" checked={v.hide[k]} onChange={(e) => setHide(k, e.target.checked)} className="mt-1 accent-pink-500" />
                <span><span className="block text-sm text-white">Esconder {t.label.toLowerCase()}</span><span className="block text-xs text-zinc-500">{t.hint}</span></span>
              </label>
            ))}
            <label className="flex gap-3 items-start cursor-pointer">
              <input type="checkbox" checked={v.fog} onChange={(e) => setFog(e.target.checked)} className="mt-1 accent-pink-500" />
              <span><span className="block text-sm text-white">Névoa no mapa</span><span className="block text-xs text-zinc-500">Regiões que você ainda não explorou ficam cobertas, com locais e pins escondidos.</span></span>
            </label>
          </div>
          {v.fog && regions?.length > 0 && (
            <div className="mt-4">
              <p className="field-label">Regiões que você já explorou no jogo</p>
              <div className="flex flex-wrap gap-2">
                {regions.map((r) => {
                  const on = v.visited.includes(r.id);
                  return (
                    <button key={r.id} onClick={() => toggleVisited(r.id)} aria-pressed={on}
                      className={`px-3 py-1.5 rounded-full border text-sm transition ${on ? 'text-white' : 'border-zinc-700 text-zinc-400'}`}
                      style={on ? { borderColor: r.color, background: `${r.color}22` } : undefined}>
                      {on ? '✓ ' : ''}{r.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </details>

        <div className="mt-4 rounded-xl border border-violet-400/30 bg-violet-500/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="text-sm text-white font-semibold">Escudo rápido para lives e gravações</p>
            <p className="text-xs text-zinc-400">Esconde todo spoiler na hora, sem mexer nas suas preferências. Atalho: <kbd className="kbd">Shift</kbd> + <kbd className="kbd">S</kbd></p>
          </div>
          <button onClick={() => setShield(!shield)} aria-pressed={shield}
            className={`shrink-0 px-3 py-2 rounded-lg border font-mono text-xs ${shield ? 'border-neon text-white bg-neon/20' : 'border-zinc-600 text-zinc-300'}`}>
            {shield ? 'ESCUDO LIGADO' : 'LIGAR ESCUDO'}
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {!firstTime && <button onClick={onClose} className="btn-ghost">Cancelar</button>}
          <button onClick={() => onSave({ ...v, chosen: true })} className="btn-neon">{firstTime ? 'Entrar no portal' : 'Salvar preferências'}</button>
        </div>
      </div>
    </div>
  );
}

function Navbar({ view, spoilerInfo, onSpoiler, onSearch, user, respect, onLogin }) {
  const links = [
    { key: 'feed', label: 'Feed', icon: IconFeed },
    { key: 'mapa', label: 'Mapa Interativo', icon: IconPin },
    { key: 'radio', label: 'Rádio', icon: IconRadio },
  ];
  return (
    <header className="fixed top-0 inset-x-0 z-[1000] h-16 border-b border-pink-500/20 bg-vc-bg/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl h-full px-4 flex items-center justify-between gap-4">
        <a href="#feed" className="flex items-center gap-2.5 group shrink-0">
          <span className="grid place-items-center w-9 h-9 rounded-md bg-gradient-to-br from-neon to-sunset shadow-neon">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-vc-bg" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>
          </span>
          <span className="leading-none hidden sm:block">
            <span className="block font-display text-xl tracking-wider text-white group-hover:text-neon transition-colors">ESTRELA<span className="text-neon glow-pink">6</span></span>
            <span className="block text-[12px] leading-none tracking-[0.25em] text-zinc-600 mt-0.5" aria-label="seis estrelas">★★★★★<span className="text-neon glow-pink">★</span></span>
          </span>
        </a>
        <nav className="flex items-center gap-1">
          <button onClick={onSearch} className="mr-1 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition" aria-label="Buscar em todo o portal (Ctrl + K)" title="Buscar (Ctrl + K)">
            <SearchIcon className="w-4 h-4" />
            <span className="hidden lg:inline text-xs">Buscar</span>
            <span className="hidden lg:inline kbd">Ctrl K</span>
          </button>
          {links.map(({ key, label, icon: Icon }) => (
            <a
              key={key}
              href={`#${key}`}
              className={`nav-link ${view === key ? 'nav-link--active' : ''}`}
              aria-current={view === key ? 'page' : undefined}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </a>
          ))}
          <button onClick={onSpoiler} className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border font-mono text-[10px] tracking-wider transition hover:bg-white/5"
            style={{ borderColor: `${spoilerInfo.color}88`, color: spoilerInfo.color }} title="Proteção contra spoilers (Shift + S = escudo rápido)">
            <ShieldIcon className="w-4 h-4" />
            <span className="hidden md:inline">{spoilerInfo.label.toUpperCase()}</span>
          </button>
          {user ? (
            <a href="#perfil" className={`ml-1 inline-flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border transition ${view === 'perfil' ? 'border-pink-500 bg-pink-500/10' : 'border-zinc-700 hover:border-zinc-500'}`} aria-label={`Seu perfil: @${user.name}, ${respect} de respeito`} aria-current={view === 'perfil' ? 'page' : undefined}>
              <Avatar user={user} size={26} />
              <span className="hidden lg:flex flex-col leading-none">
                <span className="text-[11px] text-white max-w-[7rem] truncate">@{user.name}</span>
                <span className="text-[9px] text-yellow-300 tracking-tighter">{'★'.repeat(starsOf(respect))}<span className="text-zinc-500 font-mono ml-1">{respect}</span></span>
              </span>
            </a>
          ) : (
            <button onClick={onLogin} className="ml-1 px-3 py-1.5 rounded-md bg-neon/15 border border-neon/60 text-neon text-xs font-semibold hover:bg-neon/25 transition">Entrar</button>
          )}
        </nav>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Feed                                                                */
/* ------------------------------------------------------------------ */

// Player 9:16. No protótipo: MP4 local (a página publicada bloqueia conteúdo externo).
// No Laravel: YouTube Shorts via youtube-nocookie, carregado só no clique (fachada leve, sem cookies antes do play).
function VerticalEmbed({ post, large }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [prog, setProg] = useState(0);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const v = ref.current; if (!v) return;
    if (large) { v.muted = false; setMuted(false); v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => {}); }); }
  }, [large]);
  if (!post.video_url) {
    return (
      <div className={`relative aspect-[9/16] ${large ? 'w-full max-w-[320px]' : 'h-full'} mx-auto rounded-xl overflow-hidden border border-violet-400/40 bg-black grid place-items-center`}>
        <Cover post={post} className="absolute inset-0 opacity-60" />
        <span className="relative font-mono text-[11px] text-zinc-300">Vídeo indisponível</span>
      </div>
    );
  }
  const toggle = (e) => { e?.stopPropagation?.(); const v = ref.current; if (!v) return; v.paused ? v.play() : v.pause(); };
  return (
    <div className={`relative aspect-[9/16] ${large ? 'w-full max-w-[340px]' : 'h-full'} mx-auto rounded-xl overflow-hidden border border-violet-400/40 bg-black shadow-[0_0_30px_-8px_#a855f7] group/v`}>
      <video ref={ref} src={post.video_url} poster={post.poster} className="absolute inset-0 w-full h-full object-cover"
        muted={muted} loop playsInline preload="metadata" autoPlay={!large && !reduce}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setProg(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
        aria-label={`Vídeo: ${post.title}`} />
      <div className="absolute top-2 left-2 font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-violet-300 border border-violet-400/40">9:16</div>
      {large ? (
        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
          <input type="range" min="0" max="1000" value={Math.round(prog * 1000)} aria-label="Posição do vídeo"
            onChange={(e) => { const v = ref.current; if (v?.duration) v.currentTime = (e.target.value / 1000) * v.duration; }}
            className="neon-range w-full" style={{ '--p': `${prog * 100}%` }} />
          <div className="flex items-center gap-2 mt-1">
            <button onClick={toggle} className="icon-btn !w-8 !h-8" aria-label={playing ? 'Pausar vídeo' : 'Tocar vídeo'}>{playing ? <IconPause className="w-4 h-4" /> : <IconPlay className="w-4 h-4" />}</button>
            <button onClick={(e) => { e.stopPropagation(); const v = ref.current; v.muted = !v.muted; setMuted(v.muted); }} className="icon-btn !w-8 !h-8" aria-label={muted ? 'Ativar som' : 'Silenciar'}>{muted ? <IconMute className="w-4 h-4" /> : <IconVolume className="w-4 h-4" />}</button>
            <span className="flex-1" />
            <button onClick={(e) => { e.stopPropagation(); ref.current?.requestFullscreen?.(); }} className="font-mono text-[10px] text-zinc-300 hover:text-white px-2" aria-label="Tela cheia">⛶ TELA CHEIA</button>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10"><div className="h-full bg-neon" style={{ width: `${prog * 100}%` }} /></div>
          {!playing && <div className="absolute inset-0 grid place-items-center pointer-events-none"><span className="grid place-items-center w-14 h-14 rounded-full bg-neon/90 shadow-neon"><IconPlay className="w-6 h-6 text-white translate-x-0.5" /></span></div>}
        </>
      )}
    </div>
  );
}

/* --- Selo de confiabilidade --- */
const RELIABILITY = {
  oficial: { label: 'CONFIRMADO', color: '#00f0ff', hint: 'Informação oficial, com fonte' },
  rumor: { label: 'RUMOR', color: '#ff5e00', hint: 'Ainda sem confirmação; o medidor mostra o quanto a comunidade confia' },
  comunidade: { label: 'COMUNIDADE', color: '#c084fc', hint: 'Conferido por membros da comunidade' },
  'nao-verificado': { label: 'NÃO VERIFICADO', color: '#ef4444', hint: 'Fonte duvidosa; trate como boato' },
};

function ConfidenceMeter({ value, color, size = 'sm' }) {
  const n = Math.max(1, Math.round(value / 20));
  return (
    <span className="inline-flex items-center gap-[2px]" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={size === 'lg' ? 'w-3 h-2 rounded-[1px]' : 'w-1.5 h-1.5 rounded-[1px]'} style={{ background: i <= n ? color : '#3f3f46' }} />
      ))}
    </span>
  );
}

function Reliability({ r, full = false }) {
  if (!r) return null;
  const R = RELIABILITY[r.level];
  const metered = r.confidence != null;
  if (!full) {
    const aria = `${R.label}${metered ? `, confiança ${r.confidence}%` : ''}${r.confirmations ? `, ${r.confirmations} confirmações` : ''}`;
    return (
      <span className="rel-badge" style={{ color: R.color, borderColor: `${R.color}66` }} title={`${R.hint}${r.basis ? ` · ${r.basis}` : ''}${r.source ? ` · Fonte: ${r.source.name}` : ''}`} aria-label={aria}>
        {r.level === 'oficial' && <IconCheck className="w-3 h-3" />}
        {R.label}
        {metered && <ConfidenceMeter value={r.confidence} color={R.color} />}
        {r.confirmations ? <span className="opacity-80">· {r.confirmations}✓</span> : null}
      </span>
    );
  }
  return (
    <div className="rounded-lg border p-3 mb-4" style={{ borderColor: `${R.color}55`, background: `${R.color}0d` }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs tracking-widest font-bold inline-flex items-center gap-1.5" style={{ color: R.color }}>
          {r.level === 'oficial' && <IconCheck className="w-3.5 h-3.5" />}{R.label}
        </span>
        {metered && (
          <span className="inline-flex items-center gap-2 font-mono text-[11px] text-zinc-300">
            <ConfidenceMeter value={r.confidence} color={R.color} size="lg" /> confiança {r.confidence}%
          </span>
        )}
        {r.confirmations ? <span className="font-mono text-[11px] text-zinc-300">{r.confirmations} confirmações</span> : null}
      </div>
      <p className="text-sm text-zinc-400 mt-1">{r.basis || R.hint}</p>
      {r.source && (
        <a href={r.source.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 font-mono text-[11px] underline underline-offset-2" style={{ color: R.color }}>
          Fonte: {r.source.name} ↗
        </a>
      )}
    </div>
  );
}

/* --- Post ligado ao mapa --- */
const placeHash = (p) => (p ? `#${p.kind === 'pin' ? 'pin' : 'local'}-${p.id}` : null);

function MapLink({ post, regionName, variant = 'icon' }) {
  if (!post.place) return null;
  const label = `Ver no mapa${regionName ? `: ${regionName}` : ''}`;
  if (variant === 'pill') {
    return (
      <a href={placeHash(post.place)} className="map-link-pill" aria-label={label} title={label}>
        <IconPin className="w-3.5 h-3.5" /> VER NO MAPA{regionName ? <span className="opacity-70">· {regionName.toUpperCase()}</span> : null}
      </a>
    );
  }
  return (
    <a href={placeHash(post.place)} className="map-link-icon" aria-label={label} title={label}>
      <IconPin className="w-4 h-4" />
    </a>
  );
}

function FeaturedCard({ post, onOpen, spoil, regionName }) {
  const isVideo = post.category === 'video';
  const hid = spoil.isHidden(post.spoiler, `post:${post.id}`);
  return (
    <div className="relative sm:col-span-2 lg:col-span-2 row-span-2">
      <button onClick={() => (hid ? spoil.reveal(`post:${post.id}`) : onOpen(post))} className="glass-card group w-full h-full text-left flex flex-col overflow-hidden relative"
        aria-label={hid ? `Spoiler escondido (${SPOILER_TYPES[post.spoiler].label}). Revelar` : undefined}>
        {hid && <SpoilerVeil type={post.spoiler} />}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {isVideo ? (
            <div className="h-full p-4 bg-gradient-to-br from-deep/60 to-black"><VerticalEmbed post={post} /></div>
          ) : (
            <Cover post={post} className="transition-transform duration-700 group-hover:scale-105" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-vc-bg via-vc-bg/30 to-transparent pointer-events-none" />
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="tag tag-solid">DESTAQUE</span>
            <Tag category={post.category} />
          </div>
        </div>
        <div className="relative p-5 -mt-16">
          <div className="flex flex-wrap items-center gap-3 mb-2 font-mono text-[11px] text-zinc-400">
            <span>{fmtDate(post.created_at)}</span>
            {post.author && <span className="text-pink-300">por @{post.author}</span>}
            <Wanted level={post.hype} />
            {!hid && <Reliability r={post.reliability} />}
          </div>
          <h2 className="font-display text-3xl md:text-4xl leading-[1.05] text-white uppercase group-hover:text-neon transition-colors">
            {hid ? <Redacted text={post.title} /> : post.title}
          </h2>
          <p className="mt-2 text-zinc-300 text-sm md:text-base line-clamp-2">{hid ? <Redacted text={post.excerpt} /> : post.excerpt}</p>
        </div>
      </button>
      {!hid && <div className="absolute top-3 right-3 z-10"><MapLink post={post} regionName={regionName} variant="pill" /></div>}
    </div>
  );
}

function PostCard({ post, wide, onOpen, spoil, regionName }) {
  const isVideo = post.category === 'video';
  const hid = spoil.isHidden(post.spoiler, `post:${post.id}`);
  const click = () => (hid ? spoil.reveal(`post:${post.id}`) : onOpen(post));
  const T = (t) => (hid ? <Redacted text={t} /> : t);
  const aria = hid ? `Spoiler escondido (${SPOILER_TYPES[post.spoiler].label}). Revelar` : undefined;
  const link = !hid && post.place;
  if (isVideo) {
    return (
      <div className="relative row-span-2">
        <button onClick={click} className="glass-card group w-full h-full text-left flex flex-col overflow-hidden p-3 relative" aria-label={aria}>
          {hid && <SpoilerVeil type={post.spoiler} />}
          <div className="flex-1 min-h-0"><VerticalEmbed post={post} /></div>
          <div className="pt-3">
            <div className="flex items-center justify-between mb-1">
              <Tag category={post.category} />
              <Wanted level={post.hype} size="w-3 h-3" />
            </div>
            <h3 className="font-display uppercase text-lg leading-tight text-white group-hover:text-violet-300 transition-colors line-clamp-2">{T(post.title)}</h3>
          </div>
        </button>
        {link && <div className="absolute top-5 right-5 z-10"><MapLink post={post} regionName={regionName} /></div>}
      </div>
    );
  }
  return (
    <div className={`relative ${wide ? 'lg:col-span-2' : ''}`}>
      <button onClick={click} className="glass-card group w-full h-full text-left flex overflow-hidden relative" aria-label={aria}>
        {hid && <SpoilerVeil type={post.spoiler} compact={!wide} />}
        {wide && (
          <div className="w-2/5 shrink-0 relative overflow-hidden hidden sm:block">
            <Cover post={post} className="transition-transform duration-700 group-hover:scale-110" />
          </div>
        )}
        <div className="p-4 flex flex-col min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-2">
            <Tag category={post.category} />
            <span className="font-mono text-[10px] text-zinc-500 truncate">{post.author ? <span className="text-pink-300">@{post.author} · </span> : null}{fmtDate(post.created_at)}</span>
          </div>
          <h3 className="font-display uppercase text-xl leading-tight text-white group-hover:text-neon transition-colors line-clamp-3">{T(post.title)}</h3>
          <p className="mt-1.5 text-sm text-zinc-400 line-clamp-2">{T(post.excerpt)}</p>
          <div className={`mt-auto pt-2 flex items-center gap-2 flex-wrap ${link ? 'pr-9' : ''}`}>
            {!hid && <Reliability r={post.reliability} />}
            <Wanted level={post.hype} size="w-3 h-3" />
          </div>
        </div>
      </button>
      {link && <div className="absolute bottom-3 right-3 z-10"><MapLink post={post} regionName={regionName} /></div>}
    </div>
  );
}

function MapTeaser({ count }) {
  return (
    <a href="#mapa" className="glass-card group p-4 flex flex-col justify-between overflow-hidden relative !border-cyan-400/30">
      <div className="absolute -right-6 -bottom-6 w-36 h-36 rounded-full bg-cyber/10 blur-2xl group-hover:bg-cyber/20 transition-colors" />
      <IconPin className="w-8 h-8 text-cyber drop-shadow-[0_0_6px_#00f0ff]" />
      <div>
        <div className="font-display text-5xl text-white">{count}</div>
        <div className="font-mono text-xs text-cyber tracking-widest">PINS NO MAPA</div>
        <div className="mt-1 text-sm text-zinc-400 group-hover:text-white transition-colors">Abrir mapa interativo →</div>
      </div>
    </a>
  );
}

/* --- Dia X em Leonida --- */
// Lançamento nos consoles: 19/11/2026, meia-noite no horário do visitante (no Laravel: config('leonida.launch_at')).
const LAUNCH = new Date(2026, 10, 19, 0, 0, 0);
const DAY_MS = 86400000;

function useNow(ms = 1000) {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return n;
}

function DayXBanner({ posts, spoil, onOpen, markerCount, regions }) {
  const realNow = useNow(1000);
  const [preview, setPreview] = useState(false);       // prévia de como fica depois do lançamento
  const launched = preview || realNow >= LAUNCH.getTime();
  const now = preview ? LAUNCH.getTime() + 2 * DAY_MS + (realNow % DAY_MS) : realNow;
  const dayN = Math.floor((now - LAUNCH.getTime()) / DAY_MS) + 1;
  const left = Math.max(0, LAUNCH.getTime() - now);
  const parts = [Math.floor(left / DAY_MS), Math.floor(left / 3600000) % 24, Math.floor(left / 60000) % 60, Math.floor(left / 1000) % 60];

  // resumo: tudo o que entrou nas últimas 48 h (depois do lançamento: o dia corrente)
  const windowMs = 48 * 3600000;
  const recent = posts.filter((p) => { const t = new Date(p.created_at).getTime(); return t <= realNow && realNow - t < windowMs; });
  const regionsHit = [...new Set(recent.map((p) => p.region).filter(Boolean))];
  const rname = (id) => regions?.find((r) => r.id === id)?.name || id;
  const official = recent.filter((p) => p.reliability?.level === 'oficial').length;

  return (
    <div className="glass-card relative overflow-hidden mb-6 !border-pink-500/40">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_10%_0%,rgba(255,0,127,.22),transparent_55%),radial-gradient(ellipse_at_100%_100%,rgba(0,240,255,.12),transparent_50%)]" />
      <div className="relative grid lg:grid-cols-[auto_1fr] gap-6 p-5 md:p-6 items-center">
        <div>
          {launched ? (
            <>
              <p className="font-mono text-[11px] tracking-[0.35em] text-cyber">// {preview ? 'PRÉVIA · ' : ''}O JOGO JÁ ESTÁ NAS RUAS</p>
              <p className="font-display uppercase leading-none text-white mt-1">
                <span className="text-6xl md:text-7xl text-neon glow-pink">Dia {dayN}</span>
                <span className="block text-3xl md:text-4xl">em Leonida</span>
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-[11px] tracking-[0.35em] text-sunset">// CONTAGEM PARA O LANÇAMENTO · 19 NOV</p>
              <div className="flex items-end gap-2 mt-2" role="timer" aria-label={`Faltam ${parts[0]} dias, ${parts[1]} horas e ${parts[2]} minutos`}>
                {parts.map((v, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="font-display text-4xl md:text-5xl text-neon/70 pb-4">:</span>}
                    <span className="text-center">
                      <span className="block font-display text-5xl md:text-6xl text-white tabular-nums leading-none min-w-[2ch]">{String(v).padStart(2, '0')}</span>
                      <span className="block font-mono text-[10px] tracking-widest text-zinc-500 mt-1">{['DIAS', 'HORAS', 'MIN', 'SEG'][i]}</span>
                    </span>
                  </React.Fragment>
                ))}
              </div>
              <p className="font-mono text-[11px] text-zinc-400 mt-2">PS5 e Xbox Series X|S · PC ainda sem data</p>
            </>
          )}
          <button onClick={() => setPreview((v) => !v)} className="mt-3 font-mono text-[10px] text-zinc-500 underline underline-offset-2 hover:text-zinc-300">
            {preview ? 'voltar para a contagem' : 'ver como fica depois do lançamento'}
          </button>
        </div>

        <div className="lg:border-l lg:border-white/10 lg:pl-6 min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <p className="font-mono text-xs tracking-[0.25em] text-white">{launched ? `RESUMO DO DIA ${dayN}` : 'ÚLTIMAS 48 H NO PORTAL'}</p>
            <p className="font-mono text-[11px] text-zinc-400">
              <span className="text-neon">{recent.length}</span> {launched ? 'descobertas' : 'posts novos'} · <span className="text-cyber">{official}</span> confirmados
              {launched ? <> · <span className="text-sunset">{markerCount}</span> pins no mapa</> : null}
            </p>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-zinc-500">Nada novo por enquanto.</p>
          ) : (
            <ul className="space-y-1">
              {recent.slice(0, 3).map((p) => {
                const hid = spoil.isHidden(p.spoiler, `post:${p.id}`);
                return (
                  <li key={p.id}>
                    <button onClick={() => (hid ? spoil.reveal(`post:${p.id}`) : onOpen(p))} className="w-full flex items-center gap-2 text-left px-2 py-1.5 -mx-2 rounded-md hover:bg-white/5 group min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: RELIABILITY[p.reliability?.level]?.color || '#71717a' }} />
                      <span className="flex-1 min-w-0 truncate text-sm text-zinc-200 group-hover:text-white">
                        {hid ? <><span className="font-mono text-[10px] text-red-400 mr-1">SPOILER</span><Redacted text={p.title} /></> : p.title}
                      </span>
                      {p.region && !hid && <span className="hidden sm:inline font-mono text-[10px] text-zinc-500 shrink-0">{rname(p.region).toUpperCase()}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {recent.length > 3 && <p className="font-mono text-[10px] text-zinc-500 mt-1">+ {recent.length - 3} no feed abaixo</p>}
          {regionsHit.length > 0 && (
            <p className="font-mono text-[10px] text-zinc-500 mt-2">REGIÕES CITADAS: {regionsHit.map(rname).join(' · ').toUpperCase()}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Itens de exemplo como chegariam da coleta automática (fictícios; no Laravel vêm dos feeds RSS + IA)
const COLETA_EXEMPLOS = () => [
  { id: 9001, origin: 'coleta', source_name: 'r/GTA6 (RSS)', source: 'https://www.reddit.com/r/GTA6/',
    title: 'Jogadores notam que os semáforos de Vice City mudam de ritmo de madrugada', slug: 'semaforos-vice-city-madrugada',
    excerpt: 'Post com vários prints sugere que o trânsito noturno fica mais rápido depois das 2h. Ainda sem confirmação.',
    content: 'Resumo gerado a partir de um post da comunidade: vários jogadores compararam prints do mesmo cruzamento em horários diferentes e perceberam que o tempo de cada sinal muda depois da meia-noite.\n\nNão há confirmação oficial. O texto final do portal seria escrito com nossas palavras e com link para o post original.',
    category: 'teoria', region: 'vice-city', spoiler: null, is_published: false, status: 'pending', suggested_reliability: 'rumor', hype: 3,
    created_at: new Date(Date.now() - 40 * 60000).toISOString(), checks: ['Fonte: comunidade', 'Sem duplicata no feed', 'Sem indício de leak', 'IA sugere: TEORIA · Vice City'] },
  { id: 9002, origin: 'coleta', source_name: 'Rockstar Newswire', source: 'https://www.rockstargames.com/newswire',
    title: 'Exemplo: nova publicação oficial na Rockstar Newswire', slug: 'exemplo-newswire',
    excerpt: 'Como apareceria um item vindo de fonte oficial: entra com selo CONFIRMADO sugerido e pode até ser publicado sozinho.',
    content: 'Este é um item de demonstração. Quando a coleta encontra algo novo em uma fonte oficial, a IA resume em português, sugere a categoria e o selo CONFIRMADO, e o item espera aqui.\n\nVocê pode configurar fontes oficiais para publicar sem aprovação.',
    category: 'noticia', region: null, spoiler: null, is_published: false, status: 'pending', suggested_reliability: 'oficial', hype: 4,
    created_at: new Date(Date.now() - 12 * 60000).toISOString(), checks: ['Fonte: oficial', 'Sem duplicata no feed', 'IA sugere: NOTÍCIA'] },
];

/* --- Artigos da comunidade + pauta (fila de aprovação; no Laravel: PostResource no Filament) --- */
const ARTICLE_CATS = [['noticia', 'Notícia'], ['teoria', 'Teoria'], ['easter-egg', 'Easter egg'], ['video', 'Vídeo']];
const ARTICLE_REJECT = ['Fonte fraca ou ausente', 'Duplicado', 'Leak ou spoiler indevido', 'Cópia de outro site', 'Fora do tema', 'Precisa de revisão de texto'];

function ArticleModal({ regions, onCancel, onSubmit }) {
  const [f, setF] = useState({ title: '', category: 'teoria', excerpt: '', content: '', region: '', source: '', cover: '', spoiler: '', own: false });
  const [err, setErr] = useState('');
  useEffect(() => { const k = (e) => e.key === 'Escape' && onCancel(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onCancel]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    if (f.title.trim().length < 10) return setErr('Dê um título com pelo menos 10 caracteres.');
    if (f.excerpt.trim().length < 30) return setErr('O resumo precisa de pelo menos 30 caracteres.');
    if (f.content.trim().length < 200) return setErr(`O texto precisa de pelo menos 200 caracteres (faltam ${200 - f.content.trim().length}).`);
    if (f.category === 'noticia' && !/^https?:\/\//.test(f.source.trim())) return setErr('Notícia precisa de um link de fonte.');
    if (!f.own) return setErr('Confirme que o texto é seu.');
    onSubmit(f);
  };
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 relative" role="dialog" aria-modal="true" aria-label="Enviar artigo para o feed">
        <button type="button" onClick={onCancel} className="absolute top-3 right-3 icon-btn" aria-label="Fechar"><IconClose className="w-5 h-5" /></button>
        <p className="font-mono text-[11px] tracking-[0.3em] text-sunset">// ENVIAR PARA O FEED</p>
        <h3 className="font-display uppercase text-3xl text-white mb-1">Escreva um artigo</h3>
        <p className="text-sm text-zinc-400 mb-4">Tudo passa pela pauta antes de ir ao ar. Texto seu, com fonte quando for notícia. Leaks não são publicados.</p>
        <label className="field-label" htmlFor="a-title">Título</label>
        <input id="a-title" className="field" value={f.title} onChange={set('title')} maxLength={110} placeholder="Ex.: Os semáforos de Vice City mudam de ritmo à noite" />
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="a-cat">Categoria</label>
            <select id="a-cat" className="field" value={f.category} onChange={set('category')}>{ARTICLE_CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
          <div>
            <label className="field-label" htmlFor="a-reg">Região (opcional)</label>
            <select id="a-reg" className="field" value={f.region} onChange={set('region')}><option value="">Nenhuma</option>{(regions || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          </div>
        </div>
        <label className="field-label" htmlFor="a-exc">Resumo</label>
        <textarea id="a-exc" className="field min-h-[60px]" value={f.excerpt} onChange={set('excerpt')} maxLength={220} placeholder="Uma ou duas frases que aparecem no card." />
        <label className="field-label" htmlFor="a-txt">Texto <span className="text-zinc-500 normal-case">({f.content.trim().length}/200 mín.)</span></label>
        <textarea id="a-txt" className="field min-h-[160px]" value={f.content} onChange={set('content')} placeholder="Escreva com suas palavras. Parágrafos separados por linha em branco." />
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="a-src">Fonte {f.category === 'noticia' ? '(obrigatória)' : '(opcional)'}</label>
            <input id="a-src" className="field" value={f.source} onChange={set('source')} placeholder="https://..." />
          </div>
          <div>
            <label className="field-label" htmlFor="a-sp">Spoiler</label>
            <select id="a-sp" className="field" value={f.spoiler} onChange={set('spoiler')}>
              <option value="">Sem spoiler</option><option value="historia">História / campanha</option><option value="easter">Easter eggs e segredos</option>
            </select>
          </div>
        </div>
        <label className="field-label" htmlFor="a-cover">Capa (opcional)</label>
        {f.cover ? (
          <div className="relative mb-4 rounded-lg overflow-hidden border border-zinc-700">
            <img src={f.cover} alt="Prévia da capa" className="w-full max-h-48 object-cover" />
            <button type="button" onClick={() => setF({ ...f, cover: '' })} className="absolute top-2 right-2 icon-btn bg-black/70" aria-label="Remover capa"><IconClose className="w-4 h-4" /></button>
          </div>
        ) : (
          <input id="a-cover" type="file" accept="image/*" className="field file:mr-3 file:rounded file:border-0 file:bg-neon/20 file:px-3 file:py-1 file:text-neon file:font-mono file:text-xs"
            onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const url = await shrinkImage(file, 1400); setF((v) => ({ ...v, cover: url })); } catch (er) { setErr('Não consegui ler essa imagem.'); } }} />
        )}
        <label className="flex items-start gap-2 text-sm text-zinc-300 mb-3"><input type="checkbox" checked={f.own} onChange={(e) => setF({ ...f, own: e.target.checked })} className="mt-1 accent-pink-500" />O texto é meu (não copiei de outro site) e a imagem é minha ou tenho permissão para usar.</label>
        {err && <p className="font-mono text-xs text-neon mb-3" role="alert">⚠ {err}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost flex-1">Cancelar</button>
          <button type="submit" className="btn-neon flex-1">Enviar para a pauta</button>
        </div>
      </form>
    </div>
  );
}

const articleChecks = (p) => [
  `${p.content.length} caracteres`, p.source ? `Fonte: ${(() => { try { return new URL(p.source).hostname; } catch (e) { return 'link'; } })()}` : 'Sem fonte',
  'Sem cópia detectada', 'Sem palavrões', p.spoiler ? 'Autor marcou spoiler' : 'IA: sem spoiler aparente',
];

function PautaDrawer({ posts, regions, game, onApprove, onReject, onClose }) {
  const pending = posts.filter((p) => p.status === 'pending');
  const [rel, setRel] = useState({});
  const [reasonFor, setReasonFor] = useState(null);
  const [open, setOpen] = useState(null);
  const [safe, setSafe] = useModSafe();
  const [shown, setShown] = useState({});
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const authorLine = (p) => {
    if (p.origin === 'coleta') return `Coleta automática · ${p.source_name}`;
    const pl = p.mine && game?.user ? { respect: game.prog.respect } : MOCK_PLAYERS.find((x) => x.name === p.author) || { respect: 0 };
    return `@${p.author} · ${trustOf(pl.respect).label} · ${pl.respect} de respeito`;
  };
  return (
    <div className="fixed inset-0 z-[2100] flex justify-end bg-black/50 animate-fade-in" onClick={onClose}>
      <aside className="h-full w-[min(560px,100%)] glass-card !rounded-none flex flex-col animate-slide-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Pauta do feed">
        <div className="p-4 border-b border-pink-500/20 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-violet-300">SIMULAÇÃO · FILAMENT · {pending.length} NA PAUTA</p>
            <h3 className="font-display uppercase text-2xl text-white">Pauta do feed</h3>
            <p className="text-xs text-zinc-400">Artigos da comunidade e itens da coleta automática. Nada vai ao ar sem aprovação.</p>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Fechar"><IconClose className="w-5 h-5" /></button>
        </div>
        <ModSafeSwitch on={safe} set={setSafe} />
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {pending.length === 0 && <p className="text-sm text-zinc-500 font-mono p-6 text-center">Pauta vazia.</p>}
          {pending.map((p) => {
            const level = rel[p.id] || p.suggested_reliability || (p.category === 'noticia' && p.source ? 'comunidade' : p.category === 'teoria' ? 'rumor' : 'comunidade');
            const expanded = open === p.id;
            const hide = safe && !shown[p.id];
            return (
              <article key={p.id} className="rounded-lg border border-zinc-700/60 bg-black/40 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {!hide && <Tag category={p.category} />}
                  {p.origin === 'coleta'
                    ? <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-cyan-400/50 text-cyber">COLETA AUTOMÁTICA · EXEMPLO</span>
                    : <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-pink-400/50 text-pink-300">ENVIADO PELA COMUNIDADE</span>}
                  {!hide && p.spoiler && <span className="font-mono text-[10px] text-red-300">SPOILER: {SPOILER_TYPES[p.spoiler].label.toUpperCase()}</span>}
                  {hide && <span className="font-mono text-[10px] text-cyber">🛡 CONTEÚDO OCULTO</span>}
                </div>
                {hide ? <Hidden label={`Título, resumo, texto${p.cover_image ? ', capa' : ''} e categoria ocultos`} onReveal={() => setShown({ ...shown, [p.id]: true })} /> : <>
                {p.cover_image && <img src={p.cover_image} alt="" className="w-full max-h-48 object-cover rounded-md border border-zinc-700" />}
                <h4 className="font-semibold text-white leading-snug">{p.title}</h4>
                <p className="text-sm text-zinc-300">{p.excerpt}</p>
                <button onClick={() => setOpen(expanded ? null : p.id)} className="font-mono text-[11px] text-zinc-400 underline">{expanded ? 'esconder texto completo' : 'ler texto completo'}</button>
                {expanded && <div className="text-sm text-zinc-300 space-y-2 border-l-2 border-zinc-700 pl-3">{p.content.split('\n\n').map((t, i) => <p key={i}>{t}</p>)}</div>}
                </>}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
                  <dt className="text-zinc-500">Autor</dt><dd className="text-zinc-200">{authorLine(p)}</dd>
                  <dt className="text-zinc-500">Região</dt><dd className="text-zinc-200">{regions?.find((r) => r.id === p.region)?.name || '—'}</dd>
                  <dt className="text-zinc-500">Fonte</dt><dd className="text-zinc-200 truncate">{p.source ? <a href={p.source} target="_blank" rel="noopener noreferrer" className="text-cyber underline">{p.source}</a> : 'sem fonte'}</dd>
                  <dt className="text-zinc-500">Recebido</dt><dd className="text-zinc-300">{new Date(p.created_at).toLocaleString('pt-BR')}</dd>
                  <dt className="text-zinc-500">Checagem</dt><dd className="text-zinc-300">{(p.checks || articleChecks(p)).map((c) => (hide ? c.replace(/IA sugere:.*/, 'IA classificou o tema') : c)).join(' · ')}</dd>
                </dl>
                <div>
                  <p className="font-mono text-[10px] text-zinc-500 mb-1">SELO DE CONFIABILIDADE AO PUBLICAR</p>
                  <div className="grid grid-cols-4 gap-1">
                    {Object.entries(RELIABILITY).map(([k, R]) => (
                      <button key={k} onClick={() => setRel({ ...rel, [p.id]: k })} className="text-[10px] font-mono py-1 rounded border transition"
                        style={{ color: R.color, borderColor: level === k ? R.color : `${R.color}33`, background: level === k ? `${R.color}1a` : 'transparent' }}>{R.label}</button>
                    ))}
                  </div>
                </div>
                {reasonFor === p.id ? (
                  <div className="space-y-1.5">
                    <p className="font-mono text-[10px] text-zinc-400">MOTIVO DA RECUSA (o autor recebe esta mensagem)</p>
                    <div className="grid grid-cols-2 gap-1.5">{ARTICLE_REJECT.map((r) => <button key={r} onClick={() => { setReasonFor(null); onReject(p.id, r); }} className="text-[11px] rounded-md border border-red-400/40 text-red-300 py-1.5 hover:bg-red-500/15">{r}</button>)}</div>
                    <button onClick={() => setReasonFor(null)} className="w-full text-[11px] text-zinc-400 underline">cancelar</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => onApprove(p.id, level)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-mono py-1.5 hover:bg-emerald-500/25"><IconCheck className="w-3.5 h-3.5" /> PUBLICAR</button>
                    <button onClick={() => setReasonFor(p.id)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-red-500/10 border border-red-400/40 text-red-300 text-xs font-mono py-1.5 hover:bg-red-500/20"><IconClose className="w-3.5 h-3.5" /> RECUSAR</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function FeedPage({ posts, markerCount, onOpen, spoil, regions, onWrite, onPauta, pautaCount }) {
  const [filter, setFilter] = useState('all');
  const [region, setRegion] = useState('all');
  const [q, setQ] = useState('');
  const sorted = useMemo(
    () => posts.filter((p) => p.is_published).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [posts]
  );
  const rname = (id) => regions?.find((r) => r.id === id)?.name || null;
  const nq = normalize(q).trim();
  const terms = nq.split(/\s+/).filter(Boolean);
  const textOf = (p) => normalize([p.title, p.excerpt, p.content, rname(p.region), CATEGORY_TAG[p.category].label, RELIABILITY[p.reliability?.level]?.label].join(' '));
  let hiddenMatches = 0;
  const base = sorted.filter((p) => region === 'all' || p.region === region).filter((p) => {
    if (!terms.length) return true;
    const ok = terms.every((t) => textOf(p).includes(t));
    // conteúdo com spoiler escondido não entra na busca (senão o resultado entregaria o spoiler)
    if (ok && spoil.isHidden(p.spoiler, `post:${p.id}`)) { hiddenMatches++; return false; }
    return ok;
  });
  const list = filter === 'all' ? base : base.filter((p) => p.category === filter);
  const [featured, ...rest] = list;
  const counts = useMemo(() => {
    const c = { all: base.length };
    base.forEach((p) => (c[p.category] = (c[p.category] || 0) + 1));
    return c;
  }, [base.map((p) => p.id).join()]);
  const regionCounts = useMemo(() => {
    const c = {};
    sorted.forEach((p) => p.region && (c[p.region] = (c[p.region] || 0) + 1));
    return c;
  }, [sorted]);
  const narrowed = !!terms.length || region !== 'all';
  const clearAll = () => { setQ(''); setRegion('all'); setFilter('all'); };

  let normalIdx = 0;
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <DayXBanner posts={sorted} spoil={spoil} onOpen={onOpen} markerCount={markerCount} regions={regions} />
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-sunset mb-1">// TRANSMISSÃO AO VIVO DE LEONIDA</p>
          <h1 className="font-display text-5xl md:text-6xl uppercase leading-none text-white">
            O <span className="text-neon glow-pink">Feed</span>
          </h1>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={onWrite} className="btn-neon !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5">✎ Enviar artigo</button>
            <button onClick={onPauta} className="btn-ghost !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5">Pauta (moderação){pautaCount > 0 && <span className="ml-1 px-1.5 rounded-full bg-neon text-white font-mono text-[10px]">{pautaCount}</span>}</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por categoria">
          {FEED_FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`chip ${filter === f.key ? 'chip--active' : ''}`}
            >
              {f.label}
              <span className="chip-count">{counts[f.key] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
        <div className="relative h-10 lg:w-80 shrink-0">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no feed…" aria-label="Buscar no feed"
            className="w-full h-10 bg-black/40 border border-zinc-700 focus:border-neon rounded-lg pl-9 pr-8 text-sm text-white placeholder-zinc-500 outline-none transition" />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 icon-btn !w-6 !h-6" aria-label="Limpar busca"><IconClose className="w-3.5 h-3.5" /></button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center min-w-0" role="radiogroup" aria-label="Filtrar por região">
          <span className="font-mono text-[10px] tracking-widest text-zinc-500 mr-1">REGIÃO</span>
          <button role="radio" aria-checked={region === 'all'} onClick={() => setRegion('all')} className={`region-chip ${region === 'all' ? 'region-chip--on' : ''}`}>Todas</button>
          {(regions || []).filter((r) => regionCounts[r.id] || region === r.id).map((r) => (
            <button key={r.id} role="radio" aria-checked={region === r.id} onClick={() => setRegion(region === r.id ? 'all' : r.id)}
              className={`region-chip ${region === r.id ? 'region-chip--on' : ''}`}>
              {r.name}<span className="opacity-60 ml-1">{regionCounts[r.id] || 0}</span>
            </button>
          ))}
        </div>
      </div>
      {(hiddenMatches > 0 || narrowed) && (
        <p className="font-mono text-[11px] text-zinc-500 -mt-3 mb-4">
          {list.length} resultado{list.length === 1 ? '' : 's'}
          {hiddenMatches > 0 && <> · <span className="text-red-400">{hiddenMatches} escondido{hiddenMatches === 1 ? '' : 's'} pela proteção contra spoilers</span></>}
          {' · '}<button onClick={clearAll} className="underline underline-offset-2 hover:text-zinc-300">limpar filtros</button>
        </p>
      )}

      {list.length === 0 ? (
        <div className="glass-card p-10 text-center text-zinc-400 font-mono">
          {narrowed ? 'Nada encontrado com esses filtros.' : 'Nenhum post nessa categoria ainda.'}
        </div>
      ) : (
        <div key={`${filter}|${region}|${nq}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-[210px] gap-4 grid-flow-dense animate-fade-in">
          <FeaturedCard post={featured} onOpen={onOpen} spoil={spoil} regionName={rname(featured.region)} />
          {filter === 'all' && !narrowed && <MapTeaser count={markerCount} />}
          {rest.map((p) => {
            const wide = p.category !== 'video' && normalIdx++ % 3 === 1;
            return <PostCard key={p.id} post={p} wide={wide} onOpen={onOpen} spoil={spoil} regionName={rname(p.region)} />;
          })}
        </div>
      )}
    </section>
  );
}

function PostModal({ post, onClose, regions }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!post) return null;
  const isVideo = post.category === 'video';
  const regionName = regions?.find((r) => r.id === post.region)?.name;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <article
        className="glass-card relative w-full max-w-3xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={post.title}
      >
        <button onClick={onClose} className="absolute top-3 right-3 z-10 icon-btn" aria-label="Fechar"><IconClose className="w-5 h-5" /></button>
        {isVideo ? (
          <div className="p-6 pb-0 bg-gradient-to-b from-deep/50 to-transparent"><VerticalEmbed post={post} large /></div>
        ) : (
          <div className="h-56 relative"><Cover post={post} /><div className="absolute inset-0 bg-gradient-to-t from-[#0c0c10] to-transparent" /></div>
        )}
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <Tag category={post.category} />
            <span className="font-mono text-xs text-zinc-500">{fmtDate(post.created_at)}{post.author ? ` · por @${post.author}` : ''}</span>
            <Wanted level={post.hype} />
            {regionName && <span className="font-mono text-[11px] text-zinc-400">📍 {regionName}</span>}
          </div>
          <h2 className="font-display uppercase text-4xl leading-none text-white mb-4">{post.title}</h2>
          <Reliability r={post.reliability} full />
          {post.content.split('\n\n').map((para, i) => (
            <p key={i} className="text-zinc-300 leading-relaxed mb-3">{para}</p>
          ))}
          {post.place && (
            <a href={placeHash(post.place)} onClick={onClose} className="btn-neon inline-flex items-center gap-2 mt-2">
              <IconPin className="w-4 h-4" /> Ver no mapa{regionName ? ` · ${regionName}` : ''}
            </a>
          )}
          {isVideo && (
            <p className="mt-4 font-mono text-xs text-violet-300/80 border border-violet-400/20 rounded p-3">
              Prévia gerada a partir do mapa. No site final, este player vira o do YouTube Shorts (youtube-nocookie), carregado a partir de <code>media_url</code>.
            </p>
          )}
        </div>
      </article>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mapa Interativo                                                     */
/* ------------------------------------------------------------------ */

function popupHtml(m, hiddenType) {
  const c = MARKER_CATS[m.category];
  if (hiddenType) return `
    <div class="lu-popup">
      <div class="spoiler-stamp" style="font-size:11px">⚠ SPOILER · ${SPOILER_TYPES[hiddenType].short}</div>
      <div class="lu-popup__title" style="margin-top:8px">Conteúdo escondido</div>
      <p class="lu-popup__desc">Este pin é da categoria ${c.label.toLowerCase()} e pode estragar a surpresa.</p>
      <button class="lu-share" data-reveal="pin:${m.id}">Revelar este pin</button>
    </div>`;
  return `
    <div class="lu-popup">
      <div class="lu-popup__tag" style="color:${c.color};border-color:${c.color}66">[${c.label.toUpperCase()}]</div>
      <div class="lu-popup__title">${escapeHtml(m.title)}</div>
      ${m.image_path ? (String(m.image_path).startsWith('data:image/') ? `<img class="lu-popup__photo" src="${m.image_path}" alt="Imagem enviada com o pin">` : `<div class="lu-popup__img">📷 ${escapeHtml(m.image_path)}</div>`) : ''}
      <p class="lu-popup__desc">${escapeHtml(m.description || '')}</p>
      ${m.author ? `<div class="lu-popup__author">por <b>@${escapeHtml(m.author)}</b>${m.first ? ' · <span class="lu-first">🏆 primeiro a descobrir</span>' : ''}</div>` : ''}
      ${m.is_approved ? `<div class="lu-popup__conf">👁 ${m.confirmations || 0} ${m.confirmations === 1 ? 'confirmação' : 'confirmações'}</div>` : ''}
      <div class="lu-popup__coords">X ${Math.round(m.coord_x)} · Y ${Math.round(m.coord_y)}${m.is_approved ? '' : ' · <span style="color:#fbbf24">AGUARDANDO APROVAÇÃO</span>'}</div>
      ${m.is_approved && !m.mine ? (m.confirmed_by_me
        ? '<div class="lu-confirmed">✓ Você confirmou este pin</div>'
        : `<button class="lu-share lu-share--confirm" data-confirm="${m.id}">👁 Eu também vi isso</button>`) : ''}
      ${m.mine ? '<div class="lu-confirmed" style="color:#f472b6">★ Seu pin</div>' : ''}
      ${m.is_approved ? `<button class="lu-share" data-share="pin:${m.id}">Compartilhar ↗</button>` : ''}
    </div>`;
}

function markerIcon(m, hidden) {
  return L.divIcon({
    className: '',
    html: hidden
      ? `<div class="lu-pin lu-pin--mystery" style="--c:#a1a1aa"><span>?</span></div>`
      : `<div class="lu-pin ${m.is_approved ? '' : 'lu-pin--pending'}" style="--c:${MARKER_CATS[m.category].color}"><span></span></div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -30],
  });
}

/* --- Landmarks da comunidade (GTADB.org, CC BY 4.0) --- */
// Blips estilo radar (ícones genéricos próprios). tier: 1 = sempre visível, 2 = zoom médio, 3 = zoom próximo
const G = {
  house: '<path d="M4 11.5 12 4.5l8 7"/><path d="M6.5 10v9.5h11V10"/><path d="M10.5 19.5v-5h3v5"/>',
  plane: '<path d="M12 3c.8 0 1.3.8 1.3 1.8V9.5l7 4.2v1.8l-7-2.1v4.2l2 1.5v1.4L12 19.6l-3.3.9v-1.4l2-1.5v-4.2l-7 2.1v-1.8l7-4.2V4.8C10.7 3.8 11.2 3 12 3Z" fill="currentColor" stroke="none"/>',
  anchor: '<circle cx="12" cy="5.5" r="2"/><path d="M12 7.5V20M7.5 11h9M5 13.5a7 7 0 0 0 14 0"/>',
  train: '<rect x="6" y="3.5" width="12" height="12" rx="2.5"/><path d="M6 10h12M9 19l-1.5 2M15 19l1.5 2"/><circle cx="9" cy="13" r=".6" fill="currentColor"/><circle cx="15" cy="13" r=".6" fill="currentColor"/>',
  flag: '<path d="M6 21V4M6 4h11l-2.2 4L17 12H6"/>',
  cross: '<circle cx="12" cy="12" r="6.5"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>',
  fuel: '<path d="M5.5 20.5V5.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15M4.5 20.5h10M7.5 8.5h4"/><path d="M13.5 10h1.8a1.7 1.7 0 0 1 1.7 1.7v4.3a1.4 1.4 0 0 0 2.8 0V8.5L17 6"/>',
  camera: '<path d="M4 8.5h3.2L9 6.5h6l1.8 2H20V19H4Z"/><circle cx="12" cy="13.5" r="3"/>',
  bed: '<path d="M3.5 18.5V7M3.5 14.5h17v4M20.5 14.5V12a2.5 2.5 0 0 0-2.5-2.5h-6.5v5"/><circle cx="7.3" cy="11.6" r="1.6"/>',
  food: '<path d="M7 3.5v7.5M5 3.5V8a2 2 0 0 0 4 0V3.5M7 11v9.5M16.5 3.5c-2 2-2 6.5 0 8.5v8.5"/>',
  bag: '<path d="M5.5 8.5h13l-1 12h-11Z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  star: '<path d="m12 3.5 2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7Z"/>',
  palm: '<path d="M12 21c0-6 1-9.5 3-12.5"/><path d="M15 8.5c-2-3-6-3-8-1 3 0 5 1 8 1Z"/><path d="M15 8.5c1-3 5-4 7-2-3 0-5 1-7 2Z"/><path d="M15 8.5c-3 0-6 2-6 5 2-2 4-4 6-5Z"/>',
  columns: '<path d="M3.5 9.5 12 4l8.5 5.5M5.5 10v8M9.8 10v8M14.2 10v8M18.5 10v8M3.5 20h17"/>',
  car: '<path d="M5 16.5v-4.5l2-5h10l2 5v4.5M5 16.5h14M7 19.5v-3M17 19.5v-3"/><circle cx="8" cy="13.5" r=".7" fill="currentColor"/><circle cx="16" cy="13.5" r=".7" fill="currentColor"/>',
  factory: '<path d="M3.5 20V10.5l5.5 3.5v-3.5l5.5 3.5V6.5h3.5V20Z"/>',
  home: '<path d="M5.5 12 12 6.5l6.5 5.5v7.5h-13Z"/>',
  diamond: '<path d="M12 3.5 18 12l-6 8.5L6 12Z"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
};
const BLIP_TYPES = {
  safehouse: { label: 'Safehouse', color: '#ff2e93', glyph: G.house },
  aeroporto: { label: 'Aeroporto', color: '#00f0ff', glyph: G.plane },
  marina: { label: 'Marina', color: '#38bdf8', glyph: G.anchor },
  trem: { label: 'Trem / Metrô', color: '#a78bfa', glyph: G.train },
  corrida: { label: 'Corrida', color: '#facc15', glyph: G.flag },
  armas: { label: 'Armas', color: '#f87171', glyph: G.cross },
  posto: { label: 'Posto', color: '#fb923c', glyph: G.fuel },
  marco: { label: 'Marco', color: '#ffd166', glyph: G.camera },
  hotel: { label: 'Hotel', color: '#ff7a1a', glyph: G.bed },
  comida: { label: 'Comida / Bar', color: '#f472b6', glyph: G.food },
  loja: { label: 'Loja', color: '#a3e635', glyph: G.bag },
  lazer: { label: 'Lazer', color: '#c084fc', glyph: G.star },
  natureza: { label: 'Natureza', color: '#4ade80', glyph: G.palm },
  servico: { label: 'Serviço público', color: '#60a5fa', glyph: G.columns },
  transporte: { label: 'Transporte', color: '#22d3ee', glyph: G.car },
  industria: { label: 'Industrial', color: '#94a3b8', glyph: G.factory },
  residencia: { label: 'Residencial', color: '#2dd4bf', glyph: G.home },
  outros: { label: 'Ponto de interesse', color: '#e4e4e7', glyph: G.diamond },
};
const TYPE_RANK = Object.fromEntries(Object.keys(BLIP_TYPES).map((k, i) => [k, i]));
const blipSvg = (t, cls = '') =>
  `<svg viewBox="0 0 24 24" class="${cls}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${BLIP_TYPES[t].glyph}</svg>`;
function Blip({ type, size = 18 }) {
  const t = BLIP_TYPES[type];
  return (
    <span className="blip blip--ui" style={{ '--c': t.color, width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: blipSvg(type) }} />
  );
}
const MAP_STYLES = [
  { key: 'radar', label: 'Radar', swatch: 'linear-gradient(135deg,#2b3a4a 0 45%,#5d6f80 45% 55%,#141c26 55%)' },
  { key: 'neon', label: 'Vice Neon', swatch: 'linear-gradient(135deg,#4a1d4f 0 45%,#a24a8f 45% 55%,#120a1c 55%)' },
  { key: 'original', label: 'Original', swatch: 'linear-gradient(135deg,#c1db84 0 45%,#ffffff 45% 55%,#2c67a4 55%)' },
];
const LM_GROUPS = [
  { id: 'principais', label: 'Principais', types: ['safehouse', 'aeroporto', 'marina', 'trem', 'corrida', 'armas', 'posto', 'marco'] },
  { id: 'servicos', label: 'Comércio e serviços', types: ['hotel', 'comida', 'loja', 'lazer', 'servico', 'transporte'] },
  { id: 'outros', label: 'Outros', types: ['natureza', 'industria', 'residencia', 'outros'] },
];
const SearchIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
);

const GTADB_CREDIT =
  'Mapa: <a href="https://map.gtadb.org" target="_blank" rel="noopener">Yanis GTA VI Community Map v17 via GTADB</a> · ' +
  'Landmarks: <a href="https://github.com/rolux/gtadb.org" target="_blank" rel="noopener">GTADB.org e colaboradores</a> · ' +
  '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> · recortado e com cores adaptadas';

// lm = [id, nome, distrito, área, x, y, inspiração real, tipo, flags, tier]
function landmarkPopup(lm) {
  const [, name, district, area, x, y, real, type, flags] = lm;
  const t = BLIP_TYPES[type];
  const chips = [
    flags.includes('e') && '<span class="lu-chip lu-chip--ok">INTERIOR ACESSÍVEL</span>',
    flags.includes('u') && '<span class="lu-chip lu-chip--warn">NÃO CONFIRMADO</span>',
    flags.includes('c') && '<span class="lu-chip lu-chip--bad">FECHADO</span>',
  ].filter(Boolean).join('');
  return `
    <div class="lu-popup">
      <div class="lu-popup__head">
        <span class="blip blip--ui" style="--c:${t.color};width:26px;height:26px">${blipSvg(type)}</span>
        <span class="lu-popup__type" style="color:${t.color}">${t.label.toUpperCase()}</span>
      </div>
      <div class="lu-popup__title">${escapeHtml(name)}</div>
      <div class="lu-popup__sub">${escapeHtml([district, area].filter(Boolean).join(' · ').toUpperCase())}</div>
      ${chips ? `<div class="lu-popup__chips">${chips}</div>` : ''}
      ${real ? `<p class="lu-popup__desc"><b>Inspiração real:</b> ${escapeHtml(real)}</p>` : ''}
      <div class="lu-popup__coords">X ${Math.round(x)} · Y ${Math.round(y)} m</div>
      <div class="lu-popup__src">Fonte: GTADB.org (CC BY 4.0)</div>
      <button class="lu-share" data-share="lm:${lm[0]}">Compartilhar ↗</button>
    </div>`;
}

const blipIcon = (lm) => {
  const big = lm[9] === 1;
  const s = big ? 26 : 21;
  return L.divIcon({
    className: '',
    html: `<div class="blip blip--map ${big ? 'blip--t1' : ''}" style="--c:${BLIP_TYPES[lm[7]].color}">${blipSvg(lm[7])}</div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    popupAnchor: [0, -s / 2],
    tooltipAnchor: [0, -s / 2],
  });
};

// Tiles com o estilo (radar/neon) aplicado UMA vez, ao carregar cada tile, num canvas.
// Antes o filtro era CSS no painel inteiro e o navegador refazia o cálculo a cada quadro ao arrastar/zoom.
const CANVAS_FILTER_OK = (() => { try { return 'filter' in document.createElement('canvas').getContext('2d'); } catch (e) { return false; } })();
const FilteredTileLayer = L.TileLayer.extend({
  createTile(coords, done) {
    const size = this.getTileSize();
    const tile = document.createElement('canvas');
    tile.width = size.x; tile.height = size.y;
    const img = new Image();
    let fellBack = false;
    img.onload = () => {
      const ctx = tile.getContext('2d');
      ctx.filter = this._cssFilter || 'none';
      ctx.drawImage(img, 0, 0, size.x, size.y);
      done(null, tile);
    };
    img.onerror = (e) => {
      if (!fellBack && this.options.errorTileUrl) { fellBack = true; img.src = this.options.errorTileUrl; } else done(e, tile);
    };
    img.src = this.getTileUrl(coords);
    return tile;
  },
  setCssFilter(f) { if (f === this._cssFilter) return; this._cssFilter = f; if (this._map) this.redraw(); },
});

function LeafletMap({ showPins = true, markers, activeCats, showPending, onMapClick, mapImage, landmarks, showLandmarks, landmarkCats, mapStyle, apiRef, onShare, onView, regions, fogged, spoil, onRevealRegion, onSelectHash, magnet = true, padLeft = 0 }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const lmLayerRef = useRef(null);
  const lmIndexRef = useRef(new Map());
  const lmItemsRef = useRef([]);
  const tierRef = useRef(3);
  const overlayRef = useRef(null);
  const tileRef = useRef(null);
  const attrRef = useRef(null);
  const boundsRef = useRef(mapImage.bounds);
  boundsRef.current = mapImage.bounds;
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const shareRef = useRef(onShare); shareRef.current = onShare;
  const viewRef = useRef(onView); viewRef.current = onView;
  const mapStyleRef = useRef(mapStyle); mapStyleRef.current = mapStyle;
  const magnetRef = useRef(magnet); magnetRef.current = magnet;
  const padRef = useRef(padLeft); padRef.current = padLeft;
  const regionsRef = useRef(regions); regionsRef.current = regions;
  const spoilRef = useRef(spoil); spoilRef.current = spoil;
  const hashRef = useRef(onSelectHash); hashRef.current = onSelectHash;
  const pinIndexRef = useRef(new Map());
  const revealRegionRef = useRef(onRevealRegion); revealRegionRef.current = onRevealRegion;
  const regionLayerRef = useRef(null);
  const fogLayerRef = useRef(null);

  useEffect(() => {
    const map = L.map(elRef.current, {
      crs: L.CRS.Simple,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      attributionControl: false,
      zoomControl: false,
      preferCanvas: true,
    });
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' }).addTo(map);

    // Ir até um ponto sem travar: o flyTo recalcula ~600 marcadores a cada quadro.
    // Aqui: deslizar (só move uma camada) e aproximar com zoom animado por CSS; longe demais, afasta antes.
    map._go = (to, zoom, done) => {
      const target = L.latLng(to);
      zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), zoom));
      const finish = () => done && done();
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { map.setView(target, zoom, { animate: false }); return finish(); }
      const then = (fn, next) => {
        let ok = false;
        const h = () => { if (ok) return; ok = true; clearTimeout(t); map.off('moveend', h); next(); };
        const t = setTimeout(h, 1600);
        map.on('moveend', h); fn();
      };
      const pan = (next) => then(() => map.panTo(target, { duration: 0.45, easeLinearity: 0.35 }), next);
      const zoomTo = (z, next) => (Math.abs(z - map.getZoom()) < 0.05 ? next() : then(() => map.setZoom(z, { animate: true }), next));
      const size = map.getSize(), far = Math.max(size.x, size.y) * 1.8;
      const dist = map.latLngToContainerPoint(target).distanceTo(size.divideBy(2));
      if (dist > far) {
        // afasta o bastante para o destino caber em ~1 tela, desliza, depois aproxima
        const mid = Math.max(map.getMinZoom(), Math.min(zoom, map.getZoom()) - Math.log2(dist / (far * 0.5)));
        zoomTo(mid, () => pan(() => zoomTo(zoom, finish)));
      } else if (zoom >= map.getZoom()) pan(() => zoomTo(zoom, finish));
      else zoomTo(zoom, () => pan(finish));
    };
    overlayRef.current = L.imageOverlay(mapImage.url || 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', mapImage.bounds);
    attrRef.current = L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);
    // camadas das regiões: névoa (abaixo) e contorno no hover (acima), em SVG para ter brilho
    map.createPane('fogPane').style.zIndex = 380;
    map.createPane('regionPane').style.zIndex = 390;
    map.createPane('regionLabelPane').style.zIndex = 395;
    map.getPane('regionLabelPane').style.pointerEvents = 'none';
    map._fogRenderer = L.svg({ pane: 'fogPane', padding: 0.5 });
    map._regionRenderer = L.svg({ pane: 'regionPane', padding: 0.5 });
    fogLayerRef.current = L.layerGroup().addTo(map);
    regionLayerRef.current = L.layerGroup().addTo(map);
    lmLayerRef.current = L.layerGroup().addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    // botão esquerdo: seleciona e enquadra a região · botão direito (ou toque longo): sugerir pin
    map.on('click', (e) => map._selectRegionAt?.(e.latlng));
    map.on('contextmenu', (e) => { e.originalEvent?.preventDefault?.(); clickRef.current(e.latlng); });
    // Declutter estilo GTA: mostra mais blips conforme aproxima
    // 1) tier por zoom  2) colisão: se dois blips se sobrepõem na tela, fica o mais importante
    const syncTier = () => {
      const fit = map.getBoundsZoom(boundsRef.current);
      const z = map.getZoom();
      const tier = z < fit + 1.25 ? 1 : z < fit + 2.75 ? 2 : 3;
      tierRef.current = tier;
      const MIN_PX = 24, cell = MIN_PX, grid = new Map(), keep = new Set();
      const pinned = map._pinned || new Set();
      const items = lmItemsRef.current
        .filter(({ lm }) => lm[9] <= tier || pinned.has(lm[0]))
        .sort((a, b) => pinned.has(b.lm[0]) - pinned.has(a.lm[0]) || a.lm[9] - b.lm[9] || a.rank - b.rank);
      for (const it of items) {
        const pt = map.project([it.lm[5], it.lm[4]], z);
        const gx = Math.floor(pt.x / cell), gy = Math.floor(pt.y / cell);
        let hit = false;
        for (let dx = -1; dx <= 1 && !hit; dx++) for (let dy = -1; dy <= 1 && !hit; dy++) {
          for (const q of grid.get(`${gx + dx},${gy + dy}`) || []) {
            if (Math.abs(q.x - pt.x) < MIN_PX && Math.abs(q.y - pt.y) < MIN_PX) { hit = true; break; }
          }
        }
        if (hit) continue;
        const key = `${gx},${gy}`;
        (grid.get(key) || grid.set(key, []).get(key)).push(pt);
        keep.add(it);
      }
      lmItemsRef.current.forEach((it) => {
        const show = keep.has(it);
        it.mk.getElement()?.classList.toggle('blip-hit', pinned.has(it.lm[0]));
        it.hit = pinned.has(it.lm[0]);
        const on = lmLayerRef.current.hasLayer(it.mk);
        if (show && !on) { lmLayerRef.current.addLayer(it.mk); it.mk.getElement()?.classList.toggle('blip-hit', pinned.has(it.lm[0])); }
        if (!show && on) lmLayerRef.current.removeLayer(it.mk);
      });
      if (map._onDeclutter) map._onDeclutter(keep.size);
    };
    map.on('zoomend', syncTier);
    // durante o zoom, desliga os brilhos (são recalculados a cada quadro)
    map.on('zoomstart', () => map.getContainer().classList.add('is-zooming'));
    map.on('zoomend', () => map.getContainer().classList.remove('is-zooming'));
    // Botão "Compartilhar" dentro dos popups
    map.on('popupopen', (e) => {
      const el = e.popup.getElement();
      const btn = el?.querySelector('[data-share]');
      if (btn) btn.onclick = (ev) => { ev.stopPropagation(); shareRef.current?.(btn.dataset.share); };
      const cf = el?.querySelector('[data-confirm]');
      if (cf) cf.onclick = (ev) => { ev.stopPropagation(); window.dispatchEvent(new CustomEvent('lu:confirm', { detail: cf.dataset.confirm })); };
      const rv = el?.querySelector('[data-reveal]');
      if (rv) rv.onclick = (ev) => { ev.stopPropagation(); map.closePopup(); spoilRef.current?.reveal(rv.dataset.reveal); };
      // o endereço da página passa a apontar para o local aberto
      const ref = btn?.dataset.share;
      if (ref) { const [k, id] = ref.split(':'); hashRef.current?.(`${k === 'pin' ? 'pin' : 'local'}-${id}`); if (k === 'pin') { map._openPin = id; window.dispatchEvent(new CustomEvent('lu:pinview', { detail: id })); } else window.dispatchEvent(new CustomEvent('lu:visit', { detail: id })); }
    });
    map.on('popupclose', () => { if (!map._rebuilding) map._openPin = null; hashRef.current?.('mapa'); });
    // Centro da tela -> rádio por região (throttle)
    let last = 0, timer = null;
    // 'move' = arrastando (só atualiza o sinal); 'end' = parou (pode trocar de estação)
    const emitView = (e) => {
      const phase = e?.type === 'move' ? 'move' : 'end';
      const run = () => { last = performance.now(); const c = map.getCenter(); viewRef.current?.(c.lng, c.lat, phase); };
      clearTimeout(timer);
      if (phase === 'end' || performance.now() - last > 150) run(); else timer = setTimeout(run, 150);
    };
    map.on('move', emitView);
    map.on('moveend', emitView);

    // Ímã nas regiões: na visão geral, ao soltar o mapa ele se encaixa na região sob o centro.
    // Durante o arrasto, a região que vai "puxar" fica destacada.
    const regionBoundsCache = new Map();
    const boundsOf = (r) => {
      if (!regionBoundsCache.has(r.id)) regionBoundsCache.set(r.id, L.latLngBounds(r.polys.flat().map(([x, y]) => [y, x])));
      return regionBoundsCache.get(r.id);
    };
    // ativo enquanto a tela mostra mais de ~4,5 km de mapa (navegando entre regiões);
    // de perto, explorando ruas, o ímã não interfere
    const inMagnetZone = () => { const b = map.getBounds(); return b.getEast() - b.getWest() >= 4500; };
    const magnetTarget = () => {
      const rs = regionsRef.current || [], c = map.getCenter();
      const inside = regionAt(rs, c.lng, c.lat);
      if (inside) return inside;
      let best = null, d = Infinity;
      for (const r of rs) { const dd = edgeDist(r, c.lng, c.lat); if (dd < d) { d = dd; best = r; } }
      return d < 1200 ? best : null;      // no mar, só puxa se estiver perto da costa
    };
    const fitRegion = (r, duration = 0.8) => {
      const t = map._getBoundsCenterZoom(boundsOf(r), { paddingTopLeft: [padRef.current + 24, 24], paddingBottomRight: [24, 110] });
      map.closePopup();
      map._regionPreview?.(r, 0);
      map._go(t.center, t.zoom, () => map._regionPreview?.(null, 1200));
    };
    map._fitRegion = fitRegion;
    map._selectRegionAt = (latlng) => {
      const rs = regionsRef.current || [];
      const r = regionAt(rs, latlng.lng, latlng.lat);
      if (!r) return;
      // já está vendo essa região de perto: o clique fica livre (não puxa o mapa)
      const vb = map.getBounds(), rb = boundsOf(r), c = map.getCenter();
      const cur = regionAt(rs, c.lng, c.lat);
      if (cur?.id === r.id && vb.getEast() - vb.getWest() <= (rb.getEast() - rb.getWest()) * 1.4) return;
      fitRegion(r);
    };

    // só puxa quando o arrasto leva o centro para OUTRA região; ajustes dentro da mesma ficam livres
    let userDrag = false, snapping = false, fromRegion = null;
    map.on('dragstart', () => { userDrag = true; fromRegion = magnetRef.current ? magnetTarget()?.id ?? null : null; });
    map.on('drag', () => {
      const r = magnetRef.current && inMagnetZone() ? magnetTarget() : null;
      const pull = !!r && r.id !== fromRegion;
      if (pull) { map._magnetActive = true; map._regionPreview?.(r, 0); }
      else if (map._magnetActive) { map._magnetActive = false; map._regionPreview?.(null, 0); }
    });
    map.on('moveend', () => {
      if (!userDrag || snapping) return;
      userDrag = false;
      const r = map._magnetActive ? magnetTarget() : null;
      map._magnetActive = false;
      if (!r || !magnetRef.current || !inMagnetZone()) { map._regionPreview?.(null, 300); return; }
      const z = map.getZoom();
      const t = map._getBoundsCenterZoom(boundsOf(r), { paddingTopLeft: [padRef.current + 24, 24], paddingBottomRight: [24, 110] });
      const tz = Math.max(z - 0.75, Math.min(z + 0.75, t.zoom));
      const dpx = map.project(t.center, z).distanceTo(map.project(map.getCenter(), z));
      if (dpx < 30 && Math.abs(tz - z) < 0.2) { map._regionPreview?.(null, 900); return; }
      snapping = true;
      map._go(t.center, tz, () => { snapping = false; map._regionPreview?.(null, 900); });
    });
    map._emitView = emitView;
    mapRef.current = map;
    mapRef.current._syncTier = syncTier;
    apiRef.current = {
      // destaca vários resultados e enquadra todos (busca "mostrar no mapa")
      showResults(lms) {
        map._pinned = new Set(lms.map((l) => l[0]));
        map.closePopup();
        const t = map._getBoundsCenterZoom(L.latLngBounds(lms.map((l) => [l[5], l[4]])).pad(0.25), { maxZoom: -0.5 });
        map._go(t.center, Math.min(t.zoom, -0.5));
        map.once('moveend', () => map._syncTier());
        map._syncTier();
      },
      clearResults() { map._pinned = new Set(); map._syncTier(); },
      flyToRegion(r) {
        if (map._fitRegion) return map._fitRegion(r);
        map.flyToBounds(L.latLngBounds(r.polys.flat().map(([x, y]) => [y, x])).pad(0.08), { duration: 0.8 });
      },
      // modo seguro: vai até o ponto e marca só um alvo genérico, sem abrir o pin (nada de título/descrição)
      flyToSpot(x, y) {
        map._go([y, x], Math.max(map.getZoom(), -0.5), () => {
          map._spot?.remove();
          map._spot = L.marker([y, x], { icon: L.divIcon({ className: '', html: '<div class="lu-spot" title="Local do pin em moderação"></div>', iconSize: [36, 36], iconAnchor: [18, 18] }), interactive: false, keyboard: false, zIndexOffset: 2000 }).addTo(map);
          setTimeout(() => { map._spot?.remove(); map._spot = null; }, 12000);
        });
      },
      flyToPin(m) {
        map._go([m.coord_y, m.coord_x], Math.max(map.getZoom(), -0.5), () => pinIndexRef.current.get(String(m.id))?.openPopup());
      },
      flyToLandmark(lm) {
        map._pinned = new Set([lm[0]]);
        map._go([lm[5], lm[4]], Math.max(map.getZoom(), -0.5), () => {
          const mk = lmIndexRef.current.get(lm[0]);
          if (mk) mk.openPopup();
          else L.popup({ className: 'lu-popup-wrap', maxWidth: 290, autoPan: false }).setLatLng([lm[5], lm[4]]).setContent(landmarkPopup(lm)).openOn(map);
        });
      },
    };
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);
    return () => { ro.disconnect(); map.remove(); };
  }, []);

  // Imagem do mapa (padrão GTADB ou upload local)
  useEffect(() => {
    const map = mapRef.current, ov = overlayRef.current;
    if (!map || !ov) return;
    const b = L.latLngBounds(mapImage.bounds);
    if (tileRef.current) { tileRef.current.remove(); tileRef.current = null; }
    if (mapImage.tiles) {
      ov.remove();
      const opts = {
        tileSize: 1024, noWrap: true, bounds: b, keepBuffer: 2,
        minNativeZoom: mapImage.minNativeZoom, maxNativeZoom: mapImage.maxNativeZoom,
        minZoom: -20, maxZoom: 20, errorTileUrl: 'tiles/ocean.jpg',
      };
      tileRef.current = (CANVAS_FILTER_OK ? new FilteredTileLayer(mapImage.tiles, opts) : L.tileLayer(mapImage.tiles, opts));
      tileRef.current._cssFilter = MAP_FILTERS[mapStyleRef.current] || 'none';
      tileRef.current.addTo(map);
      tileRef.current.bringToBack();
    } else {
      ov.setUrl(mapImage.url);
      ov.setBounds(b);
      ov.addTo(map);
    }
    map.setMinZoom(-20); map.setMaxZoom(20);
    const fit = map.getBoundsZoom(b);
    map.setMinZoom(fit - 1);
    map.setMaxZoom(mapImage.maxZoom ?? fit + 5);
    map.setMaxBounds(b.pad(0.25));
    map.fitBounds(b);
    attrRef.current.remove();
    attrRef.current = L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);
    if (mapImage.credit) attrRef.current.addAttribution(GTADB_CREDIT);
  }, [mapImage]);

  useEffect(() => {
    const map = mapRef.current;
    const f = MAP_FILTERS[mapStyle] || 'none';
    if (map) {
      if (tileRef.current?.setCssFilter) { tileRef.current.setCssFilter(f); map.getPane('tilePane').style.filter = 'none'; }
      else map.getPane('tilePane').style.filter = f;   // navegador sem filtro em canvas: volta ao CSS
    }
    map?._emitView?.();
  }, [mapStyle, mapImage]);

  // Pins do portal (map_markers): spoilers viram "?", e somem dentro da névoa
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const map = mapRef.current, reopen = map?._openPin;
    if (map) map._rebuilding = true;
    layer.clearLayers();
    if (map) map._rebuilding = false;
    pinIndexRef.current = new Map();
    if (!showPins) return;
    markers
      .filter((m) => activeCats.includes(m.category) && (m.is_approved || showPending))
      .filter((m) => !fogged.size || !fogged.has(regionAt(regions || [], m.coord_x, m.coord_y)?.id))
      .forEach((m) => {
        const type = PIN_SPOILER[m.category];
        const hidden = spoil.isHidden(type, `pin:${m.id}`) ? type : null;
        const mk = L.marker([m.coord_y, m.coord_x], { icon: markerIcon(m, hidden), riseOnHover: true, zIndexOffset: 1000, bubblingMouseEvents: false })
          .bindPopup(popupHtml(m, hidden), { className: 'lu-popup-wrap', maxWidth: 260, autoPan: false })
          .addTo(layer);
        mk.on('dblclick', (e) => { L.DomEvent.stop(e); map._go([m.coord_y, m.coord_x], Math.max(map.getZoom() + 1, -0.5), () => mk.openPopup()); });
        pinIndexRef.current.set(String(m.id), mk);
      });
    if (reopen) pinIndexRef.current.get(String(reopen))?.openPopup();
  }, [markers, activeCats, showPending, fogged, spoil, regions, showPins]);

  // Regiões: contorno brilhante + nome no hover (ou na prévia do ímã); névoa nas não exploradas
  useEffect(() => {
    const map = mapRef.current, rl = regionLayerRef.current, fl = fogLayerRef.current;
    if (!map || !rl || !regions) return;
    rl.clearLayers(); fl.clearLayers();
    let label = null, halo = null, offTimer = null, shown = null;
    const polys = new Map();
    const show = (r) => {
      clearTimeout(offTimer);
      if (shown === r.id) return;
      const { poly, latlngs } = polys.get(r.id);
      rl.eachLayer((l) => l.setStyle?.({ weight: 0, opacity: 0, fillOpacity: 0 }));
      poly.setStyle({ weight: 2.5, opacity: 1, fillOpacity: fogged.has(r.id) ? 0 : 0.06 });
      // brilho = traço largo e translúcido por baixo (filtro de sombra em polígono grande travava o zoom)
      if (halo) halo.remove();
      halo = L.polygon(latlngs, { renderer: map._regionRenderer, color: '#ffffff', weight: 10, opacity: 0.18, fill: false, interactive: false }).addTo(map);
      halo.bringToBack();
      if (label) label.remove();
      label = L.marker([r.label[1], r.label[0]], {
        pane: 'regionLabelPane', interactive: false, keyboard: false,
        icon: L.divIcon({ className: '', iconSize: [10, 10], html: `<div class="region-label" style="--c:${r.color}">${escapeHtml(r.name)}</div>` }),
      }).addTo(map);
      shown = r.id;
    };
    const hide = (delay = 120) => {
      clearTimeout(offTimer);
      offTimer = setTimeout(() => {
        rl.eachLayer((l) => l.setStyle?.({ weight: 0, opacity: 0, fillOpacity: 0 }));
        if (halo) { halo.remove(); halo = null; }
        if (label) { label.remove(); label = null; }
        shown = null;
      }, delay);
    };
    regions.forEach((r) => {
      const latlngs = r.polys.map((ring) => ring.map(([x, y]) => [y, x]));
      if (fogged.has(r.id)) {
        L.polygon(latlngs, { renderer: map._fogRenderer, stroke: true, color: '#3f3f46', weight: 1, dashArray: '4 6', fillColor: '#07070b', fillOpacity: 0.93, interactive: false, className: 'lu-fog' }).addTo(fl);
        const lock = L.marker([r.label[1], r.label[0]], {
          icon: L.divIcon({ className: '', iconSize: [150, 56], iconAnchor: [75, 28],
            html: `<button class="fog-lock" style="--c:${r.color}" title="Área não explorada: clique se você já explorou ${escapeHtml(r.name)} no jogo"><span class="fog-lock__n">🔒 ${escapeHtml(r.name)}</span><span class="fog-lock__b">já explorei · revelar</span></button>` }),
          zIndexOffset: 2000, keyboard: true,
        }).addTo(fl);
        lock.on('click', () => revealRegionRef.current?.(r.id));
      }
      const poly = L.polygon(latlngs, {
        renderer: map._regionRenderer, color: r.color, weight: 0, opacity: 0, fill: true, fillColor: r.color, fillOpacity: 0,
        className: 'lu-region',
      }).addTo(rl);
      polys.set(r.id, { poly, latlngs });
      // durante o arrasto quem manda é a prévia do ímã, não o cursor
      poly.on('mouseover', () => { if (!map._magnetActive) show(r); });
      poly.on('mouseout', () => { if (!map._magnetActive) hide(); });
    });
    map._regionPreview = (r, delay) => (r ? show(r) : hide(delay));
    return () => { clearTimeout(offTimer); if (label) label.remove(); if (halo) halo.remove(); map._regionPreview = null; };
  }, [regions, fogged]);

  // Landmarks curados (GTADB) como blips
  useEffect(() => {
    const layer = lmLayerRef.current, map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    lmIndexRef.current = new Map();
    lmItemsRef.current = [];
    if (!showLandmarks || !landmarks) return;
    landmarks.forEach((lm) => {
      if (!landmarkCats.includes(lm[7])) return;
      if (spoil.hide.leak && lm[8].includes('u')) return;        // não confirmado (leak)
      if (fogged.size && (fogged.has(lm[10]) || !lm[10])) return; // região ainda não explorada
      const mk = L.marker([lm[5], lm[4]], { icon: blipIcon(lm), riseOnHover: true, bubblingMouseEvents: false, keyboard: false })
        .bindPopup(() => landmarkPopup(lm), { className: 'lu-popup-wrap', maxWidth: 290, autoPan: false })
        .bindTooltip(escapeHtml(lm[1]), { direction: 'top', className: 'lu-tip', opacity: 1 });
      mk.on('popupopen', () => mk.closeTooltip());
      // 1 clique: só abre a ficha · 2 cliques: vai até o local
      mk.on('dblclick', (e) => { L.DomEvent.stop(e); map._pinned = new Set([lm[0]]); map._go([lm[5], lm[4]], Math.max(map.getZoom() + 1, -0.5), () => mk.openPopup()); });
      lmIndexRef.current.set(lm[0], mk);
      lmItemsRef.current.push({ lm, mk, rank: TYPE_RANK[lm[7]] });
    });
    map._syncTier();
  }, [landmarks, showLandmarks, landmarkCats, spoil.hide.leak, fogged]);

  return (
    <div className="absolute inset-0">
      <div ref={elRef} className="absolute inset-0 lu-map" />
    </div>
  );
}

// Reduz a imagem no navegador antes de enviar (no Laravel: upload para o R2 + conversão para WebP)
function shrinkImage(file, max = 1000) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82));
    };
    im.onerror = rej; im.src = url;
  });
}

function SuggestModal({ coords, onCancel, onSubmit, nearby, onGoNearby, trusted }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'easter-egg', image: '' });
  const [error, setError] = useState('');
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = (e) => {
    e.preventDefault();
    if (form.title.trim().length < 3) return setError('Dê um título com pelo menos 3 caracteres.');
    if (form.description.trim().length < 10) return setError('Descreva o que tem nesse ponto (mín. 10 caracteres).');
    onSubmit({ ...form, title: form.title.trim(), description: form.description.trim() });
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="glass-card w-full max-w-md p-6 relative" role="dialog" aria-modal="true" aria-label="Sugerir novo pin">
        <button type="button" onClick={onCancel} className="absolute top-3 right-3 icon-btn" aria-label="Fechar"><IconClose className="w-5 h-5" /></button>
        <p className="font-mono text-[11px] tracking-[0.3em] text-sunset">// NOVA DESCOBERTA</p>
        <h3 className="font-display uppercase text-3xl text-white mb-1">Sugerir pin</h3>
        <p className="font-mono text-xs text-cyber mb-3">COORD X {Math.round(coords.lng)} · Y {Math.round(coords.lat)}</p>
        {nearby && (
          <div className="mb-4 rounded-lg border border-yellow-400/40 bg-yellow-400/5 p-3 text-sm">
            <p className="text-yellow-200">Já existe <b>{nearby.name}</b> a {nearby.dist} m daqui.</p>
            <p className="text-zinc-400 text-xs mt-0.5">{nearby.kind === 'pin' ? 'Se é a mesma coisa, confirme o pin existente: ele ganha força e você ganha respeito.' : 'Se é o mesmo lugar, não precisa marcar de novo. Se é algo diferente (um segredo ali perto), siga em frente.'}</p>
            <button type="button" onClick={() => onGoNearby(nearby)} className="mt-2 font-mono text-[11px] text-yellow-300 underline underline-offset-2">{nearby.kind === 'pin' ? 'Ver e confirmar o pin existente' : 'Ver o local existente'}</button>
          </div>
        )}
        <p className="text-xs text-zinc-500 mb-4">{trusted ? 'Você é Confiável: o pin vai direto para o mapa.' : 'Como Novato, seu pin passa pela moderação. Os pontos entram quando ele for aprovado.'}</p>

        <label className="field-label" htmlFor="pin-title">Título</label>
        <input id="pin-title" ref={firstRef} className="field" placeholder="Ex.: Carro dourado no estacionamento"
          value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} />

        <label className="field-label" htmlFor="pin-cat">Categoria</label>
        <div id="pin-cat" className="grid grid-cols-2 gap-2 mb-4">
          {Object.entries(MARKER_CATS).map(([k, c]) => (
            <button type="button" key={k} onClick={() => setForm({ ...form, category: k })}
              className={`cat-opt ${form.category === k ? 'cat-opt--active' : ''}`} style={{ '--c': c.color }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
              {c.label}
            </button>
          ))}
        </div>

        <label className="field-label" htmlFor="pin-desc">Descrição</label>
        <textarea id="pin-desc" className="field min-h-[90px] resize-y" placeholder="O que acontece aqui? Como encontrar?"
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} />

        <label className="field-label" htmlFor="pin-img">Print ou foto (opcional)</label>
        {form.image ? (
          <div className="relative mb-4 rounded-lg overflow-hidden border border-zinc-700">
            <img src={form.image} alt="Prévia da imagem enviada" className="w-full max-h-48 object-cover" />
            <button type="button" onClick={() => setForm({ ...form, image: '' })} className="absolute top-2 right-2 icon-btn bg-black/70" aria-label="Remover imagem"><IconClose className="w-4 h-4" /></button>
          </div>
        ) : (
          <input id="pin-img" type="file" accept="image/*" className="field file:mr-3 file:rounded file:border-0 file:bg-neon/20 file:px-3 file:py-1 file:text-neon file:font-mono file:text-xs"
            onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setForm((v) => ({ ...v, image: '' })); const url = await shrinkImage(f); setForm((v) => ({ ...v, image: url })); } catch (err) { setError('Não consegui ler essa imagem.'); } }} />
        )}

        {error && <p className="font-mono text-xs text-neon mb-3" role="alert">⚠ {error}</p>}

        <div className="flex gap-2 mt-2">
          <button type="button" onClick={onCancel} className="btn-ghost flex-1">Cancelar</button>
          <button type="submit" className="btn-neon flex-1">Enviar pin</button>
        </div>
        <p className="mt-3 font-mono text-[10px] text-zinc-500 text-center">Pins da comunidade entram com is_approved = false até a moderação aprovar.</p>
      </form>
    </div>
  );
}

// Miniatura do mapa centrada no ponto (mesmo recorte usado no cartão de compartilhar)
function MapThumb({ x, y, color = '#ff007f', w = 380, h = 170 }) {
  const ref = useRef(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const c = ref.current; if (!c) return;
      const ctx = c.getContext('2d');
      await drawMapRect(ctx, { x, y }, 'radar', 0, 0, w, h, 0.5, 0.5);
      if (!alive) return;
      ctx.filter = 'none';
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowColor = color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    })();
    return () => { alive = false; };
  }, [x, y]);
  return <canvas ref={ref} width={w} height={h} className="w-full rounded-md border border-zinc-700" role="img" aria-label={`Mapa em volta de X ${Math.round(x)}, Y ${Math.round(y)}`} />;
}

const REJECT_REASONS = ['Duplicado', 'Sem evidência', 'Localização errada', 'Leak ou spoiler indevido', 'Conteúdo ofensivo', 'Spam'];

/* --- Modo seguro da moderação: o moderador também se protege de spoilers (padrão: ligado) --- */
const MODSAFE_KEY = 'lu-modsafe';
function useModSafe() {
  const [on, setOn] = useState(() => { try { return localStorage.getItem(MODSAFE_KEY) !== 'off'; } catch (e) { return true; } });
  const set = (v) => { setOn(v); try { localStorage.setItem(MODSAFE_KEY, v ? 'on' : 'off'); } catch (e) { /* ok */ } };
  return [on, set];
}
function ModSafeSwitch({ on, set }) {
  return (
    <div className={`mx-3 mt-3 rounded-lg border px-3 py-2 flex items-center gap-3 ${on ? 'border-cyan-400/40 bg-cyan-400/5' : 'border-amber-400/40 bg-amber-400/5'}`}>
      <div className="flex-1 min-w-0">
        <p className={`font-mono text-[11px] tracking-widest ${on ? 'text-cyber' : 'text-amber-300'}`}>{on ? '🛡 MODO SEGURO LIGADO' : '⚠ MODO SEGURO DESLIGADO'}</p>
        <p className="text-[11px] text-zinc-400 leading-snug">{on ? 'Você vê só onde é, quem mandou e a checagem automática. Título, texto, imagem e categoria ficam ocultos.' : 'Tudo aparece, inclusive spoilers.'}</p>
      </div>
      <button role="switch" aria-checked={on} aria-label="Modo seguro contra spoilers" onClick={() => set(!on)}
        className={`relative shrink-0 w-12 h-6 rounded-full border transition ${on ? 'bg-cyan-400/30 border-cyan-400' : 'bg-zinc-800 border-zinc-600'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
function Hidden({ label, onReveal }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-600 bg-zinc-900/60 px-3 py-3 text-center">
      <p className="font-mono text-[11px] text-zinc-400">{label}</p>
      <button onClick={onReveal} className="mt-1 text-[11px] text-zinc-500 underline hover:text-amber-300">revelar só este item (pode ter spoiler)</button>
    </div>
  );
}
// checagem que não depende de ler o conteúdo (no Laravel: IA + regras, resultado salvo no registro)
const pinChecks = (m) => [
  m.description?.length > 20 ? 'Texto com tamanho ok' : 'Texto curto',
  'Sem palavrões',
  m.image_path ? 'Imagem recebida, sem texto ou rosto detectado' : 'Sem imagem',
  PIN_SPOILER[m.category] ? 'IA: pode conter spoiler' : 'IA: sem spoiler aparente',
];

function ModerationDrawer({ markers, onApprove, onReject, onClose, onLocate, regions, landmarks, game }) {
  const pending = markers.filter((m) => !m.is_approved);
  const [reasonFor, setReasonFor] = useState(null);
  const [safe, setSafe] = useModSafe();
  const [shown, setShown] = useState({});
  const authorInfo = (m) => {
    if (m.mine && game?.user) return { respect: game.prog.respect, trust: trustOf(game.prog.respect).label };
    const p = MOCK_PLAYERS.find((x) => x.name === m.author);
    return p ? { respect: p.respect, trust: trustOf(p.respect).label } : { respect: 0, trust: 'Novato' };
  };
  const nearest = (m) => {
    let best = null;
    (landmarks || []).forEach((lm) => { const d = Math.hypot(lm[4] - m.coord_x, lm[5] - m.coord_y); if (!best || d < best.d) best = { name: lm[1], d }; });
    return best;
  };
  const dupes = (m) => markers.filter((o) => o.id !== m.id && o.is_approved && Math.hypot(o.coord_x - m.coord_x, o.coord_y - m.coord_y) < 80);
  return (
    <aside className="absolute top-3 right-3 bottom-3 z-[1100] w-[min(420px,calc(100%-24px))] glass-card flex flex-col animate-slide-in" aria-label="Fila de moderação">
      <div className="p-4 border-b border-pink-500/20 flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] text-violet-300">SIMULAÇÃO · FILAMENT · {pending.length} NA FILA</p>
          <h3 className="font-display uppercase text-2xl text-white">Fila de moderação</h3>
        </div>
        <button onClick={onClose} className="icon-btn" aria-label="Fechar"><IconClose className="w-5 h-5" /></button>
      </div>
      <ModSafeSwitch on={safe} set={setSafe} />
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {pending.length === 0 && <p className="text-sm text-zinc-500 font-mono p-3 text-center">Fila vazia. Clique com o botão direito no mapa para sugerir um pin.</p>}
        {pending.map((m) => {
          const c = MARKER_CATS[m.category], sp = PIN_SPOILER[m.category];
          const reg = regions ? regionAt(regions, m.coord_x, m.coord_y) : null;
          const nl = nearest(m), du = dupes(m), au = authorInfo(m);
          const hide = safe && !shown[m.id];
          return (
            <article key={m.id} className="rounded-lg border border-zinc-700/60 bg-black/40 p-3 space-y-2">
              {hide ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded border border-zinc-600 text-zinc-400">Pin #{m.id}</span>
                    <span className="font-mono text-[10px] text-cyber">🛡 CONTEÚDO OCULTO</span>
                  </div>
                  <Hidden label={`Título, descrição${m.image_path ? ', imagem' : ''} e categoria ocultos`} onReveal={() => setShown({ ...shown, [m.id]: true })} />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded border" style={{ color: c.color, borderColor: `${c.color}66` }}>{c.label}</span>
                    {sp && <span className="font-mono text-[10px] text-red-300">SPOILER: {SPOILER_TYPES[sp].label.toUpperCase()}</span>}
                  </div>
                  <h4 className="font-semibold text-white">{m.title}</h4>
                  <p className="text-sm text-zinc-300 whitespace-pre-line">{m.description}</p>
                  {m.image_path && String(m.image_path).startsWith('data:image/')
                    ? <a href={m.image_path} target="_blank" rel="noopener noreferrer"><img src={m.image_path} alt={`Imagem enviada com "${m.title}"`} className="w-full max-h-56 object-cover rounded-md border border-zinc-700" /></a>
                    : <p className="font-mono text-[10px] text-zinc-500">Sem imagem</p>}
                </>
              )}
              <MapThumb x={m.coord_x} y={m.coord_y} color={hide ? '#22d3ee' : c.color} />
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
                <dt className="text-zinc-500">Região</dt><dd className="text-zinc-200">{reg?.name || 'Fora das regiões'}</dd>
                <dt className="text-zinc-500">Perto de</dt><dd className="text-zinc-200">{nl ? `${nl.name} · ${Math.round(nl.d)} m` : '—'}</dd>
                <dt className="text-zinc-500">Coordenadas</dt><dd className="font-mono text-zinc-300">X {Math.round(m.coord_x)} · Y {Math.round(m.coord_y)}</dd>
                <dt className="text-zinc-500">Autor</dt><dd className="text-zinc-200">@{m.author || 'anônimo'} <span className="text-zinc-500">· {au.trust} · {au.respect} de respeito</span></dd>
                <dt className="text-zinc-500">Enviado</dt><dd className="text-zinc-300">{m.created_at ? new Date(m.created_at).toLocaleString('pt-BR') : 'antes do lançamento'}</dd>
                <dt className="text-zinc-500">Checagem</dt><dd className="text-zinc-300">{pinChecks(m).join(' · ')}</dd>
              </dl>
              {du.length > 0 && (
                <p className="text-[12px] rounded-md border border-yellow-400/40 bg-yellow-400/5 text-yellow-200 px-2 py-1.5">
                  {hide ? `Possível duplicata: ${du.length} pin${du.length > 1 ? 's' : ''} já publicado${du.length > 1 ? 's' : ''} a menos de 80 m` : `Possível duplicata: ${du.map((d) => d.title).join(', ')} (a menos de 80 m)`}
                </p>
              )}
              <button onClick={() => onLocate(m, hide)} className="w-full font-mono text-[11px] text-cyber border border-cyan-400/40 rounded-md py-1.5 hover:bg-cyber/10">{hide ? 'Ver só o ponto no mapa (sem abrir o pin)' : 'Ver no mapa'}</button>
              {hide && <p className="text-[11px] text-zinc-500 leading-snug">Dica: vá até o ponto no jogo e confira com seus olhos. Se bater, aprove sem ler.</p>}
              {reasonFor === m.id ? (
                <div className="space-y-1.5">
                  <p className="font-mono text-[10px] text-zinc-400">MOTIVO DA RECUSA (o autor recebe esta mensagem)</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {REJECT_REASONS.map((r) => (
                      <button key={r} onClick={() => { setReasonFor(null); onReject(m.id, r); }} className="text-[11px] rounded-md border border-red-400/40 text-red-300 py-1.5 hover:bg-red-500/15">{r}</button>
                    ))}
                  </div>
                  <button onClick={() => setReasonFor(null)} className="w-full text-[11px] text-zinc-400 underline">cancelar</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => onApprove(m.id)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-mono py-1.5 hover:bg-emerald-500/25">
                    <IconCheck className="w-3.5 h-3.5" /> APROVAR
                  </button>
                  <button onClick={() => setReasonFor(m.id)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-red-500/10 border border-red-400/40 text-red-300 text-xs font-mono py-1.5 hover:bg-red-500/20">
                    <IconClose className="w-3.5 h-3.5" /> RECUSAR
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </aside>
  );
}

const normalize = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function MapPage({ markers, setMarkers, toast, mapImage, landmarks, player, onReception, regions, spoil, fogged, onRevealRegion, onOpenSpoilers, focus, onSelectHash, mapQuery, game, requireLogin }) {
  const [activeCats, setActiveCats] = useState(Object.keys(MARKER_CATS));
  const [draft, setDraft] = useState(null);
  const [showMod, setShowMod] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [landmarkCats, setLandmarkCats] = useState(Object.keys(BLIP_TYPES));
  const [mapStyle, setMapStyle] = useState('radar');
  const [shareItem, setShareItem] = useState(null);
  const [reception, setReception] = useState(null);
  const [query, setQuery] = useState('');
  const [panelOpen, setPanelOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768);
  const [showPins, setShowPins] = useState(true);
  const layerMode = showLandmarks && showPins ? 'ambos' : showLandmarks ? 'locais' : showPins ? 'pins' : 'nenhum';
  const setLayerMode = (m) => { setShowLandmarks(m !== 'pins'); setShowPins(m !== 'locais'); };
  const [magnet, setMagnetState] = useState(() => { try { return localStorage.getItem('lu-magnet') !== 'off'; } catch (e) { return true; } });
  const setMagnet = (v) => { setMagnetState(v); try { localStorage.setItem('lu-magnet', v ? 'on' : 'off'); } catch (e) { /* sem storage */ } };
  const [tab, setTab] = useState('locais');
  const [collapsed, setCollapsed] = useState(() => { try { return JSON.parse(localStorage.getItem('lu-lm-collapsed')) || []; } catch (e) { return []; } });
  const toggleGroup = (id) => setCollapsed((c) => {
    const v = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
    try { localStorage.setItem('lu-lm-collapsed', JSON.stringify(v)); } catch (e) { /* sem storage */ }
    return v;
  });
  const apiRef = useRef(null);

  const approved = markers.filter((m) => m.is_approved);
  const pendingCount = markers.length - approved.length;
  const isDefaultMap = !!mapImage.credit;
  const here = reception?.region && regions ? regions.find((r) => r.id === reception.region) : null;

  const onView = useCallback((x, y, phase) => {
    if (!isDefaultMap) return;
    const r = computeReception(x, y, regions);
    setReception(r);
    onReception(r, phase);
  }, [isDefaultMap, onReception, regions]);
  useEffect(() => () => onReception(null), []);

  const openShare = useCallback((ref) => {
    const [kind, id] = ref.split(':');
    if (kind === 'lm') {
      const lm = (landmarks || []).find((l) => l[0] === id);
      if (!lm) return;
      const t = BLIP_TYPES[lm[7]];
      setShareItem({ kind: 'landmark', type: lm[7], title: lm[1], typeLabel: t.label, color: t.color,
        area: [lm[2], lm[3]].filter(Boolean).join(' · '), desc: lm[6], descLabel: 'Inspiração real', x: lm[4], y: lm[5], link: linkFor('lm', lm[0]) });
    } else {
      const m = markers.find((mk) => String(mk.id) === id);
      if (!m) return;
      const c = MARKER_CATS[m.category];
      setShareItem({ kind: 'pin', title: m.title, typeLabel: c.label, color: c.color, area: 'Descoberta da comunidade',
        desc: m.description, descLabel: 'O que tem aqui', x: m.coord_x, y: m.coord_y, spoiler: PIN_SPOILER[m.category] || null, link: linkFor('pin', m.id) });
    }
  }, [landmarks, markers]);

  // Link direto (#local-L13 / #pin-3): leva até o local, respeitando a proteção contra spoilers
  const doneFocus = useRef(null);
  useEffect(() => {
    if (!focus || doneFocus.current === focus.key || !landmarks || !regions || !apiRef.current) return;
    if (focus.kind === 'region') {
      doneFocus.current = focus.key;
      const r = regions.find((x) => x.id === focus.id);
      if (!r) { toast({ title: 'REGIÃO NÃO ENCONTRADA', sub: 'Confira o link', reward: '' }); return; }
      apiRef.current.flyToRegion(r);
      return;
    }
    if (focus.kind === 'lm') {
      const lm = landmarks.find((l) => l[0] === focus.id);
      if (!lm) { doneFocus.current = focus.key; toast({ title: 'LOCAL NÃO ENCONTRADO', sub: 'O link pode ser de uma versão antiga do mapa', reward: '' }); return; }
      doneFocus.current = focus.key;
      if (fogged.has(lm[10]) || (fogged.size && !lm[10])) {
        const r = regions.find((x) => x.id === lm[10]);
        if (r) apiRef.current.flyToRegion(r);
        toast({ title: 'ÁREA NÃO EXPLORADA', sub: 'O link aponta para uma região que você ainda não revelou', reward: '' });
        return;
      }
      if (spoil.hide.leak && lm[8].includes('u')) {
        toast({ title: 'LOCAL ESCONDIDO', sub: 'É um local não confirmado e seu filtro esconde leaks', reward: '' });
        return;
      }
      setShowLandmarks(true);
      setLandmarkCats((a) => (a.includes(lm[7]) ? a : [...a, lm[7]]));
      setTimeout(() => apiRef.current?.flyToLandmark(lm), 50);
    } else {
      const m = markers.find((mk) => String(mk.id) === focus.id && mk.is_approved);
      doneFocus.current = focus.key;
      if (!m) { toast({ title: 'PIN NÃO ENCONTRADO', sub: 'Ele pode ter sido removido pela moderação', reward: '' }); return; }
      const r = regionAt(regions, m.coord_x, m.coord_y);
      if (r && fogged.has(r.id)) { apiRef.current.flyToRegion(r); toast({ title: 'ÁREA NÃO EXPLORADA', sub: 'O link aponta para uma região que você ainda não revelou', reward: '' }); return; }
      setActiveCats((a) => (a.includes(m.category) ? a : [...a, m.category]));
      setTimeout(() => apiRef.current?.flyToPin(m), 50);
    }
  }, [focus, landmarks, regions, fogged]);

  const toggleCat = (k) => setActiveCats((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  const toggleLmCat = (k) => setLandmarkCats((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));



  // só busca no que está visível (respeita névoa e "sem leaks")
  const visibleLms = useMemo(() => (landmarks || []).filter((lm) => !(spoil.hide.leak && lm[8].includes('u')) && !(fogged.size && (fogged.has(lm[10]) || !lm[10]))), [landmarks, spoil.hide.leak, fogged]);
  const nlIndex = useMemo(() => (landmarks ? buildIndex(visibleLms, regions || []) : null), [visibleLms, regions, landmarks]);
  const lmCounts = useMemo(() => {
    const c = {};
    visibleLms.forEach((lm) => (c[lm[7]] = (c[lm[7]] || 0) + 1));
    return c;
  }, [visibleLms]);
  const TYPE_LABELS = useMemo(() => Object.fromEntries(Object.entries(BLIP_TYPES).map(([k, v]) => [k, v.label])), []);
  const search = useMemo(() => (nlIndex ? nlSearch(nlIndex, query, TYPE_LABELS) : null), [nlIndex, query]);
  const results = search?.results || [];
  const [searchFocus, setSearchFocus] = useState(false);
  // busca vinda da busca global: preenche o campo e destaca os resultados no mapa
  const autoHighlight = useRef(false);
  useEffect(() => {
    if (!mapQuery) return;
    autoHighlight.current = true;
    setQuery(mapQuery.text); setPanelOpen(true); setTab('locais');
  }, [mapQuery?.key]);
  useEffect(() => {
    if (!autoHighlight.current || !results.length || !apiRef.current) return;
    autoHighlight.current = false;
    setShowLandmarks(true); setLandmarkCats(Object.keys(BLIP_TYPES));
    setTimeout(() => apiRef.current?.showResults(results.map((r) => r.lm)), 80);
  }, [results]);
  const EXAMPLES = ['posto perto do aeroporto', 'hotel nas keys', 'comida no pântano', 'onde comprar armas', 'trem perto do Albany Hotel'];

  const [[minY, minX], [maxY, maxX]] = mapImage.bounds;
  const onMapClick = useCallback((latlng) => {
    if (latlng.lat < minY || latlng.lat > maxY || latlng.lng < minX || latlng.lng > maxX) return;
    if (fogged.size && fogged.has(regionAt(regions || [], latlng.lng, latlng.lat)?.id)) return;   // dentro da névoa
    if (!game.user) return requireLogin('Para marcar um pin você precisa de uma conta. É rápido: entre com Discord ou Google.');
    setDraft(latlng);
  }, [minY, minX, maxY, maxX, fogged, regions, game.user, requireLogin]);

  // algo já marcado a menos de 80 m? (evita pin duplicado: melhor confirmar o que existe)
  const nearbyOf = (ll) => {
    if (!ll) return null;
    let best = null;
    const consider = (kind, id, name, x, y) => { const d = Math.hypot(x - ll.lng, y - ll.lat); if (d < 80 && (!best || d < best.dist)) best = { kind, id, name, dist: Math.round(d) }; };
    markers.forEach((m) => m.is_approved && consider('pin', m.id, m.title, m.coord_x, m.coord_y));
    (landmarks || []).forEach((lm) => consider('lm', lm[0], lm[1], lm[4], lm[5]));
    return best;
  };
  const isFirst = (m) => {
    const others = markers.filter((o) => o.id !== m.id && o.is_approved);
    const near = (x, y) => Math.hypot(x - m.coord_x, y - m.coord_y) < 60;
    return !others.some((o) => near(o.coord_x, o.coord_y)) && !(landmarks || []).some((lm) => near(lm[4], lm[5]));
  };
  // simulação: depois de aprovado, outro jogador confirma o seu pin
  const simulateConfirmation = (id) => setTimeout(() => {
    setMarkers((ms) => ms.map((m) => (m.id === id ? { ...m, confirmations: (m.confirmations || 0) + 1 } : m)));
    game.confirmReceived(MOCK_PLAYERS[Math.floor(Math.random() * 3)].name);
  }, 9000);

  const submit = (data) => {
    const marker = {
      id: Date.now(),
      title: data.title,
      description: data.description,
      category: data.category,
      coord_x: +draft.lng.toFixed(2),
      coord_y: +draft.lat.toFixed(2),
      image_path: data.image || null,
      is_approved: false,
      author: game.user.name, mine: true, confirmations: 0, created_at: new Date().toISOString(),
    };
    const trusted = trustOf(game.prog.respect).id !== 'novato';
    setDraft(null);
    if (trusted) {
      const first = isFirst(marker);
      setMarkers((ms) => [...ms, { ...marker, is_approved: true, first }]);
      game.pinApproved({ category: marker.category, first });
      simulateConfirmation(marker.id);
    } else {
      setMarkers((ms) => [...ms, marker]);
      toast({ title: 'PIN ENVIADO', sub: 'Vai para a moderação. Pontos entram quando for aprovado', reward: '', sfx: 'notice' });
    }
  };

  const approve = (id) => {
    const m = markers.find((x) => x.id === id);
    const first = m ? isFirst(m) : false;
    setMarkers((ms) => ms.map((x) => (x.id === id ? { ...x, is_approved: true, first } : x)));
    if (m?.mine && game.user) { game.pinApproved({ category: m.category, first }); simulateConfirmation(id); }
    else toast({ title: 'PIN APROVADO', sub: 'Já está visível no mapa', reward: '' });
  };
  const reject = (id, reason) => {
    const m = markers.find((x) => x.id === id);
    setMarkers((ms) => ms.filter((x) => x.id !== id));
    toast({ title: m?.mine ? 'PIN RECUSADO' : 'PIN REMOVIDO DA FILA', sub: `Motivo: ${reason}`, reward: '', sfx: 'notice' });
  };

  return (
    <section className="relative h-[calc(100vh-4rem-5rem)] md:h-[calc(100vh-4rem-4.5rem)]">
      <LeafletMap
        showPins={showPins} markers={markers} activeCats={activeCats} showPending={showPending} onMapClick={onMapClick}
        mapImage={mapImage} landmarks={landmarks} showLandmarks={showLandmarks && isDefaultMap}
        landmarkCats={landmarkCats} mapStyle={isDefaultMap ? mapStyle : 'original'} apiRef={apiRef}
        onShare={openShare} onView={onView} regions={regions} fogged={fogged} spoil={spoil} onRevealRegion={onRevealRegion} onSelectHash={onSelectHash}
        magnet={magnet} padLeft={panelOpen && typeof window !== 'undefined' && window.innerWidth >= 768 ? 352 : 0}
      />

      {/* Painel lateral */}
      <div className="absolute top-3 left-3 bottom-3 z-[1050] w-[min(340px,calc(100%-24px))] flex flex-col pointer-events-none">
        {!panelOpen ? (
          <button onClick={() => setPanelOpen(true)} className="pointer-events-auto glass-card self-start flex items-center gap-2 px-3 py-2.5 text-white hover:!border-cyber" aria-label="Abrir painel do mapa" aria-expanded="false">
            <SearchIcon className="w-4 h-4 text-cyber" />
            <span className="font-display uppercase tracking-wide">Buscar e filtrar</span>
            {here && <span className="font-mono text-[10px]" style={{ color: here.color }}>· {here.name.toUpperCase()}</span>}
          </button>
        ) : (
        <div className="glass-card pointer-events-auto flex flex-col min-h-0 max-h-full overflow-hidden">
          {/* Cabeçalho */}
          <div className="px-4 pt-3.5 pb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[10px] tracking-[0.3em] text-sunset">MAPA INTERATIVO</p>
              <h1 className="font-display uppercase text-[28px] leading-none text-white">Leonida</h1>
            </div>
            <button onClick={() => setPanelOpen(false)} className="icon-btn !w-8 !h-8 shrink-0" aria-label="Recolher painel" aria-expanded="true">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
          </div>
          {here && (
            <div className="mx-4 mb-2.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5 border" style={{ borderColor: `${here.color}55`, background: `${here.color}12` }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: here.color, boxShadow: `0 0 8px ${here.color}` }} />
              <span className="font-mono text-[10px] text-zinc-400">AGORA EM</span>
              <span className="font-display uppercase text-sm text-white truncate">{here.name}</span>
              {reception && <span className="ml-auto font-mono text-[10px] shrink-0" style={{ color: STATION_BY_ID[reception.station].color }}>{STATION_BY_ID[reception.station].freq} FM</span>}
            </div>
          )}

          {/* Busca (sempre visível) */}
          <div className="px-4 pb-3 border-b border-white/5">
            <div className="relative">
              <SearchIcon className="w-4 h-4 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => setSearchFocus(true)} onBlur={() => setTimeout(() => setSearchFocus(false), 150)}
                placeholder={landmarks ? 'Ex.: posto perto do aeroporto' : 'Carregando locais…'}
                className="field !mb-0 !py-2 !pl-8 !pr-8" aria-label="Buscar locais" disabled={!landmarks} />
              {query && (
                <button onClick={() => { setQuery(''); apiRef.current?.clearResults(); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 icon-btn !w-6 !h-6" aria-label="Limpar busca">
                  <IconClose className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {!query && searchFocus && (
              <div className="mt-2 flex flex-wrap gap-1">
                {EXAMPLES.map((ex) => (
                  <button key={ex} onMouseDown={(e) => { e.preventDefault(); setQuery(ex); }}
                    className="px-2 py-0.5 rounded-full border border-zinc-700 font-mono text-[10px] text-zinc-300 hover:border-cyber hover:text-cyber">{ex}</button>
                ))}
              </div>
            )}
            {search && query.trim().length >= 2 && (
              <div className="mt-2">
                {search.understood && (
                  <p className="font-mono text-[10px] text-zinc-400 mb-1.5">
                    <span className="text-cyber">ENTENDI:</span> {search.understood}{search.sorted ? ' · por distância' : ''} · {search.total} {search.total === 1 ? 'local' : 'locais'}
                  </p>
                )}
                {results.length > 0 ? (
                  <>
                    <ul className="rounded-lg border border-zinc-800 bg-black/70 divide-y divide-zinc-800/80 overflow-y-auto max-h-[38vh]">
                      {results.slice(0, 8).map(({ lm, d, ref }) => (
                        <li key={lm[0]}>
                          <button onClick={() => { setShowLandmarks(true); if (!landmarkCats.includes(lm[7])) toggleLmCat(lm[7]); apiRef.current?.flyToLandmark(lm); }}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-white/5">
                            <span className="flex items-center gap-2">
                              <Blip type={lm[7]} size={18} />
                              <span className="text-sm text-white truncate flex-1">{lm[1]}</span>
                              {d != null && <span className="font-mono text-[10px] text-cyber shrink-0">{d === 0 ? 'na região' : fmtDist(d)}</span>}
                            </span>
                            <span className="block pl-[26px] font-mono text-[10px] text-zinc-500 truncate">
                              {[lm[2], lm[3]].filter(Boolean).join(' · ')}{ref?.[1] ? ` · de ${ref[1]}` : ''}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => { setShowLandmarks(true); setLandmarkCats(Object.keys(BLIP_TYPES)); apiRef.current?.showResults(results.map((r) => r.lm)); }}
                      className="mt-1.5 w-full py-1.5 rounded-md border border-cyan-400/40 bg-cyber/10 font-mono text-[10px] text-cyber hover:bg-cyber/20">
                      DESTACAR {Math.min(results.length, 12)} NO MAPA
                    </button>
                  </>
                ) : (
                  <p className="font-mono text-[10px] text-zinc-500">Nenhum local encontrado. Tente "posto perto de Ambrosia" ou "hotel nas keys".</p>
                )}
              </div>
            )}
          </div>

          {/* Regiões: atalhos */}
          {regions?.length > 0 && (
            <div className="px-4 py-2.5 border-b border-white/5">
              <p className="font-mono text-[10px] tracking-widest text-zinc-500 mb-1.5">IR PARA</p>
              <div className="flex flex-wrap gap-1">
                {regions.map((r) => {
                  const locked = fogged.has(r.id);
                  const active = here?.id === r.id;
                  return (
                    <button key={r.id} onClick={() => apiRef.current?.flyToRegion(r)}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] transition hover:text-white ${active ? 'text-white' : 'text-zinc-300'}`}
                      style={{ borderColor: active ? r.color : `${r.color}40`, background: active ? `${r.color}22` : 'transparent' }} title={locked ? 'Área não explorada' : `Ir para ${r.name}`}>
                      {locked ? <span className="text-[10px]">🔒</span> : <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />}
                      {r.name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-widest text-zinc-500">MOSTRAR</span>
                <div className="flex-1 grid grid-cols-3 rounded-md border border-zinc-700 overflow-hidden" role="radiogroup" aria-label="O que mostrar no mapa">
                  {[['locais', 'Locais'], ['pins', 'Pins'], ['ambos', 'Ambos']].map(([k, label]) => (
                    <button key={k} role="radio" aria-checked={layerMode === k} onClick={() => setLayerMode(k)}
                      className={`text-[11px] py-1 transition ${layerMode === k ? 'bg-cyber/15 text-cyber' : 'text-zinc-400 hover:text-white'}`}>{label}</button>
                  ))}
                </div>
              </div>
              <p className="mt-2 font-mono text-[10px] text-zinc-500 flex flex-wrap gap-x-3 gap-y-0.5">
                <span><span className="kbd">Clique</span> região ou ficha</span>
                <span><span className="kbd">2 cliques</span> ir até o local</span>
                <span><span className="kbd">Botão direito</span> marcar pin</span>
              </p>
            </div>
          )}

          {/* Abas */}
          <div className="px-4 pt-2.5" role="tablist" aria-label="Seções do painel">
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-black/50 border border-zinc-800">
              {[['locais', 'Locais', visibleLms.length], ['comunidade', 'Comunidade', approved.length], ['visual', 'Visual', null]].map(([k, label, n]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`py-1.5 rounded-md text-xs font-semibold transition ${tab === k ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}>
                  {label}{n != null && <span className="ml-1 font-mono text-[10px] text-zinc-500">{n}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-3 overflow-y-auto min-h-0 flex-1" role="tabpanel">
            {tab === 'locais' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-white cursor-pointer select-none">
                    <input type="checkbox" checked={showLandmarks} onChange={(e) => setShowLandmarks(e.target.checked)} className="accent-cyan-400" />
                    Mostrar locais
                  </label>
                  <div className="flex gap-2 font-mono text-[10px]">
                    <button onClick={() => setLandmarkCats(Object.keys(BLIP_TYPES))} className="text-cyber hover:underline">todos</button>
                    <button onClick={() => setLandmarkCats([])} className="text-zinc-500 hover:underline">nenhum</button>
                  </div>
                </div>
                <div className={`space-y-3 ${showLandmarks ? '' : 'opacity-40 pointer-events-none'}`}>
                  {LM_GROUPS.map((g) => {
                    const types = g.types.filter((t) => lmCounts[t]);
                    if (!types.length) return null;
                    const onCount = types.filter((t) => landmarkCats.includes(t)).length;
                    const all = onCount === types.length;
                    const open = !collapsed.includes(g.id);
                    return (
                      <div key={g.id} className="rounded-lg border border-zinc-800/80 bg-black/20">
                        <div className="flex items-center gap-2 px-2 py-1.5">
                          <button onClick={() => setLandmarkCats((a) => (all ? a.filter((t) => !types.includes(t)) : [...new Set([...a, ...types])]))}
                            className={`w-4 h-4 shrink-0 rounded-[3px] border grid place-items-center text-[9px] ${onCount ? 'border-cyber bg-cyber/20 text-cyber' : 'border-zinc-600'}`}
                            aria-pressed={all} aria-label={`${all ? 'Esconder' : 'Mostrar'} todos de ${g.label}`}>{all ? '✓' : onCount ? '–' : ''}</button>
                          <button onClick={() => toggleGroup(g.id)} className="flex-1 flex items-center gap-2 text-left group" aria-expanded={open}>
                            <span className="font-mono text-[10px] tracking-widest text-zinc-300 group-hover:text-white">{g.label.toUpperCase()}</span>
                            {!open && (
                              <span className="flex -space-x-1">
                                {types.slice(0, 5).map((k) => <span key={k} className={landmarkCats.includes(k) ? '' : 'opacity-30'}><Blip type={k} size={14} /></span>)}
                              </span>
                            )}
                            <span className="ml-auto font-mono text-[10px] text-zinc-600">{types.reduce((n, t) => n + lmCounts[t], 0)}</span>
                            <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
                          </button>
                        </div>
                        {open && <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 px-1.5 pb-1.5">
                          {types.map((k) => {
                            const on = landmarkCats.includes(k);
                            return (
                              <button key={k} onClick={() => toggleLmCat(k)} aria-pressed={on}
                                className={`flex items-center gap-1.5 px-1 py-1 rounded text-left hover:bg-white/5 transition-opacity ${on ? '' : 'opacity-30'}`}>
                                <Blip type={k} size={18} />
                                <span className="text-xs text-zinc-200 truncate">{BLIP_TYPES[k].label}</span>
                                <span className="ml-auto font-mono text-[10px] text-zinc-600">{lmCounts[k]}</span>
                              </button>
                            );
                          })}
                        </div>}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
                  <span>Mais locais aparecem ao aproximar.</span>
                  <button onClick={() => { const all = LM_GROUPS.map((g) => g.id); const v = collapsed.length === all.length ? [] : all; setCollapsed(v); try { localStorage.setItem('lu-lm-collapsed', JSON.stringify(v)); } catch (e) { /* */ } }}
                    className="text-cyber hover:underline shrink-0">{collapsed.length === LM_GROUPS.length ? 'expandir todos' : 'recolher todos'}</button>
                </div>
              </div>
            )}

            {tab === 'comunidade' && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400">Descobertas enviadas pelos jogadores. <span className="text-white">Clique com o botão direito</span> (no celular, toque e segure) em qualquer ponto do mapa para sugerir um pin.</p>
                <div className="space-y-1">
                  {Object.entries(MARKER_CATS).map(([k, c]) => {
                    const on = activeCats.includes(k);
                    const n = approved.filter((m) => m.category === k).length;
                    return (
                      <button key={k} onClick={() => toggleCat(k)} aria-pressed={on}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md border transition ${on ? 'border-zinc-700 bg-white/[.03]' : 'border-transparent opacity-40'}`}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color, boxShadow: on ? `0 0 8px ${c.color}` : 'none' }} />
                        <span className="text-sm text-white">{c.label}</span>
                        {PIN_SPOILER[k] && spoil.hide[PIN_SPOILER[k]] && <span className="font-mono text-[9px] text-red-400 border border-red-400/40 rounded px-1">SPOILER</span>}
                        <span className="ml-auto font-mono text-[10px] text-zinc-500">{n}</span>
                      </button>
                    );
                  })}
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                  <input type="checkbox" checked={showPending} onChange={(e) => setShowPending(e.target.checked)} className="accent-pink-500" />
                  Mostrar pins aguardando aprovação ({pendingCount})
                </label>
              </div>
            )}

            {tab === 'visual' && (
              <div className="space-y-4">
                <div>
                  <p className="field-label !mb-1.5">Estilo do mapa</p>
                  <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Estilo do mapa">
                    {MAP_STYLES.map((st) => (
                      <button key={st.key} role="radio" aria-checked={mapStyle === st.key} onClick={() => setMapStyle(st.key)}
                        className={`rounded-lg border p-1.5 text-left transition ${mapStyle === st.key ? 'border-neon shadow-neon' : 'border-zinc-700 hover:border-zinc-500'}`}>
                        <span className="block h-9 rounded" style={{ background: st.swatch }} />
                        <span className="block mt-1 font-mono text-[10px] uppercase tracking-wider text-zinc-200">{st.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 p-3 cursor-pointer">
                  <span>
                    <span className="block text-sm text-white">Ímã nas regiões</span>
                    <span className="block text-xs text-zinc-400">Na visão geral, ao soltar o mapa ele se encaixa na região que está no centro. A região que vai "puxar" acende enquanto você arrasta.</span>
                  </span>
                  <button role="switch" aria-checked={magnet} onClick={() => setMagnet(!magnet)}
                    className={`relative shrink-0 mt-0.5 w-11 h-6 rounded-full border transition ${magnet ? 'bg-cyber/30 border-cyber' : 'bg-zinc-800 border-zinc-600'}`}>
                    <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white transition-all ${magnet ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </label>
                <div className="rounded-lg border border-zinc-800 p-3">
                  <p className="field-label !mb-1">Proteção contra spoilers</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-white">{spoil.label}</span>
                    <button onClick={onOpenSpoilers} className="font-mono text-[10px] text-cyber hover:underline">alterar</button>
                  </div>
                  {fogged.size > 0 && <p className="mt-1 text-xs text-zinc-400">Névoa ativa em {fogged.size} {fogged.size === 1 ? 'região' : 'regiões'}. Clique em "já explorei" sobre a região para revelar.</p>}
                </div>
              </div>
            )}
          </div>

          {/* Créditos (recolhíveis) */}
          <details className="px-4 py-2 border-t border-white/5 font-mono text-[10px] text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-300">ⓘ Créditos do mapa · CC BY 4.0</summary>
            <p className="mt-1.5 leading-relaxed">
              Mapa-base: Yanis GTA VI Community Map v17. Locais: GTADB.org e colaboradores. Ambos sob{' '}
              <a className="text-cyber hover:underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>
              {' '}via <a className="text-cyber hover:underline" href="https://map.gtadb.org" target="_blank" rel="noopener">map.gtadb.org</a>; recortado e com cores adaptadas. Reconstrução de fãs, não oficial.
            </p>
          </details>
        </div>
        )}
      </div>

      {!showMod && (
        <button onClick={() => setShowMod(true)} className="absolute top-3 right-3 z-[1050] glass-card px-3 py-2 inline-flex items-center gap-2 font-mono text-xs text-violet-200 hover:text-white">
          <IconShield className="w-4 h-4" /> Moderação
          <span className={`min-w-5 h-5 px-1 rounded-full grid place-items-center text-[10px] ${pendingCount ? 'bg-neon text-white' : 'bg-zinc-700 text-zinc-300'}`}>{pendingCount}</span>
        </button>
      )}
      {showMod && <ModerationDrawer markers={markers} onApprove={approve} onReject={reject} onClose={() => setShowMod(false)}
        regions={regions} landmarks={landmarks} game={game} onLocate={(m, safe) => { if (safe) return apiRef.current?.flyToSpot(m.coord_x, m.coord_y); setShowPending(true); setShowPins(true); apiRef.current?.flyToPin(m); }} />}

      {draft && <SuggestModal coords={draft} onCancel={() => setDraft(null)} onSubmit={submit} trusted={trustOf(game.prog.respect).id !== 'novato'}
        nearby={nearbyOf(draft)} onGoNearby={(n) => { setDraft(null); if (n.kind === 'pin') { const m = markers.find((x) => x.id === n.id); if (m) apiRef.current?.flyToPin(m); } else { const lm = landmarks.find((x) => x[0] === n.id); if (lm) apiRef.current?.flyToLandmark(lm); } }} />}
      {shareItem && <ShareModal item={shareItem} mapStyle={isDefaultMap ? mapStyle : 'original'} onClose={() => setShareItem(null)} />}

      {/* HUD da rádio: estação que "pega" no centro da tela */}
      {isDefaultMap && reception && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-[1040] pointer-events-auto">
          <div className="glass-card px-3 py-2 flex items-center gap-3" style={{ borderColor: `${STATION_BY_ID[player.autoTune ? reception.station : player.station.id].color}66` }}>
            <span className="relative grid place-items-center w-7 h-7">
              <span className="absolute inset-0 rounded-full border border-dashed opacity-60 animate-[spin_6s_linear_infinite]" style={{ borderColor: STATION_BY_ID[reception.station].color }} />
              <IconRadio className="w-4 h-4" style={{ color: STATION_BY_ID[reception.station].color }} />
            </span>
            <span className="leading-tight">
              <span className="block font-mono text-[10px] tracking-widest text-zinc-400">
                {player.autoTune ? 'SINAL NESTA REGIÃO' : 'SINTONIA MANUAL'}{reception.staticAmt > 0.25 ? ' · INTERFERÊNCIA' : ''}
              </span>
              <span className="block font-display uppercase text-lg text-white">
                {STATION_BY_ID[reception.station].freq} {STATION_BY_ID[reception.station].name}
              </span>
            </span>
            <SignalBars signal={reception.signal} color={STATION_BY_ID[reception.station].color} />
            <button onClick={() => player.setAutoTune(!player.autoTune)} aria-pressed={player.autoTune}
              className={`px-2 py-1 rounded font-mono text-[10px] border ${player.autoTune ? 'border-cyber text-cyber bg-cyber/10' : 'border-zinc-700 text-zinc-500'}`}>
              AUTO
            </button>
            {!player.playing && (
              <button onClick={player.toggle} disabled={!player.ready} className="play-btn !w-8 !h-8" aria-label="Tocar rádio">
                <IconPlay className="w-4 h-4 translate-x-px" />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Rádio                                                               */
/* ------------------------------------------------------------------ */

// O player muda de estado várias vezes por segundo (tempo da faixa); o mapa só precisa
// re-renderizar quando muda algo que ele mostra.
const samePlayer = (a, b) => a.station.id === b.station.id && a.track.id === b.track.id && a.playing === b.playing && a.ready === b.ready && a.autoTune === b.autoTune;
const MapPageMemo = React.memo(MapPage, (prev, next) => {
  for (const k of Object.keys(next)) {
    if (k === 'player') { if (!samePlayer(prev.player, next.player)) return false; }
    else if (prev[k] !== next[k]) return false;
  }
  return true;
});

/* --- Recepção por região: qual estação "pega" num ponto do mapa (metros) --- */
const STATION_BY_ID = Object.fromEntries(STATIONS.map((s) => [s.id, s]));

function computeReception(x, y, regions) {
  if (regions?.length) {
    const inside = regionAt(regions, x, y);
    if (inside) {
      // perto da divisa com uma região de OUTRA estação -> interferência
      const db = edgeDist(inside, x, y);
      let rival = null, dr = Infinity;
      for (const r of regions) if (r.station !== inside.station) { const d = edgeDist(r, x, y); if (d < dr) { dr = d; rival = r; } }
      const nearBorder = dr < 900 ? Math.max(0, 1 - db / 700) : 0;
      const staticAmt = Math.min(0.8, nearBorder * 0.75);
      return { station: inside.station, region: inside.id, rival: rival?.station, clear: db > 150, staticAmt, signal: 1 - staticAmt };
    }
    // no mar: estação da região mais próxima, sinal cai com a distância
    let best = null, d = Infinity;
    for (const r of regions) { const dd = edgeDist(r, x, y); if (dd < d) { d = dd; best = r; } }
    const staticAmt = Math.min(0.9, Math.max(0, (d - 300) / 2500));
    return { station: best.station, region: null, clear: d < 1200, staticAmt, signal: 1 - staticAmt };
  }
  const ranked = STATIONS.map((st) => ({
    id: st.id,
    d: Math.min(...st.anchors.map(([ax, ay]) => Math.hypot(ax - x, ay - y))),
  })).sort((a, b) => a.d - b.d);
  const [best, second] = ranked;
  const r = best.d / Math.max(second.d, 1);              // 1 = exatamente na divisa
  const overlap = r > 0.7 ? Math.min(1, (r - 0.7) / 0.3) : 0;
  const far = Math.min(1, Math.max(0, (best.d - 2500) / 3000)); // mar aberto / longe das antenas
  const staticAmt = Math.min(1, Math.max(overlap * 0.85, far * 0.9));
  return { station: best.id, rival: second.id, clear: r < 0.9, staticAmt, signal: 1 - staticAmt };
}

function SignalBars({ signal, color = '#00f0ff', className = '' }) {
  const n = signal > 0.8 ? 4 : signal > 0.55 ? 3 : signal > 0.3 ? 2 : 1;
  return (
    <span className={`inline-flex items-end gap-[2px] h-3 ${className}`} title={`Sinal ${Math.round(signal * 100)}%`} aria-label={`Sinal ${Math.round(signal * 100)}%`}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className="w-[3px] rounded-[1px] transition-colors" style={{ height: `${i * 25}%`, background: i <= n ? color : '#3f3f46' }} />
      ))}
    </span>
  );
}

function Equalizer({ playing, bars = 5, className = '' }) {
  return (
    <div className={`eq ${playing ? 'eq--on' : ''} ${className}`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} style={{ animationDelay: `${(i * 137) % 600 - 600}ms`, animationDuration: `${520 + ((i * 211) % 420)}ms` }} />
      ))}
    </div>
  );
}

/* Aviso de troca de estação, como no GTA */
function StationFlash({ flash }) {
  if (!flash) return null;
  const st = STATION_BY_ID[flash.id];
  return (
    <div key={flash.key} className="fixed inset-x-0 top-20 z-[2500] flex justify-center pointer-events-none" role="status" aria-live="polite">
      <div className="station-flash text-center px-10 py-3 bg-gradient-to-r from-transparent via-black/85 to-transparent">
        <div className="font-mono text-xs tracking-[0.4em]" style={{ color: st.color }}>{flash.auto ? 'SINTONIA AUTOMÁTICA · ' : ''}{st.freq} FM</div>
        <div className="font-display uppercase text-4xl md:text-5xl text-white" style={{ textShadow: `0 0 18px ${st.color}` }}>{st.name}</div>
        <div className="font-mono text-[11px] text-zinc-300 tracking-widest">{st.genre.toUpperCase()} · {st.region.toUpperCase()}</div>
      </div>
    </div>
  );
}

const artistOf = (t) => t.artist || 'Autor não informado';

/* --- Grade de programação --- */
const SHOW_KIND = { musica: 'Música', falado: 'Programa falado', comunidade: 'Comunidade no ar' };

function ScheduleGrid({ player }) {
  const now = useNow(30000);
  const h = hourOf(now);
  const { station, listenLive } = player;
  const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  return (
    <div className="glass-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-400">
          <span className="inline-flex items-center gap-1.5"><span className="w-4 h-2.5 rounded-sm bg-zinc-500/50 border border-zinc-400" /> Música</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-4 h-2.5 rounded-sm bg-zinc-500/50 border border-zinc-400 sched-block--falado" /> Falado</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-4 h-2.5 rounded-sm border border-dashed border-zinc-400" /> Comunidade</span>
        </div>
        <p className="font-mono text-[10px] text-zinc-500">Horário de Leonida (o seu relógio) · agora {fmtH(h)}{String(Math.floor((h % 1) * 60)).padStart(2, '0')}</p>
      </div>
      <div className="overflow-x-auto overflow-y-hidden -mx-1 px-1 py-1">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[132px_1fr] gap-2">
            <div />
            <div className="relative h-5">
              {ticks.map((t) => (
                <span key={t} className="absolute -translate-x-1/2 font-mono text-[10px] text-zinc-500" style={{ left: `${(t / 24) * 100}%` }}>{t === 24 ? '' : fmtH(t)}</span>
              ))}
            </div>
            {STATIONS.map((st) => {
              const cur = showAt(st, h);
              const on = st.id === station.id;
              return (
                <React.Fragment key={st.id}>
                  <button onClick={() => listenLive(st.id)} className={`text-left rounded-md px-2 py-1 border transition ${on ? 'bg-white/5' : 'border-transparent hover:bg-white/5'}`} style={{ borderColor: on ? `${st.color}88` : undefined }}
                    aria-label={`Ouvir ${st.name} ao vivo`}>
                    <span className="block font-mono text-[10px]" style={{ color: st.color }}>{st.freq} FM</span>
                    <span className="block text-sm font-semibold text-white truncate">{st.name}</span>
                  </button>
                  <div className="relative h-12 rounded-md bg-black/30 border border-white/5">
                    {ticks.slice(1, -1).map((t) => <span key={t} className="absolute top-0 bottom-0 w-px bg-white/5" style={{ left: `${(t / 24) * 100}%` }} />)}
                    {st.shows.map((sh) => {
                      const live = sh === cur;
                      return (
                        <button key={sh.start} onClick={() => listenLive(st.id)}
                          className={`sched-block sched-block--${sh.kind} ${live ? 'z-10' : ''}`}
                          style={{
                            left: `calc(${(sh.start / 24) * 100}% + 2px)`, width: `calc(${((sh.end - sh.start) / 24) * 100}% - 4px)`,
                            background: live ? `${st.color}33` : `${st.color}12`, borderColor: live ? st.color : `${st.color}40`,
                            boxShadow: live ? `0 0 16px -4px ${st.color}` : undefined,
                          }}
                          title={`${fmtH(sh.start)}–${fmtH(sh.end)} · ${sh.name} · ${sh.host} · ${SHOW_KIND[sh.kind]}${sh.kind === 'musica' ? ` · clima ${MOODS[showMood(sh)].toLowerCase()}` : ''}`}
                          aria-label={`${sh.name}, das ${fmtH(sh.start)} às ${fmtH(sh.end)}, com ${sh.host}${live ? ', no ar agora' : ''}`}>
                          <span className="block text-[11px] font-semibold text-white truncate leading-tight">{live && <span className="text-[9px] font-mono mr-1 px-1 rounded bg-red-500 text-white">AO VIVO</span>}{sh.name}</span>
                          <span className="block font-mono text-[9px] text-zinc-400 truncate">{fmtH(sh.start)}–{fmtH(sh.end)} · {sh.host}</span>
                        </button>
                      );
                    })}
                    <span className="absolute -top-1 -bottom-1 w-0.5 bg-red-500 z-20 pointer-events-none shadow-[0_0_8px_#ef4444]" style={{ left: `${(h / 24) * 100}%` }} aria-hidden="true" />
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RadioPage({ player }) {
  const { station, track, playing, ready, toggle, playTrack, autoTune, setAutoTune, urls, live, onAir, backToLive, listenLive, voiceOn, setVoiceOn } = player;
  const now = useNow(30000);
  const h = hourOf(now);
  const show = showAt(station, h), upNext = nextShow(station, h);
  const [shareItem, setShareItem] = useState(null);
  const openShare = () => setShareItem({
    kind: 'radio', title: `${track.title} · ${station.name}`, station, track, show,
    link: `${PUBLIC_BASE}#radio-${station.id}`,
  });
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="glass-card overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 80% 50%, ${station.color}33, transparent 60%)` }} />
        <div className="relative p-6 md:p-10 grid md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <p className="font-mono text-xs tracking-[0.35em] text-sunset">// {station.freq} FM · {station.genre.toUpperCase()}</p>
            <h1 className="font-display uppercase text-6xl md:text-7xl leading-[0.9] text-white mt-1">
              Rádio Estrela<span className="text-neon glow-pink">6</span>
            </h1>
            <div className="mt-6">
              <p className="font-mono text-[11px] text-zinc-500">TOCANDO AGORA EM <span style={{ color: station.color }}>{station.name.toUpperCase()}</span></p>
              <p className="font-display uppercase text-3xl text-cyber glow-cyan">{track.title}</p>
              <p className="text-zinc-400">de {artistOf(track)} <span className="text-zinc-600">·</span> com {track.host_name}</p>
              <p className="mt-2 font-mono text-[11px] text-zinc-400">
                <span className="px-1 rounded bg-red-500 text-white text-[9px] mr-1.5">NO AR</span>{show.name} · até {fmtH(show.end)}
                {show.kind === 'musica' && <span className="text-zinc-500"> · clima {MOODS[showMood(show)].toLowerCase()}</span>}
                <span className="text-zinc-600 mx-2">|</span>A SEGUIR: <span className="text-zinc-300">{fmtH(upNext.start)} {upNext.name}</span>
              </p>
              <p className="mt-1 font-mono text-[11px]">
                {live
                  ? <span className="text-red-400 inline-flex items-center gap-1.5"><span className="onair-dot" />AO VIVO · você ouve o mesmo que todo mundo, no ponto da grade</span>
                  : <span className="text-zinc-400">SOB DEMANDA · <button onClick={backToLive} className="text-red-400 underline underline-offset-2 hover:text-red-300">voltar ao vivo</button></span>}
              </p>
              {onAir && (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 max-w-xl" aria-live="polite">
                  <p className="font-mono text-[10px] tracking-widest text-red-400 flex items-center gap-1.5"><span className="onair-dot" />{onAir.title.toUpperCase()} · {onAir.host.toUpperCase()}</p>
                  <p className="text-sm text-zinc-200 mt-1">{onAir.text}</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={toggle} disabled={!ready} className="btn-neon inline-flex items-center gap-2 disabled:opacity-50">
                {playing ? <IconPause className="w-4 h-4" /> : <IconPlay className="w-4 h-4" />}
                {!ready ? 'Sintonizando…' : playing ? 'Pausar' : live ? 'Ouvir ao vivo' : 'Ouvir agora'}
              </button>
              <button onClick={openShare} className="btn-ghost inline-flex items-center gap-2" title="Gerar cartão &quot;Tocando agora&quot;">
                <ShareIcon className="w-4 h-4" /> Compartilhar
              </button>
              <a href="#mapa" className="btn-ghost inline-flex items-center gap-2"><IconPin className="w-4 h-4" /> Sintonizar pelo mapa</a>
            </div>
          </div>
          <div className="flex items-end justify-center h-40 md:h-52">
            <Equalizer playing={playing} bars={14} className="eq--big" />
          </div>
        </div>
      </div>

      <div className="mt-8 glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="font-semibold text-white">Sintonia automática pelo mapa</p>
          <p className="text-sm text-zinc-400">No Mapa Interativo, a estação muda conforme a região que você está vendo. Entre regiões o sinal chia.</p>
        </div>
        <button role="switch" aria-checked={autoTune} onClick={() => setAutoTune(!autoTune)}
          className={`relative shrink-0 w-14 h-7 rounded-full border transition ${autoTune ? 'bg-neon/30 border-neon' : 'bg-zinc-800 border-zinc-600'}`}>
          <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${autoTune ? 'left-7 shadow-neon' : 'left-0.5'}`} />
        </button>
      </div>

      <div className="mt-3 glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="font-semibold text-white">Locução entre as músicas</p>
          <p className="text-sm text-zinc-400">Em inglês, como nas rádios de GTA: DJs, comerciais falsos, previsão do tempo, o <span className="text-zinc-200">Six Star News</span> nos programas falados e recados nos da comunidade. Entra no começo de cada faixa; para ouvir agora, use os botões. O noticiário já é gravado (voz neural); DJs, comerciais e tempo ainda usam a voz do navegador.</p>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          {[['banter', 'DJ'], ['ad', 'Comercial'], ['weather', 'Tempo'], ['news', 'News'], ['recado', 'Recado']].map(([k, l]) => (
            <button key={k} onClick={() => player.announceNow(k)} className="font-mono text-[10px] px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:border-neon hover:text-neon">▶ {l}</button>
          ))}
        </div>
        <button role="switch" aria-checked={voiceOn} onClick={() => setVoiceOn(!voiceOn)} aria-label="Locução entre as músicas"
          className={`relative shrink-0 w-14 h-7 rounded-full border transition ${voiceOn ? 'bg-neon/30 border-neon' : 'bg-zinc-800 border-zinc-600'}`}>
          <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all ${voiceOn ? 'left-7 shadow-neon' : 'left-0.5'}`} />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px] text-zinc-500" aria-live="polite">
        <span className="text-emerald-300">🎙 Six Star News gravado com voz neural: {Object.values(NEWS).reduce((n, l) => n + l.length, 0)} boletins (botão ▶ News ou nos programas falados)</span>
        <button onClick={player.testVoice} className="px-2 py-1 rounded border border-cyan-400/40 text-cyber hover:bg-cyan-400/10">🔊 Testar voz do navegador</button>
        {!player.tts.supported ? <span className="text-red-300">Este navegador não tem síntese de voz. Só as legendas vão aparecer.</span> : <>
          <span>Vozes em inglês: <span className={player.tts.voices ? 'text-zinc-300' : 'text-amber-300'}>{player.tts.voices}</span></span>
          <span className="truncate max-w-[22rem]">Voz: <span className="text-zinc-300">{player.tts.voice || 'padrão do sistema (en-US)'}</span></span>
          {player.tts.speaking && <span className="text-emerald-300">falando…</span>}
          {player.tts.error && <span className="text-red-300">Erro: {player.tts.error}. {player.tts.error === 'not-allowed' ? 'Clique em Testar voz para liberar o áudio.' : 'No Windows, instale uma voz em inglês em Configurações › Hora e idioma › Fala.'}</span>}
          {!player.tts.voices && <span className="text-amber-300">Sem voz em inglês instalada: o navegador vai tentar a voz padrão.</span>}
        </>}
      </div>

      <h2 className="font-display uppercase text-2xl text-white mt-10 mb-1">Grade de programação</h2>
      <p className="text-sm text-zinc-400 mb-3">A grade manda no que toca: madrugada mais calma, tarde mais agitada, boletins nos programas falados e recados nos da comunidade. Clique numa estação para ouvir ao vivo.</p>
      <ScheduleGrid player={player} />

      <h2 className="font-display uppercase text-2xl text-white mt-10 mb-3">Estações</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {STATIONS.map((st) => {
          const on = st.id === station.id;
          const cur = showAt(st, h), nx = nextShow(st, h);
          return (
            <div key={st.id} className={`glass-card p-4 ${on ? 'shadow-neon' : ''}`} style={{ borderColor: on ? st.color : undefined }}>
              <div className="flex items-baseline justify-between">
                <p className="font-mono text-xs" style={{ color: st.color }}>{st.freq} FM</p>
                {on && playing && <Equalizer playing bars={3} />}
              </div>
              <p className="font-display uppercase text-2xl text-white leading-tight">{st.name}</p>
              <p className="text-xs text-zinc-400 mb-2">{st.genre} · {st.region}</p>
              <div className="mb-3 rounded-md bg-black/30 border border-white/5 px-2 py-1.5 font-mono text-[10px] leading-relaxed">
                <p className="text-zinc-300 truncate"><span className="text-red-400">● NO AR</span> {cur.name} <span className="text-zinc-500">até {fmtH(cur.end)}</span></p>
                <p className="text-zinc-500 truncate">A SEGUIR {fmtH(nx.start)} · {nx.name}</p>
              </div>
              <div className="flex items-center justify-between mb-1">
                <p className="font-mono text-[10px] text-zinc-500">{st.tracks.length} faixas · {Math.round(st.tracks.reduce((a, t) => a + t.duration_seconds, 0) / 60)} min</p>
                <button onClick={() => listenLive(st.id)} className="font-mono text-[10px] px-2 py-0.5 rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 inline-flex items-center gap-1.5"><span className="onair-dot" />OUVIR AO VIVO</button>
              </div>
              <ol className="space-y-1 max-h-64 overflow-y-auto pr-1 -mr-1 lu-scroll" style={{ "--sb": st.color }}>
                {st.tracks.filter((t) => t.is_active).map((tr, i) => {
                  const active = on && tr.id === track.id;
                  return (
                    <li key={tr.id}>
                      <button onClick={() => playTrack(st.id, i)} disabled={!urls[tr.id]}
                        className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-left hover:bg-white/5 disabled:opacity-40 ${active ? 'bg-white/5' : ''}`}>
                        <span className="w-5 grid place-items-center">
                          {active && playing ? <Equalizer playing bars={3} /> : <IconPlay className="w-3.5 h-3.5" style={{ color: active ? st.color : '#71717a' }} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold truncate" style={{ color: active ? st.color : '#fff' }}>{tr.title}</span>
                          <span className="block text-[11px] text-zinc-500 truncate">{artistOf(tr)}</span>
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500">{urls[tr.id] ? fmtTime(tr.duration_seconds) : '…'}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
      <h2 className="font-display uppercase text-2xl text-white mt-10 mb-3">Créditos das músicas</h2>
      <div className="glass-card p-4">
        <p className="text-sm text-zinc-400 mb-3">
          Todas as faixas estão em <span className="text-white">domínio público (CC0 1.0)</span> e vêm do <a href="https://freepd.com" target="_blank" rel="noopener noreferrer" className="text-cyber underline underline-offset-2">FreePD.com</a> e do <a href="https://freemusicarchive.org" target="_blank" rel="noopener noreferrer" className="text-cyber underline underline-offset-2">Free Music Archive</a>.
          O CC0 não exige crédito, mas creditamos os autores mesmo assim.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
          {STATIONS.flatMap((st) => st.tracks.map((tr) => (
            <p key={tr.id} className="font-mono text-[11px] text-zinc-400 truncate" title={`${tr.title} — ${artistOf(tr)} · ${tr.license}`}>
              <span style={{ color: st.color }}>{st.freq}</span> <span className="text-zinc-200">{tr.title}</span> — {tr.source_url ? <a href={tr.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-cyber hover:underline">{artistOf(tr)}</a> : artistOf(tr)}
            </p>
          )))}
        </div>
        <p className="mt-3 font-mono text-[10px] text-zinc-500">
          No Laravel: <code>radio_tracks</code> guarda <code>audio_url</code>, <code>artist</code>, <code>license</code> e <code>source_url</code>, e esta lista é gerada automaticamente.
        </p>
      </div>
      {shareItem && <ShareModal item={shareItem} onClose={() => setShareItem(null)} />}
    </section>
  );
}

const ShareIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);

/* Player persistente — no Laravel ele fica dentro de @persist('radio-player') */
function RadioPlayer({ player }) {
  const { station, track, playing, ready, time, duration, volume, muted, toggle, next, prev, seek, setVolume, setMuted, autoTune, setAutoTune, signal, live, onAir, backToLive } = player;
  const pct = duration ? (time / duration) * 100 : 0;
  const volPct = muted ? 0 : volume * 100;
  return (
    <footer className="fixed bottom-0 inset-x-0 z-[1000] border-t border-pink-500/30 bg-vc-panel/90 backdrop-blur-md shadow-[0_-10px_40px_-15px_#ff007f]">
      <div className="absolute inset-x-0 -top-px h-px" style={{ background: `linear-gradient(to right, transparent, ${station.color}, transparent)` }} />
      <div className="mx-auto max-w-7xl px-4 h-20 md:h-[4.5rem] grid grid-cols-[1fr_auto] md:grid-cols-[1fr_minmax(0,1.4fr)_1fr] items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 shrink-0 rounded-md bg-gradient-to-br from-deep to-black border grid place-items-center" style={{ borderColor: `${station.color}88` }}>
            <Equalizer playing={playing} bars={4} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.2em] flex items-center gap-2" style={{ color: station.color }}>
              <span className="truncate">{station.freq} · {station.name.toUpperCase()}</span>
              <SignalBars signal={signal} color={station.color} />
            </p>
            {onAir ? (
              <div className="min-w-0 max-w-[60vw] md:max-w-[24rem]" aria-live="polite">
                <p className="font-semibold text-white truncate flex items-center gap-1.5"><span className="onair-dot" />{onAir.title}</p>
                <div className="caption-marquee text-xs text-zinc-300"><span key={onAir.key}>{onAir.text}</span></div>
              </div>
            ) : (
              <>
                <p className="font-semibold text-white truncate">{ready ? track.title : 'Sintonizando…'}</p>
                <p className="text-xs text-zinc-400 truncate">{artistOf(track)}</p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <button onClick={prev} disabled={!ready} className="icon-btn" aria-label="Faixa anterior"><IconPrev className="w-4 h-4" /></button>
            <button onClick={toggle} disabled={!ready} className="play-btn" aria-label={playing ? 'Pausar' : 'Tocar'}>
              {playing ? <IconPause className="w-5 h-5" /> : <IconPlay className="w-5 h-5 translate-x-px" />}
            </button>
            <button onClick={next} disabled={!ready} className="icon-btn" aria-label="Próxima faixa"><IconNext className="w-4 h-4" /></button>
          </div>
          <div className="hidden md:flex items-center gap-2 w-full font-mono text-[10px] text-zinc-500">
            <span className="w-8 text-right">{fmtTime(time)}</span>
            <input type="range" min="0" max={duration || 0} step="0.1" value={time} onChange={(e) => seek(+e.target.value)}
              className="neon-range flex-1" style={{ '--p': `${pct}%` }} aria-label="Progresso" disabled={!ready} />
            <span className="w-8">{fmtTime(duration)}</span>
          </div>
        </div>

        <div className="hidden md:flex items-center justify-end gap-2">
          {live ? (
            <span className="px-2 py-1 rounded font-mono text-[10px] tracking-wider border border-red-500/60 text-red-400 bg-red-500/10 inline-flex items-center gap-1.5" title="Você está ouvindo o mesmo que todo mundo, no horário da grade">
              <span className="onair-dot" />AO VIVO
            </span>
          ) : (
            <button onClick={backToLive} className="px-2 py-1 rounded font-mono text-[10px] tracking-wider border border-zinc-600 text-zinc-300 hover:border-red-500 hover:text-red-400 transition" title="Voltar para o que está no ar agora">
              ↺ VOLTAR AO VIVO
            </button>
          )}
          <button onClick={() => setAutoTune(!autoTune)} aria-pressed={autoTune} title="Sintonia automática pelo mapa"
            className={`px-2 py-1 rounded font-mono text-[10px] tracking-wider border transition ${autoTune ? 'border-cyber text-cyber bg-cyber/10' : 'border-zinc-700 text-zinc-500'}`}>
            AUTO
          </button>
          <button onClick={() => setMuted(!muted)} className="icon-btn" aria-label={muted ? 'Ativar som' : 'Silenciar'}>
            {muted || volume === 0 ? <IconMute className="w-4 h-4" /> : <IconVolume className="w-4 h-4" />}
          </button>
          <input type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume}
            onChange={(e) => { setVolume(+e.target.value); if (muted) setMuted(false); }}
            className="neon-range neon-range--cyan w-24" style={{ '--p': `${volPct}%` }} aria-label="Volume" />
        </div>
      </div>
      <div className="md:hidden absolute top-0 inset-x-0 h-0.5 bg-zinc-800"><div className="h-full" style={{ width: `${pct}%`, background: station.color }} /></div>
    </footer>
  );
}

function usePlayer() {
  const audioRef = useRef(null);
  if (!audioRef.current && typeof Audio !== 'undefined') audioRef.current = new Audio();
  const [urls, setUrls] = useState({});
  const [stationId, setStationId] = useState('neon');
  const [trackIdx, setTrackIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(STATIONS[0].tracks[0].duration_seconds);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [autoTune, setAutoTune] = useState(true);
  const [signal, setSignal] = useState(1);
  const [flash, setFlash] = useState(null);
  // ao vivo: posição calculada pelo relógio (todo mundo ouve o mesmo); false = ouvindo sob demanda
  const [live, setLiveState] = useState(true);
  const [voiceOn, setVoiceOnState] = useState(() => { try { return localStorage.getItem('lu-voice') !== 'off'; } catch (e) { return true; } });
  const [onAir, setOnAir] = useState(null);      // locução no ar: { kind, title, text, host }

  const liveRef = useRef(live); liveRef.current = live;
  const voiceRef = useRef(voiceOn); voiceRef.current = voiceOn;
  const duckRef = useRef(false);
  const scriptRef = useRef(null);                // App injeta o gerador de textos (usa feed, mapa, ranking)
  const speakTimer = useRef(null);
  const setLive = (v) => { liveRef.current = v; setLiveState(v); };
  const setVoiceOn = (v) => { setVoiceOnState(v); voiceRef.current = v; try { localStorage.setItem('lu-voice', v ? 'on' : 'off'); } catch (e) { /* sem storage */ } if (!v) stopSpeech(); };

  const urlsRef = useRef(urls); urlsRef.current = urls;
  const volRef = useRef({ volume, muted }); volRef.current = { volume, muted };
  const stRef = useRef(stationId); stRef.current = stationId;
  const idxRef = useRef(trackIdx); idxRef.current = trackIdx;
  const graph = useRef(null);
  const staticRef = useRef(0);
  const pendingPlay = useRef(false);
  const switchTimer = useRef(null);
  const flashTimer = useRef(null);

  const station = STATION_BY_ID[stationId];
  const track = station.tracks[trackIdx] || station.tracks[0];
  const ready = !!urls[track.id];

  // Pré-renderiza: 1ª faixa de cada estação primeiro
  useEffect(() => {
    let alive = true;
    (async () => {
      const order = [...STATIONS.map((s) => s.tracks[0]), ...STATIONS.flatMap((s) => s.tracks.slice(1))];
      // faixas com arquivo (audio_url) ficam prontas na hora; o navegador baixa só quando tocar
      const files = Object.fromEntries(order.filter((t) => t.audio_url).map((t) => [t.id, t.audio_url]));
      setUrls((u) => ({ ...u, ...files }));
      for (const t of order) {
        if (t.audio_url) continue;
        try {
          const url = await renderTrack(t);
          if (alive) setUrls((u) => ({ ...u, [t.id]: url }));
        } catch (e) { console.error(e); }
      }
    })();
    return () => { alive = false; };
  }, []);

  // Grafo de áudio: música + chiado (só cria no primeiro play, que é um gesto do usuário)
  const ensureGraph = () => {
    if (graph.current) { graph.current.ctx?.resume?.(); return graph.current; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(audioRef.current);
      const music = ctx.createGain();
      const master = ctx.createGain();
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = makeNoiseBuffer(ctx);
      noiseSrc.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.6;
      const noise = ctx.createGain(); noise.gain.value = 0;
      src.connect(music); music.connect(master);
      noiseSrc.connect(bp); bp.connect(noise); noise.connect(master);
      master.connect(ctx.destination);
      noiseSrc.start();
      graph.current = { ctx, music, noise, master };
    } catch (e) {
      console.warn('Web Audio indisponível, sem chiado', e);
      graph.current = { fallback: true };
    }
    applyLevels();
    return graph.current;
  };

  const applyLevels = (burst = false) => {
    const g = graph.current, a = audioRef.current;
    const vol = volRef.current.muted ? 0 : volRef.current.volume;
    if (!g || g.fallback) { a.volume = vol; return; }
    a.volume = 1;
    const now = g.ctx.currentTime, s = staticRef.current, live = !a.paused;
    g.master.gain.setTargetAtTime(vol, now, 0.05);
    if (burst) {
      g.noise.gain.cancelScheduledValues(now);
      g.noise.gain.setValueAtTime(0.5, now);
      g.noise.gain.setTargetAtTime(live && s >= 0.15 ? ((s - 0.15) / 0.85) * 0.2 : 0, now + 0.35, 0.2);
      g.music.gain.cancelScheduledValues(now);
      g.music.gain.setValueAtTime(0.15, now);
      g.music.gain.setTargetAtTime((1 - s * 0.6) * (duckRef.current ? 0.22 : 1), now + 0.35, 0.15);
    } else {
      // zona morta: sinal bom não chia; transições lentas evitam "pipocar"
      const n = s < 0.15 ? 0 : ((s - 0.15) / 0.85) * 0.2;
      g.noise.gain.setTargetAtTime(live ? n : 0, now, 0.35);
      g.music.gain.setTargetAtTime((1 - s * 0.5) * (duckRef.current ? 0.22 : 1), now, duckRef.current ? 0.12 : 0.35);
    }
  };

  // ---- Locução: vinheta / boletim / recado, falados por cima do começo da faixa (música abaixa)
  const duck = (on) => {
    duckRef.current = on;
    const g = graph.current;
    if (g?.fallback) audioRef.current.volume = (volRef.current.muted ? 0 : volRef.current.volume) * (on ? 0.25 : 1);
    applyLevels();
  };
  const stopSpeech = () => {
    clearTimeout(speakTimer.current);
    try { bulletinRef.current?.pause(); } catch (e) { /* ok */ }
    try { window.speechSynthesis?.cancel(); } catch (e) { /* sem TTS */ }
    duck(false); setOnAir(null);
  };
  // assinatura sonora curta da estação (3 notas) antes da voz
  const sting = (st) => {
    const g = graph.current;
    if (!g || g.fallback) return;
    const ctx = g.ctx, t0 = ctx.currentTime + 0.02;
    const base = { neon: 440, kalaga: 392, gulf: 330, swamp: 294, keys: 523 }[st.id] || 440;
    const wave = { neon: 'sawtooth', kalaga: 'triangle', gulf: 'square', swamp: 'sine', keys: 'triangle' }[st.id] || 'sine';
    [0, 4, 7].forEach((semi, i) => {
      const o = ctx.createOscillator(), gn = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = wave; o.frequency.value = base * Math.pow(2, semi / 12);
      lp.type = 'lowpass'; lp.frequency.value = 2400;
      const t = t0 + i * 0.12;
      gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(0.09, t + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(lp); lp.connect(gn); gn.connect(g.master); o.start(t); o.stop(t + 0.5);
    });
  };
  // ---- Vozes do navegador: carregam de forma assíncrona (getVoices() começa vazio no Chrome)
  const [tts, setTts] = useState({ supported: typeof window !== 'undefined' && 'speechSynthesis' in window, voices: 0, voice: null, error: null, speaking: false });
  const badVoices = useRef(new Set());
  useEffect(() => {
    const synth = window.speechSynthesis; if (!synth) return;
    const upd = () => { const v = pickVoice(); setTts((t) => ({ ...t, voices: (synth.getVoices() || []).filter((x) => /^en/i.test(x.lang)).length, voice: v ? `${v.name} (${v.lang}${v.localService ? ', local' : ', online'})` : null })); };
    upd(); synth.addEventListener?.('voiceschanged', upd);
    const t = setTimeout(upd, 1200);
    return () => { synth.removeEventListener?.('voiceschanged', upd); clearTimeout(t); };
  }, []);
  const pickVoice = () => {
    const vs = (window.speechSynthesis?.getVoices?.() || []).filter((v) => !badVoices.current.has(v.name));
    const en = vs.filter((v) => /^en/i.test(v.lang || ''));
    // vozes locais primeiro: as "online" (Google/Microsoft Online) dependem de rede e às vezes falham dentro de iframes
    const local = en.filter((v) => v.localService);
    return local.find((v) => /en[-_]US/i.test(v.lang)) || local[0] || en.find((v) => /en[-_]US/i.test(v.lang)) || en[0] || null;
  };
  // fala em pedaços curtos (o Chrome corta falas longas perto de 15 s) e troca de voz se der erro
  const speakChunks = (text, hv, onDone) => {
    const synth = window.speechSynthesis;
    const parts = (text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text]).map((x) => x.trim()).filter(Boolean);
    let i = 0, retried = false;
    const next = () => {
      if (i >= parts.length) { setTts((t) => ({ ...t, speaking: false })); return onDone(); }
      const u = new SpeechSynthesisUtterance(parts[i]);
      const v = pickVoice();
      if (v) u.voice = v;
      u.lang = v?.lang || 'en-US'; u.pitch = hv.pitch ?? 1; u.rate = hv.rate ?? 1; u.volume = 1;
      u.onend = () => { i += 1; next(); };
      u.onerror = (e) => {
        const err = e?.error || 'erro';
        if (err === 'interrupted' || err === 'canceled') return;     // cancelado por nós
        if (v && !retried) { badVoices.current.add(v.name); retried = true; return next(); }   // tenta outra voz
        setTts((t) => ({ ...t, error: err, speaking: false })); onDone();
      };
      try { synth.resume(); synth.speak(u); setTts((t) => ({ ...t, speaking: true, error: null })); } catch (er) { setTts((t) => ({ ...t, error: String(er) })); onDone(); }
    };
    next();
  };
  const testVoice = () => {     // chamado direto no clique: conta como gesto do usuário
    const synth = window.speechSynthesis;
    if (!synth) return setTts((t) => ({ ...t, error: 'Este navegador não tem síntese de voz' }));
    synth.cancel();
    speakChunks('Radio check. You are listening to Six Star radio. If you can hear me, the hosts are working.', {}, () => {});
  };
  // boletins gravados (MP3 gerados com voz neural): tocam por cima da música, que abaixa
  const bulletinRef = useRef(null);
  const playBulletin = (st) => {
    const list = NEWS[st.id]; if (!list?.length) return false;
    const n = Math.floor(Date.now() / 3600000) % list.length;
    const b = list[(n + (bulletinRef.current?._turn || 0)) % list.length];
    if (!bulletinRef.current) bulletinRef.current = new Audio();
    const a = bulletinRef.current; a._turn = (a._turn || 0) + 1;
    try { window.speechSynthesis?.cancel(); } catch (e) { /* ok */ }
    let ended = false;
    const end = () => { if (ended) return; ended = true; clearTimeout(speakTimer.current); duck(false); speakTimer.current = setTimeout(() => setOnAir(null), 900); };
    setOnAir({ kind: 'news', title: `Six Star News · ${b.title}`, host: 'gravado', text: b.transcript.map((t) => t.text).join(' '), key: Date.now(), recorded: true });
    a.onended = end; a.onerror = () => { end(); setTts((t) => ({ ...t, error: 'boletim não carregou' })); };
    a.src = b.url; a.volume = volRef.current.muted ? 0 : Math.min(1, volRef.current.volume * 1.15);
    duck(true);
    a.play().catch(end);
    speakTimer.current = setTimeout(end, (b.duration + 6) * 1000);
    return true;
  };
  const announce = (stId, track, nextTrack, show, force) => {
    const st = STATION_BY_ID[stId];
    if (voiceRef.current && (force === 'news' || (!force && show?.kind === 'falado' && Math.random() < 0.5)) && playBulletin(st)) return;
    const seg = scriptRef.current?.({ station: st, show, track, next: nextTrack, force });
    if (!seg) return;
    clearTimeout(speakTimer.current);
    setOnAir({ ...seg, key: Date.now() });
    const words = seg.text.split(/\s+/).length;
    const est = Math.max(5, words / 2.6) * 1000;
    const synth = window.speechSynthesis;
    let ended = false;
    const end = () => { if (ended) return; ended = true; clearTimeout(speakTimer.current); duck(false); speakTimer.current = setTimeout(() => setOnAir(null), 900); };
    if (!voiceRef.current || !synth) {      // voz desligada ou navegador sem TTS: só a legenda
      speakTimer.current = setTimeout(() => setOnAir(null), est);
      return;
    }
    duck(true); sting(st);
    try { synth.cancel(); } catch (e) { /* ok */ }
    setTimeout(() => speakChunks(seg.text, HOST_VOICE[seg.host] || {}, end), 450);
    speakTimer.current = setTimeout(end, est * 2 + 4000);   // garantia, caso o navegador não avise o fim
  };
  useEffect(() => { applyLevels(); }, [volume, muted, playing]);

  useEffect(() => {
    const a = audioRef.current;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => setDuration(a.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      const st = STATION_BY_ID[stRef.current];
      if (liveRef.current) return goLive(stRef.current, true, { fromEnded: true });
      load(stRef.current, (idxRef.current + 1) % st.tracks.length, true);
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
    };
  }, []);

  // Faixa pedida ainda estava sendo gerada: toca assim que ficar pronta
  useEffect(() => {
    const t = STATION_BY_ID[stationId].tracks[trackIdx];
    if (pendingPlay.current && urls[t.id]) {
      pendingPlay.current = false;
      load(stationId, trackIdx, true);
    }
  }, [urls, stationId, trackIdx]);

  function load(stId, i, autoplay, offset = 0) {
    const a = audioRef.current;
    const t = STATION_BY_ID[stId].tracks[i];
    setStationId(stId); setTrackIdx(i); setTime(offset); setDuration(t.duration_seconds);
    stRef.current = stId; idxRef.current = i;
    const url = urlsRef.current[t.id];
    if (!url) { a.pause(); pendingPlay.current = autoplay; return; }
    a.src = url;
    if (offset > 0.5) {
      // pula para o ponto "ao vivo"; se o servidor não deixar pular ainda, tenta de novo quando carregar mais
      const t0 = performance.now();
      const target = () => Math.min(offset + (performance.now() - t0) / 1000, (a.duration || offset + 2) - 1);
      const trySeek = () => { try { if (Math.abs(a.currentTime - target()) > 2) a.currentTime = target(); } catch (e) { /* ignora */ } };
      a.addEventListener('loadedmetadata', trySeek, { once: true });
      a.addEventListener('canplaythrough', trySeek, { once: true });
    }
    if (autoplay) a.play().catch(() => {});
  }

  // Sintoniza no ponto em que a estação está "agora"; no começo de faixa entra a locução
  function goLive(stId, autoplay, { fromEnded = false } = {}) {
    const st = STATION_BY_ID[stId];
    let L = liveAt(st);
    // terminou um pouco antes do relógio: não repete a mesma faixa
    if (fromEnded && L.track.id === st.tracks[idxRef.current]?.id) {
      L = { ...L, track: L.next, offset: 0, next: L.list[(L.list.indexOf(L.next) + 1) % L.list.length] };
    }
    const i = st.tracks.indexOf(L.track);
    const fresh = fromEnded || L.offset < 6;
    load(stId, i, autoplay, fresh ? 0 : L.offset);
    if (autoplay && fresh) announce(stId, L.track, L.next, L.show);
  }

  const showFlash = (id, auto) => {
    clearTimeout(flashTimer.current);
    setFlash({ id, auto, key: Date.now() });
    flashTimer.current = setTimeout(() => setFlash(null), 2600);
  };

  // Troca de estação (com chiado se estiver tocando)
  const tune = (stId, { auto = false } = {}) => {
    if (stId === stRef.current) return;
    const a = audioRef.current;
    const wasPlaying = !a.paused || pendingPlay.current;
    stRef.current = stId;
    clearTimeout(switchTimer.current);
    stopSpeech();
    const start = (play) => (liveRef.current ? goLive(stId, play) : load(stId, 0, play));
    if (wasPlaying && graph.current && !graph.current.fallback) {
      applyLevels(true);
      switchTimer.current = setTimeout(() => start(true), 280);
    } else {
      start(wasPlaying);
    }
    showFlash(stId, auto);
  };

  const setStatic = (v) => {
    staticRef.current = v;
    setSignal(1 - v);
    applyLevels();
  };

  const toggle = () => {
    ensureGraph();
    const a = audioRef.current;
    // rádio ao vivo não "pausa": ao voltar, entra no ponto em que a estação está agora
    if (a.paused && liveRef.current) return goLive(stRef.current, true);
    if (!a.paused && liveRef.current) stopSpeech();
    if (!a.getAttribute('src')) {
      const url = urlsRef.current[track.id];
      if (!url) return;
      a.src = url;
    }
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };
  const next = () => { ensureGraph(); stopSpeech(); setLive(false); load(stationId, (trackIdx + 1) % station.tracks.length, true); };
  const prev = () => {
    ensureGraph(); stopSpeech(); setLive(false);
    const a = audioRef.current;
    if (a.currentTime > 3) { a.currentTime = 0; return; }
    load(stationId, (trackIdx - 1 + station.tracks.length) % station.tracks.length, true);
  };
  const playTrack = (stId, i) => {
    ensureGraph(); stopSpeech(); setLive(false);
    setAutoTune(false);
    if (stId === stationId && i === trackIdx && audioRef.current.getAttribute('src')) return toggle();
    if (stId !== stationId) showFlash(stId, false);
    load(stId, i, true);
  };
  const seek = (s) => {
    const a = audioRef.current;
    if (!a.getAttribute('src')) return;
    setLive(false);
    a.currentTime = s;
    setTime(s);
  };
  const backToLive = () => { ensureGraph(); stopSpeech(); setLive(true); goLive(stRef.current, true); };
  // ouvir uma estação específica ao vivo (grade, cards)
  const listenLive = (stId) => {
    ensureGraph(); stopSpeech(); setLive(true);
    if (stId !== stRef.current) showFlash(stId, false);
    goLive(stId, true);
  };
  const setScript = (fn) => { scriptRef.current = fn; };
  // prévia: toca uma locução agora (na estação atual), sem esperar a faixa acabar
  const announceNow = (force) => {
    ensureGraph();
    const st = STATION_BY_ID[stRef.current], L = liveAt(st);
    const tr = st.tracks[idxRef.current] || L.track;
    announce(st.id, tr, L.next, L.show, force);
  };

  return {
    station, track, urls, playing, ready, time, duration, volume, muted, autoTune, signal, flash,
    live, voiceOn, onAir,
    toggle, next, prev, seek, setVolume, setMuted, setAutoTune, playTrack, tune, setStatic,
    backToLive, listenLive, setVoiceOn, setScript, announceNow, tts, testVoice,
  };
}

/* --- Cartão 9:16 para Stories / Shorts --- */
const MAP_FILTERS = {
  radar: 'grayscale(1) brightness(.42) contrast(1.4) sepia(.5) hue-rotate(170deg) saturate(1.8)',
  neon: 'grayscale(.5) brightness(.42) contrast(1.35) sepia(.35) hue-rotate(245deg) saturate(2.2)',
  original: 'none',
};
const OCEAN_RGB = 'rgb(44,103,164)';

const loadImg = (src) => new Promise((res) => {
  const im = new Image();
  im.onload = () => res(im);
  im.onerror = () => res(null);
  im.src = src;
});

function wrapLines(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width <= maxW) cur = t;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxW && last.length) last = last.slice(0, -1);
    cut[maxLines - 1] = `${last.trimEnd()}…`;
    return cut;
  }
  return lines;
}

function iconSvg(item, px) {
  if (item.kind === 'pin') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px * 1.25}" viewBox="0 0 24 30">
      <path d="M12 29s10-9.5 10-17A10 10 0 0 0 2 12c0 7.5 10 17 10 17Z" fill="#09090b" stroke="${item.color}" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="${item.color}"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="11" fill="#0b0b10" stroke="${item.color}" stroke-width="1.3"/>
    <g transform="translate(4.32 4.32) scale(.64)" color="${item.color}" fill="none" stroke="${item.color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${BLIP_TYPES[item.type].glyph}</g></svg>`;
}

const SHARE_FORMATS = {
  story: { label: 'Stories / Shorts', hint: '9:16 · Reels, TikTok', w: 1080, h: 1920, mapH: 1220 },
  feed: { label: 'Feed 4:5', hint: 'Instagram e Facebook', w: 1080, h: 1350, mapH: 860 },
  square: { label: 'Quadrado 1:1', hint: 'Instagram, WhatsApp', w: 1080, h: 1080, mapH: 520 },
  wide: { label: 'Paisagem 16:9', hint: 'X, YouTube, Discord', w: 1920, h: 1080, mapW: 1060 },
};

async function drawMapRect(ctx, item, mapStyle, rx, ry, rw, rh, fx = 0.5, fy = 0.46) {
  const Z = -1, scale = 2 ** Z;
  const mc = document.createElement('canvas'); mc.width = rw; mc.height = rh;
  const m = mc.getContext('2d');
  m.fillStyle = OCEAN_RGB; m.fillRect(0, 0, rw, rh);
  const left = item.x * scale - rw * fx, top = -item.y * scale - rh * fy;
  const jobs = [];
  for (let i = Math.floor(left / 1024); i <= Math.floor((left + rw) / 1024); i++)
    for (let j = Math.floor(top / 1024); j <= Math.floor((top + rh) / 1024); j++)
      jobs.push(loadImg(`tiles/${Z}/${i}_${j}.jpg`).then((im) => im && m.drawImage(im, i * 1024 - left, j * 1024 - top)));
  await Promise.all(jobs);
  if ('filter' in ctx) ctx.filter = MAP_FILTERS[mapStyle] || 'none';
  ctx.drawImage(mc, rx, ry);
  ctx.filter = 'none';
  if (!('filter' in ctx) && mapStyle !== 'original') { ctx.fillStyle = 'rgba(9,9,11,.55)'; ctx.fillRect(rx, ry, rw, rh); }
}

async function drawMarker(ctx, item, mx, my, s) {
  ctx.save();
  ctx.shadowColor = item.color; ctx.shadowBlur = 30 * s;
  [190, 140, 95].forEach((r, k) => {
    ctx.beginPath(); ctx.arc(mx, my, r * s, 0, Math.PI * 2);
    ctx.strokeStyle = item.color; ctx.globalAlpha = 0.18 + k * 0.17; ctx.lineWidth = 3 * s; ctx.stroke();
  });
  ctx.restore();
  const px = Math.round(130 * s);
  const ic = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg(item, px)));
  if (!ic) return;
  ctx.save(); ctx.shadowColor = item.color; ctx.shadowBlur = 40 * s;
  if (item.kind === 'pin') ctx.drawImage(ic, mx - px / 2, my - px * 1.15, px, px * 1.25);
  else ctx.drawImage(ic, mx - px / 2, my - px / 2, px, px);
  ctx.restore();
}

function drawBrand(ctx, x, y, s, right, labels = ['MAPA INTERATIVO', 'GTA VI · LEONIDA']) {
  const g = ctx.createLinearGradient(x, y, x + 84 * s, y + 84 * s);
  g.addColorStop(0, '#ff007f'); g.addColorStop(1, '#ff5e00');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, 84 * s, 84 * s, 16 * s); ctx.fill();
  ctx.fillStyle = '#09090b'; ctx.font = `400 ${56 * s}px Anton, Impact, sans-serif`; ctx.textAlign = 'center';
  ctx.fillText('6★', x + 42 * s, y + 64 * s);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff'; ctx.font = `400 ${60 * s}px Anton, Impact, sans-serif`;
  ctx.fillText('ESTRELA', x + 108 * s, y + 54 * s); const w6 = ctx.measureText('ESTRELA').width;
  ctx.fillStyle = '#ff007f'; ctx.shadowColor = '#ff007f'; ctx.shadowBlur = 24 * s; ctx.fillText('6', x + 108 * s + w6 + 4 * s, y + 54 * s); ctx.shadowBlur = 0;
  ctx.fillStyle = '#00f0ff'; ctx.font = `700 ${22 * s}px "JetBrains Mono", monospace`;
  ctx.fillText('★ ★ ★ ★ ★ ★  PORTAL DE FÃS', x + 110 * s, y + 86 * s);
  if (right != null) {
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = `700 ${24 * s}px "JetBrains Mono", monospace`;
    ctx.fillText(labels[0], right, y + 48 * s);
    ctx.fillStyle = '#ff5e00'; ctx.fillText(labels[1], right, y + 82 * s);
    ctx.textAlign = 'left';
  }
}

// Painel de texto dentro de um retângulo; retorna nada. s = escala tipográfica
function drawPanel(ctx, item, px, py, pw, bottom, s, maxTitle, { dry = false, descLines = null } = {}) {
  let y = py;
  const real = ctx;
  if (dry) ctx = new Proxy(real, { get: (t, k) => (['fillText', 'fillRect', 'fill', 'stroke', 'beginPath', 'roundRect'].includes(k) ? () => {} : typeof t[k] === 'function' ? t[k].bind(t) : t[k]), set: (t, k, v) => { t[k] = v; return true; } });
  ctx.font = `700 ${30 * s}px "JetBrains Mono", monospace`;
  const tag = `[${item.typeLabel.toUpperCase()}]`;
  const tw = ctx.measureText(tag).width;
  ctx.strokeStyle = item.color; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.beginPath(); ctx.roundRect(px, y - 36 * s, tw + 28 * s, 50 * s, 6 * s); ctx.fill(); ctx.stroke();
  ctx.fillStyle = item.color; ctx.fillText(tag, px + 14 * s, y);
  if (item.spoiler) {
    const st = '⚠ SPOILER';
    const sx = px + tw + 46 * s, sw = ctx.measureText(st).width + 28 * s;
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.roundRect(sx, y - 36 * s, sw, 50 * s, 6 * s); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(st, sx + 14 * s, y);
  }
  y += 40 * s;

  let size = maxTitle, title;
  const fits = () => {
    ctx.font = `400 ${size}px Anton, Impact, sans-serif`;
    title = wrapLines(ctx, item.title.toUpperCase(), pw, 99);
    return title.length <= 2 && title.every((l) => ctx.measureText(l).width <= pw);
  };
  while (!fits() && size > maxTitle * 0.5) size -= 4;
  if (title.length > 2) title = wrapLines(ctx, item.title.toUpperCase(), pw, 2);
  ctx.fillStyle = '#fff'; ctx.shadowColor = item.color; ctx.shadowBlur = 20 * s;
  title.forEach((l) => { y += size * 0.98; ctx.fillText(l, px, y); });
  ctx.shadowBlur = 0;

  if (item.area) {
    y += 52 * s; ctx.fillStyle = '#a1a1aa'; ctx.font = `700 ${30 * s}px "JetBrains Mono", monospace`;
    wrapLines(ctx, item.area.toUpperCase(), pw, 1).forEach((l) => ctx.fillText(l, px, y));
  }
  const lh = 50 * s;
  let usedDesc = 0;
  if (item.desc && (descLines != null ? descLines > 0 : bottom - y > 150 * s)) {
    y += 36 * s; ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(px, y, pw, 2);
    y += 52 * s; ctx.fillStyle = item.color; ctx.font = `700 ${24 * s}px "JetBrains Mono", monospace`;
    ctx.fillText(item.descLabel.toUpperCase(), px, y);
    ctx.fillStyle = '#e4e4e7'; ctx.font = `500 ${38 * s}px "Chakra Petch", sans-serif`;
    const room = descLines ?? Math.max(1, Math.min(3, Math.floor((bottom - y) / lh)));
    const lines = wrapLines(ctx, item.desc, pw, room);
    lines.forEach((l) => { y += lh; ctx.fillText(l, px, y); });
    usedDesc = lines.length;
  }
  return { y, descLines: usedDesc };
}

function drawQR(ctx, text, x, y, size) {
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), cell = size / (n + 4);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(x, y, size, size, size * 0.06); ctx.fill();
  ctx.fillStyle = '#09090b';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(x + (c + 2) * cell, y + (r + 2) * cell, Math.ceil(cell), Math.ceil(cell));
}

function drawFooter(ctx, px, by, s, link, right, opts = {}) {
  const o = { cta: 'EXPLORE O MAPA COMPLETO →', qrLabel: 'ABRA NO MAPA ↘', color: '#ff007f',
    lines: ['Mapa: Yanis GTA VI Community Map v17 via GTADB.org · CC BY 4.0 · cores adaptadas', 'Site de fã, sem afiliação com a Rockstar Games'], ...opts };
  if (link) {
    const q = 132 * s;
    drawQR(ctx, link, right - q, by - 76 * s - q + 8 * s, q);
    ctx.textAlign = 'right'; ctx.fillStyle = '#a1a1aa'; ctx.font = `700 ${16 * s}px "JetBrains Mono", monospace`;
    ctx.fillText(o.qrLabel, right - q - 14 * s, by - 76 * s - q * 0.5);
    ctx.textAlign = 'left';
  }
  ctx.fillStyle = o.color; ctx.font = `400 ${46 * s}px Anton, Impact, sans-serif`;
  ctx.shadowColor = o.color; ctx.shadowBlur = 18 * s;
  ctx.fillText(o.cta, px, by - 76 * s); ctx.shadowBlur = 0;
  ctx.fillStyle = '#71717a'; ctx.font = `400 ${19 * s}px "JetBrains Mono", monospace`;
  ctx.fillText(o.lines[0], px, by - 30 * s);
  ctx.fillText(o.lines[1], px, by - 4 * s);
}

async function renderShareCard(item, mapStyle, fmtKey = 'story') {
  const F = SHARE_FORMATS[fmtKey];
  const W = F.w, H = F.h;
  try {
    await Promise.race([
      Promise.all(['400 64px Anton', '700 40px "Chakra Petch"', '400 30px "JetBrains Mono"'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (e) { /* fontes do sistema como reserva */ }

  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, W, H);
  let g;

  if (fmtKey === 'wide') {
    // mapa à esquerda, painel à direita
    const MW = F.mapW, s = 0.92;
    await drawMapRect(ctx, item, mapStyle, 0, 0, MW, H, 0.5, 0.52);
    g = ctx.createLinearGradient(MW - 360, 0, MW, 0);
    g.addColorStop(0, 'rgba(9,9,11,0)'); g.addColorStop(1, '#09090b');
    ctx.fillStyle = g; ctx.fillRect(MW - 360, 0, 360, H);
    g = ctx.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, 'rgba(9,9,11,.9)'); g.addColorStop(1, 'rgba(9,9,11,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, MW, 220);
    ctx.fillStyle = 'rgba(255,255,255,.025)'; for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    await drawMarker(ctx, item, MW * 0.5, H * 0.52, 0.9);
    drawBrand(ctx, 56, 52, 0.9, null);
    const px = MW + 10, pw = W - px - 70;
    ctx.fillStyle = '#ff5e00'; ctx.font = '700 22px "JetBrains Mono", monospace'; ctx.fillText('MAPA INTERATIVO · GTA VI', px, 110);
    const probe = drawPanel(ctx, item, px, 260, pw, H - 300, s, 104, { dry: true });
    const h = probe.y - 260;
    const top = Math.max(230, Math.round((160 + (H - 300) - h) / 2));
    drawPanel(ctx, item, px, top, pw, H - 300, s, 104, { descLines: probe.descLines });
    drawFooter(ctx, px, H - 50, 0.8, item.link, W - 70);
  } else {
    const s = fmtKey === 'story' ? 1 : fmtKey === 'feed' ? 0.86 : 0.78;
    const maxTitle = fmtKey === 'story' ? 124 : fmtKey === 'feed' ? 100 : 86;
    // mede o texto primeiro; o mapa ocupa todo o espaço que sobrar
    const footerTop = H - (item.link ? 250 : 150) * s;     // espaço para o QR code
    const probe = drawPanel(ctx, item, 60, F.mapH - 40 * s, W - 120, footerTop, s, maxTitle, { dry: true });
    const textH = probe.y - (F.mapH - 40 * s);
    const MAPH = Math.max(F.mapH, Math.round(footerTop - 50 * s - textH + 40 * s));
    const FY = 0.47;
    await drawMapRect(ctx, item, mapStyle, 0, 0, W, MAPH, 0.5, FY);
    g = ctx.createLinearGradient(0, 0, 0, 240); g.addColorStop(0, 'rgba(9,9,11,.95)'); g.addColorStop(1, 'rgba(9,9,11,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 240);
    const fade = Math.min(420, MAPH * 0.45);
    g = ctx.createLinearGradient(0, MAPH - fade, 0, MAPH); g.addColorStop(0, 'rgba(9,9,11,0)'); g.addColorStop(1, '#09090b');
    ctx.fillStyle = g; ctx.fillRect(0, MAPH - fade, W, fade);
    g = ctx.createRadialGradient(W / 2, MAPH * 0.5, 160, W / 2, MAPH * 0.5, 900);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, MAPH);
    ctx.fillStyle = 'rgba(255,255,255,.025)'; for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    await drawMarker(ctx, item, W / 2, MAPH * FY, fmtKey === 'story' ? 1 : 0.75);
    drawBrand(ctx, 60, 50, s, W - 60);
    drawPanel(ctx, item, 60, MAPH - 40 * s, W - 120, footerTop, s, maxTitle, { descLines: probe.descLines });
    drawFooter(ctx, 60, H - 40 * s, s, item.link, W - 60);
  }
  return await new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

/* --- Cartão "Tocando agora" --- */
function seeded(n) { let x = n * 9301 + 49297; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); }

// Visual da estação: frequência, nome com brilho, equalizador e dial FM
function drawRadioVisual(ctx, item, x, y, w, h, s) {
  const st = item.station, col = st.color;
  const cx = x + w / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = col; ctx.font = `700 ${34 * s}px "JetBrains Mono", monospace`;
  ctx.fillText(`${st.freq} FM`, cx, y + 40 * s);
  let size = 150 * s;
  ctx.font = `400 ${size}px Anton, Impact, sans-serif`;
  while (ctx.measureText(st.name.toUpperCase()).width > w - 40 * s && size > 60 * s) { size -= 6; ctx.font = `400 ${size}px Anton, Impact, sans-serif`; }
  ctx.fillStyle = '#fff'; ctx.shadowColor = col; ctx.shadowBlur = 40 * s;
  ctx.fillText(st.name.toUpperCase(), cx, y + 40 * s + size * 1.02);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#a1a1aa'; ctx.font = `700 ${24 * s}px "JetBrains Mono", monospace`;
  ctx.fillText(st.genre.toUpperCase(), cx, y + 40 * s + size * 1.02 + 46 * s);
  ctx.textAlign = 'left';

  // equalizador
  const eqTop = y + 40 * s + size * 1.02 + 90 * s;
  const dialH = 110 * s;
  const eqH = Math.max(60 * s, y + h - dialH - 30 * s - eqTop);
  const bars = 28, gap = 8 * s, bw = (w - 80 * s - gap * (bars - 1)) / bars;
  const rnd = seeded(item.track.id * 7 + 3);
  const base = eqTop + eqH;
  const g = ctx.createLinearGradient(0, eqTop, 0, base);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, `${col}55`);
  ctx.fillStyle = g; ctx.shadowColor = col; ctx.shadowBlur = 18 * s;
  for (let i = 0; i < bars; i++) {
    const env = Math.sin((i / (bars - 1)) * Math.PI) * 0.7 + 0.3;
    const bh = Math.max(8 * s, eqH * env * (0.35 + rnd() * 0.65));
    ctx.beginPath(); ctx.roundRect(x + 40 * s + i * (bw + gap), base - bh, bw, bh, 3 * s); ctx.fill();
  }
  ctx.shadowBlur = 0;

  // dial 88–108
  const dy = y + h - dialH + 20 * s, dx0 = x + 40 * s, dw = w - 80 * s;
  ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.roundRect(dx0 - 16 * s, dy - 10 * s, dw + 32 * s, dialH - 20 * s, 12 * s); ctx.fill();
  for (let f = 88; f <= 108; f += 0.5) {
    const tx = dx0 + ((f - 88) / 20) * dw;
    const major = f % 2 === 0;
    ctx.fillStyle = major ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.2)';
    ctx.fillRect(tx, dy + 6 * s, 2, (major ? 30 : 16) * s);
    if (major && f % 4 === 0) {
      ctx.font = `700 ${16 * s}px "JetBrains Mono", monospace`; ctx.textAlign = 'center';
      ctx.fillText(String(f), tx, dy + 62 * s); ctx.textAlign = 'left';
    }
  }
  const nx = dx0 + ((parseFloat(st.freq) - 88) / 20) * dw;
  ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 16 * s;
  ctx.fillRect(nx - 2 * s, dy - 4 * s, 4 * s, 52 * s); ctx.shadowBlur = 0;
}

// Texto: tocando agora, faixa, apresentador e programa
function drawRadioPanel(ctx, item, px, py, pw, s, maxTitle, dry = false) {
  const real = ctx;
  if (dry) ctx = new Proxy(real, { get: (t, k) => (['fillText', 'fillRect', 'fill', 'stroke', 'beginPath', 'roundRect', 'arc'].includes(k) ? () => {} : typeof t[k] === 'function' ? t[k].bind(t) : t[k]), set: (t, k, v) => { t[k] = v; return true; } });
  const col = item.station.color;
  let y = py;
  ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(px + 10 * s, y - 10 * s, 10 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col; ctx.font = `700 ${30 * s}px "JetBrains Mono", monospace`;
  ctx.fillText('TOCANDO AGORA', px + 34 * s, y);
  let size = maxTitle, lines;
  const fits = () => {
    ctx.font = `400 ${size}px Anton, Impact, sans-serif`;
    lines = wrapLines(ctx, item.track.title.toUpperCase(), pw, 99);
    return lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= pw);
  };
  while (!fits() && size > maxTitle * 0.5) size -= 4;
  if (lines.length > 2) lines = wrapLines(ctx, item.track.title.toUpperCase(), pw, 2);
  ctx.fillStyle = '#fff'; ctx.shadowColor = col; ctx.shadowBlur = 20 * s;
  lines.forEach((l) => { y += size * 0.98; ctx.fillText(l, px, y); });
  ctx.shadowBlur = 0;
  y += 58 * s; ctx.fillStyle = '#e4e4e7'; ctx.font = `500 ${40 * s}px "Chakra Petch", sans-serif`;
  ctx.fillText(`de ${artistOf(item.track)}`, px, y);
  y += 38 * s; ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(px, y, pw, 2);
  y += 50 * s; ctx.fillStyle = col; ctx.font = `700 ${24 * s}px "JetBrains Mono", monospace`;
  ctx.fillText('NO PROGRAMA', px, y);
  y += 50 * s; ctx.fillStyle = '#e4e4e7'; ctx.font = `500 ${38 * s}px "Chakra Petch", sans-serif`;
  wrapLines(ctx, `${item.show.name} · ${fmtH(item.show.start)}–${fmtH(item.show.end)}`, pw, 1).forEach((l) => ctx.fillText(l, px, y));
  y += 46 * s; ctx.fillStyle = '#a1a1aa'; ctx.font = `700 ${22 * s}px "JetBrains Mono", monospace`;
  wrapLines(ctx, `SINAL: ${item.station.region.toUpperCase()}`, pw, 1).forEach((l) => ctx.fillText(l, px, y));
  return y;
}

async function renderRadioCard(item, fmtKey = 'story') {
  const F = SHARE_FORMATS[fmtKey];
  const W = F.w, H = F.h, col = item.station.color;
  try {
    await Promise.race([
      Promise.all(['400 64px Anton', '700 40px "Chakra Petch"', '400 30px "JetBrains Mono"'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (e) { /* fontes do sistema como reserva */ }
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, W, H);
  const wide = fmtKey === 'wide';
  let g = ctx.createRadialGradient(wide ? W * 0.27 : W / 2, H * (wide ? 0.5 : 0.3), 0, wide ? W * 0.27 : W / 2, H * (wide ? 0.5 : 0.3), Math.max(W, H) * 0.65);
  g.addColorStop(0, `${col}55`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createLinearGradient(0, H * 0.45, 0, H); g.addColorStop(0, 'rgba(59,7,100,0)'); g.addColorStop(1, 'rgba(59,7,100,.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,.025)'; for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  const footer = { cta: 'SINTONIZE A RÁDIO ESTRELA6 →', qrLabel: 'OUÇA AGORA ↘', color: col,
    lines: [`Música em domínio público (CC0) · ${item.track.source || 'FreePD.com'}`, 'Site de fã, sem afiliação com a Rockstar Games'] };

  if (wide) {
    const s = 0.9, VW = Math.round(W * 0.52);
    drawBrand(ctx, 56, 52, s, null);
    drawRadioVisual(ctx, item, 30, 200, VW - 60, H - 260, 0.95);
    const px = VW + 40, pw = W - px - 70;
    ctx.fillStyle = '#ff5e00'; ctx.font = '700 22px "JetBrains Mono", monospace'; ctx.fillText('RÁDIO ESTRELA6 · GTA VI', px, 110);
    const end = drawRadioPanel(ctx, item, px, 0, pw, s, 104, true);
    const top = Math.max(230, Math.round((180 + (H - 300) - end) / 2));
    drawRadioPanel(ctx, item, px, top, pw, s, 104);
    drawFooter(ctx, px, H - 50, 0.8, item.link, W - 70, footer);
  } else {
    const s = fmtKey === 'story' ? 1 : fmtKey === 'feed' ? 0.86 : 0.78;
    const maxTitle = fmtKey === 'story' ? 124 : fmtKey === 'feed' ? 100 : 86;
    const footerTop = H - 250 * s;
    const panelH = drawRadioPanel(ctx, item, 60, 0, W - 120, s, maxTitle, true);
    const panelTop = footerTop - 40 * s - panelH;
    drawBrand(ctx, 60, 50, s, W - 60, ['RÁDIO ESTRELA6', `${item.station.freq} FM`]);
    const vTop = 170 * s, vH = panelTop - 70 * s - vTop;
    drawRadioVisual(ctx, item, 40, vTop + 20 * s, W - 80, vH, s * (fmtKey === 'square' ? 0.8 : 1));
    drawRadioPanel(ctx, item, 60, panelTop, W - 120, s, maxTitle);
    drawFooter(ctx, 60, H - 40 * s, s, item.link, W - 60, footer);
  }
  return await new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

const slugify = (t) => norm2(t).replace(/\s+/g, '-').slice(0, 40) || 'local';
const norm2 = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();

function ShareModal({ item, mapStyle = 'radar', onClose }) {
  const isRadio = item.kind === 'radio';
  const shared = useRef(false);
  const markShared = () => { if (shared.current) return; shared.current = true; window.dispatchEvent(new CustomEvent('lu:share')); };
  const [fmt, setFmt] = useState('story');
  const [showReal, setShowReal] = useState(true);
  const cardItem = useMemo(() => (item.kind === 'landmark' && !showReal ? { ...item, desc: null } : item), [item, showReal]);
  const [card, setCard] = useState(null);           // { fmt, url, blob } do formato pronto
  const [msg, setMsg] = useState('');
  const [dl, setDl] = useState(undefined);          // undefined = verificando; null = indisponível
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    const use = window.claude?.use;
    if (!use) { setDl(null); return; }
    use('downloads').then((d) => alive && setDl(d)).catch(() => alive && setDl(null));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true, u = null;
    setMsg('');
    (isRadio ? renderRadioCard(cardItem, fmt) : renderShareCard(cardItem, mapStyle, fmt)).then((b) => {
      if (!alive || !b) return;
      u = URL.createObjectURL(b);
      setCard({ fmt, url: u, blob: b });
    });
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { alive = false; window.removeEventListener('keydown', onKey); if (u) setTimeout(() => URL.revokeObjectURL(u), 1000); };
  }, [cardItem, mapStyle, fmt]);

  const F = SHARE_FORMATS[fmt];
  const ready = card && card.fmt === fmt;
  const url = ready ? card.url : null, blob = ready ? card.blob : null;
  const caption = isRadio
    ? `🎧 Tocando agora na Rádio Estrela6 ${item.station.freq} ${item.station.name}: "${item.track.title}", de ${artistOf(item.track)}\nPrograma: ${item.show.name} (${fmtH(item.show.start)}–${fmtH(item.show.end)})\nOuça: ${item.link}\n#GTA6 #GTAVI #RadioLeonida`
    : `${cardItem.spoiler ? '⚠️ SPOILER · ' : ''}📍 ${cardItem.title}${cardItem.area ? ` — ${cardItem.area}` : ''}\n${cardItem.desc ? `${cardItem.descLabel}: ${cardItem.desc}\n` : ''}Veja no mapa: ${item.link}\n#GTA6 #GTAVI #ViceCity #Leonida`;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(item.link); markShared(); setMsg(isRadio ? 'Link copiado. Quem abrir cai na rádio com a estação sintonizada.' : 'Link copiado. Quem abrir cai no mapa com o local selecionado.'); }
    catch (e) { setMsg('Não foi possível copiar. Selecione o link e copie manualmente.'); }
  };

  const save = async () => {
    if (!dl || !blob) return;
    setSaving(true); setMsg('');
    try {
      await dl.save({ filename: `leonida-${slugify(item.title)}-${fmt}-${F.w}x${F.h}.png`, data: blob });
      setMsg('Imagem salva.'); markShared();
    } catch (e) {
      const code = e?.code;
      if (code === 'declined') setMsg('Download cancelado.');
      else if (code === 'rate_limited') setMsg('Já existe um download aguardando confirmação.');
      else { setMsg('Não foi possível salvar aqui. Use "Copiar imagem" ou salve pela própria imagem.'); setDl(null); }
    } finally { setSaving(false); }
  };
  const copyImage = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setMsg('Imagem copiada. Cole no app que quiser.'); markShared();
    } catch (e) { setMsg('Seu navegador não deixou copiar a imagem.'); }
  };
  const copyCaption = async () => {
    try { await navigator.clipboard.writeText(caption); setMsg('Legenda copiada.'); markShared(); }
    catch (e) { setMsg('Não foi possível copiar a legenda.'); }
  };

  const previewBox = fmt === 'wide' ? 'w-full aspect-[16/9]' : fmt === 'square' ? 'w-[min(300px,70vw)] aspect-square' : fmt === 'feed' ? 'w-[min(280px,70vw)] aspect-[4/5]' : 'w-[min(260px,62vw)] aspect-[9/16]';

  return (
    <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className={`glass-card w-full max-w-4xl p-5 grid gap-5 relative max-h-[94vh] overflow-y-auto ${fmt === 'wide' ? '' : 'md:grid-cols-[auto_1fr]'}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Compartilhar">
        <button onClick={onClose} className="absolute top-3 right-3 z-10 icon-btn" aria-label="Fechar"><IconClose className="w-5 h-5" /></button>
        <div className={`mx-auto ${previewBox} rounded-xl overflow-hidden border border-pink-500/40 bg-black grid place-items-center`}>
          {url ? <img src={url} alt={`Cartão de ${item.title} (${F.label})`} className="w-full h-full object-contain" /> : <span className="font-mono text-xs text-zinc-500 animate-pulse">Gerando cartão…</span>}
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          <h3 className="font-display uppercase text-3xl text-white">{isRadio ? 'Compartilhar o que está tocando' : 'Compartilhar local'}</h3>
          {item.kind === 'landmark' && item.desc && (
            <label className="flex items-center justify-between gap-3 rounded-lg border border-zinc-700 px-3 py-2 cursor-pointer">
              <span>
                <span className="block text-sm text-white">Mostrar inspiração na vida real</span>
                <span className="block font-mono text-[10px] text-zinc-500 truncate">{item.desc}</span>
              </span>
              <input type="checkbox" checked={showReal} onChange={(e) => setShowReal(e.target.checked)} className="accent-pink-500 w-4 h-4 shrink-0" />
            </label>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyber/5 pl-3 pr-1 py-1">
            <span className="font-mono text-[11px] text-cyber truncate flex-1 select-all" title={item.link}>{item.link.replace(/^https?:\/\//, '')}</span>
            <button onClick={copyLink} className="shrink-0 px-3 py-1.5 rounded-md bg-cyber/15 text-cyber font-mono text-[11px] hover:bg-cyber/25">COPIAR LINK</button>
          </div>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Formato">
            {Object.entries(SHARE_FORMATS).map(([k, f]) => (
              <button key={k} role="radio" aria-checked={fmt === k} onClick={() => setFmt(k)}
                className={`text-left px-3 py-2 rounded-lg border transition ${fmt === k ? 'border-neon bg-neon/15 shadow-neon' : 'border-zinc-700 hover:border-zinc-500'}`}>
                <span className="block text-sm font-semibold text-white">{f.label}</span>
                <span className="block font-mono text-[10px] text-zinc-400">{f.hint}</span>
              </button>
            ))}
          </div>
          {dl !== null && (
            <button onClick={save} disabled={!blob || !dl || saving} className="btn-neon disabled:opacity-50">
              {dl === undefined ? 'Preparando…' : saving ? 'Salvando…' : 'Salvar imagem'}
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={copyImage} disabled={!blob} className={dl === null ? 'btn-neon disabled:opacity-50' : 'btn-ghost disabled:opacity-50'}>Copiar imagem</button>
            <button onClick={copyCaption} className="btn-ghost">Copiar legenda</button>
          </div>
          {msg && <p className="font-mono text-xs text-cyber" role="status">{msg}</p>}
          <pre className="whitespace-pre-wrap text-xs text-zinc-400 bg-black/50 border border-zinc-800 rounded-lg p-3 font-mono">{caption}</pre>
          {dl === null && (
            <p className="font-mono text-[10px] text-zinc-500 leading-relaxed">
              Para salvar: no celular, toque e segure a imagem; no computador, clique com o botão direito → "Salvar imagem como".
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toast "Missão concluída"                                            */
/* ------------------------------------------------------------------ */

function MissionToast({ data }) {
  useEffect(() => { if (data?.sfx) playSfx(data.sfx); }, [data?.key]);
  if (!data) return null;
  return (
    <div key={data.key} className="fixed inset-x-0 top-24 z-[3000] flex justify-center pointer-events-none" role="status" aria-live="polite">
      <div className="mission-toast text-center w-full py-5 bg-gradient-to-r from-transparent via-black/85 to-transparent">
        <div className="font-display uppercase text-5xl md:text-7xl tracking-wide mission-title">{data.title}</div>
        <div className="mt-1 font-mono text-sm tracking-[0.3em] text-white/90">{data.sub.toUpperCase()}</div>
        <div className="mt-1 font-display text-2xl text-emerald-400 drop-shadow-[0_0_10px_#10b981]">{data.reward}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Contas (simuladas) + gamificação                                    */
/* ------------------------------------------------------------------ */

const ACCOUNT_KEY = 'lu-account-v1';
const EMPTY_STATS = { articlesApproved: 0, pinsApproved: 0, firsts: 0, eggsApproved: 0, vehiclesApproved: 0, secretsApproved: 0, confirmsGiven: 0, confirmsReceived: 0, shares: 0, searches: 0, listenSec: 0, newsHeard: 0, challengesDone: 0 };
const EMPTY_PROG = () => ({ respect: 0, log: [], visited: {}, stations: [], stats: { ...EMPTY_STATS }, flags: {}, days: [], achievements: [], challenges: {} });
const loadAccount = () => {
  try {
    const a = JSON.parse(localStorage.getItem(ACCOUNT_KEY));
    if (!a) return null;
    const e = EMPTY_PROG();      // conta salva por uma versão antiga: completa os campos novos
    a.prog = { ...e, ...a.prog, stats: { ...e.stats, ...(a.prog?.stats || {}) }, flags: a.prog?.flags || {}, challenges: a.prog?.challenges || {} };
    return a;
  } catch (e) { return null; }
};
const streakOf = (days) => {
  const set = new Set(days); let n = 0; const d = new Date();
  while (set.has(dayKey(d.getTime()))) { n++; d.setDate(d.getDate() - 1); }
  return n;
};
const tierOf = (id) => TIERS.find((t) => t.id === id) || TIERS[0];

function useGame({ toast, regionTotals }) {
  const saved = useMemo(loadAccount, []);
  const [user, setUser] = useState(saved?.user || null);
  const [prog, setProg] = useState(saved?.prog || EMPTY_PROG());
  const progRef = useRef(prog); progRef.current = prog;
  const userRef = useRef(user); userRef.current = user;
  const totalsRef = useRef(regionTotals); totalsRef.current = regionTotals;
  const zap = useRef([]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ user, prog }));
      else localStorage.removeItem(ACCOUNT_KEY);
    } catch (e) { /* sem storage */ }
  }, [user, prog]);

  const statValue = (stat, p = progRef.current) => {
    const tot = totalsRef.current || {};
    if (stat.startsWith('pct:')) { const r = stat.slice(4); return tot[r] ? Math.floor(((p.visited[r] || []).length / tot[r]) * 100) : 0; }
    if (stat.startsWith('flag:')) return p.flags[stat.slice(5)] ? 1 : 0;
    switch (stat) {
      case 'visitedTotal': return Object.values(p.visited).reduce((a, v) => a + v.length, 0);
      case 'regionsVisited': return Object.values(p.visited).filter((v) => v.length).length;
      case 'stations': return p.stations.length;
      case 'listenMin': return Math.floor(p.stats.listenSec / 60);
      case 'streak': return streakOf(p.days);
      case 'shieldDays': return Math.min(30, Math.floor((Date.now() - (userRef.current?.joined || Date.now())) / 86400000));
      default: return p.stats[stat] || 0;
    }
  };
  const achProgress = (a, p = progRef.current) => (p.achievements.includes(a.id) ? 1 : Math.min(1, statValue(a.stat, p) / a.goal));

  // aplica pontos + desafios + conquistas; avisos vão para a fila (com som)
  const commit = (mutate) => {
    if (!userRef.current) return;
    const p = JSON.parse(JSON.stringify(progRef.current));
    const notes = [];
    const starsBefore = starsOf(p.respect);
    const award = (pts, why) => { if (!pts) return; p.respect += pts; p.log.unshift({ t: Date.now(), pts, why }); p.log = p.log.slice(0, 40); };
    let ev = mutate(p, award) || [];
    const today = dayKey(); if (!p.days.includes(today)) p.days = [...p.days.slice(-60), today];
    // desafios: diários primeiro (concluir um diário conta para o semanal "conclua 5 diários")
    for (const list of [dailyChallenges(), weeklyChallenges()]) {
      const extra = [];
      for (const c of list) {
        const bucket = `${c.scope}:${c.key}`;
        p.challenges[bucket] = p.challenges[bucket] || {};
        const st = p.challenges[bucket][c.id] || { n: 0, seen: [], done: false };
        if (st.done) continue;
        for (const e of ev) {
          if (e.type !== c.event || (c.region && e.region !== c.region)) continue;
          if (c.unique) { if (!st.seen.includes(e.key)) { st.seen.push(e.key); st.n = st.seen.length; } }
          else st.n += e.n || 1;
        }
        if (st.n >= c.goal) {
          st.done = true; p.stats.challengesDone += 1;
          award(c.reward, `Desafio: ${c.text}`);
          notes.push({ title: c.scope === 'daily' ? 'DESAFIO DIÁRIO' : 'DESAFIO DA SEMANA', sub: c.text, reward: `+${c.reward} RESPEITO`, sfx: 'mission' });
          if (c.scope === 'daily') extra.push({ type: 'daily_done' });
        }
        p.challenges[bucket][c.id] = st;
      }
      ev = [...ev, ...extra];
    }
    // limpa desafios antigos (guarda só os buckets de hoje e desta semana)
    const keep = new Set([`daily:${dayKey()}`, `weekly:${weekKey()}`]);
    Object.keys(p.challenges).forEach((k) => { if (!keep.has(k)) delete p.challenges[k]; });
    // conquistas
    for (const a of ACHIEVEMENTS) {
      if (p.achievements.includes(a.id)) continue;
      if (achProgress(a, p) >= 1) {
        p.achievements.push(a.id);
        notes.push({ title: a.secret ? 'CONQUISTA SECRETA' : 'CONQUISTA DESBLOQUEADA', sub: `${a.icon} ${a.name} · ${tierOf(a.tier).label}`, reward: '', sfx: 'achievement' });
      }
    }
    const starsAfter = starsOf(p.respect);
    if (starsAfter > starsBefore) notes.push({ title: 'NÍVEL DE PROCURADO', sub: `${'★'.repeat(starsAfter)} · ${trustOf(p.respect).label}`, reward: `${p.respect} RESPEITO`, sfx: 'level' });
    progRef.current = p; setProg(p);
    notes.forEach((n) => toast(n));
    return p;
  };

  const api = useMemo(() => ({
    login({ name, provider, cite }) {
      const u = { name, provider, cite, color: ['#ff007f', '#00f0ff', '#ff5e00', '#a855f7', '#22c55e'][name.length % 5], joined: Date.now() };
      userRef.current = u; setUser(u);
      toast({ title: 'BEM-VINDO AO ESTRELA6', sub: `@${name}`, reward: '', sfx: 'points' });
      setTimeout(() => commit(() => []), 0);       // registra o dia (sequência de dias)
    },
    logout() { setUser(null); setProg(EMPTY_PROG()); progRef.current = EMPTY_PROG(); },
    deleteAccount() { try { localStorage.removeItem(ACCOUNT_KEY); } catch (e) { /* sem storage */ } setUser(null); setProg(EMPTY_PROG()); progRef.current = EMPTY_PROG(); },
    setCite(v) { setUser((u) => (u ? { ...u, cite: v } : u)); },
    touch() { if (userRef.current && !progRef.current.days.includes(dayKey())) commit(() => []); },
    visit(lmId, region) {
      if (!region || (progRef.current.visited[region] || []).includes(lmId)) return;
      commit((p) => { p.visited[region] = [...(p.visited[region] || []), lmId]; return [{ type: 'visit', region }]; });
    },
    listen(stationId) {
      const now = Date.now();
      zap.current = [...zap.current.filter((z) => now - z.t < 60000 && z.id !== stationId), { id: stationId, t: now }];
      const dj = new Set(zap.current.map((z) => z.id)).size >= 5;
      commit((p) => { if (!p.stations.includes(stationId)) p.stations.push(stationId); if (dj) p.flags.dj = true; return [{ type: 'listen', key: stationId }]; });
    },
    listenTick(sec) {
      commit((p) => {
        const before = Math.floor(p.stats.listenSec / 60);
        p.stats.listenSec += sec;
        if (new Date().getHours() < 5) p.flags.coruja = true;
        const gained = Math.floor(p.stats.listenSec / 60) - before;
        return gained > 0 ? [{ type: 'listen_min', n: gained }] : [];
      });
    },
    news() { commit((p) => { p.stats.newsHeard += 1; return [{ type: 'news' }]; }); },
    share() { commit((p) => { p.stats.shares += 1; return [{ type: 'share' }]; }); },
    search() { commit((p) => { p.stats.searches += 1; return [{ type: 'search' }]; }); },
    flag(name) { if (!progRef.current.flags[name]) commit((p) => { p.flags[name] = true; return []; }); },
    confirmGiven() { commit((p, award) => { p.stats.confirmsGiven += 1; award(POINTS.confirm_given, 'Você confirmou um pin'); return [{ type: 'confirm_given' }]; }); },
    confirmReceived(by) {
      toast({ title: 'PIN CONFIRMADO', sub: `@${by} também viu isso`, reward: `+${POINTS.confirm_received} RESPEITO`, sfx: 'points' });
      commit((p, award) => { p.stats.confirmsReceived += 1; award(POINTS.confirm_received, `@${by} confirmou seu pin`); return []; });
    },
    articleApproved() {
      toast({ title: 'ARTIGO PUBLICADO', sub: 'Seu texto está no feed', reward: `+${POINTS.article_approved} RESPEITO`, sfx: 'points' });
      commit((p, award) => { p.stats.articlesApproved += 1; award(POINTS.article_approved, 'Artigo publicado no feed'); return [{ type: 'article_approved' }]; });
    },
    pinApproved({ category, first }) {
      const pts = POINTS.pin_approved + (first ? POINTS.first_discovery : 0);
      toast({ title: first ? 'PRIMEIRO A DESCOBRIR' : 'PIN APROVADO', sub: 'Já está visível no mapa', reward: `+${pts} RESPEITO`, sfx: 'points' });
      commit((p, award) => {
        p.stats.pinsApproved += 1;
        if (category === 'easter-egg') p.stats.eggsApproved += 1;
        if (category === 'veiculo') p.stats.vehiclesApproved += 1;
        if (category === 'segredo') p.stats.secretsApproved += 1;
        if (first) p.stats.firsts += 1;
        award(POINTS.pin_approved, 'Pin aprovado');
        if (first) award(POINTS.first_discovery, 'Primeiro a descobrir');
        return [{ type: 'pin_approved' }, ...(first ? [{ type: 'first' }] : [])];
      });
    },
  }), [toast]);

  const ranking = useMemo(() => {
    const list = MOCK_PLAYERS.map((p) => ({ ...p }));
    if (user) list.push({ name: user.name, respect: prog.respect, color: user.color, me: true });
    return list.sort((a, b) => b.respect - a.respect);
  }, [user, prog.respect]);

  return useMemo(() => ({ user, prog, ranking, statValue, achProgress, ...api }), [user, prog, ranking, api]);
}

function Avatar({ user, size = 32 }) {
  return (
    <span className="inline-grid place-items-center rounded-full font-display text-black shrink-0" style={{ width: size, height: size, background: user.color, fontSize: size * 0.48, boxShadow: `0 0 12px -2px ${user.color}` }} aria-hidden="true">
      {user.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function LoginModal({ reason, onClose, onLogin }) {
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState(null);
  const [name, setName] = useState(() => `jogador_${Math.floor(1000 + Math.random() * 9000)}`);
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [cite, setCite] = useState(true);
  const valid = /^[a-z0-9_]{3,20}$/i.test(name) && age && terms;
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-6 relative !border-pink-500/40" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Entrar no Estrela6">
        <button onClick={onClose} className="absolute top-3 right-3 icon-btn" aria-label="Fechar"><IconClose className="w-5 h-5" /></button>
        <p className="font-mono text-[10px] tracking-[0.3em] text-sunset">// CONTA ESTRELA6</p>
        <h3 className="font-display uppercase text-3xl text-white mb-1">{step === 1 ? 'Entrar' : 'Criar seu perfil'}</h3>
        {reason && step === 1 && <p className="text-sm text-zinc-300 mb-3">{reason}</p>}
        {step === 1 ? (
          <div className="space-y-2 mt-3">
            {[['discord', 'Entrar com Discord', '#5865F2'], ['google', 'Entrar com Google', '#ffffff']].map(([id, label, c]) => (
              <button key={id} onClick={() => { setProvider(id); setStep(2); }}
                className="w-full flex items-center justify-center gap-2 rounded-lg border py-2.5 font-semibold transition hover:brightness-110"
                style={{ borderColor: `${c}88`, background: `${c}1f`, color: id === 'google' ? '#fff' : '#c7cbff' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: c }} />{label}
              </button>
            ))}
            <p className="text-xs text-zinc-500 pt-2">Protótipo: o login é simulado e fica só neste navegador. No site final, Discord/Google via Laravel Socialite, sem senha própria.</p>
          </div>
        ) : (
          <form className="space-y-3 mt-3" onSubmit={(e) => { e.preventDefault(); if (valid) onLogin({ name, provider, cite }); }}>
            <label className="block">
              <span className="field-label">Apelido</span>
              <input value={name} onChange={(e) => setName(e.target.value.replace(/\s/g, '_'))} maxLength={20}
                className="w-full bg-black/40 border border-zinc-700 focus:border-neon rounded-lg px-3 py-2 text-white outline-none" aria-describedby="nick-hint" />
              <span id="nick-hint" className="block text-[11px] text-zinc-500 mt-1">3 a 20 caracteres: letras, números e _</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-zinc-300"><input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} className="mt-1 accent-pink-500" />Tenho 16 anos ou mais</label>
            <label className="flex items-start gap-2 text-sm text-zinc-300"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 accent-pink-500" />Li e aceito os termos de uso e a política de privacidade (sem leaks, sem conteúdo ofensivo)</label>
            <label className="flex items-start gap-2 text-sm text-zinc-300"><input type="checkbox" checked={cite} onChange={(e) => setCite(e.target.checked)} className="mt-1 accent-pink-500" />A Rádio Estrela6 pode citar meu apelido no ar</label>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setStep(1)} className="btn-ghost">Voltar</button>
              <button type="submit" disabled={!valid} className="btn-neon flex-1 disabled:opacity-40">Criar perfil</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SfxToggle() {
  const [on, setOn] = useState(sfxEnabled);
  return (
    <label className="flex items-start justify-between gap-3 text-sm text-zinc-300 cursor-pointer">
      <span>Efeitos sonoros ao ganhar pontos</span>
      <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); setSfxEnabled(e.target.checked); if (e.target.checked) playSfx('points'); }} className="mt-1 accent-pink-500" />
    </label>
  );
}

function ChallengeRow({ c, st }) {
  const p = Math.min(1, st.n / c.goal);
  return (
    <div className={`rounded-lg border p-3 ${st.done ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800'}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white">{st.done && '✓ '}{c.text}</p>
        <span className={`font-mono text-[11px] shrink-0 ${st.done ? 'text-emerald-400' : 'text-neon'}`}>+{c.reward}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden"><div className={`h-full ${st.done ? 'bg-emerald-400' : 'bg-neon'}`} style={{ width: `${p * 100}%` }} /></div>
        <span className="font-mono text-[10px] text-zinc-500">{Math.min(st.n, c.goal)}/{c.goal}</span>
      </div>
    </div>
  );
}

function ChallengesCard({ prog, now }) {
  const groups = [
    { label: 'Diários', list: dailyChallenges(now), left: dayEndsIn(now) },
    { label: 'Da semana', list: weeklyChallenges(now), left: weekEndsIn(now) },
  ];
  const fmtLeft = (ms) => { const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60; return d ? `${d}d ${h}h` : `${h}h ${m}min`; };
  return (
    <div className="glass-card p-5 space-y-4">
      <h2 className="font-display uppercase text-2xl text-white">Desafios</h2>
      {groups.map((g) => (
        <div key={g.label}>
          <div className="flex items-baseline justify-between mb-2">
            <p className="font-mono text-[11px] tracking-widest text-zinc-400">{g.label.toUpperCase()}</p>
            <span className="font-mono text-[10px] text-zinc-500">renova em {fmtLeft(g.left)}</span>
          </div>
          <div className="space-y-2">
            {g.list.map((c) => <ChallengeRow key={c.id} c={c} st={prog.challenges[`${c.scope}:${c.key}`]?.[c.id] || { n: 0, done: false }} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function AchievementsCard({ game }) {
  const [cat, setCat] = useState('all');
  const { prog, achProgress, statValue } = game;
  const unlocked = prog.achievements.length;
  const list = ACHIEVEMENTS.filter((a) => cat === 'all' || a.cat === cat);
  const countOf = (c) => ACHIEVEMENTS.filter((a) => a.cat === c && prog.achievements.includes(a.id)).length;
  return (
    <div className="glass-card p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display uppercase text-2xl text-white">Conquistas</h2>
        <span className="font-mono text-[11px] text-zinc-400"><span className="text-yellow-300">{unlocked}</span> de {ACHIEVEMENTS.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3" role="tablist" aria-label="Categorias de conquistas">
        {[{ id: 'all', label: 'Todas' }, ...ACH_CATEGORIES].map((c) => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)}
            className={`text-[11px] px-2 py-1 rounded-md border transition ${cat === c.id ? 'border-yellow-400/70 text-yellow-300 bg-yellow-400/10' : 'border-zinc-700 text-zinc-400 hover:text-white'}`}>
            {c.label}{c.id !== 'all' && <span className="opacity-60 ml-1">{countOf(c.id)}/{ACHIEVEMENTS.filter((a) => a.cat === c.id).length}</span>}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[34rem] overflow-y-auto pr-1">
        {list.map((a) => {
          const p = achProgress(a), done = p >= 1, tier = TIERS.find((t) => t.id === a.tier);
          const hidden = a.secret && !done;
          const cur = Math.min(statValue(a.stat), a.goal);
          return (
            <div key={a.id} className={`rounded-lg border p-3 relative ${done ? 'bg-white/[.03]' : 'border-zinc-800 opacity-80'}`} style={{ borderColor: done ? `${tier.color}88` : undefined }} title={hidden ? 'Conquista secreta' : a.desc}>
              <span className="absolute top-2 right-2 font-mono text-[9px] tracking-wider" style={{ color: tier.color }}>{tier.label.toUpperCase()}</span>
              <div className={`text-2xl ${done ? '' : 'grayscale opacity-50'}`} aria-hidden="true">{hidden ? '❔' : a.icon}</div>
              <p className={`text-sm font-semibold mt-1 ${done ? '' : 'text-zinc-300'}`} style={{ color: done ? tier.color : undefined }}>{hidden ? '???' : a.name}</p>
              <p className="text-[11px] text-zinc-500 leading-snug">{hidden ? 'Conquista secreta. Explore para descobrir.' : a.desc}</p>
              {!done && !hidden && (
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden"><div className="h-full bg-zinc-400" style={{ width: `${p * 100}%` }} /></div>
                  <span className="font-mono text-[9px] text-zinc-500">{cur}/{a.goal}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfilePage({ game, regions, regionTotals, markers, onLogin }) {
  const { user, prog, ranking, achProgress } = game;
  const now = useNow(60000);
  const [askDelete, setAskDelete] = useState(false);
  if (!user) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="font-mono text-xs tracking-[0.3em] text-sunset">// PERFIL</p>
        <h1 className="font-display uppercase text-5xl text-white mt-1">Entre para jogar</h1>
        <p className="text-zinc-400 mt-3 max-w-lg mx-auto">Com uma conta você marca pins, ganha <span className="text-white">Respeito</span>, sobe o seu nível de procurado, completa missões semanais e pode até ser citado na rádio.</p>
        <button onClick={onLogin} className="btn-neon mt-6">Entrar com Discord ou Google</button>
      </section>
    );
  }
  const stars = starsOf(prog.respect), trust = trustOf(prog.respect), nxt = nextLevel(prog.respect);
  const prevT = LEVELS[stars - 1] || 0;
  const pct = nxt ? Math.round(((prog.respect - prevT) / (nxt - prevT)) * 100) : 100;
  const mine = markers.filter((m) => m.author === user.name);
  const pos = ranking.findIndex((r) => r.me) + 1;
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 0% 0%, ${user.color}33, transparent 55%)` }} />
        <div className="relative flex flex-col md:flex-row md:items-center gap-5">
          <Avatar user={user} size={72} />
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] tracking-[0.3em] text-zinc-500">PERFIL · VIA {user.provider.toUpperCase()}</p>
            <h1 className="font-display uppercase text-4xl md:text-5xl text-white leading-none truncate">@{user.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <Wanted level={stars} />
              <span className="font-mono text-xs px-2 py-0.5 rounded border border-cyan-400/50 text-cyber">{trust.label.toUpperCase()}</span>
              <span className="font-mono text-xs text-zinc-400">#{pos} no ranking</span>
            </div>
            <p className="text-sm text-zinc-400 mt-1">{trust.perk}</p>
          </div>
          <div className="md:text-right">
            <p className="font-display text-5xl text-white leading-none">{prog.respect}</p>
            <p className="font-mono text-xs tracking-widest text-neon">RESPEITO</p>
            <div className="mt-2 w-56 max-w-full h-2 rounded-full bg-zinc-800 overflow-hidden md:ml-auto" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso até o próximo nível">
              <div className="h-full bg-gradient-to-r from-pink-500 to-orange-400" style={{ width: `${pct}%` }} />
            </div>
            <p className="font-mono text-[10px] text-zinc-500 mt-1">{nxt ? `${nxt - prog.respect} para ${'★'.repeat(stars + 1)}` : 'Nível máximo'}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
        <div className="space-y-6">
          <ChallengesCard prog={prog} now={now} />
          <AchievementsCard game={game} />

          <div className="glass-card p-5">
            <h2 className="font-display uppercase text-2xl text-white mb-3">Exploração</h2>
            <div className="space-y-2">
              {(regions || []).map((r) => {
                const v = (prog.visited[r.id] || []).length, t = regionTotals[r.id] || 1, p = Math.round((v / t) * 100);
                return (
                  <a key={r.id} href={`#regiao-${r.id}`} className="block group">
                    <div className="flex justify-between text-sm"><span className="text-zinc-200 group-hover:text-white">{r.name}</span><span className="font-mono text-[11px] text-zinc-500">{v}/{t} locais · {p}%</span></div>
                    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden mt-1"><div className="h-full" style={{ width: `${p}%`, background: r.color }} /></div>
                  </a>
                );
              })}
            </div>
            <p className="text-[11px] text-zinc-500 mt-3">Um local conta como visitado quando você abre a ficha dele no mapa.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-5">
            <h2 className="font-display uppercase text-2xl text-white mb-3">Ranking</h2>
            <ol className="space-y-1">
              {ranking.map((r, i) => (
                <li key={r.name} className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${r.me ? 'bg-pink-500/10 border border-pink-500/40' : ''}`}>
                  <span className={`w-6 text-right font-display ${i < 3 ? 'text-yellow-300' : 'text-zinc-500'}`}>{i + 1}</span>
                  <Avatar user={r} size={24} />
                  <span className={`flex-1 truncate text-sm ${r.me ? 'text-white font-semibold' : 'text-zinc-300'}`}>@{r.name}</span>
                  <span className="text-[10px] text-yellow-300 tracking-tighter">{'★'.repeat(starsOf(r.respect))}</span>
                  <span className="font-mono text-[11px] text-zinc-400 w-12 text-right">{r.respect}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="glass-card p-5">
            <h2 className="font-display uppercase text-2xl text-white mb-3">Seus pins</h2>
            {mine.length === 0 ? (
              <p className="text-sm text-zinc-400">Nenhum ainda. No mapa, clique com o <span className="text-white">botão direito</span> onde você descobriu algo.</p>
            ) : (
              <ul className="space-y-1.5">
                {mine.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full" style={{ background: MARKER_CATS[m.category].color }} />
                    <a href={`#pin-${m.id}`} className="flex-1 truncate text-zinc-200 hover:text-white">{m.title}</a>
                    {m.is_approved
                      ? <span className="font-mono text-[10px] text-emerald-400">{m.confirmations || 0} conf.</span>
                      : <span className="font-mono text-[10px] text-yellow-400">EM ANÁLISE</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass-card p-5">
            <h2 className="font-display uppercase text-2xl text-white mb-3">Últimos pontos</h2>
            {prog.log.length === 0 ? <p className="text-sm text-zinc-400">Pontos aparecem quando alguém valida o que você fez.</p> : (
              <ul className="space-y-1">
                {prog.log.slice(0, 8).map((l, i) => (
                  <li key={i} className="flex justify-between gap-2 text-sm"><span className="text-zinc-300 truncate">{l.why}</span><span className="font-mono text-emerald-400 shrink-0">+{l.pts}</span></li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass-card p-5 space-y-3">
            <h2 className="font-display uppercase text-2xl text-white">Preferências e privacidade</h2>
            <label className="flex items-start justify-between gap-3 text-sm text-zinc-300 cursor-pointer">
              <span>A rádio pode citar meu apelido no ar</span>
              <input type="checkbox" checked={!!user.cite} onChange={(e) => game.setCite(e.target.checked)} className="mt-1 accent-pink-500" />
            </label>
            <SfxToggle />
            <div className="flex gap-2">
              <button onClick={game.logout} className="btn-ghost flex-1">Sair</button>
              {askDelete
                ? <button onClick={game.deleteAccount} className="flex-1 rounded-lg bg-red-500/20 border border-red-500 text-red-300 text-sm font-semibold">Confirmar exclusão</button>
                : <button onClick={() => setAskDelete(true)} className="flex-1 rounded-lg border border-red-500/50 text-red-400 text-sm hover:bg-red-500/10">Excluir conta</button>}
            </div>
            <p className="text-[11px] text-zinc-500">LGPD: você pode baixar ou apagar seus dados a qualquer momento.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --- Roteiro da locução (inglês). No Laravel: falas no Filament + IA + voz gravada --- */
const pickOf = (arr, seed) => arr[Math.abs(seed) % arr.length];
const clockEN = () => { const d = new Date(), h = d.getHours() % 12 || 12, m = d.getMinutes(); return `${h}${m ? `:${String(m).padStart(2, '0')}` : ''} ${d.getHours() < 12 ? 'AM' : 'PM'}`; };
function radioScript({ station, show, track, next, force }, { posts, spoil, markers, regions, user, respect, ranking }) {
  const seed = track.id * 7 + new Date().getHours() * 13 + new Date().getMinutes();
  const by = (t) => (t.artist ? ` by ${t.artist}` : '');
  const host = show.kind === 'musica' ? show.host : track.host_name;
  const kind = force || (show.kind === 'falado' ? 'news' : show.kind === 'comunidade' ? 'recado' : ['banter', 'ad', 'banter', 'weather'][seed % 4]);
  if (kind === 'news') {
    // manchetes do feed: nunca leak, nunca o que está escondido pela proteção contra spoilers
    const ok = posts.filter((p) => p.is_published && p.headline_en && p.reliability?.level !== 'nao-verificado' && p.spoiler !== 'leak' && !spoil?.isHidden(p.spoiler, `post:${p.id}`));
    const a = ok[seed % ok.length], b = ok[(seed + 3) % ok.length];
    const pins = markers.filter((m) => m.is_approved && m.title_en && !(PIN_SPOILER[m.category] && spoil?.hide[PIN_SPOILER[m.category]]));
    const top = [...pins].sort((x, y) => (y.confirmations || 0) - (x.confirmations || 0))[0];
    const rname = top && regions ? regionAt(regions, top.coord_x, top.coord_y)?.name : null;
    const parts = [`This is Six Star News at ${clockEN()}.`, a && `${a.headline_en}.`, b && b !== a && `Also today: ${b.headline_en.charAt(0).toLowerCase()}${b.headline_en.slice(1)}.`,
      top && `On the community map, the most confirmed find is ${top.title_en}${rname ? `, in ${rname}` : ''}, with ${top.confirmations} confirmations.`,
      `In other news, ${pickOf(KICKERS, seed).charAt(0).toLowerCase()}${pickOf(KICKERS, seed).slice(1)}`,
      `Back to the music with ${track.title}${by(track)}.`];
    return { kind: 'news', title: 'Six Star News', host: 'Redação 6★', text: parts.filter(Boolean).join(' ') };
  }
  if (kind === 'recado') {
    const r = pickOf(RECADOS, seed);
    const lead = ranking?.[0];
    const parts = [`It's ${show.name} on ${station.name}! Shout-out time. ${r.from} ${r.text}`,
      lead && `Leading this week's ranking: ${lead.me ? 'you, ' : ''}${lead.name.replace(/_/g, ' ')}, with ${lead.respect} respect.`,
      user?.cite && respect > 0 && !lead?.me && `And a big hello to ${user.name.replace(/_/g, ' ')}, already at ${respect} respect. Keep it up!`,
      `Here's ${track.title}${by(track)}.`];
    return { kind: 'recado', title: show.name, host, text: parts.filter(Boolean).join(' ') };
  }
  if (kind === 'ad') {
    return { kind: 'ad', title: 'Commercial break', host: 'Commercial', text: `${pickOf(ADS, seed)} ... ${station.freq}, ${station.name}. Now: ${track.title}${by(track)}.` };
  }
  if (kind === 'weather') {
    return { kind: 'weather', title: `${station.name} · weather`, host, text: `${station.freq}, ${station.name}. It's ${clockEN()}. ${pickOf(WEATHER, seed)} Now, ${track.title}${by(track)}.` };
  }
  const intro = pickOf([`${station.freq}, ${station.name}. ${TAGLINES[station.id]}`, `You're listening to ${show.name} with ${host}, on ${station.name}.`, `${station.name}, ${station.freq}. ${host} with you.`], seed);
  return { kind: 'banter', title: `${station.name} · ${host}`, host, text: `${intro} ${pickOf(BANTER[station.id], seed)} Here's ${track.title}${by(track)}${next ? `, and after that, ${next.title}` : ''}.` };
}

/* ------------------------------------------------------------------ */
/* Busca global (Ctrl + K)                                             */
/* ------------------------------------------------------------------ */

const PAGES = [
  { id: 'feed', label: 'Feed', sub: 'Notícias, teorias, easter eggs e shorts', words: 'feed noticias inicio home posts' },
  { id: 'mapa', label: 'Mapa Interativo', sub: 'Locais, regiões e pins da comunidade', words: 'mapa map locais pins' },
  { id: 'radio', label: 'Rádio Estrela6', sub: 'Estações, grade de programação', words: 'radio musica estacoes grade programacao' },
  { id: 'spoilers', label: 'Proteção contra spoilers', sub: 'Escolha o que fica escondido', words: 'spoiler protecao escudo leak' },
];

function scoreText(text, terms, qFull) {
  const n = normalize(text);
  if (!terms.every((t) => n.includes(t))) return 0;
  if (n.startsWith(qFull)) return 4;
  if (n.split(/[\s\-·,]+/).some((w) => w.startsWith(terms[0]))) return 3;
  return 1;
}

function CommandPalette({ onClose, onPick, posts, landmarks, regions, markers, spoil, fogged }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const nq = normalize(q).trim();
  const terms = nq.split(/\s+/).filter(Boolean);
  const h = hourOf();

  const { groups, hidden } = useMemo(() => {
    let hidden = 0;
    const pick = (arr, max) => arr.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, max);
    const sc = (t) => (terms.length ? scoreText(t, terms, nq) : 0);
    const pages = PAGES.map((p) => ({ type: 'page', id: p.id, title: p.label, sub: p.sub, score: terms.length ? sc(`${p.label} ${p.words}`) : 1 }));
    const regs = (regions || []).map((r) => ({ type: 'region', id: r.id, title: r.name, sub: fogged.has(r.id) ? 'Região · ainda não explorada' : 'Região · abrir no mapa', score: terms.length ? sc(r.name) : 0.5 }));
    const ps = [];
    for (const p of posts) {
      const s = sc(`${p.title} ${p.excerpt}`);
      if (!s) continue;
      if (spoil.isHidden(p.spoiler, `post:${p.id}`)) { hidden++; continue; }
      ps.push({ type: 'post', id: p.id, post: p, title: p.title, sub: `${CATEGORY_TAG[p.category].label} · ${fmtDate(p.created_at)}`, score: s, color: RELIABILITY[p.reliability?.level]?.color });
    }
    const lms = [];
    if (terms.length) for (const lm of landmarks || []) {
      const s = sc(`${lm[1]} ${lm[2]} ${lm[3]}`);
      if (!s) continue;
      if ((spoil.hide.leak && lm[8].includes('u')) || (fogged.size && (fogged.has(lm[10]) || !lm[10]))) { hidden++; continue; }
      lms.push({ type: 'lm', id: lm[0], lm, title: lm[1], sub: `${BLIP_TYPES[lm[7]].label} · ${[lm[2], lm[3]].filter(Boolean).join(', ')}`, score: s + (3 - lm[9]) * 0.1 });
    }
    const pins = [];
    if (terms.length) for (const m of markers) {
      if (!m.is_approved) continue;
      const s = sc(`${m.title} ${m.description}`);
      if (!s) continue;
      const t = PIN_SPOILER[m.category];
      if (t && spoil.hide[t]) { hidden++; continue; }
      const r = regions ? regionAt(regions, m.coord_x, m.coord_y) : null;
      if (r && fogged.has(r.id)) { hidden++; continue; }
      pins.push({ type: 'pin', id: m.id, title: m.title, sub: `Pin da comunidade · ${MARKER_CATS[m.category].label}`, score: s, color: MARKER_CATS[m.category].color });
    }
    const sts = STATIONS.map((st) => {
      const cur = showAt(st, h);
      const showHit = st.shows.find((sh) => sc(`${sh.name} ${sh.host}`));
      const s = terms.length ? Math.max(sc(`${st.name} ${st.freq} ${st.genre} ${st.region}`), showHit ? 2 : 0) : 0.5;
      return { type: 'station', id: st.id, title: `${st.freq} ${st.name}`, sub: showHit && terms.length ? `Programa: ${showHit.name} · ${fmtH(showHit.start)}–${fmtH(showHit.end)}` : `${st.genre} · no ar: ${cur.name}`, score: s, color: st.color };
    });
    const g = [
      ['Páginas', pick(pages, terms.length ? 3 : 4)],
      ['Posts', pick(ps, 5)],
      ['Regiões', pick(regs, terms.length ? 3 : 6)],
      ['Locais no mapa', pick(lms, 6)],
      ['Pins da comunidade', pick(pins, 3)],
      ['Rádio', pick(sts, terms.length ? 3 : 5)],
    ].filter(([, items]) => items.length);
    if (terms.length && nq.length >= 3) g.push(['No mapa', [{ type: 'mapsearch', id: q, title: `Buscar no mapa: “${q.trim()}”`, sub: 'Entende frases como “posto perto da praia” ou “marina em leonida keys”', score: 1 }]]);
    return { groups: g, hidden };
  }, [nq, posts, landmarks, regions, markers, spoil, fogged]);

  const flat = groups.flatMap(([, items]) => items);
  useEffect(() => { setSel(0); }, [nq]);
  useEffect(() => { listRef.current?.querySelector('[data-sel="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((i) => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && flat[sel]) { e.preventDefault(); onPick(flat[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };
  const icon = (it) => {
    if (it.type === 'lm') return <Blip type={it.lm[7]} size={20} />;
    if (it.type === 'pin' || it.type === 'region' || it.type === 'mapsearch') return <IconPin className="w-4 h-4" style={{ color: it.color || '#00f0ff' }} />;
    if (it.type === 'station') return <IconRadio className="w-4 h-4" style={{ color: it.color }} />;
    if (it.type === 'post') return <IconFeed className="w-4 h-4" style={{ color: it.color || '#a1a1aa' }} />;
    return <span className="w-4 h-4 grid place-items-center text-neon">›</span>;
  };

  let idx = -1;
  return (
    <div className="fixed inset-0 z-[3000] flex items-start justify-center p-4 pt-[12vh] bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card w-full max-w-xl overflow-hidden !border-pink-500/40 shadow-[0_0_60px_-20px_#ff007f]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Busca global">
        <div className="flex items-center gap-3 px-4 border-b border-white/10">
          <SearchIcon className="w-5 h-5 text-neon shrink-0" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Buscar posts, locais, regiões, estações…" aria-label="Buscar em todo o portal"
            role="combobox" aria-expanded="true" aria-controls="cmd-list" aria-activedescendant={flat[sel] ? `cmd-${sel}` : undefined}
            className="flex-1 bg-transparent py-4 text-white placeholder-zinc-500 outline-none" />
          <span className="kbd">ESC</span>
        </div>
        <div ref={listRef} id="cmd-list" role="listbox" className="max-h-[56vh] overflow-y-auto p-2">
          {groups.length === 0 && <p className="px-3 py-8 text-center text-sm text-zinc-500">Nada encontrado para “{q}”.</p>}
          {groups.map(([label, items]) => (
            <div key={label} className="mb-1">
              <p className="px-3 pt-2 pb-1 font-mono text-[10px] tracking-[0.25em] text-zinc-500">{label.toUpperCase()}</p>
              {items.map((it) => {
                idx++;
                const i = idx, on = i === sel;
                return (
                  <button key={`${it.type}-${it.id}`} id={`cmd-${i}`} role="option" aria-selected={on} data-sel={on}
                    onMouseMove={() => sel !== i && setSel(i)} onClick={() => onPick(it)} className={`cmd-item ${on ? 'cmd-item--on' : ''}`}>
                    <span className="w-6 grid place-items-center shrink-0">{icon(it)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-white truncate">{it.title}</span>
                      <span className="block font-mono text-[10px] text-zinc-500 truncate">{it.sub}</span>
                    </span>
                    {on && <span className="font-mono text-[10px] text-zinc-500 shrink-0">↵</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t border-white/10 font-mono text-[10px] text-zinc-500">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> navegar · <span className="kbd">↵</span> abrir</span>
          {hidden > 0 && <span className="text-red-400">{hidden} resultado{hidden === 1 ? '' : 's'} escondido{hidden === 1 ? '' : 's'} pela proteção contra spoilers</span>}
        </div>
      </div>
    </div>
  );
}

// #feed, #mapa, #radio, #local-L13 (local do mapa), #pin-3 (pin da comunidade), #regiao-vice-city e #radio-neon (estação)
const focusFromHash = () => {
  const h = (location.hash || '').replace('#', '');
  const m = h.match(/^(local|pin)-([A-Za-z0-9]+)$/);
  if (m) return { kind: m[1] === 'pin' ? 'pin' : 'lm', id: m[2], key: Date.now() };
  const r = h.match(/^regiao-([a-z0-9-]+)$/);
  return r ? { kind: 'region', id: r[1], key: Date.now() } : null;
};
const stationFromHash = () => {
  const m = (location.hash || '').match(/^#radio-([a-z]+)$/);
  return m && STATION_BY_ID[m[1]] ? m[1] : null;
};
const viewFromHash = () => {
  const h = (location.hash || '').replace('#', '');
  if (focusFromHash()) return 'mapa';
  if (stationFromHash()) return 'radio';
  return VIEWS.includes(h) ? h : 'feed';
};

export default function App() {
  const [view, setView] = useState(viewFromHash);
  const [focus, setFocus] = useState(focusFromHash);
  const selfHash = useRef(null);
  const [openPost, setOpenPost] = useState(null);
  const [markers, setMarkers] = useState(MARKERS);
  // feed em estado: artigos da comunidade e itens da coleta entram como "pending" (pauta)
  const [posts, setPosts] = useState(() => [...POSTS, ...COLETA_EXEMPLOS()]);
  const [writing, setWriting] = useState(false);
  const [pautaOpen, setPautaOpen] = useState(false);
  const [mapImage] = useState(DEFAULT_MAP);
  const [landmarks, setLandmarks] = useState(null);
  const [regions, setRegions] = useState(null);
  useEffect(() => { fetch('regions.json').then((r) => r.json()).then(setRegions).catch(() => setRegions([])); }, []);

  // Proteção contra spoilers
  const [spoilers, setSpoilers] = useState(() => loadSpoilers() || DEFAULT_SPOILERS);
  const [spoilerOpen, setSpoilerOpen] = useState(() => !(loadSpoilers()?.chosen));
  const [shield, setShield] = useState(false);
  const [revealed, setRevealed] = useState(() => new Set());
  const saveSp = (v) => { setSpoilers(v); saveSpoilers(v); };
  const openSpoilers = useCallback(() => setSpoilerOpen(true), []);
  const hide = shield ? { historia: true, easter: true, leak: true } : spoilers.hide;
  const spoil = useMemo(() => ({
    hide,
    isHidden: (type, key) => !!type && !!hide[type] && !revealed.has(key),
    reveal: (key) => setRevealed((s) => new Set(s).add(key)),
    label: shield ? 'Escudo rápido ligado' : spoilers.preset === 'custom' ? 'Personalizado' : SPOILER_PRESETS[spoilers.preset].label,
  }), [hide.historia, hide.easter, hide.leak, revealed, shield, spoilers.preset]);
  // conjunto estável: só muda quando as regiões cobertas realmente mudam (evita redesenhar o mapa à toa)
  const fogKey = spoilers.fog && regions ? regions.filter((r) => !spoilers.visited.includes(r.id)).map((r) => r.id).join(',') : '';
  const fogged = useMemo(() => new Set(fogKey ? fogKey.split(',') : []), [fogKey]);
  const revealRegion = useCallback((id) => {
    setSpoilers((sp) => { const v = { ...sp, visited: [...new Set([...sp.visited, id])] }; saveSpoilers(v); return v; });
  }, []);
  const spoilerInfo = shield
    ? { label: 'Escudo ligado', color: '#ff007f' }
    : spoilers.preset === 'custom' ? { label: 'Personalizado', color: '#c084fc' } : { label: SPOILER_PRESETS[spoilers.preset].label, color: SPOILER_PRESETS[spoilers.preset].color };
  useEffect(() => {
    fetch('landmarks.json').then((r) => r.json()).then(setLandmarks).catch((e) => { console.error(e); setLandmarks([]); });
  }, []);
  const [toastData, setToastData] = useState(null);
  const player = usePlayer();
  const toastTimer = useRef(null);
  const playerRef = useRef(player); playerRef.current = player;
  const markersRef = useRef(markers); markersRef.current = markers;
  const postsRef = useRef(posts); postsRef.current = posts;
  const spoilRef = useRef(null);
  const regionsRef = useRef(regions); regionsRef.current = regions;

  // Rádio por região: o mapa informa a recepção no centro da tela
  // Sintonia: enquanto arrasta só ajusta o sinal (suave); a troca de estação
  // acontece uma única vez, quando o mapa para e a nova região se confirma.
  const switchRef = useRef({ timer: null, last: 0 });
  // o mapa atualiza o endereço ao selecionar um local (o link da página aponta para ele)
  const onSelectHash = useCallback((name) => {
    if (location.hash === `#${name}`) return;
    selfHash.current = name;
    try { location.replace(`#${name}`); } catch (e) { /* sem acesso ao endereço: ignora */ }
  }, []);

  const onReception = useCallback((rec, phase = 'end') => {
    const p = playerRef.current, sw = switchRef.current;
    clearTimeout(sw.timer);
    if (!rec) { p.setStatic(0); return; }
    const here = rec.station === p.station.id;
    // fora da área da estação atual o sinal enfraquece, mas sem estourar
    p.setStatic(here ? rec.staticAmt : Math.min(0.5, 0.25 + rec.staticAmt * 0.3));
    if (!p.autoTune || here || !rec.clear || phase !== 'end') return;
    const wait = Math.max(650, 1600 - (performance.now() - sw.last));   // no máx. 1 troca a cada ~1,6 s
    sw.timer = setTimeout(() => {
      const q = playerRef.current;
      if (!q.autoTune || rec.station === q.station.id) return;
      sw.last = performance.now();
      q.tune(rec.station, { auto: true });
      q.setStatic(rec.staticAmt);
    }, wait);
  }, []);

  const applyHash = useCallback(() => {
    setView(viewFromHash());
    setFocus(focusFromHash());
    const st = stationFromHash();
    if (st) playerRef.current.tune(st);
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace('#', '');
      if (selfHash.current && h === selfHash.current) { selfHash.current = null; return; }   // mudança feita pelo próprio mapa (ao abrir um popup)
      applyHash();
    };
    window.addEventListener('hashchange', onHash);
    const st = stationFromHash();
    if (st) playerRef.current.tune(st);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Busca global
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mapQuery, setMapQuery] = useState(null);
  const go = useCallback((h) => {
    if (location.hash === `#${h}`) applyHash();
    else location.hash = h;
  }, [applyHash]);
  const onPick = useCallback((it) => {
    setCmdOpen(false);
    if (gameRef.current?.user) gameRef.current.search();
    if (it.type === 'page') return it.id === 'spoilers' ? setSpoilerOpen(true) : go(it.id);
    if (it.type === 'post') return setOpenPost(it.post);
    if (it.type === 'region') return go(`regiao-${it.id}`);
    if (it.type === 'lm') return go(`local-${it.id}`);
    if (it.type === 'pin') return go(`pin-${it.id}`);
    if (it.type === 'station') return go(`radio-${it.id}`);
    if (it.type === 'mapsearch') { setMapQuery({ text: it.id, key: Date.now() }); go('mapa'); }
  }, [go]);
  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(e.target.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdOpen((v) => !v); }
      else if (e.key === '/' && !typing) { e.preventDefault(); setCmdOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toastQueue = useRef([]);
  const showNextToast = useCallback(() => {
    const d = toastQueue.current.shift();
    if (!d) { setToastData(null); toastTimer.current = null; return; }
    setToastData({ ...d, key: Date.now() + Math.random() });
    toastTimer.current = setTimeout(showNextToast, 2600);
  }, []);
  const toast = useCallback((d) => {
    toastQueue.current.push(d);
    if (!toastTimer.current) showNextToast();
  }, [showNextToast]);

  // Conta + gamificação
  const regionTotals = useMemo(() => {
    const t = {};
    (landmarks || []).forEach((lm) => { if (lm[10]) t[lm[10]] = (t[lm[10]] || 0) + 1; });
    return t;
  }, [landmarks]);
  const game = useGame({ toast, regionTotals });
  const gameRef = useRef(game); gameRef.current = game;
  useEffect(() => { if (player.playing && game.user) game.listen(player.station.id); }, [player.playing, player.station.id, game.user?.name]);
  useEffect(() => { game.touch(); }, [game.user?.name]);
  // tempo ouvido: soma a cada 30 s com a rádio tocando
  useEffect(() => {
    if (!player.playing || !game.user) return;
    const t = setInterval(() => gameRef.current.listenTick(30), 30000);
    return () => clearInterval(t);
  }, [player.playing, game.user?.name]);
  useEffect(() => { if (player.onAir?.kind === 'news' && player.playing && game.user) game.news(); }, [player.onAir?.key]);
  spoilRef.current = spoil;
  // textos da locução: usam o feed (sem spoiler escondido e sem leak), o mapa e o ranking
  useEffect(() => {
    player.setScript((ctx) => radioScript(ctx, {
      posts: postsRef.current, spoil: spoilRef.current, markers: markersRef.current, regions: regionsRef.current,
      user: gameRef.current.user, respect: gameRef.current.prog.respect, ranking: gameRef.current.ranking,
    }));
  }, []);
  const [login, setLogin] = useState(null);       // { reason } quando o modal está aberto
  const requireLogin = useCallback((reason) => setLogin({ reason }), []);
  const lmById = useMemo(() => new Map((landmarks || []).map((lm) => [lm[0], lm])), [landmarks]);
  const lmRef = useRef(lmById); lmRef.current = lmById;
  useEffect(() => {
    const onVisit = (e) => { const lm = lmRef.current.get(e.detail); if (lm && gameRef.current.user) gameRef.current.visit(lm[0], lm[10]); };
    const onShare = () => gameRef.current.user && gameRef.current.share();
    const onConfirm = (e) => {
      const g = gameRef.current, id = +e.detail;
      if (!g.user) return setLogin({ reason: 'Para confirmar um pin você precisa de uma conta.' });
      setMarkers((ms) => ms.map((m) => (m.id === id && !m.confirmed_by_me ? { ...m, confirmations: (m.confirmations || 0) + 1, confirmed_by_me: true } : m)));
      g.confirmGiven();
    };
    const onPinView = (e) => { const g = gameRef.current; if (!g.user) return; if (e.detail === '1') g.flag('morse'); if (e.detail === '5') g.flag('jacare'); };
    window.addEventListener('lu:pinview', onPinView);
    window.addEventListener('lu:visit', onVisit);
    window.addEventListener('lu:share', onShare);
    window.addEventListener('lu:confirm', onConfirm);
    return () => { window.removeEventListener('lu:pinview', onPinView); window.removeEventListener('lu:visit', onVisit); window.removeEventListener('lu:share', onShare); window.removeEventListener('lu:confirm', onConfirm); };
  }, []);

  // Shift + S: escudo rápido (lives e gravações)
  useEffect(() => {
    const onKey = (e) => {
      if (!e.shiftKey || e.key.toLowerCase() !== 's' || /input|textarea|select/i.test(e.target.tagName)) return;
      setShield((v) => {
        toast({ title: v ? 'ESCUDO DESLIGADO' : 'ESCUDO LIGADO', sub: v ? 'Voltando às suas preferências' : 'Spoilers escondidos para a live', reward: '' });
        if (!v) gameRef.current?.flag('disfarce');
        return !v;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toast]);

  return (
    <div className="min-h-screen bg-vc-bg text-zinc-200 font-body">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(59,7,100,0.45),transparent_60%)]" />
      <div className="fixed inset-0 pointer-events-none scanlines" />
      <Navbar view={view} spoilerInfo={spoilerInfo} onSpoiler={() => setSpoilerOpen(true)} onSearch={() => setCmdOpen(true)}
        user={game.user} respect={game.prog.respect} onLogin={() => setLogin({ reason: null })} />
      <main className="relative pt-16 pb-20 md:pb-[4.5rem]">
        {view === 'feed' && <FeedPage posts={posts} markerCount={markers.filter((m) => m.is_approved).length} onOpen={setOpenPost} spoil={spoil} regions={regions}
          pautaCount={posts.filter((p) => p.status === 'pending').length} onPauta={() => setPautaOpen(true)}
          onWrite={() => (game.user ? setWriting(true) : setLogin({ reason: 'Para enviar um artigo você precisa de uma conta.' }))} />}
        {view === 'mapa' && <MapPageMemo markers={markers} setMarkers={setMarkers} toast={toast} mapImage={mapImage} landmarks={landmarks} player={player} onReception={onReception}
          regions={regions} spoil={spoil} fogged={fogged} onRevealRegion={revealRegion} onOpenSpoilers={openSpoilers}
          focus={focus} onSelectHash={onSelectHash} mapQuery={mapQuery} game={game} requireLogin={requireLogin} />}
        {view === 'radio' && <RadioPage player={player} />}
        {view === 'perfil' && <ProfilePage game={game} regions={regions} regionTotals={regionTotals} markers={markers} onLogin={() => setLogin({ reason: null })} />}
      </main>
      <RadioPlayer player={player} />
      <PostModal post={openPost} onClose={() => setOpenPost(null)} regions={regions} />
      <MissionToast data={toastData} />
      {writing && <ArticleModal regions={regions} onCancel={() => setWriting(false)} onSubmit={(f) => {
        const slug = slugify(f.title);
        setPosts((ps) => [...ps, { id: Date.now(), title: f.title.trim(), slug, excerpt: f.excerpt.trim(), content: f.content.trim(), category: f.category,
          region: f.region || null, place: null, spoiler: f.spoiler || null, source: f.source.trim() || null, cover_image: f.cover || null, media_url: null,
          author: game.user.name, mine: true, is_published: false, status: 'pending', hype: 2, created_at: new Date().toISOString() }]);
        setWriting(false);
        toast({ title: 'ARTIGO ENVIADO', sub: 'Está na pauta, aguardando aprovação', reward: '', sfx: 'notice' });
      }} />}
      {pautaOpen && <PautaDrawer posts={posts} regions={regions} game={game} onClose={() => setPautaOpen(false)}
        onApprove={(id, level) => {
          const p = posts.find((x) => x.id === id);
          setPosts((ps) => ps.map((x) => (x.id === id ? { ...x, status: 'published', is_published: true, created_at: new Date().toISOString(),
            reliability: { level, ...(x.source ? { source: { name: x.source_name || new URL(x.source).hostname, url: x.source } } : {}), ...(level === 'rumor' ? { confidence: 40 } : {}), basis: x.origin === 'coleta' ? `Coletado de ${x.source_name}` : `Enviado por @${x.author}` } } : x)));
          if (p?.mine && game.user) game.articleApproved();
          else toast({ title: 'PUBLICADO NO FEED', sub: 'Item da pauta publicado', reward: '', sfx: 'notice' });
        }}
        onReject={(id, reason) => {
          const p = posts.find((x) => x.id === id);
          setPosts((ps) => ps.filter((x) => x.id !== id));
          toast({ title: p?.mine ? 'ARTIGO RECUSADO' : 'REMOVIDO DA PAUTA', sub: `Motivo: ${reason}`, reward: '', sfx: 'notice' });
        }} />}
      {login && <LoginModal reason={login.reason} onClose={() => setLogin(null)} onLogin={(d) => { game.login(d); setLogin(null); }} />}
      <StationFlash flash={player.flash} />
      {cmdOpen && (
        <CommandPalette onClose={() => setCmdOpen(false)} onPick={onPick} posts={posts.filter((p) => p.is_published)} landmarks={landmarks}
          regions={regions} markers={markers} spoil={spoil} fogged={fogged} />
      )}
      {spoilerOpen && (
        <SpoilerModal value={spoilers} regions={regions} firstTime={!spoilers.chosen} shield={shield} setShield={setShield}
          onSave={(v) => { saveSp(v); setSpoilerOpen(false); }} onClose={() => setSpoilerOpen(false)} />
      )}
    </div>
  );
}
