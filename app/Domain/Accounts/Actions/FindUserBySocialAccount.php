<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Actions;

use App\Models\User;

final class FindUserBySocialAccount
{
    public function handle(string $provider, string $providerId): ?User
    {
        return User::query()
            ->where('provider', $provider)
            ->where('provider_id', $providerId)
            ->first();
    }
}
