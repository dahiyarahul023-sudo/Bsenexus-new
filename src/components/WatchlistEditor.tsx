import React, { useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Check, X, ArrowUpRight } from 'lucide-react';
import type { StockPriority, WatchlistStockItem } from '../types';
import { watchlistIdentity } from '../shared/watchlistIdentity';
import { SaveNoteButton } from './notes/SaveNoteButton';

interface Props {
  lists: any[]; activeId: string; onSelect: (id: string) => void;
  creating: boolean; onCreating: (value: boolean) => void; listName: string; onListName: (name: string) => void; onCreate: (event: React.FormEvent) => void;
  editingId: string | null; editName: string; onEditName: (name: string) => void; onEdit: (id: string, name: string) => void; onCancelEdit: () => void; onRename: (id: string) => void;
  onToggle: (id: string, active: boolean) => void; onDelete: (id: string) => void;
  symbol: string; onSymbol: (value: string) => void; category: string; onCategory: (value: string) => void; priority: StockPriority; onPriority: (priority: StockPriority) => void;
  targetId: string; onTarget: (id: string) => void; suggestions: any[]; showSuggestions: boolean; searching: boolean; searchError: boolean; addError: string | null; adding: boolean;
  onAdd: (event: React.FormEvent, id: string) => void;
  onDirectAdd: (symbol: string, name?: string, priority?: StockPriority, category?: string, id?: string, code?: string) => void;
  filter: 'ALL' | StockPriority; onFilter: (filter: 'ALL' | StockPriority) => void; query: string; onQuery: (value: string) => void;
  onCycle: (id: string, item: WatchlistStockItem) => void; onRemove: (id: string, symbol: string) => void;
  onOpen: (code?: string, symbol?: string, name?: string) => void;
  onClear: (id?: string) => void; onReset: () => void;
}

