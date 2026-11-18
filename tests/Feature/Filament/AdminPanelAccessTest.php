<?php

declare(strict_types=1);

use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('guests are redirected to the admin login page', function (): void {
    $this->get('/admin')->assertRedirect(Filament::getDefaultPanel()->getLoginUrl());
});

test('non-admin users cannot access the admin panel', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)->get('/admin')->assertForbidden();
});

test('admin users without multi-factor authentication set up are sent to set it up', function (): void {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->get('/admin')
        ->assertRedirect(Filament::getDefaultPanel()->getSetUpRequiredMultiFactorAuthenticationUrl());
});
