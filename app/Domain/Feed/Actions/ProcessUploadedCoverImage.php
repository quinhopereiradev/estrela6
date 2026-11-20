<?php

declare(strict_types=1);

namespace App\Domain\Feed\Actions;

use GdImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Valida, redimensiona e salva a capa de um post.
 *
 * O MIME é checado pelos bytes reais do arquivo (não pela extensão ou pelo
 * Content-Type enviado pelo navegador). O redimensionamento via GD recria a
 * imagem a partir dos pixels decodificados, então nenhum metadado (EXIF,
 * GPS) sobrevive ao processo — não é preciso removê-lo manualmente.
 */
final class ProcessUploadedCoverImage
{
    private const int MAX_DIMENSION = 1600;

    /**
     * @var array<string, callable(string): (GdImage|false)>
     */
    private const array DECODERS = [
        'image/jpeg' => 'imagecreatefromjpeg',
        'image/png' => 'imagecreatefrompng',
        'image/webp' => 'imagecreatefromwebp',
    ];

    public function handle(UploadedFile $file): string
    {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);

        if ($finfo === false) {
            throw new InvalidArgumentException('Não foi possível verificar o tipo do arquivo enviado.');
        }

        $realMime = (string) finfo_file($finfo, $file->getRealPath());

        if (! array_key_exists($realMime, self::DECODERS)) {
            throw new InvalidArgumentException('O arquivo enviado não é uma imagem JPEG, PNG ou WebP válida.');
        }

        $decoder = self::DECODERS[$realMime];
        $source = $decoder($file->getRealPath());

        if ($source === false) {
            throw new InvalidArgumentException('Não foi possível ler a imagem enviada.');
        }

        $resized = $this->resize($source);
        $path = 'posts/covers/'.Str::uuid()->toString().'.webp';

        ob_start();
        imagewebp($resized, null, 85);
        $contents = ob_get_clean();

        if ($resized !== $source) {
            imagedestroy($source);
        }
        imagedestroy($resized);

        Storage::disk(config()->string('filesystems.media'))->put($path, $contents);

        return $path;
    }

    private function resize(GdImage $source): GdImage
    {
        $width = imagesx($source);
        $height = imagesy($source);
        $largestSide = max($width, $height);

        if ($largestSide <= self::MAX_DIMENSION) {
            return $source;
        }

        $scale = self::MAX_DIMENSION / $largestSide;
        $newWidth = max(1, (int) round($width * $scale));
        $newHeight = max(1, (int) round($height * $scale));

        $resized = imagecreatetruecolor($newWidth, $newHeight);
        imagealphablending($resized, false);
        imagesavealpha($resized, true);
        imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        return $resized;
    }
}
