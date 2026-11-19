<?php

declare(strict_types=1);

namespace App\Livewire\Feed;

use App\Domain\Feed\Actions\FindPublishedPost;
use App\Domain\Feed\Actions\RenderPostContent;
use App\Domain\Spoilers\SpoilerGate;
use App\Models\Post;
use App\Models\User;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;

class Show extends Component
{
    public Post $post;

    public string $contentHtml;

    public string $pageTitle;

    public function mount(string $slug, FindPublishedPost $find, RenderPostContent $render, SpoilerGate $gate): void
    {
        $this->post = $find->handle($slug);
        $this->contentHtml = $render->handle($this->post->content);

        /** @var User|null $viewer */
        $viewer = Auth::user();

        $this->pageTitle = $gate->canSee($viewer, $this->post)
            ? $this->post->title.' · '.__('layout.brand')
            : $gate->safeTitle($this->post);
    }

    public function render(): View
    {
        return view('livewire.feed.show')->title($this->pageTitle)->extends('layouts.app');
    }
}
