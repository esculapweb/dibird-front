import Stats from "./Stats";

const NotSeenScreen = ({ route }) => {
  const { notSeen } = route.params;

  return <Stats data={notSeen} />;
};

export default NotSeenScreen;