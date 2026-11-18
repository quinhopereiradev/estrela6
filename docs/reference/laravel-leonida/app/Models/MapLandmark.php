<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class MapLandmark extends Model
{
    protected $guarded = [];

    protected $casts = [
        'enterable' => 'boolean',
        'unconfirmed' => 'boolean',
        'closed' => 'boolean',
        'is_active' => 'boolean',
        'x' => 'float',
        'y' => 'float',
        'first_seen_at' => 'datetime',
        'last_seen_at' => 'datetime',
    ];

    public function override(): HasOne
    {
        return $this->hasOne(MapLandmarkOverride::class, 'source_id', 'source_id');
    }

    public function scopeActive(Builder $q): Builder
    {
        return $q->where('is_active', true);
    }

    /** Formato compacto consumido pelo mapa (mesmo do protótipo), com os ajustes do admin aplicados. */
    public function toMapRow(): ?array
    {
        $o = $this->override;
        if ($o?->hidden) {
            return null;
        }

        $flags = ($this->enterable ? 'e' : '') . ($this->unconfirmed ? 'u' : '') . ($this->closed ? 'c' : '');

        return [
            $this->source_id,
            $o?->name ?? $this->name,
            $this->district ?? '',
            $this->area ?? '',
            round($this->x, 1),
            round($this->y, 1),
            $this->real_world ?? '',
            $o?->type ?? $this->type,
            $flags,
            $o?->tier ?? $this->tier,
            $this->region ?? '',
            $o?->spoiler_type,
        ];
    }
}
