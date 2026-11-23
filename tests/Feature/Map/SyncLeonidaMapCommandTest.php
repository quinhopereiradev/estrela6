<?php

declare(strict_types=1);

use App\Domain\Map\Enums\MapSyncRunStatus;
use App\Models\MapLandmark;
use App\Models\MapLandmarkOverride;
use App\Models\MapSyncRun;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

afterEach(function (): void {
    File::deleteDirectory(storage_path('app/map-sync'));
});

function fakeGithubCommits(string $sha): void
{
    Http::fake(['api.github.com/*' => Http::response([['sha' => $sha]])]);
}

function fakePipelineProcess(): void
{
    Process::fake(function ($process) {
        $argv = $process->command;
        if (($argv[0] ?? '') === 'git') {
            if (($argv[1] ?? '') === 'clone') {
                File::ensureDirectoryExists($argv[7]);
            }

            return Process::result(output: 'ok');
        }

        $script = basename($argv[2] ?? '');
        $args = array_slice($argv, 3);
        match (true) {
            str_contains($script, 'curate.py') => File::put($args[1], json_encode([
                ['L1', 'Posto da BF', '', '', 10.0, 20.0, '', 'posto', '', 2, 'vice-city'],
            ])),
            str_contains($script, 'retile.py') => File::ensureDirectoryExists($args[1]),
            str_contains($script, 'regions.py') => File::put($args[2], json_encode([
                ['id' => 'vice-city', 'name' => 'Vice City', 'station' => 'vice', 'color' => '#ff00ff', 'label' => [0, 0], 'polys' => [[[0, 0]]]],
            ])),
            default => null,
        };

        return Process::result(output: 'ok');
    });
}

test('a fresh sync with no previous run prepares a run for review', function (): void {
    Storage::fake('public');
    fakeGithubCommits('sha-landmarks');
    fakePipelineProcess();

    $this->artisan('leonida:sync-map')->assertSuccessful();

    $run = MapSyncRun::first();
    expect($run->status)->toBe(MapSyncRunStatus::PendingReview)
        ->and($run->summary['counts']['novos'])->toBe(1);
});

test('syncing again with the same shas reports nothing new and touches no files', function (): void {
    Storage::fake('public');
    fakeGithubCommits('sha-same');
    MapSyncRun::create([
        'status' => MapSyncRunStatus::Published,
        'landmarks_sha' => 'sha-same',
        'tiles_sha' => 'sha-same',
        'tileset' => 'yanis,17',
        'tiles_version' => 1,
        'published_at' => now(),
    ]);

    $this->artisan('leonida:sync-map')->assertSuccessful();

    expect(MapSyncRun::where('status', MapSyncRunStatus::NothingNew)->exists())->toBeTrue();
    Process::assertNothingRan();
});

test('--publish applies a pending run and --reject discards it', function (): void {
    Storage::fake('public');
    $staging = storage_path('app/map-sync/runs/published-test');
    File::ensureDirectoryExists($staging);
    File::put("$staging/landmarks.json", json_encode([
        ['L1', 'Posto da BF', '', '', 10.0, 20.0, '', 'posto', '', 2, 'vice-city'],
    ]));
    File::put("$staging/regions.json", json_encode([]));
    $run = MapSyncRun::create(['status' => MapSyncRunStatus::PendingReview, 'staging_path' => $staging]);

    $this->artisan("leonida:sync-map --publish={$run->id}")->assertSuccessful();

    expect($run->refresh()->status)->toBe(MapSyncRunStatus::Published)
        ->and(MapLandmark::where('source_id', 'L1')->exists())->toBeTrue();

    $rejectRun = MapSyncRun::create(['status' => MapSyncRunStatus::PendingReview, 'staging_path' => $staging]);
    $this->artisan("leonida:sync-map --reject={$rejectRun->id}")->assertSuccessful();

    expect($rejectRun->refresh()->status)->toBe(MapSyncRunStatus::Rejected);
});

test('the sync never writes to admin overrides', function (): void {
    Storage::fake('public');
    MapLandmarkOverride::create(['source_id' => 'L1', 'name' => 'Nome do admin']);
    fakeGithubCommits('sha-landmarks');
    fakePipelineProcess();

    $this->artisan('leonida:sync-map')->assertSuccessful();
    $run = MapSyncRun::first();
    $this->artisan("leonida:sync-map --publish={$run->id}")->assertSuccessful();

    expect(MapLandmarkOverride::where('source_id', 'L1')->first()->name)->toBe('Nome do admin');
});
