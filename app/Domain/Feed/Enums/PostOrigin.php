<?php

declare(strict_types=1);

namespace App\Domain\Feed\Enums;

enum PostOrigin: string
{
    case Staff = 'staff';
    case Community = 'community';
    case Collector = 'collector';

    public function label(): string
    {
        return match ($this) {
            self::Staff => __('feed.origins.staff'),
            self::Community => __('feed.origins.community'),
            self::Collector => __('feed.origins.collector'),
        };
    }
}
