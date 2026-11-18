<?php

namespace App\Services\LeonidaMap;

use App\Models\MapLandmark;

/** Compara o resultado do pipeline com o banco e monta o resumo para revisão. */
class Differ
{
    public function __construct(private float $movedThreshold = 25) {}

    /** @param array $rows linhas do pipeline: [id, nome, distrito, área, x, y, real, tipo, flags, tier, região] */
    public function diff(array $rows): array
    {
        $db = MapLandmark::query()->get()->keyBy('source_id');
        $seen = [];
        $new = $moved = $renamed = $retyped = $reactivated = [];

        foreach ($rows as $r) {
            [$id, $name, , , $x, $y, , $type] = $r;
            $seen[$id] = true;
            $cur = $db->get($id);
            if (! $cur) {
                $new[] = "$id · $name";
                continue;
            }
            if (! $cur->is_active) {
                $reactivated[] = "$id · $name";
            }
            $d = hypot($cur->x - $x, $cur->y - $y);
            if ($d > $this->movedThreshold) {
                $moved[] = sprintf('%s · %s (%d m)', $id, $name, round($d));
            }
            if ($cur->name !== $name) {
                $renamed[] = "$id · {$cur->name} → $name";
            }
            if ($cur->type !== $type) {
                $retyped[] = "$id · $name: {$cur->type} → $type";
            }
        }

        $removed = $db->filter(fn ($l) => $l->is_active && ! isset($seen[$l->source_id]))
            ->map(fn ($l) => "{$l->source_id} · {$l->name}")->values()->all();

        $sample = fn (array $a) => array_slice($a, 0, 25);

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
