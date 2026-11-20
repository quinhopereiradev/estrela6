<?php

declare(strict_types=1);

namespace App\Domain\Feed\Actions;

use App\Domain\Feed\Data\NewPostData;
use App\Domain\Feed\Enums\PostOrigin;
use App\Domain\Feed\Enums\PostStatus;
use App\Models\Post;
use Illuminate\Support\Str;

final class CreatePost
{
    public function handle(NewPostData $data): Post
    {
        return Post::create([
            'title' => $data->title,
            'slug' => $this->uniqueSlug($data->title),
            'excerpt' => $data->excerpt,
            'content' => $data->content,
            'category' => $data->category,
            'origin' => $data->origin,
            'reliability' => $data->reliability,
            'author_id' => $data->authorId,
            'spoiler_type' => $data->spoilerType,
            'source_name' => $data->sourceName,
            'source_url' => $data->sourceUrl,
            'status' => $this->initialStatus($data->origin),
        ]);
    }

    private function initialStatus(PostOrigin $origin): PostStatus
    {
        return match ($origin) {
            PostOrigin::Community, PostOrigin::Collector => PostStatus::Pending,
            PostOrigin::Staff => PostStatus::Draft,
        };
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title);
        $slug = $base;
        $suffix = 1;

        while (Post::withTrashed()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }
}
