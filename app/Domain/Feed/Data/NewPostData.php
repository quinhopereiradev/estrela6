<?php

declare(strict_types=1);

namespace App\Domain\Feed\Data;

use App\Domain\Feed\Enums\PostCategory;
use App\Domain\Feed\Enums\PostOrigin;
use App\Domain\Feed\Enums\Reliability;
use App\Domain\Spoilers\Enums\SpoilerType;

final readonly class NewPostData
{
    public function __construct(
        public string $title,
        public string $excerpt,
        public string $content,
        public PostCategory $category,
        public PostOrigin $origin,
        public Reliability $reliability = Reliability::NaoVerificado,
        public ?int $authorId = null,
        public ?SpoilerType $spoilerType = null,
        public ?string $sourceName = null,
        public ?string $sourceUrl = null,
    ) {}
}
