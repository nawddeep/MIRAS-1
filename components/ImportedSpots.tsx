'use client';

import { useState } from 'react';
import imported from '@/content/research/udaipur-spots.json';
import imageData from '@/content/spot-images.json';
import { SpotImage, imageForSpot } from './SpotImage';
const spots=imported.filter(spot=>!imageData.excluded.includes(spot.id));

const categories = [...new Set(spots.map(spot => spot.category))].sort();
const pageSize = 20;
export function ImportedSpots() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const filtered = spots.filter(spot => (!category || spot.category === category) &&
    `${spot.name} ${spot.area} ${spot.category}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section aria-labelledby="imported-spots-heading" className="imported-spots">
    <header><h2 id="imported-spots-heading" className="t-heading">More places to discover</h2><p>{spots.length} place suggestions from your import. Details and map coordinates still need verification; these are separate from the place guides above.</p></header>
    <div className="imported-spots-filters">
      <label>Search places<input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Name or neighbourhood"/></label>
      <div><label htmlFor="imported-category">Category</label><select id="imported-category" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="">All categories</option>{categories.map(name => <option key={name}>{name}</option>)}</select></div>
    </div>
    <p role="status">{filtered.length} matching places</p>
    {filtered.slice((page - 1) * pageSize, page * pageSize).map(spot => <article key={spot.id} className="imported-spot">
      <SpotImage key={spot.id} {...imageForSpot(spot.id)} name={spot.name}/>
      <div className="imported-spot-body"><p className="imported-spot-category">{spot.category}</p><h3>{spot.name}</h3><p>{spot.area}</p>
      {!spot.descriptionTruncated && <p>{spot.description}</p>}
      <a className="feature-secondary" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${spot.name}, Udaipur, Rajasthan`)}`} target="_blank" rel="noopener noreferrer">Search Google Maps ↗</a>
      <details><summary>Reported details &amp; sources</summary><p>Imported information — confirm access, fees and hours before visiting.</p>
        <dl><dt>Reported hours</dt><dd>{spot.reportedHours}</dd><dt>Reported fee</dt><dd>{spot.reportedFee}</dd><dt>Suggested season</dt><dd>{spot.reportedBestTime}</dd><dt>Source notes</dt><dd>{spot.sourceNote} (direct source links not supplied)</dd></dl>
        {spot.coordinates ? <p>CSV coordinates, unverified: {spot.coordinates.lat}, {spot.coordinates.lng}. Maps search above uses the place name.</p> : <p>No coordinates supplied. Use the named Maps search.</p>}
        {spot.descriptionTruncated && <p>The supplied description was cut off and has been withheld pending review.</p>}
      </details></div>
    </article>)}
    {filtered.length === 0 && <p>No places match. <button type="button" onClick={() => { setQuery(''); setCategory(''); setPage(1); }}>Clear filters</button></p>}
    {filtered.length > pageSize && <nav aria-label="Imported places pages" className="feature-action-row"><button className="feature-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {Math.ceil(filtered.length / pageSize)}</span><button className="feature-secondary" disabled={page * pageSize >= filtered.length} onClick={() => setPage(page + 1)}>Next</button></nav>}
  </section>;
}
