<?php

declare(strict_types=1);

namespace App\Livewire\Feed;

use App\Domain\Feed\Actions\BuildPostSeo;
use App\Domain\Feed\Actions\FindPublishedPost;
use App\Domain\Feed\Actions\RenderPostContent;
use App\Domain\Feed\Data\PostSeoData;
use App\Models\Post;
use App\Models\User;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;

class Show extends Component
{
    public Post $post;

    public string $contentHtml;

    protected PostSeoData $seo;

    public function mount(string $slug, FindPublishedPost $find, RenderPostContent $render, BuildPostSeo $buildSeo): void
    {
        $this->post = $find->handle($slug);
        $this->contentHtml = $render->handle($this->post->content);

        /** @var User|null $viewer */
        $viewer = Auth::user();

        $this->seo = $buildSeo->handle($this->post, $viewer);
    }

    public function render(): View
    {
        return view('livewire.feed.show')->extends('layouts.app', [
            'title' => $this->seo->title,
            'metaDescription' => $this->seo->description,
            'canonical' => $this->seo->canonical,
            'ogImage' => $this->seo->ogImage,
            'ogType' => 'article',
            'jsonLd' => $this->seo->jsonLd,
        ]);
    }
}
