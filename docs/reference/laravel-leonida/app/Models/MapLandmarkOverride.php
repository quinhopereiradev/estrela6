<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MapLandmarkOverride extends Model
{
    protected $guarded = [];

    protected $casts = ['hidden' => 'boolean'];
}
