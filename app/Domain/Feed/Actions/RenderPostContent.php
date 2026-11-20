<?php

declare(strict_types=1);

namespace App\Domain\Feed\Actions;

use Illuminate\Support\Str;

/**
 * Converte o Markdown de um post pra HTML seguro.
 *
 * O CommonMark do pacote, por padrão, deixa HTML bruto passar direto
 * (html_input=allow) e libera links javascript: (allow_unsafe_links=true) —
 * os dois são ligados aqui.
 */
final class RenderPostContent
{
    public function handle(string $markdown): string
    {
        return Str::markdown($markdown, [
            'html_input' => 'escape',
            'allow_unsafe_links' => false,
        ]);
    }
}
