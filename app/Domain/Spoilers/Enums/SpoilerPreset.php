<?php

declare(strict_types=1);

namespace App\Domain\Spoilers\Enums;

enum SpoilerPreset: string
{
    case Oficial = 'oficial';
    case Cego = 'cego';
    case Tudo = 'tudo';

    /**
     * Which spoiler types this preset hides by default.
     *
     * @return array<string, bool>
     */
    public function baseHides(): array
    {
        return match ($this) {
            self::Tudo => [
                SpoilerType::Historia->value => false,
                SpoilerType::Easter->value => false,
                SpoilerType::Leak->value => false,
            ],
            self::Oficial => [
                SpoilerType::Historia->value => false,
                SpoilerType::Easter->value => false,
                SpoilerType::Leak->value => true,
            ],
            self::Cego => [
                SpoilerType::Historia->value => true,
                SpoilerType::Easter->value => true,
                SpoilerType::Leak->value => true,
            ],
        };
    }

    public function fog(): bool
    {
        return $this === self::Cego;
    }

    public function label(): string
    {
        return __('spoilers.presets.'.$this->value.'.label');
    }

    public function description(): string
    {
        return __('spoilers.presets.'.$this->value.'.description');
    }
}
