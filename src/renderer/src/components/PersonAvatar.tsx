interface Props {
  personId: string;
  thumbUrl?: string | null;
  size?: 'sm' | 'md';
  onUpdated?: () => void | Promise<void>;
}

const sizeClass = {
  sm: 'w-8 h-8 rounded',
  md: 'w-12 h-12 rounded-lg'
} as const;

export function PersonAvatar({ personId, thumbUrl, size = 'md', onUpdated }: Props) {
  const pickPhoto = async () => {
    const items = await window.api.media.add({
      personId,
      imagesOnly: true,
      setPrimary: true,
      multiple: false
    });
    if (items.length > 0) {
      await onUpdated?.();
    }
  };

  return (
    <button
      type="button"
      title={thumbUrl ? 'Сменить фото' : 'Добавить фото'}
      aria-label={thumbUrl ? 'Сменить фото' : 'Добавить фото'}
      onClick={() => void pickPhoto()}
      className={`relative shrink-0 overflow-hidden border border-stone-300 bg-stone-100 group hover:border-stone-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 ${sizeClass[size]}`}
    >
      {thumbUrl ? (
        <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-stone-400 text-lg leading-none">+</span>
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        {thumbUrl ? 'Сменить' : 'Фото'}
      </span>
    </button>
  );
}
