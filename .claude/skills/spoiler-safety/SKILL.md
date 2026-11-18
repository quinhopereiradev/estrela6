---
name: spoiler-safety
description: Regras e checklist para que nenhum conteúdo do portal (feed, mapa, rádio, busca, SEO, notificações e o painel Filament) entregue spoiler a leitores ou moderadores. Use sempre que uma mudança exibir, resumir, indexar ou notificar conteúdo.
---

# Proteção contra spoilers

Spoiler vazado é bug de severidade alta. Na dúvida, esconda.

## Modelo (igual ao protótipo: `SPOILER_TYPES`, `SPOILER_PRESETS`, `PIN_SPOILER`)
- `SpoilerType` (enum) por conteúdo: `null` (sem spoiler), `historia` (enredo, personagens, missões, finais), `easter` (easter eggs e segredos), `leak` (notícias sobre material vazado e locais não confirmados).
- Pins herdam pela categoria: `missao` → `historia`; `easter-egg` e `segredo` → `easter`. O moderador pode sobrescrever.
- Preferência do leitor = preset + ajustes finos por tipo:
  - `oficial` (**padrão**, "Só o oficial"): esconde `leak`.
  - `cego` ("Às cegas"): esconde `historia`, `easter` e `leak`, e o mapa começa em névoa (o leitor revela região por região).
  - `tudo` ("Quero tudo"): mostra tudo.
  Visitante sem conta: cookie `lu_spoil`, padrão `oficial`; o modal de boas-vindas pede a escolha.
- **Mídia vazada (vídeo, imagem, áudio, código) nunca é hospedada nem incorporada**, em nenhum preset (risco de DMCA). `leak` cobre só texto nosso sobre o assunto.
- Envios da comunidade não podem ser `leak`; a coleta automática marca e manda para a pauta.

## Onde o conteúdo aparece (cheque todos)
| Superfície | O que fazer |
|---|---|
| Cards do feed, destaque, "últimas 48 h" | Título, resumo e capa trocados por placeholder + botão "revelar" |
| Página do post | Bloqueio de página inteira até confirmar |
| Busca (Ctrl+K e do feed) | Item escondido **não entra no resultado**; mostrar só "N resultados ocultos" |
| Mapa (popup, lista, legenda, contadores) | Pin oculto não é renderizado; contadores não contam o oculto |
| Rádio (boletins, DJ, recados) | Roteiros só usam conteúdo com `spoiler_type = null` e `reliability != nao-verificado` |
| `<title>`, Open Graph, Twitter Card, JSON-LD, sitemap, RSS | Sempre a versão segura; posts com spoiler têm título neutro nas meta tags |
| Notificações, e-mails, toasts, push | Texto genérico ("Seu artigo foi publicado"), nunca o título |
| Cartões de compartilhamento | Prefixo "⚠️ SPOILER" e sem descrição |
| Filament (admin) | Ver abaixo |

## Modo seguro do moderador (Filament)
- Preferência por usuário `users.mod_safe_mode` (boolean, **default true**), alternável no topo das filas.
- Com o modo ligado, nas filas de pins e de artigos, mostrar apenas: localização (mini-mapa, região, local conhecido mais próximo, coordenadas), autor e nível de confiança, data, resultado da checagem automática e duplicatas **como contagem** (sem títulos).
- Ocultar: título, texto, imagem, categoria, tags e a sugestão de categoria da IA.
- "Ver só o ponto no mapa" leva ao local e marca um alvo genérico, **sem abrir o pin**.
- "Revelar só este item" revela um registro por vez e não persiste.
- `getTitle()`, breadcrumbs, notificações de ação e logs exibidos na tela também respeitam o modo.

## Implementação
- Centralize em `App\Domain\Spoilers\SpoilerGate`: `canSee(?User $viewer, Spoilable $item): bool` e `safeTitle(Spoilable $item): string`. Nunca reimplemente a regra em Blade.
- Interface `Spoilable` (Post, Marker, Bulletin) com `spoilerType(): ?SpoilerType`.
- Query scopes: `Post::visibleTo($viewer)`; busca e roteiros usam o scope, não filtro em PHP depois da query.
- Blade: componente `<x-spoiler :item="$post">...</x-spoiler>`.

## Testes obrigatórios para qualquer superfície nova
- Visitante padrão não vê título/resumo/capa de post `historia` nem `easter`.
- Visitante padrão (`oficial`) não vê `leak`; `cego` não vê nenhum tipo e o mapa começa em névoa.
- Nenhum post `leak` tem mídia anexada (validação no model).
- Busca não retorna item oculto.
- Meta tags de post com spoiler não contêm o título real.
- Filament com `mod_safe_mode = true`: a página da fila não contém título, texto nem URL da imagem pendente (`assertDontSee`).
