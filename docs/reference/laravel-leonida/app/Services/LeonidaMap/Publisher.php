<?php

namespace App\Services\LeonidaMap;

use App\Models\MapLandmark;
use App\Models\MapRegion;
use App\Models\MapSyncRun;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RuntimeException;

/**
 * Aplica uma execução revisada: grava locais e regiões e troca a versão dos tiles de uma vez.
 * Usado pelo comando (--publish=ID) e pela ação "Aprovar" do Filament.
 */
class Publisher
{
    public function __construct(private array $cfg) {}

    public function publish(MapSyncRun $run, ?int $userId = null): void
    {
        if ($run->status !== 'pending_review') {
            throw new RuntimeException("A execução #{$run->id} está em '{$run->status}', não em revisão.");
        }
        $staging = $run->staging_path;
        $rows = json_decode(File::get("$staging/landmarks.json"), true, 512, JSON_THROW_ON_ERROR);
        $regions = json_decode(File::get("$staging/regions.json"), true, 512, JSON_THROW_ON_ERROR);
        $now = now();

        // 1) tiles novos: copia para /storage/map/tiles/v{N} ANTES de virar a chave no banco
        $tilesVersion = null;
        if (File::isDirectory("$staging/tiles")) {
            $tilesVersion = (MapSyncRun::currentTilesVersion() ?? 0) + 1;
            $dest = $this->cfg['public_disk_dir'] . "/tiles/v$tilesVersion";
            File::deleteDirectory($dest);
            File::ensureDirectoryExists(dirname($dest));
            if (! File::copyDirectory("$staging/tiles", $dest)) {
                throw new RuntimeException("Não consegui copiar os tiles para $dest");
            }
        }

        // 2) banco: tudo numa transação
        DB::transaction(function () use ($rows, $regions, $run, $now, $tilesVersion, $userId) {
            $seen = [];
            foreach (array_chunk($rows, 500) as $chunk) {
                $payload = [];
                foreach ($chunk as $r) {
                    [$id, $name, $district, $area, $x, $y, $real, $type, $flags, $tier, $region] = array_pad($r, 11, null);
                    $seen[] = $id;
                    $payload[] = [
                        'source_id' => $id, 'name' => $name, 'district' => $district ?: null, 'area' => $area ?: null,
                        'region' => $region ?: null, 'type' => $type, 'tier' => $tier,
                        'enterable' => str_contains($flags, 'e'), 'unconfirmed' => str_contains($flags, 'u'), 'closed' => str_contains($flags, 'c'),
                        'x' => $x, 'y' => $y, 'real_world' => $real ?: null, 'is_active' => true,
                        'source_sha' => $run->landmarks_sha, 'first_seen_at' => $now, 'last_seen_at' => $now,
                        'created_at' => $now, 'updated_at' => $now,
                    ];
                }
                // first_seen_at e created_at ficam de fora da atualização: preservam a data original
                MapLandmark::upsert($payload, ['source_id'], [
                    'name', 'district', 'area', 'region', 'type', 'tier', 'enterable', 'unconfirmed', 'closed',
                    'x', 'y', 'real_world', 'is_active', 'source_sha', 'last_seen_at', 'updated_at',
                ]);
            }
            // sumiu da fonte: desativa (links e pins antigos continuam resolvendo)
            MapLandmark::whereNotIn('source_id', $seen)->where('is_active', true)->update(['is_active' => false, 'updated_at' => $now]);

            foreach ($regions as $g) {
                MapRegion::updateOrCreate(['id' => $g['id']], [
                    'name' => $g['name'], 'station' => $g['station'], 'color' => $g['color'],
                    'label_x' => $g['label'][0], 'label_y' => $g['label'][1], 'polygons' => $g['polys'],
                ]);
            }

            $run->update([
                'status' => 'published', 'tiles_version' => $tilesVersion,
                'published_at' => $now, 'published_by' => $userId,
            ]);
        });

        Cache::forget('leonida.map.landmarks');
        Cache::forget('leonida.map.regions');
        $run->appendLog('Publicado' . ($tilesVersion ? " (tiles v$tilesVersion)" : ' (tiles mantidos)'));
        $this->cleanupOldTiles();
    }

    public function reject(MapSyncRun $run): void
    {
        $run->update(['status' => 'rejected']);
        File::deleteDirectory($run->staging_path . '/tiles');
        $run->appendLog('Rejeitado na revisão');
    }

    /** Mantém só as N versões mais novas de tiles (as outras servem de rollback por um tempo). */
    private function cleanupOldTiles(): void
    {
        $base = $this->cfg['public_disk_dir'] . '/tiles';
        $versions = collect(File::directories($base))
            ->map(fn ($d) => (int) ltrim(basename($d), 'v'))->filter()->sortDesc()->values();
        foreach ($versions->slice($this->cfg['keep_tile_versions']) as $v) {
            File::deleteDirectory("$base/v$v");
        }
    }
}
