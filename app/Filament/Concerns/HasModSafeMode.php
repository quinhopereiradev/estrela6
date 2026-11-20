<?php

declare(strict_types=1);

namespace App\Filament\Concerns;

use App\Models\User;
use Illuminate\Support\Facades\Auth;

trait HasModSafeMode
{
    /** @var array<int, int> */
    public array $revealedModSafeModeIds = [];

    public function isSafe(): bool
    {
        /** @var User|null $user */
        $user = Auth::user();

        return $user === null || $user->mod_safe_mode;
    }

    public function isRevealed(int $id): bool
    {
        return in_array($id, $this->revealedModSafeModeIds, true);
    }

    public function reveal(int $id): void
    {
        if (! $this->isRevealed($id)) {
            $this->revealedModSafeModeIds[] = $id;
        }
    }

    public function toggleSafeMode(): void
    {
        /** @var User|null $user */
        $user = Auth::user();

        if ($user === null) {
            return;
        }

        $user->update(['mod_safe_mode' => ! $user->mod_safe_mode]);
    }
}
