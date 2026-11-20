<?php

declare(strict_types=1);

namespace App\View\Components;

use App\Domain\Spoilers\Contracts\Spoilable;
use App\Domain\Spoilers\SpoilerGate;
use App\Models\User;
use Illuminate\Contracts\Auth\Guard;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class Spoiler extends Component
{
    public bool $visible;

    public string $safeTitle;

    public function __construct(
        public Spoilable $item,
        SpoilerGate $gate,
        Guard $auth,
    ) {
        /** @var User|null $viewer */
        $viewer = $auth->user();

        $this->visible = $gate->canSee($viewer, $item);
        $this->safeTitle = $gate->safeTitle($item);
    }

    public function render(): View
    {
        return view('components.spoiler');
    }
}
