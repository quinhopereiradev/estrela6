<?php

declare(strict_types=1);

namespace App\Domain\Map\Services\MapSync;

use App\Domain\Map\Enums\MapSyncRunStatus;
use App\Models\MapLandmark;
use App\Models\MapRegion;
use App\Models\MapSyncRun;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Aplica uma execução revisada: grava locais e regiões e troca a versão dos tiles de uma vez.
 * Usado pelo comando `leonida:sync-map --publish=ID` e pela ação "Aprovar" do Filament.
 */
final readonly class Publisher
{
    /**
     * @param  array{tiles_disk: string, tiles_path: string, keep_tile_versions: int}  $cfg
     */
    public function __construct(private array $cfg) {}

    public function publish(MapSyncRun $run, ?int $userId = null): void
    {
        if ($run->status !== MapSyncRunStatus::PendingReview) {
            throw new RuntimeException("A execução #{$run->id} está em '{$run->status->value}', não em revisão.");
        }
        $staging = $run->staging_path;
        /** @var array<int, array<int, mixed>> $rows */
        $rows = json_decode(File::get("$staging/landmarks.json"), true, 512, JSON_THROW_ON_ERROR);
        /** @var array<int, array<string, mixed>> $regions */
        $regions = json_decode(File::get("$staging/regions.json"), true, 512, JSON_THROW_ON_ERROR);
        $now = now();

        // 1) tiles novos: sobe para o disco de mídia ANTES de virar a chave no banco
        $tilesVersion = null;
        if (File::isDirectory("$staging/tiles")) {
            $tilesVersion = (MapSyncRun::currentTilesVersion() ?? 0) + 1;
            $this->uploadTiles("$staging/tiles", $tilesVersion);
        }

        // 2) banco: tudo numa transação
        DB::transaction(function () use ($rows, $regions, $run, $now, $tilesVersion, $userId): void {
            $seen = [];
            foreach (array_chunk($rows, 500) as $chunk) {
                $payload = [];
                foreach ($chunk as $row) {
                    [$id, $name, $district, $area, $x, $y, $real, $type, $flags, $tier, $region] = array_pad($row, 11, null);
                    $seen[] = $id;
                    $payload[] = [
                        'source_id' => $id, 'name' => $name, 'district' => $district ?: null, 'area' => $area ?: null,
                        'region' => $region ?: null, 'type' => $type, 'tier' => $tier,
                        'enterable' => str_contains((string) $flags, 'e'), 'unconfirmed' => str_contains((string) $flags, 'u'), 'closed' => str_contains((string) $flags, 'c'),
                        'x' => $x, 'y' => $y, 'real_world' => $real ?: null, 'is_active' => true,
                        'source_sha' => $run->landmarks_sha, 'first_seen_at' => $now, 'last_seen_at' => $now,
                        'created_at' => $now, 'updated_at' => $now,
                    ];
                }
                MapLandmark::upsert($payload, ['source_id'], [
                    'name', 'district', 'area', 'region', 'type', 'tier', 'enterable', 'unconfirmed', 'closed',
                    'x', 'y', 'real_world', 'is_active', 'source_sha', 'last_seen_at', 'updated_at',
                ]);
            }
            // sumiu da fonte: desativa (links e pins antigos continuam resolvendo)
            MapLandmark::whereNotIn('source_id', $seen)->where('is_active', true)->update(['is_active' => false, 'updated_at' => $now]);

            foreach ($regions as $region) {
                MapRegion::updateOrCreate(['id' => $region['id']], [
                    'name' => $region['name'], 'station' => $region['station'], 'color' => $region['color'],
                    'label_x' => $region['label'][0], 'label_y' => $region['label'][1], 'polygons' => $region['polys'],
                ]);
            }

            $run->update([
                'status' => MapSyncRunStatus::Published, 'tiles_version' => $tilesVersion,
                'published_at' => $now, 'published_by' => $userId,
            ]);
        });

        Cache::forget('leonida.map.landmarks');
        Cache::forget('leonida.map.regions');
        $run->appendLog('Publicado'.($tilesVersion ? " (tiles v$tilesVersion)" : ' (tiles mantidos)'));
        $this->cleanupOldTiles();
    }

    public function reject(MapSyncRun $run): void
    {
        $run->update(['status' => MapSyncRunStatus::Rejected]);
        File::deleteDirectory($run->staging_path.'/tiles');
        $run->appendLog('Rejeitado na revisão');
    }

    /** Sobe todos os arquivos de $localDir para "{tiles_path}/v{$version}" no disco de mídia. */
    private function uploadTiles(string $localDir, int $version): void
    {
        $disk = Storage::disk($this->cfg['tiles_disk']);
        $base = "{$this->cfg['tiles_path']}/v$version";
        $disk->deleteDirectory($base);

        foreach (File::allFiles($localDir) as $file) {
            $relative = str_replace('\\', '/', $file->getRelativePathname());
            $disk->put("$base/$relative", File::get($file->getPathname()));
        }
    }

    /** Mantém só as N versões mais novas de tiles (as outras servem de rollback por um tempo). */
    private function cleanupOldTiles(): void
    {
        $disk = Storage::disk($this->cfg['tiles_disk']);
        $base = $this->cfg['tiles_path'];
        $versions = collect($disk->directories($base))
            ->map(fn (string $dir): int => (int) ltrim(basename($dir), 'v'))
            ->filter()->sortDesc()->values();

        foreach ($versions->slice($this->cfg['keep_tile_versions']) as $version) {
            $disk->deleteDirectory("$base/v$version");
        }
    }
}
