<?php

declare(strict_types=1);

use App\Domain\Map\Services\MapSync\UpstreamClient;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;

function makeUpstreamClient(array $overrides = []): UpstreamClient
{
    return new UpstreamClient(array_merge([
        'repo' => 'rolux/gtadb.org',
        'branch' => 'main',
        'github_token' => null,
        'git' => 'git',
    ], $overrides));
}

test('latestShaFor returns the sha of the latest commit touching the path', function (): void {
    Http::fake(['api.github.com/*' => Http::response([['sha' => 'abc123']])]);

    expect(makeUpstreamClient()->latestShaFor('map/data/6/landmarks.json'))->toBe('abc123');
});

test('latestShaFor returns null when the path has no commits', function (): void {
    Http::fake(['api.github.com/*' => Http::response([])]);

    expect(makeUpstreamClient()->latestShaFor('does/not/exist.json'))->toBeNull();
});

test('newestTileset picks the highest yanis version among the tileset directories', function (): void {
    Http::fake(['api.github.com/*' => Http::response([
        ['type' => 'dir', 'name' => 'yanis,17'],
        ['type' => 'dir', 'name' => 'yanis,18'],
        ['type' => 'file', 'name' => 'yanis,99'],
        ['type' => 'dir', 'name' => 'other-mod'],
    ])]);

    expect(makeUpstreamClient()->newestTileset('maps/tiles/6'))->toBe('yanis,18');
});

test('sparseCheckout runs the expected git commands in order', function (): void {
    Process::fake();

    makeUpstreamClient()->sparseCheckout(storage_path('app/map-sync-test/upstream'), ['map/data/6/landmarks.json']);

    Process::assertRanTimes(fn (): bool => true, 4);
    Process::assertRan(fn ($process): bool => str_contains($process->command[0] ?? '', 'git') && ($process->command[1] ?? '') === 'clone');
    Process::assertRan(fn ($process): bool => ($process->command[3] ?? '') === 'sparse-checkout' && ($process->command[4] ?? '') === 'set');
});

test('sparseCheckout throws when a git step fails', function (): void {
    Process::fake(fn () => Process::result(errorOutput: 'fatal: repository not found', exitCode: 128));

    makeUpstreamClient()->sparseCheckout(storage_path('app/map-sync-test/upstream'), ['map/data/6/landmarks.json']);
})->throws(RuntimeException::class);
