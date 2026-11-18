<?php

declare(strict_types=1);

namespace App\Domain\Spoilers;

use App\Domain\Spoilers\Contracts\Spoilable;
use App\Domain\Spoilers\Enums\SpoilerType;
use App\Models\User;
use Illuminate\Support\Facades\Session;

final readonly class SpoilerGate
{
    public const string SHIELD_SESSION_KEY = 'spoiler_shield';

    public function __construct(
        private SpoilerPreferenceResolver $resolver,
    ) {}

    public function canSee(?User $viewer, Spoilable $item): bool
    {
        $type = $item->spoilerType();

        if (! $type instanceof SpoilerType) {
            return true;
        }

        if (Session::get(self::SHIELD_SESSION_KEY, false)) {
            return false;
        }

        return ! $this->resolver->resolve($viewer)->hides($type);
    }

    public function safeTitle(Spoilable $item): string
    {
        if (! $item->spoilerType() instanceof SpoilerType) {
            return $item->title();
        }

        return __('spoilers.safe_title');
    }
}
