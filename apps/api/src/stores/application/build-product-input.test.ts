import { describe, expect, it } from 'vitest';
import { Money } from '../../shared-kernel/money/money.js';
import { draftImage, draftProduct, draftVariant } from '../test-support/import-draft-builders.js';
import {
  buildProductInput,
  MAX_IMAGES,
  MAX_VARIANTS,
  needsLocation,
} from './build-product-input.js';
import { createLocationResolver } from './import-location-resolver.js';

const resolver = createLocationResolver(
  [{ id: 'gid://shopify/Location/1', name: 'Main', isActive: true, fulfillsOnlineOrders: true }],
  false,
);

const built = (product = draftProduct('P1')) => {
  const result = buildProductInput(product, resolver);
  if (!result.ok) throw new Error(`unexpected failure ${result.code}`);
  return result;
};

describe('buildProductInput', () => {
  it('gives a product without options Shopify default option and value', () => {
    const { input } = built();
    expect(input.options).toEqual([{ name: 'Title', values: ['Default Title'] }]);
    expect(input.variants[0]?.optionValues).toEqual([
      { optionName: 'Title', name: 'Default Title' },
    ]);
  });

  it('maps options and each variant value in option order', () => {
    const { input } = built(
      draftProduct('P1', {
        options: [
          { name: 'Talla', values: ['S', 'M'] },
          { name: 'Color', values: ['Rojo'] },
        ],
        variants: [draftVariant('A', {}, ['S', 'Rojo']), draftVariant('B', {}, ['M', 'Rojo'])],
      }),
    );
    expect(input.options).toEqual([
      { name: 'Talla', values: ['S', 'M'] },
      { name: 'Color', values: ['Rojo'] },
    ]);
    expect(input.variants.map(({ optionValues }) => optionValues)).toEqual([
      [
        { optionName: 'Talla', name: 'S' },
        { optionName: 'Color', name: 'Rojo' },
      ],
      [
        { optionName: 'Talla', name: 'M' },
        { optionName: 'Color', name: 'Rojo' },
      ],
    ]);
  });

  it('carries description, vendor, type, tags and the handle, and omits what is empty', () => {
    const full = built(
      draftProduct('P1', {
        descriptionHtml: '<p>Hola</p>',
        vendor: 'Marca',
        productType: 'Ropa',
        tags: ['a', 'b'],
      }),
    ).input;
    expect(full).toMatchObject({
      title: 'Title P1',
      handle: 'handle-P1',
      descriptionHtml: '<p>Hola</p>',
      vendor: 'Marca',
      productType: 'Ropa',
      tags: ['a', 'b'],
    });
    const bare = built().input;
    expect(bare).not.toHaveProperty('descriptionHtml');
    expect(bare).not.toHaveProperty('vendor');
    expect(bare).not.toHaveProperty('productType');
  });

  it('maps money to its exact decimal string, never rounding', () => {
    const { input } = built(
      draftProduct('P1', {
        variants: [
          draftVariant('A', {
            price: Money.parse('19.9'),
            compareAtPrice: Money.parse('25'),
            barcode: '7791234567890',
          }),
        ],
      }),
    );
    expect(input.variants[0]).toMatchObject({
      price: '19.9',
      compareAtPrice: '25',
      barcode: '7791234567890',
    });
    const fine = built(
      draftProduct('P1', { variants: [draftVariant('A', { price: Money.parse('0.0001') })] }),
    ).input;
    expect(fine.variants[0]?.price).toBe('0.0001');
  });

  it('sends stock only for a tracked variant with a quantity, at the resolved location', () => {
    const inventory = (tracked: boolean, quantity: number | undefined) => ({
      tracked,
      quantity,
      location: 'main',
    });
    const { input } = built(
      draftProduct('P1', {
        options: [{ name: 'Talla', values: ['S', 'M', 'L'] }],
        variants: [
          draftVariant('A', { inventory: inventory(true, 4) }, ['S']),
          draftVariant('B', { inventory: inventory(false, 9) }, ['M']),
          draftVariant('C', { inventory: inventory(true, undefined) }, ['L']),
        ],
      }),
    );
    expect(input.variants.map(({ tracked, inventory: stock }) => [tracked, stock])).toEqual([
      [true, { locationId: 'gid://shopify/Location/1', quantity: 4 }],
      [false, undefined],
      [true, undefined],
    ]);
  });

  it('fails the product with the location code when a location cannot be resolved', () => {
    const product = draftProduct('P1', {
      variants: [
        draftVariant('A', { inventory: { tracked: true, quantity: 1, location: 'Nope' } }),
      ],
    });
    expect(buildProductInput(product, resolver)).toEqual({ ok: false, code: 'LOCATION_NOT_FOUND' });
  });

  it('keeps remote images in order and counts the local files it cannot send', () => {
    const result = built(
      draftProduct('P1', {
        images: [
          draftImage(1),
          draftImage(2, 'fotos/local.jpg', 'local'),
          { ...draftImage(3), alt: 'Alt' },
        ],
      }),
    );
    expect(result.input.images).toEqual([
      { url: 'https://cdn.example.com/1.jpg' },
      { url: 'https://cdn.example.com/3.jpg', alt: 'Alt' },
    ]);
    expect(result.imagesSkipped).toEqual({ localFile: 1, overLimit: 0 });
  });

  it('sends at most 250 images and counts the rest', () => {
    const images = Array.from({ length: MAX_IMAGES + 3 }, (_, index) => draftImage(index + 1));
    const result = built(draftProduct('P1', { images }));
    expect(result.input.images).toHaveLength(MAX_IMAGES);
    expect(result.imagesSkipped).toEqual({ localFile: 0, overLimit: 3 });
  });

  it('refuses a product over the variant limit and a product without variants', () => {
    const many = Array.from({ length: MAX_VARIANTS + 1 }, (_, index) => draftVariant(`S${index}`));
    expect(buildProductInput(draftProduct('P1', { variants: many }), resolver)).toEqual({
      ok: false,
      code: 'TOO_MANY_VARIANTS',
    });
    expect(buildProductInput(draftProduct('P1', { variants: [] }), resolver)).toEqual({
      ok: false,
      code: 'PRODUCT_INVALID',
    });
  });

  it('refuses a variant that lacks a value for an option', () => {
    const product = draftProduct('P1', {
      options: [{ name: 'Talla', values: ['S'] }],
      variants: [draftVariant('A', {}, [])],
    });
    expect(buildProductInput(product, resolver)).toEqual({ ok: false, code: 'PRODUCT_INVALID' });
  });
});

describe('needsLocation', () => {
  it('is true only when a variant is tracked and has a quantity', () => {
    const tracked = { tracked: true, quantity: 1, location: undefined };
    expect(
      needsLocation(draftProduct('P', { variants: [draftVariant('A', { inventory: tracked })] })),
    ).toBe(true);
    expect(needsLocation(draftProduct('P'))).toBe(false);
    expect(
      needsLocation(
        draftProduct('P', {
          variants: [draftVariant('A', { inventory: { ...tracked, quantity: undefined } })],
        }),
      ),
    ).toBe(false);
  });
});
