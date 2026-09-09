const topics = [
  { name: 'Technology & AI', examples: 'Tools & invention', icon: <><rect x="9" y="9" width="18" height="18" rx="3"/><rect x="14" y="14" width="8" height="8" rx="1"/><path d="M13 5v4m10-4v4M13 27v4m10-4v4M5 13h4m-4 10h4m18-10h4m-4 10h4"/></> },
  { name: 'Health & biotechnology', examples: 'Biology, medicine & longevity', icon: <><path d="M11 4c0 14 14 14 14 28M25 4c0 14-14 14-14 28M12 8h12M14 13h8M14 23h8M12 28h12"/></> },
  { name: 'Economics & trade', examples: 'Work, wealth & exchange', icon: <><path d="M6 29h25M8 29V19h5v10m3 0V13h5v16m3 0V7h5v22M7 11l8-5"/></> },
  { name: 'Global development', examples: 'Poverty, education & opportunity', icon: <><path d="M29 23a13 13 0 1 1-16-17M5 18h12M9 27h14M18 5c-8 7-8 19 0 26M18 31c3-3 5-7 6-11M20 15 31 4m-8 0h8v8"/></> },
  { name: 'China & global power', examples: 'Industry, influence & growth', icon: <><circle cx="18" cy="18" r="13"/><ellipse cx="18" cy="18" rx="6" ry="13"/><path d="M6 13h24M6 23h24"/><circle cx="24" cy="14" r="3" className="worldview-icon-dot"/></> },
  { name: 'Energy & resources', examples: 'Power, fuels & materials', icon: <><path d="m21 4-12 17h9l-3 11 12-17h-9z"/></> },
  { name: 'Population & demography', examples: 'Births, aging & migration', icon: <><circle cx="18" cy="10" r="4"/><path d="M11 30v-7a7 7 0 0 1 14 0v7M6 15a3 3 0 1 1 4-4M3 28v-6a5 5 0 0 1 5-5m22-2a3 3 0 1 0-4-4m7 17v-6a5 5 0 0 0-5-5"/></> },
  { name: 'Cities & urbanism', examples: 'Housing, transport & density', icon: <><path d="M4 31h28M7 31V15h10v16m0 0V5h12v26M10 20h4m-4 5h4M21 10h4m-4 6h4m-4 6h4"/></> },
  { name: 'Climate & environment', examples: 'Land, oceans & ecosystems', icon: <><path d="M8 25C2 10 17 7 29 6c1 13-3 24-15 22M7 31 24 13M14 24v-9m0 9h9"/></> },
];

export function WorldviewGrid() {
  return <ul className="worldview-grid" aria-label="Topics we explore">
    {topics.map(({ name, examples, icon }) => <li key={name}>
      <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
      <h2>{name}</h2>
      <p>{examples}</p>
    </li>)}
  </ul>;
}
