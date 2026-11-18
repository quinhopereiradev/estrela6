// Gamificação do Estrela6.
// Regra de ouro: Respeito vem do que OUTRAS pessoas validam (pin aprovado, confirmado por outros)
// e de desafios (com teto diário/semanal). Conquistas são distintivos: mostram o que você fez.
// No Laravel: users, respect_events (ledger), user_stats, achievements, user_achievements, challenges, challenge_progress.

export const LEVELS = [0, 50, 150, 400, 1000];               // respeito mínimo para 1★..5★
export const starsOf = (r) => LEVELS.filter((t) => r >= t).length;
export const nextLevel = (r) => LEVELS.find((t) => t > r) ?? null;

export const TRUST = [
  { id: 'novato', min: 0, label: 'Novato', perk: 'Seus pins passam pela moderação antes de aparecer.' },
  { id: 'confiavel', min: 150, label: 'Confiável', perk: 'Seus pins vão direto para o mapa.' },
  { id: 'veterano', min: 400, label: 'Veterano', perk: 'Você pode ajudar a moderar pins de novatos.' },
];
export const trustOf = (r) => [...TRUST].reverse().find((t) => r >= t.min);

export const POINTS = { article_approved: 30, pin_approved: 25, first_discovery: 15, confirm_received: 5, confirm_given: 2 };

/* ---------------- Conquistas ---------------- */
export const TIERS = [
  { id: 'bronze', label: 'Bronze', color: '#d97706' },
  { id: 'prata', label: 'Prata', color: '#cbd5e1' },
  { id: 'ouro', label: 'Ouro', color: '#facc15' },
  { id: 'platina', label: 'Platina', color: '#67e8f9' },
];
export const ACH_CATEGORIES = [
  { id: 'descoberta', label: 'Descoberta' },
  { id: 'comunidade', label: 'Comunidade' },
  { id: 'exploracao', label: 'Exploração' },
  { id: 'radio', label: 'Rádio' },
  { id: 'social', label: 'Social' },
  { id: 'lealdade', label: 'Lealdade' },
  { id: 'secretas', label: 'Secretas' },
];

const REGION_NAMES = {
  'vice-city': 'Vice City', 'leonida-keys': 'Leonida Keys', grassrivers: 'Grassrivers',
  'port-gellhorn': 'Port Gellhorn', ambrosia: 'Ambrosia', 'mount-kalaga': 'Mount Kalaga',
};

// gera uma conquista por nível (bronze → platina)
function tiered(cat, id, icon, names, desc, stat, goals) {
  return goals.map((goal, i) => ({
    id: `${id}-${i + 1}`, cat, icon, tier: TIERS[i].id, stat, goal,
    name: names[Math.min(i, names.length - 1)], desc: desc(goal),
  }));
}

