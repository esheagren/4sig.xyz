import { citations } from "./citations";
export function SourceLinks({ urls, names }: { urls: string; names?: string }) {
  return (
    <div className="source-links">
      {citations(urls, names).map((source) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {source.label} ↗
        </a>
      ))}
    </div>
  );
}
