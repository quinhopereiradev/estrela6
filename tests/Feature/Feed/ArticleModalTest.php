<?php

declare(strict_types=1);

use App\Domain\Feed\Enums\PostOrigin;
use App\Domain\Feed\Enums\PostStatus;
use App\Domain\Spoilers\Enums\SpoilerType;
use App\Livewire\Feed\ArticleModal;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;

uses(RefreshDatabase::class);

function validArticleData(array $overrides = []): array
{
    return array_merge([
        'title' => 'Os semáforos de Vice City mudam de ritmo à noite',
        'category' => 'teoria',
        'excerpt' => 'Um resumo qualquer com mais de trinta caracteres pra passar na validação.',
        'content' => str_repeat('Um parágrafo detalhado sobre a teoria. ', 10),
        'own' => true,
    ], $overrides);
}

test('a guest cannot submit an article even by calling the component directly', function (): void {
    Livewire::test(ArticleModal::class)
        ->set(validArticleData())
        ->call('submit');

    expect(Post::count())->toBe(0);
});

test('a logged in member can submit an article, which starts pending and unpublished', function (): void {
    $user = User::factory()->create();

    Livewire::actingAs($user)
        ->test(ArticleModal::class)
        ->set(validArticleData())
        ->call('submit')
        ->assertHasNoErrors()
        ->assertSet('submitted', true);

    $post = Post::sole();
    expect($post->origin)->toBe(PostOrigin::Community)
        ->and($post->status)->toBe(PostStatus::Pending)
        ->and($post->author_id)->toBe($user->id);
});

test('a pending submission never shows up in the public feed', function (): void {
    $user = User::factory()->create();

    Livewire::actingAs($user)->test(ArticleModal::class)->set(validArticleData())->call('submit');

    $this->get(route('home'))->assertDontSee(validArticleData()['title']);
});

test('a title shorter than ten characters is rejected', function (): void {
    $user = User::factory()->create();

    Livewire::actingAs($user)
        ->test(ArticleModal::class)
        ->set(validArticleData(['title' => 'curto']))
        ->call('submit')
        ->assertHasErrors(['title']);
});

test('a news article requires a source url', function (): void {
    $user = User::factory()->create();

    Livewire::actingAs($user)
        ->test(ArticleModal::class)
        ->set(validArticleData(['category' => 'noticia']))
        ->call('submit')
        ->assertHasErrors(['sourceUrl']);
});

test('a leak spoiler type is rejected from the community form', function (): void {
    $user = User::factory()->create();

    Livewire::actingAs($user)
        ->test(ArticleModal::class)
        ->set(validArticleData(['spoilerType' => SpoilerType::Leak->value]))
        ->call('submit')
        ->assertHasErrors(['spoilerType']);
});

test('the authorship checkbox is required', function (): void {
    $user = User::factory()->create();

    Livewire::actingAs($user)
        ->test(ArticleModal::class)
        ->set(validArticleData(['own' => false]))
        ->call('submit')
        ->assertHasErrors(['own']);
});

test('an uploaded cover is processed and attached to the post', function (): void {
    Storage::fake('public');
    $user = User::factory()->create();

    Livewire::actingAs($user)
        ->test(ArticleModal::class)
        ->set(validArticleData())
        ->set('cover', UploadedFile::fake()->image('capa.jpg', 1200, 600))
        ->call('submit')
        ->assertHasNoErrors();

    $post = Post::sole();
    expect($post->cover_path)->not->toBeNull();
    Storage::disk('public')->assertExists($post->cover_path);
});
