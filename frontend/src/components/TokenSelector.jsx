import { useState, useMemo } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { ChevronDown, Search } from 'lucide-react'

export default function TokenSelector({ tokens, value, onChange, labelFn, className = '' }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const display = labelFn ? labelFn(value) : value

  const filtered = useMemo(() => {
    if (!search.trim()) return tokens
    const q = search.toLowerCase()
    return tokens.filter(t => {
      const label = (labelFn ? labelFn(t) : t).toLowerCase()
      const id = t.toLowerCase()
      return label.includes(q) || id.includes(q)
    })
  }, [tokens, search, labelFn])

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setSearch('') }}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1.5 text-xs h-9 px-3 rounded-md border bg-card hover:bg-secondary transition-all font-medium text-foreground ${className}`}
        >
          <span className="font-semibold">{display}</span>
          <ChevronDown size={12} className="text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Search size={13} className="text-muted-foreground shrink-0" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索代币..."
            className="h-7 text-xs border-0 p-0 focus-visible:ring-0"
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-[280px]">
          {filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">无匹配结果</div>
          ) : (
            <div className="py-1">
              {filtered.map(t => (
                <button
                  key={t}
                  onClick={() => { onChange(t); setOpen(false) }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-secondary
                    ${t === value ? 'text-brand-green-dark font-semibold bg-brand-green/5' : 'text-foreground'}`}
                >
                  {labelFn ? labelFn(t) : t}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
