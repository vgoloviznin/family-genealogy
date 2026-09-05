import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from '@renderer/i18n';
import { ProjectHeader } from '@renderer/components/ProjectHeader';

describe('ProjectHeader', () => {
  it('renders people/tree/settings and omits export/sync', async () => {
    await i18n.changeLanguage('en');
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <ProjectHeader projectName="Demo" onPeople={vi.fn()} onTree={vi.fn()} onSettings={vi.fn()} />
      </I18nextProvider>
    );
    expect(html).toContain('People');
    expect(html).toContain('Tree');
    expect(html).toContain('Settings');
    expect(html).not.toContain('Export');
    expect(html).not.toContain('Synchronize');
    expect(html).not.toContain('data-testid="header-export"');
  });
});
