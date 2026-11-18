# Estrela6 · estrela6.com.br

Portal de fãs de GTA VI em português (nome e regras de marca: `docs/adr/0004-nome-e-dominio.md`): feed de notícias e teorias, mapa interativo com pins da comunidade, rádio ao vivo com locutores, gamificação e um CMS (Filament) com tema de GTA VI.
Dono do projeto: Quinho (dev solo). Idioma da interface e da documentação: **português do Brasil**. Código, nomes de classes, colunas e commits: **inglês**.

O protótipo React em `docs/reference/prototype/` é a **referência de comportamento e visual**: quando uma regra não estiver escrita em `docs/`, olhe como o protótipo faz. Não copie o React: reimplemente em Blade + Livewire + Alpine.

## Stack (não troque sem ADR em `docs/adr/`)

- PHP 8.4 · Laravel 13 · Livewire 4 · Alpine.js · Tailwind CSS 4 · Filament 5 (painel `/admin`)
- MySQL 8 em produção, SQLite nos testes · Redis opcional (cache/filas usam `database` no começo)
- Leaflet 1.9 com `CRS.Simple` para o mapa (coordenadas do jogo em metros: `lat = y`, `lng = x`)
- Pest 4 (unit, feature, arch, browser) · Larastan (PHPStan) · Pint · Rector
- Armazenamento de mídia: Cloudflare R2 (disco `r2`, compatível com S3). Local: disco `public`.
- IA: Claude Haiku via Laravel AI SDK (rascunhos do feed e roteiros da rádio). Voz: Kokoro-82M (Apache-2.0), gerada fora do servidor web (GitHub Actions), ver `docs/05-radio.md`.

## Comandos

```bash
composer setup        # primeira vez: install, .env, key, migrate --seed, npm ci, build
composer dev          # servidor + fila + vite + logs (concurrently)
composer check        # TUDO que a CI roda: pint --test, phpstan, rector --dry-run, pest --parallel
composer test         # só os testes
composer fix          # pint + rector aplicando correções
php artisan leonida:sync-map --dry-run   # sincronização do mapa (GTADB)
```

**Antes de dizer que terminou qualquer tarefa, rode `composer check` e garanta que passa.** Se algo falhar e você não souber resolver, diga exatamente o que falhou; não desligue regra, não use `@phpstan-ignore` e não marque teste como `skip` para passar.

## Onde está cada coisa

```
app/
  Domain/<Contexto>/      regras de negócio (Actions, Data, Enums, Events, Policies)
    Feed/ Map/ Radio/ Gamification/ Moderation/ Accounts/ Spoilers/
  Http/Controllers/       finos; delegam para Actions
  Livewire/               componentes das páginas públicas
  Filament/               Resources, Pages, Widgets do /admin (tema em resources/css/filament/admin/theme.css)
  Jobs/  Console/Commands/
docs/                     especificação. Leia o arquivo do contexto antes de mexer nele.
docs/adr/                 decisões de arquitetura (uma por arquivo, numeradas)
docs/reference/prototype/ protótipo React (App.jsx, data.js, game.js, radiolive.js, sfx.js)
tools/                    scripts fora do PHP (pipeline do mapa em Python, gerador da rádio)
```

Contextos e documentos: Feed → `docs/03-funcionalidades.md#feed` · Mapa → `#mapa` e `tools/map-pipeline` · Infraestrutura → `docs/09-guia-de-infra.md` e `tools/server` · Spoilers e moderação → `docs/04-spoilers-e-moderacao.md` · Rádio → `docs/05-radio.md` · Gamificação → `docs/06-gamificacao.md` · Processo → `docs/07-processo.md`.

## Regras do projeto (inegociáveis)

