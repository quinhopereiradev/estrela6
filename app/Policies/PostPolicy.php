<?php

declare(strict_types=1);

namespace App\Policies;

use App\Domain\Accounts\Enums\Role;
use App\Models\Post;
use App\Models\User;

class PostPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role->canAccessPanel();
    }

    public function view(User $user, Post $post): bool
    {
        return $user->role->canAccessPanel();
    }

    public function create(User $user): bool
    {
        return $user->role !== Role::Member;
    }

    public function update(User $user, Post $post): bool
    {
        return $user->role === Role::Admin
            || $user->role === Role::Moderator
            || ($user->role === Role::Editor && $post->author_id === $user->id);
    }

    public function delete(User $user, Post $post): bool
    {
        return $user->role === Role::Admin;
    }

    public function publish(User $user, Post $post): bool
    {
        return $user->role === Role::Admin || $user->role === Role::Moderator;
    }
}
