<?php

declare(strict_types=1);

namespace App\Domain\Spoilers\Data;

use App\Domain\Spoilers\Enums\SpoilerPreset;
use App\Domain\Spoilers\Enums\SpoilerType;

final readonly class SpoilerPreference
{
    /**
     * @param  array<string, bool>  $overrides
     */
    public function __construct(
        public SpoilerPreset $preset,
        public array $overrides = [],
        public bool $chosen = false,
    ) {}

    public function hides(SpoilerType $type): bool
    {
        return $this->overrides[$type->value] ?? $this->preset->baseHides()[$type->value];
    }

    public function fog(): bool
    {
        return $this->preset->fog();
    }

    public static function default(): self
    {
        return new self(SpoilerPreset::Oficial, [], false);
    }

    /**
     * @return array{preset: string, overrides: array<string, bool>}
     */
    public function toArray(): array
    {
        return [
            'preset' => $this->preset->value,
            'overrides' => $this->overrides,
        ];
    }

    /**
     * @param  array{preset?: string, overrides?: array<string, bool>}  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            preset: SpoilerPreset::from($data['preset'] ?? SpoilerPreset::Oficial->value),
            overrides: $data['overrides'] ?? [],
            chosen: true,
        );
    }
}
