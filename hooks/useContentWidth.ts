import { useWindowDimensions } from 'react-native';

export const useContentWidth = () => {
  const { width } = useWindowDimensions();
  if (width < 768) return width;
  return Math.min(Math.max(width * 0.75, 600), 1100);
};