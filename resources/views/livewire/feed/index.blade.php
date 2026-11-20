@php
    $launchAt = \Illuminate\Support\Carbon::parse(config()->string('leonida.launch_at'));
@endphp

<div>
    {{-- Dia X --}}
    <div class="glass-card relative mb-6 overflow-hidden !border-pink-500/40" x-data="dayXBanner('{{ $launchAt->toIso8601String() }}')">
        <div class="relative p-5 md:p-6">
            <template x-if="!launched">
                <div>
                    <p class="font-mono text-[11px] tracking-[0.35em] text-sunset">// {{ __('feed.day_x.countdown_eyebrow') }}</p>
                    <div class="mt-2 flex items-end gap-2" role="timer" :aria-label="`Faltam ${remaining[0].value} dias, ${remaining[1].value} horas e ${remaining[2].value} minutos`">
                        <template x-for="(part, i) in remaining" :key="part.label">
                            <span class="flex items-end">
                                <span x-show="i > 0" class="pb-4 font-display text-4xl text-neon/70 md:text-5xl">:</span>
                                <span class="text-center">
                                    <span class="block min-w-[2ch] font-display text-5xl leading-none text-white tabular-nums md:text-6xl" x-text="String(part.value).padStart(2, '0')"></span>
                                    <span class="mt-1 block font-mono text-[10px] tracking-widest text-zinc-500" x-text="part.label"></span>
                                </span>
                            </span>
                        </template>
                    </div>
                    <p class="mt-2 font-mono text-[11px] text-zinc-400">{{ __('feed.day_x.platforms') }}</p>
                </div>
            </template>
            <template x-if="launched">
                <div>
                    <p class="font-mono text-[11px] tracking-[0.35em] text-cyber">// {{ __('feed.day_x.launched_eyebrow') }}</p>
                    <p class="mt-1 font-display uppercase leading-none text-white">
                        <span class="text-6xl text-neon glow-pink md:text-7xl" x-text="'Dia ' + dayNumber"></span>
                        <span class="block text-3xl md:text-4xl">{{ __('feed.day_x.in_leonida') }}</span>
                    </p>
                </div>
            </template>
        </div>
    </div>

    {{-- Cabeçalho e filtros --}}
    <div class="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
            <p class="mb-1 font-mono text-xs tracking-[0.3em] text-sunset">// {{ __('feed.index.eyebrow') }}</p>
            <h1 class="font-display text-5xl uppercase leading-none text-white md:text-6xl">
                {{ __('feed.index.title') }}
            </h1>
            <div class="mt-3 flex flex-wrap gap-2">
                @auth
                    <button type="button" wire:click="$dispatch('open-article-modal')" class="btn-neon inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs">✎ {{ __('feed.index.write_article') }}</button>
                    @if (auth()->user()->role->canAccessPanel())
                        <a href="{{ url('/admin') }}" class="btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs">{{ __('feed.index.admin_shortcut') }}</a>
                    @endif
                @else
                    <button type="button" x-data @click="$store.auth.open = true" class="btn-neon inline-flex items-center gap-1.5 !px-3 !py-1.5 text-xs">{{ __('feed.index.guest_cta') }}</button>
                @endauth
            </div>

            <livewire:feed.article-modal />
        </div>

        <div class="flex flex-wrap gap-2" role="tablist" aria-label="{{ __('feed.index.filters_label') }}">
            <button
                type="button"
                role="tab"
                aria-selected="{{ $category === 'all' ? 'true' : 'false' }}"
                wire:click="$set('category', 'all')"
                @class([
                    'chip',
                    'chip--active' => $category === 'all',
                ])
            >
                {{ __('feed.index.all') }}
                <span class="chip-count">{{ $total }}</span>
            </button>
            @foreach ($categories as $case)
                <button
                    type="button"
                    role="tab"
                    aria-selected="{{ $category === $case->value ? 'true' : 'false' }}"
                    wire:click="$set('category', '{{ $case->value }}')"
                    @class([
                        'chip',
                        'chip--active' => $category === $case->value,
                    ])
                >
                    {{ $case->label() }}
                    <span class="chip-count">{{ $counts[$case->value] ?? 0 }}</span>
                </button>
            @endforeach
        </div>
    </div>

    {{-- Busca --}}
    <div class="mb-3 h-10 lg:w-80">
        <div class="relative h-full">
            <svg viewBox="0 0 24 24" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
            </svg>
            <input
                type="search"
                wire:model.live.debounce.400ms="search"
                placeholder="{{ __('feed.index.search_placeholder') }}"
                aria-label="{{ __('feed.index.search_label') }}"
                class="h-10 w-full rounded-lg border border-zinc-700 bg-black/40 pl-9 pr-8 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-neon"
            >
            @if ($search !== '')
                <button type="button" wire:click="$set('search', '')" class="icon-btn absolute right-1.5 top-1/2 !h-6 !w-6 -translate-y-1/2" aria-label="{{ __('feed.index.clear_search') }}">✕</button>
            @endif
        </div>
    </div>

    @if ($search !== '' || $category !== 'all')
        <p class="-mt-2 mb-4 font-mono text-[11px] text-zinc-500">
            {{ trans_choice('feed.index.results', $posts->total(), ['count' => $posts->total()]) }}
            @if ($hiddenCount > 0)
                · <span class="text-red-400">{{ trans_choice('feed.index.hidden_matches', $hiddenCount, ['count' => $hiddenCount]) }}</span>
            @endif
            · <button type="button" wire:click="clearFilters" class="underline underline-offset-2 hover:text-zinc-300">{{ __('feed.index.clear_filters') }}</button>
        </p>
    @endif

    {{-- Grade de posts --}}
    @if ($posts->isEmpty())
        <div class="glass-card p-10 text-center font-mono text-zinc-400">
            {{ $search !== '' || $category !== 'all' ? __('feed.index.empty_filtered') : __('feed.index.empty') }}
        </div>
    @else
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            @foreach ($posts as $post)
                <x-spoiler :item="$post">
                    <a href="{{ route('posts.show', $post->slug) }}" class="glass-card group flex h-full flex-col overflow-hidden">
                        <div class="aspect-video w-full overflow-hidden">
                            <x-post-cover :post="$post" class="transition-transform duration-700 group-hover:scale-105" />
                        </div>
                        <div class="flex flex-1 flex-col p-4">
                            <div class="mb-2 flex items-center justify-between gap-2">
                                <span @class([
                                    'tag',
                                    'tag-cyan' => $post->category === \App\Domain\Feed\Enums\PostCategory::Noticia,
                                    'tag-orange' => $post->category === \App\Domain\Feed\Enums\PostCategory::Teoria,
                                    'tag-pink' => $post->category === \App\Domain\Feed\Enums\PostCategory::EasterEgg,
                                    'tag-violet' => $post->category === \App\Domain\Feed\Enums\PostCategory::Video,
                                ])>{{ mb_strtoupper($post->category->label()) }}</span>
                                <span class="truncate font-mono text-[10px] text-zinc-500">
                                    @if ($post->author)
                                        <span class="text-pink-300">{{ __('feed.index.by') }} @{{ $post->author->name }}</span> ·
                                    @endif
                                    {{ $post->published_at?->translatedFormat('d \d\e M') }}
                                </span>
                            </div>
                            <h3 class="font-display text-xl uppercase leading-tight text-white transition-colors group-hover:text-neon">{{ $post->title }}</h3>
                            <p class="mt-1.5 line-clamp-2 text-sm text-zinc-400">{{ $post->excerpt }}</p>
                            <div class="mt-auto flex items-center gap-2 pt-2">
                                <span
                                    class="rel-badge"
                                    @style([
                                        'color: #00f0ff; border-color: #00f0ff66' => $post->reliability === \App\Domain\Feed\Enums\Reliability::Oficial,
                                        'color: #ff5e00; border-color: #ff5e0066' => $post->reliability === \App\Domain\Feed\Enums\Reliability::Rumor,
                                        'color: #c084fc; border-color: #c084fc66' => $post->reliability === \App\Domain\Feed\Enums\Reliability::Comunidade,
                                        'color: #ef4444; border-color: #ef444466' => $post->reliability === \App\Domain\Feed\Enums\Reliability::NaoVerificado,
                                    ])
                                >{{ mb_strtoupper($post->reliability->label()) }}</span>
                            </div>
                        </div>
                    </a>
                </x-spoiler>
            @endforeach
        </div>

        <div class="mt-6">
            {{ $posts->links() }}
        </div>
    @endif
</div>
