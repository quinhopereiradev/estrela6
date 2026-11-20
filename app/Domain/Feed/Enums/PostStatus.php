<?php

declare(strict_types=1);

namespace App\Domain\Feed\Enums;

enum PostStatus: string
{
    case Draft = 'draft';
    case Pending = 'pending';
    case Published = 'published';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Draft => __('feed.statuses.draft'),
            self::Pending => __('feed.statuses.pending'),
            self::Published => __('feed.statuses.published'),
            self::Rejected => __('feed.statuses.rejected'),
        };
    }
}
