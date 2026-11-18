---
name: gamificacao
description: Sistema de respeito, estrelas (níveis), confiança, conquistas em níveis, desafios diários e semanais e ranking. Use ao conceder pontos, criar conquistas ou desafios ou mexer no perfil.
---

# Gamificação

Referência: `docs/06-gamificacao.md` e `docs/reference/prototype/game.js` (catálogo completo: 76 conquistas e 29 desafios).

## Princípios
- **Respeito só vem de ação validada** por outra pessoa ou pela moderação (pin aprovado, confirmação recebida, artigo publicado). Ações sem validação (abrir fichas, ouvir rádio) só contam para desafios e conquistas.
- Todo ganho é uma linha em `respect_ledger` (user_id, amount, reason enum, subject morph, created_at). O saldo é a soma; nunca um campo editado à mão. Estorno = lançamento negativo.
- Idempotência: a mesma ação nunca pontua duas vezes (`unique(user_id, reason, subject_type, subject_id)`).

## Valores
`article_approved 30` · `pin_approved 25` · `first_discovery +15` · `confirm_received 5` · `confirm_given 2`.
Estrelas: 0, 50, 150, 400, 1000. Confiança: Novato < 150, **Confiável ≥ 150 (pins aprovados automaticamente)**, Veterano ≥ 400.

## Conquistas e desafios
- Conquistas em tiers bronze/prata/ouro/platina por estatística agregada, 5 secretas (`???` até desbloquear). Catálogo como dados (seeder gerado a partir de `game.js`), não código espalhado.
- Desafios: 3 diários (renovam à meia-noite de São Paulo) e 3 semanais (segunda), sorteados por seed de data a partir dos pools, iguais para todos.
- Processamento por eventos de domínio (`PinApproved`, `ConfirmationGiven`, `ArticlePublished`, `BulletinListened`, ...) → listener `ProgressTracker` em fila.
- Toast + efeito sonoro no cliente via evento Livewire `respect-earned` (texto sem spoiler).

## Antiabuso
Rate limit em confirmações; não pode confirmar o próprio pin; contas com menos de 24 h não geram pontos ao confirmar; pontos revogados quando um pin é removido pela moderação.

## Testes
Cada valor de pontuação, idempotência, passagem de nível e de confiança, sorteio determinístico de desafios por data, conquista secreta.
