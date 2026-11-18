# Leonida Underground — Sincronização do mapa (`leonida:sync-map`)

Atualiza o mapa a partir do **GTADB.org** (dados e tiles sob **CC BY 4.0**) sem baixar o repositório inteiro, processa com os mesmos scripts do protótipo e deixa tudo **em revisão** antes de publicar.

## Como funciona

```
GitHub (rolux/gtadb.org)
   │  1. API: SHA do último commit de map/data/6/landmarks.json e de maps/tiles/6/yanis,NN
   │     + detecta versão nova do mapa (yanis,18, ...)
   ▼
Nada mudou? ──► status "nothing_new" e termina
   │
   │  2. git sparse checkout: baixa só o que mudou (~11 MB de dados; tiles só se o mapa mudou)
   ▼
tools/map-pipeline (Python)
   curate.py   3.431 locais → ~580 relevantes (sem nome, genéricos, demolidos e duplicados saem)
   retile.py   tiles 1024px nos níveis -4..0 + preview.jpg (corta o painel de legenda do mapa)
   regions.py  contornos das 6 regiões + região de cada local
   │
   │  3. Differ: compara com o banco → novos, movidos (>25 m), renomeados, tipo alterado, removidos
   ▼
map_sync_runs (status "pending_review", resumo + prévia)
   │
   │  4. Você aprova (Filament ou --publish=ID)
   ▼
Publisher: upsert dos locais · desativa os que sumiram (sem apagar)
           regiões · tiles em /storage/map/tiles/v{N} · limpa o cache
```

**O que nunca acontece:**
- **Seus ajustes não se perdem.** Edições do admin ficam em `map_landmark_overrides` e a sincronização nunca escreve nessa tabela.
- **Nada é apagado.** Um local que some da fonte vira `is_active = false`, e links e pins antigos continuam funcionando.
- **O mapa nunca fica pela metade.** Os tiles novos vão para uma pasta com o número da versão, e a troca acontece quando a publicação termina. As 2 versões anteriores ficam guardadas para rollback.

## Arquivos

| Arquivo | O que é |
|---|---|
| `config/leonida.php` | Repositório, versão do mapa, recorte, binários, pastas |
| `database/migrations/…_create_map_sync_tables.php` | `map_landmarks`, `map_landmark_overrides`, `map_regions`, `map_sync_runs` |
| `app/Models/*` | Models (o `MapLandmark::toMapRow()` aplica os ajustes do admin) |
| `app/Services/LeonidaMap/UpstreamClient.php` | GitHub API + sparse checkout |
| `app/Services/LeonidaMap/Pipeline.php` | Roda os scripts Python |
| `app/Services/LeonidaMap/Differ.php` | Resumo do que mudou |
| `app/Services/LeonidaMap/Publisher.php` | Publica / rejeita (reutilizável pela ação do Filament) |
| `app/Console/Commands/SyncLeonidaMap.php` | O comando |
| `app/Http/Controllers/MapDataController.php` | `locais.json`, `regioes.json`, `meta.json` para o Leaflet |
| `routes/map-sync.php` | Rotas e agendamento para colar no projeto |
| `tools/map-pipeline/*.py` | Scripts testados no protótipo (saída idêntica) |

## Instalação

```bash
# servidor precisa de git e Python 3.10+
pip install -r tools/map-pipeline/requirements.txt
php artisan migrate
php artisan storage:link

# primeira carga (processa dados e tiles)
php artisan leonida:sync-map --force
php artisan leonida:sync-map --publish=1
```

`.env` opcional:

```
LEONIDA_GITHUB_TOKEN=ghp_...        # sobe o limite da API de 60 para 5.000 req/hora
LEONIDA_MAP_TILESET="yanis,17"
LEONIDA_MAP_AUTO_UPGRADE=true       # avisa quando sair yanis,18 (vai para revisão)
LEONIDA_MAP_AUTO_PUBLISH=false      # recomendado: revisar antes
```

## Uso

```bash
php artisan leonida:sync-map                 # verifica e prepara para revisão
php artisan leonida:sync-map --force         # reprocessa tudo
php artisan leonida:sync-map --publish=12    # aprova a execução 12
php artisan leonida:sync-map --reject=12     # descarta a execução 12
```

Agendado em `routes/console.php`: todo dia às 04:10 na semana de lançamento; depois, semanal.

## Quando a versão do mapa mudar (ex.: v17 → v18)

O recorte que remove o painel de legenda (que tem miniaturas de imagens da Rockstar) depende do layout de cada versão. Na revisão:
1. abra o `preview.jpg` da execução;
2. se aparecer parte do painel, ajuste `LEONIDA_MAP_TILES_XMAX` e rode com `--force`;
3. as regiões são recalculadas sozinhas; se a divisa mudar muito, ajuste as âncoras em `regions.py`.

## Próximos passos (quando montarmos o backend)

- Recurso Filament `MapSyncRunResource` com prévia, resumo e ações **Aprovar** / **Rejeitar** (chamando `Publisher`).
- Recurso Filament para `map_landmark_overrides` (renomear, trocar tipo, marcar spoiler, esconder).
- Notificação no painel quando houver execução em revisão.

## Crédito obrigatório (CC BY 4.0)

Exibir no mapa: *Mapa: Yanis GTA VI Community Map via GTADB.org · Locais: GTADB.org e colaboradores · CC BY 4.0 · recortado e com cores adaptadas.*
