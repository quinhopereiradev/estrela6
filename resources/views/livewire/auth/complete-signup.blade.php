<div class="mx-auto max-w-md px-4 py-24">
    <div class="glass-card p-6">
        <p class="font-mono text-[10px] tracking-[0.3em] text-sunset">// {{ __('auth.eyebrow') }}</p>
        <h1 class="mb-1 font-display text-3xl uppercase text-white">{{ __('auth.complete_signup_title') }}</h1>

        <form wire:submit="save" class="mt-3 space-y-3">
            <label class="block">
                <span class="field-label">{{ __('auth.nickname') }}</span>
                <input type="text" wire:model="nickname" maxlength="20" class="field" autocomplete="off">
                @error('nickname')
                    <span class="mb-2 block text-[11px] text-neon">{{ $message }}</span>
                @else
                    <span class="mb-2 block text-[11px] text-zinc-500">{{ __('auth.nickname_hint') }}</span>
                @enderror
            </label>

            <label class="flex items-start gap-2 text-sm text-zinc-300">
                <input type="checkbox" wire:model="age" class="mt-1">
                {{ __('auth.confirm_age') }}
            </label>
            @error('age')
                <span class="block text-[11px] text-neon">{{ $message }}</span>
            @enderror

            <label class="flex items-start gap-2 text-sm text-zinc-300">
                <input type="checkbox" wire:model="terms" class="mt-1">
                {{ __('auth.accept_terms') }}
            </label>
            @error('terms')
                <span class="block text-[11px] text-neon">{{ $message }}</span>
            @enderror

            <label class="flex items-start gap-2 text-sm text-zinc-300">
                <input type="checkbox" wire:model="citeName" class="mt-1">
                {{ __('auth.cite_name') }}
            </label>

            <button type="submit" class="btn-neon mt-2 w-full">{{ __('auth.create_profile') }}</button>
        </form>
    </div>
</div>
