import { Category } from "@/types";

interface CategoryIconProps {
  category: Category;
  className?: string;
}

/**
 * Inline SVG icon for a campaign category. The icon animates when the
 * nearest `group` ancestor is hovered; motion is disabled for users who
 * prefer reduced motion.
 */
export default function CategoryIcon({ category, className = "" }: CategoryIconProps) {
  const base = `h-4 w-4 shrink-0 transition-transform duration-[120ms] group-hover:scale-110 motion-reduce:transition-none motion-reduce:transform-none ${className}`;

  switch (category) {
    case Category.Learner:
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={base}
          data-testid="category-icon-learner"
        >
          <path d="M2 5h6a4 4 0 0 1 4 4v10a3 3 0 0 0-3-3H2z" />
          <path d="M22 5h-6a4 4 0 0 0-4 4v10a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case Category.EducationalStartup:
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${base} group-hover:-rotate-12`}
          data-testid="category-icon-startup"
        >
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </svg>
      );
    case Category.Educator:
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${base} group-hover:-translate-y-0.5`}
          data-testid="category-icon-educator"
        >
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      );
    case Category.Publisher:
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={base}
          data-testid="category-icon-publisher"
        >
          <path d="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" />
          <path d="M8 9h7M8 13h7M8 17h4" />
        </svg>
      );
    default:
      return null;
  }
}
