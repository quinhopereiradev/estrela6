<?php

declare(strict_types=1);

use App\Domain\Feed\Actions\BuildPostSeo;
use App\Domain\Spoilers\Enums\SpoilerType;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('a safe post gets a full title, description and NewsArticle json-ld', function (): void {
    $post = Post::factory()->published()->create([
        'title' => 'Rockstar confirma novo trailer',
        'excerpt' => 'Um resumo qualquer do que aconteceu na comunidade.',
    ]);

    $seo = app(BuildPostSeo::class)->handle($post, null);

    expect($seo->title)->toBe('Rockstar confirma novo trailer · '.__('layout.brand'))
        ->and($seo->description)->toBe($post->excerpt)
        ->and($seo->jsonLd)->not->toBeNull();

    $jsonLd = json_decode((string) $seo->jsonLd, true);
    expect($jsonLd['@type'])->toBe('NewsArticle')
        ->and($jsonLd['headline'])->toBe('Rockstar confirma novo trailer');
});

test('a spoiler post gets a safe title, a generic description and no json-ld', function (): void {
    $post = Post::factory()->published()->create([
        'title' => 'Vazou o final secreto',
        'excerpt' => 'Resumo que não pode aparecer nas meta tags',
        'spoiler_type' => SpoilerType::Leak,
    ]);

    $seo = app(BuildPostSeo::class)->handle($post, null);

    expect($seo->title)->toBe(__('spoilers.safe_title'))
        ->and($seo->description)->not->toContain('não pode aparecer')
        ->and($seo->jsonLd)->toBeNull()
        ->and($seo->ogImage)->toContain('cartao');
});
