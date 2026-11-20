<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Domain\Accounts\Actions\FindUserBySocialAccount;
use App\Domain\Accounts\Data\PendingSocialAccount;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirectResponse;

class SocialAuthController extends Controller
{
    public function redirect(string $provider): SymfonyRedirectResponse
    {
        return Socialite::driver($provider)->redirect();
    }

    public function callback(string $provider, FindUserBySocialAccount $findUser): RedirectResponse
    {
        $socialiteUser = Socialite::driver($provider)->user();

        $user = $findUser->handle($provider, $socialiteUser->getId());

        if ($user) {
            Auth::login($user, remember: true);

            return redirect()->intended(route('home'));
        }

        session(['pending_social_account' => (new PendingSocialAccount(
            provider: $provider,
            providerId: $socialiteUser->getId(),
            name: $socialiteUser->getName(),
            email: $socialiteUser->getEmail(),
            avatarUrl: $socialiteUser->getAvatar(),
        ))->toArray()]);

        return redirect()->route('onboarding');
    }
}
