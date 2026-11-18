# Rádio

Detalhes de implementação: skill `.claude/skills/radio/SKILL.md`. Dados iniciais (estações, grade, 62 faixas CC0 com origem): `reference/prototype/data.js`.

## Estações
| Estação | Freq. | Gênero | Região | Apresentador(es) |
|---|---|---|---|---|
| Neon | 104.7 | Synthwave e electro | Vice City | DJ Flamingo, Lady Vice, Redação 6★ |
| Backroad Country | 97.3 | Country e folk | Mount Kalaga e o norte | Dolly Pines |
| Gulf Rust | 88.1 | Rock, metal e surf | Port Gellhorn | Big Earl |
| Swamp Static | 91.9 | Blues sulista e sons do pântano | Grassrivers | Swamp Static, Redação 6★ |
| Keys Lounge | 101.1 | Jazz e lounge tropical | Leonida Keys | Marina Sol |

Cada estação tem 12 a 13 faixas, todas CC0, com `source_url` (FreePD e Free Music Archive). Música nova só CC0, com registro da origem.

Slugs das estações: `neon`, `backroad`, `gulf`, `swamp`, `keys` (no protótipo o id ainda é `kalaga`).

## Ao vivo
A grade (horário de São Paulo) define o programa e o humor (calmo, misto, agitado). A playlist do dia é sorteada por data, então todos ouvem a mesma coisa ao mesmo tempo. Entrar numa estação = tocar a faixa do momento a partir do segundo certo.

## Locução
Em inglês, com humor. Tipos: DJ, comercial falso, tempo, Six Star News, recado da comunidade (com apelido de quem autorizou). Entra no começo das faixas, com a música abaixada.

## Six Star News gravado
- Fase atual (protótipo): 10 boletins (2 por estação) gerados com Kokoro-82M a partir de roteiros escritos à mão (`tools/radio-news/fixtures/prototype_scripts.py`).
- Produção: diário e automático (`.github/workflows/radio-news.yml` + `tools/radio-news/pipeline.py`):
  1. Laravel monta o briefing do dia só com conteúdo sem spoiler.
  2. Haiku escreve os roteiros (`tools/radio-news/prompt.md`), validados por schema e lista de palavras proibidas.
  3. Kokoro gera o áudio no runner do GitHub (grátis), ffmpeg normaliza.
  4. MP3 no R2; manifesto enviado ao portal; boletins `pending` ou publicados direto (`RADIO_AUTO_PUBLISH`).
- Custo: centavos de IA por mês; voz e armazenamento grátis. Tempo de Action: cerca de 15 min/dia, grátis em repositório público.
- Próximos passos possíveis: gerar também falas de DJ e comerciais gravados (mesmo pipeline), vinhetas por estação.
