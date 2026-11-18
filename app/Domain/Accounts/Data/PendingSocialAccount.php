<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Data;

final readonly class PendingSocialAccount
{
    public function __construct(
        public string $provider,
        public string $providerId,
        public ?string $name,
        public ?string $email,
        public ?string $avatarUrl,
    ) {}

    /**
     * @return array{provider: string, provider_id: string, name: ?string, email: ?string, avatar_url: ?string}
     */
    public function toArray(): array
    {
        return [
            'provider' => $this->provider,
            'provider_id' => $this->providerId,
            'name' => $this->name,
            'email' => $this->email,
            'avatar_url' => $this->avatarUrl,
        ];
    }

    /**
     * @param  array{provider: string, provider_id: string, name: ?string, email: ?string, avatar_url: ?string}  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            provider: $data['provider'],
            providerId: $data['provider_id'],
            name: $data['name'],
            email: $data['email'],
            avatarUrl: $data['avatar_url'],
        );
    }
}
