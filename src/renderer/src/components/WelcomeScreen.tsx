import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  recents: string[]
  onCreate: (name: string) => void
  onOpen: () => void
  onImport: () => void
  onOpenRecent: (path: string) => void
}

export function WelcomeScreen({ recents, onCreate, onOpen, onImport, onOpenRecent }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('Моё семейное древо')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f4f1eb] to-[#e8e0d4] p-8">
      <div className="max-w-lg w-full bg-white/90 rounded-2xl shadow-lg p-8 border border-stone-200">
        <h1 className="text-3xl font-serif text-stone-800 mb-2">{t('appTitle')}</h1>
        <p className="text-stone-500 mb-8">Локальный архив семьи с экспортом в один файл</p>

        <label className="block text-sm text-stone-600 mb-1">{t('projectName')}</label>
        <input
          className="w-full border border-stone-300 rounded-lg px-3 py-2 mb-4"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="flex flex-col gap-2">
          <button
            className="bg-stone-800 text-white rounded-lg py-2.5 hover:bg-stone-700"
            onClick={() => onCreate(name)}
          >
            {t('createProject')}
          </button>
          <button className="border border-stone-300 rounded-lg py-2.5 hover:bg-stone-50" onClick={onOpen}>
            {t('openProject')}
          </button>
          <button className="border border-stone-300 rounded-lg py-2.5 hover:bg-stone-50" onClick={onImport}>
            {t('importProject')}
          </button>
        </div>

        {recents.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-medium text-stone-600 mb-2">{t('recentProjects')}</h2>
            <ul className="space-y-1">
              {recents.map((path) => (
                <li key={path}>
                  <button
                    className="text-left text-sm text-stone-700 hover:underline w-full truncate"
                    onClick={() => onOpenRecent(path)}
                    title={path}
                  >
                    {path.split('/').pop()}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
