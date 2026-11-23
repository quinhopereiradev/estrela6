<?php

declare(strict_types=1);

namespace App\Models;

use App\Domain\Spoilers\Enums\SpoilerType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string|null $name
 * @property string|null $type
 * @property int|null $tier
 * @property SpoilerType|null $spoiler_type
 * @property bool $is_hidden
 */
#[Fillable(['source_id', 'name', 'type', 'tier', 'spoiler_type', 'is_hidden', 'notes', 'updated_by'])]
class MapLandmarkOverride extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_hidden' => 'boolean',
            'spoiler_type' => SpoilerType::class,
        ];
    }
}
