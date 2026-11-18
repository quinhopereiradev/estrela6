<?php

namespace App\Services\LeonidaMap;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Roda os scripts Python de tools/map-pipeline (os mesmos usados no protótipo):
 *   curate.py  -> filtra 3.431 locais para os relevantes
 *   retile.py  -> gera tiles 1024px (níveis -4..0) + prévia
 *   regions.py -> contornos das 6 regiões + região de cada local
 */
class Pipeline
{
    public function __construct(private array $cfg) {}

    private function py(string $script, array $args, callable $log): string
    {
        $cmd = array_merge([$this->cfg['python'], '-I', $this->cfg['pipeline_dir'] . '/' . $script], $args);
        $r = Process::timeout(3600)->run($cmd);
        if (! $r->successful()) {
            throw new RuntimeException("$script falhou:\n" . $r->errorOutput());
        }
        $out = trim($r->output());
        $log("$script: " . $out);

        return $out;
    }

    /**
     * @param  string       $staging      pasta da execução (landmarks.json, regions.json, tiles/, preview.jpg)
     * @param  string       $landmarksSrc landmarks.json bruto do GTADB
     * @param  string|null  $tilesSrc     pasta maps/tiles/6/yanis,NN (null = reaproveita os tiles publicados)
     * @param  string|null  $currentTiles pasta dos tiles em uso (para calcular regiões quando não há tiles novos)
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
