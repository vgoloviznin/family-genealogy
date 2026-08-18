import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  ru: {
    translation: {
      appTitle: 'Семейное древо',
      createProject: 'Создать проект',
      openProject: 'Открыть проект',
      importProject: 'Импорт .fgtree',
      recentProjects: 'Недавние проекты',
      projectName: 'Название проекта',
      people: 'Люди',
      tree: 'Древо',
      settings: 'Настройки',
      search: 'Поиск…',
      addPerson: 'Добавить человека',
      save: 'Сохранить',
      cancel: 'Отмена',
      undo: 'Отменить',
      cloudWarning: 'Проект в облачной папке. Рабочая база может повредиться — используйте экспорт .fgtree для обмена.',
      firstName: 'Имя',
      lastName: 'Фамилия',
      middleName: 'Отчество',
      maidenName: 'Девичья фамилия',
      sex: 'Пол',
      living: 'Жив',
      notes: 'Заметки',
      birth: 'Рождение',
      death: 'Смерть',
      family: 'Семья',
      events: 'События',
      associations: 'Связи',
      media: 'Файлы',
      addPartner: 'Добавить партнёра',
      addChild: 'Добавить ребёнка',
      addParents: 'Добавить родителей',
      addEvent: 'Добавить событие',
      addAssociation: 'Добавить связь',
      addMedia: 'Добавить файл',
      export: 'Экспорт',
      backup: 'Бэкап',
      restore: 'Восстановить',
      backupFolder: 'Папка бэкапов',
      backupOnQuit: 'Бэкап при выходе',
      editorLabel: 'Подпись редактора',
      place: 'Место',
      date: 'Дата',
      description: 'Описание',
      eventType: 'Тип события',
      role: 'Роль',
      delete: 'Удалить',
      noProject: 'Откройте или создайте проект',
      sources: 'Источники'
    }
  }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false }
})

export default i18n
