<?php

declare(strict_types=1);

use App\Domain\Feed\Actions\ProcessUploadedCoverImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('a real oversized image is resized to the max dimension and saved on the media disk', function (): void {
    Storage::fake('public');

    $file = UploadedFile::fake()->image('capa.jpg', 2400, 1200);

    $path = app(ProcessUploadedCoverImage::class)->handle($file);

    expect($path)->toStartWith('posts/covers/')->toEndWith('.webp');
    Storage::disk('public')->assertExists($path);

    $contents = Storage::disk('public')->get($path);
    $image = imagecreatefromstring($contents);

    expect(imagesx($image))->toBe(1600)
        ->and(imagesy($image))->toBe(800);
});

test('a small image is kept at its original size', function (): void {
    Storage::fake('public');

    $file = UploadedFile::fake()->image('capa.jpg', 400, 300);

    $path = app(ProcessUploadedCoverImage::class)->handle($file);

    $image = imagecreatefromstring(Storage::disk('public')->get($path));

    expect(imagesx($image))->toBe(400)
        ->and(imagesy($image))->toBe(300);
});

test('a file whose real bytes are not an image is rejected regardless of its declared mime type', function (): void {
    Storage::fake('public');

    $file = UploadedFile::fake()->create('capa.jpg', 10, 'image/jpeg');

    app(ProcessUploadedCoverImage::class)->handle($file);
})->throws(InvalidArgumentException::class);
