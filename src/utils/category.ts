import { Category } from '../types';

export const categoryLabel = (cat: Category): string => {
  const labels: Record<Category, string> = {
    [Category.Learner]: 'Learner',
    [Category.EducationalStartup]: 'Educational Startup',
    [Category.Educator]: 'Educator',
    [Category.Publisher]: 'Publisher',
  };
  return labels[cat];
};

export const getCategoryIcon = (cat: Category): string => {
  const icons: Record<Category, string> = {
    [Category.Learner]: '🎓',
    [Category.EducationalStartup]: '🚀',
    [Category.Educator]: '👩‍🏫',
    [Category.Publisher]: '📚',
  };
  return icons[cat] ?? '💡';
};
