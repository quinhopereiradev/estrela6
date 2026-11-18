---
name: release
description: Como preparar e publicar uma versão do Estrela6 (release-please, staging, produção na VM Oracle, rollback e checagens pós-deploy). Use quando o Quinho pedir para lançar uma versão, fazer deploy ou reverter.
---

# Release e deploy

## Versões
- SemVer: `v0.x` até o lançamento público; `v1.0.0` no dia da abertura.
- O **release-please** mantém um PR "chore(main): release x.y.z" com o CHANGELOG gerado a partir dos commits (Conventional Commits). Mergear esse PR cria a tag `vX.Y.Z` e a GitHub Release.

## Ambientes
| Ambiente | Quando | Onde |
|---|---|---|
| local | sempre | Herd ou Sail, SQLite ou MySQL |
| staging | cada merge em `main` | mesma VM, `staging.estrela6.com.br`, banco separado, `noindex`, senha básica |
| produção | tag `v*` | `estrela6.com.br`, atrás do Cloudflare |

## Deploy (`.github/workflows/deploy.yml`)
1. Só roda depois da CI verde no mesmo commit.
2. Na Action: `composer install --no-dev --optimize-autoloader`, `npm ci && npm run build`, empacota.
3. Envia para `/var/www/estrela6/<ambiente>/releases/<sha>` via SSH (chave em `DEPLOY_SSH_KEY`).
4. No servidor (`tools/deploy/activate.sh`): liga `storage` e `.env` compartilhados, `php artisan migrate --force`, `optimize`, `filament:optimize`, troca o symlink `current`, `queue:restart`, recarrega o PHP-FPM.
5. Mantém as 5 últimas releases.
6. Smoke test: `GET /up` 200, `/`, `/mapa`, `/map/meta.json`. Se falhar, volta o symlink automaticamente.

## Antes de lançar (confira)
- [ ] `composer check` verde em `main`.
- [ ] Migrations novas reversíveis e sem `ALTER` pesado em tabela grande sem plano.
- [ ] Variáveis novas configuradas no servidor (listar no PR de release).
- [ ] Backup do banco do dia concluído (`spatie/laravel-backup` → R2).

## Rollback
`gh workflow run deploy.yml -f environment=production -f action=rollback` volta o symlink para a release anterior. `migrate:rollback` só se o PR de release marcou a migration como segura para reverter. Se houve perda de dado: restaurar backup e registrar em `docs/incidentes/AAAA-MM-DD.md`.

## Depois
Logs dos últimos 15 minutos, `php artisan queue:failed` vazio e Search Console sem erro novo de indexação.
