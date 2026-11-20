<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Domain\Accounts\Enums\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->userName(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            'role' => Role::Member,
            'mod_safe_mode' => true,
            'has_email_authentication' => false,
            'cite_name' => true,
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes): array => [
            'email_verified_at' => null,
        ]);
    }

    /**
     * Indicate that the model has the given role.
     */
    public function role(Role $role): static
    {
        return $this->state(fn (array $attributes): array => [
            'role' => $role,
        ]);
    }

    /**
     * Indicate that the model can access the admin panel as an administrator.
     */
    public function admin(): static
    {
        return $this->role(Role::Admin);
    }
}
