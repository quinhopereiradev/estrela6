<?php

declare(strict_types=1);

use App\Domain\Feed\Actions\CreatePost;
use App\Domain\Feed\Data\NewPostData;
use App\Domain\Feed\Enums\PostCategory;
use App\Domain\Feed\Enums\PostOrigin;
use App\Domain\Feed\Enums\PostStatus;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function newPostData(array $overrides = []): NewPostData
{
    return new NewPostData(
        title: $overrides['title'] ?? 'Rockstar confirma novo trailer',
        excerpt: 'Um resumo qualquer com mais de trinta caracteres.',
        content: 'Conteúdo completo do post, bem detalhado.',
        category: PostCategory::Noticia,
        origin: $overrides['origin'] ?? PostOrigin::Staff,
        authorId: $overrides['authorId'] ?? null,
    );
}

test('a staff post starts as a draft', function (): void {
    $post = app(CreatePost::class)->handle(newPostData());

    expect($post->status)->toBe(PostStatus::Draft)
        ->and($post)->toBeInstanceOf(Post::class);
});

test('a community post starts pending moderation', function (): void {
    $user = User::factory()->create();

    $post = app(CreatePost::class)->handle(newPostData([
        'origin' => PostOrigin::Community,
        'authorId' => $user->id,
    ]));

    expect($post->status)->toBe(PostStatus::Pending)
        ->and($post->author_id)->toBe($user->id);
});

test('the slug is generated from the title', function (): void {
    $post = app(CreatePost::class)->handle(newPostData(['title' => 'Vice City ganha novo bairro']));

    expect($post->slug)->toBe('vice-city-ganha-novo-bairro');
});

test('a duplicate title gets a unique slug', function (): void {
    $first = app(CreatePost::class)->handle(newPostData(['title' => 'Mesmo título']));
    $second = app(CreatePost::class)->handle(newPostData(['title' => 'Mesmo título']));

    expect($first->slug)->toBe('mesmo-titulo')
        ->and($second->slug)->toBe('mesmo-titulo-1');
});