1. **Spoiler é bug de severidade alta.** Todo conteúdo (post, pin, comentário, boletim da rádio, notificação, título de aba, meta tags, sitemap, busca, e-mail, toast) respeita o nível de proteção do usuário. Na dúvida, esconda. O padrão do visitante é "Só o oficial" (esconde leaks); mídia vazada nunca é hospedada. Ver `docs/04-spoilers-e-moderacao.md`.
2. **O moderador também é protegido.** No Filament, o **modo seguro** vem ligado por padrão: filas de moderação mostram localização, autor e checagem automática; título, texto, imagem e categoria ficam ocultos até "revelar" item a item. Nenhuma tela nova do admin pode vazar conteúdo com o modo seguro ligado (inclusive notificações, títulos de página e toasts).
3. **Nada da comunidade vai ao ar sem aprovação**, exceto pins de usuários com nível de confiança "Confiável" ou acima (regras em `docs/06-gamificacao.md`).
4. **Direitos autorais e marcas.** GTA, Rockstar, Vice City, Leonida e lugares do jogo só aparecem no conteúdo, nunca como nome de produto, seção, estação ou programa. Sem imagens da Rockstar, sem logos de GTA, sem música com direitos. Música só CC0 com origem registrada (`license`, `source_url`). Dados e tiles do mapa: GTADB, CC BY 4.0, sempre com atribuição visível. Textos coletados por IA são **resumidos com nossas palavras**, com link para a fonte, nunca copiados.
5. **Português correto e acessível na interface**: WCAG 2.2 AA, foco visível, `aria-*` nos controles customizados, `prefers-reduced-motion` respeitado.
6. **O repositório é público: segredos nunca no código nem no git.** Só em `.env` (local) e GitHub Secrets/servidor. Nunca leia nem imprima o conteúdo de `.env`.
7. **Desempenho do mapa**: nada de atualizar centenas de marcadores por frame. Siga as técnicas de `docs/03-funcionalidades.md#mapa` (tiles com filtro "assado", hover com polilinha, `_go` em vez de `flyTo`).

## Como escrever código aqui

- Uma regra de negócio = uma Action (`app/Domain/X/Actions/DoSomething.php`, método `handle()`), testada em `tests/Unit` ou `tests/Feature`. Controllers, Livewire e Filament chamam Actions; não duplicam regra.
- Tipagem estrita (`declare(strict_types=1);`), retornos tipados, Enums para estados (`PostStatus`, `SpoilerType`, `Reliability`, `TrustLevel`).
- Eloquent: `Model::preventLazyLoading()` fora de produção; sempre `with()` nas listagens; índices nas colunas filtradas.
- Autorização por Policy; Filament usa as mesmas Policies. Toda rota de escrita tem rate limit.
- Upload de imagem: validar MIME real, redimensionar no servidor (máx. 1600 px), remover EXIF/GPS, salvar no disco `r2`.
- Textos da interface em `lang/pt_BR/*.php`; nada de string solta em Blade.
- Migrations reversíveis. Nunca edite uma migration já mergeada em `main`; crie outra.
- Testes primeiro quando houver regra (pontuação, spoiler, moderação, programação da rádio). Toda correção de bug começa por um teste que reproduz o bug.

## Fluxo de trabalho com o Claude Code

- Toda mudança nasce de uma issue no GitHub e vira um PR pequeno (ideal < 400 linhas). Use a skill `nova-feature`.
- Branch: `feat/<issue>-<slug>`, `fix/<issue>-<slug>`, `chore/...`. Commits no padrão Conventional Commits em inglês (`feat(map): ...`). PR em português, com o template.
- Nunca faça push direto em `main` nem force-push em branch compartilhada.
- **Merge só quando o Quinho mandar explicitamente** ("pode mergear o #N"). Antes: `gh pr checks <n>` todo verde, sem conflito, então `gh pr merge <n> --squash --delete-branch`. Nunca mergeie por iniciativa própria, nunca com CI vermelha ou pendente, nunca use `--admin` para pular proteção.
- Mudou comportamento? Atualize o doc correspondente em `docs/` no mesmo PR.
- Decisão de arquitetura (nova dependência, troca de serviço, mudança de infraestrutura) → escreva um ADR curto em `docs/adr/` e peça aprovação antes de implementar.
- Dependência nova: justificar no PR, preferir pacotes mantidos (commit nos últimos 6 meses), licença compatível (MIT/BSD/Apache).

## Skills disponíveis (`.claude/skills/`)

| Skill | Quando usar |
|---|---|
| `nova-feature` | Implementar qualquer issue do início ao PR |
| `spoiler-safety` | Qualquer coisa que exiba conteúdo do feed, mapa, rádio, busca, SEO ou admin |
| `filament-admin` | Criar/alterar Resources, Pages ou Widgets do /admin (tema, modo seguro, ações de moderação) |
| `mapa-leaflet` | Mapa, pins, regiões, landmarks, sincronização com o GTADB |
| `radio` | Grade, programação ao vivo, locução, boletins e geração de áudio |
| `gamificacao` | Respeito, níveis, confiança, conquistas, desafios |
| `revisao-seguranca` | Antes de abrir PR que toca autenticação, upload, formulários públicos, admin ou integrações |
| `release` | Preparar versão, changelog, deploy e rollback |
