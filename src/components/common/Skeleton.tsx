import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

const Skeleton = ({ className, ...props }: SkeletonProps) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/50",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer",
        "before:bg-gradient-to-r before:from-transparent before:via-background/80 before:to-transparent",
        className
      )}
      {...props}
    />
  );
};

// Pre-built skeleton components
const SkeletonText = ({ className, ...props }: SkeletonProps) => (
  <Skeleton className={cn("h-4 w-full", className)} {...props} />
);

const SkeletonCard = ({ className, ...props }: SkeletonProps) => (
  <Skeleton className={cn("h-24 w-full rounded-2xl", className)} {...props} />
);

const SkeletonButton = ({ className, ...props }: SkeletonProps) => (
  <Skeleton className={cn("h-10 w-full rounded-lg", className)} {...props} />
);

const SkeletonAvatar = ({ className, ...props }: SkeletonProps) => (
  <Skeleton className={cn("h-8 w-8 rounded-full", className)} {...props} />
);

export { Skeleton, SkeletonText, SkeletonCard, SkeletonButton, SkeletonAvatar };