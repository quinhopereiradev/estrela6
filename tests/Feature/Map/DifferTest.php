<?php

declare(strict_types=1);

use App\Domain\Map\Services\MapSync\Differ;
use App\Models\MapLandmark;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('diff reports new, moved, renamed, retyped, removed and reactivated landmarks', function (): void {
    MapLandmark::create(['source_id' => 'L1', 'name' => 'Oficina', 'type' => 'loja', 'tier' => 2, 'x' => 0.0, 'y' => 0.0, 'is_active' => true]);
    MapLandmark::create(['source_id' => 'L2', 'name' => 'Posto Antigo', 'type' => 'posto', 'tier' => 2, 'x' => 100.0, 'y' => 100.0, 'is_active' => true]);
    MapLandmark::create(['source_id' => 'L3', 'name' => 'Sumido', 'type' => 'loja', 'tier' => 2, 'x' => 0.0, 'y' => 0.0, 'is_active' => true]);
    MapLandmark::create(['source_id' => 'L4', 'name' => 'Reativado', 'type' => 'loja', 'tier' => 2, 'x' => 0.0, 'y' => 0.0, 'is_active' => false]);

    $rows = [
        ['L1', 'Oficina Renomeada', '', '', 0.0, 0.0, '', 'loja', '', 2, ''],
        ['L2', 'Posto Antigo', '', '', 200.0, 200.0, '', 'marco', '', 2, ''],
        ['L4', 'Reativado', '', '', 0.0, 0.0, '', 'loja', '', 2, ''],
        ['L5', 'Local Novo', '', '', 0.0, 0.0, '', 'loja', '', 2, ''],
    ];

    $summary = (new Differ(movedThreshold: 25))->diff($rows);

    expect($summary['counts'])->toBe([
        'total' => 4,
        'novos' => 1,
        'movidos' => 1,
        'renomeados' => 1,
        'tipo_alterado' => 1,
        'removidos' => 1,
        'reativados' => 1,
    ])
        ->and($summary['exemplos']['novos'])->toContain('L5 · Local Novo')
        ->and($summary['exemplos']['removidos'])->toContain('L3 · Sumido');
});

test('a landmark that moved less than the threshold is not reported as moved', function (): void {
    MapLandmark::create(['source_id' => 'L1', 'name' => 'Oficina', 'type' => 'loja', 'tier' => 2, 'x' => 0.0, 'y' => 0.0, 'is_active' => true]);

    $summary = (new Differ(movedThreshold: 25))->diff([
        ['L1', 'Oficina', '', '', 10.0, 10.0, '', 'loja', '', 2, ''],
    ]);

    expect($summary['counts']['movidos'])->toBe(0);
});
