<?php

namespace App\Services\LeonidaMap;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Consulta o repositório do GTADB no GitHub sem baixar os 3 GB:
 *  - SHA do último commit que mexeu em cada caminho (dados e tiles);
 *  - versões de mapa disponíveis (yanis,17, yanis,18...);
 *  - clone "sparse" só das pastas necessárias.
 */
class UpstreamClient
{
    public function __construct(private array $cfg) {}

    private function api(): PendingRequest
    {
        $req = Http::baseUrl('https://api.github.com/repos/' . $this->cfg['repo'])
            ->acceptJson()->timeout(30)->retry(2, 1000)
            ->withHeaders(['User-Agent' => 'leonida-underground-sync']);

        return $this->cfg['github_token'] ? $req->withToken($this->cfg['github_token']) : $req;
    }

    /** SHA do último commit que alterou $path (null se o caminho não existe). */
    public function latestShaFor(string $path): ?string
    {
        $res = $this->api()->get('/commits', ['path' => $path, 'sha' => $this->cfg['branch'], 'per_page' => 1])->throw();

        return $res->json('0.sha');
    }

    /** Tileset mais recente do mapa da comunidade (ex.: "yanis,18"), sem camadas extras. */
    public function newestTileset(): ?string
    {
        $items = $this->api()->get('/contents/' . $this->cfg['tiles_root'], ['ref' => $this->cfg['branch']])->throw()->json();
        $best = null;
        foreach ($items as $it) {
            if (($it['type'] ?? '') === 'dir' && preg_match('/^yanis,(\d+)$/', $it['name'], $m)) {
                if (! $best || (int) $m[1] > $best[1]) {
                    $best = [$it['name'], (int) $m[1]];
                }
            }
        }

        return $best[0] ?? null;
    }

    /** Clona só os caminhos pedidos (clone parcial + sparse checkout). Retorna a pasta. */
    public function sparseCheckout(string $dir, array $paths): string
    {
        $git = $this->cfg['git'];
        File::deleteDirectory($dir);
        File::ensureDirectoryExists(dirname($dir));
        $url = 'https://github.com/' . $this->cfg['repo'] . '.git';

        $steps = [
            [$git, 'clone', '--filter=blob:none', '--no-checkout', '--depth', '1', '--branch', $this->cfg['branch'], $url, $dir],
            [$git, '-C', $dir, 'sparse-checkout', 'init', '--no-cone'],
            array_merge([$git, '-C', $dir, 'sparse-checkout', 'set'], $paths),
            [$git, '-C', $dir, 'checkout'],
        ];
        foreach ($steps as $cmd) {
            $r = Process::timeout(1800)->run($cmd);
            if (! $r->successful()) {
                throw new RuntimeException('git falhou: ' . implode(' ', $cmd) . "\n" . $r->errorOutput());
            }
        }

        return $dir;
    }
}
