<?php

declare(strict_types=1);

namespace App\Filament\Resources\Posts\Tables;

use App\Domain\Feed\Enums\PostCategory;
use App\Domain\Feed\Enums\PostStatus;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Actions\ForceDeleteBulkAction;
use Filament\Actions\RestoreBulkAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TrashedFilter;
use Filament\Tables\Table;

class PostsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('title')
                    ->label('Título')
                    ->searchable()
                    ->limit(50),
                TextColumn::make('category')
                    ->label('Categoria')
                    ->formatStateUsing(fn (PostCategory $state): string => $state->label())
                    ->badge(),
                TextColumn::make('status')
                    ->label('Status')
                    ->formatStateUsing(fn (PostStatus $state): string => $state->label())
                    ->badge()
                    ->color(fn (PostStatus $state): string => match ($state) {
                        PostStatus::Published => 'success',
                        PostStatus::Pending => 'warning',
                        PostStatus::Rejected => 'danger',
                        PostStatus::Draft => 'gray',
                    }),
                TextColumn::make('author.name')
                    ->label('Autor')
                    ->placeholder('Equipe'),
                TextColumn::make('published_at')
                    ->label('Publicado em')
                    ->dateTime('d/m/Y H:i')
                    ->sortable(),
                TextColumn::make('created_at')
                    ->label('Criado em')
                    ->dateTime('d/m/Y H:i')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('created_at', 'desc')
            ->filters([
                SelectFilter::make('status')
                    ->label('Status')
                    ->options(fn (): array => collect(PostStatus::cases())->mapWithKeys(fn (PostStatus $case): array => [$case->value => $case->label()])->all()),
                SelectFilter::make('category')
                    ->label('Categoria')
                    ->options(fn (): array => collect(PostCategory::cases())->mapWithKeys(fn (PostCategory $case): array => [$case->value => $case->label()])->all()),
                TrashedFilter::make(),
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                    ForceDeleteBulkAction::make(),
                    RestoreBulkAction::make(),
                ]),
            ]);
    }
}
