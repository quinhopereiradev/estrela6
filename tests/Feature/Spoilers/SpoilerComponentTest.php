<?php

declare(strict_types=1);

use App\Domain\Spoilers\Enums\SpoilerType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Blade;
use Tests\Fixtures\FakeSpoilable;

uses(RefreshDatabase::class);

test('x-spoiler renders the real content when visible', function (): void {
    $html = Blade::render(
        '<x-spoiler :item="$item">conteúdo secreto aqui</x-spoiler>',
        ['item' => new FakeSpoilable],
    );

    expect($html)->toContain('conteúdo secreto aqui');
});

test('x-spoiler hides the slot and shows a placeholder when the content is protected', function (): void {
    $html = Blade::render(
        '<x-spoiler :item="$item">conteúdo secreto aqui</x-spoiler>',
        ['item' => new FakeSpoilable(SpoilerType::Leak)],
    );

    expect($html)->not->toContain('conteúdo secreto aqui')
        ->and($html)->toContain(__('spoilers.safe_title'));
});
