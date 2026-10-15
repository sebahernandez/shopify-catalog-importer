import { describe, expect, it } from 'vitest';
import { Money } from '../../shared-kernel/money/money.js';
import { buildCatalogDraft } from './build-catalog-draft.js';
import type { ImageRow } from './image-row.js';
import type { ProductRow } from './product-row.js';
import type { VariantRow } from './variant-row.js';

const product: ProductRow = {
  sourceRow: 2,
  productKey: 'P1',
  handle: 'remera',
  title: 'Remera',
  descriptionHtml: '<p>Hola</p>',
  vendor: 'Marca',
  productType: 'Ropa',
  tags: ['verano'],
};

const variant = (sourceRow: number, talla: string): VariantRow => ({
  sourceRow,
  productKey: 'P1',
  sku: `SKU-${talla}`,
  opcion1_nombre: 'Talla',
  opcion1_valor: talla,
  price: Money.parse('19.9'),
  compareAtPrice: Money.parse('25'),
  barcode: '7791234567890',
  manageInventory: true,
  stock: 4,
  location: 'Depósito',
});

const image = (sourceRow: number, order: number): ImageRow => ({
  sourceRow,
  productKey: 'P1',
  path: `fotos/${order}.jpg`,
  kind: 'local',
  order,
  alt: undefined,
  variantSku: undefined,
});

const build = (images: readonly ImageRow[] = [image(2, 1)], errorCount = 0) =>
  buildCatalogDraft(errorCount, [product], [variant(2, 'S'), variant(3, 'M')], images);

describe('buildCatalogDraft', () => {
  it('builds no draft when the report has errors', () => {
    expect(build([image(2, 1)], 1)).toBeUndefined();
  });

  it('assembles products with options, variants and images', () => {
    const [first] = build()?.products ?? [];
    expect(first).toMatchObject({ productKey: 'P1', handle: 'remera', tags: ['verano'] });
    expect(first?.options).toEqual([{ sourceRow: 2, name: 'Talla', values: ['S', 'M'] }]);
    expect(first?.variants.map(({ sku, optionValues }) => [sku, optionValues])).toEqual([
      ['SKU-S', ['S']],
      ['SKU-M', ['M']],
    ]);
    expect(first?.variants[0]?.inventory).toEqual({
      tracked: true,
      quantity: 4,
      location: 'Depósito',
    });
  });

  it('carries description, vendor, product type and the image source kind', () => {
    const [first] =
      build([{ ...image(2, 1), path: 'https://x.test/a.jpg', kind: 'url' }])?.products ?? [];
    expect(first).toMatchObject({
      descriptionHtml: '<p>Hola</p>',
      vendor: 'Marca',
      productType: 'Ropa',
    });
    expect(first?.images[0]).toMatchObject({ path: 'https://x.test/a.jpg', kind: 'url' });
  });

  it('keeps prices as Money', () => {
    const [first] = build()?.products[0]?.variants ?? [];
    expect(first?.price).toBeInstanceOf(Money);
    expect(first?.compareAtPrice?.toString()).toBe('25');
  });

  it('carries sourceRow on every element', () => {
    const [first] = build([image(7, 1)])?.products ?? [];
    expect(first?.sourceRow).toBe(2);
    expect(first?.variants.map(({ sourceRow }) => sourceRow)).toEqual([2, 3]);
    expect(first?.images.map(({ sourceRow }) => sourceRow)).toEqual([7]);
  });

  it('makes the lowest order the cover regardless of row order', () => {
    const [first] = build([image(2, 3), image(3, 1), image(4, 2)])?.products ?? [];
    expect(first?.images.map(({ position }) => position)).toEqual([1, 2, 3]);
    expect(first?.images.map(({ cover }) => cover)).toEqual([true, false, false]);
    expect(first?.images[0]?.sourceRow).toBe(3);
  });
});
