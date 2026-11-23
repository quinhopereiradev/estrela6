<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Map\Enums\MapSyncRunStatus;
use App\Domain\Map\Services\MapSync\Differ;
use App\Domain\Map\Services\MapSync\Pipeline;
use App\Domain\Map\Services\MapSync\Publisher;
use App\Domain\Map\Services\MapSync\UpstreamClient;
use App\Models\MapSyncRun;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Sincroniza o mapa com o GTADB.org (CC BY 4.0).
 *
 *   php artisan leonida:sync-map                 verifica a fonte; se mudou, prepara para revisão
 *   php artisan leonida:sync-map --force         reprocessa tudo (inclusive tiles), mesmo sem mudança
 *   php artisan leonida:sync-map --publish=12    publica a execução #12 (o mesmo que "Aprovar" no Filament)
 *   php artisan leonida:sync-map --reject=12     descarta a execução #12
 *   php artisan leonida:sync-map --auto-publish  prepara e já publica (sem revisão)
 */
#[Description('Baixa as atualizações do mapa da comunidade (GTADB), processa e deixa para revisão')]
#[Signature('leonida:sync-map
        {--force : Reprocessa dados e tiles mesmo sem mudança na fonte}
        {--publish= : ID da execução (map_sync_runs) a publicar}
        {--reject= : ID da execução a descartar}
        {--auto-publish : Publica sem revisão humana}')]
