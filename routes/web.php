<?php

declare(strict_types=1);

use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Feed\ShareCardController;
use App\Http\Controllers\Feed\SitemapController;
use App\Livewire\Auth\CompleteSignup;
use App\Livewire\Auth\Profile;
use App\Livewire\Feed\Show as FeedShow;
use Illuminate\Contracts\View\Factory;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::get('/', fn (): Factory|View => view('welcome'))->name('home');

Route::get('/noticias/{slug}', FeedShow::class)->name('posts.show');
Route::get('/noticias/{slug}/cartao/{formato}.svg', ShareCardController::class)->name('posts.share-card');

Route::get('/sitemap.xml', SitemapController::class)->name('sitemap');

Route::get('/robots.txt', fn (): Response => response(
    "User-agent: *\nDisallow:\n\nSitemap: ".route('sitemap')."\n",
    200,
    ['Content-Type' => 'text/plain'],
))->name('robots');

Route::middleware('throttle:10,1')->group(function (): void {
    Route::get('/auth/{provider}/redirect', [SocialAuthController::class, 'redirect'])
        ->whereIn('provider', ['discord', 'google'])
        ->name('auth.redirect');

    Route::get('/auth/{provider}/callback', [SocialAuthController::class, 'callback'])
        ->whereIn('provider', ['discord', 'google'])
        ->name('auth.callback');
});

Route::get('/completar-cadastro', CompleteSignup::class)->name('onboarding');

Route::middleware('auth')->group(function (): void {
    Route::get('/perfil', Profile::class)->name('profile');

    Route::post('/sair', function (): RedirectResponse {
        Auth::logout();
        request()->session()->invalidate();
        request()->session()->regenerateToken();

        return redirect()->route('home');
    })->name('logout');
});
