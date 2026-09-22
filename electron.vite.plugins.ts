import type { Plugin } from 'vite';
import { stripCrossoriginAttributes } from './src/shared/renderer-packaging';

/** Remove crossorigin attributes Vite injects into index.html (breaks file:// / CORS). */
export function stripCrossoriginHtmlPlugin(): Plugin {
  return {
    name: 'strip-crossorigin-html',
    enforce: 'post',
    transformIndexHtml(html) {
      return stripCrossoriginAttributes(html);
    }
  };
}
