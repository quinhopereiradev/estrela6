<?php

declare(strict_types=1);

use App\Domain\Accounts\Enums\Role;
use App\Domain\Feed\Enums\PostCategory;
use App\Domain\Feed\Enums\PostStatus;
use App\Domain\Feed\Enums\Reliability;
use App\Filament\Resources\Posts\Pages\CreatePost;
use App\Filament\Resources\Posts\Pages\EditPost;
use App\Filament\Resources\Posts\Pages\ListPosts;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;

uses(RefreshDatabase::class);

test('members cannot see the posts list', function (): void {
    $member = User::factory()->create();

    $this->actingAs($member)->get(ListPosts::getUrl())->assertForbidden();
});

test('an editor can list posts', function (): void {
    $editor = User::factory()->role(Role::Editor)->create();
    Post::factory()->count(3)->create();

    Livewire::actingAs($editor)
        ->test(ListPosts::class)
        ->assertSuccessful();
});

test('an editor can create a post, which starts as a draft owned by them', function (): void {
    $editor = User::factory()->role(Role::Editor)->create();

    Livewire::actingAs($editor)
        ->test(CreatePost::class)
        ->fillForm([
            'title' => 'Rockstar confirma novo beco em Vice City',
            'slug' => 'rockstar-confirma-novo-beco-em-vice-city',
            'excerpt' => 'Um resumo com mais de trinta caracteres sobre a novidade.',
            'content' => 'Conteúdo completo do post, com detalhes.',
            'category' => PostCategory::Noticia->value,
            'reliability' => Reliability::Oficial->value,
            'status' => PostStatus::Draft->value,
            'author_id' => $editor->id,
        ])
        ->call('create')
        ->assertHasNoFormErrors();

    $post = Post::firstWhere('slug', 'rockstar-confirma-novo-beco-em-vice-city');

    expect($post)->not->toBeNull()
        ->and($post->status)->toBe(PostStatus::Draft)
        ->and($post->author_id)->toBe($editor->id);
});

test('an editor cannot edit a post authored by someone else', function (): void {
    $editor = User::factory()->role(Role::Editor)->create(['has_email_authentication' => true]);
    $other = User::factory()->role(Role::Editor)->create();
    $post = Post::factory()->create(['author_id' => $other->id]);

    $this->actingAs($editor)->get(EditPost::getUrl(['record' => $post->getRouteKey()]))->assertForbidden();
});

test('an admin can edit any post', function (): void {
    $admin = User::factory()->role(Role::Admin)->create();
    $post = Post::factory()->create(['title' => 'Título original']);

    Livewire::actingAs($admin)
        ->test(EditPost::class, ['record' => $post->getRouteKey()])
        ->fillForm(['title' => 'Título revisado'])
        ->call('save')
        ->assertHasNoFormErrors();

    expect($post->fresh()->title)->toBe('Título revisado');
});
