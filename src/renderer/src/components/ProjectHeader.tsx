import { useTranslation } from 'react-i18next';

export function ProjectHeader(props: {
  projectName: string;
  cloudWarning?: boolean;
  onPeople: () => void;
  onTree: () => void;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  return (
    <header className="flex items-center gap-4 px-4 py-3 bg-white border-b border-stone-200 shadow-sm" data-testid="project-header">
      <h1 className="font-serif text-lg text-stone-800">{t('appTitleWithProject', { name: props.projectName })}</h1>
      {props.cloudWarning && <span className="text-xs bg-amber-100 text-amber-900 px-2 py-1 rounded">{t('cloudWarning')}</span>}
      <div className="flex-1" />
      <button type="button" className="text-sm px-3 py-1 rounded border" onClick={props.onPeople} data-testid="header-people">
        {t('people')}
      </button>
      <button type="button" className="text-sm px-3 py-1 rounded border" onClick={props.onTree} data-testid="header-tree">
        {t('tree')}
      </button>
      <button type="button" className="text-sm px-3 py-1 rounded border" onClick={props.onSettings} data-testid="header-settings">
        {t('settings')}
      </button>
    </header>
  );
}
