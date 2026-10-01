import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const artikelen = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/artikelen' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum(['Budgetteren', 'Sparen', 'Beleggen', 'Belastingen', 'Schulden', 'Overig']),
    draft: z.boolean().default(false),
  }),
});

export const collections = { artikelen };
