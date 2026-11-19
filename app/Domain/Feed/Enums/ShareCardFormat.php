<?php

declare(strict_types=1);

namespace App\Domain\Feed\Enums;

enum ShareCardFormat: string
{
    case Quadrado = 'quadrado';
    case Vertical = 'vertical';
    case Horizontal = 'horizontal';

    public function width(): int
    {
        return match ($this) {
            self::Quadrado => 1080,
            self::Vertical => 1080,
            self::Horizontal => 1200,
        };
    }

    public function height(): int
    {
        return match ($this) {
            self::Quadrado => 1080,
            self::Vertical => 1920,
            self::Horizontal => 675,
        };
    }
}
