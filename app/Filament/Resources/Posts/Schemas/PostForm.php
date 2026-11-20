<?php

declare(strict_types=1);

namespace App\Filament\Resources\Posts\Schemas;

use App\Domain\Feed\Actions\ProcessUploadedCoverImage;
use App\Domain\Feed\Enums\PostCategory;
use App\Domain\Feed\Enums\PostOrigin;
use App\Domain\Feed\Enums\PostStatus;
use App\Domain\Feed\Enums\Reliability;
use App\Domain\Spoilers\Enums\SpoilerType;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Hidden;
use Filament\Forms\Components\MarkdownEditor;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class PostForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Conteúdo')
                    ->columns(2)
                    ->schema([
                        TextInput::make('title')
                            ->label('Título')
                            ->required()
                            ->live(onBlur: true)
                            ->afterStateUpdated(fn (string $state, callable $set) => $set('slug', Str::slug($state)))
                            ->columnSpanFull(),
                        TextInput::make('slug')
                            ->required()
                            ->unique(ignoreRecord: true)
                            ->columnSpanFull(),
                        Textarea::make('excerpt')
                            ->label('Resumo')
                            ->required()
                            ->rows(2)
                            ->columnSpanFull(),
                        MarkdownEditor::make('content')
                            ->label('Conteúdo')
                            ->required()
                            ->columnSpanFull(),
                        TextInput::make('headline_en')
                            ->label('Manchete (inglês, pra rádio)')
                            ->columnSpanFull(),
                    ]),

                Section::make('Classificação')
                    ->columns(2)
                    ->schema([
                        Select::make('category')
                            ->label('Categoria')
                            ->options(fn (): array => collect(PostCategory::cases())->mapWithKeys(fn (PostCategory $case): array => [$case->value => $case->label()])->all())
                            ->required(),
                        Select::make('reliability')
                            ->label('Confiabilidade')
                            ->options(fn (): array => collect(Reliability::cases())->mapWithKeys(fn (Reliability $case): array => [$case->value => $case->label()])->all())
                            ->required(),
                        TextInput::make('confidence')
                            ->label('Medidor de confiança (0–100)')
                            ->numeric()
                            ->minValue(0)
                            ->maxValue(100),
                        Select::make('spoiler_type')
                            ->label('Tipo de spoiler')
                            ->options(fn (): array => collect(SpoilerType::cases())->mapWithKeys(fn (SpoilerType $case): array => [$case->value => $case->label()])->all())
                            ->placeholder('Nenhum'),
                        Textarea::make('basis')
                            ->label('Base do selo (por que esse nível de confiabilidade)')
                            ->rows(2)
                            ->columnSpanFull(),
                    ]),

                Section::make('Fonte e mídia')
                    ->columns(2)
                    ->schema([
                        TextInput::make('source_name')
                            ->label('Nome da fonte'),
                        TextInput::make('source_url')
                            ->label('Link da fonte')
                            ->url(),
                        FileUpload::make('cover_path')
                            ->label('Capa')
                            ->image()
                            ->saveUploadedFileUsing(fn (UploadedFile $file): string => app(ProcessUploadedCoverImage::class)->handle($file))
                            ->columnSpanFull(),
                    ]),

                Section::make('Publicação')
                    ->columns(2)
                    ->schema([
                        Hidden::make('origin')
                            ->default(PostOrigin::Staff->value),
                        Select::make('status')
                            ->label('Status')
                            ->options(fn (): array => collect(PostStatus::cases())->mapWithKeys(fn (PostStatus $case): array => [$case->value => $case->label()])->all())
                            ->default(PostStatus::Draft->value)
                            ->required(),
                        DateTimePicker::make('published_at')
                            ->label('Publicado em'),
                        Select::make('author_id')
                            ->label('Autor')
                            ->relationship('author', 'name')
                            ->searchable()
                            ->preload(),
                        Textarea::make('reject_reason')
                            ->label('Motivo da recusa')
                            ->rows(2)
                            ->visible(fn (callable $get): bool => $get('status') === PostStatus::Rejected->value),
                    ]),
            ]);
    }
}
