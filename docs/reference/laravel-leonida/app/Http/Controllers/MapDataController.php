<?php

namespace App\Http\Controllers;

use App\Models\MapLandmark;
use App\Models\MapRegion;
use App\Models\MapSyncRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/** Dados que o mapa (Leaflet) carrega. Cache invalidado a cada publicação. */
class MapDataController extends Controller
{
    public function landmarks(): JsonResponse
    {
        $rows = Cache::rememberForever('leonida.map.landmarks', fn () => MapLandmark::active()->with('override')->get()
            ->map->toMapRow()->filter()->values()->all());

        return response()->json($rows)->header('Cache-Control', 'public, max-age=300');
    }

    public function regions(): JsonResponse
    {
        $rows = Cache::rememberForever('leonida.map.regions', fn () => MapRegion::all()->map(fn ($r) => [
            'id' => $r->id, 'name' => $r->name, 'station' => $r->station, 'color' => $r->color,
            'label' => [$r->label_x, $r->label_y], 'polys' => $r->polygons,
        ])->values()->all());

        return response()->json($rows)->header('Cache-Control', 'public, max-age=300');
    }

    /** Versão de tiles em uso: o front monta 'storage/map/tiles/v{N}/{z}/{x}_{y}.jpg'. */
    public function meta(): JsonResponse
    {
        $run = MapSyncRun::current();

        return response()->json([
            'tiles_url' => asset('storage/map/tiles/v' . MapSyncRun::currentTilesVersion() . '/{z}/{x}_{y}.jpg'),
            'source_sha' => $run?->landmarks_sha,
            'updated_at' => $run?->published_at,
            'credit' => 'Mapa: Yanis GTA VI Community Map via GTADB.org · Locais: GTADB.org e colaboradores · CC BY 4.0',
        ]);
    }
}
