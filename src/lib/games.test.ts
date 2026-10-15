import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getGames,
    getAllCategories,
    getAllPublishers,
    type GameFilters,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    describe('filtering', () => {
        let categoryIds: Record<string, number>;
        let publisherIds: Record<string, number>;

        beforeEach(async () => {
            const cats = await db
                .insert(categories)
                .values([
                    { name: 'Strategy', description: 'c' },
                    { name: 'Puzzle', description: 'c' },
                    { name: 'Racing', description: 'c' },
                ])
                .returning({ id: categories.id, name: categories.name });
            const pubs = await db
                .insert(publishers)
                .values([
                    { name: 'Alpha Studios', description: 'p' },
                    { name: 'Beta Games', description: 'p' },
                ])
                .returning({ id: publishers.id, name: publishers.name });
            categoryIds = Object.fromEntries(cats.map((c) => [c.name, c.id]));
            publisherIds = Object.fromEntries(pubs.map((p) => [p.name, p.id]));

            await db.insert(games).values([
                { title: 'A', description: 'd', categoryId: categoryIds.Strategy, publisherId: publisherIds['Alpha Studios'] },
                { title: 'B', description: 'd', categoryId: categoryIds.Puzzle, publisherId: publisherIds['Alpha Studios'] },
                { title: 'C', description: 'd', categoryId: categoryIds.Puzzle, publisherId: publisherIds['Beta Games'] },
                { title: 'D', description: 'd', categoryId: categoryIds.Racing, publisherId: publisherIds['Beta Games'] },
            ]);
        });

        /**
         * Returns the titles of games matching the given filters.
         *
         * @param filters - Optional category/publisher filters.
         * @returns Matching game titles in title order.
         */
        const titles = async (filters?: GameFilters): Promise<string[]> =>
            (await getGames(db, filters)).map((g) => g.title);

        it('returns all games when no filters are given', async () => {
            expect(await titles()).toEqual(['A', 'B', 'C', 'D']);
            expect(await titles({ categoryIds: [] })).toEqual(['A', 'B', 'C', 'D']);
        });

        it('filters by a single category', async () => {
            expect(await titles({ categoryIds: [categoryIds.Puzzle] })).toEqual(['B', 'C']);
        });

        it('matches any of multiple categories', async () => {
            expect(
                await titles({ categoryIds: [categoryIds.Strategy, categoryIds.Racing] }),
            ).toEqual(['A', 'D']);
        });

        it('filters by publisher', async () => {
            expect(await titles({ publisherId: publisherIds['Beta Games'] })).toEqual(['C', 'D']);
        });

        it('combines category and publisher filters', async () => {
            expect(
                await titles({
                    categoryIds: [categoryIds.Puzzle],
                    publisherId: publisherIds['Beta Games'],
                }),
            ).toEqual(['C']);
        });

        it('returns an empty list when nothing matches', async () => {
            expect(
                await titles({
                    categoryIds: [categoryIds.Racing],
                    publisherId: publisherIds['Alpha Studios'],
                }),
            ).toEqual([]);
        });

        it('lists categories and publishers ordered by name', async () => {
            expect((await getAllCategories(db)).map((c) => c.name)).toEqual(['Puzzle', 'Racing', 'Strategy']);
            expect((await getAllPublishers(db)).map((p) => p.name)).toEqual(['Alpha Studios', 'Beta Games']);
        });
    });
});