class SyncLeonidaMap extends Command
{
    public function handle(): int
    {
        $githubToken = config('leonida.map.github_token');
        $githubToken = is_string($githubToken) ? $githubToken : null;

        $upstream = new UpstreamClient([
            'repo' => config()->string('leonida.map.repo'),
            'branch' => config()->string('leonida.map.branch'),
            'github_token' => $githubToken,
            'git' => config()->string('leonida.map.git'),
        ]);
        $pipeline = new Pipeline([
            'python' => config()->string('leonida.map.python'),
            'pipeline_dir' => config()->string('leonida.map.pipeline_dir'),
            'tiles_xmax' => config()->integer('leonida.map.tiles_xmax'),
        ]);
        $publisher = new Publisher([
            'tiles_disk' => config()->string('leonida.map.tiles_disk'),
            'tiles_path' => config()->string('leonida.map.tiles_path'),
            'keep_tile_versions' => config()->integer('leonida.map.keep_tile_versions'),
        ]);

        if ($id = $this->option('publish')) {
            $publisher->publish(MapSyncRun::findOrFail($id));
            $this->info("Execução #$id publicada.");

            return self::SUCCESS;
        }
        if ($id = $this->option('reject')) {
            $publisher->reject(MapSyncRun::findOrFail($id));
            $this->info("Execução #$id descartada.");

            return self::SUCCESS;
        }

        $lock = Cache::lock('leonida:sync-map', 3600);
        if (! $lock->get()) {
            $this->warn('Já existe uma sincronização rodando.');

            return self::SUCCESS;
        }

        $run = MapSyncRun::create(['status' => MapSyncRunStatus::Running]);
        $log = function (string $msg) use ($run): void {
            $this->line($msg);
            $run->appendLog($msg);
        };

        $tilesRoot = config()->string('leonida.map.tiles_root');
        $landmarksPath = config()->string('leonida.map.landmarks_path');
        $workDir = config()->string('leonida.map.work_dir');

        try {
            $current = MapSyncRun::current();

            // 1) O que mudou na fonte?
            $tileset = config()->string('leonida.map.tileset');
            if (config()->boolean('leonida.map.auto_upgrade_tileset') && ($newest = $upstream->newestTileset($tilesRoot)) && $newest !== $tileset) {
                $log("Nova versão do mapa da comunidade: $newest (configurado: $tileset). Confira a prévia antes de aprovar.");
                $tileset = $newest;
            }
            $landmarksSha = $upstream->latestShaFor($landmarksPath);
            $tilesPath = $tilesRoot.'/'.$tileset;
            $tilesSha = $upstream->latestShaFor($tilesPath);
            $run->update(['landmarks_sha' => $landmarksSha, 'tiles_sha' => $tilesSha, 'tileset' => $tileset]);

            $force = (bool) $this->option('force');
            $dataChanged = $force || $landmarksSha !== $current?->landmarks_sha;
            $tilesChanged = $force || $tilesSha !== $current?->tiles_sha || $tileset !== $current?->tileset
                || ! MapSyncRun::currentTilesVersion();

            if (! $dataChanged && ! $tilesChanged) {
                $run->update(['status' => MapSyncRunStatus::NothingNew]);
                $log('Nada novo na fonte.');

                return self::SUCCESS;
            }
            $log(sprintf('Mudou: %s%s', $dataChanged ? 'locais ' : '', $tilesChanged ? 'tiles' : ''));

            // 2) Baixa só o necessário (sparse checkout)
            $paths = [$landmarksPath];
            if ($tilesChanged) {
                $paths[] = $tilesPath.'/';
            }
            $clone = $upstream->sparseCheckout("$workDir/upstream", $paths);
            $log('Download concluído: '.implode(', ', $paths));

            // 3) Pipeline (scripts de tools/map-pipeline)
            $staging = "$workDir/runs/{$run->id}";
            $currentTiles = ($version = MapSyncRun::currentTilesVersion()) ? $this->downloadCurrentTiles($workDir, $version) : null;
            $result = $pipeline->run(
                $staging,
                "$clone/$landmarksPath",
                $tilesChanged ? "$clone/$tilesPath" : null,
                $currentTiles,
                $log,
            );

            // 4) Resumo para revisão
            $summary = (new Differ(config()->integer('leonida.map.moved_threshold_m')))->diff($result['landmarks']);
            $summary['tiles_novos'] = (bool) $result['tiles'];
            $summary['preview'] = File::exists("$staging/preview.jpg") ? "$staging/preview.jpg" : null;
            $run->update(['status' => MapSyncRunStatus::PendingReview, 'staging_path' => $staging, 'summary' => $summary]);

            $counts = $summary['counts'];
            $this->table(['Total', 'Novos', 'Movidos', 'Renomeados', 'Tipo', 'Removidos', 'Reativados'], [[
                $counts['total'], $counts['novos'], $counts['movidos'], $counts['renomeados'], $counts['tipo_alterado'], $counts['removidos'], $counts['reativados'],
            ]]);

            File::deleteDirectory("$workDir/upstream");

            if ($this->option('auto-publish') || config()->boolean('leonida.map.auto_publish')) {
                $publisher->publish($run->refresh());
                $this->info("Publicado automaticamente (execução #{$run->id}).");
            } else {
                $this->info("Pronto para revisão: execução #{$run->id}. Aprove no painel ou rode --publish={$run->id}.");
            }

            return self::SUCCESS;
        } catch (Throwable $e) {
            $run->update(['status' => MapSyncRunStatus::Failed]);
            $log('ERRO: '.$e->getMessage());
            report($e);

            return self::FAILURE;
        } finally {
            $lock->release();
        }
    }

    /** Baixa os tiles em uso (do disco de mídia) para uma pasta local temporária, para o cálculo de regiões. */
    private function downloadCurrentTiles(string $workDir, int $version): ?string
    {
        $disk = Storage::disk(config()->string('leonida.map.tiles_disk'));
        $prefix = config()->string('leonida.map.tiles_path')."/v$version";
        if (! $disk->exists($prefix)) {
            return null;
        }

        $dest = "$workDir/current-tiles";
        File::deleteDirectory($dest);
        File::ensureDirectoryExists($dest);
        foreach ($disk->allFiles($prefix) as $path) {
            $relative = substr($path, strlen($prefix) + 1);
            $target = "$dest/$relative";
            File::ensureDirectoryExists(dirname($target));
            File::put($target, $disk->get($path) ?? '');
        }

        return $dest;
    }
}
