<?php

declare(strict_types=1);

use App\Filament\Concerns\HasModSafeMode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function subjectWithModSafeMode(): object
{
    return new class
    {
        use HasModSafeMode;
    };
}

test('mod safe mode is on by default for a fresh user', function (): void {
    $this->actingAs(User::factory()->create());

    expect(subjectWithModSafeMode()->isSafe())->toBeTrue();
});

test('toggling safe mode flips the stored preference', function (): void {
    $user = User::factory()->create();
    $this->actingAs($user);

    $subject = subjectWithModSafeMode();
    $subject->toggleSafeMode();

    expect($user->fresh()->mod_safe_mode)->toBeFalse();

    $subject->toggleSafeMode();

    expect($user->fresh()->mod_safe_mode)->toBeTrue();
});

test('revealing an id only affects that id, and never persists', function (): void {
    $this->actingAs(User::factory()->create());
    $subject = subjectWithModSafeMode();

    expect($subject->isRevealed(1))->toBeFalse();

    $subject->reveal(1);

    expect($subject->isRevealed(1))->toBeTrue()
        ->and($subject->isRevealed(2))->toBeFalse();
});
