import { useProfile } from "../store/profile-context";
import { mapErrorToToast } from "../services/api";
import ErrorOverlay from "../components/Error/ErrorOverlay";

const ErrorScreen = () => {
  const { error, refreshProfile } = useProfile();

  const { title, message } = mapErrorToToast(error);

  return (
    <ErrorOverlay
      title={title}
      message={message}
      onPress={refreshProfile}
      logo
    />
  );
};

export default ErrorScreen;
