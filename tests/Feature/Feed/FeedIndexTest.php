<?php

declare(strict_types=1);

use App\Domain\Feed\Enums\PostCategory;
use App\Domain\Spoilers\Enums\SpoilerPreset;
use App\Domain\Spoilers\Enums\SpoilerType;
use App\Livewire\Feed\Index;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Livewire\Livewire;

uses(RefreshDatabase::class);

test('only published posts appear in the feed', function (): void {
    Post::factory()->published()->create(['title' => 'Post publicado']);
    Post::factory()->create(['title' => 'Post rascunho']);
    Post::factory()->pending()->create(['title' => 'Post pendente']);

    Livewire::test(Index::class)
        ->assertSee('Post publicado')
        ->assertDontSee('Post rascunho')
        ->assertDontSee('Post pendente');
});

test('the category filter narrows the list', function (): void {
    Post::factory()->published()->category(PostCategory::Noticia)->create(['title' => 'Notícia confirmada']);
    Post::factory()->published()->category(PostCategory::Teoria)->create(['title' => 'Teoria maluca']);

    Livewire::test(Index::class)
        ->set('category', PostCategory::Noticia->value)
        ->assertSee('Notícia confirmada')
        ->assertDontSee('Teoria maluca');
});

test('a visitor with the "cego" preset does not see the real title of a historia spoiler', function (): void {
    Post::factory()->published()->create([
        'title' => 'O final revelado de Vice City',
        'spoiler_type' => SpoilerType::Historia,
    ]);

    $viewer = User::factory()->create(['spoiler_preset' => SpoilerPreset::Cego->value]);

    Livewire::actingAs($viewer)
        ->test(Index::class)
        ->assertDontSee('O final revelado de Vice City')
        ->assertSee(__('spoilers.safe_title'));
});

test('a default visitor does not see a leak post either', function (): void {
    Post::factory()->published()->create([
        'title' => 'Vazou o mapa completo',
        'spoiler_type' => SpoilerType::Leak,
    ]);

    Livewire::test(Index::class)
        ->assertDontSee('Vazou o mapa completo')
        ->assertSee(__('spoilers.safe_title'));
});

test('searching excludes a hidden spoiler match and reports it as hidden', function (): void {
    Post::factory()->published()->create([
        'title' => 'Vazou o final do jogo',
        'excerpt' => 'Um resumo qualquer.',
        'spoiler_type' => SpoilerType::Leak,
    ]);

    Livewire::test(Index::class)
        ->set('search', 'final')
        ->assertDontSee('Vazou o final do jogo')
        ->assertSet('hiddenCount', 1);
});

test('searching for a non-spoiler match works normally', function (): void {
    Post::factory()->published()->create(['title' => 'Rockstar confirma data', 'excerpt' => 'resumo']);
    Post::factory()->published()->create(['title' => 'Outra coisa qualquer', 'excerpt' => 'resumo']);

    Livewire::test(Index::class)
        ->set('search', 'Rockstar')
        ->assertSee('Rockstar confirma data')
        ->assertDontSee('Outra coisa qualquer')
        ->assertSet('hiddenCount', 0);
});

test('the launch countdown timestamp matches config', function (): void {
    Livewire::test(Index::class)
        ->assertSeeHtml(Carbon::parse(config()->string('leonida.launch_at'))->toIso8601String());
});
