import { faker } from '@faker-js/faker/locale/pt_BR';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ingredients = [
  { slug: 'lavanda', name: 'Óleo essencial de lavanda', benefit: 'Relaxante' },
  { slug: 'argila-verde', name: 'Argila verde', benefit: 'Pele oleosa' },
  { slug: 'manteiga-karite', name: 'Manteiga de karité', benefit: 'Pele seca' },
  { slug: 'aveia', name: 'Aveia', benefit: 'Pele sensível' },
  { slug: 'mel', name: 'Mel', benefit: 'Hidratante' },
  { slug: 'calendula', name: 'Calêndula', benefit: 'Pele sensível' },
];

const products = [
  {
    name: 'Sabonete de Lavanda',
    aroma: 'Floral',
    price: 1800,
    ing: ['lavanda', 'manteiga-karite'],
  },
  { name: 'Sabonete de Argila Verde', aroma: 'Herbal', price: 2200, ing: ['argila-verde'] },
  { name: 'Sabonete de Aveia e Mel', aroma: 'Adocicado', price: 1900, ing: ['aveia', 'mel'] },
  { name: 'Sabonete de Calêndula', aroma: 'Herbal', price: 2000, ing: ['calendula', 'aveia'] },
  { name: 'Sabonete de Karité', aroma: 'Neutro', price: 2100, ing: ['manteiga-karite'] },
  { name: 'Sabonete de Mel', aroma: 'Adocicado', price: 1700, ing: ['mel'] },
];

const slugify = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

async function main(): Promise<void> {
  faker.seed(42);
  for (const ing of ingredients) {
    await prisma.ingredient.upsert({ where: { slug: ing.slug }, update: ing, create: ing });
  }
  const all = await prisma.ingredient.findMany();
  for (const [i, p] of products.entries()) {
    const slug = slugify(p.name);
    const data = {
      slug,
      name: p.name,
      description: faker.lorem.sentences(2),
      usage: 'Use no banho, espumando entre as mãos. Mantenha em saboneteira com escoamento.',
      aroma: p.aroma,
      priceCents: p.price,
      weightGrams: 100,
      stock: i === 5 ? 0 : faker.number.int({ min: 2, max: 20 }),
      images: [`/img/sabonete-${(i % 3) + 1}.svg`],
    };
    const product = await prisma.product.upsert({ where: { slug }, update: data, create: data });
    await prisma.productIngredient.deleteMany({ where: { productId: product.id } });
    await prisma.productIngredient.createMany({
      data: p.ing.map((s) => ({
        productId: product.id,
        ingredientId: all.find((a) => a.slug === s)!.id,
      })),
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
