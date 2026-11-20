<?php

declare(strict_types=1);

namespace App\Domain\Spoilers;

use App\Domain\Spoilers\Data\SpoilerPreference;
use App\Domain\Spoilers\Enums\SpoilerPreset;
use App\Models\User;
use Illuminate\Support\Facades\Request;

final class SpoilerPreferenceResolver
{
    public const string COOKIE = 'lu_spoil';

    public function resolve(?User $viewer): SpoilerPreference
    {
        if ($viewer instanceof User) {
            return $this->fromUser($viewer);
        }

        return $this->fromCookie();
    }

    private function fromUser(User $viewer): SpoilerPreference
    {
        if ($viewer->spoiler_preset === null) {
            return SpoilerPreference::default();
        }

        return new SpoilerPreference(
            preset: SpoilerPreset::from($viewer->spoiler_preset),
            overrides: $viewer->spoiler_overrides ?? [],
            chosen: true,
        );
    }

    private function fromCookie(): SpoilerPreference
    {
        $raw = Request::cookie(self::COOKIE);

        if (! is_string($raw)) {
            return SpoilerPreference::default();
        }

        /** @var array{preset?: string, overrides?: array<string, bool>}|null $data */
        $data = json_decode($raw, true);

        if (! is_array($data) || ! isset($data['preset'])) {
            return SpoilerPreference::default();
        }

        return SpoilerPreference::fromArray($data);
    }
}
