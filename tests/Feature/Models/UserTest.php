<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

test('email_verified_at is cast to a datetime', function (): void {
    $user = User::factory()->create();

    expect($user->email_verified_at)->toBeInstanceOf(Carbon::class);
});

test('password is hashed, never stored in plain text', function (): void {
    $user = User::factory()->create(['password' => 'correct-horse-battery-staple']);

    expect($user->password)
        ->not->toBe('correct-horse-battery-staple')
        ->and(Hash::check('correct-horse-battery-staple', $user->password))->toBeTrue();
});
