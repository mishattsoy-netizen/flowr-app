import { useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/data/store';

// Stub for knowledge search logic (previously in deleted mode directory)
interface SearchResult {
  type: 'entity' | 'snippet' | 'resource' | 'guide';
  item: any;
}

const searchKnowledge = (query: string): SearchResult[] => {
  // Simple stub for now, will be implemented with real store search later
  return [];
};

export function KnowledgeSearchWidget() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setResults(searchKnowledge(val));
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'entity') {
      setActiveEntityId(result.item.id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-sidebar group/widget rounded-[var(--radius-big)] overflow-hidden shadow-sm transition-all">
      <div className="flex items-center px-4 py-3 border-b border-[var(--bone-5)] bg-[var(--color-panel)]/50 backdrop-blur-sm">
        <Search className="w-4 h-4 text-muted-foreground mr-2" />
        <input
          type="text"
          placeholder="Search knowledge..."
          value={query}
          onChange={handleSearch}
          className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {query && results.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground mt-4">No results found.</div>
        ) : (
          <ul className="space-y-1">
            {results.map(r => (
              <li key={r.item.id}>
                <button
                  onClick={() => handleResultClick(r)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-[var(--bone-5)] transition-colors"
                >
                  <div className="text-sm font-medium text-foreground truncate">
                    {r.type === 'snippet' ? (r.item.title || 'Untitled Snippet') : r.item.title}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">{r.type}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
