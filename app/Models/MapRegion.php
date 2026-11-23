<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\WithoutIncrementing;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['id', 'name', 'station', 'color', 'label_x', 'label_y', 'polygons'])]
#[WithoutIncrementing]
class MapRegion extends Model
{
    protected $keyType = 'string';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'polygons' => 'array',
        ];
    }
}
