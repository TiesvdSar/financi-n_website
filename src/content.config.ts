import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const artikelen = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/artikelen' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum([
      'Budgetteren',
      'Sparen',
      'Beleggen',
      'Belastingen',
      'Schulden',
      'Wonen',
      'Verzekeren',
      'Ondernemen',
      'Grote beslissingen',
      'Levensgebeurtenissen',
      'Overig',
    ]),
    /** Aangescherpte disclaimer; zonder deze waarde wordt de algemene disclaimer getoond. */
    disclaimer: z.string().optional(),
    /** Tekst van de knop bovenaan die naar de calculator op de pagina springt (anker #calculator). */
    calculator: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { artikelen };
