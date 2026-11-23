<?php

declare(strict_types=1);

use App\Domain\Spoilers\Enums\SpoilerType;
use App\Models\MapLandmark;
use App\Models\MapLandmarkOverride;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makeLandmark(array $attributes = []): MapLandmark
{
    return MapLandmark::create(array_merge([
        'source_id' => 'L1',
        'name' => 'Posto da BF',
        'district' => 'Vice Beach',
        'area' => 'Ocean Drive',
        'region' => 'vice-city',
        'type' => 'posto',
        'tier' => 2,
        'enterable' => false,
        'unconfirmed' => false,
        'closed' => false,
        'x' => 120.5,
        'y' => 340.2,
        'real_world' => null,
        'is_active' => true,
    ], $attributes));
}

test('toMapRow returns the compact format consumed by the Leaflet map', function (): void {
    $landmark = makeLandmark(['enterable' => true]);

    expect($landmark->toMapRow())->toBe([
        'L1', 'Posto da BF', 'Vice Beach', 'Ocean Drive', 120.5, 340.2, '', 'posto', 'e', 2, 'vice-city', null,
    ]);
});

test('an admin override replaces name, type, tier and spoiler type without touching the source row', function (): void {
    $landmark = makeLandmark();
    MapLandmarkOverride::create([
        'source_id' => 'L1',
        'name' => 'Nome ajustado',
        'type' => 'marco',
        'tier' => 1,
        'spoiler_type' => SpoilerType::Easter,
    ]);

    $row = $landmark->refresh()->toMapRow();

    expect($row[1])->toBe('Nome ajustado')
        ->and($row[7])->toBe('marco')
        ->and($row[9])->toBe(1)
        ->and($row[11])->toBe('easter')
        ->and($landmark->name)->toBe('Posto da BF');
});

test('a hidden override removes the landmark from the map entirely', function (): void {
    $landmark = makeLandmark();
    MapLandmarkOverride::create(['source_id' => 'L1', 'is_hidden' => true]);

    expect($landmark->refresh()->toMapRow())->toBeNull();
});

test('the active scope only returns landmarks still present at the source', function (): void {
    makeLandmark(['source_id' => 'L1', 'is_active' => true]);
    makeLandmark(['source_id' => 'L2', 'is_active' => false]);

    expect(MapLandmark::active()->pluck('source_id')->all())->toBe(['L1']);
});
