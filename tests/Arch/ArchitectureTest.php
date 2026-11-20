<?php

declare(strict_types=1);

arch('domain does not depend on filament or livewire')
    ->expect('App\Domain')
    ->not->toUse(['Filament', 'Livewire']);

arch('nothing in app calls env() directly')
    ->expect('App')
    ->not->toUse('env');

arch('no debugging calls are left in app')
    ->expect('App')
    ->not->toUse(['dd', 'dump', 'ray']);

arch('controllers do not use models directly')
    ->expect('App\Http\Controllers')
    ->not->toUse('App\Models');
