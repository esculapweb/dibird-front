import Stats from "./Stats";

const SeenScreen = ({ route }) => {
  const { seen } = route.params;

  return <Stats data={seen} />;
};

export default SeenScreen;
