@php
    $presets = App\Domain\Spoilers\Enums\SpoilerPreset::cases();
    $types = App\Domain\Spoilers\Enums\SpoilerType::cases();
    $currentPreset = App\Domain\Spoilers\Enums\SpoilerPreset::from($preset);
@endphp

<div x-data @keydown.window.shift.s.prevent="$wire.toggleShield()">
    <template x-teleport="#spoiler-shield-slot">
        <button
            type="button"
            wire:click="openModal"
            class="ml-1 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10px] tracking-wider transition hover:bg-white/5"
            style="border-color: color-mix(in srgb, var(--color-neon) 50%, transparent); color: var(--color-neon)"
            title="{{ __('spoilers.shield.hint') }} (Shift+S)"
        >
            {{ $currentPreset->label() }}
        </button>
    </template>

    @if ($open)
        <div class="fixed inset-0 z-[2700] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" wire:click="closeModal">
            <div class="glass-card relative max-h-[92vh] w-full max-w-3xl overflow-y-auto p-6" wire:click.stop role="dialog" aria-modal="true" aria-label="{{ __('spoilers.modal.title') }}">
                @unless ($firstTime)
                    <button type="button" wire:click="closeModal" class="icon-btn absolute right-3 top-3" aria-label="{{ __('auth.profile.cancel') }}">✕</button>
                @endunless

                <p class="font-mono text-[10px] tracking-[0.3em] text-sunset">
                    {{ $firstTime ? __('spoilers.modal.eyebrow_first_time') : __('spoilers.modal.eyebrow_preferences') }}
                </p>
                <h2 class="font-display text-3xl uppercase leading-none text-white md:text-4xl">{{ __('spoilers.modal.title') }}</h2>
                <p class="mt-3 text-sm text-zinc-300">{{ __('spoilers.modal.intro') }}</p>

                <div class="mt-5 grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="{{ __('spoilers.modal.title') }}">
                    @foreach ($presets as $p)
                        <button
                            type="button"
                            wire:click="selectPreset('{{ $p->value }}')"
                            role="radio"
                            aria-checked="{{ $preset === $p->value ? 'true' : 'false' }}"
                            @class([
                                'rounded-xl border p-4 text-left transition',
                                'border-neon bg-white/5' => $preset === $p->value,
                                'border-zinc-700 hover:border-zinc-500' => $preset !== $p->value,
                            ])
                        >
                            <span class="font-mono text-[10px] tracking-widest text-cyber">{{ __('spoilers.presets.'.$p->value.'.tag') }}</span>
                            <span class="mt-0.5 block font-display text-2xl uppercase text-white">{{ $p->label() }}</span>
                            <span class="mt-1 block text-xs text-zinc-400">{{ $p->description() }}</span>
                        </button>
                    @endforeach
                </div>

                <details class="mt-5 rounded-xl border border-zinc-800 bg-black/40 p-4">
                    <summary class="cursor-pointer font-mono text-xs tracking-widest text-zinc-300">PERSONALIZAR</summary>
                    <div class="mt-3 grid gap-3 sm:grid-cols-2">
                        @foreach ($types as $type)
                            <label class="flex cursor-pointer items-start gap-3">
                                <input
                                    type="checkbox"
                                    wire:click="toggleOverride('{{ $type->value }}')"
                                    @checked($overrides[$type->value] ?? $currentPreset->baseHides()[$type->value])
                                    class="mt-1"
                                >
                                <span>
                                    <span class="block text-sm text-white">{{ __('spoilers.types.'.$type->value.'.label') }}</span>
                                    <span class="block text-xs text-zinc-500">{{ __('spoilers.types.'.$type->value.'.hint') }}</span>
                                </span>
                            </label>
                        @endforeach
                    </div>
                </details>

                <div class="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-violet-400/30 bg-violet-500/5 p-4 sm:flex-row sm:items-center">
                    <div>
                        <p class="text-sm font-semibold text-white">{{ __('spoilers.shield.label') }}</p>
                        <p class="text-xs text-zinc-400">{{ __('spoilers.shield.hint') }} <span class="kbd">Shift</span> + <span class="kbd">S</span></p>
                    </div>
                    <button
                        type="button"
                        wire:click="toggleShield"
                        @class([
                            'shrink-0 rounded-lg border px-3 py-2 font-mono text-xs',
                            'border-neon bg-neon/20 text-white' => $shieldOn,
                            'border-zinc-600 text-zinc-300' => ! $shieldOn,
                        ])
                    >
                        {{ $shieldOn ? __('spoilers.shield.on') : __('spoilers.shield.off') }}
                    </button>
                </div>

                <div class="mt-5 flex justify-end gap-2">
                    @unless ($firstTime)
                        <button type="button" wire:click="closeModal" class="btn-ghost">{{ __('spoilers.modal.cancel') }}</button>
                    @endunless
                    <button type="button" wire:click="save" class="btn-neon">
                        {{ $firstTime ? __('spoilers.modal.enter') : __('spoilers.modal.save') }}
                    </button>
                </div>
            </div>
        </div>
    @endif
</div>
