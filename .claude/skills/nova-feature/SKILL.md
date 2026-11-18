---
name: nova-feature
description: Fluxo completo para implementar uma issue do Estrela6, da leitura da issue ao PR aberto com CI verde. Use para qualquer feature, correção ou refatoração.
---

# Nova feature (issue → PR)

## 1. Entender
1. Leia a issue inteira: `gh issue view <n> --comments`.
2. Leia o doc do contexto em `docs/` (veja a tabela no `CLAUDE.md`) e, se houver tela, o trecho correspondente do protótipo em `docs/reference/prototype/`.
3. Se a issue for ambígua, ou exigir decisão de arquitetura, **pare e pergunte** (ou proponha um ADR). Não invente regra de negócio.
4. Escreva um plano curto (arquivos a criar/alterar, migrations, testes) e mostre antes de codar se a mudança passar de ~200 linhas ou tocar banco.

## 2. Branch
```bash
git switch main && git pull --ff-only
git switch -c feat/<n>-<slug>      # fix/, chore/, docs/, refactor/
```

## 3. Testes primeiro
- Regra de negócio → teste Pest em `tests/Unit/Domain/...` ou `tests/Feature/...` que falha.
- Tela Livewire → `Livewire::test(...)` cobrindo render, validação e autorização.
- Filament → teste de Resource (listar, criar, ações de moderação) **com o modo seguro ligado**.
- Fluxo crítico (login, enviar pin, aprovar, ouvir rádio) → teste de browser do Pest em `tests/Browser`.
- Bug → primeiro um teste que reproduz.

## 4. Implementar
- Siga as convenções do `CLAUDE.md` (Actions, Enums, Policies, `lang/pt_BR`).
- Conteúdo visível ao público ou ao moderador? Use a skill `spoiler-safety`.
- Commits pequenos, Conventional Commits em inglês:
  `feat(feed): add article submission form`, `fix(map): keep popup closed in safe mode`.

## 5. Verificar
```bash
composer check            # pint --test, phpstan, rector --dry-run, pest --parallel
npm run build             # se mexeu em CSS/JS
```
Abra a tela no navegador (`composer dev`) e confira desktop (1400 px) e mobile (390 px). Se tocou autenticação, upload, formulário público ou admin, rode a skill `revisao-seguranca`.

## 6. Documentar
- Comportamento mudou → atualize `docs/`.
- Nova variável de ambiente → `.env.example` + `docs/01-arquitetura.md`.
- Mudança visível → linha em "Notas para o changelog" no PR.

## 7. PR
```bash
git push -u origin HEAD
gh pr create --fill --body-file .github/pull_request_template.md   # depois edite o corpo
```
Preencha o template em português: o quê, por quê, como testar, prints, checklist de spoiler/segurança, `Closes #<n>`.
Avise o Quinho com o link do PR e um resumo de 2 a 3 linhas.

## 8. Merge (só quando o Quinho mandar)
```bash
gh pr checks <n> --watch        # tudo verde?
gh pr merge <n> --squash --delete-branch
git switch main && git pull --ff-only
```
Se algum check falhar ou estiver pendente, não mergeie: diga qual e por quê. Nunca use `--admin`.
