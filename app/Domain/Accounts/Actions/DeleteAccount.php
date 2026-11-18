<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Actions;

use App\Models\User;

final class DeleteAccount
{
    public function handle(User $user): void
    {
        $user->delete();
    }
}
