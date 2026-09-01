import { useTranslation } from 'react-i18next';
import type { PersonDetail } from '@shared/types';
import { ActionBtn, DangerBtn, EmptyState, GhostBtn } from './ui';

interface Props {
  person: PersonDetail;
  onRefresh: () => Promise<void>;
}

export function PersonMediaTab({ person, onRefresh }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <ActionBtn label={t('addMedia')} onClick={() => void window.api.media.add({ personId: person.id }).then(onRefresh)} />
      {person.media.length === 0 ? (
        <EmptyState text={t('personDetail.emptyMedia')} />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {person.media.map((m) => (
            <div key={m.id} className="border border-stone-300 rounded-lg p-2 text-center bg-stone-50">
              {m.thumbUrl ? (
                <img src={m.thumbUrl} alt="" className="w-full h-24 object-cover rounded mb-1" />
              ) : (
                <div className="h-24 bg-stone-100 flex items-center justify-center text-xs">{m.fileName}</div>
              )}
              <div className="text-xs font-medium truncate text-stone-900">{m.fileName}</div>
              <div className="flex gap-1 justify-center mt-1.5 flex-wrap">
                <GhostBtn label={t('personDetail.openMedia')} onClick={() => void window.api.media.open(m.id)} />
                {!m.isPrimary && (
                  <GhostBtn label={t('personDetail.setPrimaryMedia')} onClick={() => void window.api.media.setPrimary(person.id, m.id).then(onRefresh)} />
                )}
                <DangerBtn
                  label={t('delete')}
                  onClick={() => {
                    void window.api.dialog
                      .confirm({
                        message: t('deleteMediaConfirm'),
                        destructive: true
                      })
                      .then((confirmed) => {
                        if (confirmed) {
                          void window.api.media.delete(m.id).then(onRefresh);
                        }
                      });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
