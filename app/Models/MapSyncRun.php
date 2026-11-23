<?php

declare(strict_types=1);

namespace App\Models;

use App\Domain\Map\Enums\MapSyncRunStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property MapSyncRunStatus $status
 * @property Carbon|null $published_at
 */
#[Fillable([
    'status', 'landmarks_sha', 'tiles_sha', 'tileset', 'tiles_version',
    'staging_path', 'summary', 'log', 'published_by', 'published_at',
])]
class MapSyncRun extends Model
{
    public function appendLog(string $line): void
    {
        $this->log = trim(($this->log ?? '')."\n[".now()->format('H:i:s').'] '.$line);
        $this->save();
    }

    /** Última execução publicada (define a versão de tiles e o SHA em uso). */
    public static function current(): ?self
    {
        return static::where('status', MapSyncRunStatus::Published)->latest('published_at')->first();
    }

    public static function currentTilesVersion(): ?int
    {
        return static::where('status', MapSyncRunStatus::Published)->whereNotNull('tiles_version')->max('tiles_version');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => MapSyncRunStatus::class,
            'summary' => 'array',
            'published_at' => 'datetime',
        ];
    }
}
