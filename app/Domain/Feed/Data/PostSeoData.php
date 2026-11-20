<?php

declare(strict_types=1);

namespace App\Domain\Feed\Data;

final readonly class PostSeoData
{
    public function __construct(
        public string $title,
        public string $description,
        public string $canonical,
        public string $ogImage,
        public ?string $jsonLd,
    ) {}
}
