<?php

declare(strict_types=1);

use Rector\CodeQuality\Rector\If_\ExplicitNullableObjectInstanceRector;
use Rector\Config\RectorConfig;

return RectorConfig::configure()
    ->withPaths([__DIR__.'/app', __DIR__.'/config', __DIR__.'/database', __DIR__.'/routes', __DIR__.'/tests'])
    ->withPhpSets(php84: true)
    ->withComposerBased(laravel: true)
    ->withPreparedSets(deadCode: true, codeQuality: true, typeDeclarations: true, earlyReturn: true)
    ->withImportNames(removeUnusedImports: true)
    ->withSkip([
        // Pediria `instanceof App\Models\X` em Controllers, o que violaria a regra de
        // arquitetura "Controllers não usam Models diretamente" (tests/Arch).
        ExplicitNullableObjectInstanceRector::class => [__DIR__.'/app/Http/Controllers'],
    ]);
