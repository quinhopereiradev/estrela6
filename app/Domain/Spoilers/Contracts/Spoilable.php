<?php

declare(strict_types=1);

namespace App\Domain\Spoilers\Contracts;

use App\Domain\Spoilers\Enums\SpoilerType;

interface Spoilable
{
    public function spoilerType(): ?SpoilerType;

    public function title(): string;
}
