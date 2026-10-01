import { getCollection } from 'astro:content';

/** Alle gepubliceerde artikelen, nieuwste eerst. Drafts alleen zichtbaar in dev. */
export async function getArticles() {
  const articles = await getCollection('artikelen', ({ data }) => import.meta.env.DEV || !data.draft);
  return articles.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}
