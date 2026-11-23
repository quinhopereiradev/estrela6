<?php

declare(strict_types=1);

use App\Domain\Map\Enums\MapSyncRunStatus;
use App\Domain\Map\Services\MapSync\Publisher;
use App\Models\MapLandmark;
use App\Models\MapRegion;
use App\Models\MapSyncRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

function makePublisher(): Publisher
{
    return new Publisher([
        'tiles_disk' => 'public',
        'tiles_path' => 'map/tiles',
        'keep_tile_versions' => 2,
    ]);
}

function makeStagingRun(string $staging, array $rows, array $regions = [], bool $withTiles = true): MapSyncRun
{
    File::ensureDirectoryExists($staging);
    File::put("$staging/landmarks.json", json_encode($rows));
    File::put("$staging/regions.json", json_encode($regions));
    if ($withTiles) {
        File::ensureDirectoryExists("$staging/tiles/0");
        File::put("$staging/tiles/0/0_0.jpg", 'fake-tile-bytes');
    }

    return MapSyncRun::create(['status' => MapSyncRunStatus::PendingReview, 'staging_path' => $staging, 'landmarks_sha' => 'sha1']);
}

afterEach(function (): void {
    File::deleteDirectory(storage_path('app/publisher-test'));
});

test('publishing upserts landmarks, regions, uploads tiles and marks the run published', function (): void {
    Storage::fake('public');
    $staging = storage_path('app/publisher-test/run-1');
    $run = makeStagingRun($staging, [
        ['L1', 'Local Novo', 'Distrito', 'Area', 10.0, 20.0, '', 'loja', 'e', 2, 'vice-city'],
    ], [
        ['id' => 'vice-city', 'name' => 'Vice City', 'station' => 'vice', 'color' => '#ff00ff', 'label' => [0, 0], 'polys' => [[[0, 0]]]],
    ]);

    $moderator = User::factory()->create();

    makePublisher()->publish($run, userId: $moderator->id);

    expect(MapLandmark::where('source_id', 'L1')->first())
        ->name->toBe('Local Novo')
        ->enterable->toBeTrue();
    expect(MapRegion::find('vice-city'))->not->toBeNull();
    Storage::disk('public')->assertExists('map/tiles/v1/0/0_0.jpg');
    expect($run->refresh())
        ->status->toBe(MapSyncRunStatus::Published)
        ->tiles_version->toBe(1)
        ->published_by->toBe($moderator->id);
});

test('a landmark missing from a later run is deactivated, never deleted', function (): void {
    Storage::fake('public');
    MapLandmark::create(['source_id' => 'L1', 'name' => 'Vai sumir', 'type' => 'loja', 'tier' => 2, 'x' => 0.0, 'y' => 0.0, 'is_active' => true]);

    $staging = storage_path('app/publisher-test/run-2');
    $run = makeStagingRun($staging, [
        ['L2', 'Outro local', '', '', 0.0, 0.0, '', 'loja', '', 2, ''],
    ], withTiles: false);

    makePublisher()->publish($run);

    $landmark = MapLandmark::where('source_id', 'L1')->first();
    expect($landmark)->not->toBeNull()
        ->and($landmark->is_active)->toBeFalse();
});

test('publishing without new tiles keeps the previous tiles version', function (): void {
    Storage::fake('public');
    $staging = storage_path('app/publisher-test/run-3');
    $run = makeStagingRun($staging, [], withTiles: false);

    makePublisher()->publish($run);

    expect($run->refresh()->tiles_version)->toBeNull();
});

test('publishing a run that is not pending review is rejected', function (): void {
    $run = MapSyncRun::create(['status' => MapSyncRunStatus::Published]);

    makePublisher()->publish($run);
})->throws(RuntimeException::class);

test('rejecting a run marks it rejected and discards its staged tiles', function (): void {
    $staging = storage_path('app/publisher-test/run-4');
    $run = makeStagingRun($staging, []);

    makePublisher()->reject($run);

    expect($run->refresh()->status)->toBe(MapSyncRunStatus::Rejected)
        ->and(File::isDirectory("$staging/tiles"))->toBeFalse();
});

test('old tile versions beyond the keep limit are cleaned up after publishing', function (): void {
    Storage::fake('public');
    Storage::disk('public')->put('map/tiles/v1/0/0_0.jpg', 'old');
    Storage::disk('public')->put('map/tiles/v2/0/0_0.jpg', 'old');
    MapSyncRun::create(['status' => MapSyncRunStatus::Published, 'tiles_version' => 2, 'published_at' => now()]);

    $staging = storage_path('app/publisher-test/run-5');
    $run = makeStagingRun($staging, []);

    makePublisher()->publish($run);

    Storage::disk('public')->assertExists('map/tiles/v3/0/0_0.jpg');
    Storage::disk('public')->assertExists('map/tiles/v2/0/0_0.jpg');
    Storage::disk('public')->assertMissing('map/tiles/v1/0/0_0.jpg');
});
