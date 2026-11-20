<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Domain\Feed\Enums\PostCategory;
use App\Domain\Feed\Enums\PostOrigin;
use App\Domain\Feed\Enums\PostStatus;
use App\Domain\Feed\Enums\Reliability;
use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Post>
 */
class PostFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $title = fake()->unique()->sentence();

        return [
            'title' => $title,
            'slug' => Str::slug($title).'-'.fake()->unique()->numberBetween(1, 999999),
            'excerpt' => fake()->paragraph(),
            'content' => fake()->paragraphs(5, true),
            'category' => fake()->randomElement(PostCategory::cases()),
            'reliability' => fake()->randomElement(Reliability::cases()),
            'origin' => PostOrigin::Staff,
            'status' => PostStatus::Draft,
        ];
    }

    /**
     * Indicate that the post is published.
     */
    public function published(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => PostStatus::Published,
            'published_at' => now(),
        ]);
    }

    /**
     * Indicate that the post is pending moderation.
     */
    public function pending(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => PostStatus::Pending,
        ]);
    }

    /**
     * Indicate that the post came from the community.
     */
    public function community(): static
    {
        return $this->state(fn (array $attributes): array => [
            'origin' => PostOrigin::Community,
            'author_id' => User::factory(),
        ]);
    }

    /**
     * Indicate the post's category.
     */
    public function category(PostCategory $category): static
    {
        return $this->state(fn (array $attributes): array => [
            'category' => $category,
        ]);
    }
}
