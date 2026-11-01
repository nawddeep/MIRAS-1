import Link from 'next/link';
import type { ReactNode } from 'react';
import imageData from '@/content/spot-images.json';
import type { frontendFeatures } from '@/lib/frontend-features';
import { SpotImage } from './SpotImage';

/** Back link, status chip, headings and a category photo: the same header FeaturePreview shows. */
export function FeatureFrame({ feature, banner, children }: { feature: (typeof frontendFeatures)[number]; banner: keyof typeof imageData.photos; children: ReactNode }) {
  return (
    <div className="feature-preview">
      <Link href="/discover" className="feature-back">← All MIRAS features</Link>
      <header className="feature-page-heading">
        <span className="feature-status">{feature.status}</span>
        <h1>{feature.title}</h1>
        <p lang="hi">{feature.hi}</p>
        <p>{feature.description}</p>
      </header>
      <SpotImage photo={imageData.photos[banner]} name={feature.title} category />
      {children}
    </div>
  );
}
