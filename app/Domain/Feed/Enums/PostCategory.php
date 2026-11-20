<?php

declare(strict_types=1);

namespace App\Domain\Feed\Enums;

enum PostCategory: string
{
    case Noticia = 'noticia';
    case Teoria = 'teoria';
    case EasterEgg = 'easter-egg';
    case Video = 'video';

    public function label(): string
    {
        return match ($this) {
            self::Noticia => __('feed.categories.noticia'),
            self::Teoria => __('feed.categories.teoria'),
            self::EasterEgg => __('feed.categories.easter-egg'),
            self::Video => __('feed.categories.video'),
        };
    }
}
