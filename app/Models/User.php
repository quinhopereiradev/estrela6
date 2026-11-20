<?php

declare(strict_types=1);

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Domain\Accounts\Enums\Role;
use Database\Factories\UserFactory;
use Filament\Auth\MultiFactor\App\Contracts\HasAppAuthentication;
use Filament\Auth\MultiFactor\App\Contracts\HasAppAuthenticationRecovery;
use Filament\Auth\MultiFactor\Email\Contracts\HasEmailAuthentication;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use SensitiveParameter;

/**
 * @property array<string>|null $app_authentication_recovery_codes
 * @property Carbon|null $age_confirmed_at
 * @property Carbon|null $terms_accepted_at
 * @property array<string, bool>|null $spoiler_overrides
 * @property Role $role
 */
#[Fillable(['name', 'email', 'password', 'cite_name', 'spoiler_preset', 'spoiler_overrides', 'mod_safe_mode'])]
#[Hidden(['password', 'remember_token', 'app_authentication_secret', 'app_authentication_recovery_codes'])]
class User extends Authenticatable implements FilamentUser, HasAppAuthentication, HasAppAuthenticationRecovery, HasEmailAuthentication
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    public function canAccessPanel(Panel $panel): bool
    {
        return $this->role->canAccessPanel();
    }

    public function getAppAuthenticationSecret(): ?string
    {
        return $this->app_authentication_secret;
    }

    public function saveAppAuthenticationSecret(#[SensitiveParameter] ?string $secret): void
    {
        $this->app_authentication_secret = $secret;
        $this->save();
    }

    public function getAppAuthenticationHolderName(): string
    {
        return $this->email ?? $this->name;
    }

    public function getAppAuthenticationRecoveryCodes(): ?array
    {
        return $this->app_authentication_recovery_codes;
    }

    public function saveAppAuthenticationRecoveryCodes(#[SensitiveParameter] ?array $codes): void
    {
        $this->app_authentication_recovery_codes = $codes;
        $this->save();
    }

    public function hasEmailAuthentication(): bool
    {
        return $this->has_email_authentication;
    }

    public function toggleEmailAuthentication(bool $condition): void
    {
        $this->has_email_authentication = $condition;
        $this->save();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'mod_safe_mode' => 'boolean',
            'app_authentication_secret' => 'encrypted',
            'app_authentication_recovery_codes' => 'encrypted:array',
            'has_email_authentication' => 'boolean',
            'age_confirmed_at' => 'datetime',
            'terms_accepted_at' => 'datetime',
            'cite_name' => 'boolean',
            'spoiler_overrides' => 'array',
        ];
    }
}
