<?php

declare(strict_types=1);

namespace App\Domain\Map\Services\MapSync;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Roda os scripts Python de tools/map-pipeline:
 *   curate.py  -> filtra os locais brutos do GTADB para os relevantes
 *   retile.py  -> gera tiles 1024px (níveis -4..0) + prévia
 *   regions.py -> contornos das regiões e região de cada local
 */
final readonly class Pipeline
{
    /**
     * @param  array{python: string, pipeline_dir: string, tiles_xmax: int}  $cfg
     */
    public function __construct(private array $cfg) {}

    /**
     * @param  array<int, string>  $args
     * @param  callable(string): void  $log
     */
    private function py(string $script, array $args, callable $log): string
    {
        $cmd = array_merge([$this->cfg['python'], '-I', $this->cfg['pipeline_dir'].'/'.$script], $args);
        $result = Process::timeout(3600)->run($cmd);
        if (! $result->successful()) {
            throw new RuntimeException("$script falhou:\n".$result->errorOutput());
        }
        $out = trim($result->output());
        $log("$script: ".$out);

        return $out;
    }

    /**
     * @param  callable(string): void  $log
     * @return array{landmarks: array<int, array<int, mixed>>, regions: array<int, array<string, mixed>>, tiles: ?string}
     */
    public function run(string $staging, string $landmarksSrc, ?string $tilesSrc, ?string $currentTiles, callable $log): array
    {
        File::ensureDirectoryExists($staging);
        $landmarks = "$staging/landmarks.json";
        $regions = "$staging/regions.json";

        $this->py('curate.py', [$landmarksSrc, $landmarks], $log);

        $tilesDir = $currentTiles;
        if ($tilesSrc) {
            $tilesDir = "$staging/tiles";
            $this->py('retile.py', [$tilesSrc, $tilesDir, '--preview', "$staging/preview.jpg", '--xmax', (string) $this->cfg['tiles_xmax']], $log);
        }
        if (! $tilesDir || ! File::isDirectory($tilesDir)) {
            throw new RuntimeException('Não há tiles para calcular as regiões. Rode com --force na primeira vez.');
        }

        $this->py('regions.py', [$tilesDir, $landmarks, $regions], $log);

        return [
            'landmarks' => json_decode(File::get($landmarks), true, 512, JSON_THROW_ON_ERROR),
            'regions' => json_decode(File::get($regions), true, 512, JSON_THROW_ON_ERROR),
            'tiles' => $tilesSrc ? "$staging/tiles" : null,
        ];
    }
}
