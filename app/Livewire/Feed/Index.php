<?php

declare(strict_types=1);

namespace App\Livewire\Feed;

use App\Domain\Feed\Enums\PostCategory;
use App\Models\Post;
use Illuminate\Contracts\View\View;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;
use Livewire\WithPagination;

class Index extends Component
{
    use WithPagination;

    public string $category = 'all';

    public string $search = '';

    public int $hiddenCount = 0;

    public function updatingCategory(): void
    {
        $this->resetPage();
    }

    public function updatingSearch(): void
    {
        $this->resetPage();
    }

    public function clearFilters(): void
    {
        $this->reset('category', 'search');
        $this->resetPage();
    }

    public function render(): View
    {
        $viewer = Auth::user();
        $term = trim($this->search);

        $base = Post::query()->published();

        if ($term !== '') {
            $totalMatching = (clone $base)->search($term)->count();
            $base = $base->search($term)->visibleTo($viewer);
            $this->hiddenCount = $totalMatching - (clone $base)->count();
        } else {
            $this->hiddenCount = 0;
        }

        $counts = (clone $base)
            ->selectRaw('category, count(*) as aggregate')
            ->groupBy('category')
            ->pluck('aggregate', 'category');

        if ($this->category !== 'all') {
            $base->where('category', $this->category);
        }

        /** @var LengthAwarePaginator<int, Post> $posts */
        $posts = $base->latest('published_at')->paginate(13);

        return view('livewire.feed.index', [
            'posts' => $posts,
            'categories' => PostCategory::cases(),
            'counts' => $counts,
            'total' => $counts->sum(),
        ]);
    }
}
