<?php

declare(strict_types=1);

namespace App\Domain\Spoilers\Actions;

use App\Domain\Spoilers\Data\SpoilerPreference;
use App\Models\User;

final class SaveUserSpoilerPreference
{
    public function handle(User $user, SpoilerPreference $preference): void
    {
        $user->update([
            'spoiler_preset' => $preference->preset->value,
            'spoiler_overrides' => $preference->overrides === [] ? null : $preference->overrides,
        ]);
    }
}
