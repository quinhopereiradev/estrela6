# Gamificação

Regras de implementação: skill `.claude/skills/gamificacao/SKILL.md`. Catálogo de origem: `reference/prototype/game.js` (76 conquistas em 7 categorias, 5 secretas; 29 desafios nos pools diário e semanal).

## Respeito (pontos)
Só por ação validada:
| Ação | Respeito |
|---|---|
| Artigo publicado no feed | 30 |
| Pin aprovado | 25 |
| Primeiro a descobrir (nenhum pin aprovado a < 60 m) | +15 |
| Confirmação recebida no seu pin | 5 |
| Confirmação dada a outro pin | 2 |
| Desafio concluído | conforme o desafio (5 a 50) |

## Estrelas e confiança
Estrelas: ★ 0 · ★★ 50 · ★★★ 150 · ★★★★ 400 · ★★★★★ 1000.
Confiança: **Novato** (< 150), **Confiável** (≥ 150: pins aprovados automaticamente), **Veterano** (≥ 400).

## Conquistas
Categorias do protótipo (Descoberta, Comunidade, Exploração, Rádio, Social, Lealdade, Secretas) em tiers bronze, prata, ouro e platina. Inclui "Colunista" (1, 5 e 20 artigos publicados). Secretas aparecem como "???".

## Desafios
3 diários (renovam à meia-noite) e 3 semanais (segunda-feira), sorteados por data e iguais para todos. Exemplo semanal: "Tenha 1 artigo publicado no feed" (+50).

## Ranking
Semanal e geral, por respeito. No protótipo há jogadores fictícios (`MOCK_PLAYERS`); em produção, só usuários reais, sem banidos.
