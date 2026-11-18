<?php

namespace App\Console\Commands;

use App\Models\MapSyncRun;
use App\Services\LeonidaMap\Differ;
use App\Services\LeonidaMap\Pipeline;
use App\Services\LeonidaMap\Publisher;
use App\Services\LeonidaMap\UpstreamClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
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
class SyncLeonidaMap extends Command
{
    protected $signature = 'leonida:sync-map
        {--force : Reprocessa dados e tiles mesmo sem mudança na fonte}
        {--publish= : ID da execução (map_sync_runs) a publicar}
        {--reject= : ID da execução a descartar}
        {--auto-publish : Publica sem revisão humana}';

    protected $description = 'Baixa as atualizações do mapa da comunidade (GTADB), processa e deixa para revisão';

    public function handle(): int
    {
        $cfg = config('leonida.map');
        $publisher = new Publisher($cfg);

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

        $run = MapSyncRun::create(['status' => 'running']);
        $log = function (string $msg) use ($run) { $this->line($msg); $run->appendLog($msg); };

        try {
            $up = new UpstreamClient($cfg);
            $current = MapSyncRun::current();

            // 1) O que mudou na fonte?
            $tileset = $cfg['tileset'];
            if ($cfg['auto_upgrade_tileset'] && ($newest = $up->newestTileset()) && $newest !== $tileset) {
                $log("Nova versão do mapa da comunidade: $newest (configurado: $tileset). Confira a prévia antes de aprovar.");
                $tileset = $newest;
            }
            $landmarksSha = $up->latestShaFor($cfg['landmarks_path']);
            $tilesPath = $cfg['tiles_root'] . '/' . $tileset;
            $tilesSha = $up->latestShaFor($tilesPath);
            $run->update(['landmarks_sha' => $landmarksSha, 'tiles_sha' => $tilesSha, 'tileset' => $tileset]);

            $force = (bool) $this->option('force');
            $dataChanged = $force || $landmarksSha !== $current?->landmarks_sha;
            $tilesChanged = $force || $tilesSha !== $current?->tiles_sha || $tileset !== $current?->tileset
                || ! MapSyncRun::currentTilesVersion();

            if (! $dataChanged && ! $tilesChanged) {
                $run->update(['status' => 'nothing_new']);
                $log('Nada novo na fonte.');

                return self::SUCCESS;
            }
            $log(sprintf('Mudou: %s%s', $dataChanged ? 'locais ' : '', $tilesChanged ? 'tiles' : ''));

            // 2) Baixa só o necessário (sparse checkout)
            $work = $cfg['work_dir'];
            $paths = [$cfg['landmarks_path']];
            if ($tilesChanged) {
                $paths[] = $tilesPath . '/';
            }
            $clone = $up->sparseCheckout("$work/upstream", $paths);
            $log('Download concluído: ' . implode(', ', $paths));

            // 3) Pipeline (mesmos scripts do protótipo)
            $staging = "$work/runs/{$run->id}";
            $currentTiles = ($v = MapSyncRun::currentTilesVersion()) ? $cfg['public_disk_dir'] . "/tiles/v$v" : null;
            $result = (new Pipeline($cfg))->run(
                $staging,
                "$clone/{$cfg['landmarks_path']}",
                $tilesChanged ? "$clone/$tilesPath" : null,
                $currentTiles,
                $log,
            );

            // 4) Resumo para revisão
            $summary = (new Differ($cfg['moved_threshold_m']))->diff($result['landmarks']);
            $summary['tiles_novos'] = (bool) $result['tiles'];
            $summary['preview'] = File::exists("$staging/preview.jpg") ? "$staging/preview.jpg" : null;
            $run->update(['status' => 'pending_review', 'staging_path' => $staging, 'summary' => $summary]);

            $c = $summary['counts'];
            $this->table(['Total', 'Novos', 'Movidos', 'Renomeados', 'Tipo', 'Removidos', 'Reativados'], [[
                $c['total'], $c['novos'], $c['movidos'], $c['renomeados'], $c['tipo_alterado'], $c['removidos'], $c['reativados'],
            ]]);

            File::deleteDirectory("$work/upstream");   // o clone parcial não é mais necessário

            if ($this->option('auto-publish') || $cfg['auto_publish']) {
                $publisher->publish($run->fresh());
                $this->info("Publicado automaticamente (execução #{$run->id}).");
            } else {
                $this->info("Pronto para revisão: execução #{$run->id}. Aprove no painel ou rode --publish={$run->id}.");
            }

            return self::SUCCESS;
        } catch (Throwable $e) {
            $run->update(['status' => 'failed']);
            $log('ERRO: ' . $e->getMessage());
            report($e);

            return self::FAILURE;
        } finally {
            $lock->release();
        }
    }
}
