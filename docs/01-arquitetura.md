# Arquitetura

## Stack
| Camada | Escolha | Observação |
|---|---|---|
| Linguagem | PHP 8.4 | Laravel 13 exige 8.3+ |
| Framework | Laravel 13 | Laravel 11 parou de receber correções de segurança em março de 2026 |
| Front público | Blade + Livewire 4 + Alpine.js + Tailwind CSS 4 | Leaflet 1.9 no mapa (JS isolado em `resources/js/map/`) |
| Admin | Filament 5 | tema próprio, ver skill `filament-admin` |
| Banco | MySQL 8.4 (produção) · SQLite (testes rápidos) | CI roda os testes em MySQL |
| Fila e cache | driver `database` | trocar por Redis só com ADR |
| Arquivos | Cloudflare R2 (disco `r2`, driver S3) | tiles do mapa, imagens, áudio |
| IA | Laravel AI SDK + Claude Haiku | rascunhos da pauta e roteiros da rádio |
| Voz | Kokoro-82M (Apache-2.0) na GitHub Action | `adr/0003-voz-kokoro.md` |
| Testes | Pest 4 (unit, feature, arch, browser) | |
| Qualidade | Larastan nível 8, Pint, Rector | `composer check` |

## Infraestrutura (custo zero, exceto o domínio)
```
Visitante ──► Cloudflare (DNS, proxy, cache, WAF básico, HTTPS)
                 │
                 ├─► VM Oracle Cloud Always Free (ARM, Ubuntu LTS)
                 │     Caddy ou Nginx · PHP-FPM 8.4 · MySQL 8.4 · Supervisor (fila) · cron (scheduler)
                 │     /var/www/estrela6/{production,staging}
                 │
                 └─► Cloudflare R2 (cdn.estrela6.com.br): tiles, imagens, músicas, boletins
GitHub: código, Actions (CI, segurança, deploy, rádio), Dependabot
```
- Oracle Always Free: a instância ARM grátis foi reduzida em 2026; confirmar a cota ao criar. Instâncias ociosas podem ser recuperadas pela Oracle: o cron e a fila mantêm a VM ativa, e há backup diário.
- R2: a cota grátis cobre armazenamento e operações de um site desse porte, e não cobra tráfego de saída.
- Backups: `spatie/laravel-backup` diário (banco + `storage/app`) para o R2, 14 dias de retenção. Teste de restauração mensal.
- Monitoramento: rota `/up` + um monitor de disponibilidade gratuito; logs com `daily` e 14 dias.
- E-mail transacional: a definir (serviço com cota gratuita); até lá, login só social.

## Pacotes previstos
`filament/filament` · `livewire/livewire` · `laravel/socialite` + `socialiteproviders/discord` · `laravel/ai` (SDK) · `spatie/laravel-backup` · `spatie/laravel-csp` · `spatie/laravel-sitemap` · `intervention/image` · `league/flysystem-aws-s3-v3` · `league/commonmark` (Markdown dos posts, com sanitização)
Dev: `pestphp/pest` + plugins (laravel, livewire, arch, browser) · `larastan/larastan` · `laravel/pint` · `rector/rector` + `driftingly/rector-laravel` · `barryvdh/laravel-debugbar` (só local)

## Scripts do composer (copiar para o `composer.json`)
```json
"scripts": {
  "setup": ["composer install", "@php -r \"file_exists('.env') || copy('.env.example', '.env');\"", "@php artisan key:generate", "@php artisan migrate --seed", "npm ci", "npm run build"],
  "dev": ["Composer\\Config::disableProcessTimeout", "npx concurrently -c \"#93c5fd,#c4b5fd,#fdba74,#86efac\" \"php artisan serve\" \"php artisan queue:listen --tries=1\" \"php artisan pail\" \"npm run dev\" --names=server,queue,logs,vite"],
  "test": ["@php artisan config:clear --ansi", "pest --parallel"],
  "check": ["pint --test", "phpstan analyse --no-progress", "rector process --dry-run --no-progress-bar", "@test"],
  "fix": ["rector process", "pint"]
}
```

## Variáveis de ambiente (além das padrão do Laravel)
| Variável | Para quê |
|---|---|
| `APP_TIMEZONE=America/Sao_Paulo` | grade da rádio, desafios diários |
| `LAUNCH_AT=2026-11-19T00:00:00-03:00` | contagem do "Dia X" |
| `FILESYSTEM_DISK=r2` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` · `R2_BUCKET` · `R2_ENDPOINT` · `R2_PUBLIC_URL` | arquivos |
| `DISCORD_CLIENT_ID/SECRET` · `GOOGLE_CLIENT_ID/SECRET` | login social |
| `ANTHROPIC_API_KEY` · `AI_DAILY_BUDGET_USD=0.50` | coleta e rascunhos; o job para se passar do orçamento |
| `RADIO_PIPELINE_TOKEN` · `RADIO_AUTO_PUBLISH=false` | integração com a Action da rádio |
| `GTADB_REPO=rolux/gtadb.org` · `MAP_VERSION` | sincronização do mapa |

### Login social em ambiente local
O Google rejeita redirect URIs em TLDs reservados para teste (`.test`, `.localhost`, `.example`, `.invalid`) com "Access blocked: doesn't comply with Google's OAuth 2.0 policy" — a única exceção fora de domínio público é `http://localhost`. Como o Herd serve o projeto em `https://estrela6.test`, duas opções para testar o login social localmente:
1. Trocar `APP_URL` para `http://localhost:8000`, subir com `php artisan serve` e cadastrar `http://localhost:8000/auth/{provider}/callback` como redirect URI extra no Google Cloud Console / Discord Developer Portal — mais rápido para um teste pontual.
2. Usar o **Herd Share** (clique direito no site, no app do Herd) para expor `estrela6.test` num domínio público temporário, e cadastrar esse domínio como redirect URI — mantém o fluxo igual ao de produção.

Em produção (`estrela6.com.br`), domínio público normal, isso nunca é um problema.

## Organização do código
```
app/Domain/<Contexto>/{Actions,Data,Enums,Events,Listeners,Models,Policies,Support}
app/Http/Controllers (finos) · app/Livewire (páginas) · app/Filament (admin)
resources/views/{components,livewire,layouts} · resources/js/{map,radio} · lang/pt_BR
tests/{Unit,Feature,Browser,Arch}
```
Testes de arquitetura (Pest `arch()`): Controllers não usam Models de outro contexto diretamente; nada em `app/` chama `env()`; `Domain` não depende de `Filament` nem de `Livewire`; sem `dd`/`dump`/`ray`.
