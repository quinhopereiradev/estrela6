<?php

declare(strict_types=1);

namespace App\Models;

use App\Domain\Feed\Enums\PostCategory;
use App\Domain\Feed\Enums\PostOrigin;
use App\Domain\Feed\Enums\PostStatus;
use App\Domain\Feed\Enums\Reliability;
use App\Domain\Spoilers\Contracts\Spoilable;
use App\Domain\Spoilers\Enums\SpoilerType;
use App\Domain\Spoilers\SpoilerGate;
use App\Domain\Spoilers\SpoilerPreferenceResolver;
use Database\Factories\PostFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Session;

/**
 * @property Carbon|null $published_at
 * @property SpoilerType|null $spoiler_type
 */
#[Fillable([
    'title', 'slug', 'excerpt', 'content', 'headline_en', 'category', 'region_id',
    'place_type', 'place_id', 'spoiler_type', 'reliability', 'confidence', 'basis',
    'source_name', 'source_url', 'cover_path', 'video_path', 'poster_path', 'origin',
    'author_id', 'status', 'reject_reason', 'published_at', 'hype',
])]
class Post extends Model implements Spoilable
{
    /** @use HasFactory<PostFactory> */
    use HasFactory, SoftDeletes;

    public function spoilerType(): ?SpoilerType
    {
        return $this->spoiler_type;
    }

    public function title(): string
    {
        return $this->title;
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * @param  Builder<Post>  $query
     * @return Builder<Post>
     */
    #[Scope]
    protected function published(Builder $query): Builder
    {
        return $query->where('status', PostStatus::Published);
    }

    /**
     * @param  Builder<Post>  $query
     * @return Builder<Post>
     */
    #[Scope]
    protected function search(Builder $query, string $term): Builder
    {
        return $query->where(function (Builder $query) use ($term): void {
            $query->where('title', 'like', "%{$term}%")
                ->orWhere('excerpt', 'like', "%{$term}%");
        });
    }

    /**
     * Exclui posts cujo spoiler o leitor não deveria ver. Usado só na busca —
     * a listagem normal mostra tudo, com o conteúdo coberto pelo <x-spoiler>.
     *
     * @param  Builder<Post>  $query
     * @return Builder<Post>
     */
    #[Scope]
    protected function visibleTo(Builder $query, ?User $viewer): Builder
    {
        if (Session::get(SpoilerGate::SHIELD_SESSION_KEY, false)) {
            return $query->whereNull('spoiler_type');
        }

        $preference = app(SpoilerPreferenceResolver::class)->resolve($viewer);

        $hiddenTypes = collect(SpoilerType::cases())
            ->filter(fn (SpoilerType $type): bool => $preference->hides($type))
            ->map(fn (SpoilerType $type): string => $type->value)
            ->all();

        if ($hiddenTypes === []) {
            return $query;
        }

        return $query->where(function (Builder $query) use ($hiddenTypes): void {
            $query->whereNull('spoiler_type')->orWhereNotIn('spoiler_type', $hiddenTypes);
        });
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'category' => PostCategory::class,
            'spoiler_type' => SpoilerType::class,
            'reliability' => Reliability::class,
            'origin' => PostOrigin::class,
            'status' => PostStatus::class,
            'confidence' => 'integer',
            'hype' => 'integer',
            'published_at' => 'datetime',
        ];
    }
}
