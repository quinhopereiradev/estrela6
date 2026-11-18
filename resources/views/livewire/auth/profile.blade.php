<div class="mx-auto max-w-md px-4 py-24">
    <div class="glass-card p-6">
        <h1 class="mb-4 font-display text-3xl uppercase text-white">{{ __('auth.profile.title') }}</h1>

        <div class="mb-6 flex items-center gap-3">
            @if ($avatar = auth()->user()->avatar_url)
                <img src="{{ $avatar }}" alt="" class="h-14 w-14 rounded-full border border-pink-500/40">
            @endif
            <div>
                <p class="font-display text-xl uppercase text-white">{{ '@'.auth()->user()->name }}</p>
                <p class="font-mono text-xs text-zinc-500">
                    {{ __('auth.profile.joined_at', ['date' => auth()->user()->created_at->translatedFormat('d \d\e F \d\e Y')]) }}
                </p>
            </div>
        </div>

        @if (session('status'))
            <p class="mb-4 font-mono text-xs text-cyber">{{ session('status') }}</p>
        @endif

        <form wire:submit="save" class="space-y-3">
            <label class="block">
                <span class="field-label">{{ __('auth.profile.nickname') }}</span>
                <input type="text" wire:model="nickname" maxlength="20" class="field" autocomplete="off">
                @error('nickname')
                    <span class="mb-2 block text-[11px] text-neon">{{ $message }}</span>
                @enderror
            </label>

            <label class="flex items-start gap-2 text-sm text-zinc-300">
                <input type="checkbox" wire:model="citeName" class="mt-1">
                {{ __('auth.cite_name') }}
            </label>

            <button type="submit" class="btn-neon">{{ __('auth.profile.save') }}</button>
        </form>

        <div class="mt-8 border-t border-zinc-800 pt-6">
            <button
                type="button"
                wire:click="deleteAccount"
                wire:confirm="{{ __('auth.profile.delete_confirm_body') }}"
                class="font-mono text-xs text-neon underline"
            >
                {{ __('auth.profile.delete_account') }}
            </button>
        </div>
    </div>
</div>
