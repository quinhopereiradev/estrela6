# Kit do Claude Code · Estrela6

Este pacote vai para a raiz do repositório novo. Ele não contém o projeto Laravel: o primeiro passo é criá-lo (marco M0).

## O que tem aqui
| Caminho | Para quê |
|---|---|
| `CLAUDE.md` | Contexto que o Claude Code lê em toda sessão: stack, regras, comandos, onde está cada coisa |
| `.claude/skills/*/SKILL.md` | 8 skills do projeto (nova-feature, spoiler-safety, filament-admin, mapa-leaflet, radio, gamificacao, revisao-seguranca, release) |
| `.claude/settings.json` | Permissões (o que roda sem perguntar, o que pede confirmação, o que é proibido) e hook que formata PHP após cada edição |
| `.github/` | CI, segurança, deploy, release-please, rádio diária, Dependabot, templates de PR/issue, CODEOWNERS |
| `phpstan.neon` · `pint.json` · `rector.php` · `.editorconfig` · `.gitleaks.toml` | Qualidade e segurança |
| `docs/` | Especificação completa, processo, roadmap e ADRs |
| `docs/reference/` | Protótipo React e o pacote de sincronização do mapa já escrito |
| `tools/radio-news/` | Pipeline do Six Star News (Haiku + Kokoro), testado |
| `tools/map-pipeline/` | Scripts Python do mapa (GTADB) |
| `tools/server/` | Script de preparação do servidor e Caddyfile |
| `tools/deploy/` | Ativação e rollback de releases no servidor |

## Como começar
0. Siga o `docs/09-guia-de-infra.md` (domínio, Cloudflare, R2, Oracle, GitHub, chaves). É a parte que só você pode fazer.
1. Crie o repositório **público** `estrela6` no GitHub (sem licença: o código fica visível, mas todos os direitos reservados) e clone.
2. No terminal, dentro da pasta vazia:
   ```bash
   composer create-project laravel/laravel . "^13.0"
   ```
3. Copie todo o conteúdo deste kit para a raiz (sobrescreva o que coincidir).
4. Troque `OWNER/REPO` e `@OWNER` em `.github/ISSUE_TEMPLATE/config.yml` e `.github/CODEOWNERS`.
5. Abra o Claude Code na pasta e peça:
   > Leia o CLAUDE.md e o docs/08-roadmap.md e execute o marco M0, item por item, abrindo um PR por item.
6. Configure no GitHub o que está em `docs/07-processo.md` (proteção da main, environments, secrets).

Dica: comece cada sessão do Claude Code com o número da issue ("implemente a #12"). Ele usa a skill `nova-feature` e para antes de mergear.
