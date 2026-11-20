<?php

declare(strict_types=1);

namespace App\Filament\Pages;

use App\Filament\Concerns\HasModSafeMode;
use Filament\Actions\Action;
use Filament\Pages\Dashboard as BaseDashboard;

class Dashboard extends BaseDashboard
{
    use HasModSafeMode;

    /**
     * @return array<Action>
     */
    protected function getHeaderActions(): array
    {
        return [
            Action::make('safeMode')
                ->label(fn (): string => $this->isSafe()
                    ? __('filament.safe_mode.on')
                    : __('filament.safe_mode.off'))
                ->color(fn (): string => $this->isSafe() ? 'success' : 'danger')
                ->icon(fn (): string => $this->isSafe() ? 'heroicon-o-shield-check' : 'heroicon-o-shield-exclamation')
                ->action('toggleSafeMode'),
        ];
    }
}
