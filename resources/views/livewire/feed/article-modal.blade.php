<div x-data @keydown.window.escape="$wire.closeModal()">
    @if ($open)
    <div
        class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        wire:click="closeModal"
    >
        <div wire:click.stop class="glass-card relative max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6" role="dialog" aria-modal="true" aria-label="{{ __('feed.article.title') }}">
            <button type="button" wire:click="closeModal" class="icon-btn absolute right-3 top-3" aria-label="{{ __('spoilers.modal.cancel') }}">✕</button>

        @if ($submitted)
            <p class="font-mono text-[11px] tracking-[0.3em] text-cyber">// {{ __('feed.article.eyebrow') }}</p>
            <h3 class="mb-3 font-display text-3xl uppercase text-white">{{ __('feed.article.title') }}</h3>
            <p class="mb-6 text-sm text-zinc-300">{{ __('feed.article.submitted') }}</p>
            <button type="button" wire:click="closeModal" class="btn-neon w-full">{{ __('feed.article.cancel') }}</button>
        @else
            <form wire:submit="submit">
            <p class="font-mono text-[11px] tracking-[0.3em] text-sunset">// {{ __('feed.article.eyebrow') }}</p>
            <h3 class="mb-1 font-display text-3xl uppercase text-white">{{ __('feed.article.title') }}</h3>
            <p class="mb-4 text-sm text-zinc-400">{{ __('feed.article.intro') }}</p>

            <label class="field-label" for="a-title">{{ __('feed.article.title_label') }}</label>
            <input id="a-title" wire:model="title" maxlength="110" class="field" placeholder="{{ __('feed.article.title_placeholder') }}">
            @error('title') <span class="-mt-3 mb-3 block text-[11px] text-neon">{{ $message }}</span> @enderror

            <div class="grid gap-3 sm:grid-cols-2">
                <div>
                    <label class="field-label" for="a-cat">{{ __('feed.article.category_label') }}</label>
                    <select id="a-cat" wire:model="category" class="field">
                        <option value="">—</option>
                        @foreach (\App\Domain\Feed\Enums\PostCategory::cases() as $case)
                            <option value="{{ $case->value }}">{{ $case->label() }}</option>
                        @endforeach
                    </select>
                    @error('category') <span class="-mt-3 mb-3 block text-[11px] text-neon">{{ $message }}</span> @enderror
                </div>
                <div>
                    <label class="field-label" for="a-sp">{{ __('feed.article.spoiler_label') }}</label>
                    <select id="a-sp" wire:model="spoilerType" class="field">
                        <option value="">{{ __('feed.article.spoiler_none') }}</option>
                        @foreach ([\App\Domain\Spoilers\Enums\SpoilerType::Historia, \App\Domain\Spoilers\Enums\SpoilerType::Easter] as $type)
                            <option value="{{ $type->value }}">{{ $type->label() }}</option>
                        @endforeach
                    </select>
                </div>
            </div>

            <label class="field-label mt-3 block" for="a-exc">{{ __('feed.article.excerpt_label') }}</label>
            <textarea id="a-exc" wire:model="excerpt" maxlength="220" class="field min-h-[60px]" placeholder="{{ __('feed.article.excerpt_placeholder') }}"></textarea>
            @error('excerpt') <span class="-mt-3 mb-3 block text-[11px] text-neon">{{ $message }}</span> @enderror

            <label class="field-label" for="a-txt">{{ __('feed.article.content_label') }}</label>
            <textarea id="a-txt" wire:model="content" class="field min-h-[160px]" placeholder="{{ __('feed.article.content_placeholder') }}"></textarea>
            @error('content') <span class="-mt-3 mb-3 block text-[11px] text-neon">{{ $message }}</span> @enderror

            <label class="field-label" for="a-src">{{ $category === \App\Domain\Feed\Enums\PostCategory::Noticia->value ? __('feed.article.source_required') : __('feed.article.source_optional') }}</label>
            <input id="a-src" wire:model="sourceUrl" class="field" placeholder="https://...">
            @error('sourceUrl') <span class="-mt-3 mb-3 block text-[11px] text-neon">{{ $message }}</span> @enderror

            <label class="field-label" for="a-cover">{{ __('feed.article.cover_label') }}</label>
            <input id="a-cover" type="file" wire:model="cover" accept="image/*" class="field file:mr-3 file:rounded file:border-0 file:bg-neon/20 file:px-3 file:py-1 file:font-mono file:text-xs file:text-neon">
            @error('cover') <span class="-mt-3 mb-3 block text-[11px] text-neon">{{ $message }}</span> @enderror

            <label class="mb-3 flex items-start gap-2 text-sm text-zinc-300">
                <input type="checkbox" wire:model="own" class="mt-1">
                {{ __('feed.article.own_label') }}
            </label>
            @error('own') <span class="-mt-3 mb-3 block text-[11px] text-neon">{{ $message }}</span> @enderror

            <div class="flex gap-2">
                <button type="button" wire:click="closeModal" class="btn-ghost flex-1">{{ __('feed.article.cancel') }}</button>
                <button type="submit" class="btn-neon flex-1" wire:loading.attr="disabled" wire:target="submit">{{ __('feed.article.submit') }}</button>
            </div>
            </form>
        @endif
        </div>
    </div>
    @endif
</div>
