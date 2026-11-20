<?php

declare(strict_types=1);

return [
    'safe_title' => '⚠ Conteúdo com possível spoiler',
    'hidden_aria' => 'Conteúdo escondido por causa da sua proteção contra spoilers',
    'reveal_hint' => 'Toque para revelar',
    'types' => [
        'historia' => [
            'label' => 'História e missões',
            'hint' => 'Enredo, personagens, missões e finais.',
        ],
        'easter' => [
            'label' => 'Easter eggs e segredos',
            'hint' => 'Easter eggs, segredos e o que tem escondido em cada lugar.',
        ],
        'leak' => [
            'label' => 'Leaks e rumores',
            'hint' => 'Material vazado e locais ainda não confirmados pela Rockstar.',
        ],
    ],
    'presets' => [
        'tudo' => [
            'label' => 'Quero tudo',
            'tag' => 'SEM FILTRO',
            'description' => 'Leaks, teorias, missões e segredos à vista. Para quem caça tudo antes de todo mundo.',
        ],
        'oficial' => [
            'label' => 'Só o oficial',
            'tag' => 'RECOMENDADO',
            'description' => 'Esconde leaks e locais não confirmados. Bom para quem ainda vai comprar ou espera a versão de PC.',
        ],
        'cego' => [
            'label' => 'Às cegas',
            'tag' => 'ZERO SPOILER',
            'description' => 'Esconde história, missões, segredos e leaks. O mapa começa coberto e você revela as regiões conforme explora no jogo.',
        ],
    ],
    'modal' => [
        'eyebrow_first_time' => '// ANTES DE ENTRAR EM LEONIDA',
        'eyebrow_preferences' => '// SUAS PREFERÊNCIAS',
        'title' => 'Proteção contra spoilers',
        'intro' => 'O GTA VI chega primeiro aos consoles, e a versão de PC ainda não tem data. Escolha o quanto você quer saber. Dá para mudar quando quiser pelo escudo no topo da página.',
        'enter' => 'Entrar no portal',
        'save' => 'Salvar preferências',
        'cancel' => 'Cancelar',
    ],
    'shield' => [
        'label' => 'Escudo rápido',
        'on' => 'Escudo ligado',
        'off' => 'Ligar escudo',
        'hint' => 'Esconde todo spoiler na hora, sem mexer nas suas preferências.',
    ],
];
