<?php

declare(strict_types=1);

namespace Tests\Fixtures;

use App\Domain\Spoilers\Contracts\Spoilable;
use App\Domain\Spoilers\Enums\SpoilerType;

final readonly class FakeSpoilable implements Spoilable
{
    public function __construct(
        private ?SpoilerType $type = null,
        private string $realTitle = 'O final de GTA VI',
    ) {}

    public function spoilerType(): ?SpoilerType
    {
        return $this->type;
    }

    public function title(): string
    {
        return $this->realTitle;
    }
}
