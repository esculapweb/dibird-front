import { createContext, useContext, useState } from "react";

const PlacesContext = createContext({
  favouriteUpdates: {}, // { [placeId]: true/false }
  setFavouriteUpdate: (placeId, value) => {},
  clearFavouriteUpdate: (placeId) => {},
});

export const PlacesProvider = ({ children }) => {
  const [favouriteUpdates, setFavouriteUpdates] = useState({});

  const setFavouriteUpdate = (placeId, value) => {
    setFavouriteUpdates((prev) => ({ ...prev, [placeId]: value }));
  };

  const clearFavouriteUpdate = (placeId) => {
    setFavouriteUpdates((prev) => {
      const copy = { ...prev };
      delete copy[placeId];
      return copy;
    });
  };

  return (
    <PlacesContext.Provider
      value={{ favouriteUpdates, setFavouriteUpdate, clearFavouriteUpdate }}
    >
      {children}
    </PlacesContext.Provider>
  );
};

export const usePlaces = () => useContext(PlacesContext);