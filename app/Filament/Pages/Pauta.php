<?php

declare(strict_types=1);

namespace App\Filament\Pages;

use App\Domain\Accounts\Enums\Role;
use App\Domain\Feed\Enums\PostStatus;
use App\Filament\Concerns\HasModSafeMode;
use App\Models\Post;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;
use UnitEnum;

class Pauta extends Page implements HasTable
{
    use HasModSafeMode;
    use InteractsWithTable;

    protected string $view = 'filament.pages.pauta';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedInboxArrowDown;

    protected static UnitEnum|string|null $navigationGroup = 'Pauta';

    protected static ?string $navigationLabel = 'Fila de aprovação';

    public static function canAccess(): bool
    {
        /** @var User|null $user */
        $user = Auth::user();

        return $user instanceof User && in_array($user->role, [Role::Admin, Role::Moderator], true);
    }

    private function hides(Post $record): bool
    {
        return $this->isSafe() && ! $this->isRevealed($record->id);
    }

    /**
     * @return array<Action>
     */
    protected function getHeaderActions(): array
    {
        return [
            Action::make('safeMode')
                ->label(fn (): string => $this->isSafe()
                    ? __('filament.safe_mode.on')
                    : __('filament.safe_mode.off'))
                ->color(fn (): string => $this->isSafe() ? 'success' : 'danger')
                ->icon(fn (): string => $this->isSafe() ? 'heroicon-o-shield-check' : 'heroicon-o-shield-exclamation')
                ->action('toggleSafeMode'),
        ];
    }

    public function table(Table $table): Table
    {
        return $table
            ->query(fn (): Builder => Post::query()->where('status', PostStatus::Pending)->latest())
            ->columns([
                TextColumn::make('created_at')
                    ->label('Recebido em')
                    ->dateTime('d/m/Y H:i'),
                TextColumn::make('origin_label')
                    ->label('Origem')
                    ->state(fn (Post $record): string => $record->author
                        ? '@'.$record->author->name
                        : $record->origin->label()),
                TextColumn::make('title')
                    ->label('Conteúdo')
                    ->wrap()
                    ->state(fn (Post $record): string => $this->hides($record)
                        ? '🛡 '.__('filament.pauta.hidden_content')
                        : $record->category->label().' — '.$record->title),
                TextColumn::make('reveal')
                    ->label('')
                    ->state(fn (Post $record): string => $this->hides($record) ? '' : $record->excerpt)
                    ->wrap()
                    ->limit(160),
            ])
            ->recordActions([
                Action::make('reveal')
                    ->label('Revelar')
                    ->icon('heroicon-o-eye')
                    ->visible(fn (Post $record): bool => $this->hides($record))
                    ->action(fn (Post $record) => $this->reveal($record->id)),
                Action::make('approve')
                    ->label('Aprovar')
                    ->icon('heroicon-o-check')
                    ->color('success')
                    ->requiresConfirmation()
                    ->action(function (Post $record): void {
                        $record->update([
                            'status' => PostStatus::Published,
                            'published_at' => now(),
                        ]);

                        Notification::make()->title(__('filament.pauta.approved'))->success()->send();
                    }),
                Action::make('reject')
                    ->label('Recusar')
                    ->icon('heroicon-o-x-mark')
                    ->color('danger')
                    ->schema([
                        Textarea::make('reason')
                            ->label('Motivo da recusa')
                            ->required(),
                    ])
                    ->action(function (Post $record, array $data): void {
                        $record->update([
                            'status' => PostStatus::Rejected,
                            'reject_reason' => $data['reason'],
                        ]);

                        Notification::make()->title(__('filament.pauta.rejected'))->success()->send();
                    }),
            ]);
    }

    public function getTitle(): string
    {
        return 'Pauta';
    }

    public static function getNavigationLabel(): string
    {
        return 'Pauta';
    }
}
