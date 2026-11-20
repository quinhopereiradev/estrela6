<?php

declare(strict_types=1);

use App\Domain\Feed\Enums\PostStatus;
use App\Domain\Spoilers\Enums\SpoilerType;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('each share card format renders a valid svg with the right dimensions', function (string $format, int $width, int $height): void {
    $post = Post::factory()->published()->create(['title' => 'Um título qualquer de post']);

    $response = $this->get(route('posts.share-card', ['slug' => $post->slug, 'formato' => $format]));

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toStartWith('image/svg+xml');

    $svg = $response->getContent();
    expect($svg)->toContain('<svg')
        ->and($svg)->toContain('width="'.$width.'"')
        ->and($svg)->toContain('height="'.$height.'"')
        ->and($svg)->toContain('Um título qualquer de post');
})->with([
    ['quadrado', 1080, 1080],
    ['vertical', 1080, 1920],
    ['horizontal', 1200, 675],
]);

test('a spoiler post gets the safe title and no excerpt on its share card', function (): void {
    $post = Post::factory()->published()->create([
        'title' => 'O final vazou de verdade',
        'excerpt' => 'Resumo que não pode aparecer no cartão',
        'spoiler_type' => SpoilerType::Leak,
    ]);

    $svg = $this->get(route('posts.share-card', ['slug' => $post->slug, 'formato' => 'quadrado']))
        ->assertOk()
        ->getContent();

    expect($svg)->not->toContain('O final vazou de verdade')
        ->and($svg)->not->toContain('Resumo que não pode aparecer no cartão')
        ->and($svg)->toContain('SPOILER');
});

test('an unpublished post has no share card', function (): void {
    $post = Post::factory()->create(['status' => PostStatus::Draft]);

    $this->get(route('posts.share-card', ['slug' => $post->slug, 'formato' => 'quadrado']))->assertNotFound();
});

test('an invalid format 404s', function (): void {
    $post = Post::factory()->published()->create();

    $this->get('/noticias/'.$post->slug.'/cartao/invalido.svg')->assertNotFound();
});
