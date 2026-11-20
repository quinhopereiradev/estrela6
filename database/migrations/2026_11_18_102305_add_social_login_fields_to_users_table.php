<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('provider')->nullable()->after('password');
            $table->string('provider_id')->nullable()->after('provider');
            $table->string('avatar_url')->nullable()->after('provider_id');
            $table->timestamp('age_confirmed_at')->nullable()->after('avatar_url');
            $table->timestamp('terms_accepted_at')->nullable()->after('age_confirmed_at');
            $table->boolean('cite_name')->default(true)->after('terms_accepted_at');

            $table->unique(['provider', 'provider_id']);
            $table->unique('name');
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->string('email')->nullable()->change();
            $table->string('password')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique(['name']);
            $table->dropUnique(['provider', 'provider_id']);
            $table->dropColumn([
                'provider',
                'provider_id',
                'avatar_url',
                'age_confirmed_at',
                'terms_accepted_at',
                'cite_name',
            ]);
        });
    }
};
