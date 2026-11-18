---
name: filament-admin
description: Como criar e alterar o painel /admin (Filament 5) do Estrela6 — tema GTA VI, filas de moderação com modo seguro, pauta do feed, sincronização do mapa e rádio. Use para qualquer Resource, Page, Widget ou Action do Filament.
---

# Painel Filament (/admin)

## Painel e tema
- Um painel `admin` em `app/Providers/Filament/AdminPanelProvider.php`, rota `/admin`, MFA obrigatório para papéis `admin` e `moderador`.
- Tema próprio: `php artisan make:filament-theme admin` → `resources/css/filament/admin/theme.css`.
  Identidade do protótipo: fundo `#0a0a0f`, rosa neon `#ff007f` (primária), ciano `#00f0ff`, laranja pôr do sol `#ff5e00`, violeta `#a78bfa`; títulos em fonte condensada com licença OFL (a mesma do site), rótulos em mono (ex.: JetBrains Mono, OFL); cards de vidro escuro (`backdrop-blur`, borda rosa a 20%).
  Sem logos nem imagens da Rockstar: a marca é a do portal.
- `->colors(['primary' => Color::hex('#ff007f'), 'info' => Color::hex('#00f0ff'), 'warning' => Color::hex('#ff5e00')])`, tema escuro forçado.
- Navegação em português, grupos: **Pauta** (Posts, Fila de pins, Coleta automática), **Mapa** (Locais, Regiões, Sincronizações), **Rádio** (Estações, Faixas, Programas, Boletins), **Comunidade** (Usuários, Conquistas, Denúncias), **Sistema**.

## Papéis (Policies, nunca checagem solta)
`admin` (tudo), `moderador` (pauta, pins, denúncias), `editor` (posts próprios + pauta sem publicar). As mesmas Policies do site.

## Modo seguro (obrigatório nas filas)
Leia a skill `spoiler-safety`. Padrão de implementação:
- Trait `HasModSafeMode` para Pages/Resources de fila: lê `auth()->user()->mod_safe_mode`, expõe `isSafe()` e `reveal(int $id)` (estado Livewire, não persiste).
- Colunas e entries sensíveis usam `->hidden(fn ($record) => $this->hides($record))` + uma entry substituta "Conteúdo oculto · revelar".
- Toggle no header da página (`Action::make('safeMode')`) que alterna e salva em `users.mod_safe_mode`.
- Mini-mapa: componente Blade `<x-admin.map-thumb :x :y />` que recorta os tiles (mesma técnica do `MapThumb` do protótipo). A ação "Ver só o ponto" abre `/mapa#ponto-<x>,<y>` em nova aba, sem `pin` no hash.
- Notificações: `Notification::make()->title('Item publicado')`, nunca com o título do item.

## Filas e ações
- **Fila de pins** (`MarkerResource`, filtro padrão `status = pending`): Aprovar (concede pontos via Action de domínio), Recusar com motivo (enum `RejectReason`, notifica o autor), Ver só o ponto, duplicatas a < 80 m (contagem no modo seguro).
- **Pauta do feed** (`PostResource`, aba "Na pauta"): origem (`community` | `collector` | `staff`), escolha do selo de confiabilidade ao publicar, Publicar/Recusar com motivo, checagem automática (tamanho, fonte, cópia, palavrões, sugestão de spoiler da IA). Fontes oficiais podem ter `auto_publish`.
- **Sincronizações do mapa**: lista de `map_sync_runs`, ações Publicar e Rejeitar chamando o `Publisher` (pacote em `docs/reference/laravel-leonida`).
- **Boletins da rádio**: lista dos boletins gerados, player, transcrição (respeita o modo seguro), ação "Regerar".

## Testes
Para cada Resource: listar, filtrar, cada ação, autorização por papel e `assertDontSee` do conteúdo pendente com o modo seguro ligado.
