<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Dia X
    |--------------------------------------------------------------------------
    |
    | Data e hora do lançamento de GTA VI nos consoles, usada pela contagem
    | regressiva do feed (DayXBanner). Depois dessa data, o banner mostra
    | "Dia N em Leonida" em vez da contagem.
    |
    */

    'launch_at' => env('LAUNCH_AT', '2026-11-19T00:00:00-03:00'),

];
