export const paraCategories = [
  {
    id: 'projects',
    name: '项目',
    english: 'Projects',
    description: '有明确目标与终点，正在推进的事。'
  },
  { id: 'areas', name: '领域', english: 'Areas', description: '持续投入、长期维护的生活与工作。' },
  {
    id: 'resources',
    name: '资源',
    english: 'Resources',
    description: '感兴趣的主题，以及可复用的知识与资料。'
  },
  {
    id: 'archives',
    name: '归档',
    english: 'Archives',
    description: '已经完成或暂时放下，留待日后回看的记录。'
  }
] as const

export type ParaCategory = (typeof paraCategories)[number]['id']

export function isParaCategory(value: unknown): value is ParaCategory {
  return paraCategories.some((category) => category.id === value)
}

export function normalizeParaCategory(value: unknown): ParaCategory {
  return isParaCategory(value) ? value : 'resources'
}
