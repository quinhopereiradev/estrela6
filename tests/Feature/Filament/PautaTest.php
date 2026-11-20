<?php

declare(strict_types=1);

use App\Domain\Accounts\Enums\Role;
use App\Domain\Feed\Enums\PostStatus;
use App\Filament\Pages\Pauta;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;

uses(RefreshDatabase::class);

test('members and editors cannot access the pauta', function (): void {
    $member = User::factory()->create(['has_email_authentication' => true]);
    $editor = User::factory()->role(Role::Editor)->create(['has_email_authentication' => true]);

    $this->actingAs($member)->get(Pauta::getUrl())->assertForbidden();
    $this->actingAs($editor)->get(Pauta::getUrl())->assertForbidden();
});

test('a moderator can access the pauta', function (): void {
    $moderator = User::factory()->role(Role::Moderator)->create(['has_email_authentication' => true]);

    $this->actingAs($moderator)->get(Pauta::getUrl())->assertOk();
});

test('only pending posts show up in the queue', function (): void {
    $moderator = User::factory()->role(Role::Moderator)->create();
    Post::factory()->pending()->create(['title' => 'Pendente de verdade']);
    Post::factory()->published()->create(['title' => 'Já publicado']);
    Post::factory()->create(['title' => 'Rascunho']);

    Livewire::actingAs($moderator)
        ->test(Pauta::class)
        ->assertCanSeeTableRecords(Post::where('title', 'Pendente de verdade')->get())
        ->assertCanNotSeeTableRecords(Post::whereIn('title', ['Já publicado', 'Rascunho'])->get());
});

test('safe mode hides the title until revealed, and never persists across a fresh page load', function (): void {
    $moderator = User::factory()->role(Role::Moderator)->create();
    $post = Post::factory()->pending()->create(['title' => 'Segredo revelado sobre o DLC']);

    Livewire::actingAs($moderator)
        ->test(Pauta::class)
        ->assertDontSee('Segredo revelado sobre o DLC')
        ->callTableAction('reveal', $post)
        ->assertSee('Segredo revelado sobre o DLC');

    Livewire::actingAs($moderator)
        ->test(Pauta::class)
        ->assertDontSee('Segredo revelado sobre o DLC');
});

test('approving a post publishes it', function (): void {
    $moderator = User::factory()->role(Role::Moderator)->create();
    $post = Post::factory()->pending()->create();

    Livewire::actingAs($moderator)
        ->test(Pauta::class)
        ->callTableAction('approve', $post)
        ->assertNotified(__('filament.pauta.approved'));

    expect($post->fresh()->status)->toBe(PostStatus::Published)
        ->and($post->fresh()->published_at)->not->toBeNull();
});

test('rejecting a post requires a reason and stores it', function (): void {
    $moderator = User::factory()->role(Role::Moderator)->create();
    $post = Post::factory()->pending()->create();

    Livewire::actingAs($moderator)
        ->test(Pauta::class)
        ->callTableAction('reject', $post, data: ['reason' => ''])
        ->assertHasTableActionErrors(['reason' => 'required']);

    Livewire::actingAs($moderator)
        ->test(Pauta::class)
        ->callTableAction('reject', $post, data: ['reason' => 'Fonte fraca'])
        ->assertNotified(__('filament.pauta.rejected'));

    expect($post->fresh()->status)->toBe(PostStatus::Rejected)
        ->and($post->fresh()->reject_reason)->toBe('Fonte fraca');
});
