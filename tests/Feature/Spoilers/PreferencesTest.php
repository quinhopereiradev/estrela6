<?php

declare(strict_types=1);

use App\Domain\Spoilers\SpoilerGate;
use App\Domain\Spoilers\SpoilerPreferenceResolver;
use App\Livewire\Spoilers\Preferences;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cookie;
use Livewire\Livewire;

uses(RefreshDatabase::class);

test('the welcome modal opens automatically for a guest who never chose a preset', function (): void {
    Livewire::test(Preferences::class)
        ->assertSet('open', true)
        ->assertSet('firstTime', true);
});

test('the welcome modal does not reopen for a guest who already has a cookie preference', function (): void {
    Livewire::withCookie(
        SpoilerPreferenceResolver::COOKIE,
        json_encode(['preset' => 'oficial', 'overrides' => []]),
    );

    Livewire::test(Preferences::class)
        ->assertSet('open', false)
        ->assertSet('firstTime', false);
});

test('the welcome modal does not reopen for a user who already chose a preset', function (): void {
    $user = User::factory()->create(['spoiler_preset' => 'oficial']);

    Livewire::actingAs($user)->test(Preferences::class)
        ->assertSet('open', false);
});

test('saving a preset persists it on the user record', function (): void {
    $user = User::factory()->create();

    Livewire::actingAs($user)->test(Preferences::class)
        ->call('selectPreset', 'cego')
        ->call('save');

    expect($user->fresh()->spoiler_preset)->toBe('cego');
});

test('saving a preset as a guest queues a cookie', function (): void {
    Livewire::test(Preferences::class)
        ->call('selectPreset', 'tudo')
        ->call('save');

    expect(Cookie::hasQueued(SpoilerPreferenceResolver::COOKIE))->toBeTrue();
});

test('toggling the quick shield flips the session flag', function (): void {
    Livewire::test(Preferences::class)
        ->call('toggleShield')
        ->assertSet('shieldOn', true);

    expect(session(SpoilerGate::SHIELD_SESSION_KEY))->toBeTrue();
});
