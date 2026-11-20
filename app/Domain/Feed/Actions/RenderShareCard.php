<?php

declare(strict_types=1);

namespace App\Domain\Feed\Actions;

use App\Domain\Feed\Enums\PostCategory;
use App\Domain\Feed\Enums\ShareCardFormat;
use App\Domain\Spoilers\Enums\SpoilerType;
use App\Domain\Spoilers\SpoilerGate;
use App\Models\Post;

/**
 * Gera o cartão de compartilhamento (SVG) de um post num dos três formatos.
 *
 * Independente de quem pediu o cartão: se o post tem spoiler, o cartão usa o
 * título seguro e não mostra o resumo — a imagem pode circular pra qualquer
 * um, não só pra quem tem a preferência configurada.
 */
final readonly class RenderShareCard
{
    private const int MAX_TITLE_LINES = 4;

    public function __construct(
        private SpoilerGate $gate,
    ) {}

    public function handle(Post $post, ShareCardFormat $format): string
    {
        $width = $format->width();
        $height = $format->height();
        $hasSpoiler = $post->spoilerType() instanceof SpoilerType;

        $title = $hasSpoiler ? $this->gate->safeTitle($post) : $post->title;
        $excerpt = $hasSpoiler ? null : $post->excerpt;
        $palette = $this->palette($post->category);

        $titleSize = (int) round($width * 0.07);
        $lines = $this->wrap($title, (int) round($width / ($titleSize * 0.55)), self::MAX_TITLE_LINES);
        $lineHeight = (int) round($titleSize * 1.15);
        $titleBlockHeight = count($lines) * $lineHeight;
        $titleStartY = $height - $titleBlockHeight - (int) round($height * 0.12);

        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '.$width.' '.$height.'" width="'.$width.'" height="'.$height.'">';
        $svg .= '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">';
        $svg .= '<stop offset="0" stop-color="'.$palette[1].'" /><stop offset="0.55" stop-color="#ff007f" stop-opacity="0.55" /><stop offset="1" stop-color="#ff5e00" stop-opacity="0.75" />';
        $svg .= '</linearGradient></defs>';
        $svg .= '<rect width="'.$width.'" height="'.$height.'" fill="#09090b" />';
        $svg .= '<rect width="'.$width.'" height="'.$height.'" fill="url(#bg)" />';

        $badgeY = (int) round($height * 0.08);
        $badgeSize = (int) round($width * 0.028);
        if ($hasSpoiler) {
            $svg .= $this->badge('⚠ SPOILER', $width * 0.06, $badgeY, $badgeSize, '#ff007f', '#ffffff');
        } else {
            $svg .= $this->badge(e(mb_strtoupper($post->category->label())), $width * 0.06, $badgeY, $badgeSize, 'rgba(255,255,255,0.15)', '#ffffff');
        }

        foreach ($lines as $i => $line) {
            $y = $titleStartY + ($i * $lineHeight) + $titleSize;
            $svg .= '<text x="'.($width * 0.06).'" y="'.$y.'" font-family="sans-serif" font-weight="800" font-size="'.$titleSize.'" fill="#ffffff" letter-spacing="-1">'.e($line).'</text>';
        }

        if ($excerpt !== null) {
            $excerptSize = (int) round($width * 0.028);
            $excerptY = $titleStartY + $titleBlockHeight + $excerptSize + (int) round($height * 0.03);
            $excerptLines = $this->wrap($excerpt, (int) round($width / ($excerptSize * 0.5)), 2);
            foreach ($excerptLines as $i => $line) {
                $svg .= '<text x="'.($width * 0.06).'" y="'.($excerptY + $i * (int) round($excerptSize * 1.3)).'" font-family="sans-serif" font-size="'.$excerptSize.'" fill="rgba(255,255,255,0.75)">'.e($line).'</text>';
            }
        }

        $brandSize = (int) round($width * 0.03);
        $svg .= '<text x="'.($width * 0.06).'" y="'.($height * 0.05).'" font-family="monospace" font-weight="700" font-size="'.$brandSize.'" fill="#ffffff">ESTRELA6</text>';

        $svg .= '</svg>';

        return $svg;
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function palette(PostCategory $category): array
    {
        return match ($category) {
            PostCategory::Noticia => ['#00f0ff', '#3b0764'],
            PostCategory::Teoria => ['#ff5e00', '#3b0764'],
            PostCategory::EasterEgg => ['#ff007f', '#3b0764'],
            PostCategory::Video => ['#a855f7', '#09090b'],
        };
    }

    private function badge(string $text, float $x, int $y, int $fontSize, string $fill, string $textColor): string
    {
        $paddingX = (int) round($fontSize * 0.8);
        $width = (int) (strlen($text) * $fontSize * 0.62) + $paddingX * 2;
        $height = (int) round($fontSize * 1.9);

        return '<rect x="'.$x.'" y="'.($y - $height + $fontSize).'" width="'.$width.'" height="'.$height.'" rx="4" fill="'.$fill.'" />'
            .'<text x="'.($x + $paddingX).'" y="'.$y.'" font-family="monospace" font-weight="700" font-size="'.$fontSize.'" fill="'.$textColor.'">'.$text.'</text>';
    }

    /**
     * @return array<int, string>
     */
    private function wrap(string $text, int $maxCharsPerLine, int $maxLines): array
    {
        $maxCharsPerLine = max(8, $maxCharsPerLine);
        $words = preg_split('/\s+/', trim($text)) ?: [];
        $lines = [];
        $current = '';

        foreach ($words as $word) {
            $candidate = $current === '' ? $word : $current.' '.$word;

            if (mb_strlen($candidate) > $maxCharsPerLine && $current !== '') {
                $lines[] = $current;
                $current = $word;
            } else {
                $current = $candidate;
            }

            if (count($lines) === $maxLines) {
                break;
            }
        }

        if ($current !== '' && count($lines) < $maxLines) {
            $lines[] = $current;
        }

        if (count($lines) === $maxLines) {
            $last = $lines[$maxLines - 1];
            if (mb_strlen($last) > $maxCharsPerLine - 1) {
                $last = mb_substr($last, 0, $maxCharsPerLine - 1);
            }
            $lines[$maxLines - 1] = rtrim($last).'…';
        }

        return $lines;
    }
}
