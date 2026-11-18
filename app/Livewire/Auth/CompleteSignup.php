<?php

declare(strict_types=1);

namespace App\Livewire\Auth;

use App\Domain\Accounts\Actions\CompleteSocialSignup;
use App\Domain\Accounts\Data\PendingSocialAccount;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Livewire\Attributes\Validate;
use Livewire\Component;

class CompleteSignup extends Component
{
    #[Validate('required|regex:/^[a-z0-9_]{3,20}$/i')]
    public string $nickname = '';

    #[Validate('accepted')]
    public bool $age = false;

    #[Validate('accepted')]
    public bool $terms = false;

    public bool $citeName = true;

    public function mount(): void
    {
        if (! session()->has('pending_social_account')) {
            $this->redirectRoute('home', navigate: false);
        }
    }

    public function save(CompleteSocialSignup $action): void
    {
        $this->validate([
            'nickname' => ['required', 'regex:/^[a-z0-9_]{3,20}$/i', Rule::unique('users', 'name')],
            'age' => ['accepted'],
            'terms' => ['accepted'],
        ]);

        $pending = PendingSocialAccount::fromArray(session('pending_social_account'));

        $user = $action->handle($pending, $this->nickname, $this->citeName);

        session()->forget('pending_social_account');

        Auth::login($user, remember: true);

        $this->redirectRoute('home', navigate: false);
    }

    public function render(): View
    {
        return view('livewire.auth.complete-signup');
    }
}
