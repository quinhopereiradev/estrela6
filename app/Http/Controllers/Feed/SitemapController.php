<?php

declare(strict_types=1);

namespace App\Http\Controllers\Feed;

use App\Domain\Feed\Actions\BuildSitemap;
use App\Http\Controllers\Controller;
use Illuminate\Http\Response;

class SitemapController extends Controller
{
    public function __invoke(BuildSitemap $build): Response
    {
        return response($build->handle(), 200, [
            'Content-Type' => 'application/xml',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }
}
