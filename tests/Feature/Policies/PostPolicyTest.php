<?php

declare(strict_types=1);

use App\Domain\Accounts\Enums\Role;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('a member cannot create, update or publish posts', function (): void {
    $member = User::factory()->create();
    $post = Post::factory()->create();

    expect($member->can('create', Post::class))->toBeFalse()
        ->and($member->can('update', $post))->toBeFalse()
        ->and($member->can('publish', $post))->toBeFalse();
});

test('an editor can manage only their own posts and cannot publish', function (): void {
    $editor = User::factory()->role(Role::Editor)->create();
    $ownPost = Post::factory()->create(['author_id' => $editor->id]);
    $othersPost = Post::factory()->create();

    expect($editor->can('create', Post::class))->toBeTrue()
        ->and($editor->can('update', $ownPost))->toBeTrue()
        ->and($editor->can('update', $othersPost))->toBeFalse()
        ->and($editor->can('publish', $ownPost))->toBeFalse();
});

test('a moderator can update and publish any post', function (): void {
    $moderator = User::factory()->role(Role::Moderator)->create();
    $post = Post::factory()->create();

    expect($moderator->can('update', $post))->toBeTrue()
        ->and($moderator->can('publish', $post))->toBeTrue()
        ->and($moderator->can('delete', $post))->toBeFalse();
});

test('an admin can do everything, including delete', function (): void {
    $admin = User::factory()->role(Role::Admin)->create();
    $post = Post::factory()->create();

    expect($admin->can('update', $post))->toBeTrue()
        ->and($admin->can('publish', $post))->toBeTrue()
        ->and($admin->can('delete', $post))->toBeTrue();
});
