import { getRepos } from '@/lib/repos';

export function PhotoCredits({ paths }: { paths: string[] }) {
  const media=getRepos().media.list().filter(asset=>paths.includes(asset.path) && asset.sourceUrl);
  if(!media.length) return null;
  return <details className="photo-credits"><summary>Photo credits</summary><ul>{media.map(asset=><li key={asset.id}><a href={asset.sourceUrl} target="_blank" rel="noopener noreferrer">{asset.title || 'Source photograph'} ↗</a><p>Photo: {asset.owner}</p><a href={asset.licenseUrl || asset.sourceUrl} target="_blank" rel="noopener noreferrer">{asset.license}</a><p>{asset.licenceNote}</p></li>)}</ul></details>;
}