export const ACHIEVEMENTS = [
  // Descoberta
  ...tiered('descoberta', 'reporter', '📍', ['Primeiro passo', 'Repórter de campo', 'Correspondente', 'Lenda do mapa'], (n) => `Tenha ${n} ${n === 1 ? 'pin aprovado' : 'pins aprovados'}`, 'pinsApproved', [1, 5, 25, 100]),
  ...tiered('descoberta', 'pioneiro', '🏆', ['Primeiro a descobrir', 'Pioneiro', 'Desbravador'], (n) => `Seja o primeiro a marcar ${n} ${n === 1 ? 'ponto' : 'pontos'}`, 'firsts', [1, 5, 20]),
  ...tiered('descoberta', 'ovos', '🥚', ['Caçador de easter eggs', 'Farejador', 'Mestre dos segredos da Rockstar'], (n) => `Tenha ${n} easter ${n === 1 ? 'egg aprovado' : 'eggs aprovados'}`, 'eggsApproved', [1, 3, 10]),
  ...tiered('descoberta', 'motor', '🚗', ['Olho clínico', 'Colecionador de máquinas', 'Garagem lendária'], (n) => `Tenha ${n} ${n === 1 ? 'veículo raro aprovado' : 'veículos raros aprovados'}`, 'vehiclesApproved', [1, 5, 15]),
  ...tiered('descoberta', 'colunista', '📰', ['Colunista estreante', 'Colunista', 'Editor-chefe de Leonida'], (n) => `Tenha ${n} ${n === 1 ? 'artigo publicado' : 'artigos publicados'} no feed`, 'articlesApproved', [1, 5, 20]),
  ...tiered('descoberta', 'segredo', '🗝', ['Curioso', 'Investigador', 'Teórico da conspiração'], (n) => `Tenha ${n} ${n === 1 ? 'segredo aprovado' : 'segredos aprovados'}`, 'secretsApproved', [1, 5, 15]),
  // Comunidade
  ...tiered('comunidade', 'testemunha', '👁', ['Testemunha', 'Fonte confiável', 'Detector de mentiras', 'Cartório de Leonida'], (n) => `Confirme ${n} pins de outros jogadores`, 'confirmsGiven', [5, 25, 100, 500]),
  ...tiered('comunidade', 'influencia', '📢', ['Alguém viu', 'Comentado', 'Assunto do bairro', 'Celebridade local'], (n) => `Receba ${n} confirmações nos seus pins`, 'confirmsReceived', [10, 50, 250, 1000]),
  // Exploração: 3 níveis por região + gerais
  ...Object.entries(REGION_NAMES).flatMap(([rid, rname]) => tiered('exploracao', `regiao-${rid}`, '🧭',
    [`Turista em ${rname}`, `Morador de ${rname}`, `Lenda de ${rname}`], (n) => `Visite ${n}% dos locais de ${rname}`, `pct:${rid}`, [25, 50, 100])),
  ...tiered('exploracao', 'locais', '🗺', ['Saiu de casa', 'Andarilho', 'GPS humano', 'Conhece cada esquina', 'Leonida inteira'], (n) => `Visite ${n} locais`, 'visitedTotal', [10, 50, 150, 300, 500].slice(0, 4)),
  { id: 'turista', cat: 'exploracao', icon: '✈', tier: 'ouro', name: 'Turista de Leonida', desc: 'Visite locais nas 6 regiões', stat: 'regionsVisited', goal: 6 },
  // Rádio
  ...tiered('radio', 'dial', '📻', ['Mexendo no dial', 'Ouvinte fiel'], (n) => `Ouça ${n} estações diferentes`, 'stations', [3, 5]),
  ...tiered('radio', 'minutos', '🎧', ['Trilha da viagem', 'Viciado em rádio', 'Não desliga nunca', 'Mobília do estúdio'], (n) => `Ouça ${n} minutos de rádio`, 'listenMin', [30, 180, 600, 1500]),
  ...tiered('radio', 'news', '🗞', ['Bem informado', 'Leitor de manchetes', 'Âncora honorário'], (n) => `Ouça ${n} ${n === 1 ? 'boletim' : 'boletins'} do Six Star News`, 'newsHeard', [1, 10, 50]),
  // Social
  ...tiered('social', 'divulgador', '📣', ['Espalhou a notícia', 'Divulgador', 'Assessor de imprensa'], (n) => `Compartilhe ${n} ${n === 1 ? 'cartão' : 'cartões'}`, 'shares', [1, 10, 50]),
  ...tiered('social', 'busca', '🔎', ['Curioso', 'Pesquisador'], (n) => `Use a busca global ${n} vezes`, 'searches', [10, 50]),
  // Lealdade
  ...tiered('lealdade', 'sequencia', '🔥', ['Voltou amanhã', 'Rotina de Leonida', 'Residente permanente'], (n) => `Entre ${n} dias seguidos`, 'streak', [3, 7, 30]),
  ...tiered('lealdade', 'desafios', '🎯', ['Topa tudo', 'Cumpridor de missões', 'Faz-tudo de Leonida'], (n) => `Conclua ${n} desafios`, 'challengesDone', [5, 25, 100]),
  { id: 'sem-spoiler', cat: 'lealdade', icon: '🛡', tier: 'ouro', name: 'Sem spoiler', desc: 'Passe 30 dias com a proteção contra spoilers ligada', stat: 'shieldDays', goal: 30 },
  // Secretas (aparecem como ??? até desbloquear)
  { id: 'morse', cat: 'secretas', secret: true, icon: '🦩', tier: 'prata', name: 'Ponto, traço, ponto', desc: 'Abra o pin do flamingo que pisca em código Morse', stat: 'flag:morse', goal: 1 },
  { id: 'jacare', cat: 'secretas', secret: true, icon: '🐊', tier: 'prata', name: 'Não alimente os jacarés', desc: 'Encontre o jacaré de chapéu', stat: 'flag:jacare', goal: 1 },
  { id: 'coruja', cat: 'secretas', secret: true, icon: '🦉', tier: 'bronze', name: 'Coruja da madrugada', desc: 'Ouça a rádio entre meia-noite e 5h', stat: 'flag:coruja', goal: 1 },
  { id: 'disfarce', cat: 'secretas', secret: true, icon: '🕶', tier: 'bronze', name: 'Modo live', desc: 'Ligue o escudo rápido com Shift + S', stat: 'flag:disfarce', goal: 1 },
  { id: 'dj', cat: 'secretas', secret: true, icon: '🎛', tier: 'bronze', name: 'Zapeando', desc: 'Passe pelas 5 estações em menos de 1 minuto', stat: 'flag:dj', goal: 1 },
];

