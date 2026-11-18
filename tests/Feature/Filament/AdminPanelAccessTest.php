<?php

declare(strict_types=1);

use App\Domain\Accounts\Enums\Role;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('guests are redirected to the admin login page', function (): void {
    $this->get('/admin')->assertRedirect(Filament::getDefaultPanel()->getLoginUrl());
});

test('members cannot access the admin panel', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)->get('/admin')->assertForbidden();
});

test('editors and moderators without MFA are sent to set it up, same as admins', function (Role $role): void {
    $staff = User::factory()->role($role)->create();

    $this->actingAs($staff)
        ->get('/admin')
        ->assertRedirect(Filament::getDefaultPanel()->getSetUpRequiredMultiFactorAuthenticationUrl());
})->with([Role::Editor, Role::Moderator, Role::Admin]);
