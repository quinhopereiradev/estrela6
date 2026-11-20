<?php

declare(strict_types=1);

namespace App\Domain\Feed\Actions;

use App\Models\Post;

/**
 * Monta o sitemap.xml do zero (sem pacote): só a home e os posts publicados
 * sem spoiler — mesmo que o post já tenha título/capa seguros em outro lugar,
 * o sitemap é sinal de indexação pro Google, e indexar a URL de um post com
 * spoiler ajuda a achá-lo por busca, o que já é o problema que queremos evitar.
 */
final class BuildSitemap
{
    public function handle(): string
    {
        $urls = [
            ['loc' => route('home'), 'lastmod' => null],
        ];

        Post::query()
            ->published()
            ->whereNull('spoiler_type')
            ->orderByDesc('published_at')
            ->each(function (Post $post) use (&$urls): void {
                $urls[] = [
                    'loc' => route('posts.show', $post->slug),
                    'lastmod' => $post->updated_at?->toAtomString(),
                ];
            });

        $xml = '<?xml version="1.0" encoding="UTF-8"?>';
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

        foreach ($urls as $url) {
            $xml .= '<url><loc>'.e($url['loc']).'</loc>';
            if ($url['lastmod'] !== null) {
                $xml .= '<lastmod>'.e($url['lastmod']).'</lastmod>';
            }
            $xml .= '</url>';
        }

        $xml .= '</urlset>';

        return $xml;
    }
}
