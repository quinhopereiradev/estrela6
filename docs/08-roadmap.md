# Roadmap (marcos)

Cada marco termina com deploy em produção. Itens viram issues no GitHub (uma por linha, em geral).

## M0 · Fundação
- [ ] Criar o projeto: `laravel new` (Laravel 13, Pest, sem starter kit), Livewire 4, Filament 5, Tailwind 4.
- [ ] Copiar este kit (CLAUDE.md, `.claude/`, `.github/`, `docs/`, `tools/`, configs) e os scripts do composer de `01-arquitetura.md`.
- [ ] Instalar Larastan, Pint (config), Rector, plugins do Pest; `composer check` verde.
- [ ] Testes de arquitetura iniciais; layout base com o visual do protótipo (cores, fontes OFL, vidro, neon).
- [ ] Painel Filament com tema GTA VI e MFA.
- [ ] Infra pelo `docs/09-guia-de-infra.md` (feito pelo Quinho) e servidor preparado com `tools/server/provision.sh`; VM Oracle, Caddy/Nginx, PHP 8.4, MySQL, Supervisor, cron; Cloudflare; R2; staging + produção; deploy funcionando com página "em breve".
**Pronto quando:** um PR qualquer passa pela CI e vai sozinho para staging; uma tag vai para produção.

## M1 · Contas e spoilers
- [ ] Login Discord/Google, primeiro acesso (apelido, 16+, termos), perfil básico, excluir conta.
- [ ] Presets de spoiler (cookie para visitante, coluna para usuário), `SpoilerGate`, componente `<x-spoiler>`, modal de boas-vindas.
- [ ] Papéis e Policies; `mod_safe_mode`.

## M2 · Feed
- [ ] Posts (model, Resource no Filament, páginas públicas), selos de confiabilidade, Dia X, busca e filtros, cartões de compartilhamento, SEO (meta seguras, sitemap).
- [ ] Enviar artigo + Pauta com modo seguro + recusa com motivo.

## M3 · Mapa
- [ ] Instalar o pacote `reference/laravel-leonida` (sincronização GTADB), endpoints JSON, tiles no R2.
- [ ] Página do mapa (Leaflet com as otimizações), fichas, regiões, ímã, filtro de camadas, hash de URL.
- [ ] Pins: sugerir, duplicatas, fila com modo seguro ("ver só o ponto"), confirmações, primeiro descobridor, névoa.

## M4 · Gamificação
- [ ] Ledger de respeito, estrelas, confiança (auto-aprovação), conquistas (seeder do catálogo), desafios diários e semanais, ranking, toasts e efeitos.

## M5 · Rádio
- [ ] Estações, programas, faixas (seeder com as 62 faixas CC0 + upload no R2), `liveAt` PHP/JS, player persistente, grade, AO VIVO.
- [ ] Locução do navegador (fallback) + Six Star News gravado: briefing, endpoint interno, Action diária, Resource de boletins.

## M6 · Coleta automática
- [ ] Fontes, `sources:check`, filtro por palavra-chave, classificação e rascunho com Haiku, orçamento diário, deduplicação, publicação automática de fontes oficiais.

## M7 · Lançamento público
- [ ] Política de privacidade e termos, página "sobre" com créditos (GTADB CC BY 4.0, músicas CC0), Search Console, backup testado, revisão de segurança completa, `v1.0.0`.

Depois: DJs e comerciais gravados, página da comunidade, notificações, PWA.
