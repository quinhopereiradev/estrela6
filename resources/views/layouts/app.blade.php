<!doctype html>
<html lang="pt-BR" class="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? __('layout.brand') }}</title>

    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen bg-vc-bg font-sans text-white antialiased">
    <a href="#conteudo" class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[1100] focus:rounded-md focus:bg-neon focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
        {{ __('layout.skip_to_content') }}
    </a>

    <header class="fixed inset-x-0 top-0 z-[1000] h-16 border-b border-pink-500/20 bg-vc-bg/80 backdrop-blur-md">
        <div class="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4">
            <a href="{{ route('home') }}" class="group flex shrink-0 items-center gap-2.5">
                <span class="grid h-9 w-9 place-items-center rounded-md bg-gradient-to-br from-neon to-sunset shadow-neon">
                    <svg viewBox="0 0 24 24" class="h-5 w-5 text-vc-bg" fill="currentColor" aria-hidden="true">
                        <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
                    </svg>
                </span>
                <span class="hidden leading-none sm:block">
                    <span class="block font-display text-xl tracking-wider text-white transition-colors group-hover:text-neon">
                        {{ __('layout.brand') }}
                    </span>
                    <span class="block text-[12px] leading-none tracking-[0.25em] text-zinc-600" aria-label="seis estrelas">
                        ★★★★★<span class="text-neon glow-pink">★</span>
                    </span>
                </span>
            </a>

            <nav class="flex items-center gap-1" aria-label="{{ __('layout.brand') }}">
                <a href="{{ route('home') }}#feed" class="nav-link hidden sm:inline-flex">{{ __('layout.nav.feed') }}</a>
                <a href="{{ route('home') }}#mapa" class="nav-link hidden sm:inline-flex">{{ __('layout.nav.map') }}</a>
                <a href="{{ route('home') }}#radio" class="nav-link hidden sm:inline-flex">{{ __('layout.nav.radio') }}</a>
                <button type="button" class="ml-1 rounded-md border border-neon/60 bg-neon/15 px-3 py-1.5 text-xs font-semibold text-neon transition hover:bg-neon/25">
                    {{ __('layout.login') }}
                </button>
            </nav>
        </div>
    </header>

    <main id="conteudo" class="pt-16">
        @yield('content')
    </main>
</body>
</html>
