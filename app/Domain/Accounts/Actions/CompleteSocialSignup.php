<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Actions;

use App\Domain\Accounts\Data\PendingSocialAccount;
use App\Models\User;

final class CompleteSocialSignup
{
    public function handle(PendingSocialAccount $pending, string $nickname, bool $citeName): User
    {
        $user = new User;
        $user->name = $nickname;
        $user->email = $pending->email;
        $user->provider = $pending->provider;
        $user->provider_id = $pending->providerId;
        $user->avatar_url = $pending->avatarUrl;
        $user->age_confirmed_at = now();
        $user->terms_accepted_at = now();
        $user->cite_name = $citeName;
        $user->save();

        return $user;
    }
}
