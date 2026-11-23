<?php

declare(strict_types=1);

use App\Domain\Map\Services\MapSync\Pipeline;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;

function makePipeline(): Pipeline
{
    return new Pipeline([
        'python' => 'python3',
        'pipeline_dir' => base_path('tools/map-pipeline'),
        'tiles_xmax' => 3776,
    ]);
}

afterEach(function (): void {
    File::deleteDirectory(storage_path('app/pipeline-test'));
});

test('run calls curate, retile and regions in order and returns the decoded output', function (): void {
    $staging = storage_path('app/pipeline-test/run-1');

    Process::fake(function ($process) use ($staging) {
        $script = basename($process->command[2]);
        match (true) {
            str_contains($script, 'curate.py') => File::put("$staging/landmarks.json", json_encode([['L1', 'Local']])),
            str_contains($script, 'retile.py') => File::ensureDirectoryExists("$staging/tiles"),
            str_contains($script, 'regions.py') => File::put("$staging/regions.json", json_encode([['id' => 'vice-city']])),
            default => null,
        };

        return Process::result(output: 'ok');
    });

    $result = makePipeline()->run($staging, '/tmp/landmarks-raw.json', '/tmp/tiles-src', null, fn (): null => null);

    expect($result['landmarks'])->toBe([['L1', 'Local']])
        ->and($result['regions'])->toBe([['id' => 'vice-city']])
        ->and($result['tiles'])->toBe("$staging/tiles");

    Process::assertRanTimes(fn (): bool => true, 3);
});

test('run reuses the currently published tiles when the source tileset did not change', function (): void {
    $staging = storage_path('app/pipeline-test/run-2');
    $currentTiles = storage_path('app/pipeline-test/current-tiles');
    File::ensureDirectoryExists($currentTiles);

    Process::fake(function ($process) use ($staging) {
        $script = basename($process->command[2]);
        match (true) {
            str_contains($script, 'curate.py') => File::put("$staging/landmarks.json", json_encode([])),
            str_contains($script, 'regions.py') => File::put("$staging/regions.json", json_encode([])),
            default => null,
        };

        return Process::result(output: 'ok');
    });

    $result = makePipeline()->run($staging, '/tmp/landmarks-raw.json', null, $currentTiles, fn (): null => null);

    expect($result['tiles'])->toBeNull();
    Process::assertRanTimes(fn (): bool => true, 2);
});

test('run throws when there are no tiles at all to compute regions from', function (): void {
    $staging = storage_path('app/pipeline-test/run-3');

    Process::fake(function ($process) use ($staging) {
        if (str_contains(basename($process->command[2]), 'curate.py')) {
            File::put("$staging/landmarks.json", json_encode([]));
        }

        return Process::result(output: 'ok');
    });

    makePipeline()->run($staging, '/tmp/landmarks-raw.json', null, null, fn (): null => null);
})->throws(RuntimeException::class);

test('run throws when a script fails', function (): void {
    $staging = storage_path('app/pipeline-test/run-4');

    Process::fake(fn () => Process::result(errorOutput: 'boom', exitCode: 1));

    makePipeline()->run($staging, '/tmp/landmarks-raw.json', '/tmp/tiles-src', null, fn (): null => null);
})->throws(RuntimeException::class);
