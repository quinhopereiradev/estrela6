@if ($visible)
    {{ $slot }}
@else
    <div class="glass-card flex flex-col items-center justify-center gap-2 p-6 text-center" role="note" aria-label="{{ __('spoilers.hidden_aria') }}">
        <span class="font-mono text-[11px] uppercase tracking-widest text-neon">{{ $safeTitle }}</span>
        <span class="text-xs text-zinc-400">{{ __('spoilers.reveal_hint') }}</span>
    </div>
@endif
