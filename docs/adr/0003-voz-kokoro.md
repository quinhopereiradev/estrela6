# 0003 · Voz da rádio: Kokoro-82M na GitHub Action

- **Status:** aceita
- **Data:** 2026-11-17

## Contexto
Queremos noticiários gravados com voz natural, todo dia, sem custo. A voz do navegador varia por aparelho e às vezes não existe.

## Decisão
Gerar o áudio com o Kokoro-82M (licença Apache-2.0, roda em CPU) dentro de uma GitHub Action diária, salvar MP3 no R2 e registrar no portal. Roteiros pelo Claude Haiku a partir do briefing do dia. O servidor web não roda TTS.

## Alternativas
- Google Cloud TTS: cota grátis mensal cobre o volume, mas exige cartão e conta de faturamento.
- OpenAI gpt-4o-mini-tts: cerca de US$ 0,015/min e aceita instruções de atuação, mas o modelo tem desativação anunciada para janeiro de 2027.
- Voz do navegador: grátis, qualidade variável. Continua como fallback.

## Consequências
Vozes em inglês americano e britânico, sem sotaque sulista; personalidade vem do roteiro. Se quisermos vozes mais expressivas, reavaliar com novo ADR.
