<?php

declare(strict_types=1);

namespace App\Livewire\Spoilers;

use App\Domain\Spoilers\Actions\SaveUserSpoilerPreference;
use App\Domain\Spoilers\Data\SpoilerPreference;
use App\Domain\Spoilers\Enums\SpoilerPreset;
use App\Domain\Spoilers\Enums\SpoilerType;
use App\Domain\Spoilers\SpoilerGate;
use App\Domain\Spoilers\SpoilerPreferenceResolver;
use App\Models\User;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Livewire\Attributes\Renderless;
use Livewire\Component;

class Preferences extends Component
{
    public bool $open = false;

    public bool $firstTime = false;

    public bool $shieldOn = false;

    public string $preset = 'oficial';

    /** @var array<string, bool> */
    public array $overrides = [];

    public function mount(SpoilerPreferenceResolver $resolver): void
    {
        /** @var User|null $viewer */
        $viewer = Auth::user();
        $preference = $resolver->resolve($viewer);

        $this->preset = $preference->preset->value;
        $this->overrides = $preference->overrides;
        $this->firstTime = ! $preference->chosen;
        $this->open = $this->firstTime;
        $this->shieldOn = (bool) session(SpoilerGate::SHIELD_SESSION_KEY, false);
    }

    public function openModal(): void
    {
        $this->open = true;
    }

    public function closeModal(): void
    {
        if (! $this->firstTime) {
            $this->open = false;
        }
    }

    public function selectPreset(string $preset): void
    {
        $this->preset = SpoilerPreset::from($preset)->value;
        $this->overrides = [];
    }

    public function toggleOverride(string $type): void
    {
        $spoilerType = SpoilerType::from($type);
        $current = $this->overrides[$spoilerType->value] ?? SpoilerPreset::from($this->preset)->baseHides()[$spoilerType->value];
        $this->overrides[$spoilerType->value] = ! $current;
    }

    public function save(): void
    {
        $preference = new SpoilerPreference(
            preset: SpoilerPreset::from($this->preset),
            overrides: $this->overrides,
            chosen: true,
        );

        /** @var User|null $viewer */
        $viewer = Auth::user();

        if ($viewer) {
            app(SaveUserSpoilerPreference::class)->handle($viewer, $preference);
        } else {
            Cookie::queue(SpoilerPreferenceResolver::COOKIE, json_encode($preference->toArray(), JSON_THROW_ON_ERROR), 60 * 24 * 365);
        }

        $this->firstTime = false;
        $this->open = false;
    }

    #[Renderless]
    public function toggleShield(): void
    {
        $this->shieldOn = ! $this->shieldOn;
        session([SpoilerGate::SHIELD_SESSION_KEY => $this->shieldOn]);
    }

    public function render(): View
    {
        return view('livewire.spoilers.preferences');
    }
}
