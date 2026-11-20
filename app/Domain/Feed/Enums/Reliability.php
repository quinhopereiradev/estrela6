<?php

declare(strict_types=1);

namespace App\Domain\Feed\Enums;

enum Reliability: string
{
    case Oficial = 'oficial';
    case Comunidade = 'comunidade';
    case Rumor = 'rumor';
    case NaoVerificado = 'nao-verificado';

    public function label(): string
    {
        return match ($this) {
            self::Oficial => __('feed.reliability.oficial'),
            self::Comunidade => __('feed.reliability.comunidade'),
            self::Rumor => __('feed.reliability.rumor'),
            self::NaoVerificado => __('feed.reliability.nao-verificado'),
        };
    }
}
