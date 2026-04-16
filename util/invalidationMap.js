export const INVALIDATION_MAP = {
  Place: {
    add:    [["Places"], ["PlacesDropdown"]],
    update: [["Places"], ["PlacesDropdown"], ["Observations"], ["Observation"], ["Diaries"], ["Diary"]],
    delete: [["Places"], ["PlacesDropdown"], ["Observations"], ["Observation"], ["Diaries"], ["Diary"]],
  },
  Observation: {
    add:    [["Observations"], ["Diaries"], ["Diary"], ["DiaryDetail"], ["Places"], ["Place"], ["Stat"], ["Checklist"], ["Activity"], ["SpeciesDropdown"], ["Rating"], ["RatingCompare"], ["RatingCompareHeader"]],
    update: [["Observations"], ["Observation"], ["Diaries"], ["Diary"], ["DiaryDetail"], ["Places"], ["Place"], ["Stat"], ["Activity"], ["Checklist"], ["SpeciesDropdown"], ["Rating"], ["RatingCompare"], ["RatingCompareHeader"]],
    delete: [["Observations"], ["Diaries"], ["Diary"], ["DiaryDetail"], ["Places"], ["Place"], ["Stat"], ["Checklist"], ["Activity"], ["SpeciesDropdown"], ["Rating"], ["RatingCompare"], ["RatingCompareHeader"]],
  },
  Diary: {
    add:    [["Diaries"], ["Places"]],
    update: [["Diaries"], ["Diary"], ["Observation"], ["Place"]],
    delete: [["Diaries"], ["Diary"], ["DiaryDetail"], ["Observations"], ["Observation"], ["Place"], ["Stat"], ["Checklist"], ["Activity"], ["SpeciesDropdown"], ["Rating"], ["RatingCompare"], ["RatingCompareHeader"]],
  },
  Profile: {
    update: [["Rating"], ["userProfile"], ["RatingCompareHeader"]],
  },
};