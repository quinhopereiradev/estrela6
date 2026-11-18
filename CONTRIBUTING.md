# Como contribuir

O processo completo está em [`docs/07-processo.md`](docs/07-processo.md). Resumo:

1. Toda mudança começa numa issue (templates em `.github/ISSUE_TEMPLATE`).
2. Branch a partir de `main`: `feat/<issue>-<slug>`, `fix/...`, `chore/...`, `docs/...`.
3. Commits em inglês no padrão Conventional Commits: `feat(map): ...`, `fix(feed): ...`.
4. `composer check` precisa passar antes do PR.
5. PR pequeno, com o template preenchido. Merge por squash, só com CI verde e revisão.

Regras do projeto (spoilers, direitos autorais, segurança) estão no [`CLAUDE.md`](CLAUDE.md) e valem para pessoas também.
