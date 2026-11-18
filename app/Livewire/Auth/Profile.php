<?php

declare(strict_types=1);

namespace App\Livewire\Auth;

use App\Domain\Accounts\Actions\DeleteAccount;
use App\Models\User;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Livewire\Attributes\Renderless;
use Livewire\Component;

class Profile extends Component
{
    public string $nickname = '';

    public bool $citeName = true;

    public function mount(): void
    {
        /** @var User $user */
        $user = Auth::user();

        $this->nickname = $user->name;
        $this->citeName = $user->cite_name;
    }

    public function save(): void
    {
        /** @var User $user */
        $user = Auth::user();

        $this->validate([
            'nickname' => ['required', 'regex:/^[a-z0-9_]{3,20}$/i', Rule::unique('users', 'name')->ignore($user->id)],
        ]);

        $user->update([
            'name' => $this->nickname,
            'cite_name' => $this->citeName,
        ]);

        session()->flash('status', __('auth.profile.saved'));
    }

    #[Renderless]
    public function deleteAccount(): void
    {
        /** @var User $user */
        $user = Auth::user();

        Auth::logout();

        app(DeleteAccount::class)->handle($user);

        $this->redirectRoute('home', navigate: false);
    }

    public function render(): View
    {
        return view('livewire.auth.profile');
    }
}
