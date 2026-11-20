@props(['post'])

@php
    $palette = match ($post->category) {
        \App\Domain\Feed\Enums\PostCategory::Noticia => ['#00f0ff', '#3b0764'],
        \App\Domain\Feed\Enums\PostCategory::Teoria => ['#ff5e00', '#3b0764'],
        \App\Domain\Feed\Enums\PostCategory::EasterEgg => ['#ff007f', '#3b0764'],
        \App\Domain\Feed\Enums\PostCategory::Video => ['#a855f7', '#09090b'],
    };
    $gradientId = 'cover-'.$post->id;
@endphp

@if ($post->cover_path)
    <img src="{{ Illuminate\Support\Facades\Storage::disk(config()->string('filesystems.media'))->url($post->cover_path) }}" alt="" {{ $attributes->merge(['class' => 'h-full w-full object-cover']) }}>
@else
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" {{ $attributes->merge(['class' => 'h-full w-full']) }} aria-hidden="true">
        <defs>
            <linearGradient id="{{ $gradientId }}-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="{{ $palette[1] }}" />
                <stop offset="0.55" stop-color="#ff007f" stop-opacity="0.55" />
                <stop offset="1" stop-color="#ff5e00" stop-opacity="0.7" />
            </linearGradient>
        </defs>
        <rect width="400" height="240" fill="url(#{{ $gradientId }}-sky)" />
        <circle cx="{{ 200 + ($post->id * 47) % 120 - 60 }}" cy="150" r="70" fill="{{ $palette[0] }}" opacity="0.5" />
        <rect y="160" width="400" height="80" fill="#09090b" />
    </svg>
@endif
