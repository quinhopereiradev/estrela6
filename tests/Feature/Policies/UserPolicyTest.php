<?php

declare(strict_types=1);

use App\Domain\Accounts\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('a member can update and delete only their own profile', function (): void {
    $member = User::factory()->create();
    $otherMember = User::factory()->create();

    expect($member->can('update', $member))->toBeTrue()
        ->and($member->can('delete', $member))->toBeTrue()
        ->and($member->can('update', $otherMember))->toBeFalse()
        ->and($member->can('delete', $otherMember))->toBeFalse();
});

test('an admin can update and delete any user', function (): void {
    $admin = User::factory()->role(Role::Admin)->create();
    $member = User::factory()->create();

    expect($admin->can('update', $member))->toBeTrue()
        ->and($admin->can('delete', $member))->toBeTrue();
});

test('only staff can view the user list', function (): void {
    $member = User::factory()->create();
    $editor = User::factory()->role(Role::Editor)->create();

    expect($member->can('viewAny', User::class))->toBeFalse()
        ->and($editor->can('viewAny', User::class))->toBeTrue();
});
