<?php

declare(strict_types=1);

namespace App\Domain\Feed\Actions;

use App\Domain\Feed\Data\PostSeoData;
use App\Domain\Feed\Enums\ShareCardFormat;
use App\Domain\Spoilers\SpoilerGate;
use App\Models\Post;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Meta tags, Open Graph e JSON-LD de um post, sempre na versão segura.
 *
 * Um post com spoiler nunca ganha o JSON-LD NewsArticle (ele existiria pra
 * ajudar o Google a indexar o conteúdo real — exatamente o que não queremos
 * expor) e usa uma descrição genérica em vez do resumo de verdade. O cartão
 * de compartilhamento (`RenderShareCard`) já é seguro nos dois casos, então
 * serve de og:image independente do post ter spoiler ou não.
 */
final readonly class BuildPostSeo
{
    public function __construct(
        private SpoilerGate $gate,
    ) {}

    public function handle(Post $post, ?User $viewer): PostSeoData
    {
        $safe = $this->gate->canSee($viewer, $post);

        $title = $safe
            ? $post->title.' · '.__('layout.brand')
            : $this->gate->safeTitle($post);

        $description = $safe
            ? Str::limit(trim(strip_tags($post->excerpt)), 160)
            : __('feed.show.spoiler_og_description');

        return new PostSeoData(
            title: $title,
            description: $description,
            canonical: route('posts.show', $post->slug),
            ogImage: $this->ogImage($post, $safe),
            jsonLd: $safe ? $this->jsonLd($post, $description) : null,
        );
    }

    private function ogImage(Post $post, bool $safe): string
    {
        if ($safe && $post->cover_path) {
            return Storage::disk(config()->string('filesystems.media'))->url($post->cover_path);
        }

        return route('posts.share-card', ['slug' => $post->slug, 'formato' => ShareCardFormat::Horizontal->value]);
    }

    private function jsonLd(Post $post, string $description): string
    {
        $data = [
            '@context' => 'https://schema.org',
            '@type' => 'NewsArticle',
            'headline' => $post->title,
            'description' => $description,
            'datePublished' => $post->published_at?->toIso8601String(),
            'dateModified' => $post->updated_at?->toIso8601String(),
            'mainEntityOfPage' => route('posts.show', $post->slug),
            'image' => [$this->ogImage($post, true)],
        ];

        if ($post->author) {
            $data['author'] = [
                '@type' => 'Person',
                'name' => $post->author->name,
            ];
        }

        return (string) json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
