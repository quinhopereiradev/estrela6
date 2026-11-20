@php
    $palette = match ($post->category) {
        \App\Domain\Feed\Enums\PostCategory::Noticia => '#00f0ff',
        \App\Domain\Feed\Enums\PostCategory::Teoria => '#ff5e00',
        \App\Domain\Feed\Enums\PostCategory::EasterEgg => '#ff007f',
        \App\Domain\Feed\Enums\PostCategory::Video => '#a855f7',
    };
    $reliabilityColor = match ($post->reliability) {
        \App\Domain\Feed\Enums\Reliability::Oficial => '#00f0ff',
        \App\Domain\Feed\Enums\Reliability::Rumor => '#ff5e00',
        \App\Domain\Feed\Enums\Reliability::Comunidade => '#c084fc',
        \App\Domain\Feed\Enums\Reliability::NaoVerificado => '#ef4444',
    };
    $shareUrl = route('posts.show', $post->slug);
@endphp

<div class="mx-auto max-w-3xl px-4 py-12">
    <a href="{{ route('home') }}#feed" class="mb-6 inline-flex items-center gap-1.5 font-mono text-xs text-zinc-400 transition-colors hover:text-white">← {{ __('feed.show.back_to_feed') }}</a>

    <x-spoiler :item="$post">
        <article>
            <div class="mb-3 flex flex-wrap items-center gap-2">
                <span class="tag" style="color: {{ $palette }}; border-color: {{ $palette }}80; background: {{ $palette }}1a">{{ mb_strtoupper($post->category->label()) }}</span>
                <span class="font-mono text-[11px] text-zinc-500">
                    @if ($post->author)
                        <span class="text-pink-300">{{ __('feed.index.by') }} @{{ $post->author->name }}</span> ·
                    @endif
                    {{ $post->published_at?->translatedFormat('d \d\e F \d\e Y') }}
                </span>
            </div>

            <h1 class="font-display text-4xl uppercase leading-tight text-white md:text-5xl">{{ $post->title }}</h1>
            <p class="mt-3 text-lg text-zinc-300">{{ $post->excerpt }}</p>

            @if ($post->cover_path)
                <div class="mt-6 overflow-hidden rounded-xl border border-zinc-800">
                    <x-post-cover :post="$post" />
                </div>
            @endif

            <div class="glass-card mt-6 p-4">
                <p class="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{{ __('feed.show.reliability_box') }}</p>
                <div class="mt-2 flex items-center gap-2">
                    <span class="rel-badge" style="color: {{ $reliabilityColor }}; border-color: {{ $reliabilityColor }}66">{{ mb_strtoupper($post->reliability->label()) }}</span>
                    @if ($post->confidence !== null)
                        <span class="font-mono text-xs text-zinc-400">{{ $post->confidence }}%</span>
                    @endif
                </div>
                @if ($post->basis)
                    <p class="mt-2 text-sm text-zinc-300">{{ $post->basis }}</p>
                @endif
                @if ($post->source_name)
                    <p class="mt-2 font-mono text-xs text-zinc-500">
                        {{ __('feed.show.source') }}:
                        @if ($post->source_url)
                            <a href="{{ $post->source_url }}" target="_blank" rel="noopener noreferrer" class="text-cyber underline">{{ $post->source_name }}</a>
                        @else
                            {{ $post->source_name }}
                        @endif
                    </p>
                @endif
            </div>

            <div class="post-content mt-8">
                {!! $contentHtml !!}
            </div>

            <div class="glass-card mt-10 p-4" x-data="{ copied: false }">
                <p class="mb-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">{{ __('feed.show.share') }}</p>
                <div class="grid grid-cols-3 gap-3">
                    @foreach (\App\Domain\Feed\Enums\ShareCardFormat::cases() as $format)
                        <a
                            href="{{ route('posts.share-card', ['slug' => $post->slug, 'formato' => $format->value]) }}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="group overflow-hidden rounded-lg border border-zinc-700 transition hover:border-neon/60"
                        >
                            <img src="{{ route('posts.share-card', ['slug' => $post->slug, 'formato' => $format->value]) }}" alt="{{ __('feed.show.card_alt', ['format' => $format->value]) }}" class="aspect-square w-full object-cover" loading="lazy">
                            <span class="block p-1.5 text-center font-mono text-[10px] uppercase text-zinc-400 transition-colors group-hover:text-white">{{ $format->value }}</span>
                        </a>
                    @endforeach
                </div>
                <button
                    type="button"
                    @click="navigator.clipboard.writeText('{{ $shareUrl }}'); copied = true; setTimeout(() => copied = false, 2000)"
                    class="btn-ghost mt-3 w-full !py-2 text-xs"
                >
                    <span x-show="!copied">{{ __('feed.show.copy_link') }}</span>
                    <span x-show="copied" x-cloak>{{ __('feed.show.link_copied') }}</span>
                </button>
            </div>
        </article>
    </x-spoiler>
</div>
