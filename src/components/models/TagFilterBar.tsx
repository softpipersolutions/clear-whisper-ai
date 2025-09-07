import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ModelInfo } from "@/adapters/models";

export type FilterTag = 
  | 'all'
  | 'openai' 
  | 'anthropic' 
  | 'gemini'
  | 'cheapest'
  | 'fastest' 
  | 'most-capable'
  | 'best-for-query';

export interface TagFilterBarProps {
  activeFilter: FilterTag;
  onFilterChange: (filter: FilterTag) => void;
  models: ModelInfo[];
  queryAnalysis?: string[];
  className?: string;
}

interface FilterTagConfig {
  id: FilterTag;
  label: string;
  gradient: string;
  hoverGradient: string;
  glowColor: string;
  dynamic?: boolean;
}

const getFilterTags = (queryAnalysis?: string[]): FilterTagConfig[] => {
  const staticTags: FilterTagConfig[] = [
    {
      id: 'all',
      label: 'All Models',
      gradient: 'bg-gradient-to-r from-muted/80 to-muted/60',
      hoverGradient: 'hover:from-muted to-muted/80',
      glowColor: 'hsl(var(--muted))'
    },
    {
      id: 'openai',
      label: 'OpenAI',
      gradient: 'bg-gradient-to-r from-blue-500/20 to-blue-500/10',
      hoverGradient: 'hover:from-blue-500/30 hover:to-blue-500/20',
      glowColor: 'hsl(var(--blue-500))'
    },
    {
      id: 'anthropic',
      label: 'Anthropic',
      gradient: 'bg-gradient-to-r from-neon-orange/20 to-neon-orange/10',
      hoverGradient: 'hover:from-neon-orange/30 hover:to-neon-orange/20',
      glowColor: 'hsl(var(--neon-orange))'
    },
    {
      id: 'gemini',
      label: 'Gemini',
      gradient: 'bg-gradient-to-r from-green-500/20 via-blue-500/20 to-red-500/20',
      hoverGradient: 'hover:from-green-500/30 hover:via-blue-500/30 hover:to-red-500/30',
      glowColor: 'hsl(217 91 60)'
    },
    {
      id: 'cheapest',
      label: 'Cheapest',
      gradient: 'bg-gradient-to-r from-emerald-500/20 to-green-500/10',
      hoverGradient: 'hover:from-emerald-500/30 hover:to-green-500/20',
      glowColor: 'hsl(142 76 36)'
    },
    {
      id: 'fastest',
      label: 'Fastest',
      gradient: 'bg-gradient-to-r from-yellow-500/20 to-amber-500/10',
      hoverGradient: 'hover:from-yellow-500/30 hover:to-amber-500/20',
      glowColor: 'hsl(45 93 47)'
    },
    {
      id: 'most-capable',
      label: 'Most Capable',
      gradient: 'bg-gradient-to-r from-purple-500/20 to-violet-500/10',
      hoverGradient: 'hover:from-purple-500/30 hover:to-violet-500/20',
      glowColor: 'hsl(262 83 58)'
    }
  ];

  // Add dynamic tag if query analysis exists
  if (queryAnalysis && queryAnalysis.length > 0) {
    const primaryTag = queryAnalysis[0];
    const dynamicLabel = `Best for ${primaryTag}`;
    
    staticTags.push({
      id: 'best-for-query',
      label: dynamicLabel,
      gradient: 'bg-gradient-to-r from-neon-orange-bright/20 to-neon-orange/10',
      hoverGradient: 'hover:from-neon-orange-bright/30 hover:to-neon-orange/20',
      glowColor: 'hsl(var(--neon-orange-bright))',
      dynamic: true
    });
  }

  return staticTags;
};

const getModelCount = (models: ModelInfo[], filter: FilterTag): number => {
  switch (filter) {
    case 'all':
      return models.length;
    case 'openai':
      return models.filter(m => m.provider === 'openai').length;
    case 'anthropic':
      return models.filter(m => m.provider === 'anthropic').length;
    case 'gemini':
      return models.filter(m => m.provider === 'google').length;
    case 'cheapest':
    case 'fastest':
    case 'most-capable':
    case 'best-for-query':
      return models.length; // These are sorting operations, not filters
    default:
      return models.length;
  }
};

export const TagFilterBar = memo(({ 
  activeFilter, 
  onFilterChange, 
  models, 
  queryAnalysis,
  className = "" 
}: TagFilterBarProps) => {
  const filterTags = getFilterTags(queryAnalysis);

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        Model Filters
        <span className="text-xs text-muted-foreground">
          ({models.length} available)
        </span>
      </h3>
      
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          <AnimatePresence>
            {filterTags.map((tag, index) => {
              const isActive = activeFilter === tag.id;
              const modelCount = getModelCount(models, tag.id);
              
              return (
                <motion.div
                  key={tag.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ 
                    duration: 0.2, 
                    delay: index * 0.05,
                    type: "spring",
                    stiffness: 300,
                    damping: 30
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Badge
                    variant={isActive ? "default" : "outline"}
                    className={`
                      cursor-pointer transition-all duration-300 whitespace-nowrap
                      text-xs font-medium px-3 py-2 rounded-full
                      border border-border/20
                      ${!isActive ? tag.gradient : ''}
                      ${!isActive ? tag.hoverGradient : ''}
                      ${isActive 
                        ? 'bg-neon-orange text-neon-orange-foreground shadow-neon animate-pulse-glow border-neon-orange/50' 
                        : 'hover:shadow-lg hover:border-border/40'
                      }
                      ${tag.dynamic ? 'animate-fade-in-up' : ''}
                    `}
                    style={{
                      '--glow-color': tag.glowColor,
                    } as React.CSSProperties}
                    onClick={() => onFilterChange(tag.id)}
                  >
                    <span className="flex items-center gap-1.5">
                      {tag.label}
                      {!isActive && tag.id !== 'cheapest' && tag.id !== 'fastest' && tag.id !== 'most-capable' && tag.id !== 'best-for-query' && (
                        <span className="text-[10px] opacity-70 font-mono">
                          {modelCount}
                        </span>
                      )}
                    </span>
                  </Badge>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
});

TagFilterBar.displayName = "TagFilterBar";