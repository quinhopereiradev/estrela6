<?php

declare(strict_types=1);

namespace App\Domain\Spoilers\Enums;

enum SpoilerType: string
{
    case Historia = 'historia';
    case Easter = 'easter';
    case Leak = 'leak';

    public function label(): string
    {
        return match ($this) {
            self::Historia => __('spoilers.types.historia.label'),
            self::Easter => __('spoilers.types.easter.label'),
            self::Leak => __('spoilers.types.leak.label'),
        };
    }
}
