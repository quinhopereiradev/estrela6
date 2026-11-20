<?php

declare(strict_types=1);

use App\Domain\Feed\Enums\PostStatus;
use App\Domain\Spoilers\Enums\SpoilerType;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('the sitemap lists the home page and safe published posts, nothing else', function (): void {
    $visible = Post::factory()->published()->create(['title' => 'Post visível']);
    Post::factory()->create(['title' => 'Rascunho']);
    Post::factory()->pending()->create(['title' => 'Pendente']);
    $spoiler = Post::factory()->published()->create(['title' => 'Com spoiler', 'spoiler_type' => SpoilerType::Leak]);

    $xml = $this->get(route('sitemap'))->assertOk()->getContent();

    expect($xml)->toContain('<urlset')
        ->and($xml)->toContain(route('home'))
        ->and($xml)->toContain(route('posts.show', $visible->slug))
        ->and($xml)->not->toContain(route('posts.show', $spoiler->slug));
});

test('an unpublished post never shows up in the sitemap', function (): void {
    $draft = Post::factory()->create(['status' => PostStatus::Draft]);

    $xml = $this->get(route('sitemap'))->getContent();

    expect($xml)->not->toContain($draft->slug);
});

test('robots.txt points to the sitemap', function (): void {
    $this->get(route('robots'))
        ->assertOk()
        ->assertSee('Sitemap: '.route('sitemap'));
});
