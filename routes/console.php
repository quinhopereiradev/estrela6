<?php

declare(strict_types=1);

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function (): void {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Semana de lançamento: todo dia às 04:10. Depois, trocar por ->weeklyOn(1, '04:10').
Schedule::command('leonida:sync-map')
    ->dailyAt('04:10')
    ->withoutOverlapping()
    ->onOneServer();
