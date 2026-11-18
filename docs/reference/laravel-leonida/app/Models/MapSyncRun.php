<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MapSyncRun extends Model
{
    protected $guarded = [];

    protected $casts = [
        'summary' => 'array',
        'published_at' => 'datetime',
    ];

    public function appendLog(string $line): void
    {
        $this->log = trim(($this->log ?? '') . "\n[" . now()->format('H:i:s') . "] " . $line);
        $this->save();
    }

    /** Última execução publicada (define a versão de tiles e o SHA em uso). */
    public static function current(): ?self
    {
        return static::where('status', 'published')->latest('published_at')->first();
    }

    public static function currentTilesVersion(): ?int
    {
        return static::where('status', 'published')->whereNotNull('tiles_version')->max('tiles_version');
    }
}
