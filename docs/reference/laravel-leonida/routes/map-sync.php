<?php
// Trechos para colar no projeto Laravel 11.

// routes/web.php (ou api.php) ------------------------------------------------
use App\Http\Controllers\MapDataController;
use Illuminate\Support\Facades\Route;

Route::prefix('mapa/dados')->group(function () {
    Route::get('locais.json', [MapDataController::class, 'landmarks']);
    Route::get('regioes.json', [MapDataController::class, 'regions']);
    Route::get('meta.json', [MapDataController::class, 'meta']);
});

// routes/console.php ---------------------------------------------------------
use Illuminate\Support\Facades\Schedule;

// Semana de lançamento: todo dia às 04:10. Depois, troque por ->weeklyOn(1, '04:10').
Schedule::command('leonida:sync-map')
    ->dailyAt('04:10')
    ->withoutOverlapping()
    ->onOneServer();
