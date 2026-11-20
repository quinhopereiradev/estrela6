<?php

declare(strict_types=1);

use App\Domain\Spoilers\Enums\SpoilerType;
use App\Domain\Spoilers\SpoilerGate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Fixtures\FakeSpoilable;

uses(RefreshDatabase::class);

test('content without a spoiler type is always visible', function (): void {
    $gate = app(SpoilerGate::class);

    expect($gate->canSee(null, new FakeSpoilable))->toBeTrue();
});

test('a guest with no preference uses the oficial preset, which hides only leaks', function (): void {
    $gate = app(SpoilerGate::class);

    expect($gate->canSee(null, new FakeSpoilable(SpoilerType::Historia)))->toBeTrue()
        ->and($gate->canSee(null, new FakeSpoilable(SpoilerType::Easter)))->toBeTrue()
        ->and($gate->canSee(null, new FakeSpoilable(SpoilerType::Leak)))->toBeFalse();
});

test('the cego preset hides every spoiler type', function (): void {
    $user = User::factory()->create(['spoiler_preset' => 'cego']);
    $gate = app(SpoilerGate::class);

    expect($gate->canSee($user, new FakeSpoilable(SpoilerType::Historia)))->toBeFalse()
        ->and($gate->canSee($user, new FakeSpoilable(SpoilerType::Easter)))->toBeFalse()
        ->and($gate->canSee($user, new FakeSpoilable(SpoilerType::Leak)))->toBeFalse();
});

test('the tudo preset shows every spoiler type', function (): void {
    $user = User::factory()->create(['spoiler_preset' => 'tudo']);
    $gate = app(SpoilerGate::class);

    expect($gate->canSee($user, new FakeSpoilable(SpoilerType::Historia)))->toBeTrue()
        ->and($gate->canSee($user, new FakeSpoilable(SpoilerType::Easter)))->toBeTrue()
        ->and($gate->canSee($user, new FakeSpoilable(SpoilerType::Leak)))->toBeTrue();
});

test('per-type overrides take precedence over the preset', function (): void {
    $user = User::factory()->create([
        'spoiler_preset' => 'oficial',
        'spoiler_overrides' => ['historia' => true],
    ]);
    $gate = app(SpoilerGate::class);

    expect($gate->canSee($user, new FakeSpoilable(SpoilerType::Historia)))->toBeFalse()
        ->and($gate->canSee($user, new FakeSpoilable(SpoilerType::Easter)))->toBeTrue();
});

test('the quick shield hides everything regardless of preset', function (): void {
    $user = User::factory()->create(['spoiler_preset' => 'tudo']);
    session([SpoilerGate::SHIELD_SESSION_KEY => true]);
    $gate = app(SpoilerGate::class);

    expect($gate->canSee($user, new FakeSpoilable(SpoilerType::Historia)))->toBeFalse();
});

test('safeTitle never reveals the real title of spoiler content', function (): void {
    $gate = app(SpoilerGate::class);

    expect($gate->safeTitle(new FakeSpoilable(SpoilerType::Leak, 'Vazamento gigante')))
        ->not->toContain('Vazamento gigante')
        ->and($gate->safeTitle(new FakeSpoilable(null, 'Post normal')))->toBe('Post normal');
});
