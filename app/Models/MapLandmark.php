<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property-read MapLandmarkOverride|null $override
 */
#[Fillable([
    'source_id', 'name', 'district', 'area', 'region', 'type', 'tier',
    'enterable', 'unconfirmed', 'closed', 'x', 'y', 'real_world', 'is_active',
    'source_sha', 'first_seen_at', 'last_seen_at',
])]
class MapLandmark extends Model
{
    /**
     * @return HasOne<MapLandmarkOverride, $this>
     */
    public function override(): HasOne
    {
        return $this->hasOne(MapLandmarkOverride::class, 'source_id', 'source_id');
    }

    /**
     * @param  Builder<MapLandmark>  $query
     * @return Builder<MapLandmark>
     */
    #[Scope]
    protected function active(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Formato compacto consumido pelo mapa (Leaflet), com os ajustes do admin aplicados.
     *
     * @return array<int, mixed>|null
     */
    public function toMapRow(): ?array
    {
        $override = $this->override;
        if ($override?->is_hidden) {
            return null;
        }

        $flags = ($this->enterable ? 'e' : '').($this->unconfirmed ? 'u' : '').($this->closed ? 'c' : '');

        $overrideName = $override?->name;
        $overrideType = $override?->type;
        $overrideTier = $override?->tier;

        return [
            $this->source_id,
            $overrideName ?? $this->name,
            $this->district ?? '',
            $this->area ?? '',
            round($this->x, 1),
            round($this->y, 1),
            $this->real_world ?? '',
            $overrideType ?? $this->type,
            $flags,
            $overrideTier ?? $this->tier,
            $this->region ?? '',
            $override?->spoiler_type?->value,
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'enterable' => 'boolean',
            'unconfirmed' => 'boolean',
            'closed' => 'boolean',
            'is_active' => 'boolean',
            'x' => 'float',
            'y' => 'float',
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
        ];
    }
}
