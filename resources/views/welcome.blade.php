@extends('layouts.app')

@section('content')
    <section class="mx-auto max-w-5xl px-4 py-20 text-center">
        <p class="font-mono text-xs uppercase tracking-[0.3em] text-sunset">{{ __('home.eyebrow') }}</p>

        <h1 class="mt-4 font-display text-5xl uppercase leading-none text-white md:text-6xl">
            {{ __('home.title') }}
        </h1>

        <p class="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            {{ __('home.tagline') }}
        </p>

        <p class="mx-auto mt-8 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-black/40 px-4 py-2 font-mono text-xs text-zinc-400">
            {{ __('home.status') }}
        </p>

        <div class="mt-8 flex items-center justify-center gap-3">
            <button type="button" class="btn-neon">{{ __('home.cta_login') }}</button>
        </div>
    </section>

    <section class="mx-auto grid max-w-5xl gap-6 px-4 pb-24 sm:grid-cols-3">
        @foreach (['feed', 'map', 'radio'] as $section)
            <article id="{{ $section === 'map' ? 'mapa' : $section }}" class="glass-card p-6">
                <span class="inline-flex items-center rounded-sm border border-neon bg-neon px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white shadow-neon">
                    {{ __('home.coming_soon') }}
                </span>
                <h2 class="mt-4 font-display text-2xl uppercase text-white">
                    {{ __("home.sections.$section.title") }}
                </h2>
                <p class="mt-2 text-sm text-zinc-400">
                    {{ __("home.sections.$section.description") }}
                </p>
            </article>
        @endforeach
    </section>
@endsection
