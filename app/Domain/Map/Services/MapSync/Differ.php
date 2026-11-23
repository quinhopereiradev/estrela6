<?php

declare(strict_types=1);

namespace App\Domain\Map\Services\MapSync;

use App\Models\MapLandmark;

/** Compara o resultado do pipeline com o banco e monta o resumo para revisão. */
final readonly class Differ
{
    public function __construct(private float $movedThreshold = 25.0) {}

    /**
     * @param  array<int, array<int, mixed>>  $rows  linhas do pipeline: [id, nome, distrito, área, x, y, real, tipo, flags, tier, região]
     * @return array{counts: array<string, int>, exemplos: array<string, array<int, string>>}
     */
    public function diff(array $rows): array
    {
        $db = MapLandmark::query()->get()->keyBy('source_id');
        $seen = [];
        $new = $moved = $renamed = $retyped = $reactivated = [];

        foreach ($rows as $row) {
            [$id, $name, , , $x, $y, , $type] = $row;
            $seen[$id] = true;
            $current = $db->get($id);
            if (! $current) {
                $new[] = "$id · $name";

                continue;
            }
            if (! $current->is_active) {
                $reactivated[] = "$id · $name";
            }
            $distance = hypot($current->x - $x, $current->y - $y);
            if ($distance > $this->movedThreshold) {
                $moved[] = sprintf('%s · %s (%d m)', $id, $name, round($distance));
            }
            if ($current->name !== $name) {
                $renamed[] = "$id · {$current->name} → $name";
            }
            if ($current->type !== $type) {
                $retyped[] = "$id · $name: {$current->type} → $type";
            }
        }

        $removed = $db->filter(fn (MapLandmark $landmark): bool => $landmark->is_active && ! isset($seen[$landmark->source_id]))
            ->map(fn (MapLandmark $landmark): string => "{$landmark->source_id} · {$landmark->name}")->values()->all();

        $sample = fn (array $items): array => array_slice($items, 0, 25);

        return [
            'counts' => [
                'total' => count($rows),
                'novos' => count($new),
                'movidos' => count($moved),
                'renomeados' => count($renamed),
                'tipo_alterado' => count($retyped),
                'removidos' => count($removed),
                'reativados' => count($reactivated),
            ],
            'exemplos' => [
                'novos' => $sample($new),
                'movidos' => $sample($moved),
                'renomeados' => $sample($renamed),
                'tipo_alterado' => $sample($retyped),
                'removidos' => $sample($removed),
                'reativados' => $sample($reactivated),
            ],
        ];
    }
}
