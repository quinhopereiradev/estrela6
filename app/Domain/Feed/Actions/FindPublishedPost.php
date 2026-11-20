<?php

declare(strict_types=1);

namespace App\Domain\Feed\Actions;

use App\Models\Post;

final class FindPublishedPost
{
    public function handle(string $slug): Post
    {
        return Post::query()->published()->where('slug', $slug)->firstOrFail();
    }
}
