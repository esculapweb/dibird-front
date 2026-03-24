export const INVALIDATION_MAP = {
  Place: {
    add:    [["Places"], ["PlacesDropdown"]],
    update: [["Places"], ["PlacesDropdown"], ["Observations"], ["Observation"], ["Diaries"], ["Diary"]],
    delete: [["Places"], ["PlacesDropdown"], ["Observations"], ["Observation"], ["Diaries"], ["Diary"]],
  },
  Observation: {
    add:    [["Observations"], ["Diaries"], ["Diary"], ["DiaryDetail"], ["Places"], ["Place"], ["Stat"], ["Checklist"], ["SpeciesDropdown"]],
    update: [["Observations"], ["Diaries"], ["Diary"], ["DiaryDetail"], ["Places"], ["Place"], ["Stat"], ["Checklist"], ["SpeciesDropdown"]],
    delete: [["Observations"], ["Diaries"], ["Diary"], ["DiaryDetail"], ["Places"], ["Place"], ["Stat"], ["Checklist"], ["SpeciesDropdown"]],
  },
  Diary: {
    add:    [["Diaries"], ["Places"]],
    update: [["Diaries"], ["Place"]],
    delete: [["Diaries"], ["Diary"], ["DiaryDetail"], ["Observations"], ["Observation"], ["Place"], ["Stat"], ["Checklist"], ["SpeciesDropdown"]],
  },
};