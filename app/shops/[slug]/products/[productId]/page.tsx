import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMarketplace } from '@/lib/marketplace/store';
import { currentMember } from '@/lib/community/http';
import { ProductDetailView } from '@/components/ProductDetailView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}): Promise<Metadata> {
  const { slug, productId } = await params;
  const marketplace = getMarketplace();
  const shop = marketplace.getShopBySlug(slug);
  const product = marketplace.getProduct(productId);
  if (!shop || !product || product.shopId !== shop.id) {
    return { title: 'Product Not Found — MIRAS' };
  }
  return {
    title: `${product.name} — ${shop.name} | MIRAS Udaipur`,
    description: product.description.slice(0, 160),
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  const { slug, productId } = await params;
  const marketplace = getMarketplace();
  const shop = marketplace.getShopBySlug(slug);
  const product = marketplace.getProduct(productId);

  if (!shop || !product || product.shopId !== shop.id) {
    notFound();
  }

  const currentUser = await currentMember();

  return (
    <ProductDetailView
      shop={shop}
      product={product}
      currentUser={currentUser || null}
    />
  );
}
