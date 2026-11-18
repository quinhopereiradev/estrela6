<?php

declare(strict_types=1);

use App\Livewire\Auth\Profile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;

uses(RefreshDatabase::class);

test('a guest cannot see the profile page', function (): void {
    $this->get('/perfil')->assertRedirect(route('home'));
});

test('a user can update their nickname and cite_name preference', function (): void {
    $user = User::factory()->create(['name' => 'old_name', 'cite_name' => false]);

    Livewire::actingAs($user)
        ->test(Profile::class)
        ->set('nickname', 'new_name')
        ->set('citeName', true)
        ->call('save')
        ->assertHasNoErrors();

    expect($user->fresh()->name)->toBe('new_name')
        ->and($user->fresh()->cite_name)->toBeTrue();
});

test('a user cannot take a nickname already used by someone else', function (): void {
    User::factory()->create(['name' => 'taken_name']);
    $user = User::factory()->create(['name' => 'my_name']);

    Livewire::actingAs($user)
        ->test(Profile::class)
        ->set('nickname', 'taken_name')
        ->call('save')
        ->assertHasErrors(['nickname']);
});

test('a user can delete their account', function (): void {
    $user = User::factory()->create();

    Livewire::actingAs($user)
        ->test(Profile::class)
        ->call('deleteAccount')
        ->assertRedirect(route('home'));

    expect(User::find($user->id))->toBeNull();
    $this->assertGuest();
});
