<?php

declare(strict_types=1);

use App\Domain\Feed\Enums\PostStatus;
use App\Domain\Spoilers\Enums\SpoilerType;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('a published post renders at its slug url', function (): void {
    $post = Post::factory()->published()->create([
        'title' => 'Rockstar confirma novo trailer',
        'content' => "# Oi\n\nUm **parágrafo**.",
    ]);

    $this->get(route('posts.show', $post->slug))
        ->assertOk()
        ->assertSee('Rockstar confirma novo trailer')
        ->assertSee('<strong>parágrafo</strong>', false);
});

test('an unpublished post 404s on its public url', function (): void {
    $post = Post::factory()->create(['status' => PostStatus::Draft]);

    $this->get(route('posts.show', $post->slug))->assertNotFound();
});

test('a nonexistent slug 404s', function (): void {
    $this->get(route('posts.show', 'nao-existe'))->assertNotFound();
});

test('a default visitor sees a safe placeholder instead of a leaked post', function (): void {
    $post = Post::factory()->published()->create([
        'title' => 'Vazou o final secreto',
        'excerpt' => 'Resumo que não devia aparecer',
        'spoiler_type' => SpoilerType::Leak,
    ]);

    $this->get(route('posts.show', $post->slug))
        ->assertOk()
        ->assertDontSee('Vazou o final secreto')
        ->assertDontSee('Resumo que não devia aparecer')
        ->assertSee(__('spoilers.safe_title'));
});

test('raw script tags in the content never reach the response', function (): void {
    $post = Post::factory()->published()->create([
        'content' => 'Texto normal <script>alert(document.cookie)</script> depois.',
    ]);

    $this->get(route('posts.show', $post->slug))
        ->assertOk()
        ->assertDontSee('<script>alert', false);
});
