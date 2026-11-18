<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Sincronização do mapa (GTADB.org — dados e tiles sob CC BY 4.0)
    |--------------------------------------------------------------------------
    | Fonte: https://github.com/rolux/gtadb.org
    | Crédito obrigatório: "GTA VI Landmarks Data (CC BY 4.0) — https://map.gtadb.org"
    |                      "GTA VI Map Tiles (CC BY 4.0) — https://map.gtadb.org"
    */
    'map' => [
        'repo' => env('LEONIDA_MAP_REPO', 'rolux/gtadb.org'),
        'branch' => env('LEONIDA_MAP_BRANCH', 'main'),
        'landmarks_path' => 'map/data/6/landmarks.json',

        // Mapa-base da comunidade. Com auto_upgrade_tileset = true, o comando detecta
        // uma versão nova (ex.: "yanis,18") e a coloca para revisão.
        'tiles_root' => 'maps/tiles/6',
        'tileset' => env('LEONIDA_MAP_TILESET', 'yanis,17'),
        'auto_upgrade_tileset' => env('LEONIDA_MAP_AUTO_UPGRADE', true),

        // Limite leste do recorte em metros (corta o painel de legenda do mapa v17).
        // Confira a prévia ao trocar de versão do mapa.
        'tiles_xmax' => env('LEONIDA_MAP_TILES_XMAX', 3776),

        // Token opcional do GitHub (sem ele, o limite é 60 requisições/hora por IP).
        'github_token' => env('LEONIDA_GITHUB_TOKEN'),

        // Ferramentas externas
        'git' => env('LEONIDA_GIT_BIN', 'git'),
        'python' => env('LEONIDA_PYTHON_BIN', 'python3'),
        'pipeline_dir' => base_path('tools/map-pipeline'),

        // Pastas de trabalho
        'work_dir' => storage_path('app/map-sync'),          // clones e staging (privado)
        'public_disk_dir' => storage_path('app/public/map'),  // tiles publicados: /storage/map/tiles/v{N}
        'keep_tile_versions' => 2,                            // versões antigas mantidas (para rollback)

        // Um local que mudou mais que isto (metros) conta como "movido" no resumo
        'moved_threshold_m' => 25,

        // Sem revisão humana? (não recomendado: a fonte é uma reconstrução de fãs)
        'auto_publish' => env('LEONIDA_MAP_AUTO_PUBLISH', false),
    ],
];
