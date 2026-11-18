# Processo de desenvolvimento

## Visão geral do fluxo
```
Issue (template) ─► branch curta ─► commits (Conventional Commits) ─► PR (template)
   ─► CI: Pint · PHPStan · Rector · Pest (+ cobertura ≥ 70%) · browser · build
   ─► Segurança: composer audit · npm audit · gitleaks · Semgrep
   ─► revisão (você; o Claude Code revisa com as skills) ─► squash merge em main (você, ou o Claude Code quando você mandar)
   ─► deploy automático em staging ─► release-please abre/atualiza o PR de versão
   ─► merge do PR de versão ─► tag vX.Y.Z ─► deploy em produção ─► smoke test (rollback automático se falhar)
```

## GitHub (configurar uma vez)
- Repositório **público**, sem licença (código visível, todos os direitos reservados). No plano grátis, só repositório público tem rulesets, environments com aprovação e Actions ilimitado. Segredos ficam **só** nos Secrets do GitHub e no `.env` do servidor; gitleaks e o push protection do GitHub barram vazamentos.
- **Proteção da `main`** (Settings › Rules › Rulesets):
  - exigir PR, 1 aprovação quando houver mais alguém (sozinho: exigir só CI verde);
  - checks obrigatórios: `Pint · PHPStan · Rector`, `Testes (Pest)`, `Front-end`, `Dependências vulneráveis`, `Segredos no código`, `Análise de código`;
  - histórico linear (squash), bloquear force-push e exclusão.
- Merge: só **squash**, apagar branch após merge.
- **Environments** `staging` e `production` com seus secrets; `production` com aprovação manual (você) antes do deploy.
- Secrets: `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST`, `DEPLOY_USER`, `STAGING_BASIC_AUTH`, `RELEASE_PLEASE_TOKEN`, `ANTHROPIC_API_KEY`, `RADIO_PIPELINE_TOKEN`, `R2_*`. Variables: `APP_URL`, `R2_BUCKET`, `R2_PUBLIC_URL`.
- Dependabot ligado (alerts + security updates) e o `dependabot.yml` do repositório.
- Relato privado de vulnerabilidades ligado (`SECURITY.md`).
- Labels: `feature`, `bug`, `spoiler` (vazamento, prioridade máxima), `security`, `infra`, `good first issue`.
- Projeto (GitHub Projects) com colunas: Backlog › Próximo › Fazendo › Em revisão › Feito, e um campo "Marco" (ver `08-roadmap.md`).

## Branches e commits
- Trunk-based: `main` sempre publicável; branches vivem no máximo alguns dias.
- Nomes: `feat/<issue>-<slug>`, `fix/…`, `chore/…`, `docs/…`, `refactor/…`, `ci/…`.
- Commits (inglês): `tipo(escopo): descrição` — tipos `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`, `ci`; escopos `feed`, `map`, `radio`, `game`, `admin`, `auth`, `seo`, `infra`, `deps`. `feat!:` ou `BREAKING CHANGE:` para quebra.
- O release-please gera o CHANGELOG a partir desses commits: commit bem escrito = changelog pronto.

## Pull requests
- Pequenos (< 400 linhas de código de produção), um assunto por PR.
- Template obrigatório (`.github/pull_request_template.md`) com checklist de spoiler e segurança.
- Feature grande e incompleta entra atrás de feature flag (`config('features.x')`), nunca em branch longa.

## Qualidade (o que a CI garante)
| Ferramenta | Regra |
|---|---|
| Pint | preset Laravel + `declare(strict_types=1)` e comparação estrita |
| Larastan | nível 8, sem baseline |
| Rector | PHP 8.4, sets do Laravel, dead code e type declarations (dry-run na CI) |
| Pest | unit + feature + arch; cobertura mínima 70%; browser para fluxos críticos |
| Build | `npm run build` sem erro |

## Segurança (camadas)
1. **Código**: skill `revisao-seguranca` em todo PR sensível; Semgrep (regras PHP/Laravel/segredos) na CI.
2. **Dependências**: `composer audit` e `npm audit` em cada PR e toda segunda; Dependabot.
3. **Segredos**: gitleaks na CI; `.env` bloqueado para leitura do Claude Code; push protection do GitHub quando disponível.
4. **Aplicação**: CSP, HSTS, rate limiting, Policies, MFA no admin, uploads reprocessados, sanitização do Markdown.
5. **Servidor**: SSH só por chave, usuário de deploy sem sudo amplo (só `systemctl reload php8.4-fpm`), firewall liberando 80/443 apenas para o Cloudflare, atualizações automáticas de segurança do Ubuntu, fail2ban.
6. **Dados**: backup diário criptografado no R2, restauração testada todo mês; LGPD (exclusão de conta, dados mínimos, política de privacidade).

## Ambientes e deploy
Ver skill `release`. Resumo: merge em `main` → staging; tag `v*` → produção (com aprovação do environment); releases atômicas por symlink; 5 releases guardadas; rollback em um comando.

## Ritmo de trabalho sugerido (dev solo + Claude Code)
- **Semana**: escolher 3 a 5 issues do marco atual para "Próximo".
- **Cada issue**: abrir o Claude Code no repo e pedir "implemente a issue #N" (ele usa a skill `nova-feature`), revisar o PR, testar em staging, mergear.
- **Sexta**: mergear o PR do release-please se staging estiver bom → produção.
- **Mensal**: revisar dependências grandes (Laravel, Filament), testar restauração de backup, olhar Search Console e custos da IA.

## Incidentes
Spoiler vazado ou falha de segurança: corrigir primeiro (hotfix com `fix:` direto para release), depois registrar em `docs/incidentes/AAAA-MM-DD.md` (o que houve, impacto, causa, o que muda) e adicionar o teste que teria pegado.
