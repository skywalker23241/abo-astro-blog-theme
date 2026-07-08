import { visit } from 'unist-util-visit'
import { themeConfig } from '../config.ts'

/**
 * Rehype plugin that processes images in markdown content:
 * - Wraps images with alt text in figure/figcaption elements
 * - Adds data-preview attribute for image viewer functionality
 * - Adds lazy loading for better performance
 * - Handles multiple images in a single paragraph
 */
export default function rehypeImageProcessor() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'p') {
        return
      }
      if (!parent || typeof index !== 'number') {
        return
      }

      const imgNodes = []
      let hasNonImageContent = false

      for (const child of node.children) {
        if (child.type === 'element' && child.tagName === 'img') {
          imgNodes.push(child)
        } else if (child.type !== 'text' || child.value.trim() !== '') {
          hasNonImageContent = true
        }
      }

      if (hasNonImageContent || imgNodes.length === 0) {
        return
      }

      const newNodes = []

      for (const [position, imgNode] of imgNodes.entries()) {
        const alt = imgNode.properties?.alt?.trim()
        const isLeadingImage = position === 0
        const existingClassesRaw = imgNode.properties?.className || imgNode.properties?.class || []
        const existingClasses = Array.isArray(existingClassesRaw)
          ? existingClassesRaw
          : [existingClassesRaw]

        // Enhanced image properties with performance optimizations
        imgNode.properties = {
          ...imgNode.properties,
          'data-preview': themeConfig.post.imageViewer ? 'true' : 'false',
          // Let the first content image load eagerly to improve LCP.
          loading: isLeadingImage ? 'eager' : 'lazy',
          // Add decoding hint for better performance
          decoding: 'async',
          // First content image gets high fetch priority.
          fetchpriority: isLeadingImage ? 'high' : 'auto',
          className: [...existingClasses, 'img-placeholder']
        }

        if (!alt || alt.includes('_')) {
          newNodes.push(imgNode)
          continue
        }

        const figure = {
          type: 'element',
          tagName: 'figure',
          properties: {
            className: ['image-caption-wrapper']
          },
          children: [
            imgNode,
            {
              type: 'element',
              tagName: 'figcaption',
              properties: {
                className: ['img-caption']
              },
              children: [
                {
                  type: 'text',
                  value: alt
                }
              ]
            }
          ]
        }

        newNodes.push(figure)
      }

      if (newNodes.length > 0) {
        parent.children.splice(index, 1, ...newNodes)
        return index + newNodes.length - 1
      }
    })
  }
}
