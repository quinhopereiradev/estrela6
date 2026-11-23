<?php

declare(strict_types=1);

namespace App\Domain\Map\Services\MapSync;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Consulta o repositório do GTADB no GitHub sem baixar os dados inteiros:
 *  - SHA do último commit que mexeu em cada caminho (dados e tiles);
 *  - versões de mapa disponíveis (yanis,17, yanis,18...);
 *  - clone "sparse" só das pastas necessárias.
 */
final readonly class UpstreamClient
{
    /**
     * @param  array{repo: string, branch: string, github_token: ?string, git: string}  $cfg
     */
    public function __construct(private array $cfg) {}

    private function api(): PendingRequest
    {
        $request = Http::baseUrl('https://api.github.com/repos/'.$this->cfg['repo'])
            ->acceptJson()->timeout(30)->retry(2, 1000)
            ->withHeaders(['User-Agent' => 'estrela6-leonida-sync']);

        return $this->cfg['github_token'] ? $request->withToken($this->cfg['github_token']) : $request;
    }

    /** SHA do último commit que alterou $path (null se o caminho não existe). */
    public function latestShaFor(string $path): ?string
    {
        $response = $this->api()->get('/commits', ['path' => $path, 'sha' => $this->cfg['branch'], 'per_page' => 1])->throw();

        return $response->json('0.sha');
    }

    /** Tileset mais recente do mapa da comunidade (ex.: "yanis,18"), sem camadas extras. */
    public function newestTileset(string $tilesRoot): ?string
    {
        $items = $this->api()->get('/contents/'.$tilesRoot, ['ref' => $this->cfg['branch']])->throw()->json();
        $best = null;
        foreach ($items as $item) {
            if (($item['type'] ?? '') === 'dir' && preg_match('/^yanis,(\d+)$/', $item['name'], $matches)) {
                if (! $best || (int) $matches[1] > $best[1]) {
                    $best = [$item['name'], (int) $matches[1]];
                }
            }
        }

        return $best[0] ?? null;
    }

    /**
     * Clona só os caminhos pedidos (clone parcial + sparse checkout). Retorna a pasta.
     *
     * @param  array<int, string>  $paths
     */
    public function sparseCheckout(string $dir, array $paths): string
    {
        $git = $this->cfg['git'];
        File::deleteDirectory($dir);
        File::ensureDirectoryExists(dirname($dir));
        $url = 'https://github.com/'.$this->cfg['repo'].'.git';

        $steps = [
            [$git, 'clone', '--filter=blob:none', '--no-checkout', '--depth', '1', '--branch', $this->cfg['branch'], $url, $dir],
            [$git, '-C', $dir, 'sparse-checkout', 'init', '--no-cone'],
            array_merge([$git, '-C', $dir, 'sparse-checkout', 'set'], $paths),
            [$git, '-C', $dir, 'checkout'],
        ];
        foreach ($steps as $cmd) {
            $result = Process::timeout(1800)->run($cmd);
            if (! $result->successful()) {
                throw new RuntimeException('git falhou: '.implode(' ', $cmd)."\n".$result->errorOutput());
            }
        }

        return $dir;
    }
}