/* ---------------- Desafios ---------------- */
// event: o que conta · region: só conta naquela região · unique: conta valores distintos
const DAILY_POOL = [
  { id: 'd-visit5', text: 'Abra a ficha de 5 locais', goal: 5, event: 'visit', reward: 10 },
  { id: 'd-confirm1', text: 'Confirme 1 pin de outro jogador', goal: 1, event: 'confirm_given', reward: 10 },
  { id: 'd-listen10', text: 'Ouça 10 minutos de rádio', goal: 10, event: 'listen_min', reward: 5 },
  { id: 'd-news', text: 'Ouça um boletim do Six Star News', goal: 1, event: 'news', reward: 5 },
  { id: 'd-share', text: 'Compartilhe um cartão', goal: 1, event: 'share', reward: 10 },
  { id: 'd-search', text: 'Use a busca global 2 vezes', goal: 2, event: 'search', reward: 5 },
  { id: 'd-stations', text: 'Ouça 2 estações diferentes', goal: 2, event: 'listen', unique: true, reward: 5 },
  ...Object.entries(REGION_NAMES).map(([rid, rname]) => ({ id: `d-${rid}`, text: `Abra a ficha de 3 locais em ${rname}`, goal: 3, event: 'visit', region: rid, reward: 10 })),
];
const WEEKLY_POOL = [
  { id: 'w-confirm10', text: 'Confirme 10 pins de outros jogadores', goal: 10, event: 'confirm_given', reward: 40 },
  { id: 'w-visit25', text: 'Abra a ficha de 25 locais', goal: 25, event: 'visit', reward: 30 },
  { id: 'w-pin1', text: 'Tenha 1 pin aprovado', goal: 1, event: 'pin_approved', reward: 40 },
  { id: 'w-pin3', text: 'Tenha 3 pins aprovados', goal: 3, event: 'pin_approved', reward: 80 },
  { id: 'w-article', text: 'Tenha 1 artigo publicado no feed', goal: 1, event: 'article_approved', reward: 50 },
  { id: 'w-first', text: 'Seja o primeiro a descobrir algo', goal: 1, event: 'first', reward: 60 },
  { id: 'w-radio3', text: 'Ouça 3 estações diferentes', goal: 3, event: 'listen', unique: true, reward: 20 },
  { id: 'w-listen60', text: 'Ouça 60 minutos de rádio', goal: 60, event: 'listen_min', reward: 25 },
  { id: 'w-share3', text: 'Compartilhe 3 cartões', goal: 3, event: 'share', reward: 25 },
  { id: 'w-daily5', text: 'Conclua 5 desafios diários', goal: 5, event: 'daily_done', reward: 50 },
  ...Object.entries(REGION_NAMES).map(([rid, rname]) => ({ id: `w-${rid}`, text: `Abra a ficha de 10 locais em ${rname}`, goal: 10, event: 'visit', region: rid, reward: 30 })),
];

const dayStr = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const dayKey = dayStr;
export function weekKey(t = Date.now()) {
  const d = new Date(t); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayStr(d.getTime());
}
export function weekEndsIn(t = Date.now()) {
  const d = new Date(weekKey(t) + 'T00:00:00'); d.setDate(d.getDate() + 7);
  return d.getTime() - t;
}
export function dayEndsIn(t = Date.now()) {
  const d = new Date(t); d.setHours(24, 0, 0, 0);
  return d.getTime() - t;
}
function pick(pool, key, n) {
  let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const p = [...pool], out = [];
  while (out.length < n && p.length) { out.push(p.splice(h % p.length, 1)[0]); h = Math.floor(h / 7) + 101; }
  return out;
}
export const dailyChallenges = (t = Date.now()) => pick(DAILY_POOL, `d${dayStr(t)}`, 3).map((c) => ({ ...c, scope: 'daily', key: dayStr(t) }));
export const weeklyChallenges = (t = Date.now()) => pick(WEEKLY_POOL, `w${weekKey(t)}`, 3).map((c) => ({ ...c, scope: 'weekly', key: weekKey(t) }));
export const CHALLENGE_POOL_SIZE = DAILY_POOL.length + WEEKLY_POOL.length;

// Jogadores fictícios para o ranking do protótipo
export const MOCK_PLAYERS = [
  { name: 'mangue_boy', respect: 820, color: '#22c55e' },
  { name: 'vicegirl', respect: 540, color: '#ff007f' },
  { name: 'kalaga_kid', respect: 310, color: '#facc15' },
  { name: 'portrat', respect: 190, color: '#ff5e00' },
  { name: 'flamingo_hunter', respect: 125, color: '#f472b6' },
  { name: 'keyslime', respect: 60, color: '#00f0ff' },
  { name: 'swampwitch', respect: 35, color: '#a855f7' },
];
