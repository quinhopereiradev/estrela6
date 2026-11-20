<?php

declare(strict_types=1);

namespace App\Livewire\Feed;

use App\Domain\Feed\Actions\CreatePost;
use App\Domain\Feed\Actions\ProcessUploadedCoverImage;
use App\Domain\Feed\Data\NewPostData;
use App\Domain\Feed\Enums\PostCategory;
use App\Domain\Feed\Enums\PostOrigin;
use App\Domain\Spoilers\Enums\SpoilerType;
use App\Models\User;
use Illuminate\Contracts\View\View;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Livewire\Attributes\On;
use Livewire\Component;
use Livewire\WithFileUploads;

class ArticleModal extends Component
{
    use WithFileUploads;

    public bool $open = false;

    public string $title = '';

    public string $category = '';

    public string $excerpt = '';

    public string $content = '';

    public string $sourceUrl = '';

    public string $spoilerType = '';

    public ?UploadedFile $cover = null;

    public bool $own = false;

    public bool $submitted = false;

    #[On('open-article-modal')]
    public function openModal(): void
    {
        $this->open = true;
    }

    public function closeModal(): void
    {
        $this->reset(['open', 'title', 'category', 'excerpt', 'content', 'sourceUrl', 'spoilerType', 'cover', 'own', 'submitted']);
        $this->resetValidation();
    }

    public function submit(CreatePost $createPost, ProcessUploadedCoverImage $processCover): void
    {
        $user = Auth::user();

        if (! $user instanceof User) {
            $this->closeModal();

            return;
        }

        $data = $this->validate([
            'title' => ['required', 'string', 'min:10', 'max:110'],
            'category' => ['required', Rule::enum(PostCategory::class)],
            'excerpt' => ['required', 'string', 'min:30', 'max:220'],
            'content' => ['required', 'string', 'min:200'],
            'sourceUrl' => [
                Rule::requiredIf(fn (): bool => $this->category === PostCategory::Noticia->value),
                'nullable', 'url',
            ],
            'spoilerType' => ['nullable', Rule::in(['', SpoilerType::Historia->value, SpoilerType::Easter->value])],
            'cover' => ['nullable', 'image', 'max:8192'],
            'own' => ['accepted'],
        ]);

        $post = $createPost->handle(new NewPostData(
            title: $data['title'],
            excerpt: $data['excerpt'],
            content: $data['content'],
            category: PostCategory::from($data['category']),
            origin: PostOrigin::Community,
            authorId: $user->id,
            spoilerType: $data['spoilerType'] !== '' ? SpoilerType::from($data['spoilerType']) : null,
            sourceName: $data['sourceUrl'] ? (string) parse_url($data['sourceUrl'], PHP_URL_HOST) : null,
            sourceUrl: $data['sourceUrl'] ?: null,
        ));

        if ($this->cover instanceof UploadedFile) {
            $post->update(['cover_path' => $processCover->handle($this->cover)]);
        }

        $this->submitted = true;
    }

    public function render(): View
    {
        return view('livewire.feed.article-modal');
    }
}
