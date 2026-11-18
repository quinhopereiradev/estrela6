---
name: mapa-leaflet
description: Regras e técnicas do mapa interativo (Leaflet CRS.Simple, tiles do GTADB, regiões, landmarks, pins da comunidade, confirmações, ímã de regiões e desempenho). Use ao mexer em qualquer coisa do mapa ou na sincronização com o GTADB.
---

# Mapa interativo

Referência: `docs/03-funcionalidades.md#mapa`, `docs/reference/prototype/App.jsx` (`LeafletMap`, `MapPage`, `ModerationDrawer`) e o pacote `docs/reference/laravel-leonida/` (sincronização).

## Coordenadas e dados
- `L.CRS.Simple`, unidades = metros do jogo, `lat = y`, `lng = x`. Zoom -4..0 (tiles 1024 px), máximo nativo 0.
- Landmarks vêm do GTADB (CC BY 4.0) pelo comando `leonida:sync-map`, que deixa tudo em revisão até publicar no Filament. Ajustes do admin vivem em `map_landmark_overrides` e nunca são sobrescritos.
- Endpoints JSON com cache e ETag: `/map/locais.json`, `/map/regioes.json`, `/map/meta.json`. Tiles versionados em `/storage/map/tiles/v{N}` (troca atômica; 2 versões antigas para rollback).
- Atribuição visível: "Mapa: Yanis · GTA VI Community Map via GTADB · CC BY 4.0".

## Interação (igual ao protótipo)
- Clique esquerdo: seleciona a região (enquadra). Botão direito: sugerir pin (exige login).
- 1 clique em landmark/pin: abre a ficha. 2 cliques: vai até ele (`map._go`).
- Filtro de camadas: Locais / Pins / Ambos. Hash na URL: `#local-ID`, `#pin-ID`, `#regiao-ID`, `#ponto-X,Y` (alvo genérico do modo seguro).
- Ímã de regiões: só puxa quando o arrasto cruza para **outra** região e a largura visível é ≥ 4500 m.

## Desempenho (não regredir)
- Tiles com o filtro de cor "assado" no canvas uma vez por tile (`FilteredTileLayer`), +1 px de CSS para esconder emendas.
- Hover de região: polilinha de halo, **nunca** `filter: drop-shadow` em polígonos SVG grandes.
- Animação: `map._go(latlng, zoom, done)` (pan + zoom CSS, afastando antes se o destino estiver longe). Não use `flyTo` com centenas de marcadores.
- Popups com `autoPan: false`. `preferCanvas: true`; clustering acima de 300 pins visíveis.
- Teste de fumaça no Pest browser: zoom in/out em 3 regiões sem erro de console.

## Pins da comunidade
- Campos: título, descrição, categoria (`MarkerCategory`), x, y, imagem opcional (redimensionada, sem EXIF), autor, status (`pending|approved|rejected`), `is_first_discovery` (nada aprovado a < 60 m), confirmações ("Eu também vi isso", 1 por usuário).
- Aviso de duplicata ao criar: pin aprovado a < 80 m.
- Usuário "Confiável" (≥ 150 de respeito) tem aprovação automática; os demais vão para a fila de moderação (modo seguro, ver `filament-admin`).
- Pins com spoiler seguem `spoiler-safety` (inclusive névoa de região).

## Testes
Actions de criar/aprovar/confirmar pin (pontos, primeiro descobridor, duplicata); endpoints JSON (cache, sem pins ocultos para o nível de spoiler do visitante); browser: botão direito → modal de login quando anônimo.