export function WatchlistEditor(p: Props) {
  const selected = p.lists.find(list => String(list.id) === p.activeId);
  const target = selected || p.lists.find(list => String(list.id) === p.targetId) || p.lists[0];
  const stocks = useMemo(() => p.lists.filter(list => !selected || String(list.id) === p.activeId).flatMap(list => (list.items || []).flatMap((raw: any) => {
    const identity = watchlistIdentity(raw);
    if (!identity) return [];
    const priority: StockPriority = ['HIGH', 'MEDIUM', 'LOW'].includes(raw?.priority) ? raw.priority : 'HIGH';
    return [{ ...identity, priority, category: typeof raw?.category === 'string' ? raw.category : '', listId: String(list.id), listName: list.name }];
  })), [p.lists, p.activeId, selected]);
  const counts = { ALL: stocks.length, HIGH: 0, MEDIUM: 0, LOW: 0 };
  stocks.forEach(stock => counts[stock.priority]++);
  const q = p.query.trim().toLowerCase();
  const visible = stocks.filter(stock => (p.filter === 'ALL' || stock.priority === p.filter) && (!q || [stock.symbol, stock.scripCode, stock.companyName, stock.category, stock.listName].some(value => value?.toLowerCase().includes(q))));
  return <section className="watchlist-editor" aria-label="Manage watchlists">
    <aside className="watchlist-editor-lists">
      <div className="watchlist-editor-title"><h2>Your watchlists</h2><button type="button" onClick={() => p.onCreating(!p.creating)} aria-expanded={p.creating}><Plus size={15} />New list</button></div>
      {p.creating && <form className="watchlist-editor-create" onSubmit={p.onCreate}><label><span className="sr-only">New watchlist name</span><input value={p.listName} onChange={e => p.onListName(e.target.value)} placeholder="Watchlist name" required maxLength={80} /></label><button type="submit">Create</button></form>}
      <button type="button" className="watchlist-editor-all" aria-pressed={p.activeId === 'ALL'} onClick={() => p.onSelect('ALL')}>All lists<span>{p.lists.length}</span></button>
      {p.lists.map(list => <div className={`watchlist-editor-list${String(list.id) === p.activeId ? ' is-selected' : ''}`} key={list.id}>
        <label className="watchlist-editor-active"><input type="checkbox" checked={list.is_active === 1 || list.is_active === true} onChange={() => p.onToggle(String(list.id), list.is_active === 1 || list.is_active === true)} aria-label={`Alerts active for ${list.name}`} /></label>
        {p.editingId === list.id ? <form className="watchlist-editor-rename" onSubmit={e => { e.preventDefault(); p.onRename(list.id); }}><input value={p.editName} onChange={e => p.onEditName(e.target.value)} aria-label="Watchlist name" maxLength={80} required autoFocus /><button type="submit" aria-label="Save watchlist name"><Check size={16} /></button><button type="button" onClick={p.onCancelEdit} aria-label="Cancel rename"><X size={16} /></button></form>
          : <><button type="button" className="watchlist-editor-list-name" aria-pressed={String(list.id) === p.activeId} onClick={() => p.onSelect(String(list.id))}><strong>{list.name}</strong><span>{list.items?.length || 0} stocks · {list.is_active ? 'Active' : 'Paused'}</span></button><button type="button" onClick={() => p.onEdit(list.id, list.name)} aria-label={`Rename ${list.name}`}><Pencil size={15} /></button><button type="button" onClick={() => p.onDelete(list.id)} aria-label={`Delete ${list.name}`}><Trash2 size={15} /></button></>}
      </div>)}
      {!p.lists.length && <p className="watchlist-editor-empty">Create a list to start tracking companies.</p>}
    </aside>
    <div className="watchlist-editor-main">
      <div className="watchlist-editor-title"><div><h2>{selected?.name || 'All watchlist stocks'}</h2><p>{stocks.length} stocks{selected ? '' : ` across ${p.lists.length} lists`}</p></div><details className="watchlist-editor-options"><summary>Options</summary><div><button type="button" disabled={!stocks.length} onClick={() => p.onClear(selected ? String(selected.id) : undefined)}>Clear {selected ? 'this list' : 'all lists'}</button><button type="button" onClick={p.onReset}>Restore default lists</button></div></details></div>
      <form className="watchlist-editor-add" onSubmit={e => p.onAdd(e, String(target?.id || ''))}>
        {!selected && p.lists.length > 0 && <label className="watchlist-editor-target">Add to<select value={String(target?.id || '')} onChange={e => p.onTarget(e.target.value)} aria-label="Watchlist for new stock">{p.lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>}
        <div className="watchlist-editor-search-add"><label><span className="sr-only">Company name, ticker or BSE code</span><Search size={16} aria-hidden="true" /><input value={p.symbol} onChange={e => p.onSymbol(e.target.value)} placeholder="Company name, ticker or BSE code" aria-label="Company name, ticker or BSE code" autoComplete="off" /></label><button type="submit" className="watchlist-editor-primary" disabled={p.adding || !p.symbol.trim() || !target}>{p.adding ? 'Adding…' : <><Plus size={16} />Add</>}</button></div>
        <details className="watchlist-editor-add-options"><summary>Add options <span>{p.priority === 'MEDIUM' ? 'Medium' : p.priority === 'LOW' ? 'Low' : 'High'} priority{p.category ? ` · ${p.category}` : ''}</span></summary><div><label>Priority<select value={p.priority} onChange={e => p.onPriority(e.target.value as StockPriority)}><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label><label>Tag (optional)<input value={p.category} onChange={e => p.onCategory(e.target.value)} placeholder="e.g. Core holdings" maxLength={80} /></label></div></details>
        {p.searching && <p role="status">Searching companies…</p>}
        {p.showSuggestions && p.symbol.length >= 2 && !p.symbol.includes(',') && <div className="watchlist-editor-suggestions" aria-label="Matching companies">
          {p.searchError ? <p role="alert">Search is unavailable. Edit your search to retry.</p> : p.suggestions.length ? p.suggestions.map((result, index) => <div key={`${result.scripCode || result.symbol}-${index}`}><div><strong>{result.name || result.symbol}</strong><span>{result.symbol}{result.scripCode ? ` · BSE ${result.scripCode}` : ''}</span></div><button type="button" disabled={p.adding || !target} aria-label={`Add ${result.name || result.symbol} to ${target?.name || 'watchlist'}`} onClick={() => p.onDirectAdd(result.symbol || result.scripCode, result.name, p.priority, p.category, String(target?.id || ''), result.scripCode)}><Plus size={16} />Add</button></div>) : <p>No companies found. You can add an exact ticker or BSE code.</p>}
        </div>}
        {p.addError && <p role="alert" className="watchlist-editor-error">{p.addError}</p>}
      </form>
      <div className="watchlist-editor-filters" role="group" aria-label="Stock priority filters">{(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(value => <button key={value} type="button" data-priority={value} aria-pressed={p.filter === value} onClick={() => p.onFilter(value)}><span>{value === 'ALL' ? 'All stocks' : value === 'HIGH' ? 'High' : value === 'MEDIUM' ? 'Medium' : 'Low'}</span><strong>{counts[value]}</strong></button>)}</div>
      <label className="watchlist-editor-filter-search"><Search size={16} aria-hidden="true" /><input value={p.query} onChange={e => p.onQuery(e.target.value)} placeholder="Find a tracked company" aria-label="Find a tracked company" /></label>
      <p className="watchlist-editor-count" role="status">Showing {visible.length} of {stocks.length} stocks</p>
      <div className="watchlist-editor-stocks">{visible.map(stock => <article key={`${stock.listId}:${stock.symbol}`} className="watchlist-editor-stock">
        <button type="button" className="watchlist-editor-stock-name" onClick={() => p.onOpen(stock.scripCode, stock.symbol, stock.companyName)}><strong>{stock.companyName && !/^\d+$/.test(stock.companyName) ? stock.companyName : /^\d+$/.test(stock.symbol) ? `BSE ${stock.symbol}` : stock.symbol}<ArrowUpRight size={14} aria-hidden="true" /></strong><span>{stock.symbol}{stock.scripCode && stock.scripCode !== stock.symbol ? ` · BSE ${stock.scripCode}` : ''} · {stock.listName}{stock.category ? ` · ${stock.category}` : ''}</span></button>
        <div className="watchlist-editor-stock-actions"><button type="button" className="watchlist-editor-priority" data-priority={stock.priority} aria-label={`${stock.companyName || stock.symbol}: ${stock.priority.toLowerCase()} priority. Change priority`} title="Change priority: High → Medium → Low" onClick={() => p.onCycle(stock.listId, stock)}>{stock.priority === 'MEDIUM' ? 'Medium' : stock.priority === 'LOW' ? 'Low' : 'High'}</button><SaveNoteButton link={{type:'stock',label:stock.companyName || stock.symbol,symbol:stock.symbol}} label={`Save note on ${stock.companyName || stock.symbol}`} /><button type="button" aria-label={`Remove ${stock.companyName || stock.symbol} from ${stock.listName}`} onClick={() => p.onRemove(stock.listId, stock.symbol)}><Trash2 size={16} /></button></div>
      </article>)}</div>
      {!visible.length && <p className="watchlist-editor-empty">{stocks.length ? 'No stocks match these filters.' : 'No stocks in this view yet. Search above to add a company.'}</p>}
    </div>
  </section>;
}
