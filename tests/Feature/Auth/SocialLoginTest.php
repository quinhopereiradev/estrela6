<?php

declare(strict_types=1);

use App\Livewire\Auth\CompleteSignup;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Contracts\Provider;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Livewire\Livewire;

uses(RefreshDatabase::class);

function fakeSocialiteUser(string $id, ?string $email = 'player@example.com'): SocialiteUser
{
    $socialiteUser = new SocialiteUser;
    $socialiteUser->id = $id;
    $socialiteUser->name = 'Player One';
    $socialiteUser->email = $email;
    $socialiteUser->avatar = 'https://example.com/avatar.png';

    return $socialiteUser;
}

function mockSocialiteDriver(SocialiteUser $socialiteUser): void
{
    $provider = Mockery::mock(Provider::class);
    $provider->shouldReceive('user')->andReturn($socialiteUser);

    Socialite::shouldReceive('driver')->with('discord')->andReturn($provider);
}

test('a new social login redirects to onboarding instead of creating a user right away', function (): void {
    mockSocialiteDriver(fakeSocialiteUser('discord-123'));

    $this->get('/auth/discord/callback')->assertRedirect(route('onboarding'));

    expect(User::count())->toBe(0)
        ->and(session('pending_social_account'))->not->toBeNull();
    expect(Auth::check())->toBeFalse();
});

test('completing onboarding creates the user and logs them in', function (): void {
    mockSocialiteDriver(fakeSocialiteUser('discord-123'));
    $this->get('/auth/discord/callback');

    Livewire::test(CompleteSignup::class)
        ->set('nickname', 'jogador_1')
        ->set('age', true)
        ->set('terms', true)
        ->call('save')
        ->assertRedirect(route('home'));

    expect(Auth::check())->toBeTrue();

    $user = User::sole();
    expect($user->name)->toBe('jogador_1')
        ->and($user->provider)->toBe('discord')
        ->and($user->provider_id)->toBe('discord-123')
        ->and($user->age_confirmed_at)->not->toBeNull()
        ->and($user->terms_accepted_at)->not->toBeNull();
});

test('onboarding rejects a nickname that is already taken', function (): void {
    User::factory()->create(['name' => 'jogador_1']);
    mockSocialiteDriver(fakeSocialiteUser('discord-999'));
    $this->get('/auth/discord/callback');

    Livewire::test(CompleteSignup::class)
        ->set('nickname', 'jogador_1')
        ->set('age', true)
        ->set('terms', true)
        ->call('save')
        ->assertHasErrors(['nickname']);
});

test('onboarding requires the age and terms checkboxes', function (): void {
    mockSocialiteDriver(fakeSocialiteUser('discord-321'));
    $this->get('/auth/discord/callback');

    Livewire::test(CompleteSignup::class)
        ->set('nickname', 'jogador_2')
        ->call('save')
        ->assertHasErrors(['age', 'terms']);

    expect(User::count())->toBe(0);
});

test('a returning user with a known provider id logs in without creating a duplicate account', function (): void {
    $existing = User::factory()->create(['provider' => 'discord', 'provider_id' => 'discord-123']);
    mockSocialiteDriver(fakeSocialiteUser('discord-123'));

    $this->get('/auth/discord/callback')->assertRedirect(route('home'));

    expect(User::count())->toBe(1);
    $this->assertAuthenticatedAs($existing);
});
