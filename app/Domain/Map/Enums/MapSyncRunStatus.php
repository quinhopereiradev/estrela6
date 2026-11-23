<?php

declare(strict_types=1);

namespace App\Domain\Map\Enums;

enum MapSyncRunStatus: string
{
    case Running = 'running';
    case NothingNew = 'nothing_new';
    case PendingReview = 'pending_review';
    case Published = 'published';
    case Rejected = 'rejected';
    case Failed = 'failed';
}
