<?php

declare(strict_types=1);

namespace App\Http\Controllers\Feed;

use App\Domain\Feed\Actions\FindPublishedPost;
use App\Domain\Feed\Actions\RenderShareCard;
use App\Domain\Feed\Enums\ShareCardFormat;
use App\Http\Controllers\Controller;
use Illuminate\Http\Response;

class ShareCardController extends Controller
{
    public function __invoke(string $slug, ShareCardFormat $formato, FindPublishedPost $find, RenderShareCard $render): Response
    {
        $post = $find->handle($slug);

        return response($render->handle($post, $formato), 200, [
            'Content-Type' => 'image/svg+xml',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }
}
