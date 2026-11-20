<?php

declare(strict_types=1);

use App\Domain\Feed\Actions\RenderPostContent;

test('raw html in the markdown is escaped, not executed', function (): void {
    $html = app(RenderPostContent::class)->handle('Olá <script>alert(1)</script> mundo');

    expect($html)->not->toContain('<script>')
        ->and($html)->toContain('&lt;script&gt;');
});

test('a javascript: link is neutralized', function (): void {
    $html = app(RenderPostContent::class)->handle('[clique aqui](javascript:alert(1))');

    expect($html)->not->toContain('javascript:alert');
});

test('normal markdown still renders as html', function (): void {
    $html = app(RenderPostContent::class)->handle("# Título\n\nUm **parágrafo** com *ênfase*.");

    expect($html)->toContain('<h1>Título</h1>')
        ->and($html)->toContain('<strong>parágrafo</strong>')
        ->and($html)->toContain('<em>ênfase</em>');
});
