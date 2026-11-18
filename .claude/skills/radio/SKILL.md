---
name: radio
description: Rádio ao vivo do portal — estações, grade, playlist determinística por horário, locução em inglês, boletins gravados (Six Star News) gerados com Claude Haiku + Kokoro TTS e publicados no R2. Use ao mexer no player, na grade, nos roteiros ou no pipeline de áudio.
---

# Rádio

Referência: `docs/05-radio.md`, protótipo `radiolive.js` (`liveAt`, `showAt`, `showMood`) e `usePlayer`/`radioScript` em `App.jsx`; gerador em `tools/radio-news/`.

## Ao vivo é determinístico
- `liveAt(station, t)`: a partir da data (seed por dia) e do programa atual, monta a playlist filtrada pelo humor do programa (`calmo|misto|agitado`, pela `energy` da faixa) e devolve faixa + offset. Servidor e cliente usam a mesma regra: implementar em PHP **e** em JS, com um teste que compara as duas saídas em 50 horários.
- O player busca o offset (o servidor precisa aceitar `Range`; o R2 aceita) e "volta ao vivo" ao retomar.
- Modos: ao vivo (padrão) e sob demanda.

## Locução
- Idioma: **inglês**, com humor no estilo das rádios de GTA, sem marcas reais nem pessoas reais.
- Tipos: `banter` (DJ), `ad` (comercial falso), `weather`, `news` (Six Star News), `recado` (programas da comunidade).
- **Boletins gravados** (MP3) têm prioridade sobre a voz do navegador; o resto usa `speechSynthesis` como fallback (vozes locais primeiro, fala em frases curtas, troca de voz se der erro).
- A música abaixa (ducking) durante a fala; vinheta curta da estação antes.

## Pipeline dos boletins (diário)
1. `php artisan radio:briefing` (agendado 05:30 em São Paulo) monta o **briefing do dia**: posts publicados nas últimas 48 h com `spoiler_type = null` e `reliability IN (oficial, comunidade, rumor)`, pins aprovados sem spoiler e recados aprovados. Salva em `radio_briefings` e expõe `GET /internal/radio/briefing/{date}` (token `RADIO_PIPELINE_TOKEN`).
2. A GitHub Action `radio-news.yml` (06:00 em São Paulo) baixa o briefing, chama o **Claude Haiku** para escrever 2 boletins por estação (prompt em `tools/radio-news/prompt.md`, saída JSON validada), gera o áudio com **Kokoro-82M** (`tools/radio-news/generate.py`), normaliza (`loudnorm -16 LUFS`, MP3 64 kbps mono) e envia ao R2 em `radio/news/{date}/`.
3. A Action chama `POST /internal/radio/bulletins` com o manifesto (título, URL, duração, transcrição, vozes). Os boletins entram como `pending`. Com `RADIO_AUTO_PUBLISH=true` e checagem aprovada, são publicados direto; senão aparecem no Filament (com modo seguro).
4. A grade toca os boletins nos programas `falado`; `▶ News` toca o mais recente.

Regras do roteiro: só fatos do briefing (nada inventado como notícia real), rumor dito como rumor, nunca nomes de personagens da história, nunca datas ou preços que não estejam no briefing. Teste com um briefing de fixture contendo um post `historia` e um `leak`: nenhum dos dois pode aparecer no roteiro.

## Custos (referência)
Haiku: centavos por mês. Kokoro: grátis (roda no runner do GitHub, perto de 1x tempo real em CPU). R2: dentro da cota grátis. Não adotar TTS pago sem ADR.

## Testes
`liveAt` PHP x JS, programação por horário (fuso America/Sao_Paulo), filtro do briefing, endpoint interno exige token, boletim `pending` não toca.
