export const INVALIDATION_MAP = {
  Place: {
    add:    [["Places"], ["PlacesDropdown"]],
    update: [["Places"], ["PlacesDropdown"], ["Observations"], ["Observation"], ["Diaries"], ["Diary"]],
    delete: [["Places"], ["PlacesDropdown"], ["Observations"], ["Observation"], ["Diaries"], ["Diary"]],
  },
  Observation: {
    add:    [["Observations"], ["Diaries"], ["Diary"], ["DiaryDetail"], ["Places"], ["Place"], ["Stat"]],
    update: [["Observations"], ["Diaries"], ["Diary"], ["DiaryDetail"], ["Places"], ["Place"], ["Stat"]],
    delete: [["Observations"], ["Diaries"], ["Diary"], ["DiaryDetail"], ["Places"], ["Place"], ["Stat"]],
  },
  Diary: {
    add:    [["Diaries"], ["Places"]],
    update: [["Diaries"], ["Places"]],
    delete: [["Diaries"], ["Diary"], ["DiaryDetail"], ["Observations"], ["Observation"], ["Place"], ["Stat"]],
  },
};