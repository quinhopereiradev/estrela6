<?php

declare(strict_types=1);

use App\Domain\Feed\Enums\PostCategory;
use App\Domain\Feed\Enums\PostOrigin;
use App\Domain\Feed\Enums\PostStatus;
use App\Domain\Feed\Enums\Reliability;
use App\Domain\Spoilers\Contracts\Spoilable;
use App\Domain\Spoilers\Enums\SpoilerType;
use App\Models\Post;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('posts cast their enum and date attributes', function (): void {
    $post = Post::factory()->published()->category(PostCategory::Teoria)->create([
        'reliability' => Reliability::Rumor,
        'spoiler_type' => SpoilerType::Leak,
    ]);

    expect($post->category)->toBe(PostCategory::Teoria)
        ->and($post->reliability)->toBe(Reliability::Rumor)
        ->and($post->spoiler_type)->toBe(SpoilerType::Leak)
        ->and($post->status)->toBe(PostStatus::Published)
        ->and($post->published_at)->toBeInstanceOf(Carbon::class);
});

test('a post implements the Spoilable contract', function (): void {
    $post = Post::factory()->create(['title' => 'Vice City amanhece em chamas', 'spoiler_type' => SpoilerType::Historia]);

    expect($post)->toBeInstanceOf(Spoilable::class)
        ->and($post->title())->toBe('Vice City amanhece em chamas')
        ->and($post->spoilerType())->toBe(SpoilerType::Historia);
});

test('the community factory state attaches an author and the community origin', function (): void {
    $post = Post::factory()->community()->create();

    expect($post->origin)->toBe(PostOrigin::Community)
        ->and($post->author_id)->not->toBeNull()
        ->and($post->author)->toBeInstanceOf(User::class);
});

test('soft deleted posts are excluded from default queries', function (): void {
    $post = Post::factory()->create();

    $post->delete();

    expect(Post::find($post->id))->toBeNull()
        ->and(Post::withTrashed()->find($post->id))->not->toBeNull();
});
