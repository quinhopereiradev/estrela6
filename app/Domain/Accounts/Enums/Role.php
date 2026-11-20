<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Enums;

enum Role: string
{
    case Member = 'member';
    case Editor = 'editor';
    case Moderator = 'moderator';
    case Admin = 'admin';

    public function canAccessPanel(): bool
    {
        return $this !== self::Member;
    }

    public function label(): string
    {
        return match ($this) {
            self::Member => __('roles.member'),
            self::Editor => __('roles.editor'),
            self::Moderator => __('roles.moderator'),
            self::Admin => __('roles.admin'),
        };
    }
}
