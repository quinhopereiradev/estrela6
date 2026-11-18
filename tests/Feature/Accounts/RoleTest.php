<?php

declare(strict_types=1);

use App\Domain\Accounts\Enums\Role;

test('only member cannot access the admin panel', function (): void {
    expect(Role::Member->canAccessPanel())->toBeFalse()
        ->and(Role::Editor->canAccessPanel())->toBeTrue()
        ->and(Role::Moderator->canAccessPanel())->toBeTrue()
        ->and(Role::Admin->canAccessPanel())->toBeTrue();
});
